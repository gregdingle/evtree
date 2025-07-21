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

  // TODO: test case for a simple tree
  // TODO: test case for all undefined
  // TODO: test case for negative values
});
