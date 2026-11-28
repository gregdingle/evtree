import type { Content, FunctionCall, GenerativeModel, Part } from "firebase/ai";
import { nanoid } from "nanoid";

import {
  Chat,
  ChatEdit,
  ChatMessage,
  useChatStore,
} from "@/hooks/use-chat-store";
import { useTreeStore } from "@/hooks/use-tree-store";
import { formatValue } from "@/utils/format";

import {
  AIRow,
  AIRowAliases,
  ReasonSource,
  convertDecisionTreeToAIRows,
  getAIRowAliases,
  splitReasonSource,
} from "./ai-convert";
import {
  ChatToolContext,
  applyChatToolCall,
  checkChatToolCall,
} from "./chat-tools";
import { getRootNodeIds } from "./maps";
import { computeNetExpectedValues } from "./selectors";
import { DecisionTree } from "./tree";

/**
 * A turn of the chat with AI about a tree: the message of a user goes to the
 * AI with the tree, and the AI answers in text and with calls of the tools
 * that edit the tree, see chat-tools.ts.
 *
 * Do it, or ask first. An edit that the user asked for is made at once, and
 * can be undone. An edit that the AI thinks of itself waits for the user to
 * accept or reject it. This is how code editors with an AI agent work: they
 * edit and rely on undo, where asking before every edit is a mode that a user
 * picks. A user who says "set this to 60%" does not want to be shown a
 * proposal to set it to 60%. The AI says which of the two a call is, with
 * `askFirst`, because only the AI read the request, and a tool can ask
 * always, see alwaysAsk.
 *
 * NOTE: so text that fools the AI could change a tree without a click, like
 * an instruction in a case description that the other party wrote, or in a
 * tree from a share link. What bounds that: an edit is only to the current
 * tree, through tools that each check it; every edit is a line in the chat
 * and one undo step; a tool that deletes always asks; no tool reads a URL or
 * sends anything out; and a reply is shown as plain text.
 *
 * TODO: a setting to ask before every edit, as code editors have, for a user
 * who wants to approve each one. It would be one more reason to wait in
 * runToolCall.
 *
 * NOTE: this has no import of Firebase, so that it can be tested without it.
 * The model comes from getChatModel in ai.ts.
 */

/** The part of the model of the AI that a turn needs, which a test can fake */
export type ChatModel = Pick<GenerativeModel, "generateContentStream">;

/**
 * How many times in a turn the AI may call tools and get their results. The
 * AI goes on after a round of calls, to answer in text or to correct a call
 * that was refused, and could go on without end.
 */
export const MAX_TOOL_ROUNDS = 4;

/**
 * How many of the latest messages of a chat the AI is given. More are kept
 * for the user, see MAX_CHAT_MESSAGES.
 */
export const MAX_HISTORY_MESSAGES = 20;

/**
 * Returns the system instruction of a chat: the prompt of the chat, the
 * prompt that trees are generated with, and what is kept of how the tree of
 * this chat was generated.
 *
 * NOTE: what goes where. This holds what is the same for every message of a
 * chat, with the long case description last, because a start that repeats is
 * cheaper for the AI to read again, and because instructions are followed
 * best when they are apart from material. The tree changes between turns, so
 * it goes with each message, see getMessageText.
 *
 * NOTE: the prompt of the generation is included whole, so that the chat and
 * the generation follow one method, such as which side values are for, and
 * what a quote and a reason are.
 */
export function buildChatSystemInstruction(
  chatPrompt: string,
  treePrompt: string,
  chat: Pick<Chat, "issues" | "source"> | undefined,
): string {
  const parts = [
    chatPrompt.trim(),
    `# How the tree was built\n\nThese are the instructions that a tree is generated with. They are given to you as the method to follow, not as a task: do not generate a tree.\n\n<method>\n${treePrompt.trim()}\n</method>`,
  ];
  if (chat?.issues?.length) {
    parts.push(
      `# The issues listed when the tree was generated\n\n<issues>\n${chat.issues.map((issue, index) => `${index + 1}. ${issue}`).join("\n")}\n</issues>`,
    );
  }
  parts.push(
    chat?.source
      ? `# The case description\n\n<case_description>\n${chat.source.text.trim()}\n</case_description>`
      : "# The case description\n\nThere is no case description for this tree. Give no `quote`.",
  );
  return parts.join("\n\n");
}

function getRowName(row: AIRow | undefined): string {
  return `"${row?.question || row?.label || "Start"}"`;
}

/**
 * Returns what the user has selected on the canvas, in words for the AI, with
 * the other places of the tree where the same issue is decided.
 */
