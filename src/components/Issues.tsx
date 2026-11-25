"use client";

import React, { useState } from "react";

import { useStore } from "@/hooks/use-store";
import {
  Issue,
  IssueOccurrence,
  getIssues,
  getOccurrenceNames,
} from "@/lib/issues";
import {
  selectCurrentCurrency,
  selectCurrentRounding,
  selectCurrentTerminalValueDisplay,
  selectCurrentTree,
  selectNetExpectedValues,
} from "@/lib/selectors";
import { formatProbability, formatValue } from "@/utils/format";

import { CanvasCenteredHelpMessage } from "./CanvasCenteredHelpMessage";
import { SubTreeView } from "./SubTreeView";

/**
 * Returns a function that formats an amount as the current tree is set to
 *
 * NOTE: amounts are rounded like on the canvas, so the arithmetic may not add
 * up exactly
 */
function useFormatAmount() {
  const currency = useStore(selectCurrentCurrency);
  const rounding = useStore(selectCurrentRounding);
  return (value: number | null) => formatValue(value, currency, rounding);
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface IssuesProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * A read-only view that explains the current tree issue by issue, in text and
 * arithmetic, see getIssues.
 *
 * TODO: the Description of a chance or decision node, which is the heading of
 * its issue here, could be called "Issue Name" or similar in the side panel,
 * to say what it is for
 *
 * TODO: a hotkey, and PDF or print output, which is what a lawyer would hand to
 * a client or mediator
 * TODO: show what an issue or a cost contributes to the result, by computing
 * the tree again without it
 * TODO: hand-built trees have no descriptions on their nodes or branches, so
 * their issues show labels and numbers only... prompt for them? generate them?
 */
export function Issues({ className, ...props }: IssuesProps) {
  const tree = useStore(selectCurrentTree);
  // NOTE: memoized on the tree, so it is the same object until the tree changes
  const netExpectedValues = useStore(selectNetExpectedValues);

  const roots = tree ? getIssues(tree, netExpectedValues) : [];
  if (!tree || roots.every((root) => root.issues.length === 0)) {
    return (
      <div className={className} {...props}>
        <CanvasCenteredHelpMessage text="No issues yet" />
      </div>
    );
  }

  // NOTE: like the histogram, the arithmetic needs a complete tree
  const isComplete = roots.every(
    (root) =>
      root.expectedValue !== null &&
      root.issues.every((issue) =>
        issue.occurrences.every((occurrence) => occurrence.isComplete),
      ),
  );
  if (!isComplete) {
    return (
      <div className={className} {...props}>
        <CanvasCenteredHelpMessage text="Missing probabilities or values" />
      </div>
    );
  }

  return (
    <div
      // NOTE: the issues view can be much longer than the canvas
      // NOTE: a container, so that the layout follows the width that the side
      // panels leave, not the width of the window
      className={`@container h-full overflow-y-auto ${className ?? ""}`}
      {...props}
    >
      {/* NOTE: text-lg is the size of text here that does not set its own */}
      <div id="issues-export" className="max-w-7xl pb-16 text-lg">
        <h2 className="mb-2 text-2xl font-semibold">Key Issues</h2>
        <p className="text-base text-gray-600 dark:text-gray-400">
          Nodes in the tree that have matching branches are grouped together as
          issues.
          {/* QUESTION: add some more help text like "Probabilities and values may differ; the branch structure remains the
          same within an issue."? */}
        </p>
        {
          // TODO: put some sort of summary or intro to the page here?
          roots.map((root) => (
            <div key={root.rootId} className="mb-12">
              {root.issues.map((issue, index) => (
                <IssueSection
                  key={issue.key}
                  number={index + 1}
                  issue={issue}
                />
              ))}
            </div>
          ))
        }
      </div>
    </div>
  );
}

function IssueSection({ number, issue }: { number: number; issue: Issue }) {
  const terminalValueDisplay = useStore(selectCurrentTerminalValueDisplay);
  const format = useFormatAmount();
  const { selectNode, selectEdge } = useStore.getState();

  // NOTE: an issue can occur on several paths, and the sub-tree view shows one
  // at a time. Clamped because the tree can change under an open issues view.
  const [page, setPage] = useState(0);
  const pageCount = issue.occurrences.length;
  const pageIndex = Math.min(page, pageCount - 1);
  const current = issue.occurrences[pageIndex]!;
  const occurrenceNames = getOccurrenceNames(issue.occurrences);

  // NOTE: a decision made by hand often has no reasons, so give the reason
  // that follows from the numbers, for the option taken on the path shown
  const bestOption =
    issue.isDecision && current.outcomes.every((outcome) => !outcome.reason)
      ? current.outcomes.find((outcome) => outcome.isBest)
      : undefined;

  // NOTE: the outcomes on the path shown, like the sub-tree view. One without
  // a reason would only restate its label and probability, which are in the
  // view.
  //
  // TODO: a branch without a reason is not listed, so it has no edit link, and
  // a reason cannot be added to it from here. That is every branch of a tree
  // made by hand. List every branch when any can be edited? Or put the edit
  // links in the table or the sub-tree view?
  const listedOutcomes = current.outcomes.filter((outcome) => outcome.reason);

  return (
    <section className="mt-10">
      <h3 className="mb-3 text-xl font-semibold">
        {number}. {issue.heading}
        <EditLink
          inputId="Description"
          onSelect={() => {
            // NOTE: the heading is the description of the node, or else its
            // branch labels, so this is the way to write a better one
            //
            // TODO: this edits one node, but an issue that occurs on several
            // paths has a node for each, and they are grouped by their
            // descriptions. So describing one node takes it out of the group,
            // into an issue of its own, until every other node of the issue
            // is given the same description, one edit link at a time.
            // Selecting all of the nodes was tried: the side panel shows a
            // block for each, with nothing to tell them apart, the same text
            // has to be typed in each, the issue still splits while typing,
            // and the panel does not scroll past about three blocks. Better
            // would be one description box in the side panel for nodes of the
            // same type, which writes to all of them in one undo step.
            selectNode(current.nodeId);
          }}
        />
      </h3>
      {/*
        NOTE: every sub-tree view of a tree is the same width, so the text
        beside it is the same width in every issue as well
      */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 @4xl:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          {bestOption && (
            <p className="mb-4">
              Deciding to {bestOption.label} yields a higher expected value.
            </p>
          )}
          {listedOutcomes.length > 0 && (
            <ul className="mb-4 space-y-2">
              {listedOutcomes.map((outcome) => (
                <li key={outcome.edgeId}>
                  <span className="font-medium">{outcome.label}</span>
                  {!issue.isDecision && (
                    <span>
                      : {formatProbability(outcome.probability, 0, "???", "")}
                    </span>
                  )}
                  <EditLink
                    inputId="Label"
                    onSelect={() => selectEdge(outcome.edgeId)}
                  />
                  <p
                    // NOTE: whitespace-pre-line for the footnote of a reason
                    // from AI, see getReasonWithSource in ai-convert.ts
                    className="mt-1 text-base whitespace-pre-line text-gray-700 dark:text-gray-300"
                  >
                    {outcome.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base">
              <thead>
                <tr className="border-b border-gray-400 text-gray-600 dark:text-gray-400">
                  <th className="py-1 pr-6 font-medium">After</th>
                  <th className="py-1 font-medium">Expected Value</th>
                </tr>
              </thead>
              <tbody>
                {issue.occurrences.map((occurrence, index) => (
                  <tr
                    key={occurrence.nodeId}
                    // NOTE: the row that the sub-tree view is showing
                    onClick={() => setPage(index)}
                    // NOTE: a single row is highlighted too, because it is the
                    // row that the view is showing, but there is nothing to
                    // click to
                    className={`border-b border-gray-300 align-top dark:border-gray-700 ${
                      index === pageIndex
                        ? "bg-blue-50 dark:bg-blue-950"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    } ${pageCount > 1 ? "cursor-pointer" : ""}`}
                  >
                    <td className="py-1 pr-6">
                      {occurrenceNames[index]!.join(" › ")}
                    </td>
                    <td className="py-1">
                      <Calculation
                        occurrence={occurrence}
                        terminalValueDisplay={terminalValueDisplay}
                        format={format}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* NOTE: as wide as the view, so that the pagination is centered under it */}
        <div className="w-fit max-w-full">
          {/* NOTE: the view is a fixed size, so scroll if there is no room */}
          <div className="max-w-full overflow-x-auto">
            <SubTreeView
              // NOTE: a new view for each occurrence
              key={current.nodeId}
              nodeId={current.nodeId}
              // NOTE: text-base so that the view is the same size as the canvas
              className="rounded border border-gray-300 text-base dark:border-gray-700"
            />
          </div>
          {pageCount > 1 && (
            <div className="mt-2 flex flex-wrap items-baseline justify-center gap-x-3 text-base text-gray-600 dark:text-gray-400">
              <PageButton
                disabled={pageIndex === 0}
                onClick={() => setPage(pageIndex - 1)}
              >
                prev
              </PageButton>
              <span>
                {pageIndex + 1} of {pageCount}
              </span>
              <PageButton
                disabled={pageIndex === pageCount - 1}
                onClick={() => setPage(pageIndex + 1)}
              >
                next
              </PageButton>
              {/*
                QUESTION: show the path to the occurrence here, like "After
                Litigate › Liability › No fraud"? It is in the highlighted row
                of the table already, and a long one wraps.
              */}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * A link that selects a node or a branch, so that the side panel shows its
 * properties, and puts the cursor in one of them. The issues view stays open.
 */
function EditLink({
  inputId,
  onSelect,
}: {
  inputId: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onSelect();
        // HACK: once the side panel has rendered the properties. PropertyInput
        // uses its label as its id.
        requestAnimationFrame(() =>
          window.document.getElementById(inputId)?.focus(),
        );
      }}
      // NOTE: muted, to not compete with the text that it is beside
      className="ml-3 cursor-pointer text-base font-normal text-gray-500 hover:underline dark:text-gray-400"
    >
      edit
    </button>
  );
}

function PageButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="cursor-pointer text-blue-600 hover:underline disabled:cursor-default disabled:text-gray-400 disabled:no-underline dark:text-blue-400 dark:disabled:text-gray-600"
    >
      {children}
    </button>
  );
}

/**
 * A space that a line does not break at. In a calculation, it keeps each term
 * whole, like "50% × $2M", and a sign with the term that it is for.
 */
const NBSP = "\u00a0";

/**
 * The sum that gives the expected value of an occurrence of an issue, and its
 * result, like "60% × -$8K + 40% × -$88K = -$40K".
 *
 * NOTE: the amounts follow the "Display at Terminal" setting of the tree, so
 * that they are the same as in the sub-tree view next to the calculation:
 *
 * - "net": every amount is net of the costs on the path to it, so a cost is
 *   inside of each term, like "70% × $1.2M + 30% × -$100K = $841K"
 * - "outcome": every amount is the value from that point on, and the cost of
 *   the node is a term of its own, like "70% × $1.3M + 30% × $0 − $100K =
 *   $841K". A terminal node then has its value as entered.
 *
 * See IssueOutcome.onwardValue for why both give the value of the tree.
 *
 * TODO: with "outcome", an outcome that is not a terminal node has a value
 * from that point on, like the $1.3M above, which the canvas never shows. The
 * canvas has only net values for those nodes, whatever the setting. Consider
 * showing onward values on the canvas too, or saying in the issues view that
 * they differ.
 *
 * NOTE: the same for a decision, where the best option has a probability of
 * 100% and the others have 0%
 */
function Calculation({
  occurrence,
  terminalValueDisplay,
  format,
}: {
  occurrence: IssueOccurrence;
  terminalValueDisplay: "outcome" | "net";
  format: (value: number | null) => string;
}) {
  const isNet = terminalValueDisplay === "net";
  const terms = occurrence.outcomes
    .map(
      (outcome) =>
        `${formatProbability(outcome.probability, 0, "???", "")}${NBSP}×${NBSP}${format(isNet ? outcome.value : outcome.onwardValue)}`,
    )
    .join(` +${NBSP}`);
  // NOTE: a minus sign and not a hyphen, to tell it from a negative amount
  const costTerm =
    !isNet && occurrence.cost ? ` −${NBSP}${format(occurrence.cost)}` : "";
  return (
    // NOTE: two inline blocks, so that when the whole does not fit on a line,
    // it breaks before the equals sign first, and inside the sum only if the
    // sum is too long for a line of its own
    <>
      <span className="inline-block">
        {terms}
        {costTerm}
      </span>{" "}
      <span className="inline-block font-medium whitespace-nowrap">
        {"= "}
        {format(
          isNet ? occurrence.expectedValue : occurrence.onwardExpectedValue,
        )}
      </span>
    </>
  );
}
