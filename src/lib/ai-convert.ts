import { groupBy, sumBy } from "es-toolkit";

import { AINode, AITree } from "./ai-schemas";
import { AppEdge, createEdge } from "./edge";
import { AppNode, createNode } from "./node";
import { DecisionTree, createTree } from "./tree";

// NOTE: this is apart from ai.ts so that it can be tested without Firebase

type AIChildren = Record<string, AINode[]>;

/**
 * Returns the expected size of the amounts that a node leads to, ignoring
 * their sign and any costs.
 */
function getExpectedSize(aiNode: AINode, children: AIChildren): number {
  const childNodes = children[aiNode.id];
  if (!childNodes) {
    return Math.abs(aiNode.value ?? 0);
  }
  return sumBy(
    childNodes,
    (child) => (child.probability ?? 0) * getExpectedSize(child, children),
  );
}

/**
 * Returns the place of each node among the branches of its parent, from the
 * top, with the branch that leads to the largest amounts first.
 *
 * NOTE: Why order the branches at all? The human-crafted trees that we use for
 * reference follow a convention: the case of the plaintiff runs along the top.
 * At each issue, the outcome that keeps the claim alive comes first, the
 * outcome that ends the case for the defendant comes last, and awards go from
 * high to low. That holds whichever side the tree is written for. In a tree
 * for the defendant, the top path is still the plaintiff winning, with the
 * largest payment at the top.
 *
 * The AI does not follow the convention by itself. Of three trees that it
 * generated from the descriptions of reference trees, one came out in the
 * order of its reference tree, one fully reversed, with the defense verdict
 * and the lowest award first, and one mixed.
 *
 * Ordering by size, ignoring sign, gives the convention without knowing which
 * side the tree is for: a branch that continues to an award comes before one
 * that ends at nothing, and a higher award before a lower one. All 60 chance
 * nodes of the Hapless Harvest, component supply, patent infringement and
 * product liability reference trees are in this order, and 26 of the 33 chance
 * nodes of the three generated trees were.
 *
 * Where the rule falls short:
 * - Branches of the same size stay in the order of the AI, such as two ways to
 *   the same award.
 * - A branch that ends in a loss for the party of the tree, such as its fees
 *   when it loses, counts by the size of the loss. It comes first if that is
 *   more than the other branches are expected to win.
 * - Not every human-crafted tree agrees. The age discrimination reference
 *   trees are as their source drew them, with single damages before double,
 *   the lower fees before the higher, and a ruling for the defendant before
 *   one for the plaintiff. The reference trees are not held to this order.
 *
 * The alternative is to ask for the order in step 1 of prompt.md, for example
 * "list the outcome that keeps the claim of the plaintiff alive first, and
 * awards from high to low". That states the convention itself, where the size
 * is only a stand-in for it, and it could order branches of the same size. But
 * it adds to the prompt, cannot be tested, and the AI already applies the
 * rules of the prompt about its nodes unevenly. It could be tried on top of
 * this, since the order of the AI is kept between branches of the same size.
 */
function getBranchPlaces(children: AIChildren): Record<string, number> {
  const places: Record<string, number> = {};
  Object.values(children).forEach((childNodes) => {
    const sizes = new Map(
      childNodes.map((child) => [child, getExpectedSize(child, children)]),
    );
    // NOTE: the sort is stable, so that the order of the AI is kept between
    // branches of the same size
    [...childNodes]
      .sort((a, b) => sizes.get(b)! - sizes.get(a)!)
      .forEach((child, place) => {
        places[child.id] = place;
      });
  });
  return places;
}

export const SOURCE_DESCRIPTION = "From the case description:";
export const SOURCE_NOT_FOUND =
  "Quoted by AI, but not found in the case description:";
export const SOURCE_AI = "Suggested by AI, not in the case description.";

/**
 * Returns the words of a text for finding a quote in, with a space before
 * and after each, and without the differences that do not matter: case,
 * punctuation, line breaks and other spacing.
 *
 * NOTE: the AI does not copy punctuation exactly: it changes quotation marks
 * and dashes, drops a comma, writes "[t]he" for "The", and joins a word that
 * is hyphenated at the end of a line of a PDF. So only the words are
 * compared, and a hyphen inside of a word is left out, with any line break
 * after it. The words themselves have to be the same, because one word, like
 * "not", can change what a quote says.
 */
function getQuoteWords(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[\u2010\u2011-]\s*|[[\]]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return ` ${words} `;
}

/**
 * How much text may be skipped inside of a quote, and how few words of a
 * quote count as found on their own, see findQuotePart
 */
const MAX_QUOTE_GAP = 300;
const MIN_QUOTE_WORDS = 3;
const MAX_QUOTE_PIECES = 3;