function getSelectionText(
  tree: DecisionTree,
  rows: AIRow[],
  aliases: AIRowAliases,
): string {
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  const getRow = (nodeId: string) => byId[aliases[nodeId] ?? ""];
  const describeIssue = (issue: AIRow | undefined) => {
    const others = rows.filter(
      (row) =>
        issue?.question && row.question === issue.question && row !== issue,
    );
    return others.length
      ? ` The same issue is also decided at ${others.map((row) => `row ${row.id}`).join(", ")}.`
      : "";
  };
  const getPath = (row: AIRow): string => {
    const labels: string[] = [];
    for (
      let at: AIRow | undefined = row;
      at?.parentId;
      at = byId[at.parentId]
    ) {
      labels.unshift(at.label ?? "");
    }
    return labels.length ? ` It is reached by: ${labels.join(" › ")}.` : "";
  };
  return [
    ...Object.values(tree.edges)
      .filter((edge) => edge.selected && edge.type !== "arrow")
      .flatMap((edge) => getRow(edge.target) ?? [])
      .map((row) => {
        const parent = byId[row.parentId ?? ""];
        return `The branch "${row.label}" (row ${row.id}) of ${getRowName(parent)} (row ${row.parentId}).${getPath(row)}${describeIssue(parent)}`;
      }),
    ...Object.values(tree.nodes)
      .filter((node) => node.selected)
      .flatMap((node) => getRow(node.id) ?? [])
      .map(
        (row) =>
          `The node ${getRowName(row)} (row ${row.id}).${getPath(row)}${describeIssue(row)}`,
      ),
  ].join("\n");
}

const EDIT_STATUS_TEXT: Record<ChatEdit["status"], string> = {
  done: "Made",
  waiting: "Waiting for the user to accept or reject",
  accepted: "Accepted by the user, and made",
  rejected: "Rejected by the user, and not made",
  failed: "Accepted by the user, but it no longer fit the tree, and not made",
};

/** Returns what became of the edits of a reply, in words for the AI */
function getEditsText(edits: ChatEdit[] | undefined): string {
  return (edits ?? [])
    .map((edit) => `- ${EDIT_STATUS_TEXT[edit.status]}: ${edit.sentence}`)
    .join("\n");
}

function tag(name: string, text: string): string {
  return text ? `<${name}>\n${text}\n</${name}>\n\n` : "";
}

/**
 * Returns the conversation so far for the AI, ending with the message of the
 * user that it is to answer.
 *
 * NOTE: earlier turns are text that is built from our own records of them,
 * and not the messages that the AI sent, which the SDK could keep as a chat
 * session. Those hold calls of tools with signatures of the thinking of the
 * AI, which would have to be saved and sent back unchanged for as long as a
 * chat lasts. As text, a turn can also say what the user did with an edit
 * after it was made. The messages of the AI are only kept as they came for
 * the rounds of one turn, see sendChatMessage.
 *
 * NOTE: what became of the edits of a reply goes with the message of the user
 * that follows it, and not in the reply itself, because the AI could take a
 * line in its own turn as a way to write, and write such lines in place of
 * calling a tool.
 *
 * NOTE: only the latest message has the tree, because the tree changes
 * between turns, and an old copy could be taken for the tree.
 */
export function buildChatContents(
  messages: ChatMessage[],
  tree: DecisionTree,
  aliases: AIRowAliases,
): Content[] {
  const rows = convertDecisionTreeToAIRows(tree, aliases);
  const history = messages.slice(-MAX_HISTORY_MESSAGES);
  // NOTE: a conversation for the AI starts with a message of the user
  while (history[0] && history[0].role !== "user") {
    history.shift();
  }
  return history.map((message, index): Content => {
    if (message.role === "ai") {
      return {
        role: "model",
        // NOTE: a reply can be only edits, and a turn must have some text
        parts: [
          { type: "text", text: message.text || message.error || "(No text.)" },
        ],
      };
    }
    const isLatest = index === history.length - 1;
    const context =
      tag("earlier_edits", getEditsText(history[index - 1]?.edits)) +
      (isLatest
        ? // NOTE: with the description of the tree, which for a generated
          // tree is a summary of the case, and for others may be all that
          // says what the case is. Without it, the AI made up facts to argue
          // from, like "sweep logs" for a slip and fall.
          tag(
            "tree_description",
            `${tree.name}\n\n${tree.description ?? ""}`.trim(),
          ) +
          tag("tree", JSON.stringify(rows)) +
          tag("selection", getSelectionText(tree, rows, aliases))
        : "");
    return {
      role: "user",
      parts: [{ type: "text", text: context + message.text }],
    };
  });
}

