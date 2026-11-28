import { omit, round } from "es-toolkit";
import z from "zod";

import type { TreeStoreState } from "@/hooks/use-tree-store";
import { formatValue } from "@/utils/format";

import {
  AIRow,
  AIRowAliases,
  convertDecisionTreeToAIRows,
  getReasonWithSource,
} from "./ai-convert";
import { PROBABILITY_SUM_TOLERANCE } from "./expectedValue";
import { collectSubtreeNodeIds, getNodeToIncomingEdgeMap } from "./maps";
import { DecisionTree } from "./tree";
import { addChildNodeHelper, deleteSubTreeHelper } from "./tree-edits";

/**
 * The tools of the chat with AI: the edits to a tree that the AI can make.
 *
 * A tool makes its edit as one update of the tree store, on a draft of the
 * tree, and so as one undo step, see editCurrentTree. Where an edit is more
 * than setting fields, like adding a branch or deleting a subtree, it is made
 * by the same function as the operation of the tree store that the app calls
 * when a user does it by hand, see tree-edits.ts.
 *
 * Whatever the app can do to a tree, the AI may be given, and the other way
 * around: the two are best kept in step, so that a user can do by hand what
 * the chat does, and correct it. That is guidance, not a rule. Each tool
 * names the operations that a user makes the same edit with, and is added
 * when a use case calls for it. To add one, add an entry to `chatTools`, and
 * a test that undo takes its edit back exactly, see chat-tools.test.ts.
 *
 * The tools so far, and the use cases that they are for:
 *
 * | Tool              | Use case                                              | By hand                                           |
 * | ----------------- | ----------------------------------------------------- | ------------------------------------------------- |
 * | set_probabilities | Argue the other side, correct with a fact that the    | updateEdgeData                                    |
 * |                   | user knows, make an issue the same on every path      |                                                   |
 * | set_branch_text   | Reread the case description for an issue, review the  | updateEdgeData                                    |
 * |                   | points that the AI supplied                           |                                                   |
 * | set_node_fields   | Fill in an amount that was unknown                    | updateNodeData                                    |
 * | add_branch        | Add an outcome that is missing, like a partial award  | createNodeAtFrom, updateNodeData, updateEdgeData, |
 * |                   |                                                       | arrangeSubtree                                    |
 * | delete_branch     | Take back or correct an outcome                       | deleteSubTree, updateEdgeData                     |
 *
 * Operations of the tree store that have no tool yet, and what would justify
 * one:
 *
 * | Operation                        | Use case                                                  |
 * | -------------------------------- | --------------------------------------------------------- |
 * | insertNodeBefore                 | Add what influences an issue, or split an issue in parts  |
 * | copy, paste with replaceNodeId   | Repeat an issue under each branch of a new node           |
 * | convertNode                      | Make a choice of a party a decision node                  |
 * | replaceVariables                 | Name an unknown amount as a variable for the user to fill |
 * | updateTreeData                   | Correct the currency, rounding or description of a tree   |
 * | balanceEdgeProbability, arrange  | Tidy up after other edits                                 |
 * | createTree, loadTree,            | Generate a tree, or a variant of one, from the chat       |
 * | duplicateTree                    |                                                           |
 * | deleteTree, reset                | None foreseen. Whether undo should cross trees is an open |
 * |                                  | QUESTION of the tree store, so not before that is settled |
 *
 * TODO: tools that restructure a tree, over insertNodeBefore and copy and
 * paste: split an issue into its elements, add a node for what influences an
 * issue with the issue repeated under each of its branches, and make one
 * change to every occurrence of an issue. A change like that may take more
 * than a sentence to show, see `describe`, perhaps a SubTreeView.
 *
 * TODO: tools that search, which need grounding with Google Search or a
 * source of case law, in this order of how checkable they are: check the
 * authorities that the case description cites, look up the legal test of an
 * issue, look up amounts set by statute like caps and interest, and find
 * precedents. A citation must be checked to exist, and a quote of an opinion
 * checked against its text with isQuoteInText. Search with the legal issue
 * and the jurisdiction, not with the parties or the facts, because the case
 * may be confidential. A request with googleSearch next to function
 * declarations was accepted by gemini-3.8-flash, but whether it then searches
 * was not checked.
 *
 * TODO: a tool that needs no AI to answer: which probabilities move the
 * expected value the most, worked out by the app, so that the AI can say
 * where more thought pays.
 */

