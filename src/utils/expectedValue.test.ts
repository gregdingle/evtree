import { keyBy } from "es-toolkit";
import { ComputeEdge, ComputeNode, computeNodeValues } from "./expectedValue";

describe("computeNodeValues", () => {
  test("should copy values for a simple sequence of 1.0 probabilities", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: undefined } },
      { id: "2", data: { value: undefined } },
      { id: "3", data: { value: 30 } },
    ];
    const edges: ComputeEdge[] = [
      { id: "e1", source: "1", target: "2", data: { probability: 1.0 } },
      { id: "e2", source: "2", target: "3", data: { probability: 1.0 } },
    ];

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id)
    );

    expect(nodes[0].data.value).toEqual(30);
    expect(nodes[1].data.value).toEqual(30);
    expect(nodes[2].data.value).toEqual(30);
  });

  test("should weight values for a simple sequence", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: undefined } },
      { id: "2", data: { value: undefined } },
      { id: "3", data: { value: 40 } },
    ];
    const edges: ComputeEdge[] = [
      { id: "e1", source: "1", target: "2", data: { probability: 0.5 } },
      { id: "e2", source: "2", target: "3", data: { probability: 0.5 } },
    ];

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id)
    );

    expect(nodes[0].data.value).toEqual(10);
    expect(nodes[1].data.value).toEqual(20);
    expect(nodes[2].data.value).toEqual(40);
  });

  test("should compute expected value for a simple decision tree", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: undefined } }, // Root decision node
      { id: "2a", data: { value: 100 } }, // Outcome A
      { id: "2b", data: { value: 50 } }, // Outcome B
      { id: "2c", data: { value: 0 } }, // Outcome C
    ];
    const edges: ComputeEdge[] = [
      { id: "e1", source: "1", target: "2a", data: { probability: 0.5 } },
      { id: "e2", source: "1", target: "2b", data: { probability: 0.3 } },
      { id: "e3", source: "1", target: "2c", data: { probability: 0.2 } },
    ];

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id)
    );

    // Expected value = (100 * 0.5) + (50 * 0.3) + (0 * 0.2) = 50 + 15 + 0 = 65
    expect(nodes[0].data.value).toEqual(65);
    expect(nodes[1].data.value).toEqual(100);
    expect(nodes[2].data.value).toEqual(50);
    expect(nodes[3].data.value).toEqual(0);
  });

  test("should handle all undefined values gracefully", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: undefined } },
      { id: "2", data: { value: undefined } },
      { id: "3", data: { value: undefined } },
    ];
    const edges: ComputeEdge[] = [
      { id: "e1", source: "1", target: "2", data: { probability: 1.0 } },
      { id: "e2", source: "2", target: "3", data: { probability: 1.0 } },
    ];

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id)
    );

    // When terminal node has undefined value, all parent nodes remain undefined
    expect(nodes[0].data.value).toBeUndefined();
    expect(nodes[1].data.value).toBeUndefined();
    expect(nodes[2].data.value).toBeUndefined(); // Terminal node remains undefined
  });

  test("should handle negative values correctly", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: undefined } }, // Root decision node
      { id: "2a", data: { value: -50 } }, // Negative outcome A
      { id: "2b", data: { value: 100 } }, // Positive outcome B
    ];
    const edges: ComputeEdge[] = [
      { id: "e1", source: "1", target: "2a", data: { probability: 0.4 } },
      { id: "e2", source: "1", target: "2b", data: { probability: 0.6 } },
    ];

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id)
    );

    // Expected value = (-50 * 0.4) + (100 * 0.6) = -20 + 60 = 40
    expect(nodes[0].data.value).toEqual(40);
    expect(nodes[1].data.value).toEqual(-50);
    expect(nodes[2].data.value).toEqual(100);
  });

  test("should ignore undefined children and compute from defined ones", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: undefined } }, // Root decision node
      { id: "2a", data: { value: 100 } }, // Defined outcome A
      { id: "2b", data: { value: undefined } }, // Undefined outcome B
    ];
    const edges: ComputeEdge[] = [
      { id: "e1", source: "1", target: "2a", data: { probability: 0.6 } },
      { id: "e2", source: "1", target: "2b", data: { probability: 0.4 } },
    ];

    computeNodeValues(
      keyBy(nodes, (node) => node.id),
      keyBy(edges, (edge) => edge.id)
    );

    // Root should get value from defined child only: 100 * 0.6 = 60
    expect(nodes[0].data.value).toEqual(60);
    expect(nodes[1].data.value).toEqual(100);
    expect(nodes[2].data.value).toBeUndefined();
  });

  test("should handle multiple root nodes correctly", () => {
    const nodes: ComputeNode[] = [
      { id: "root1", data: { value: undefined } }, // First root
      { id: "child1a", data: { value: 80 } }, // Child of root1
      { id: "child1b", data: { value: 20 } }, // Child of root1
      { id: "root2", data: { value: undefined } }, // Second root
      { id: "child2", data: { value: 150 } }, // Child of root2
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
      keyBy(edges, (edge) => edge.id)
    );

    // First tree: (80 * 0.7) + (20 * 0.3) = 56 + 6 = 62
    expect(nodes[0].data.value).toEqual(62);
    expect(nodes[1].data.value).toEqual(80);
    expect(nodes[2].data.value).toEqual(20);

    // Second tree: 150 * 1.0 = 150
    expect(nodes[3].data.value).toEqual(150);
    expect(nodes[4].data.value).toEqual(150);
  });

  test("should handle zero root nodes gracefully", () => {
    const nodes: ComputeNode[] = [
      { id: "1", data: { value: undefined } },
      { id: "2", data: { value: undefined } },
      { id: "3", data: { value: 30 } },
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
      keyBy(edges, (edge) => edge.id)
    );

    // Should warn about no root nodes and leave all values unchanged
    expect(consoleSpy).toHaveBeenCalledWith(
      "[EVTree] No root nodes found, cannot compute values."
    );
    expect(nodes[0].data.value).toBeUndefined();
    expect(nodes[1].data.value).toBeUndefined();
    expect(nodes[2].data.value).toEqual(30); // Original value preserved

    consoleSpy.mockRestore();
  });
});
