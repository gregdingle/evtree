/// <reference types="jest" />
import { values } from "es-toolkit/compat";

import { createEdge } from "../lib/edge";
import { AppNode } from "../lib/node";
import { DecisionTree } from "../lib/tree";
import { useStore } from "./use-store";

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
    useStore.setState({ trees: { tree }, currentTreeId: "tree" });
  });

  test("attaches copied incoming branches while preserving the target and its subtree", () => {
    useStore.getState().copy();
    useStore.getState().paste(undefined, "target");

    const tree = useStore.getState().trees["tree"]!;
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
    useStore.getState().copy();
    useStore.getState().onNodesChange([
      { id: "first", type: "select", selected: false },
      { id: "second", type: "select", selected: false },
      { id: "child", type: "select", selected: false },
      { id: "target", type: "select", selected: true },
    ]);
    useStore.getState().paste();

    const tree = useStore.getState().trees["tree"]!;
    expect(tree.nodes["target"]).toBeDefined();
    expect(
      values(tree.edges).filter((edge) => edge.source === "target"),
    ).toHaveLength(3);
  });

  test("keeps attached branches hidden under a collapsed target", () => {
    useStore.getState().copy();
    useStore.getState().toggleNodeCollapse("target");
    useStore.getState().paste(undefined, "target");

    let tree = useStore.getState().trees["tree"]!;
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

    useStore.getState().toggleNodeCollapse("target");
    tree = useStore.getState().trees["tree"]!;
    expect(pastedNodes.every((item) => !tree.nodes[item.id]!.hidden)).toBe(
      true,
    );
  });

  test("does not attach branches to a terminal node", () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
    useStore.getState().copy();
    const before = useStore.getState().trees["tree"];
    useStore.getState().paste(undefined, "terminal");
    expect(warning).toHaveBeenCalled();
    expect(useStore.getState().trees["tree"]).toEqual(before);
    warning.mockRestore();
  });

  test("does not replace a node when the clipboard has no nodes", () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
    useStore.setState({ clipboard: { nodes: [], edges: [first] } });
    const before = useStore.getState().trees["tree"];
    useStore.getState().paste(undefined, "target");
    expect(warning).toHaveBeenCalled();
    expect(useStore.getState().trees["tree"]).toEqual(before);
    warning.mockRestore();
  });

  test("does nothing when pasting a copy of a node onto itself", () => {
    useStore.getState().selectSubtree("first");
    useStore.getState().copy();
    const before = useStore.getState().trees["tree"];
    useStore.getState().paste(undefined, "first");
    expect(useStore.getState().trees["tree"]).toEqual(before);

    // Also with the copied node still selected and no explicit target
    useStore.getState().selectSubtree("second");
    useStore.getState().copy();
    const beforeSelected = useStore.getState().trees["tree"];
    useStore.getState().paste();
    expect(useStore.getState().trees["tree"]).toEqual(beforeSelected);
  });

  test("uses the real root of the paste when it was copied after its children", () => {
    // insertNodeBefore adds the new parent after its children in tree order
    useStore.getState().insertNodeBefore("first", "decision");
    const inserted = values(useStore.getState().trees["tree"]!.nodes).find(
      (item) => item.type === "decision" && item.id !== "target",
    )!;
    useStore.getState().selectSubtree(inserted.id);
    useStore.getState().copy();
    expect(useStore.getState().clipboard!.nodes.at(-1)!.id).toBe(inserted.id);

    // Pasting onto the real root is a no-op
    const before = useStore.getState().trees["tree"];
    useStore.getState().paste(undefined, inserted.id);
    expect(useStore.getState().trees["tree"]).toEqual(before);

    // Replacing a node connects its incoming edge to the copy of the root
    useStore.getState().paste(undefined, "target");
    const tree = useStore.getState().trees["tree"]!;
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
    useStore.getState().selectSubtree("first");
    useStore.getState().copy();
    useStore.getState().paste(undefined, "child");

    const tree = useStore.getState().trees["tree"]!;
    expect(tree.nodes["child"]).toBeUndefined();
    expect(
      values(tree.nodes).filter((item) => item.data.description === "first"),
    ).toHaveLength(2);
  });

  test("still replaces a target when the copied subtree has no incoming branch", () => {
    useStore.getState().selectSubtree("first");
    useStore.getState().copy();
    useStore.getState().paste(undefined, "target");

    const tree = useStore.getState().trees["tree"]!;
    expect(tree.nodes["target"]).toBeUndefined();
    expect(tree.nodes["existing"]).toBeUndefined();
    expect(
      values(tree.nodes).filter((item) => item.data.description === "first"),
    ).toHaveLength(2);
  });
});