/** What a tool works on */
export interface ChatToolContext {
  tree: DecisionTree;
  /** The short id of each node, which is how the AI names nodes */
  aliases: AIRowAliases;
  /** The case description, for checking a quote of the AI against */
  sourceText?: string;
}

/** The operations of the tree store that making an edit of a tool takes */
export type ChatToolStore = Pick<
  TreeStoreState,
  "editCurrentTree" | "arrangeSubtree"
>;

/** What a line about an edit selects on the canvas when it is clicked */
export type ChatToolTarget = { nodeId: string } | { edgeId: string } | null;

interface ChatToolDefinition<Schema extends z.ZodObject> {
  name: string;
  /** What the AI is told about the tool */
  description: string;
  /** The use case that justifies giving the tool to the AI */
  useCase: string;
  /** The operations of the tree store that a user makes the same edit with */
  operations: (keyof TreeStoreState)[];
  /**
   * For a tool that must wait for the user to accept, whatever the AI says.
   *
   * NOTE: for a tool that removes things. Text in a case description or in a
   * shared tree could talk the AI into an edit that the user did not ask for.
   * Any edit can be undone, but a deleted subtree is the one that would be
   * missed least soon.
   */
  alwaysAsk?: boolean;
  args: Schema;
  /** Returns what is wrong with a call, for the AI to correct, or null */
  validate: (lookup: Lookup, args: z.infer<Schema>) => string | null;
  /**
   * Returns the edit as a sentence, which is all that the chat shows of it.
   *
   * NOTE: a sentence and not a card with a diff. Code editors show a diff
   * because code is long. An edit to a tree is a few numbers or a line of
   * text, and the canvas and the side panel show the result next to the chat.
   */
  describe: (lookup: Lookup, args: z.infer<Schema>) => string;
  target: (lookup: Lookup, args: z.infer<Schema>) => ChatToolTarget;
  /**
   * Makes the edit, on a draft of the tree.
   *
   * NOTE: `lookup` is of the tree from before the edit, for what the edit
   * was checked against. Change only the draft.
   */
  apply: (tree: DecisionTree, lookup: Lookup, args: z.infer<Schema>) => void;
  /**
   * Returns the node whose subtree to arrange after the edit, for an edit
   * that adds a node.
   *
   * NOTE: the arrange is an update of its own, and a second undo step, as it
   * is for the app's own Add Branch. It has to come after the new node is on
   * the canvas and measured, see the HACK in handleAddBranch in
   * ContextMenu.tsx and the TODO in layout.ts.
   */
  arrange?: (lookup: Lookup, args: z.infer<Schema>) => string;
}

/**
 * Whether to wait for the user to accept an edit, which every tool takes.
 *
 * NOTE: the AI says whether the user asked for the edit, because only the AI
 * read the request. See ai-chat.ts for what is done with it.
 */
const askFirstSchema = z
  .boolean()
  .describe(
    "False when the user asked for this change. True when the user asked for something else and you think that this change follows.",
  );

const idSchema = z.string().describe("The id of a row of the tree.");

const probabilitySchema = z.number().min(0).max(1);

const branchesSchema = (which: string) =>
  z
    .array(z.object({ id: idSchema, probability: probabilitySchema }))
    .describe(
      `The new probability of ${which}, each named by the id of the row that the branch leads to. Together they must sum to 1.`,
    );

// NOTE: optional and not nullable, where a quote of a generated tree is
// nullable, see AINodeSchema. The AI refuses the declaration of a tool with
// a parameter that can be null, which zod writes as a list of types.
const quoteSchema = z
  .string()
  .optional()
  .describe(
    "The few words of the case description that the reason rests on, copied exactly. Leave out when the point of the reason is not in the case description.",
  );

/** A tree with what tools look up in it */
class Lookup {
  readonly rows: Record<string, AIRow>;
  private readonly nodeIds: Record<string, string>;
  private readonly incomingEdgeIds: Record<string, string>;

  constructor(readonly context: ChatToolContext) {
    const { tree, aliases } = context;
    this.nodeIds = Object.fromEntries(
      Object.entries(aliases).map(([nodeId, alias]) => [alias, nodeId]),
    );
    this.rows = Object.fromEntries(
      convertDecisionTreeToAIRows(tree, aliases).map((row) => [row.id, row]),
    );
    this.incomingEdgeIds = getNodeToIncomingEdgeMap(tree.edges);
  }

