import { memoize } from "es-toolkit";
import {
  AIError,
  AgentPlatformBackend,
  FinishReason,
  GenerationConfig,
  ThinkingLevel,
  Tool,
  UsageMetadata,
  getAI,
  getGenerativeModel,
} from "firebase/ai";

import { ChatModel, buildChatSystemInstruction } from "./ai-chat";
import { AITree, AITreeSchema, aiTreeJsonSchema } from "./ai-schemas";
import chatPromptMarkdown from "./chat-prompt.md";
import { SearchModel, chatSearchDeclaration } from "./chat-search";
import { chatToolDeclarations } from "./chat-tools";
import { firebaseApp } from "./firebase";
import promptMarkdown from "./prompt.md";
import searchPromptMarkdown from "./search-prompt.md";

// NOTE: strip HTML comments, which are notes to developers and not to the AI
const stripComments = (markdown: string) =>
  markdown.replace(/<!--[\s\S]*?-->\n*/g, "");
const treePrompt = stripComments(promptMarkdown);
const chatPrompt = stripComments(chatPromptMarkdown);
const searchPrompt = stripComments(searchPromptMarkdown);

// NOTE: gemini-4-hydrogen builds a much fuller tree than gemini-3.8-flash. On
// the bathtub demo case, it was the first to cover every issue in the
// human-crafted tree, in about 1.5 minutes, most of it spent writing.
// gemini-3.8-flash took about 15 seconds for a tree a third of the size.
// TODO: Gemini 4 models can be retired on short notice, so check
// https://firebase.google.com/docs/ai-logic/models
const TREE_MODEL = "gemini-4-hydrogen";

// NOTE: the chat is not on the model that generates trees. A reply has to
// come in seconds, and TREE_MODEL takes about 1.5 minutes for a tree. On a
// tree of three nodes, gemini-3.8-flash at a low thinking level called a tool
// in about 2 seconds, and answered a question in 1 to 3, though one argument
// took 24. It took the JSON schema of the tools as zod writes it, streamed
// with thinking on, and followed the rule on when to ask first, see
// chat-prompt.md.
const CHAT_MODEL = "gemini-3.8-flash";

// TODO: consider server prompt templates, see getTemplateGenerativeModel of
// firebase/ai. The prompts, the tools and the model would then be set on the
// server, where now any client that passes App Check can send any prompt to
// any model on the bill of this app. More so with a chat, which is many
// requests where a generation is one.
function getAIModel(
  generationConfig?: GenerationConfig,
  systemInstruction?: string,
  model: string = "gemini-3.8-flash",
  tools?: Tool[],
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
      tools,
    },
  );
}

/**
 * Returns the model of the AI for a chat about a tree, with the tools that
 * edit a tree, see sendChatMessage in ai-chat.ts.
 *
 * @param chat - What is kept of how the tree was generated, which goes into
 * the system instruction
 */
