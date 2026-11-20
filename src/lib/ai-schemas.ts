import z from "zod";

import { PROBABILITY_SUM_TOLERANCE } from "./expectedValue";

// NOTE: The descriptions and the order of the fields below are sent to the AI
// as part of the JSON schema for structured output, see ai.ts. The reason
// comes before the probability so that the AI justifies before it estimates.

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
