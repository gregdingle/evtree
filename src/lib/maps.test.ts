import { getRootNodeId, getRootNodeIds } from "./maps";
import { DecisionTree } from "./tree";

// A decision tree a -> b -> c, a second tree d, and a note with an arrow to a
// ghost node
const nodes = {
  a: { id: "a", type: "decision" as const },
  b: { id: "b", type: "chance" as const },
  c: { id: "c", type: "terminal" as const },
  d: { id: "d", type: "terminal" as const },
  note: { id: "note", type: "note" as const },
  ghost: { id: "ghost", type: "ghost" as const },
};
const edges = {
  ab: { id: "ab", source: "a", target: "b" },
  bc: { id: "bc", source: "b", target: "c" },
  arrow: { id: "arrow", source: "note", target: "ghost", type: "arrow" },
};

describe("getRootNodeIds", () => {
  test("should return nodes without incoming tree edges", () => {
    expect(getRootNodeIds(nodes, edges)).toEqual(["a", "d"]);
  });

  test("should accept an array of edges", () => {
    expect(getRootNodeIds(nodes, Object.values(edges))).toEqual(["a", "d"]);
  });

  test("should return no roots for no nodes", () => {
    expect(getRootNodeIds({}, {})).toEqual([]);
  });
});

describe("getRootNodeId", () => {
  const tree = { nodes, edges } as unknown as DecisionTree;

  test("should walk up to the root", () => {
    expect(getRootNodeId(tree, "c")).toEqual("a");
    expect(getRootNodeId(tree, "a")).toEqual("a");
    expect(getRootNodeId(tree, "d")).toEqual("d");
  });

  test("should not walk up arrow edges", () => {
    expect(getRootNodeId(tree, "ghost")).toEqual("ghost");
  });
});
