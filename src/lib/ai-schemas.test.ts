import { AINode, AITreeSchema, aiTreeJsonSchema } from "./ai-schemas";

function root(overrides: Partial<AINode> = {}): AINode {
  return {
    id: "n1",
    parentId: null,
    label: null,
    quote: null,
    reason: null,
    probability: null,
    question: "Question?",
    value: null,
    cost: null,
    ...overrides,
  };
}

function child(
  id: string,
  parentId: string,
  probability: number,
  overrides: Partial<AINode> = {},
): AINode {
  return {
    id,
    parentId,
    label: `Label ${id}`,
    quote: null,
    reason: `Reason ${id}`,
    probability,
    question: null,
    value: 100,
    cost: null,
    ...overrides,
  };
}

function getMessages(nodes: AINode[]): string[] {
  const result = AITreeSchema.safeParse({
    currency: "USD",
    summary: "Summary.",
    issues: ["Issue?"],
    nodes,
  });
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("aiTreeJsonSchema", () => {
  test("should have no references, so that nothing limits the depth", () => {
    expect(JSON.stringify(aiTreeJsonSchema)).not.toContain("$ref");
  });

  test("should put the summary before the issues before the nodes", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(Object.keys((aiTreeJsonSchema as any).properties)).toEqual([
      "currency",
      "summary",
      "issues",
      "nodes",
    ]);
  });

  test("should put the quote before the reason before the probability", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = (aiTreeJsonSchema as any).properties.nodes.items;
    expect(Object.keys(node.properties)).toEqual([
      "id",
      "parentId",
      "label",
      "quote",
      "reason",
      "probability",
      "question",
      "value",
      "cost",
    ]);
    expect(node.required).toEqual(Object.keys(node.properties));
    expect(node.properties.cost.description).toMatch(/root node can have/);
  });
});

describe("AITreeSchema", () => {
  test("should accept a known currency or none", () => {
    const parse = (currency: unknown) =>
      AITreeSchema.safeParse({
        currency,
        summary: "Summary.",
        issues: [],
        nodes: [root({ value: 1 })],
      }).success;
    expect(parse("EUR")).toBe(true);
    expect(parse(null)).toBe(true);
    expect(parse("")).toBe(false);
    expect(parse("XYZ")).toBe(false);
  });

  test("should accept a tree deeper than a nested schema allows", () => {
    const nodes = [root({ cost: 1000 })];
    for (let depth = 2; depth <= 9; depth++) {
      nodes.push(
        child(`n${depth}`, `n${depth - 1}`, 0.4, { value: null }),
        child(`t${depth}`, `n${depth - 1}`, 0.6),
      );
    }
    nodes.at(-2)!.value = 0;
    expect(getMessages(nodes)).toEqual([]);
  });

  test("should accept children listed before their parent", () => {
    expect(
      getMessages([child("a", "n1", 0.5), child("b", "n1", 0.5), root()]),
    ).toEqual([]);
  });

  test("should reject a duplicate id", () => {
    expect(
      getMessages([root(), child("a", "n1", 0.5), child("a", "n1", 0.5)]),
    ).toContain("Node id a is used more than once");
  });

  test("should reject no root or more than one root", () => {
    expect(getMessages([])).toContain(
      "The tree must have exactly one root node, found 0",
    );
    expect(
      getMessages([root({ value: 1 }), root({ id: "n2", value: 1 })]),
    ).toContain("The tree must have exactly one root node, found 2");
  });

  test("should reject an unknown parent", () => {
    expect(getMessages([root({ value: 1 }), child("a", "x", 1)])).toContain(
      "Node a has an unknown parent x",
    );
  });

  test("should reject a cycle", () => {
    expect(
      getMessages([root({ value: 1 }), child("a", "b", 1), child("b", "a", 1)]),
    ).toEqual([
      "Node a is not connected to the root node",
      "Node b is not connected to the root node",
    ]);
  });

  test("should reject a branch with no probability", () => {
    expect(
      getMessages([root(), child("a", "n1", 1, { probability: null })]),
    ).toContain("Node a must have a label, reason and probability");
  });

  test("should reject a terminal node with no value", () => {
    expect(
      getMessages([root(), child("a", "n1", 1, { value: null })]),
    ).toContain("Terminal node a must have a value");
  });

  test("should reject probabilities that do not sum to 1", () => {
    expect(
      getMessages([root(), child("a", "n1", 0.5), child("b", "n1", 0.6)]),
    ).toContain("Probabilities of the branches from node n1 must sum to 1");
    expect(
      getMessages([
        root(),
        child("a", "n1", 0.1),
        child("b", "n1", 0.2),
        child("c", "n1", 0.7),
      ]),
    ).toEqual([]);
  });
});
