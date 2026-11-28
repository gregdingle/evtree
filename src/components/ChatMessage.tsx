"use client";

import { ChatEdit, ChatMessage as Message } from "@/hooks/use-chat-store";
import { useTreeStore } from "@/hooks/use-tree-store";

const linkButton =
  "bluelink cursor-pointer font-semibold disabled:cursor-not-allowed disabled:opacity-50";

interface ChatEditLineProps {
  edit: ChatEdit;
  /** For an edit that waits for the user. Without them, it only shows. */
  onAccept?: () => void;
  onReject?: () => void;
}

/**
 * An edit to the tree by the AI, as a sentence, with what came of it. An edit
 * that the user did not ask for waits here to be accepted or rejected, see
 * ai-chat.ts.
 *
 * TODO: an Undo on the line of an edit that was made. It can only be offered
 * while the edit is still the latest change to the tree, because undo is one
 * history, and edits by hand may have come after. For now the user undoes an
 * edit of the AI like any other, from the toolbar or the keyboard.
 */
function ChatEditLine({ edit, onAccept, onReject }: ChatEditLineProps) {
  const { selectNode, selectEdge } = useTreeStore.getState();
  const { status, target } = edit;
  const isOff = status === "rejected" || status === "failed";
  return (
    <div className="my-2 rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600">
      <button
        // NOTE: selects what the edit is about on the canvas, which also
        // shows it in the side panel. A node or branch that is gone since is
        // not selected, and nothing happens.
        onClick={() => {
          if (target && "nodeId" in target) {
            selectNode(target.nodeId);
          } else if (target) {
            selectEdge(target.edgeId);
          }
        }}
        className={`cursor-pointer text-left select-text hover:underline ${isOff ? "text-gray-500 line-through" : ""}`}
      >
        {edit.sentence}
      </button>
      {edit.note && (
        <div
          className={
            status === "failed"
              ? "mt-1 text-red-700 dark:text-red-400"
              : "mt-1 text-gray-500"
          }
        >
          {edit.note}
        </div>
      )}
      <div className="mt-1 text-xs text-gray-500">
        {status === "waiting" ? (
          <span className="space-x-4 text-sm">
            <button
              onClick={onAccept}
              disabled={!onAccept}
              className={linkButton}
            >
              Accept
            </button>
            <button
              onClick={onReject}
              disabled={!onReject}
              className={linkButton}
            >
              Reject
            </button>
          </span>
        ) : status === "done" ? (
          "Done"
        ) : status === "accepted" ? (
          "Accepted"
        ) : status === "rejected" ? (
          "Rejected"
        ) : (
          "Not done"
        )}
      </div>
    </div>
  );
}

interface ChatMessageProps {
  message: Pick<Message, "role" | "text" | "edits" | "error">;
  onAccept?: (edit: ChatEdit) => void;
  onReject?: (edit: ChatEdit) => void;
  onRetry?: () => void;
}

export function ChatMessage({
  message,
  onAccept,
  onReject,
  onRetry,
}: ChatMessageProps) {
  const { role, text, edits, error } = message;
  const waiting = (edits ?? []).filter((edit) => edit.status === "waiting");
  return (
    <div
      className={
        role === "user"
          ? "ml-6 rounded-md bg-blue-500/20 px-3 py-2 wrap-anywhere"
          : "mr-2 py-1 wrap-anywhere"
      }
    >
      {/* NOTE: the text of the AI is shown as it is, as plain text with its
      line breaks, and never as markdown or HTML. A reply could be steered by
      text in a case description or in a shared tree, and a link or an image
      in it could send what the AI read to someone else. The prompt asks for
      plain text to match, see chat-prompt.md. */}
      {text && <div className="whitespace-pre-wrap select-text">{text}</div>}
      {edits?.map((edit) => (
        <ChatEditLine
          key={edit.id}
          edit={edit}
          onAccept={onAccept && (() => onAccept(edit))}
          onReject={onReject && (() => onReject(edit))}
        />
      ))}
      {/* NOTE: one suggestion of the AI is often several edits, like new
      probabilities and a new reason for each branch */}
      {onAccept && waiting.length > 1 && (
        <button
          onClick={() => waiting.forEach((edit) => onAccept(edit))}
          className={`${linkButton} text-sm`}
        >
          Accept all {waiting.length}
        </button>
      )}
      {error !== undefined && (
        <div className="text-sm text-red-700 dark:text-red-400">
          The AI did not finish its reply. {error}{" "}
          {onRetry && (
            <button onClick={onRetry} className={linkButton}>
              Retry
            </button>
          )}
        </div>
      )}
      {role === "ai" && !text && !edits?.length && error === undefined && (
        <div className="text-sm text-gray-500">Stopped.</div>
      )}
    </div>
  );
}
