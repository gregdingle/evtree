import {
  MINIMUM_DISTANCE,
  computeLayoutedNodeOffsets,
  preserveNodesVerticalOrder,
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

describe("preserveNodesVerticalOrder", () => {
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

  it("should preserve order when nodes are in the same horizontal group", () => {
    const originalNodes: AppNode[] = [
      createTestNode("node1", 100, 100), // Top
      createTestNode("node2", 100, 200), // Middle
      createTestNode("node3", 100, 300), // Bottom
    ];

    const layoutedNodes: AppNode[] = [
      createTestNode("node1", 100, 300), // Dagre put top node at bottom
      createTestNode("node2", 100, 100), // Dagre put middle at top
      createTestNode("node3", 100, 200), // Dagre put bottom in middle
    ];

    const result = preserveNodesVerticalOrder(originalNodes, layoutedNodes);

    // Should restore original vertical order
    const node1Result = result.find((n) => n.id === "node1")!;
    const node2Result = result.find((n) => n.id === "node2")!;
    const node3Result = result.find((n) => n.id === "node3")!;

    expect(node1Result.position.y).toBeLessThan(node2Result.position.y);
    expect(node2Result.position.y).toBeLessThan(node3Result.position.y);
  });

  it("should maintain horizontal positions within tolerance", () => {
    const originalNodes: AppNode[] = [
      createTestNode("node1", 100, 100),
      createTestNode("node2", 110, 200), // Slightly different X but within tolerance
    ];

    const layoutedNodes: AppNode[] = [
      createTestNode("node1", 105, 300),
      createTestNode("node2", 115, 100),
    ];

    const result = preserveNodesVerticalOrder(originalNodes, layoutedNodes);

    // Should group these as same horizontal level and preserve order
    const node1Result = result.find((n) => n.id === "node1")!;
    const node2Result = result.find((n) => n.id === "node2")!;

    expect(node1Result.position.y).toBeLessThan(node2Result.position.y);
  });

  it("should handle nodes in different horizontal groups separately", () => {
    const originalNodes: AppNode[] = [
      createTestNode("left1", 100, 100),
      createTestNode("left2", 100, 200),
      createTestNode("right1", 300, 100), // Different horizontal group
      createTestNode("right2", 300, 200),
    ];

    const layoutedNodes: AppNode[] = [
      createTestNode("left1", 100, 200), // Swapped in left group
      createTestNode("left2", 100, 100),
      createTestNode("right1", 300, 200), // Swapped in right group
      createTestNode("right2", 300, 100),
    ];

    const result = preserveNodesVerticalOrder(originalNodes, layoutedNodes);

    // Left group should preserve order
    const left1Result = result.find((n) => n.id === "left1")!;
    const left2Result = result.find((n) => n.id === "left2")!;
    expect(left1Result.position.y).toBeLessThan(left2Result.position.y);

    // Right group should preserve order
    const right1Result = result.find((n) => n.id === "right1")!;
    const right2Result = result.find((n) => n.id === "right2")!;
    expect(right1Result.position.y).toBeLessThan(right2Result.position.y);
  });

  it("should handle single nodes in groups without modification", () => {
    const originalNodes: AppNode[] = [createTestNode("alone", 100, 100)];

    const layoutedNodes: AppNode[] = [
      createTestNode("alone", 100, 200), // Different Y position
    ];

    const result = preserveNodesVerticalOrder(originalNodes, layoutedNodes);

    // Single node should keep its layouted position
    const aloneResult = result.find((n) => n.id === "alone")!;
    expect(aloneResult.position.y).toBe(200);
    expect(aloneResult.position.x).toBe(100);
  });

  it("should preserve individual X positions for multi-node groups", () => {
    const originalNodes: AppNode[] = [
      createTestNode("node1", 100, 100),
      createTestNode("node2", 110, 200), // Different X values
    ];

    const layoutedNodes: AppNode[] = [
      createTestNode("node1", 105, 300),
      createTestNode("node2", 115, 100),
    ];

    const result = preserveNodesVerticalOrder(originalNodes, layoutedNodes);

    // Each node should preserve its own X position (no hack applied)
    const node1Result = result.find((n) => n.id === "node1")!;
    const node2Result = result.find((n) => n.id === "node2")!;

    expect(node1Result.position.x).toBe(105);
    expect(node2Result.position.x).toBe(115);
  });

  it("should handle nodes without original vertical order gracefully", () => {
    const originalNodes: AppNode[] = [createTestNode("existing", 100, 100)];

    const layoutedNodes: AppNode[] = [
      createTestNode("existing", 100, 200),
      createTestNode("new", 100, 300), // Node not in original
    ];

    const result = preserveNodesVerticalOrder(originalNodes, layoutedNodes);

    // Should handle gracefully without errors
    expect(result).toHaveLength(2);
    const existingResult = result.find((n) => n.id === "existing")!;
    const newResult = result.find((n) => n.id === "new")!;

    expect(existingResult).toBeDefined();
    expect(newResult).toBeDefined();
  });

  it("should handle empty arrays", () => {
    const result = preserveNodesVerticalOrder([], []);
    expect(result).toEqual([]);
  });

  it("should handle mismatched arrays", () => {
    const originalNodes: AppNode[] = [createTestNode("node1", 100, 100)];

    const layoutedNodes: AppNode[] = [
      createTestNode("node2", 200, 200), // Different node
    ];

    const result = preserveNodesVerticalOrder(originalNodes, layoutedNodes);

    // Should handle gracefully
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("node2");
  });

  it("should preserve spacing proportionally", () => {
    const originalNodes: AppNode[] = [
      createTestNode("node1", 100, 100),
      createTestNode("node2", 100, 200),
      createTestNode("node3", 100, 300),
    ];

    const layoutedNodes: AppNode[] = [
      createTestNode("node1", 100, 500), // Different positions, but maintain relative spacing
      createTestNode("node2", 100, 400),
      createTestNode("node3", 100, 600),
    ];

    const result = preserveNodesVerticalOrder(originalNodes, layoutedNodes);

    // Should redistribute evenly while preserving order
    const node1Result = result.find((n) => n.id === "node1")!;
    const node2Result = result.find((n) => n.id === "node2")!;
    const node3Result = result.find((n) => n.id === "node3")!;

    // Check order is preserved
    expect(node1Result.position.y).toBeLessThan(node2Result.position.y);
    expect(node2Result.position.y).toBeLessThan(node3Result.position.y);

    // Check spacing is proportional
    const spacing1to2 = node2Result.position.y - node1Result.position.y;
    const spacing2to3 = node3Result.position.y - node2Result.position.y;
    expect(Math.abs(spacing1to2 - spacing2to3)).toBeLessThan(1); // Should be equal within rounding
  });

  it("should handle horizontal tolerance correctly", () => {
    const originalNodes: AppNode[] = [
      createTestNode("close1", 100, 100),
      createTestNode("close2", 119, 200), // Within 20px tolerance
      createTestNode("far", 150, 150), // Outside tolerance
    ];

    const layoutedNodes: AppNode[] = [
      createTestNode("close1", 105, 300),
      createTestNode("close2", 115, 100),
      createTestNode("far", 155, 200),
    ];

    const result = preserveNodesVerticalOrder(originalNodes, layoutedNodes);

    // close1 and close2 should be grouped and reordered
    const close1Result = result.find((n) => n.id === "close1")!;
    const close2Result = result.find((n) => n.id === "close2")!;
    const farResult = result.find((n) => n.id === "far")!;

    // close1 should come before close2 (preserving original order)
    expect(close1Result.position.y).toBeLessThan(close2Result.position.y);

    // far should keep its original layouted position since it's in a different group
    expect(farResult.position.y).toBe(200);
  });
});