  /** The id of the node of a row, if the row is in the tree */
  nodeId(id: string): string | undefined {
    return this.rows[id] && this.nodeIds[id];
  }

  /** The id of the branch that leads to the node of a row */
  edgeId(id: string): string | undefined {
    return this.incomingEdgeIds[this.nodeId(id) ?? ""];
  }

  /** The rows of the branches of a node, from top to bottom */
  children(id: string): AIRow[] {
    return Object.values(this.rows).filter((row) => row.parentId === id);
  }

  /** The number of nodes under a node */
  countUnder(id: string): number {
    return collectSubtreeNodeIds(this.context.tree, this.nodeId(id)!).size - 1;
  }

  /** How a row is named to the user: by its question, or else its label */
  name(id: string): string {
    const row = this.rows[id];
    return `"${row?.question || row?.label || "Start"}"`;
  }

  money(amount: number | string | null): string {
    const { currency = "", rounding = "" } = this.context.tree;
    return typeof amount === "number"
      ? formatValue(amount, currency, rounding)
      : (amount ?? "none");
  }
}

function formatPercent(probability: number | string | null): string {
  return typeof probability === "number"
    ? `${round(probability * 100, 1)}%`
    : (probability ?? "none");
}

function missing(id: string): string {
  return `There is no row ${id} in the tree.`;
}

/**
 * Returns what is wrong with new probabilities for the branches of a node,
 * which have to be given for all of them, or null.
 *
 * @param without - A branch that is being deleted, so not among them
 * @param extra - The probability of a branch that is being added
 */
function validateBranches(
  lookup: Lookup,
  parentId: string,
  branches: { id: string; probability: number }[],
  { without, extra = 0 }: { without?: string; extra?: number } = {},
): string | null {
  const rows = lookup.children(parentId).filter((row) => row.id !== without);
  const ids = branches.map((branch) => branch.id);
  const unknown = ids.find((id) => !rows.some((row) => row.id === id));
  if (unknown) {
    return `Row ${unknown} is not a branch of ${parentId} that can get a probability here.`;
  }
  const left = rows.find((row) => !ids.includes(row.id));
  if (left || new Set(ids).size !== ids.length) {
    return `Give one probability for each of the branches: ${rows.map((row) => row.id).join(", ")}.`;
  }
  // NOTE: a variable is the user's way to hold a number in one place, so a
  // plain number must not take its place without the user knowing
  const expression = rows.find((row) => typeof row.probability === "string");
  if (expression) {
    return `The probability of ${expression.id} is the expression "${expression.probability}", which uses a variable of the user. It cannot be changed here. Tell the user.`;
  }
  const sum = extra + branches.reduce((acc, b) => acc + b.probability, 0);
  if (Math.abs(sum - 1) >= PROBABILITY_SUM_TOLERANCE) {
    return `The probabilities sum to ${round(sum, 6)}, and must sum to 1.`;
  }
  return null;
}

/** Returns the probabilities that change, like "No 35% → 45%, Yes 65% → 55%" */
function describeBranches(
  lookup: Lookup,
  branches: { id: string; probability: number }[],
): string {
  return branches
    .filter(
      ({ id, probability }) => lookup.rows[id]?.probability !== probability,
    )
    .map(
      ({ id, probability }) =>
        `${lookup.rows[id]?.label || id} ${formatPercent(lookup.rows[id]?.probability ?? null)} → ${formatPercent(probability)}`,
    )
    .join(", ");
}

function applyBranches(
  tree: DecisionTree,
  lookup: Lookup,
  branches: { id: string; probability: number }[],
) {
  branches.forEach(({ id, probability }) => {
    const edge = tree.edges[lookup.edgeId(id) ?? ""];
    // NOTE: not for a probability that stays the same, which may be written
    // another way, like "2/3"
    if (edge && lookup.rows[id]?.probability !== probability) {
      edge.data = { ...edge.data, probabilityExpr: String(probability) };
    }
  });
}

function truncate(text: string, length = 140): string {
  return text.length > length ? `${text.slice(0, length - 1).trim()}…` : text;
}

/**
 * NOTE: a function for each tool, so that the arguments of each have their
 * own type inside of it, and none outside
 */