/** Returns the expected value of a tree as the app shows it, or "" */
function getExpectedValueText(tree: DecisionTree): string {
  const rootId = getRootNodeIds(tree.nodes, tree.edges)[0];
  const value = computeNetExpectedValues(tree).nodeValues?.[rootId ?? ""];
  return typeof value === "number" && Number.isFinite(value)
    ? formatValue(value, tree.currency ?? "", tree.rounding ?? "")
    : "";
}

function getCurrentTree(treeId: string): DecisionTree | undefined {
  const { trees, currentTreeId } = useTreeStore.getState();
  // NOTE: the tools edit the current tree, so a chat can only run on it
  return currentTreeId === treeId ? trees[treeId] : undefined;
}

/**
 * Returns the tree and what a tool needs to work on it, with short ids for
 * any nodes that are new since the last time.
 */
function getToolContext(treeId: string): ChatToolContext | undefined {
  const tree = getCurrentTree(treeId);
  if (!tree) {
    return undefined;
  }
  const chat = useChatStore.getState().chats[treeId];
  const aliases = getAIRowAliases(tree, chat?.aliases);
  if (Object.keys(aliases).length !== Object.keys(chat?.aliases ?? {}).length) {
    useChatStore.getState().setAliases(treeId, aliases);
  }
  return { tree, aliases, sourceText: chat?.source?.text };
}

/**
 * Makes the edit of a call of a tool, and returns what came of it: the
 * expected value before and after, or why it could not be made.
 */
function applyEdit(
  treeId: string,
  edit: Pick<ChatEdit, "call">,
): { error?: string; note?: string } {
  const context = getToolContext(treeId);
  if (!context) {
    return { error: "The tree is not open." };
  }
  const before = getExpectedValueText(context.tree);
  const result = applyChatToolCall(useTreeStore.getState(), context, edit.call);
  if (result.error !== undefined) {
    return { error: result.error };
  }
  const after = getExpectedValueText(getCurrentTree(treeId)!);
  // NOTE: new nodes get their short ids now, for the next call of this turn
  getToolContext(treeId);
  return {
    note:
      before && after && before !== after
        ? `Expected value ${before} → ${after}`
        : undefined,
  };
}

/**
 * Runs a call of a tool by the AI: makes the edit, or holds it for the user.
 * Returns the edit for the chat, if the call was sound, and what to tell the
 * AI.
 */
function runToolCall(
  treeId: string,
  call: FunctionCall,
): { edit?: ChatEdit; response: Record<string, string> } {
  const context = getToolContext(treeId);
  if (!context) {
    return { response: { error: "The tree is not open." } };
  }
  const toolCall = { name: call.name, args: call.args };
  const check = checkChatToolCall(context, toolCall);
  if (check.error !== undefined) {
    // NOTE: the AI is told what is wrong, and can call again in this turn
    return { response: { error: check.error } };
  }
  const edit: ChatEdit = {
    id: nanoid(12),
    call: toolCall,
    sentence: check.sentence,
    status: "waiting",
    target: check.target,
  };
  if (check.askFirst) {
    return {
      edit,
      response: {
        result:
          "Shown to the user, who can accept or reject it. Not made yet. Do not call again for the same change.",
      },
    };
  }
  const { error, note } = applyEdit(treeId, edit);
  if (error !== undefined) {
    return { response: { error } };
  }
  return {
    edit: { ...edit, status: "done", note },
    response: { result: ["Made.", note].filter(Boolean).join(" ") },
  };
}

/** What the chat says of a tree before the user has asked anything */
export interface ChatIntro {
  /** The number of nodes of the tree */
  nodes: number;
  /** The reasons with a quote that is in the case description */
  quoted: number;
  /** The reasons that the AI supplied, without a quote */
  suggested: number;
  /** The reasons with a quote that is not in the case description */
  notFound: number;
  /**
   * Whether the amounts stand in for an amount that the case description
   * does not give: 1 for the full claim and fractions of it, see prompt.md
   */
  hasPlaceholderAmounts: boolean;
}

/**
 * Returns what the chat says of a tree before the user has asked anything:
 * how many of its reasons came from the case description and how many from
 * the AI, by their footnotes, see getReasonWithSource.
 *
 * NOTE: this is worked out by the app, and not asked of the AI, so that it
 * costs nothing, is right, and sends nothing before the user sends a message.
 */
