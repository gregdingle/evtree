/// <reference types="jest" />
import { values } from "es-toolkit/compat";

import { createEdge } from "../lib/edge";
import { AppNode } from "../lib/node";
import { DecisionTree } from "../lib/tree";
import {
  pauseTreeHistory,
  redoTree,
  resumeTreeHistory,
  undoTree,
  useTreeStore,
} from "./use-tree-store";

jest.mock("nanoid", () => {
  let nextId = 0;
  return { nanoid: () => `copied-${++nextId}` };
});

describe("paste", () => {
  const node = (
    id: string,
    type: AppNode["type"],
    x: number,
    y: number,
    selected = false,
  ): AppNode => ({
    id,
    type,
    position: { x, y },
    data: { description: id },
    selected,
  });

  const first = createEdge("source", "first", true, {
    label: "first branch",
    probabilityExpr: "0.3",
  });
  const second = createEdge("source", "second", true, {
    label: "second branch",
    probabilityExpr: "0.7",
  });
  const child = createEdge("first", "child", true, { label: "child branch" });
  const existing = createEdge("target", "existing", false);
  const parent = createEdge("parent", "target", false);

  beforeEach(() => {
    const tree: DecisionTree = {
      id: "tree",
      name: "Tree",
      createdAt: "2026-01-01",
      nodes: {
        source: node("source", "chance", 0, 0),
        first: node("first", "chance", 216, 0, true),
        second: node("second", "terminal", 216, 150, true),
        child: node("child", "terminal", 432, 0, true),
        parent: node("parent", "chance", 584, 0),
        target: node("target", "decision", 800, 0),
        existing: node("existing", "terminal", 1016, 0),
        terminal: node("terminal", "terminal", 800, 500),
      },
      edges: {
        [first.id]: first,
        [second.id]: second,
        [child.id]: child,
        [existing.id]: existing,
        [parent.id]: parent,
      },
    };
    useTreeStore.setState({ trees: { tree }, currentTreeId: "tree" });
  });

  test("attaches copied incoming branches while preserving the target and its subtree", () => {
    useTreeStore.getState().copy();
    useTreeStore.getState().paste(undefined, "target");

    const tree = useTreeStore.getState().trees["tree"]!;
    expect(tree.nodes["target"]).toBeDefined();
    expect(tree.nodes["existing"]).toBeDefined();
    expect(tree.edges[existing.id]).toBeDefined();
    expect(tree.edges[parent.id]).toBeDefined();

    const pastedFirst = values(tree.nodes).find(
      (item) => item.id !== "first" && item.data.description === "first",
    )!;
    const pastedSecond = values(tree.nodes).find(
      (item) => item.id !== "second" && item.data.description === "second",
    )!;
    const pastedChild = values(tree.nodes).find(
      (item) => item.id !== "child" && item.data.description === "child",
    )!;
    const pastedEdges = values(tree.edges);
    expect(pastedEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "target",
          target: pastedFirst.id,
          data: first.data,
        }),
        expect.objectContaining({
          source: "target",
          target: pastedSecond.id,
          data: second.data,
        }),
        expect.objectContaining({
          source: pastedFirst.id,
          target: pastedChild.id,
          data: child.data,
        }),
      ]),
    );
    expect(pastedFirst.position.x).toBeGreaterThan(
      tree.nodes["target"]!.position.x,
    );
    expect(pastedFirst.position.y).toBeGreaterThan(
      tree.nodes["existing"]!.position.y,
    );
    expect(pastedSecond.position.y - pastedFirst.position.y).toBe(150);
  });

  test("attaches to the selected node when pasting with the keyboard", () => {
    useTreeStore.getState().copy();
    useTreeStore.getState().onNodesChange([
      { id: "first", type: "select", selected: false },
      { id: "second", type: "select", selected: false },
      { id: "child", type: "select", selected: false },
      { id: "target", type: "select", selected: true },
    ]);
    useTreeStore.getState().paste();

    const tree = useTreeStore.getState().trees["tree"]!;
    expect(tree.nodes["target"]).toBeDefined();
    expect(
      values(tree.edges).filter((edge) => edge.source === "target"),
    ).toHaveLength(3);
  });

  test("keeps attached branches hidden under a collapsed target", () => {
    useTreeStore.getState().copy();
    useTreeStore.getState().toggleNodeCollapse("target");
    useTreeStore.getState().paste(undefined, "target");

    let tree = useTreeStore.getState().trees["tree"]!;
    const pastedNodes = values(tree.nodes).filter((item) =>
      item.id.startsWith("copied-"),
    );
    const pastedEdges = values(tree.edges).filter((edge) =>
      pastedNodes.some((item) => item.id === edge.target),
    );
    expect(pastedNodes).toHaveLength(3);
    expect(pastedEdges).toHaveLength(3);
    expect(pastedNodes.every((item) => item.hidden && !item.selected)).toBe(
      true,
    );
    expect(pastedEdges.every((edge) => edge.hidden && !edge.selected)).toBe(
      true,
    );

    useTreeStore.getState().toggleNodeCollapse("target");
    tree = useTreeStore.getState().trees["tree"]!;
    expect(pastedNodes.every((item) => !tree.nodes[item.id]!.hidden)).toBe(
      true,
    );
  });

  test("does not attach branches to a terminal node", () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
    useTreeStore.getState().copy();
    const before = useTreeStore.getState().trees["tree"];
    useTreeStore.getState().paste(undefined, "terminal");
    expect(warning).toHaveBeenCalled();
    expect(useTreeStore.getState().trees["tree"]).toEqual(before);
    warning.mockRestore();
  });

  test("does not replace a node when the clipboard has no nodes", () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
    useTreeStore.setState({ clipboard: { nodes: [], edges: [first] } });
    const before = useTreeStore.getState().trees["tree"];
    useTreeStore.getState().paste(undefined, "target");
    expect(warning).toHaveBeenCalled();
    expect(useTreeStore.getState().trees["tree"]).toEqual(before);
    warning.mockRestore();
  });

  test("does nothing when pasting a copy of a node onto itself", () => {
    useTreeStore.getState().selectSubtree("first");
    useTreeStore.getState().copy();
    const before = useTreeStore.getState().trees["tree"];
    useTreeStore.getState().paste(undefined, "first");
    expect(useTreeStore.getState().trees["tree"]).toEqual(before);

    // Also with the copied node still selected and no explicit target
    useTreeStore.getState().selectSubtree("second");
    useTreeStore.getState().copy();
    const beforeSelected = useTreeStore.getState().trees["tree"];
    useTreeStore.getState().paste();
    expect(useTreeStore.getState().trees["tree"]).toEqual(beforeSelected);
  });

  test("uses the real root of the paste when it was copied after its children", () => {
    // insertNodeBefore adds the new parent after its children in tree order
    useTreeStore.getState().insertNodeBefore("first", "decision");
    const inserted = values(useTreeStore.getState().trees["tree"]!.nodes).find(
      (item) => item.type === "decision" && item.id !== "target",
    )!;
    useTreeStore.getState().selectSubtree(inserted.id);
    useTreeStore.getState().copy();
    expect(useTreeStore.getState().clipboard!.nodes.at(-1)!.id).toBe(
      inserted.id,
    );

    // Pasting onto the real root is a no-op
    const before = useTreeStore.getState().trees["tree"];
    useTreeStore.getState().paste(undefined, inserted.id);
    expect(useTreeStore.getState().trees["tree"]).toEqual(before);

    // Replacing a node connects its incoming edge to the copy of the root
    useTreeStore.getState().paste(undefined, "target");
    const tree = useTreeStore.getState().trees["tree"]!;
    const fromParent = values(tree.edges).filter(
      (edge) => edge.source === "parent",
    );
    expect(fromParent).toHaveLength(1);
    const pastedRoot = tree.nodes[fromParent[0]!.target]!;
    expect(pastedRoot.type).toBe("decision");
    expect(pastedRoot.id).not.toBe(inserted.id);
    // No node has more than one incoming edge
    const incomingCounts = new Map<string, number>();
    values(tree.edges).forEach((edge) =>
      incomingCounts.set(
        edge.target,
        (incomingCounts.get(edge.target) ?? 0) + 1,
      ),
    );
    expect(Math.max(...incomingCounts.values())).toBe(1);
  });

  test("still pastes onto a non-root node of the copied subtree", () => {
    useTreeStore.getState().selectSubtree("first");
    useTreeStore.getState().copy();
    useTreeStore.getState().paste(undefined, "child");

    const tree = useTreeStore.getState().trees["tree"]!;
    expect(tree.nodes["child"]).toBeUndefined();
    expect(
      values(tree.nodes).filter((item) => item.data.description === "first"),
    ).toHaveLength(2);
  });

  test("still replaces a target when the copied subtree has no incoming branch", () => {
    useTreeStore.getState().selectSubtree("first");
    useTreeStore.getState().copy();
    useTreeStore.getState().paste(undefined, "target");

    const tree = useTreeStore.getState().trees["tree"]!;
    expect(tree.nodes["target"]).toBeUndefined();
    expect(tree.nodes["existing"]).toBeUndefined();
    expect(
      values(tree.nodes).filter((item) => item.data.description === "first"),
    ).toHaveLength(2);
  });
});