/**
 * Returns where a part of a quote ends in the text, searching on from a place,
 * or -1 if it is not there.
 *
 * NOTE: the part does not have to be in one piece. The AI quotes across what
 * a reader skips, like a page number and a header where a sentence runs on to
 * the next page of a PDF, or a footnote mark. So the part may be in a few
 * pieces that are close together, each of a few words or more, which a made-up
 * quote is unlikely to be.
 */
function findQuotePart(part: string, text: string, from: number): number {
  const words = part.split(" ");
  let wordIndex = 0;
  for (let piece = 0; wordIndex < words.length; piece++) {
    if (piece === MAX_QUOTE_PIECES) {
      return -1;
    }
    const minLength = Math.min(MIN_QUOTE_WORDS, words.length - wordIndex);
    let found = -1;
    let length = words.length - wordIndex;
    // NOTE: the longest run of words that is in the text
    for (; length >= minLength; length--) {
      // NOTE: with a space at both ends, to find whole words
      const run = ` ${words.slice(wordIndex, wordIndex + length).join(" ")} `;
      const index = text.indexOf(run, from);
      if (index !== -1 && (piece === 0 || index - from <= MAX_QUOTE_GAP)) {
        // NOTE: on from the space after the run, which the next run starts with
        found = index + run.length - 1;
        break;
      }
    }
    if (found === -1) {
      return -1;
    }
    from = found;
    wordIndex += length;
  }
  return from;
}

/**
 * Returns whether a quote is in the text that the AI was given. A quote may
 * leave out words with an ellipsis, and then every part has to be in the text.
 *
 * NOTE: the parts may be in any order. The AI joined two real passages with
 * an ellipsis the other way around from the text. An ellipsis can skip any
 * amount of text as it is, so the order of the parts added little.
 */
export function isQuoteInText(quote: string, text: string): boolean {
  const textWords = getQuoteWords(text);
  const parts = quote
    .split(/\.{3,}|\u2026/)
    .map((part) => getQuoteWords(part).trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return false;
  }
  return parts.every((part) => findQuotePart(part, textWords, 0) !== -1);
}

/**
 * Returns the reason of a branch with a footnote that says where its point
 * comes from: a quote from the description that the AI was given, or else the
 * AI itself, from general legal knowledge.
 *
 * A reason is the only place where the AI argues, so the reader needs to know
 * which arguments are from the document and which the AI supplied. That
 * matters most for a description that is written by one side, like a
 * mediation statement, which does not say what the other side will argue.
 *
 * NOTE: the AI gives the quote, and it is checked here against the text that
 * the AI was given, because an AI can also make up a quote. A label written by
 * the AI itself, like "Suggested by AI", could not be checked.
 *
 * NOTE: the footnote is part of the description of the branch, and not a
 * field of its own, so nothing else had to change: the side panel, the Issues
 * page, export and share links all show a description.
 *
 * TODO: as text, the footnote can be edited away, and the Issues page cannot
 * mark or filter the reasons that the AI supplied without matching on these
 * words. If that is wanted, keep the source of a reason as a field of the
 * branch, see AppEdge.
 */
function getReasonWithSource(
  aiNode: AINode,
  sourceText: string | undefined,
): string {
  const reason = aiNode.reason || "";
  // NOTE: without the text that the AI was given, there is nothing to check
  // a quote against
  if (!reason || sourceText === undefined) {
    return reason;
  }
  const quote = aiNode.quote?.trim().replace(/^["\u201c]+|["\u201d]+$/g, "");
  if (!quote) {
    return `${reason}\n\n${SOURCE_AI}`;
  }
  return isQuoteInText(quote, sourceText)
    ? `${reason}\n\n${SOURCE_DESCRIPTION} "${quote}"`
    : `${reason}\n\n${SOURCE_NOT_FOUND} "${quote}"`;
}

/**
 * What the AI made a tree from: the text that it was given, and the name of
 * the file that the text was extracted from, if any
 */
export interface AISource {
  text: string;
  fileName?: string;
}

/**
 * Returns the description of a tree from AI: the summary that the AI wrote
 * of the text that it was given, and a line that says what the text was.
 *
 * NOTE: the line is written here, and not by the AI, so that it is accurate.
 *
 * NOTE: the text itself is not kept with the tree, only named. The description
 * was once the first 1,000 characters of the text, which said little about a
 * long document. Keeping all of it would put a confidential document, like a
 * mediation statement, in the storage of the browser, and in every share link
 * and export of the tree.
 *
 * TODO: consider keeping the text with the tree after all, as a field of its
 * own, if the user asks for it. With the text, the quotes of the AI could be
 * checked again later, see getReasonWithSource, and the tree could be
 * generated again.
 */