export function getChatIntro(tree: DecisionTree): ChatIntro {
  const sources = Object.values(tree.edges).map(
    (edge) => splitReasonSource(edge.data?.description).source,
  );
  const count = (source: ReasonSource) =>
    sources.filter((s) => s === source).length;
  const rows = convertDecisionTreeToAIRows(tree, getAIRowAliases(tree));
  const amounts = rows.flatMap((row) =>
    typeof row.value === "number" ? Math.abs(row.value) : [],
  );
  return {
    nodes: rows.length,
    quoted: count("description"),
    suggested: count("ai"),
    notFound: count("notFound"),
    hasPlaceholderAmounts: amounts.length > 0 && Math.max(...amounts) === 1,
  };
}

/**
 * Returns an error in words for the chat.
 *
 * NOTE: only the start of it. An error of the AI service can be the whole
 * response of the server, which is in the console.
 */
function getErrorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.length > 200 ? `${text.slice(0, 200).trim()}…` : text;
}

export interface SendChatMessageArgs {
  /** The tree that the chat is about, which must be the current tree */
  treeId: string;
  /** The words of the user */
  text: string;
  model: ChatModel;
  /** Called with the text of the reply so far, as it comes */
  onText?: (text: string) => void;
  /** Called with each edit of the reply, as it is made or held */
  onEdit?: (edit: ChatEdit) => void;
  /** Stops the turn. Edits that were made already stay. */
  signal?: AbortSignal;
}

/**
 * Sends a message of the user to the AI, and adds the reply to the chat, with
 * the edits that the AI made or asks for.
 *
 * Nothing is thrown. A turn that fails or is stopped still adds a reply, with
 * what came of it so far, because edits that were made must be on record.
 */
export async function sendChatMessage({
  treeId,
  text,
  model,
  onText,
  onEdit,
  signal,
}: SendChatMessageArgs): Promise<void> {
  const { addMessage } = useChatStore.getState();
  const context = getToolContext(treeId);
  if (!context) {
    return;
  }
  addMessage(treeId, { role: "user", text });
  const contents = buildChatContents(
    useChatStore.getState().chats[treeId]!.messages,
    context.tree,
    context.aliases,
  );

  const texts: string[] = [];
  const edits: ChatEdit[] = [];
  let error: string | undefined;
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const result = await model.generateContentStream(
        { contents },
        { signal },
      );
      let roundText = "";
      for await (const chunk of result.stream) {
        roundText += chunk.text();
        onText?.([...texts, roundText].filter(Boolean).join("\n\n"));
      }
      if (roundText.trim()) {
        texts.push(roundText.trim());
      }
      const response = await result.response;
      const calls = response.functionCalls() ?? [];
      if (calls.length === 0 || round === MAX_TOOL_ROUNDS) {
        break;
      }

      // NOTE: the reply goes back to the AI as it came, because its calls
      // carry signatures of its thinking that it wants back with the results
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        contents.push(modelContent);
      }
      const responses: Part[] = calls.map((call) => {
        const { edit, response } = runToolCall(treeId, call);
        if (edit) {
          edits.push(edit);
          onEdit?.(edit);
        }
        return {
          type: "functionResponse",
          functionResponse: { name: call.name, id: call.id, response },
        };
      });
      contents.push({ role: "user", parts: responses });
    }
  } catch (caught) {
    // NOTE: a stop by the user is not a failure
    if (!signal?.aborted) {
      console.error("[EVTree] AI chat failed", caught);
      error = getErrorText(caught);
    }
  }
  addMessage(treeId, {
    role: "ai",
    text: texts.join("\n\n"),
    ...(edits.length > 0 && { edits }),
    ...(error !== undefined && { error }),
  });
}

/**
 * Makes an edit that waited for the user, who accepted it.
 *
 * NOTE: the call is run as the AI made it, without going back to the AI, so
 * that what is made is what the user read. It is checked again against the
 * tree as it is now, see applyChatToolCall, because the user may have edited
 * the tree since. If it no longer fits, nothing changes and the chat says why.
 */
export function acceptChatEdit(treeId: string, edit: ChatEdit): void {
  const { error, note } = applyEdit(treeId, edit);
  useChatStore
    .getState()
    .updateEdit(
      treeId,
      edit.id,
      error !== undefined
        ? { status: "failed", note: error }
        : { status: "accepted", note },
    );
}

export function rejectChatEdit(treeId: string, edit: ChatEdit): void {
  useChatStore.getState().updateEdit(treeId, edit.id, { status: "rejected" });
}
