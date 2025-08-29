import dagre from "@dagrejs/dagre";
import { values } from "es-toolkit/compat";

import { AppEdge } from "./edge";
import { AppNode } from "./node";

//
// NOTE: see https://reactflow.dev/examples/layout/dagre
//

// TODO: instead of free-flowing + arrange, consider this placeholder-based dynamic layout:
// https://reactflow.dev/examples/layout/dynamic-layouting

// TODO: instead of dagre, consider d3 hierarchy... see
// https://codesandbox.io/p/sandbox/react-flow-d3-hierarchy-7p8xnf?file=%2Fsrc%2FFlow.js%3A2%2C1-3%2C1
// https://d3js.org/d3-hierarchy/tree
// https://reactflow.dev/examples/layout/auto-layout

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

// Default node dimensions for Dagre layout when measured dimensions aren't available
// These serve as fallbacks for newly created nodes that haven't been rendered yet
// TODO: are these numbers similar to `measured`
const DEFAULT_NODE_WIDTH = 172;
const DEFAULT_NODE_HEIGHT = 72;

const HORIZONTAL_TOLERANCE = 10; // Pixels tolerance for grouping
export const MINIMUM_DISTANCE = 10; // Minimum distance between subtree and surrounding nodes

// TODO: somehow, the branches are not splitting now at exactly the same
// horizontal position so now there are weird tiny gaps between branches.
// This seems to affect new created nodes on "hello world tree" only.
// TODO: what's the point of returning edges?
export const getLayoutedElements = (
  nodes: AppNode[],
  edges: AppEdge[],
  direction = "LR",
  verticalScale = 2,
  horizontalScale = 1,
  preserveVerticalOrder = false,
  // TODO: animate arrange feature is NOT finished... we need to turn off the
  // animation after arrange somehow... it may be better to do it all with a
  // global state flag isArranging... I tried with a global conditional CSS
  // class but it didn't work :(
  animate = false,
): { nodes: AppNode[]; edges: AppEdge[] } => {
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    // Use actual measured dimensions when available, fallback to defaults
    // IMPORTANT: Use the same dimensions for both Dagre layout AND position calculation
    const width = node.measured?.width ?? DEFAULT_NODE_WIDTH;
    const height = node.measured?.height ?? DEFAULT_NODE_HEIGHT;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
    if (animate) {
      // TODO: should return a copy???
      edge.style = {
        transition: "transform 1000ms ease",
      };
    }
  });

  dagre.layout(dagreGraph);

  let newNodes: AppNode[] = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    // Use actual measured dimensions for positioning calculations
    const width = node.measured?.width ?? DEFAULT_NODE_WIDTH;
    const height = node.measured?.height ?? DEFAULT_NODE_HEIGHT;

    const newNode: AppNode = {
      ...node,
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      position: {
        x: nodeWithPosition.x * horizontalScale - width / 2,
        y: nodeWithPosition.y * verticalScale - height / 2,
      },
    };

    if (animate) {
      newNode.style = {
        transition: "transform 1000ms ease",
      };
    }

    return newNode;
  });

  // Post-process to preserve vertical order if requested
  if (preserveVerticalOrder) {
    newNodes = preserveNodesVerticalOrder(nodes, newNodes);
  }

  return { nodes: newNodes, edges };
};

/**
 * Preserves the original vertical order of nodes within each horizontal group (same level/rank).
 * This maintains user-intended positioning while still benefiting from Dagre's layout algorithm.
 */
export function preserveNodesVerticalOrder(
  originalNodes: AppNode[],
  layoutedNodes: AppNode[],
): AppNode[] {
  // Create original vertical order map
  const originalVerticalOrder = new Map<string, number>();
  originalNodes.forEach((node) => {
    originalVerticalOrder.set(node.id, node.position.y);
  });

  // Group nodes by their horizontal position (same level/rank)
  const horizontalGroups = new Map<number, AppNode[]>();

  layoutedNodes.forEach((node) => {
    let foundGroup = false;

    // Check if this node can be added to an existing group
    for (const [groupX, groupNodes] of horizontalGroups) {
      if (Math.abs(node.position.x - groupX) <= HORIZONTAL_TOLERANCE) {
        groupNodes.push(node);
        foundGroup = true;
        break;
      }
    }

    // If no existing group found, create a new one
    if (!foundGroup) {
      horizontalGroups.set(node.position.x, [node]);
    }
  });

  // Reorder nodes within each horizontal group by original vertical position
  const reorderedNodes: AppNode[] = [];
  horizontalGroups.forEach((groupNodes) => {
    if (groupNodes.length > 1) {
      // Sort by original vertical position
      const sortedNodes = groupNodes.sort((a, b) => {
        const aOriginalY = originalVerticalOrder.get(a.id) ?? a.position.y;
        const bOriginalY = originalVerticalOrder.get(b.id) ?? b.position.y;
        return aOriginalY - bOriginalY;
      });

      // Redistribute with preserved order
      const minY = Math.min(...sortedNodes.map((n) => n.position.y));
      const maxY = Math.max(...sortedNodes.map((n) => n.position.y));
      const totalHeight = maxY - minY;
      const spacing = totalHeight / Math.max(1, sortedNodes.length - 1);

      sortedNodes.forEach((node, index) => {
        reorderedNodes.push({
          ...node,
          position: {
            ...node.position,
            y: minY + index * spacing,
          },
        });
      });
    } else {
      reorderedNodes.push(...groupNodes);
    }
  });

  return reorderedNodes;
}

