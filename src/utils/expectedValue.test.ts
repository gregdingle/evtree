import { keyBy, mapValues } from "es-toolkit";
import {
  ComputeEdge,
  ComputeNode,
  computeNodeValues,
  toComputeEdge,
  toComputeNode,
} from "./expectedValue";

describe("computeNodeValues", () => {
  test("should copy values for a simple sequence of 1.0 probabilities", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: null, cost: null } },
      { id: "2", data: { value: null, cost: null } },
      { id: "3", data: { value: 30, cost: null } },
    ];
    const edges: ComputeEdge[] = [
      { id: "e1", source: "1", target: "2", data: { probability: 1.0 } },
      { id: "e2", source: "2", target: "3", data: { probability: 1.0 } },
    ];

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id),
    );

    expect(nodes[0]!.data.value).toEqual(30);
    expect(nodes[1]!.data.value).toEqual(30);
    expect(nodes[2]!.data.value).toEqual(30);
  });

  test("should weight values for a simple sequence", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: null, cost: null } },
      { id: "2", data: { value: null, cost: null } },
      { id: "3", data: { value: 40, cost: null } },
    ];
    const edges: ComputeEdge[] = [
      { id: "e1", source: "1", target: "2", data: { probability: 0.5 } },
      { id: "e2", source: "2", target: "3", data: { probability: 0.5 } },
    ];

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id),
    );

    expect(nodes[0]!.data.value).toEqual(10);
    expect(nodes[1]!.data.value).toEqual(20);
    expect(nodes[2]!.data.value).toEqual(40);
  });

  // NOTE: See note in computeNodeValues about a node's OWN cost and
  // ancestors's costs not being subtracted!!!
  test("should compute expected value for a simple decision tree with costs", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: null, cost: 10 } }, // Root decision node
      { id: "2a", data: { value: 100, cost: null } }, // Outcome A
      { id: "2b", data: { value: 50, cost: null } }, // Outcome B
      { id: "2c", data: { value: 0, cost: 10 } }, // Outcome C
    ];
    const edges: ComputeEdge[] = [
      { id: "e1", source: "1", target: "2a", data: { probability: 0.5 } },
      { id: "e2", source: "1", target: "2b", data: { probability: 0.3 } },
      { id: "e3", source: "1", target: "2c", data: { probability: 0.2 } },
    ];

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id),
    );

    // Expected value = (100 * 0.5) + (50 * 0.3) + ((0 - 10) * 0.2) = 50 + 15 - 2 = 63
    expect(nodes[0]!.data.value).toEqual(63);
    expect(nodes[1]!.data.value).toEqual(100);
    expect(nodes[2]!.data.value).toEqual(50);
    // NOTE: See note in computeNodeValues about a node's OWN cost and
    // ancestors's costs not being subtracted!!!
    expect(nodes[3]!.data.value).toEqual(0);
  });

  test("should handle all null values gracefully", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: null, cost: null } },
      { id: "2", data: { value: null, cost: null } },
      { id: "3", data: { value: null, cost: null } },
    ];
    const edges: ComputeEdge[] = [
      { id: "e1", source: "1", target: "2", data: { probability: 1.0 } },
      { id: "e2", source: "2", target: "3", data: { probability: 1.0 } },
    ];

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id),
    );

    // When terminal node has null value, all parent nodes remain null
    expect(nodes[0]!.data.value).toBeNull();
    expect(nodes[1]!.data.value).toBeNull();
    expect(nodes[2]!.data.value).toBeNull(); // Terminal node remains null
  });

  test("should handle negative values correctly", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: null, cost: null } }, // Root decision node
      { id: "2a", data: { value: -50, cost: null } }, // Negative outcome A
      { id: "2b", data: { value: 100, cost: null } }, // Positive outcome B
    ];
    const edges: ComputeEdge[] = [
      { id: "e1", source: "1", target: "2a", data: { probability: 0.4 } },
      { id: "e2", source: "1", target: "2b", data: { probability: 0.6 } },
    ];

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id),
    );

    // Expected value = (-50 * 0.4) + (100 * 0.6) = -20 + 60 = 40
    expect(nodes[0]!.data.value).toEqual(40);
    expect(nodes[1]!.data.value).toEqual(-50);
    expect(nodes[2]!.data.value).toEqual(100);
  });

  test("should ignore null children and compute from defined ones", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: null, cost: null } }, // Root decision node
      { id: "2a", data: { value: 100, cost: null } }, // Defined outcome A
      { id: "2b", data: { value: null, cost: null } }, // Null outcome B
    ];
    const edges: ComputeEdge[] = [
      { id: "e1", source: "1", target: "2a", data: { probability: 0.6 } },
      { id: "e2", source: "1", target: "2b", data: { probability: 0.4 } },
    ];

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id),
    );

    // Root should get value from defined child only: 100 * 0.6 = 60
    expect(nodes[0]!.data.value).toEqual(60);
    expect(nodes[1]!.data.value).toEqual(100);
    expect(nodes[2]!.data.value).toBeNull();
  });

  test("should handle multiple root nodes correctly", () => {
    const nodes: ComputeNode[] = [
      { id: "root1", data: { value: null, cost: null } }, // First root
      { id: "child1a", data: { value: 80, cost: null } }, // Child of root1
      { id: "child1b", data: { value: 20, cost: null } }, // Child of root1
      { id: "root2", data: { value: null, cost: null } }, // Second root
      { id: "child2", data: { value: 150, cost: null } }, // Child of root2
    ];
    const edges: ComputeEdge[] = [
      {
        id: "e1",
        source: "root1",
        target: "child1a",
        data: { probability: 0.7 },
      },
      {
        id: "e2",
        source: "root1",
        target: "child1b",
        data: { probability: 0.3 },
      },
      {
        id: "e3",
        source: "root2",
        target: "child2",
        data: { probability: 1.0 },
      },
    ];

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id),
    );

    // First tree: (80 * 0.7) + (20 * 0.3) = 56 + 6 = 62
    expect(nodes[0]!.data.value).toEqual(62);
    expect(nodes[1]!.data.value).toEqual(80);
    expect(nodes[2]!.data.value).toEqual(20);

    // Second tree: 150 * 1.0 = 150
    expect(nodes[3]!.data.value).toEqual(150);
    expect(nodes[4]!.data.value).toEqual(150);
  });

  test("should handle zero root nodes gracefully", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: null, cost: null } },
      { id: "2", data: { value: null, cost: null } },
      { id: "3", data: { value: 30, cost: null } },
    ];
    const edges: ComputeEdge[] = [
      { id: "e1", source: "1", target: "2", data: { probability: 1.0 } },
      { id: "e2", source: "2", target: "3", data: { probability: 1.0 } },
      { id: "e3", source: "3", target: "1", data: { probability: 1.0 } }, // Creates a cycle
    ];

    // Mock console.warn to verify it's called
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id),
    );

    // Should warn about no root nodes and leave all values unchanged
    expect(consoleSpy).toHaveBeenCalledWith(
      "[EVTree] No root nodes found, cannot compute values.",
    );
    expect(nodes[0]!.data.value).toBeNull();
    expect(nodes[1]!.data.value).toBeNull();
    expect(nodes[2]!.data.value).toEqual(30); // Original value preserved

    consoleSpy.mockRestore();
  });

  test("should update probabilities for decision nodes based on expected value and costs", () => {
    const nodes: ComputeNode[] = [
      { id: "decision", type: "decision", data: { value: null, cost: 20 } }, // Decision node
      { id: "outcome1", type: "terminal", data: { value: 100, cost: 20 } }, // Net value: 80
      { id: "outcome2", type: "terminal", data: { value: 60, cost: 10 } }, // Net value: 50
      { id: "outcome3", type: "terminal", data: { value: 120, cost: 40 } }, // Net value: 80
    ];
    const edges: ComputeEdge[] = [
      {
        id: "e1",
        source: "decision",
        target: "outcome1",
        data: { probability: null },
      },
      {
        id: "e2",
        source: "decision",
        target: "outcome2",
        data: { probability: null },
      },
      {
        id: "e3",
        source: "decision",
        target: "outcome3",
        data: { probability: null },
      },
    ];

    const edgesByKey = keyBy(edges, (edge) => edge.id);

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      edgesByKey,
    );

    // Outcome1 and outcome3 both have highest expected value (80)
    // So they should get probability 0.5 each, outcome2 should get 0.0
    expect(edgesByKey["e1"]!.data?.probability).toEqual(0.5); // to outcome1 (value: 80)
    expect(edgesByKey["e2"]!.data?.probability).toEqual(0.0); // to outcome2 (value: 50)
    expect(edgesByKey["e3"]!.data?.probability).toEqual(0.5); // to outcome3 (value: 80)

    // Decision node should have expected value of best outcomes: 80
    expect(nodes[0]!.data.value).toEqual(80);
  });

  test("should update probabilities for decision nodes with single best outcome", () => {
    const nodes: ComputeNode[] = [
      { id: "decision", type: "decision", data: { value: null, cost: null } }, // Decision node
      { id: "outcome1", type: "terminal", data: { value: 100, cost: null } }, // Expected value: 100
      { id: "outcome2", type: "terminal", data: { value: 50, cost: null } }, // Expected value: 50
      { id: "outcome3", type: "terminal", data: { value: 30, cost: null } }, // Expected value: 30
    ];
    const edges: ComputeEdge[] = [
      {
        id: "e1",
        source: "decision",
        target: "outcome1",
        data: { probability: null },
      },
      {
        id: "e2",
        source: "decision",
        target: "outcome2",
        data: { probability: null },
      },
      {
        id: "e3",
        source: "decision",
        target: "outcome3",
        data: { probability: null },
      },
    ];

    const edgesByKey = keyBy(edges, (edge) => edge.id);

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      edgesByKey,
    );

    // Only outcome1 has the highest expected value (100)
    // So it should get probability 1.0, others should get 0.0
    expect(edgesByKey["e1"]!.data?.probability).toEqual(1.0); // to outcome1 (value: 100)
    expect(edgesByKey["e2"]!.data?.probability).toEqual(0.0); // to outcome2 (value: 50)
    expect(edgesByKey["e3"]!.data?.probability).toEqual(0.0); // to outcome3 (value: 30)

    // Decision node should have expected value of best outcome: 100
    expect(nodes[0]!.data.value).toEqual(100);
  });

  test("should not update probabilities for non-decision nodes", () => {
    const nodes: ComputeNode[] = [
      { id: "chance", type: "chance", data: { value: null, cost: null } }, // Chance node
      { id: "outcome1", type: "terminal", data: { value: 100, cost: null } },
      { id: "outcome2", type: "terminal", data: { value: 50, cost: null } },
    ];
    const edges: ComputeEdge[] = [
      {
        id: "e1",
        source: "chance",
        target: "outcome1",
        data: { probability: 0.7 },
      },
      {
        id: "e2",
        source: "chance",
        target: "outcome2",
        data: { probability: 0.3 },
      },
    ];

    const edgesByKey = keyBy(edges, (edge) => edge.id);

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      edgesByKey,
    );

    // Probabilities should remain unchanged for chance nodes
    expect(edgesByKey["e1"]!.data?.probability).toEqual(0.7);
    expect(edgesByKey["e2"]!.data?.probability).toEqual(0.3);

    // Chance node should have weighted expected value: (100 * 0.7) + (50 * 0.3) = 85
    expect(nodes[0]!.data.value).toEqual(85);
  });

  test("should handle decision node with one null and one valued child without infinite loop", () => {
    const nodes: ComputeNode[] = [
      { id: "decision", type: "decision", data: { value: null, cost: null } },
      { id: "child1", type: "terminal", data: { value: null, cost: null } },
      { id: "child2", type: "terminal", data: { value: 100, cost: null } },
    ];
    const edges: ComputeEdge[] = [
      {
        id: "e1",
        source: "decision",
        target: "child1",
        data: { probability: null },
      },
      {
        id: "e2",
        source: "decision",
        target: "child2",
        data: { probability: null },
      },
    ];

    const edgesByKey = keyBy(edges, (edge) => edge.id);
    const nodesByKey = keyBy(nodes, (node) => node.id);

    // First computation
    computeNodeValues(nodesByKey, edgesByKey);

    const firstE1Prob = edgesByKey["e1"]!.data?.probability;
    const firstE2Prob = edgesByKey["e2"]!.data?.probability;

    // Second computation should be idempotent
    computeNodeValues(nodesByKey, edgesByKey);

    const secondE1Prob = edgesByKey["e1"]!.data?.probability;
    const secondE2Prob = edgesByKey["e2"]!.data?.probability;

    // Probabilities should remain stable across multiple computations
    expect(secondE1Prob).toEqual(firstE1Prob);
    expect(secondE2Prob).toEqual(firstE2Prob);

    // Only the edge to the valued child should get probability
    expect(edgesByKey["e1"]!.data?.probability).toEqual(0); // to null child
    expect(edgesByKey["e2"]!.data?.probability).toEqual(1); // to valued child

    // Decision node should get the value of the only viable child
    expect(nodesByKey["decision"]!.data.value).toEqual(100);
  });
});