describe("selectNode", () => {
  test("should select only the node", () => {
    const { currentTreeId, trees } = useTreeStore.getState();
    const tree = trees[currentTreeId!]!;
    const [first, second] = Object.keys(tree.nodes);
    useTreeStore.setState({
      trees: {
        ...trees,
        [tree.id]: {
          ...tree,
          nodes: {
            ...tree.nodes,
            [first!]: { ...tree.nodes[first!]!, selected: true },
          },
        },
      },
    });

    useTreeStore.getState().selectNode(second!);

    const state = useTreeStore.getState();
    const selected = values(state.trees[tree.id]!.nodes)
      .filter((node) => node.selected)
      .map((node) => node.id);
    expect(selected).toEqual([second]);
  });
});

describe("selectEdge", () => {
  test("should select only the edge", () => {
    const { currentTreeId, trees } = useTreeStore.getState();
    const tree = trees[currentTreeId!]!;
    const [nodeId] = Object.keys(tree.nodes);
    const [edgeId] = Object.keys(tree.edges);
    useTreeStore.getState().selectNode(nodeId!);

    useTreeStore.getState().selectEdge(edgeId!);

    const state = useTreeStore.getState().trees[tree.id]!;
    expect(values(state.nodes).filter((node) => node.selected)).toEqual([]);
    expect(
      values(state.edges)
        .filter((edge) => edge.selected)
        .map((edge) => edge.id),
    ).toEqual([edgeId]);
  });
});

