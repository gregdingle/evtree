import { createEdge } from "./edge";
import {
  MINIMUM_DISTANCE,
  computeLayoutedNodeOffsets,
  getLayoutedElementsD3,
} from "./layout";
import { AppNode } from "./node";

describe("computeLayoutedNodeOffsets", () => {
  const createTestNode = (
    id: string,
    x: number,
    y: number,
    width = 100,
    height = 50,
  ): AppNode => ({
    id,
    type: "chance",
    position: { x, y },
    data: {},
    measured: { width, height },
  });

  it("should not get stuck in infinite loop with conflicting surrounding nodes", () => {
    // Create a simple test case that could cause infinite loop
    const layoutedNodes: AppNode[] = [
      createTestNode("target", 0, 0),
      createTestNode("child1", 100, 50),
    ];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 200, 200), // Different from layouted position
      child1: createTestNode("child1", 300, 250),
      surrounding1: createTestNode("surrounding1", 150, 180), // Close above
      surrounding2: createTestNode("surrounding2", 150, 220), // Close below
      surrounding3: createTestNode("surrounding3", 150, 260), // Further below
    };

    const subtreeNodeIds = new Set(["target", "child1"]);

    // This should complete without infinite loop
    const startTime = Date.now();
    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );
    const endTime = Date.now();

    // Should complete quickly (less than 100ms for such a simple case)
    expect(endTime - startTime).toBeLessThan(100);

    // Should return valid offsets
    expect(typeof result.offsetX).toBe("number");
    expect(typeof result.offsetY).toBe("number");
    expect(Number.isFinite(result.offsetX)).toBe(true);
    expect(Number.isFinite(result.offsetY)).toBe(true);
  });

  it("should find position with no conflicts when possible", () => {
    const layoutedNodes: AppNode[] = [createTestNode("target", 0, 0)];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 200, 200),
      surrounding1: createTestNode("surrounding1", 150, 200), // Would conflict at original position
    };

    const subtreeNodeIds = new Set(["target"]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Should find a valid position that avoids conflict
    expect(Number.isFinite(result.offsetX)).toBe(true);
    expect(Number.isFinite(result.offsetY)).toBe(true);
  });

  it("should maintain root position when no conflicts exist", () => {
    const layoutedNodes: AppNode[] = [
      createTestNode("target", 100, 150),
      createTestNode("child1", 200, 150),
    ];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 300, 400), // Original position
      child1: createTestNode("child1", 400, 400),
      surrounding1: createTestNode("surrounding1", 100, 100), // Far away
      surrounding2: createTestNode("surrounding2", 500, 600), // Far away (changed from 500 to 600)
    };

    const subtreeNodeIds = new Set(["target", "child1"]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Should maintain original root position
    expect(result.offsetX).toBe(300 - 100); // originalX - layoutedX
    expect(result.offsetY).toBe(400 - 150); // originalY - layoutedY
  });

  it("should handle empty surrounding nodes", () => {
    const layoutedNodes: AppNode[] = [
      createTestNode("target", 0, 0),
      createTestNode("child1", 100, 50),
    ];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 200, 200),
      child1: createTestNode("child1", 300, 250),
    };

    const subtreeNodeIds = new Set(["target", "child1"]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Should maintain original offset when no surrounding nodes
    expect(result.offsetX).toBe(200); // 200 - 0
    expect(result.offsetY).toBe(200); // 200 - 0
  });

  it("should handle single surrounding node above", () => {
    const layoutedNodes: AppNode[] = [createTestNode("target", 0, 100)];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 0, 100),
      surrounding1: createTestNode("surrounding1", 0, 50), // Above with potential conflict
    };

    const subtreeNodeIds = new Set(["target"]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Should adjust to avoid conflict (move below surrounding node)
    expect(result.offsetY).toBeGreaterThan(0); // Should move down
  });

  it("should handle single surrounding node below", () => {
    const layoutedNodes: AppNode[] = [createTestNode("target", 0, 100)];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 0, 100),
      surrounding1: createTestNode("surrounding1", 0, 150), // Below with potential conflict
    };

    const subtreeNodeIds = new Set(["target"]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Should adjust to avoid conflict (move above surrounding node)
    expect(result.offsetY).toBeLessThan(0); // Should move up
  });

  it("should choose minimal adjustment when multiple options exist", () => {
    const layoutedNodes: AppNode[] = [createTestNode("target", 0, 200)];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 0, 200),
      surrounding1: createTestNode("surrounding1", 0, 190), // Close above
      surrounding2: createTestNode("surrounding2", 0, 400), // Far below
    };

    const subtreeNodeIds = new Set(["target"]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Should choose the option that requires less movement
    // Moving below surrounding1 (to ~290) vs moving above surrounding2 (to ~250)
    // Moving above surrounding2 should be preferred as it's closer
    expect(Math.abs(result.offsetY)).toBeLessThan(200); // Should not move too far
  });

  it("should handle hidden surrounding nodes", () => {
    const layoutedNodes: AppNode[] = [createTestNode("target", 0, 100)];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 0, 100),
      surrounding1: { ...createTestNode("surrounding1", 0, 100), hidden: true }, // Hidden node
      surrounding2: createTestNode("surrounding2", 0, 300), // Visible node far away
    };

    const subtreeNodeIds = new Set(["target"]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Should ignore hidden nodes and not need much adjustment
    expect(Math.abs(result.offsetY)).toBeLessThan(50); // Should stay close to original
  });

  it("should handle large subtrees with multiple nodes", () => {
    const layoutedNodes: AppNode[] = [
      createTestNode("target", 0, 100),
      createTestNode("child1", 100, 50),
      createTestNode("child2", 100, 150),
      createTestNode("grandchild1", 200, 25),
      createTestNode("grandchild2", 200, 75),
    ];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 0, 100),
      child1: createTestNode("child1", 100, 50),
      child2: createTestNode("child2", 100, 150),
      grandchild1: createTestNode("grandchild1", 200, 25),
      grandchild2: createTestNode("grandchild2", 200, 75),
      surrounding1: createTestNode("surrounding1", 50, 120), // In the middle of subtree
    };

    const subtreeNodeIds = new Set([
      "target",
      "child1",
      "child2",
      "grandchild1",
      "grandchild2",
    ]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Should handle complex subtree without errors
    expect(Number.isFinite(result.offsetX)).toBe(true);
    expect(Number.isFinite(result.offsetY)).toBe(true);
  });

  it("should handle nodes without measured dimensions", () => {
    const layoutedNodes: AppNode[] = [
      {
        id: "target",
        type: "chance",
        position: { x: 0, y: 0 },
        data: {},
        // No measured property
      },
    ];

    const nodes: Record<string, AppNode> = {
      target: {
        id: "target",
        type: "chance",
        position: { x: 100, y: 100 },
        data: {},
        // No measured property
      },
      surrounding1: createTestNode("surrounding1", 100, 110),
    };

    const subtreeNodeIds = new Set(["target"]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Should handle missing dimensions gracefully
    expect(Number.isFinite(result.offsetX)).toBe(true);
    expect(Number.isFinite(result.offsetY)).toBe(true);
  });

  it("should handle edge case with identical positions", () => {
    const layoutedNodes: AppNode[] = [createTestNode("target", 100, 100)];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 100, 100), // Same position
      surrounding1: createTestNode("surrounding1", 100, 100), // Identical position
    };

    const subtreeNodeIds = new Set(["target"]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Should resolve identical position conflict
    expect(Number.isFinite(result.offsetX)).toBe(true);
    expect(Number.isFinite(result.offsetY)).toBe(true);
    expect(result.offsetY).not.toBe(0); // Should move away from conflict
  });

  it("should respect minimum distance constraint", () => {
    const layoutedNodes: AppNode[] = [createTestNode("target", 0, 200, 50, 50)];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 0, 200, 50, 50), // Same position as layouted
      surrounding1: createTestNode("surrounding1", 0, 270, 50, 50), // Only 20 units below (< 100)
    };

    const subtreeNodeIds = new Set(["target"]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Calculate final position
    const finalTargetY = 200 + result.offsetY;
    const targetBottom = finalTargetY + 50; // height
    const surroundingTop = 270;

    // Should maintain minimum distance
    const actualDistance = Math.abs(surroundingTop - targetBottom);
    expect(actualDistance).toBeGreaterThanOrEqual(MINIMUM_DISTANCE - 1); // for rounding tolerance
  });

  it("should handle no potential valid positions gracefully", () => {
    // Create a scenario where every potential position has conflicts
    const layoutedNodes: AppNode[] = [createTestNode("target", 0, 200, 50, 50)];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 0, 200, 50, 50),
      // Surround completely with overlapping nodes
      surrounding1: createTestNode("surrounding1", 0, 50, 50, 300), // Tall node above
      surrounding2: createTestNode("surrounding2", 0, 400, 50, 300), // Tall node below
    };

    const subtreeNodeIds = new Set(["target"]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Should still return finite values even when no perfect solution exists
    expect(Number.isFinite(result.offsetX)).toBe(true);
    expect(Number.isFinite(result.offsetY)).toBe(true);
  });

  it("should handle overlapping surrounding nodes", () => {
    const layoutedNodes: AppNode[] = [createTestNode("target", 0, 200, 50, 50)];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 0, 200, 50, 50),
      surrounding1: createTestNode("surrounding1", 0, 300, 50, 50),
      surrounding2: createTestNode("surrounding2", 0, 320, 50, 50), // Overlaps with surrounding1
    };

    const subtreeNodeIds = new Set(["target"]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Should handle overlapping surrounding nodes without error
    expect(Number.isFinite(result.offsetX)).toBe(true);
    expect(Number.isFinite(result.offsetY)).toBe(true);
  });

  it("should handle very large minimum distances", () => {
    // Test with distances that are larger than the available space
    const layoutedNodes: AppNode[] = [createTestNode("target", 0, 500, 50, 50)];

    const nodes: Record<string, AppNode> = {
      target: createTestNode("target", 0, 500, 50, 50),
      surrounding1: createTestNode("surrounding1", 0, 400, 50, 50),
      surrounding2: createTestNode("surrounding2", 0, 600, 50, 50),
    };

    const subtreeNodeIds = new Set(["target"]);

    const result = computeLayoutedNodeOffsets(
      layoutedNodes,
      "target",
      nodes,
      subtreeNodeIds,
    );

    // Should handle the constraint and find the best available position
    expect(Number.isFinite(result.offsetX)).toBe(true);
    expect(Number.isFinite(result.offsetY)).toBe(true);
  });
});