function defineTool<Schema extends z.ZodObject>(
  definition: ChatToolDefinition<Schema>,
) {
  return definition as unknown as ChatToolDefinition<z.ZodObject>;
}

export const chatTools = [
  defineTool({
    name: "set_probabilities",
    description:
      "Sets the probabilities of all the branches of a node together. When the reason of a branch no longer fits its probability, also call set_branch_text.",
    useCase:
      "Argue the other side, correct with a fact that the user knows, make an issue the same on every path",
    operations: ["updateEdgeData"],
    args: z.object({
      nodeId: idSchema.describe(
        "The id of the row of the node whose branches get new probabilities.",
      ),
      branches: branchesSchema("every branch of the node"),
      askFirst: askFirstSchema,
    }),
    validate: (lookup, { nodeId, branches }) =>
      !lookup.nodeId(nodeId)
        ? missing(nodeId)
        : lookup.children(nodeId).length === 0
          ? `Row ${nodeId} has no branches.`
          : validateBranches(lookup, nodeId, branches),
    describe: (lookup, { nodeId, branches }) =>
      `Probabilities of ${lookup.name(nodeId)}: ${describeBranches(lookup, branches) || "no change"}.`,
    target: (lookup, { nodeId }) => ({ nodeId: lookup.nodeId(nodeId)! }),
    apply: (tree, lookup, { branches }) =>
      applyBranches(tree, lookup, branches),
  }),

  defineTool({
    name: "set_branch_text",
    description:
      "Sets the label or the reason of the branch that leads to a row. Leave out what stays the same.",
    useCase:
      "Reread the case description for an issue, review the points that the AI supplied",
    operations: ["updateEdgeData"],
    args: z.object({
      id: idSchema,
      label: z.string().min(1).max(100).optional(),
      quote: quoteSchema,
      reason: z.string().min(1).optional(),
      askFirst: askFirstSchema,
    }),
    validate: (lookup, { id, label, reason, quote }) =>
      !lookup.nodeId(id)
        ? missing(id)
        : !lookup.edgeId(id)
          ? `Row ${id} is the root, which has no branch leading to it.`
          : label === undefined && reason === undefined
            ? "Give a label or a reason."
            : quote && reason === undefined
              ? "Give the reason that the quote is for."
              : null,
    describe: (lookup, { id, label, reason }) => {
      const row = lookup.rows[id]!;
      return [
        label !== undefined && `Label "${row.label}" → "${label}".`,
        reason !== undefined &&
          `Reason for "${label ?? row.label}": ${truncate(reason)}`,
      ]
        .filter(Boolean)
        .join(" ");
    },
    target: (lookup, { id }) => ({ edgeId: lookup.edgeId(id)! }),
    apply: (tree, lookup, { id, label, reason, quote }) => {
      const edge = tree.edges[lookup.edgeId(id)!]!;
      edge.data = {
        ...edge.data,
        ...(label !== undefined && { label }),
        ...(reason !== undefined && {
          // NOTE: with the same footnote on where its point comes from as a
          // reason of a generated tree
          description: getReasonWithSource(
            reason,
            quote,
            lookup.context.sourceText,
          ),
        }),
      };
    },
  }),

  defineTool({
    name: "set_node_fields",
    description:
      "Sets the question of a node that has branches, the value of a terminal node, or the cost of a node. Leave out what stays the same.",
    useCase: "Fill in an amount that was unknown",
    operations: ["updateNodeData"],
    args: z.object({
      id: idSchema,
      question: z.string().min(1).optional(),
      value: z.number().optional(),
      cost: z.number().min(0).optional(),
      askFirst: askFirstSchema,
    }),
    validate: (lookup, { id, question, value, cost }) => {
      const row = lookup.rows[id];
      if (!row || !lookup.nodeId(id)) {
        return missing(id);
      }
      if ([question, value, cost].every((field) => field === undefined)) {
        return "Give a question, a value or a cost.";
      }
      const isTerminal = lookup.children(id).length === 0;
      if (question !== undefined && isTerminal) {
        return `Row ${id} is a terminal node, which has no question.`;
      }
      if (value !== undefined && !isTerminal) {
        return `Row ${id} has branches, and only a terminal node has a value.`;
      }
      const expression = (
        [
          ["value", value],
          ["cost", cost],
        ] as const
      ).find(
        ([key, amount]) => amount !== undefined && typeof row[key] === "string",
      );
      if (expression) {
        return `The ${expression[0]} of ${id} is the expression "${row[expression[0]]}", which uses a variable of the user. It cannot be changed here. Tell the user.`;
      }
      return null;
    },
    describe: (lookup, { id, question, value, cost }) => {
      const row = lookup.rows[id]!;
      const name = `"${row.label || row.question || "Start"}"`;
      return [
        question !== undefined &&
          `Question "${row.question ?? ""}" → "${question}".`,
        value !== undefined &&
          `Value of ${name}: ${lookup.money(row.value)} → ${lookup.money(value)}.`,
        cost !== undefined &&
          `Cost of ${name}: ${lookup.money(row.cost)} → ${lookup.money(cost)}.`,
      ]
        .filter(Boolean)
        .join(" ");
    },
    target: (lookup, { id }) => ({ nodeId: lookup.nodeId(id)! }),
    apply: (tree, lookup, { id, question, value, cost }) => {
      const node = tree.nodes[lookup.nodeId(id)!]!;
      node.data = {
        ...node.data,
        ...(question !== undefined && { description: question }),
        ...(value !== undefined && { valueExpr: String(value) }),
        ...(cost !== undefined && { costExpr: String(cost) }),
      };
    },
  }),

  defineTool({
    name: "add_branch",
    description:
      "Adds an outcome to a node that has branches, as a new branch that ends in a terminal node. Give new probabilities for the other branches of the node, so that all sum to 1.",
    useCase: "Add an outcome that is missing, like a partial award",
    operations: [
      "createNodeAtFrom",
      "updateNodeData",
      "updateEdgeData",
      "arrangeSubtree",
    ],
    args: z.object({
      parentId: idSchema.describe(
        "The id of the row of the node that gets the new branch.",
      ),
      label: z.string().min(1).max(100),
      quote: quoteSchema,
      reason: z.string().min(1),
      probability: probabilitySchema,
      value: z.number(),
      branches: branchesSchema("every other branch of the node"),
      askFirst: askFirstSchema,
    }),
    validate: (lookup, { parentId, probability, branches }) =>
      !lookup.nodeId(parentId)
        ? missing(parentId)
        : // NOTE: a branch on a terminal node would make it an issue with one
          // outcome, which is a restructuring, see the TODO above
          lookup.children(parentId).length === 0
          ? `Row ${parentId} is a terminal node. A branch can only be added to a node that has branches.`
          : validateBranches(lookup, parentId, branches, {
              extra: probability,
            }),
    describe: (lookup, { parentId, label, probability, value, branches }) => {
      const others = describeBranches(lookup, branches);
      return `New branch "${label}" of ${lookup.name(parentId)}, at ${formatPercent(probability)}, with a value of ${lookup.money(value)}.${others ? ` Others: ${others}.` : ""}`;
    },
    target: (lookup, { parentId }) => ({ nodeId: lookup.nodeId(parentId)! }),
    apply: (tree, lookup, args) => {
      const parentId = lookup.nodeId(args.parentId)!;
      const parent = tree.nodes[parentId]!;
      const lowest = Math.max(
        ...lookup
          .children(args.parentId)
          .map((row) => tree.nodes[lookup.nodeId(row.id)!]!.position.y),
      );
      const { node, edge } = addChildNodeHelper(
        tree,
        // NOTE: to the right of the node as the app's own Add Branch puts it,
        // see handleAddBranch in ContextMenu.tsx, and below the other
        // branches, because the arrange keeps the order from top to bottom
        { x: parent.position.x + 216, y: lowest + 1 },
        parentId,
        "terminal",
      );
      node.data = { ...node.data, valueExpr: String(args.value) };
      edge.data = {
        ...edge.data,
        label: args.label,
        probabilityExpr: String(args.probability),
        description: getReasonWithSource(
          args.reason,
          args.quote,
          lookup.context.sourceText,
        ),
      };
      applyBranches(tree, lookup, args.branches);
    },
    arrange: (lookup, { parentId }) => lookup.nodeId(parentId)!,
  }),

  defineTool({
    name: "delete_branch",
    description:
      "Deletes the branch that leads to a row, with everything under it. Give new probabilities for the branches that are left, so that they sum to 1. The user is always asked first.",
    useCase: "Take back or correct an outcome",
    operations: ["deleteSubTree", "updateEdgeData"],
    alwaysAsk: true,
    args: z.object({
      id: idSchema,
      branches: branchesSchema("every branch that is left"),
      askFirst: askFirstSchema,
    }),
    validate: (lookup, { id, branches }) => {
      const parentId = lookup.rows[id]?.parentId;
      if (!lookup.nodeId(id)) {
        return missing(id);
      }
      if (!parentId) {
        return `Row ${id} is the root, which cannot be deleted.`;
      }
      // NOTE: without its last branch, a node would be a terminal node with
      // no value, which is a restructuring, see the TODO above
      if (lookup.children(parentId).length < 2) {
        return `Row ${id} is the only branch of ${parentId}, and cannot be deleted here.`;
      }
      return validateBranches(lookup, parentId, branches, { without: id });
    },
    describe: (lookup, { id, branches }) => {
      const row = lookup.rows[id]!;
      const under = lookup.countUnder(id);
      const others = describeBranches(lookup, branches);
      return `Delete the branch "${row.label}" of ${lookup.name(row.parentId!)}${under ? `, with the ${under} ${under === 1 ? "node" : "nodes"} under it` : ""}.${others ? ` Others: ${others}.` : ""}`;
    },
    target: (lookup, { id }) => ({ edgeId: lookup.edgeId(id)! }),
    apply: (tree, lookup, { id, branches }) => {
      deleteSubTreeHelper(tree, lookup.nodeId(id)!);
      applyBranches(tree, lookup, branches);
    },
  }),
];

