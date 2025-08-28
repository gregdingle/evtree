import dagre from "@dagrejs/dagre";
import { Position } from "@xyflow/react";
import { values } from "es-toolkit/compat";

import { AppEdge } from "./edge";
import { AppNode } from "./node";

//
// NOTE: see https://reactflow.dev/examples/layout/dagre
//

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

// Default node dimensions for Dagre layout when measured dimensions aren't available
// These serve as fallbacks for newly created nodes that haven't been rendered yet
// TODO: are these numbers similar to `measured`
const DEFAULT_NODE_WIDTH = 172;
const DEFAULT_NODE_HEIGHT = 72;

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
): { nodes: AppNode[]; edges: AppEdge[] } => {
  const isHorizontal = direction === "LR";
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
  });

  dagre.layout(dagreGraph);

  let newNodes: AppNode[] = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    // Use actual measured dimensions for positioning calculations
    const width = node.measured?.width ?? DEFAULT_NODE_WIDTH;
    const height = node.measured?.height ?? DEFAULT_NODE_HEIGHT;

    const newNode: AppNode = {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      position: {
        x: nodeWithPosition.x * horizontalScale - width / 2,
        y: nodeWithPosition.y * verticalScale - height / 2,
      },
    };

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
function preserveNodesVerticalOrder(
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
  const HORIZONTAL_TOLERANCE = 20; // Pixels tolerance for grouping

  layoutedNodes.forEach((node) => {
    const roundedX =
      Math.round(node.position.x / HORIZONTAL_TOLERANCE) * HORIZONTAL_TOLERANCE;
    if (!horizontalGroups.has(roundedX)) {
      horizontalGroups.set(roundedX, []);
    }
    horizontalGroups.get(roundedX)!.push(node);
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

      // HACK: correct an observed inconsistency issue with branch length after arrange
      const minX = Math.min(...sortedNodes.map((n) => n.position.x));

      sortedNodes.forEach((node, index) => {
        reorderedNodes.push({
          ...node,
          position: {
            ...node.position,
            y: minY + index * spacing,
            x: minX, // HACK: see above
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
  const MINIMUM_DISTANCE = 100; // Minimum distance between subtree and surrounding nodes
  const subtreeBounds = layoutedNodes.reduce(
    (bounds, node) => {
      const adjustedY = node.position.y + offsetY;
      return {
        minY: Math.min(bounds.minY, adjustedY),
        maxY: Math.max(bounds.maxY, adjustedY),
      };
    },
    { minY: Infinity, maxY: -Infinity },
  );

  // Check for overlaps with surrounding nodes and adjust if needed
  // Get all nodes NOT in the subtree (surrounding nodes)
  const surroundingNodes = values(nodes).filter(
    (node) => !subtreeNodeIds.has(node.id) && !node.hidden,
  );
  if (surroundingNodes.length > 0) {
    let adjustment = 0;
    let hasOverlap = true;

    while (hasOverlap) {
      hasOverlap = false;
      const currentSubtreeMinY = subtreeBounds.minY + adjustment;
      const currentSubtreeMaxY = subtreeBounds.maxY + adjustment;

      for (const surroundingNode of surroundingNodes) {
        const surroundingY = surroundingNode.position.y;

        // Check if there's vertical overlap
        if (
          currentSubtreeMinY - MINIMUM_DISTANCE < surroundingY &&
          currentSubtreeMaxY + MINIMUM_DISTANCE > surroundingY
        ) {
          // Found overlap, need to adjust
          hasOverlap = true;

          // Determine whether to move subtree up or down
          const distanceToMoveDown =
            surroundingY + MINIMUM_DISTANCE - currentSubtreeMinY;
          const distanceToMoveUp =
            currentSubtreeMaxY + MINIMUM_DISTANCE - surroundingY;

          // Choose the smaller adjustment
          if (distanceToMoveDown < distanceToMoveUp) {
            adjustment += distanceToMoveDown;
          } else {
            adjustment -= distanceToMoveUp;
          }
          break;
        }
      }
    }

    // Apply the vertical adjustment
    offsetY += adjustment;
  }
  return { offsetX, offsetY };
}
