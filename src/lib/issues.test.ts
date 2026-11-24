import haplessHarvestData from "@/data/reference/hapless-harvest-defense-with-costs-tree.json";

import { AppEdge, createEdge } from "./edge";
import { IssuesRoot, getIssues, getSubTreeElements } from "./issues";
import { AppNode } from "./node";
import { computeNetExpectedValues } from "./selectors";
import { DecisionTree } from "./tree";

jest.mock("nanoid", () => {
  let nextId = 0;
  return { nanoid: () => `id-${++nextId}` };
});

function getRoot(tree: DecisionTree): IssuesRoot {
  const roots = getIssues(tree, computeNetExpectedValues(tree));
  expect(roots).toHaveLength(1);
  return roots[0]!;
}

/**
 * Builds a tree from rows of [id, parent id, label, probability, value]
 */
function buildTree(
  rows: [string, string | null, string, string | undefined, string?][],
  nodeData: Record<string, Partial<AppNode>> = {},
): DecisionTree {
  const nodes: Record<string, AppNode> = {};
  const edges: Record<string, AppEdge> = {};
  rows.forEach(([id, parentId, label, probabilityExpr, valueExpr], index) => {
    const isParent = rows.some((row) => row[1] === id);
    nodes[id] = {
      id,
      type: isParent ? "chance" : "terminal",
      position: { x: 0, y: index },
      data: { valueExpr },
      ...nodeData[id],
    };
    if (parentId) {
      const edge = createEdge(parentId, id, false, {
        label,
        probabilityExpr,
        description: `Reason for ${label}`,
      });
      edges[edge.id] = edge;
    }
  });
  return { id: "t", name: "Test", createdAt: "", nodes, edges };
}

describe("getIssues", () => {
  describe("for the Hapless Harvest reference tree", () => {
    const root = getRoot(haplessHarvestData as unknown as DecisionTree);

    test("should have each issue once, in order of depth", () => {
      // NOTE: the drawing labels the awards differently on each path, like
      // "High No Contrib" and "High w Contrib", and they are still one issue
      expect(root.issues.map((issue) => issue.heading)).toEqual([
        "SJ Denied / SJ Granted",
        "Liability / No liability",
        "No Contrib / 33% Contrib",
        "Back & Knee / Knee Only",
        "High / Mid / Low",
      ]);
      expect(root.issues.map((s) => s.occurrences.length)).toEqual([
        1, 1, 1, 2, 4,
      ]);
    });

    test("should have the expected value and terms of the drawing", () => {
      expect(root.expectedValue).toBeCloseTo(-40000);
      const [occurrence] = root.issues[0]!.occurrences;
      expect(occurrence).toMatchObject({ path: [], isComplete: true });
      expect(occurrence!.outcomes).toMatchObject([
        { label: "SJ Denied", probability: 0.4, value: -88000 },
        { label: "SJ Granted", probability: 0.6, value: -8000 },
      ]);
    });

    test("should give the path to each occurrence of a repeated issue", () => {
      const injury = root.issues[3]!;
      expect(injury.occurrences.map((o) => o.path)).toEqual([
        ["SJ Denied", "Liability", "No Contrib"],
        ["SJ Denied", "Liability", "33% Contrib"],
      ]);
      // The probability of a back injury differs with contributory negligence
      expect(
        injury.occurrences.map((o) => o.outcomes.map((x) => x.probability)),
      ).toEqual([
        [0.6, 0.4],
        [0.5, 0.5],
      ]);
      const awards = root.issues[4]!;
      awards.occurrences.forEach((occurrence) =>
        expect(occurrence.outcomes.map((o) => o.probability)).toEqual([
          0.25, 0.5, 0.25,
        ]),
      );
      expect(awards.occurrences.map((o) => o.expectedValue)).toEqual([
        -193000, -74250, -177250, -63750,
      ]);
    });
  });

  test("should use the description of a node as the heading", () => {
    const tree = buildTree(
      [
        ["a", null, "", undefined],
        ["b", "a", "Yes", "0.5", "10"],
        ["c", "a", "No", "0.5", "0"],
      ],
      { a: { data: { description: "Will it rain?" } } },
    );
    const [issue] = getRoot(tree).issues;
    expect(issue!.heading).toBe("Will it rain?");
    expect(issue!.occurrences[0]!.outcomes).toMatchObject([
      { label: "Yes", probability: 0.5, reason: "Reason for Yes" },
      { label: "No", probability: 0.5, reason: "Reason for No" },
    ]);
  });

  test("should keep apart issues with the same labels and different descriptions", () => {
    const tree = buildTree(
      [
        ["a", null, "", undefined],
        ["b", "a", "Granted", "0.5", "0"],
        ["c", "a", "Denied", "0.5"],
        ["d", "c", "Granted", "0.5", "0"],
        ["e", "c", "Denied", "0.5", "10"],
      ],
      {
        a: { data: { description: "First motion?" } },
        c: { data: { description: "Second motion?" } },
      },
    );
    expect(getRoot(tree).issues.map((issue) => issue.heading)).toEqual([
      "First motion?",
      "Second motion?",
    ]);
  });

  test("should number the outcomes that have no label", () => {
    const tree = buildTree([
      ["a", null, "", undefined],
      ["b", "a", "", "0.5", "10"],
      ["c", "a", " ", "0.5", "0"],
    ]);
    const [issue] = getRoot(tree).issues;
    expect(issue!.heading).toBe("Outcome 1 / Outcome 2");
  });

  test("should have no arithmetic when a probability is missing", () => {
    const tree = buildTree([
      ["a", null, "", undefined],
      ["b", "a", "Yes", undefined, "10"],
      ["c", "a", "No", "0.5", "0"],
    ]);
    const [occurrence] = getRoot(tree).issues[0]!.occurrences;
    expect(occurrence!.isComplete).toBe(false);
    expect(occurrence!.outcomes[0]!.probability).toBeNull();
  });

  test("should mark the best option of a decision", () => {
    const tree = buildTree(
      [
        ["a", null, "", undefined],
        ["b", "a", "Settle", undefined, "5"],
        ["c", "a", "Litigate", undefined, "10"],
      ],
      { a: { type: "decision" } },
    );
    const root = getRoot(tree);
    expect(root.expectedValue).toBe(10);
    const [issue] = root.issues;
    expect(issue!.isDecision).toBe(true);
    expect(issue!.occurrences[0]!.outcomes).toMatchObject([
      { label: "Settle", isBest: false, value: 5 },
      { label: "Litigate", isBest: true, value: 10 },
    ]);
  });
});