describe("toComputeNode expression evaluation", () => {
  const appNode: AppNode = {
    id: "test",
    type: "terminal" as const,
    data: {},
    position: { x: 0, y: 0 },
  };

  test("should return null when no expressions are provided", () => {
    const testNode = {
      ...appNode,
      data: {
        valueExpr: undefined,
        costExpr: undefined,
      },
    };

    const result = toComputeNode(testNode);

    expect(result.data.value).toEqual(null);
    expect(result.data.cost).toEqual(null);
  });

  test("should evaluate simple arithmetic expressions", () => {
    const testNode = {
      ...appNode,
      data: {
        valueExpr: "10 + 5 * 2",
        costExpr: "100 - 30",
      },
    };

    const result = toComputeNode(testNode);

    expect(result.data.value).toEqual(20); // 10 + 5 * 2
    expect(result.data.cost).toEqual(70); // 100 - 30
  });

  test("should evaluate expressions with variables", () => {
    const testNode = {
      ...appNode,
      type: "decision" as const,
      data: {
        valueExpr: "baseValue * multiplier + bonus",
        costExpr: "hourlyRate * hours",
      },
    };

    const variables = {
      baseValue: 1000,
      multiplier: 1.5,
      bonus: 200,
      hourlyRate: 150,
      hours: 8,
    };

    const result = toComputeNode(testNode, variables);

    expect(result.data.value).toEqual(1700); // 1000 * 1.5 + 200
    expect(result.data.cost).toEqual(1200); // 150 * 8
  });

  test("should handle parentheses and complex expressions", () => {
    const testNode = {
      ...appNode,
      data: {
        value: 0,
        cost: 0,
        valueExpr: "(probability * outcome1) + ((1 - probability) * outcome2)",
        costExpr: "baseCost * (1 + taxRate)",
      },
    };

    const variables = {
      probability: 0.6,
      outcome1: 1000,
      outcome2: 500,
      baseCost: 100,
      taxRate: 0.08,
    };

    const result = toComputeNode(testNode, variables);

    expect(result.data.value).toEqual(800); // (0.6 * 1000) + (0.4 * 500)
    expect(result.data.cost).toEqual(108); // 100 * 1.08
  });

  test("should handle boolean operations in expressions", () => {
    const testNode = {
      ...appNode,
      type: "decision" as const,
      data: {
        value: 0,
        cost: 0,
        valueExpr: "condition ? trueValue : falseValue",
        costExpr: "urgent ? rushCost : normalCost",
      },
    };

    const variables = {
      condition: 1, // truthy
      trueValue: 500,
      falseValue: 300,
      urgent: 0, // falsy
      rushCost: 200,
      normalCost: 100,
    };

    const result = toComputeNode(testNode, variables);

    expect(result.data.value).toEqual(500); // condition is truthy
    expect(result.data.cost).toEqual(100); // urgent is falsy
  });

  test("should fallback to null when expression fails", () => {
    const testNode = {
      ...appNode,
      data: {
        valueExpr: "undefinedVariable * 10", // This will fail
        costExpr: "10 / 0", // This might fail depending on expr-eval behavior
      },
    };

    // Mock console.warn to suppress error output during test
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const result = toComputeNode(testNode);

    expect(result.data.value).toEqual(null); // Should fallback to null
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("should handle empty string expressions", () => {
    const testNode = {
      ...appNode,
      data: {
        valueExpr: "",
        costExpr: "",
      },
    };

    const result = toComputeNode(testNode);

    expect(result.data.value).toEqual(null); // Empty expressions should return null
    expect(result.data.cost).toEqual(null);
  });
});

import { AppNode, DecisionTree } from "@/hooks/use-store";
import demoTreeData from "@/utils/demo-sexual-tree.json";

/**
 * Ensures a real, complex decision tree with multiple nodes and edges, values
 * and cost still works with the computation engine.
 */
describe("snapshot test", () => {
  test("should compute values for demo tree data without errors", () => {
    const tree = demoTreeData as unknown as DecisionTree;
    const computeNodes = mapValues(tree.nodes, (node) => toComputeNode(node));
    const computeEdges = mapValues(tree.edges, (edge) => toComputeEdge(edge));
    const { nodes, edges } = computeNodeValues(computeNodes, computeEdges);

    // Just verify that computation doesn't crash and produces some results
    expect(Object.keys(nodes).length).toBeGreaterThan(0);
    expect(Object.keys(edges).length).toBeGreaterThan(0);
  });
});
