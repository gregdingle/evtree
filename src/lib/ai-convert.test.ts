import { values } from "es-toolkit/compat";

import { convertAIStructureToDecisionTree } from "./ai-convert";
import { AINode, AITree } from "./ai-schemas";

jest.mock("nanoid", () => {
  let nextId = 0;
  return { nanoid: () => `id-${++nextId}` };
});

const nodes: AINode[] = [
  {
    id: "n1",
    parentId: null,
    label: null,
    reason: null,
    probability: null,
    question: "Does the settlement bar the claims?",
    value: null,
    cost: 100000,
  },
  {
    id: "n2",
    parentId: "n1",
    label: "Claims barred",
    reason: "Because of the settlement",
    probability: 0.25,
    question: null,
    value: 0,
    cost: null,
  },
  {
    id: "n3",
    parentId: "n1",
    label: "Claims survive",
    reason: "Because the settlement is narrow",
    probability: 0.75,
    question: null,
    value: null,
    cost: 200000,
  },
  {
    id: "n4",
    parentId: "n3",
    label: "Award",
    reason: "Because it is the only outcome",
    probability: 1,
    question: null,
    value: -5000000,
    cost: null,
  },
];

function convert(aiNodes: AINode[], currency: AITree["currency"] = "USD") {
  const tree = convertAIStructureToDecisionTree(
    { currency, issues: ["Issue?"], nodes: aiNodes },
    "Name",
    "Description",
  );
  const edges = values(tree.edges);
  const getEdge = (label: string) =>
    edges.find((edge) => edge.data?.label === label)!;
  return { tree, edges, getEdge };
}

describe("convertAIStructureToDecisionTree", () => {
  test("should create a node per AI node and an edge per branch", () => {
    const { tree, edges } = convert(nodes);
    expect(tree.name).toBe("Name");
    expect(tree.description).toBe("Description");
    expect(values(tree.nodes)).toHaveLength(4);
    expect(edges).toHaveLength(3);
  });

  test("should connect each node to its parent", () => {
    const { tree, getEdge } = convert(nodes);
    const barred = getEdge("Claims barred");
    const survive = getEdge("Claims survive");
    const award = getEdge("Award");

    // The root is the source of both branches, and has no incoming edge
    expect(barred.source).toBe(survive.source);
    expect(award.source).toBe(survive.target);
    const rootNode = tree.nodes[barred.source]!;
    expect(rootNode.data.costExpr).toBe("100000");
    expect(values(tree.edges).some((e) => e.target === rootNode.id)).toBe(
      false,
    );
  });

  test("should copy the branch and node fields", () => {
    const { tree, getEdge } = convert(nodes);
    const barred = getEdge("Claims barred");
    expect(barred.data).toMatchObject({
      label: "Claims barred",
      description: "Because of the settlement",
      probabilityExpr: "0.25",
    });
    expect(tree.nodes[barred.target]!.data).toMatchObject({
      valueExpr: "0",
      costExpr: undefined,
    });
    const award = getEdge("Award");
    expect(tree.nodes[award.target]!.data.valueExpr).toBe("-5000000");
    expect(tree.nodes[award.source]!.data.costExpr).toBe("200000");
  });

  test("should keep the question of a node as its description", () => {
    const { tree, getEdge } = convert(nodes);
    const barred = getEdge("Claims barred");
    expect(tree.nodes[barred.source]!.data.description).toBe(
      "Does the settlement bar the claims?",
    );
    expect(tree.nodes[barred.target]!.data.description).toBe("");
  });

  test("should set node types from the number of child nodes", () => {
    const { tree, getEdge } = convert(nodes);
    const barred = getEdge("Claims barred");
    const award = getEdge("Award");
    expect(tree.nodes[barred.source]!.type).toBe("chance");
    expect(tree.nodes[barred.target]!.type).toBe("terminal");
    expect(tree.nodes[award.source]!.type).toBe("decision");
    expect(tree.nodes[award.target]!.type).toBe("terminal");
  });

  test("should set the currency, and rounding to match", () => {
    expect(convert(nodes).tree).toMatchObject({
      currency: "USD",
      rounding: "US",
    });
    expect(convert(nodes, "GBP").tree).toMatchObject({
      currency: "GBP",
      rounding: "UK",
    });
    const { tree } = convert(nodes, null);
    expect(tree.currency).toBeUndefined();
    expect(tree.rounding).toBe("US");
  });

  test("should not depend on the order of the AI nodes", () => {
    const { tree, edges, getEdge } = convert([...nodes].reverse());
    expect(values(tree.nodes)).toHaveLength(4);
    expect(edges).toHaveLength(3);
    expect(getEdge("Award").source).toBe(getEdge("Claims survive").target);
  });
});