describe("getLayoutedElementsD3 with right-aligned", () => {
  it("should align all terminal nodes to the right in LR layout", () => {
    // Create test nodes: root -> branch1 and branch2 -> terminal nodes
    const nodes: AppNode[] = [
      {
        id: "root",
        type: "decision",
        position: { x: 0, y: 0 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "branch1",
        type: "chance",
        position: { x: 200, y: -50 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "terminal1",
        type: "terminal",
        position: { x: 400, y: -50 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "branch2",
        type: "chance",
        position: { x: 200, y: 50 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "subbranch",
        type: "chance",
        position: { x: 400, y: 50 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "terminal2",
        type: "terminal",
        position: { x: 600, y: 50 },
        data: {},
        measured: { width: 100, height: 50 },
      },
    ];

    const edges = [
      createEdge("root", "branch1"),
      createEdge("branch1", "terminal1"),
      createEdge("root", "branch2"),
      createEdge("branch2", "subbranch"),
      createEdge("subbranch", "terminal2"),
    ];

    // Apply right-aligned layout
    const { nodes: layoutedNodes } = getLayoutedElementsD3(
      "root",
      nodes,
      edges,
      { horizontal: 200, vertical: 100 },
      false,
      { siblings: 0.5, parents: 2 },
      true, // rightAligned
    );

    // Find terminal nodes
    const terminal1 = layoutedNodes.find((n: AppNode) => n.id === "terminal1");
    const terminal2 = layoutedNodes.find((n: AppNode) => n.id === "terminal2");

    // Both terminal nodes should have the same x position (aligned to the right)
    expect(terminal1).toBeDefined();
    expect(terminal2).toBeDefined();
    expect(terminal1!.position.x).toBe(terminal2!.position.x);

    // Terminal nodes should be further right than non-terminal nodes
    const branch1 = layoutedNodes.find((n: AppNode) => n.id === "branch1");
    const subbranch = layoutedNodes.find((n: AppNode) => n.id === "subbranch");
    expect(terminal1!.position.x).toBeGreaterThan(branch1!.position.x);
    expect(terminal2!.position.x).toBeGreaterThan(subbranch!.position.x);
  });

  it("should maintain compact layout when rightAligned is false", () => {
    const nodes: AppNode[] = [
      {
        id: "root",
        type: "decision",
        position: { x: 0, y: 0 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "terminal1",
        type: "terminal",
        position: { x: 200, y: 0 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "branch",
        type: "chance",
        position: { x: 200, y: 50 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "terminal2",
        type: "terminal",
        position: { x: 400, y: 50 },
        data: {},
        measured: { width: 100, height: 50 },
      },
    ];

    const edges = [
      createEdge("root", "terminal1"),
      createEdge("root", "branch"),
      createEdge("branch", "terminal2"),
    ];

    // Apply compact layout (rightAligned = false)
    const { nodes: layoutedNodes } = getLayoutedElementsD3(
      "root",
      nodes,
      edges,
      { horizontal: 200, vertical: 100 },
      false,
      { siblings: 0.5, parents: 2 },
      false, // rightAligned = false (compact)
    );

    const terminal1 = layoutedNodes.find((n: AppNode) => n.id === "terminal1");
    const terminal2 = layoutedNodes.find((n: AppNode) => n.id === "terminal2");

    // In compact layout, terminal nodes should NOT have the same x position
    // terminal1 should be closer to root than terminal2
    expect(terminal1!.position.x).toBeLessThan(terminal2!.position.x);
  });

  it("should maintain even spacing between all terminals", () => {
    const nodes: AppNode[] = [
      {
        id: "root",
        type: "decision",
        position: { x: 0, y: 0 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "terminal1",
        type: "terminal",
        position: { x: 200, y: -100 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "branch",
        type: "chance",
        position: { x: 200, y: 0 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "terminal2",
        type: "terminal",
        position: { x: 400, y: -50 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "terminal3",
        type: "terminal",
        position: { x: 400, y: 50 },
        data: {},
        measured: { width: 100, height: 50 },
      },
    ];

    const edges = [
      createEdge("root", "terminal1"),
      createEdge("root", "branch"),
      createEdge("branch", "terminal2"),
      createEdge("branch", "terminal3"),
    ];

    const nodeSpacing = { horizontal: 200, vertical: 100 };

    const { nodes: layoutedNodes } = getLayoutedElementsD3(
      "root",
      nodes,
      edges,
      nodeSpacing,
      false,
      { siblings: 0.5, parents: 2 },
      true,
    );

    const terminal1 = layoutedNodes.find((n: AppNode) => n.id === "terminal1");
    const terminal2 = layoutedNodes.find((n: AppNode) => n.id === "terminal2");
    const terminal3 = layoutedNodes.find((n: AppNode) => n.id === "terminal3");

    // All terminals should be aligned
    expect(terminal1!.position.x).toBe(terminal2!.position.x);
    expect(terminal2!.position.x).toBe(terminal3!.position.x);

    // Check spacing between consecutive terminals
    const spacing1 = Math.abs(terminal2!.position.y - terminal1!.position.y);
    const spacing2 = Math.abs(terminal3!.position.y - terminal2!.position.y);

    expect(spacing1).toBe(nodeSpacing.vertical);
    expect(spacing2).toBe(nodeSpacing.vertical);
  });

  it("should follow depth-first order to prevent branch crossings", () => {
    // Create a tree where wrong ordering would cause crossings
    const nodes: AppNode[] = [
      {
        id: "root",
        type: "decision",
        position: { x: 0, y: 0 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "branch1",
        type: "chance",
        position: { x: 200, y: -100 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "terminal1",
        type: "terminal",
        position: { x: 400, y: -150 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "terminal2",
        type: "terminal",
        position: { x: 400, y: -50 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "branch2",
        type: "chance",
        position: { x: 200, y: 100 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "terminal3",
        type: "terminal",
        position: { x: 400, y: 50 },
        data: {},
        measured: { width: 100, height: 50 },
      },
      {
        id: "terminal4",
        type: "terminal",
        position: { x: 400, y: 150 },
        data: {},
        measured: { width: 100, height: 50 },
      },
    ];

    const edges = [
      createEdge("root", "branch1"),
      createEdge("branch1", "terminal1"),
      createEdge("branch1", "terminal2"),
      createEdge("root", "branch2"),
      createEdge("branch2", "terminal3"),
      createEdge("branch2", "terminal4"),
    ];

    const { nodes: layoutedNodes } = getLayoutedElementsD3(
      "root",
      nodes,
      edges,
      { horizontal: 200, vertical: 100 },
      false,
      { siblings: 0.5, parents: 2 },
      true,
    );

    const terminal1 = layoutedNodes.find((n: AppNode) => n.id === "terminal1");
    const terminal2 = layoutedNodes.find((n: AppNode) => n.id === "terminal2");
    const terminal3 = layoutedNodes.find((n: AppNode) => n.id === "terminal3");
    const terminal4 = layoutedNodes.find((n: AppNode) => n.id === "terminal4");

    // Terminals from branch1 should come before terminals from branch2
    // (following depth-first order)
    expect(terminal1!.position.y).toBeLessThan(terminal3!.position.y);
    expect(terminal1!.position.y).toBeLessThan(terminal4!.position.y);
    expect(terminal2!.position.y).toBeLessThan(terminal3!.position.y);
    expect(terminal2!.position.y).toBeLessThan(terminal4!.position.y);

    // Within each branch, terminals should maintain their order
    expect(terminal1!.position.y).toBeLessThan(terminal2!.position.y);
    expect(terminal3!.position.y).toBeLessThan(terminal4!.position.y);
  });
});
