import z from "zod";

interface BranchShape {
  /**
   * User-facing label for the branch.
   */
  label: string;

  /**
   * Probability estimate of this branch occurring, between 0 and 1.
   */
  probability: number;

  /**
   * The reason for a probability estimate.
   */
  reason: string;

  /**
   * The next node following this branch in the tree.
   */
  nextNode: NodeShape;
}

export interface NodeShape {
  /**
   * The terminal value of a node in dollars. Only a terminal node that has no branches should have a value. This represents the reward or loss at the conclusion of a case.
   */
  value: number | null;

  /**
   * The expected cost in dollars of progressing to a node from the incoming branch. For example: lawyer's fees or court fees. Leave as null if unknown or negligible. This represents a sunk cost of a case.
   */
  cost: number | null;

  /**
   * Possible outcomes stemming from the node. A terminal node should have zero branches. All other nodes should have at least one branch.
   */
  branches: BranchShape[];
}

// NOTE: Define schemas lazily because circular references
const BranchSchema: z.ZodType<BranchShape> = z.lazy(() =>
  z.object({
    label: z
      .string()
      .min(1, "Label must be at least 1 character long")
      .max(100, "Label must be 100 characters or less"),
    probability: z
      .number()
      .min(0, "Probability must be between 0 and 1")
      .max(1, "Probability must be between 0 and 1"),
    reason: z.string().min(1, "Reason is required"),
    nextNode: NodeSchema,
  }),
);

export const NodeSchema: z.ZodType<NodeShape> = z.lazy(() =>
  z
    .object({
      value: z.number().nullable(),
      cost: z.number().min(0, "must be positive").nullable(),
      branches: z.array(BranchSchema),
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
        return Math.abs(sum - 1) < 0.000001; // Allow for floating point imprecision
      },
      {
        message: "Probabilities of non-empty branches must sum to 1",
        path: ["branches"],
      },
    ),
);