/**
 * The tools as function declarations for the AI.
 *
 * NOTE: the parameters are the JSON schema that zod writes, which
 * gemini-3.8-flash takes, as long as no parameter can be null, see
 * quoteSchema. "$schema" is left out as for the tree, see aiTreeJsonSchema.
 */
export const chatToolDeclarations = chatTools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parameters: omit(z.toJSONSchema(tool.args), ["$schema"]),
}));

/** A call of a tool, as the AI made it */
export interface ChatToolCall {
  name: string;
  args: unknown;
}

export type ChatToolCheck =
  | { error: string }
  | {
      error?: undefined;
      /** Whether the edit waits for the user to accept it */
      askFirst: boolean;
      /** The edit as a sentence */
      sentence: string;
      target: ChatToolTarget;
    };

function getChecked(context: ChatToolContext, call: ChatToolCall) {
  const tool = chatTools.find((tool) => tool.name === call.name);
  if (!tool) {
    return { error: `There is no tool ${call.name}.` };
  }
  // NOTE: what the AI writes is checked like any other input
  const parsed = tool.args.safeParse(call.args);
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error) };
  }
  const lookup = new Lookup(context);
  const error = tool.validate(lookup, parsed.data);
  return error ? { error } : { tool, lookup, args: parsed.data };
}

