import {
  MAX_AI_TREE_DEPTH,
  NodeSchema,
  NodeShape,
  buildNodeJsonSchema,
} from "./ai-schemas";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySchema = any;

function nextNode(node: AnySchema): AnySchema {
  return node.properties.branches.items.properties?.nextNode;
}

describe("buildNodeJsonSchema", () => {
  test("should unroll the recursion with no $ref left", () => {
    expect(JSON.stringify(buildNodeJsonSchema())).not.toContain("$ref");
  });

  test("should allow branches down to the maximum depth only", () => {
    let node = buildNodeJsonSchema() as AnySchema;
    for (let depth = 0; depth < MAX_AI_TREE_DEPTH; depth++) {
      expect(node.properties.branches.maxItems).toBeUndefined();
      expect(Object.keys(node.properties)).toEqual([
        "value",
        "cost",
        "branches",
      ]);
      expect(Object.keys(node.properties.branches.items.properties)).toEqual([
        "label",
        "reason",
        "probability",
        "nextNode",
      ]);
      node = nextNode(node);
    }
    expect(node.properties.branches.maxItems).toBe(0);
    expect(node.properties.branches.items).toEqual({ type: "object" });
    expect(nextNode(node)).toBeUndefined();
  });

  test("should describe the fields at the root only", () => {
    const root = buildNodeJsonSchema() as AnySchema;
    expect(root.properties.cost.description).toMatch(/cost/);
    expect(
      root.properties.branches.items.properties.reason.description,
    ).toMatch(/reason/);
    expect(JSON.stringify(nextNode(root))).not.toContain("description");
  });
});

describe("NodeSchema", () => {
  const leaf: NodeShape = { value: 1, cost: null, branches: [] };
  const branch = (probability: number) => ({
    label: "a",
    reason: "r",
    probability,
    nextNode: leaf,
  });

  test("should accept probabilities that sum to 1", () => {
    const node = {
      value: null,
      cost: null,
      branches: [branch(0.4), branch(0.6)],
    };
    expect(NodeSchema.safeParse(node).success).toBe(true);
  });

  test("should reject probabilities that do not sum to 1", () => {
    const node = {
      value: null,
      cost: null,
      branches: [branch(0.5), branch(0.6)],
    };
    expect(NodeSchema.safeParse(node).success).toBe(false);
  });
});
