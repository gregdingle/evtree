import { omit } from "es-toolkit";
import z from "zod";

import { PROBABILITY_SUM_TOLERANCE } from "./expectedValue";

// NOTE: The descriptions and the order of the fields below are sent to the AI
// as the JSON schema for structured output, see ai.ts

export interface BranchShape {
  label: string;
  reason: string;
  probability: number;
  nextNode: NodeShape;
}

export interface NodeShape {
  value: number | null;
  cost: number | null;
  branches: BranchShape[];
}

// NOTE: Define schemas lazily because circular references
const BranchSchema: z.ZodType<BranchShape> = z.lazy(() =>
  z.object({
    label: z
      .string()
      .min(1, "Label must be at least 1 character long")
      .max(100, "Label must be 100 characters or less")
      .describe("User-facing label for the branch."),
    // NOTE: reason comes before probability because structured output follows
    // the order of the schema, so the AI justifies before it estimates
    reason: z
      .string()
      .min(1, "Reason is required")
      .describe("The reason for the probability estimate."),
    probability: z
      .number()
      .min(0, "Probability must be between 0 and 1")
      .max(1, "Probability must be between 0 and 1")
      .describe(
        "Probability estimate of this branch occurring, between 0 and 1.",
      ),
    nextNode: NodeSchema,
  }),
);

export const NodeSchema: z.ZodType<NodeShape> = z.lazy(() =>
  z
    .object({
      value: z
        .number()
        .nullable()
        .describe(
          "The terminal value of a node in dollars. Only a terminal node that has no branches should have a value. This represents the reward or loss at the conclusion of a case.",
        ),
      cost: z
        .number()
        .min(0, "must be positive")
        .nullable()
        .describe(
          "The expected cost in dollars of progressing to a node from the incoming branch. For example: lawyer's fees or court fees. Leave as null if unknown or negligible. The cost is incurred once the node is reached, whatever happens after it. Do not include money already spent on the case.",
        ),
      branches: z
        .array(BranchSchema)
        .describe(
          "Possible outcomes stemming from the node. A terminal node should have zero branches. All other nodes should have at least one branch.",
        ),
    })
    .refine(
      (node: NodeShape): boolean => {
        return (
          (node.value !== null && node.branches.length == 0) ||
          node.branches.length > 0
        );
      },
      {
        message:
          "Terminal nodes must have a value, all other nodes must have branches",
        path: ["branches"],
      },
    )
    .refine(
      (node: NodeShape): boolean => {
        if (node.branches.length === 0) {
          return true;
        }
        const sum = node.branches.reduce(
          (acc, outcome) => acc + outcome.probability,
          0,
        );
        // NOTE: allow for floating point imprecision
        return Math.abs(sum - 1) < PROBABILITY_SUM_TOLERANCE;
      },
      {
        message: "Probabilities of non-empty branches must sum to 1",
        path: ["branches"],
      },
    ),
);

/**
 * The most levels of branches that an AI tree can have.
 *
 * NOTE: Gemini rejects a response schema of 6 levels with a 400 and accepts 5.
 * Each level of the tree nests the schema 5 levels deeper, and the limit
 * appears to be about 32 levels of nesting in the schema document. The
 * human-crafted demo trees are up to 7 levels deep, so this cap is too low.
 * TODO: a flat list of nodes with parent ids would have no depth limit
 */
export const MAX_AI_TREE_DEPTH = 5;

type JsonSchema = Record<string, unknown>;

interface NodeJsonSchema extends JsonSchema {
  properties: {
    branches: JsonSchema & {
      items: JsonSchema & { properties?: { nextNode: JsonSchema } };
    };
  };
}

/**
 * JSON Schema for structured output of the AI, generated from NodeSchema.
 *
 * NOTE: NodeSchema is recursive, which z.toJSONSchema writes as a "$ref": "#"
 * to the root. Gemini unrolls that to only two levels and closes off the last
 * one with "maxItems": 0. The AI sees that, and merges issues to fit the tree
 * into two levels. So the recursion is unrolled here instead, to the deepest
 * that Gemini accepts.
 *
 * NOTE: unsupported keywords like minLength are ignored by the model.
 * Refinements like probabilities summing to 1 can't be expressed, so the output
 * is still checked with NodeSchema.parse. "$schema" is omitted because it isn't
 * part of the schema Gemini uses.
 */
export function buildNodeJsonSchema(
  depth: number = MAX_AI_TREE_DEPTH,
): JsonSchema {
  const node = omit(z.toJSONSchema(NodeSchema), [
    "$schema",
  ]) as unknown as NodeJsonSchema;
  const { branches } = node.properties;
  if (depth === 0) {
    // NOTE: a node at the maximum depth has to be terminal. An array still
    // needs items, which Gemini may require.
    branches.items = { type: "object" };
    branches["maxItems"] = 0;
  } else {
    // NOTE: the descriptions are the same at every level, so only keep them
    // at the root
    branches.items.properties!.nextNode = JSON.parse(
      JSON.stringify(buildNodeJsonSchema(depth - 1)),
      (key, value) => (key === "description" ? undefined : value),
    );
  }
  return node;
}
