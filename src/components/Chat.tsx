"use client";

import { useEffect, useRef, useState } from "react";

import { isEqual } from "es-toolkit";
import { values } from "es-toolkit/compat";
import Link from "next/link";

import {
  ChatEdit,
  MAX_SOURCE_LENGTH,
  selectChat,
  useChatStore,
} from "@/hooks/use-chat-store";
import { useTreeStore } from "@/hooks/use-tree-store";
import {
  EXTRACTABLE_FILE_TYPES,
  extractTextFromFile,
  getChatModel,
} from "@/lib/ai";
import {
  ChatIntro,
  acceptChatEdit,
  getChatIntro,
  rejectChatEdit,
  sendChatMessage,
} from "@/lib/ai-chat";
import { firebaseApp } from "@/lib/firebase";
import { selectCurrentTree } from "@/lib/selectors";

import { ChatMessage } from "./ChatMessage";

const linkButton =
  "bluelink cursor-pointer font-semibold disabled:cursor-not-allowed disabled:opacity-50";

const emptyIntro: ChatIntro = {
  nodes: 0,
  quoted: 0,
  suggested: 0,
  notFound: 0,
  hasPlaceholderAmounts: false,
};

/** What the user has selected on the canvas, to say what a message is about */
function selectSelectionName(
  state: Parameters<typeof selectCurrentTree>[0],
): string | null {
  const tree = selectCurrentTree(state);
  const edges = values(tree?.edges).filter(
    (edge) => edge.selected && edge.type !== "arrow",
  );
  const nodes = values(tree?.nodes).filter(
    (node) => node.selected && node.type !== "note" && node.type !== "ghost",
  );
  if (edges.length + nodes.length !== 1) {
    return null;
  }
  return edges[0]
    ? `Branch “${edges[0].data?.label || "no label"}”`
    : `Node “${nodes[0]!.data.description || nodes[0]!.type}”`;
}

/**
 * Returns the prompts that the chat suggests as buttons: what a user is most
 * likely to want next, from the selection and from where the reasons of the
 * tree come from.
 *
 * NOTE: the first three are the names of the ways of working in
 * chat-prompt.md, which say how the AI is to go about each.
 */
function getSuggestions(
  intro: ChatIntro,
  hasSelection: boolean,
  hasSource: boolean,
  isGenerated: boolean,
): string[] {
  return [
    hasSelection && "Argue the other side.",
    hasSelection && "Make an issue consistent.",
    !hasSelection &&
      intro.suggested > 0 &&
      "Review the points suggested by AI.",
    hasSelection &&
      hasSource &&
      "What does the case description say about this?",
    !hasSelection &&
      intro.notFound > 0 &&
      "Check the quotes that were not found in the case description.",
    !hasSelection &&
      intro.hasPlaceholderAmounts &&
      "The amounts are placeholders. Ask me for the amount of the claim, then set the values.",
    !hasSelection &&
      isGenerated &&
      "What did you leave out of the tree, and why?",
  ].filter((suggestion) => typeof suggestion === "string");
}

/**
 * The chat with AI about the current tree, see ai-chat.ts.
 *
 * TODO: let the user ask the AI to clarify before a tree is generated, such
 * as which side the tree is for, the court, and the amount of the claim, and
 * let a tree be generated from here, see CreateDialog.tsx.
 */
