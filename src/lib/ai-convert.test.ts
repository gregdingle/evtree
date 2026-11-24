import { values } from "es-toolkit/compat";

import { convertAIStructureToDecisionTree } from "./ai-convert";
import { AINode, AITree } from "./ai-schemas";
import { arrangeSubtreeHelper } from "./layout";

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

  describe("order of the branches", () => {
    const row = (
      id: string,
      parentId: string | null,
      probability: number | null,
      value: number | null,
    ): AINode => ({
      id,
      parentId,
      label: parentId && id,
      reason: parentId && "Because",
      probability,
      question: value === null ? "Question?" : null,
      value,
      cost: null,
    });

    function getOrder(aiNodes: AINode[], parentLabel?: string) {
      const { tree, edges, getEdge } = convert(aiNodes);
      const parentId = parentLabel
        ? getEdge(parentLabel).target
        : values(tree.nodes).find(
            (node) => !edges.some((edge) => edge.target === node.id),
          )!.id;
      return edges
        .filter((edge) => edge.source === parentId)
        .sort(
          (a, b) =>
            tree.nodes[a.target]!.position.y - tree.nodes[b.target]!.position.y,
        )
        .map((edge) => edge.data?.label);
    }

    test("should put the branch that continues before the one that ends at nothing", () => {
      const aiNodes = [
        row("root", null, null, null),
        row("no liability", "root", 0.4, 0),
        row("liability", "root", 0.6, null),
        row("low", "liability", 0.25, 100),
        row("mid", "liability", 0.5, 200),
        row("high", "liability", 0.25, 400),
      ];
      expect(getOrder(aiNodes)).toEqual(["liability", "no liability"]);
      expect(getOrder(aiNodes, "liability")).toEqual(["high", "mid", "low"]);
    });

    test("should put the largest payment first in a tree for the defendant", () => {
      const aiNodes = [
        row("root", null, null, null),
        row("no liability", "root", 0.4, 0),
        row("liability", "root", 0.6, null),
        row("low", "liability", 0.5, -100),
        row("high", "liability", 0.5, -400),
      ];
      expect(getOrder(aiNodes)).toEqual(["liability", "no liability"]);
      expect(getOrder(aiNodes, "liability")).toEqual(["high", "low"]);
    });

    test("should keep the order when the tree is arranged", () => {
      const { tree, getEdge } = convert([
        row("root", null, null, null),
        row("no liability", "root", 0.4, 0),
        row("liability", "root", 0.6, null),
        row("low", "liability", 0.5, 100),
        row("high", "liability", 0.5, 400),
      ]);
      arrangeSubtreeHelper(tree, getEdge("liability").source);
      const getY = (label: string) =>
        tree.nodes[getEdge(label).target]!.position.y;
      expect(getY("high")).toBeLessThan(getY("low"));
      expect(getY("low")).toBeLessThan(getY("no liability"));
    });

    test("should weigh a branch by the probabilities of what follows it", () => {
      const aiNodes = [
        row("root", null, null, null),
        row("likely", "root", 0.5, null),
        row("likely win", "likely", 0.9, 100),
        row("likely loss", "likely", 0.1, 0),
        row("unlikely", "root", 0.5, null),
        row("unlikely loss", "unlikely", 0.9, 0),
        row("unlikely win", "unlikely", 0.1, 500),
      ];
      // NOTE: 0.9 × 100 is more than 0.1 × 500
      expect(getOrder(aiNodes)).toEqual(["likely", "unlikely"]);
    });

    test("should keep the order of the AI between branches of the same size", () => {
      const aiNodes = [
        row("root", null, null, null),
        row("second claim", "root", 0.3, 100),
        row("neither claim", "root", 0.4, 0),
        row("first claim", "root", 0.3, 100),
      ];
      expect(getOrder(aiNodes)).toEqual([
        "second claim",
        "first claim",
        "neither claim",
      ]);
    });
  });

  test("should not depend on the order of the AI nodes", () => {
    const { tree, edges, getEdge } = convert([...nodes].reverse());
    expect(values(tree.nodes)).toHaveLength(4);
    expect(edges).toHaveLength(3);
    expect(getEdge("Award").source).toBe(getEdge("Claims survive").target);
  });
});