describe("getIssues onward values", () => {
  const tree = haplessHarvestData as unknown as DecisionTree;
  const root = getRoot(tree);
  const occurrences = root.issues.flatMap((issue) => issue.occurrences);

  test("should be the same as the net value at the root", () => {
    const [first] = occurrences;

    expect(first!.path).toEqual([]);
    expect(first!.onwardExpectedValue).toBe(first!.expectedValue);
  });

  test("should give the expected value of each node with its cost as a term", () => {
    occurrences.forEach((occurrence) => {
      const sum = occurrence.outcomes.reduce(
        (total, outcome) => total + outcome.probability! * outcome.onwardValue!,
        0,
      );
      expect(sum - (occurrence.cost ?? 0)).toBeCloseTo(
        occurrence.onwardExpectedValue!,
      );
    });
  });

  test("should differ from the net value by the costs on the path", () => {
    // NOTE: a cost of 10 at the root, and of 5 at the issue that follows
    const withCosts = getRoot(
      buildTree(
        [
          ["root", null, "", undefined],
          ["issue", "root", "Goes on", "0.5"],
          ["win", "issue", "Win", "0.5", "100"],
          ["lose", "issue", "Lose", "0.5", "0"],
          ["ends", "root", "Ends", "0.5", "20"],
        ],
        {
          root: { data: { costExpr: "10" } },
          issue: { data: { costExpr: "5" } },
        },
      ),
    );
    const [start, issue] = withCosts.issues.map(
      (issue) => issue.occurrences[0]!,
    );

    // 50% × (50% × 100 + 50% × 0 − 5) + 50% × 20 − 10
    expect(start!.expectedValue).toBe(22.5);
    expect(start!.onwardExpectedValue).toBe(22.5);
    expect(start!.outcomes.map((outcome) => outcome.onwardValue)).toEqual([
      45, 20,
    ]);
    expect(start!.outcomes.map((outcome) => outcome.value)).toEqual([35, 10]);

    expect(issue!.cost).toBe(5);
    expect(issue!.expectedValue).toBe(35);
    expect(issue!.onwardExpectedValue).toBe(45);
    expect(issue!.outcomes.map((outcome) => outcome.onwardValue)).toEqual([
      100, 0,
    ]);
    expect(issue!.outcomes.map((outcome) => outcome.value)).toEqual([85, -15]);
  });

  test("should give a terminal node its value as entered", () => {
    occurrences.forEach((occurrence) =>
      occurrence.outcomes.forEach((outcome) => {
        const node = tree.nodes[tree.edges[outcome.edgeId]!.target]!;
        if (node.type === "terminal") {
          expect(outcome.onwardValue).toBeCloseTo(Number(node.data.valueExpr));
        }
      }),
    );
  });
});