export function Chat() {
  const treeId = useTreeStore((state) => state.currentTreeId);
  const chat = useChatStore((state) => selectChat(state, treeId));
  // NOTE: with deep isEqual, so that the chat does not render again on every
  // change to the tree, like each frame of a drag
  const intro = useTreeStore((state) => {
    const tree = selectCurrentTree(state);
    return tree ? getChatIntro(tree) : emptyIntro;
  }, isEqual);
  const selectionName = useTreeStore(selectSelectionName);

  const [input, setInput] = useState("");
  // The reply that is coming in, which is not in the store until it is whole
  const [pending, setPending] = useState<{
    text: string;
    edits: ChatEdit[];
  } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sourceInput, setSourceInput] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const messages = chat?.messages ?? [];
  const messageCount = messages.length;
  const pendingText = pending?.text;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount, pendingText]);

  if (!treeId) {
    return null;
  }
  if (!firebaseApp) {
    return <p className="text-gray-500">The AI is not available.</p>;
  }

  const send = async (text: string) => {
    text = text.trim();
    if (!text || pending) {
      return;
    }
    setFailure(null);
    let model;
    try {
      model = getChatModel(chat);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
      return;
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setInput("");
    setPending({ text: "", edits: [] });
    try {
      await sendChatMessage({
        treeId,
        text,
        model,
        signal: abortController.signal,
        onText: (text) => setPending((p) => p && { ...p, text }),
        onEdit: (edit) =>
          setPending((p) => p && { ...p, edits: [...p.edits, edit] }),
      });
    } finally {
      setPending(null);
    }
  };

  const handleRetry = () => {
    // NOTE: the message that got no reply is taken out and sent again, so
    // that it is not in the conversation twice
    const question = messages.at(-2);
    if (question?.role === "user") {
      useChatStore.getState().deleteMessagesFrom(treeId, question.id);
      send(question.text);
    }
  };

  const handleSaveSource = (text: string, fileName?: string) => {
    text = text.trim();
    if (!text) {
      return;
    }
    if (!useChatStore.getState().setSource(treeId, { text, fileName })) {
      window.alert(
        `The case description is too long to keep. The limit is ${MAX_SOURCE_LENGTH.toLocaleString()} characters.`,
      );
      return;
    }
    setSourceInput(null);
  };

  const handleSourceFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setIsExtracting(true);
    try {
      handleSaveSource(await extractTextFromFile(file), file.name);
    } catch (error) {
      window.alert((error as Error).message);
    } finally {
      setIsExtracting(false);
    }
  };

  const hasReasons = intro.quoted + intro.suggested + intro.notFound > 0;
  const suggestions = getSuggestions(
    intro,
    selectionName !== null,
    chat?.source !== undefined,
    chat?.issues !== undefined,
  );
  const last = messages.at(-1);

  return (
    <div className="flex min-h-0 flex-1 flex-col text-sm select-none">
      <div className="mb-2 flex justify-between text-xs">
        {chat?.source ? (
          <button
            onClick={() => {
              // TODO: convert to tailwind dialog
              if (
                window.confirm(
                  "Remove the case description that is kept with this chat?",
                )
              ) {
                useChatStore.getState().setSource(treeId, undefined);
              }
            }}
            className={linkButton}
            title={`From ${chat.source.fileName ?? "pasted text"}. Kept in this browser only, apart from the tree.`}
          >
            Remove case description
          </button>
        ) : (
          <button onClick={() => setSourceInput("")} className={linkButton}>
            Add case description
          </button>
        )}
        <button
          onClick={() => useChatStore.getState().clearMessages(treeId)}
          disabled={messageCount === 0 || pending !== null}
          className={linkButton}
        >
          Clear chat
        </button>
      </div>

      {sourceInput !== null && (
        <div className="mb-2 rounded-md border border-gray-300 p-2 dark:border-gray-600">
          <textarea
            value={sourceInput}
            onInput={(event) => setSourceInput(event.currentTarget.value)}
            placeholder="Paste the case description that this tree is about"
            rows={4}
            className="w-full rounded-md border-2 p-1"
          />
          <div className="mt-1 flex items-center justify-between">
            <label className={linkButton}>
              {isExtracting ? "Reading…" : "Choose a file"}
              <input
                type="file"
                accept={EXTRACTABLE_FILE_TYPES}
                className="hidden"
                disabled={isExtracting}
                onChange={(event) => handleSourceFile(event.target.files?.[0])}
              />
            </label>
            <span className="space-x-4">
              <button
                onClick={() => setSourceInput(null)}
                className={linkButton}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveSource(sourceInput)}
                disabled={!sourceInput.trim()}
                className={linkButton}
              >
                Keep
              </button>
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Kept in this browser only, apart from the tree: it is not in an
            export or a share link.
          </p>
        </div>
      )}

      {/* Messages, which scroll */}
      <div className="-mx-1 min-h-0 flex-1 space-y-2 overflow-y-auto px-1">
        {/* NOTE: this first message is written by the app from the tree, and
        not by the AI, see getChatIntro. Nothing is sent to the AI until the
        user sends a message. */}
        <div className="text-gray-600 dark:text-gray-400">
          {hasReasons ? (
            <p>
              This tree has {intro.nodes} nodes. Of the reasons for its
              probabilities, {intro.quoted} quote the case description
              {intro.notFound > 0 &&
                `, ${intro.notFound} have a quote that was not found in it`}{" "}
              and {intro.suggested} were suggested by AI.
            </p>
          ) : (
            <p>Ask about this tree, or ask for a change to it.</p>
          )}
          <p className="mt-1">
            Select a node or a branch to talk about it. What you ask for is done
            at once, and you can undo it.
          </p>
        </div>
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            onAccept={
              pending ? undefined : (edit) => acceptChatEdit(treeId, edit)
            }
            onReject={
              pending ? undefined : (edit) => rejectChatEdit(treeId, edit)
            }
            onRetry={
              // NOTE: only for the latest reply, and not if it made edits,
              // which sending again could make twice
              index === messageCount - 1 && !message.edits && !pending
                ? handleRetry
                : undefined
            }
          />
        ))}
        {pending &&
          (pending.text || pending.edits.length > 0 ? (
            <ChatMessage message={{ role: "ai", ...pending }} />
          ) : (
            <p className="text-gray-500">Thinking…</p>
          ))}
        {failure && <p className="text-red-700 dark:text-red-400">{failure}</p>}
        <div ref={endRef} />
      </div>

      {!pending && !input && last?.error === undefined && (
        <div className="mt-2 flex flex-wrap gap-1">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => send(suggestion)}
              className="cursor-pointer rounded-md border border-gray-300 px-2 py-1 text-left text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2">
        {selectionName && (
          <div className="mb-1 truncate text-xs text-gray-500">
            About: {selectionName}
          </div>
        )}
        <div className="flex items-end space-x-2">
          <textarea
            value={input}
            onInput={(event) => setInput(event.currentTarget.value)}
            onKeyDown={(event) => {
              // NOTE: Enter sends, and Shift+Enter is a new line, as in other
              // chats. Not while composing, as with a Japanese keyboard.
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask, or ask for a change"
            rows={2}
            spellCheck={false}
            className="field-sizing-content max-h-40 min-h-14 min-w-0 flex-1 rounded-md border-2 p-1"
          />
          {pending ? (
            <button
              onClick={() => abortControllerRef.current?.abort()}
              className="rounded-md bg-gray-500 px-3 py-1 font-semibold text-white hover:bg-gray-600"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => send(input)}
              disabled={!input.trim()}
              className="rounded-md bg-blue-500 px-3 py-1 font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
            >
              Send
            </button>
          )}
        </div>
        {/* NOTE: said before the first message, because a chat sends more,
        and more often, than generating a tree does */}
        {messageCount === 0 && (
          <p className="mt-1 text-xs text-gray-500">
            A message is sent to an AI service with this tree
            {chat?.source && " and its case description"}. See{" "}
            <Link href="/data-security" className="bluelink">
              Data Security
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