export function computeLayoutedNodeOffsets(
  layoutedNodes: AppNode[],
  targetNodeId: string,
  nodes: Record<string, AppNode>,
  subtreeNodeIds: Set<string>,
) {
  const rootNode = nodes[targetNodeId]!;

  const layoutedRootNode = layoutedNodes.find(
    (node) => node.id === targetNodeId,
  )!;

  // Calculate initial offset to maintain root position
  const offsetX = rootNode.position.x - layoutedRootNode.position.x;
  let offsetY = rootNode.position.y - layoutedRootNode.position.y;

  // Calculate bounds of the layouted subtree with initial offset
  const subtreeBounds = layoutedNodes.reduce(
    (bounds, node) => {
      const adjustedY = node.position.y + offsetY;
      const nodeHeight = node.measured?.height ?? DEFAULT_NODE_HEIGHT;
      return {
        minY: Math.min(bounds.minY, adjustedY),
        maxY: Math.max(bounds.maxY, adjustedY + nodeHeight),
      };
    },
    { minY: Infinity, maxY: -Infinity },
  );

  // Check for overlaps with surrounding nodes and adjust if needed
  if (
    values(nodes).some((node) => !subtreeNodeIds.has(node.id) && !node.hidden)
  ) {
    // Find the best position by analyzing all potential placements
    const currentSubtreeMinY = subtreeBounds.minY;
    const currentSubtreeMaxY = subtreeBounds.maxY;
    const subtreeHeight = currentSubtreeMaxY - currentSubtreeMinY;

    // Collect surrounding nodes for potential placements
    const surroundingNodes = values(nodes).filter(
      (node) => !subtreeNodeIds.has(node.id) && !node.hidden,
    );

    // Generate potential Y positions: above and below each surrounding node
    const potentialPositions: number[] = [];

    for (const surroundingNode of surroundingNodes) {
      const surroundingY = surroundingNode.position.y;
      const surroundingHeight = surroundingNode.measured?.height ?? 50; // Default height

      // Position above the surrounding node (subtree bottom should be MINIMUM_DISTANCE above surrounding top)
      potentialPositions.push(surroundingY - MINIMUM_DISTANCE - subtreeHeight);
      // Position below the surrounding node (subtree top should be MINIMUM_DISTANCE below surrounding bottom)
      potentialPositions.push(
        surroundingY + surroundingHeight + MINIMUM_DISTANCE,
      );
    }

    // Also consider the current position
    potentialPositions.push(currentSubtreeMinY);

    // Find the position with minimal adjustment that has no conflicts
    let bestAdjustment = 0;
    let minAdjustmentMagnitude = Infinity;

    for (const candidateMinY of potentialPositions) {
      const candidateMaxY = candidateMinY + subtreeHeight;
      const candidateAdjustment = candidateMinY - currentSubtreeMinY;

      // Check if this position has any conflicts
      let hasConflict = false;
      for (const surroundingNode of surroundingNodes) {
        const surroundingY = surroundingNode.position.y;
        const surroundingHeight = surroundingNode.measured?.height ?? 50; // Default height
        const surroundingMinY = surroundingY;
        const surroundingMaxY = surroundingY + surroundingHeight;

        // Check for overlap: two rectangles overlap if they overlap in both dimensions
        // Since we only care about vertical positioning, check vertical overlap with minimum distance
        const subtreeWithDistanceMinY = candidateMinY - MINIMUM_DISTANCE;
        const subtreeWithDistanceMaxY = candidateMaxY + MINIMUM_DISTANCE;

        if (
          subtreeWithDistanceMinY < surroundingMaxY &&
          subtreeWithDistanceMaxY > surroundingMinY
        ) {
          hasConflict = true;
          break;
        }
      }

      // If no conflict and smaller adjustment, use this position
      if (!hasConflict) {
        const adjustmentMagnitude = Math.abs(candidateAdjustment);
        if (adjustmentMagnitude < minAdjustmentMagnitude) {
          minAdjustmentMagnitude = adjustmentMagnitude;
          bestAdjustment = candidateAdjustment;
        }
      }
    }

    // Apply the best adjustment found
    offsetY += bestAdjustment;
  }
  return { offsetX, offsetY };
}