describe("getSubTreeElements", () => {
  const tree = haplessHarvestData as unknown as DecisionTree;
  const { issues } = getRoot(tree);
  const getCenterY = (node: AppNode) =>
    node.position.y + (node.measured?.height ?? 0) / 2;
  const getRight = (node: AppNode) =>
    node.position.x + (node.measured?.width ?? 0);

  test("should return a root with its branches and no incoming branch", () => {
    const { nodeId, outcomes } = issues[0]!.occurrences[0]!;
    const { nodes, edges, bounds } = getSubTreeElements(tree, nodeId);

    expect(nodes[0]!.id).toBe(nodeId);
    expect(nodes[0]!.position).toEqual({ x: 0, y: 0 });
    expect(edges.map((edge) => edge.target)).not.toContain(nodeId);
    expect(edges.map((edge) => edge.id)).toEqual(
      expect.arrayContaining(outcomes.map((outcome) => outcome.edgeId)),
    );
    expect(bounds.x).toBeLessThan(0);
  });

  test("should crop every node of a tree to the same width", () => {
    const boxes = issues
      .flatMap((issue) => issue.occurrences)
      .map(({ nodeId }) => getSubTreeElements(tree, nodeId).bounds);

    expect(new Set(boxes.map((box) => box.x)).size).toBe(1);
    expect(new Set(boxes.map((box) => box.width)).size).toBe(1);
    // NOTE: more room for the value of a terminal node without rounding
    expect(tree.rounding).toBeTruthy();
    const { nodeId } = issues[0]!.occurrences[0]!;
    expect(
      getSubTreeElements({ ...tree, rounding: "" }, nodeId).bounds.width,
    ).toBeGreaterThan(boxes[0]!.width);
  });

  test("should crop the branch that leads to a node at the left side", () => {
    // NOTE: the last of the four award nodes, which has three branches
    const { nodeId, outcomes } = issues[4]!.occurrences[3]!;
    const { nodes, edges, bounds } = getSubTreeElements(tree, nodeId);
    const incomingEdge = Object.values(tree.edges).find(
      (edge) => edge.target === nodeId,
    )!;

    expect(nodes.map((node) => node.id)).toEqual([
      nodeId,
      incomingEdge.source,
      ...outcomes.map((outcome) => tree.edges[outcome.edgeId]!.target),
    ]);
    expect(edges.map((edge) => edge.id)).toEqual([
      incomingEdge.id,
      ...outcomes.map((outcome) => outcome.edgeId),
    ]);
    // NOTE: the parent is outside of the box, so only its branch shows
    const [node, parent] = nodes;
    expect(getRight(parent!)).toBeLessThan(bounds.x);
    expect(getCenterY(parent!)).toBe(getCenterY(node!));
    expect(parent!.className).toBe("opacity-0");
  });

  test("should space the branches evenly inside the box", () => {
    const { nodeId } = issues[4]!.occurrences[3]!;
    const { nodes, bounds } = getSubTreeElements(tree, nodeId);
    const [node, , ...children] = nodes;
    const offsets = children.map(
      (child) => getCenterY(child) - getCenterY(node!),
    );

    expect(offsets[1]).toBe(0);
    expect(offsets[0]).toBe(-offsets[2]!);
    expect(offsets[2]).toBeGreaterThan(0);
    children.forEach((child) => {
      expect(child.position.x).toBeGreaterThan(0);
      // NOTE: with room for the value of a terminal node
      expect(getRight(child)).toBeLessThan(bounds.x + bounds.width);
      expect(child.position.y).toBeGreaterThan(bounds.y);
      expect(getCenterY(child)).toBeLessThan(bounds.y + bounds.height);
    });
  });

  test("should crop one branch that goes on from an outcome at the right side", () => {
    // NOTE: summary judgment is denied or granted, and only denied goes on, to
    // the two outcomes of liability
    const { nodeId, outcomes } = issues[0]!.occurrences[0]!;
    const liability = issues[1]!.occurrences[0]!;
    const { nodes, edges, bounds } = getSubTreeElements(tree, nodeId);

    const outgoingEdges = edges.filter(
      (edge) => edge.source === liability.nodeId,
    );
    expect(outgoingEdges).toHaveLength(1);
    expect(edges).toHaveLength(outcomes.length + 1);

    const child = nodes.find((other) => other.id === liability.nodeId)!;
    const farNode = nodes.find(
      (other) => other.id === outgoingEdges[0]!.target,
    )!;
    expect(farNode.position.x).toBeGreaterThan(bounds.x + bounds.width);
    expect(getCenterY(farNode)).toBe(getCenterY(child));
    expect(farNode.className).toBe("opacity-0");
    expect(child.className).toBeUndefined();
  });

  test("should return nodes and edges that are not selected or hidden", () => {
    const { nodeId } = issues[1]!.occurrences[0]!;
    const selected = {
      ...tree,
      nodes: {
        ...tree.nodes,
        [nodeId]: { ...tree.nodes[nodeId]!, selected: true, hidden: true },
      },
    };
    const { nodes, edges } = getSubTreeElements(selected, nodeId);

    [...nodes, ...edges].forEach((element) => {
      expect(element.selected).toBe(false);
      expect(element.hidden).toBe(false);
    });
  });

  test("should return nothing for a node that is not in the tree", () => {
    const { nodes, edges, bounds } = getSubTreeElements(tree, "missing");

    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
    expect(bounds.width).toBe(0);
  });
});