/**
 * Checks a call of a tool against a tree, without changing the tree. Returns
 * what is wrong with it, in words for the AI, or what it would do.
 */
export function checkChatToolCall(
  context: ChatToolContext,
  call: ChatToolCall,
): ChatToolCheck {
  const checked = getChecked(context, call);
  if (checked.error !== undefined) {
    return { error: checked.error };
  }
  const { tool, lookup, args } = checked;
  return {
    askFirst: tool.alwaysAsk || args["askFirst"] === true,
    sentence: tool.describe(lookup, args),
    target: tool.target(lookup, args),
  };
}

/**
 * Makes the edit of a call of a tool, as one update of the tree store, and so
 * one undo step. Returns what is wrong
 * with the call if it does not fit the tree, and then changes nothing.
 *
 * NOTE: the call is checked again here, because the tree may have changed
 * since the call was made, when the user was asked first.
 */
export function applyChatToolCall(
  store: ChatToolStore,
  context: ChatToolContext,
  call: ChatToolCall,
): ChatToolCheck {
  const checked = getChecked(context, call);
  if (checked.error !== undefined) {
    return { error: checked.error };
  }
  const { tool, lookup, args } = checked;
  const check = checkChatToolCall(context, call);
  store.editCurrentTree(
    (tree) => tool.apply(tree, lookup, args),
    `chat:${tool.name}`,
  );
  const arrangeId = tool.arrange?.(lookup, args);
  if (arrangeId) {
    store.arrangeSubtree(arrangeId);
  }
  return check;
}
