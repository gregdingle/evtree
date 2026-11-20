import { memoize } from "es-toolkit";
import {
  AIError,
  AgentPlatformBackend,
  GenerationConfig,
  ThinkingLevel,
  UsageMetadata,
  getAI,
  getGenerativeModel,
} from "firebase/ai";

import { AITree, AITreeSchema, aiTreeJsonSchema } from "./ai-schemas";
import { firebaseApp } from "./firebase";
import promptMarkdown from "./prompt.md";

// NOTE: strip HTML comments, which are notes to developers and not to the AI
const treePrompt = promptMarkdown.replace(/<!--[\s\S]*?-->\n*/g, "");

// NOTE: gemini-4-hydrogen builds a much fuller tree than gemini-3.8-flash. On
// the bathtub demo case, it was the first to cover every issue in the
// human-crafted tree, in about 1.5 minutes, most of it spent writing.
// gemini-3.8-flash took about 15 seconds for a tree a third of the size.
// TODO: Gemini 4 models can be retired on short notice, so check
// https://firebase.google.com/docs/ai-logic/models
const TREE_MODEL = "gemini-4-hydrogen";

function getAIModel(
  generationConfig?: GenerationConfig,
  systemInstruction?: string,
  model: string = "gemini-3.8-flash",
) {
  // NOTE: Callers of the functions in this file should check that firebaseApp exists.
  if (!firebaseApp) {
    throw new Error("[EVTree] Firebase app is not initialized");
  }
  return getGenerativeModel(
    // NOTE: AgentPlatformBackend is the renamed VertexAIBackend in firebase 13.
    // It defaults to the "global" location, recommended by Firebase, where the
    // old VertexAIBackend defaulted to "us-central1".
    // TODO: pass useLimitedUseAppCheckTokens: true, deploy, and then turn on
    // replay protection for Firebase AI Logic in the App Check console, so that
    // a captured App Check token can't be used again. Turning it on in the
    // console first would probably fail requests from the live app.
    getAI(firebaseApp, { backend: new AgentPlatformBackend() }),
    {
      // NOTE: gemini-2.0 models were shut down June 1, 2026 and gemini-2.5
      // models October 20, 2026. gemini-3.8-flash is Firebase's recommended
      // stable model with no shutdown date, see
      // https://firebase.google.com/docs/ai-logic/models
      model,
      generationConfig,
      systemInstruction,
    },
  );
}

/**
 * Extracts plain text from a file using AI
 */
export async function extractTextFromFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `
Please extract all plain text content from this document.
Return only the extracted text content without any formatting, headers, or explanations.
Put two newlines between paragraphs. Replace newlines within a paragraph with a single space.
Focus on extracting the actual readable text content that would be relevant for legal document analysis.
Ignore footnotes.
    `.trim();

    // Generate content with the file data
    const result = await getAIModel().generateContent([
      {
        type: "text",
        text: prompt,
      },
      {
        // QUESTION: use FileDataPart instead?
        type: "inlineData",
        inlineData: {
          mimeType: file.type,
          data: base64,
        },
      },
    ]);

    const extractedText = result.response
      .text()
      .trim()
      // Clean up paragraphs
      .replaceAll(/\n{2,}/g, "~TEMP~")
      .replaceAll(/\n/g, " ")
      .replaceAll("~TEMP~", "\n\n");

    if (!extractedText) {
      throw new Error("No text could be extracted from the file");
    }

    return extractedText;
  } catch (error) {
    throw new Error(`Failed to extract text from file: ${error}`);
  }
}

/**
 * Where AI tree generation is: waiting for the first chunk of the stream,
 * thinking, writing the JSON, or checking the finished JSON.
 */
export type AIGenerationPhase =
  "waiting" | "thinking" | "writing" | "parsing" | "validating";

export interface AIGenerationProgress {
  phase: AIGenerationPhase;
  /** The heading of the latest thought summary, while thinking */
  status?: string;
  /** The number of nodes written so far, while writing */
  nodes?: number;
}

/**
 * Formats milliseconds as m:ss
 */
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * An AI generation failure, with the phase it failed in and how long it ran,
 * to tell apart failures while thinking from failures while writing.
 */
export class AIGenerationError extends Error {
  constructor(
    readonly phase: AIGenerationPhase,
    readonly elapsedMs: number,
    readonly status: number | undefined,
    cause: unknown,
  ) {
    super(
      `failed after ${formatElapsed(elapsedMs)} while ${phase}${status ? ` (${status})` : ""}: ${cause}`,
      { cause },
    );
    this.name = "AIGenerationError";
  }
}

/**
 * Returns the last bold heading in Gemini thought summaries, which start each
 * thought like "**Identifying the claims**".
 */
function getLastThoughtHeading(thoughts: string): string | undefined {
  return [...thoughts.matchAll(/\*\*(.+?)\*\*/g)].at(-1)?.[1];
}

interface GenerateDecisionTreeArgs {
  text: string;
  onProgress?: (progress: AIGenerationProgress) => void;
  signal?: AbortSignal;
}