export function getAITreeDescription(
  aiTree: AITree,
  source?: AISource,
  date = new Date(),
): string {
  const summary = aiTree.summary.trim();
  if (!source) {
    return summary;
  }
  const words = source.text.trim().split(/\s+/).length;
  const from = source.fileName ?? "pasted text";
  const on = date.toLocaleDateString(undefined, { dateStyle: "medium" });
  const reference = `Generated by AI on ${on} from ${from} (${words.toLocaleString()} words).`;
  return summary ? `${summary}\n\n${reference}` : reference;
}

/**
 * Converts the AI-generated flat list of nodes to DecisionTree format. Each
 * AI node becomes a node, and an edge from its parent if it has one.
 * The tree takes the currency that the AI inferred, and rounding to match.
 *
 * @param source - What the AI was given. With it, the description of the tree
 * says what it was made from, see getAITreeDescription, and every reason gets
 * a footnote, from checking its quote against the text, see
 * getReasonWithSource.
 */
export function convertAIStructureToDecisionTree(
  aiTree: AITree,
  name: string,
  source?: AISource,
): DecisionTree {
  const sourceText = source?.text;
  const description = getAITreeDescription(aiTree, source);
  const children: AIChildren = groupBy(
    aiTree.nodes.filter((aiNode) => aiNode.parentId !== null),
    (aiNode) => aiNode.parentId!,
  );
  const branchPlaces = getBranchPlaces(children);

  // NOTE: nodes get new ids, so keep a map from the ids that the AI gave them
  const nodeIds: Record<string, string> = {};
  const nodes: Record<string, AppNode> = {};
  aiTree.nodes.forEach((aiNode) => {
    // Determine node type based on whether it has child nodes
    // TODO: consider adding decision nodes to the prompt and AI schemas, for
    // choices that a party makes itself, such as filing a motion. The prompt
    // currently only asks for chance and terminal nodes.
    // TODO: we shouldn't really define decision nodes this way... either
    // exclude decision node, or else modify the prompt and AI schemas to return
    // decision nodes
    const childCount = children[aiNode.id]?.length ?? 0;
    let nodeType: "decision" | "chance" | "terminal";
    if (childCount === 0) {
      nodeType = "terminal";
    } else if (childCount === 1) {
      nodeType = "decision";
    } else {
      nodeType = "chance";
    }

    // NOTE: positions are replaced by the auto-arrange after, which keeps the
    // branches of a node in the order of their vertical positions, see
    // getLayoutedElementsD3. So the vertical position is only the place of the
    // node among the branches of its parent.
    const position = { x: 0, y: branchPlaces[aiNode.id] ?? 0 };
    const appNode = createNode(position, nodeType, false, {
      // NOTE: the description of a node is the question that it decides
      description: aiNode.question ?? "",
      // NOTE: convert to string which will be converted back to number internally
      // TODO: when the description mentions an amount but doesn't give it, have
      // the AI infer a named variable instead of guessing a number or leaving it
      // null, both for outcome values and for costs. Variables should come only
      // from mentions in the text, like "trial fees" or "lost profits": no
      // mention, no variable needed. For example "lostProfits * 0.5" or
      // "trialFees", with the variables added to the tree's variables so the
      // user can fill them in. Needs the AI schema, prompt and this
      // conversion to support expressions.
      valueExpr: aiNode.value?.toString() || undefined,
      costExpr: aiNode.cost?.toString() || undefined,
    });
    nodes[appNode.id] = appNode;
    nodeIds[aiNode.id] = appNode.id;
  });

  // NOTE: edges are created after all the nodes, so that the order of the AI
  // nodes doesn't matter
  const edges: Record<string, AppEdge> = {};
  aiTree.nodes.forEach((aiNode) => {
    if (aiNode.parentId === null) {
      return;
    }
    const edge = createEdge(
      nodeIds[aiNode.parentId]!,
      nodeIds[aiNode.id]!,
      false,
      {
        label: aiNode.label || "",
        // NOTE: convert to string which will be converted back to number internally
        probabilityExpr: aiNode.probability?.toString() || undefined,
        description: getReasonWithSource(aiNode, sourceText),
      },
    );
    edges[edge.id] = edge;
  });

  return {
    ...createTree(name, description, nodes, edges),
    currency: aiTree.currency ?? undefined,
    // NOTE: rounding is a convention of the country more than of the case, so
    // it follows from the currency: "bn" for pounds, and "B" otherwise
    rounding: aiTree.currency === "GBP" ? "UK" : "US",
  };
}
