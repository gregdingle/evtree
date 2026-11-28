"use client";

import { ChatEdit, ChatMessage as Message } from "@/hooks/use-chat-store";
import { useTreeStore } from "@/hooks/use-tree-store";
import type { ChatSearch } from "@/lib/chat-search";

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
    <div className="my-2 rounded-md border border-gray-300 p-2 text-base dark:border-gray-600">
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
      <div className="mt-1 text-sm text-gray-500">
        {status === "waiting" ? (
          <span className="space-x-4 text-base">
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

const SOURCE_KIND_TEXT = {
  primary: "court or government",
  reference: "legal reference",
  other: "not citable",
} as const;

/**
 * A search of the web by the AI: the question that was sent, and the pages
 * that were found, see chat-search.ts. The answer is not shown here, because
 * the reply of the AI gives it.
 *
 * NOTE: the question is shown because it is what left for the search, so
 * that the user sees if a name or a fact of the case went with it.
 *
 * NOTE: the two things here that are not plain text, where the text of the
 * AI is, see below. Both are what the search of Google returned as data, and
 * not text that the AI wrote, so a reply that was steered cannot put a link
 * of its own here.
 * - The links to the pages, which are only shown if they are https.
 * - The searches that Google suggests, which its terms ask to be shown with
 *   an answer that came of a search. They are HTML of Google, in a frame
 *   that cannot run scripts or reach the app, and can only open a link in a
 *   new tab.
 */
function ChatSearchLine({ search }: { search: ChatSearch }) {
  const link = (source: ChatSearch["sources"][number]) => (
    <a
      href={source.uri}
      target="_blank"
      rel="noopener noreferrer"
      className="bluelink cursor-alias"
    >
      {source.domain}
    </a>
  );
  return (
    <div className="my-2 rounded-md border border-gray-300 p-2 text-base dark:border-gray-600">
      <div className="text-sm text-gray-500">
        Searched the web · {search.jurisdiction}
      </div>
      <div className="select-text">{search.question}</div>
      {search.status === "searching" ? (
        <div className="mt-1 text-sm text-gray-500">Searching…</div>
      ) : search.status !== "found" ? (
        <div className="mt-1 text-sm text-gray-500">{search.answer}</div>
      ) : (
        <>
          {/* NOTE: every source here is a page that the answer rests on.
          Which of them a reason in the tree may cite is said beside each, see
          legal-sources.ts. They are in that order already, see runChatSearch.
          Only the site is shown, because the search gives no more of a page
          than its site and a link of Google that leads on to it. */}
          <div className="mt-2 text-xs text-gray-500">Sources</div>
          <ul className="text-sm">
            {search.sources.map((source) => (
              <li key={source.id}>
                {link(source)}{" "}
                <span className="text-gray-500">
                  {SOURCE_KIND_TEXT[source.kind]}
                </span>
              </li>
            ))}
          </ul>
          {/* NOTE: under a small label, at the end of the line, because a
          click on it often meets the check of Google for robots. It is still
          shown, as Google gives it, which the terms of grounding with Google
          Search ask for with an answer that came of a search. Not hidden
          behind a click for the same reason. */}
          {search.suggestionsHtml && (
            <div className="mt-2 text-xs text-gray-500">Related searches</div>
          )}
          {search.suggestionsHtml && (
            <iframe
              title="Searches that Google suggests"
              // NOTE: with a base, so that a click on a suggestion opens the
              // search of Google in a new tab. The links of Google have no
              // target, and Google does not load inside of a frame.
              // The cursor over a suggestion says that it leads out of the
              // app, as over the links to the sources. What Google shows is
              // not changed.
              // NOTE: Google ToS requires that the content below is shown, provided by Google
              srcDoc={`<base target="_blank"><style>.container { padding: 0px 8px !important; } a { font-size: 10px; cursor: alias !important; }</style>${search.suggestionsHtml}`}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="h-12 w-full border-0 opacity-75"
            />
          )}
        </>
      )}
    </div>
  );
}

interface ChatMessageProps {
  message: Pick<Message, "role" | "text" | "edits" | "searches" | "error">;
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
  const { role, text, edits, searches, error } = message;
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
      {/* NOTE: the searches come before the text, which is in the order that
      they happened: the AI searches, and then answers from what was found */}
      {searches?.map((search) => (
        <ChatSearchLine key={search.id} search={search} />
      ))}
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
          className={`${linkButton} text-base`}
        >
          Accept all {waiting.length}
        </button>
      )}
      {error !== undefined && (
        <div className="text-base text-red-700 dark:text-red-400">
          The AI did not finish its reply. {error}{" "}
          {onRetry && (
            <button onClick={onRetry} className={linkButton}>
              Retry
            </button>
          )}
        </div>
      )}
      {role === "ai" &&
        !text &&
        !edits?.length &&
        !searches?.length &&
        error === undefined && (
          <div className="text-base text-gray-500">Stopped.</div>
        )}
    </div>
  );
}