describe("loadTree", () => {
  test("should show the canvas in place of the issues view", () => {
    const { currentTreeId, trees } = useTreeStore.getState();
    const tree = trees[currentTreeId!]!;
    useTreeStore.getState().showIssues();
    expect(useTreeStore.getState().display.showIssues).toBe(true);

    useTreeStore.getState().loadTree(tree, false);

    const state = useTreeStore.getState();
    expect(state.currentTreeId).not.toBe(tree.id);
    expect(state.display.showIssues).toBe(false);
    expect(state.display.showHistogram).toBe(false);
  });
});

describe("undo history", () => {
  const getPastCount = () => useTreeStore.temporal.getState().pastStates.length;
  const getName = () => {
    const { trees, currentTreeId } = useTreeStore.getState();
    return trees[currentTreeId!]!.name;
  };
  const setName = (name: string) =>
    useTreeStore.getState().updateTreeData({ name });

  beforeEach(() => {
    resumeTreeHistory();
    setName("Start");
    useTreeStore.temporal.getState().clear();
  });

  test("should make every update an undo step, however close together", () => {
    setName("A");
    setName("B");
    setName("C");
    expect(getPastCount()).toBe(3);
    undoTree();
    expect(getName()).toBe("B");
    undoTree();
    undoTree();
    expect(getName()).toBe("Start");
  });

  test("should make what happens while the history is held one undo step", () => {
    setName("Before");
    pauseTreeHistory();
    setName("T");
    setName("Ty");
    setName("Typed");
    expect(getPastCount()).toBe(1);
    expect(resumeTreeHistory()).toBe(true);
    expect(getPastCount()).toBe(2);

    undoTree();
    expect(getName()).toBe("Before");
    redoTree();
    expect(getName()).toBe("Typed");
  });

  test("should add no undo step when nothing changed while held", () => {
    pauseTreeHistory();
    setName("Other");
    setName("Start");
    resumeTreeHistory();
    expect(getPastCount()).toBe(0);
  });

  test("should take holding twice, and resuming without a hold", () => {
    expect(resumeTreeHistory()).toBe(false);
    pauseTreeHistory();
    setName("A");
    pauseTreeHistory();
    setName("B");
    resumeTreeHistory();
    expect(resumeTreeHistory()).toBe(false);
    expect(getPastCount()).toBe(1);
    undoTree();
    expect(getName()).toBe("Start");
  });

  test("should undo what was done while held, when undo comes before the resume", () => {
    setName("Before");
    pauseTreeHistory();
    setName("Typed");
    undoTree();
    expect(getName()).toBe("Before");
    // And updates are steps again
    setName("After");
    undoTree();
    expect(getName()).toBe("Before");
  });
});
