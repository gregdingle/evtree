import { isPlainObject, memoize } from "es-toolkit";
import { isEmpty } from "es-toolkit/compat";
import {
  AIError,
  AgentPlatformBackend,
  GenerationConfig,
  ThinkingLevel,
  UsageMetadata,
  getAI,
  getGenerativeModel,
} from "firebase/ai";

import { createEdge } from "@/lib/edge";
import { createNode } from "@/lib/node";
import { createTree } from "@/lib/tree";

import {
  BranchShape,
  NodeSchema,
  NodeShape,
  buildNodeJsonSchema,
} from "./ai-schemas";
import { AppEdge } from "./edge";
import { firebaseApp } from "./firebase";
import { AppNode } from "./node";
import promptMarkdown from "./prompt.md";
import { DecisionTree } from "./tree";

const nodeJsonSchema = buildNodeJsonSchema();

// NOTE: strip HTML comments, which are notes to developers and not to the AI
const treePrompt = promptMarkdown.replace(/<!--[\s\S]*?-->\n*/g, "");

function getAIModel(
  generationConfig?: GenerationConfig,
  systemInstruction?: string,
) {
  // NOTE: Callers of the functions in this file should check that firebaseApp exists.
  if (!firebaseApp) {
    throw new Error("[EVTree] Firebase app is not initialized");
  }
  return getGenerativeModel(
    // NOTE: AgentPlatformBackend is the renamed VertexAIBackend in firebase 13.
    // It defaults to the "global" location, recommended by Firebase, where the
    // old VertexAIBackend defaulted to "us-central1".
    getAI(firebaseApp, { backend: new AgentPlatformBackend() }),
    {
      // NOTE: gemini-2.0 models were shut down June 1, 2026 and gemini-2.5
      // models October 20, 2026. gemini-3.8-flash is Firebase's recommended
      // stable model with no shutdown date, see
      // https://firebase.google.com/docs/ai-logic/models
      model: "gemini-3.8-flash",
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
  }: GenerateDecisionTreeArgs): Promise<NodeShape> {
    const startTime = performance.now();
    let phase: AIGenerationPhase = "waiting";
    let usage: UsageMetadata | undefined;
    onProgress?.({ phase });

    try {
      // Generate the decision tree using AI, as JSON matching NodeSchema
      // NOTE: the prompt is the system instruction and the user's description is
      // the content, so the description is less likely to override the
      // instructions, and no template substitution is needed. Tags mark where the
      // description ends.
      const result = await getAIModel(
        {
          responseMimeType: "application/json",
          responseJsonSchema: nodeJsonSchema,
          thinkingConfig: {
            // NOTE: with the default thinking level, the AI builds the smallest tree
            // that satisfies the prompt and leaves out issues from the description
            thinkingLevel: ThinkingLevel.HIGH,
            // NOTE: thought summaries are streamed as status messages
            includeThoughts: true,
          },
        },
        treePrompt,
      ).generateContentStream(
        `## Lawsuit description\n\n<lawsuit>\n${text}\n</lawsuit>`,
        // NOTE: the SDK clears the timeout once the response headers arrive, so
        // for a stream it limits only the wait for the first chunk, not the
        // whole generation. The default is 180 seconds.
        { timeout: 300_000, signal },
      );

      let thoughts = "";
      let generatedText = "";
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
          // NOTE: every node has a branches key, even a terminal node
          onProgress?.({
            phase,
            nodes: generatedText.match(/"branches"/g)?.length ?? 0,
          });
        }
      }

      // NOTE: to see where generation time goes: thinking or output tokens
      // eslint-disable-next-line no-console
      console.debug(
        `[EVTree] AI decision tree generated in ${formatElapsed(performance.now() - startTime)}. Tokens: ${usage?.thoughtsTokenCount ?? 0} thinking, ${usage?.candidatesTokenCount ?? 0} output, ${usage?.promptTokenCount ?? 0} prompt.`,
      );
      // NOTE: to compare what the AI planned with the tree it wrote
      // eslint-disable-next-line no-console
      console.debug(`[EVTree] AI thought summaries:\n\n${thoughts}`);

      // Parse the JSON response
      phase = "parsing";
      onProgress?.({ phase });
      const decisionTree: DecisionTree = JSON.parse(generatedText);

      // Sanity check that we have a structure
      if (!isPlainObject(decisionTree) || isEmpty(decisionTree)) {
        throw new Error("Invalid decision tree structure returned by AI");
      }

      phase = "validating";
      onProgress?.({ phase });
      return NodeSchema.parse(decisionTree);
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
): Promise<NodeShape> {
  try {
    return await generateDecisionTreeMemoized({ text, onProgress, signal });
  } catch (error) {
    // NOTE: don't cache failures, so that the user can retry
    generateDecisionTreeMemoized.cache.delete(text);
    throw error;
  }
}

/**
 * Converts AI-generated hierarchical NodeShape structure to flat DecisionTree format
 */
export function convertAIStructureToDecisionTree(
  rootNode: NodeShape,
  name: string,
  description: string,
): DecisionTree {
  // NOTE: ignore positions because auto-arrange after
  const dummyPosition = { x: 0, y: 0 };

  const nodes: Record<string, AppNode> = {};
  const edges: Record<string, AppEdge> = {};
  function processNodeAndBranch(
    node: NodeShape,
    branch?: BranchShape,
    parentId?: string,
  ): void {
    // Determine node type based on whether it has branches
    // TODO: consider adding decision nodes to the prompt and AI schemas, for
    // choices that a party makes itself, such as filing a motion. The prompt
    // currently only asks for chance and terminal nodes.
    // TODO: we shouldn't really define decision nodes this way... either
    // exclude decision node, or else modify the prompt and AI schemas to return
    // decision nodes
    let nodeType: "decision" | "chance" | "terminal";
    if (node.branches.length === 0) {
      nodeType = "terminal";
    } else if (node.branches.length === 1) {
      nodeType = "decision";
    } else {
      nodeType = "chance";
    }

    // Create the node
    const appNode = createNode(dummyPosition, nodeType, false, {
      description: "",
      // NOTE: convert to string which will be converted back to number internally
      valueExpr: node.value?.toString() || undefined,
      costExpr: node.cost?.toString() || undefined,
    });

    nodes[appNode.id] = appNode;

    // Create edge from parent if there is one
    if (parentId) {
      const edge = createEdge(parentId, appNode.id, false, {
        label: branch?.label || "",
        // NOTE: convert to string which will be converted back to number internally
        probabilityExpr: branch?.probability?.toString() || undefined,
        description: branch?.reason || "",
      });
      edges[edge.id] = edge;
    }

    // Process child branches
    node.branches.forEach((branch) => {
      processNodeAndBranch(branch.nextNode, branch, appNode.id);
    });
  }

  // Process all nodes
  processNodeAndBranch(rootNode);

  return createTree(name, description, nodes, edges);
}