export function getChatModel(
  chat: Parameters<typeof buildChatSystemInstruction>[2],
): ChatModel {
  return getAIModel(
    {
      // NOTE: a reply is a few sentences and a few calls, so this is only a
      // stop for a reply that runs away
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
    buildChatSystemInstruction(chatPrompt, treePrompt, chat),
    CHAT_MODEL,
    // NOTE: the declarations are JSON schema from zod, which the AI takes,
    // where the type of the SDK asks for its own schema format
    [
      {
        functionDeclarations: [...chatToolDeclarations, chatSearchDeclaration],
      },
    ] as unknown as Tool[],
  );
}

/**
 * Returns the model of the AI that searches the web for the chat, see
 * runChatSearch in chat-search.ts.
 *
 * NOTE: with Google Search as its only tool, and a prompt of its own. It is
 * given a question and nothing of the tree or the case.
 */
export function getSearchModel(): SearchModel {
  return getAIModel(
    {
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
    searchPrompt,
    CHAT_MODEL,
    [{ googleSearch: {} }],
  );
}

/**
 * The files that extractTextFromFile can read, for the accept of a file input.
 *
 * NOTE: the AI that extracts the text reads only PDF and plain text, see
 * https://firebase.google.com/docs/ai-logic/input-file-requirements. Word
 * files are listed there for Gemini 4 models only, and RTF not at all.
 *
 * TODO: read .docx, which is what lawyers mostly have, in the browser with a
 * library like mammoth
 */
export const EXTRACTABLE_FILE_TYPES = ".pdf,.txt";

/**
 * NOTE: the limit for a whole request is 20 MB, and base64 makes a file a
 * third larger, which leaves about 14 MB for the file
 *
 * TODO: for larger files, upload to Cloud Storage for Firebase and pass a
 * FileDataPart with the URL, which also means storing the document of a user
 */
const MAX_EXTRACTABLE_FILE_BYTES = 14 * 1024 * 1024;

/**
 * Extracts plain text from a file, using AI unless it is a plain text file.
 *
 * The text is extracted as a first step, before a tree is generated from it,
 * so that the user can see and edit what the tree is generated from.
 *
 * TODO: extract the text of a PDF in the browser with a library like pdf.js,
 * and keep the AI for a scanned PDF, which has no text to extract. The AI is a
 * weak way to copy text: it can leave out, reword or make up text, the text
 * has to fit in its output, the user waits twice, and the document goes to the
 * AI when it is chosen, before the user asks for a tree. The chat with AI
 * adds a reason: it checks new quotes against this text, and sends it with
 * every message, see ai-chat.ts, so words that the AI changed here are
 * quotes that are not found there.
 *
 * TODO: stream the text, so that a long extraction shows progress and can be
 * canceled, as tree generation does. Also set a low thinking level, because
 * this is copying.
 *
 * @throws Error with a message for the user
 */
export async function extractTextFromFile(file: File): Promise<string> {
  try {
    // NOTE: a plain text file needs no AI to read it, which would also take a
    // while for a long file, and could change the text.
    //
    // NOTE: the text is used as written, so it keeps any hard-wrapped lines,
    // and things like page numbers of text that was taken from a PDF. The AI
    // joins the lines of a paragraph for other files, see below. That was not
    // done here, because a single newline can also be meant, as in a list.
    if (file.type === "text/plain" || /\.txt$/i.test(file.name)) {
      const text = (await file.text()).trim();
      if (!text) {
        throw new Error("The file is empty");
      }
      return text;
    }

    // NOTE: the browser gives no type for some files, so also go by the name
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      throw new Error("Only PDF and plain text files can be read");
    }
    if (file.size > MAX_EXTRACTABLE_FILE_BYTES) {
      throw new Error(
        `The file is too large. The limit is ${MAX_EXTRACTABLE_FILE_BYTES / 1024 / 1024} MB`,
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    // TODO: Buffer is from Node, and only here because the bundler provides
    // it. Use something that browsers have, like FileReader.readAsDataURL.
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // NOTE: this once said to ignore footnotes and to focus on what is
    // relevant for legal analysis. Both invite leaving text out, and a
    // footnote of a legal document often has substance.
    const prompt = `
Transcribe all of the text of this document, word for word. Include footnotes and the text of tables.
Do not summarize, reword or leave anything out, and do not add headings, explanations or formatting.
Leave out page numbers, and headers and footers that repeat on every page.
Put two newlines between paragraphs. Replace newlines within a paragraph with a single space.
Put each row of a table in a paragraph of its own, with " | " between its cells.
    `.trim();

    // Generate content with the file data
    const result = await getAIModel().generateContent([
      {
        type: "text",
        text: prompt,
      },
      {
        type: "inlineData",
        inlineData: {
          mimeType: "application/pdf",
          data: base64,
        },
      },
    ]);

    // NOTE: the whole text has to fit in the output of the AI, so a long
    // document is cut off. A stop for recitation is possible too, because the
    // AI is asked to copy, and a legal document quotes published text.
    const finishReason = result.response.candidates?.[0]?.finishReason;
    if (finishReason === FinishReason.MAX_TOKENS) {
      throw new Error("The document is too long to extract all of its text");
    }
    if (finishReason && finishReason !== FinishReason.STOP) {
      throw new Error(`The AI stopped before the end (${finishReason})`);
    }

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
    throw new Error(
      `Failed to extract text from file. ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
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
// TODO: let the chat with AI generate a tree, and generate one again from
// the case description that it keeps, see use-chat-store.ts. The cache here
// is by the text, so it would give back the same tree, and needs a way
// around for that.
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
