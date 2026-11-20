import { omit } from "es-toolkit";
import z from "zod";

import { PROBABILITY_SUM_TOLERANCE } from "./expectedValue";

// NOTE: The AI returns a tree as a flat list of nodes, each naming its parent.
// Gemini limits how deeply a response schema can nest, to about 5 levels of a
// nested tree, and the AI merges issues to fit a tree into the depth that it
// sees. A flat list has no nesting, so no limit on the depth of the tree.
//
// A row is a node together with the branch that leads to it, which loses
// nothing because every node in a tree has exactly one incoming branch. See
// ai-convert.ts for how a row maps to an AppNode and an AppEdge.
//
// NOTE: The descriptions and the order of the fields below are sent to the AI
// as the JSON schema for structured output, see ai.ts. The reason comes before
// the probability because structured output follows the order of the schema,
// so the AI justifies before it estimates.

const AINodeSchema = z.object({
  id: z.string().min(1).describe("Short unique id of the node, such as n1."),
  parentId: z
    .string()
    .nullable()
    .describe("The id of the parent node. Null for the root node only."),
  label: z
    .string()
    .min(1, "Label must be at least 1 character long")
    .max(100, "Label must be 100 characters or less")
    .nullable()
    .describe(
      "User-facing label for the branch from the parent to this node. Null for the root node only.",
    ),
  reason: z
    .string()
    .min(1, "Reason is required")
    .nullable()
    .describe(
      "The reason for the probability estimate of the branch from the parent to this node. Null for the root node only.",
    ),
  probability: z
    .number()
    .min(0, "Probability must be between 0 and 1")
    .max(1, "Probability must be between 0 and 1")
    .nullable()
    .describe(
      "Probability estimate of the branch from the parent to this node occurring, between 0 and 1. Null for the root node only.",
    ),
  value: z
    .number()
    .nullable()
    .describe(
      "The terminal value of a node in dollars. Only a terminal node that has no child nodes should have a value. This represents the reward or loss at the conclusion of a case.",
    ),
  cost: z
    .number()
    .min(0, "must be positive")
    .nullable()
    .describe(
      "The expected cost in dollars that is incurred once this node is reached, whatever happens after it. For example: lawyer's fees or court fees. The root node can have a cost, for a cost that is incurred on every path. Leave as null if unknown or negligible. Do not include money already spent on the case.",
    ),
});

export type AINode = z.infer<typeof AINodeSchema>;

export const AITreeSchema = z
  .object({
    nodes: z
      .array(AINodeSchema)
      .describe(
        "All the nodes of the tree, as a flat list. List each node after its parent.",
      ),
  })
  // NOTE: each message names the node, so that it could be sent back to the AI
  .superRefine(({ nodes }, ctx) => {
    const addIssue = (message: string) =>
      ctx.addIssue({ code: "custom", message, path: ["nodes"] });

    const ids = new Set<string>();
    nodes.forEach((node) => {
      if (ids.has(node.id)) {
        addIssue(`Node id ${node.id} is used more than once`);
      }
      ids.add(node.id);
    });

    const roots = nodes.filter((node) => node.parentId === null);
    if (roots.length !== 1) {
      addIssue(
        `The tree must have exactly one root node, found ${roots.length}`,
      );
    }

    const children: Record<string, AINode[]> = {};
    nodes.forEach((node) => {
      if (node.parentId === null) {
        return;
      }
      if (!ids.has(node.parentId)) {
        addIssue(`Node ${node.id} has an unknown parent ${node.parentId}`);
      }
      (children[node.parentId] ??= []).push(node);

      if (
        node.label === null ||
        node.reason === null ||
        node.probability === null
      ) {
        addIssue(`Node ${node.id} must have a label, reason and probability`);
      }
    });

    // NOTE: the checks below need a well-formed tree to walk
    if (ctx.issues.length > 0) {
      return;
    }

    // NOTE: with one root and one parent each, a node that can't be reached
    // from the root is in a cycle
    const reached = new Set<string>();
    const visit = (node: AINode) => {
      reached.add(node.id);
      children[node.id]?.forEach(visit);
    };
    visit(roots[0]!);
    nodes.forEach((node) => {
      if (!reached.has(node.id)) {
        addIssue(`Node ${node.id} is not connected to the root node`);
      }
    });

    nodes.forEach((node) => {
      const childNodes = children[node.id];
      if (!childNodes) {
        if (node.value === null) {
          addIssue(`Terminal node ${node.id} must have a value`);
        }
        return;
      }
      const sum = childNodes.reduce(
        (acc, child) => acc + child.probability!,
        0,
      );
      // NOTE: allow for floating point imprecision
      if (Math.abs(sum - 1) >= PROBABILITY_SUM_TOLERANCE) {
        addIssue(
          `Probabilities of the branches from node ${node.id} must sum to 1`,
        );
      }
    });
  });

export type AITree = z.infer<typeof AITreeSchema>;

/**
 * JSON Schema for structured output of the AI, generated from AITreeSchema.
 *
 * NOTE: unsupported keywords like minLength are ignored by the model. The
 * rules across nodes, like probabilities summing to 1, can't be expressed, so
 * the output is still checked with AITreeSchema.parse. "$schema" is omitted
 * because it isn't part of the schema Gemini uses.
 */
export const aiTreeJsonSchema = omit(z.toJSONSchema(AITreeSchema), ["$schema"]);