// NOTE: memoize to avoid spamming service
// QUESTION: maybe throttle would be better?
const generateDecisionTreeMemoized = memoize(
  async function ({
    text,
    onProgress,
    signal,
  }: GenerateDecisionTreeArgs): Promise<AITree> {
    const startTime = performance.now();
    let phase: AIGenerationPhase = "waiting";
    let usage: UsageMetadata | undefined;
    let thoughts = "";
    let generatedText = "";
    onProgress?.({ phase });

    try {
      // Generate the decision tree using AI, as JSON matching AITreeSchema
      // NOTE: the prompt is the system instruction and the user's description is
      // the content, so the description is less likely to override the
      // instructions, and no template substitution is needed. Tags mark where the
      // description ends.
      const result = await getAIModel(
        {
          responseMimeType: "application/json",
          responseJsonSchema: aiTreeJsonSchema,
          thinkingConfig: {
            // NOTE: MEDIUM relies on the AI writing out the issues first, see
            // AITreeSchema. With gemini-3.8-flash, HIGH took 2.5 minutes of
            // thinking for a tree that was little better than at MEDIUM.
            thinkingLevel: ThinkingLevel.MEDIUM,
            // NOTE: thought summaries are streamed as status messages
            includeThoughts: true,
          },
        },
        treePrompt,
        TREE_MODEL,
      ).generateContentStream(
        `## Lawsuit description\n\n<lawsuit>\n${text}\n</lawsuit>`,
        // NOTE: the SDK clears the timeout once the response headers arrive, so
        // for a stream it limits only the wait for the first chunk, not the
        // whole generation. The default is 180 seconds.
        { timeout: 300_000, signal },
      );

      for await (const chunk of result.stream) {
        usage = chunk.usageMetadata ?? usage;
        const thought = chunk.thoughtSummary();
        if (thought) {
          thoughts += thought;
          phase = "thinking";
          onProgress?.({ phase, status: getLastThoughtHeading(thoughts) });
        }
        const chunkText = chunk.text();
        if (chunkText) {
          generatedText += chunkText;
          phase = "writing";
          // NOTE: every node has an id key, which "parentId" doesn't match
          onProgress?.({
            phase,
            nodes: generatedText.match(/"id"/g)?.length ?? 0,
          });
        }
      }

      // NOTE: to see where generation time goes: thinking or output tokens
      // eslint-disable-next-line no-console
      console.debug(
        `[EVTree] AI decision tree generated by ${TREE_MODEL} in ${formatElapsed(performance.now() - startTime)}. Tokens: ${usage?.thoughtsTokenCount ?? 0} thinking, ${usage?.candidatesTokenCount ?? 0} output, ${usage?.promptTokenCount ?? 0} prompt.`,
      );
      // NOTE: to compare what the AI planned with the tree it wrote
      // eslint-disable-next-line no-console
      console.debug(`[EVTree] AI thought summaries:\n\n${thoughts}`);

      // Parse the JSON response
      phase = "parsing";
      onProgress?.({ phase });
      const aiTree: unknown = JSON.parse(generatedText);

      phase = "validating";
      onProgress?.({ phase });
      const validTree = AITreeSchema.parse(aiTree);
      // NOTE: to compare the issues that the AI listed with the tree it wrote
      // eslint-disable-next-line no-console
      console.debug(
        `[EVTree] AI issues:\n\n${validTree.issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}`,
      );
      return validTree;
    } catch (error) {
      // NOTE: an abort by the user is not a failure
      if (signal?.aborted) {
        throw error;
      }
      const generationError = new AIGenerationError(
        phase,
        performance.now() - startTime,
        error instanceof AIError ? error.customErrorData?.status : undefined,
        error,
      );
      console.error(
        `[EVTree] AI decision tree generation ${generationError.message}. Tokens so far: ${usage?.thoughtsTokenCount ?? "unknown"} thinking, ${usage?.candidatesTokenCount ?? "unknown"} output.`,
        error,
      );
      // NOTE: to see how far the AI got, and whether what it wrote was sound
      // eslint-disable-next-line no-console
      console.debug(
        `[EVTree] AI output before the failure: ${generatedText.match(/"id"/g)?.length ?? 0} nodes, ${generatedText.length} characters, ending:\n\n${generatedText.slice(-600)}`,
      );
      // eslint-disable-next-line no-console
      console.debug(`[EVTree] AI thought summaries:\n\n${thoughts}`);
      // QUESTION: should we retry schema parse failures? maybe with a different model or settings?
      throw generationError;
    }
  },
  { getCacheKey: ({ text }: GenerateDecisionTreeArgs) => text },
);

/**
 * Creates a decision tree from a text description using AI.
 *
 * @param text - The case description to convert into a decision tree
 * @param onProgress - Called as the AI thinks and writes, for status messages
 * @param signal - Aborts the request
 * @returns Promise<Decision> - The generated decision tree structure
 * @throws AIGenerationError with the phase and elapsed time of a failure
 */
export async function generateDecisionTree(
  text: string,
  onProgress?: (progress: AIGenerationProgress) => void,
  signal?: AbortSignal,
): Promise<AITree> {
  try {
    return await generateDecisionTreeMemoized({ text, onProgress, signal });
  } catch (error) {
    // NOTE: don't cache failures, so that the user can retry
    generateDecisionTreeMemoized.cache.delete(text);
    throw error;
  }
}

export { convertAIStructureToDecisionTree } from "./ai-convert";
