import { hierarchy, tree } from "d3-hierarchy";
import { values } from "es-toolkit/compat";

import { AppEdge } from "./edge";
import { buildParentToChildNodeMap } from "./maps";
import { AppNode } from "./node";

// Default node dimensions for layout when measured dimensions aren't available
// These serve as fallbacks for newly created nodes that haven't been rendered yet
// TODO: are these numbers actually similar to `measured`?
const DEFAULT_NODE_WIDTH = 172;
const DEFAULT_NODE_HEIGHT = 72;

export const MINIMUM_DISTANCE = 10; // Minimum distance between subtree and surrounding nodes

/**
 * Calculates offset to maintain root position after auto arranging
 */
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

  // Collect surrounding nodes for collision detection (exclude note and ghost nodes as they're annotations)
  const surroundingNodes = values(nodes).filter(
    (node) =>
      !subtreeNodeIds.has(node.id) &&
      !node.hidden &&
      node.type !== "note" &&
      node.type !== "ghost",
  );

  // Check for overlaps with surrounding nodes and adjust if needed
  if (surroundingNodes.length > 0) {
    // Find the best position by analyzing all potential placements
    const currentSubtreeMinY = subtreeBounds.minY;
    const currentSubtreeMaxY = subtreeBounds.maxY;
    const subtreeHeight = currentSubtreeMaxY - currentSubtreeMinY;

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

/**
 * Layout nodes using D3 hierarchy tree layout.
 *
 * @param nodes - Array of nodes to layout
 * @param edges - Array of edges
 * @param direction - "LR" (left-to-right) or "TB" (top-to-bottom)
 * @param nodeSpacing - Spacing between nodes { horizontal, vertical }
 * @param animate - Whether to add transition animations
 * @param rightAligned - Whether to right-align all terminal nodes
 *
 * @see https://reactflow.dev/examples/layout/auto-layout
 * @see https://d3js.org/d3-hierarchy/tree
 * @see https://codesandbox.io/p/sandbox/react-flow-d3-hierarchy-7p8xnf
 */
export const getLayoutedElementsD3 = (
  rootNodeId: string,
  nodes: AppNode[],
  edges: AppEdge[],
  direction: "LR" | "TB" = "LR",
  // TODO: node spacing dynamically by longest labels or terminal values?
  nodeSpacing = { horizontal: 200, vertical: 150 },
  animate = false,
  separate = { siblings: 0.5, parents: 2 },
  rightAligned = false,
): { nodes: AppNode[]; edges: AppEdge[] } => {
  const childrenMap = buildParentToChildNodeMap(edges);

  // Build hierarchy data structure
  interface HierarchyNode {
    id: string;
    children?: HierarchyNode[];
  }

  const buildHierarchy = (nodeId: string): HierarchyNode => {
    const children = childrenMap[nodeId];
    if (!children) {
      return { id: nodeId };
    }

    // Build child hierarchies first
    const childHierarchies = children.map(buildHierarchy);

    // Sort children by their original vertical position to preserve user intent
    childHierarchies.sort((a, b) => {
      const nodeA = nodes.find((n) => n.id === a.id);
      const nodeB = nodes.find((n) => n.id === b.id);
      const posA = nodeA?.position.y ?? 0;
      const posB = nodeB?.position.y ?? 0;
      return posA - posB; // Ascending order (top to bottom)
    });

    return {
      id: nodeId,
      children: childHierarchies,
    };
  };

  const hierarchyData = buildHierarchy(rootNodeId);

  // Create D3 hierarchy
  const root = hierarchy(hierarchyData);

  // Create tree layout with improved separation to reduce crossings
  const treeLayout = tree<HierarchyNode>()
    .nodeSize([
      direction === "LR" ? nodeSpacing.vertical : nodeSpacing.horizontal,
      direction === "LR" ? nodeSpacing.horizontal : nodeSpacing.vertical,
    ])
    .separation((a, b) => {
      // Increase separation based on subtree sizes to reduce crossings
      if (a.parent === b.parent) {
        // Siblings: use more space for larger subtrees
        const aSize = a.descendants().length;
        const bSize = b.descendants().length;
        const avgSize = (aSize + bSize) / 2;
        return Math.max(1, Math.sqrt(avgSize) * separate.siblings);
      }
      // Different parents: more separation
      return separate.parents;
    });

  // Apply layout
  treeLayout(root);

  // Right-aligned mode: align all terminal nodes to the same depth
  // while maintaining depth-first ordering to prevent branch crossings
  if (rightAligned) {
    applyRightAlignedLayout(root, edges, hierarchyData, direction, nodeSpacing);
  }

  // Create node position map
  const nodePositions = new Map<string, { x: number; y: number }>();
  root.each((d) => {
    const node = nodes.find((n) => n.id === d.data.id);
    const width = node?.measured?.width ?? DEFAULT_NODE_WIDTH;
    const height = node?.measured?.height ?? DEFAULT_NODE_HEIGHT;

    // D3 tree uses (x, y) where x is the perpendicular axis
    // For LR layout: swap x and y
    // For TB layout: use as is
    const [primaryAxis, secondaryAxis] =
      direction === "LR" ? [d.y ?? 0, d.x ?? 0] : [d.x ?? 0, d.y ?? 0];

    nodePositions.set(d.data.id, {
      x: primaryAxis - (direction === "LR" ? 0 : width / 2),
      y: secondaryAxis - (direction === "LR" ? height / 2 : 0),
    });
  });

  // Apply positions to nodes
  const newNodes: AppNode[] = nodes.map((node) => {
    const position = nodePositions.get(node.id);
    if (!position) {
      // Keep original position for nodes not in tree (e.g., note nodes, ghost nodes)
      return node;
    }

    const newNode: AppNode = {
      ...node,
      position,
    };

    if (animate) {
      newNode.style = {
        transition: "transform 1000ms ease",
      };
    }

    return newNode;
  });

  // Add animation to edges if requested
  const newEdges = animate
    ? edges.map((edge) => ({
        ...edge,
        style: {
          transition: "transform 1000ms ease",
        },
      }))
    : edges;

  return { nodes: newNodes, edges: newEdges };
};

/**
 * Builds a map of node IDs to their depth-first traversal positions.
 * Used for ordering terminal nodes in right-aligned layout to prevent branch crossings.
 */
function buildDepthFirstPositionMap(hierarchyData: {
  id: string;
  children?: unknown[];
}): Map<string, number> {
  const order: string[] = [];
  const traverse = (node: { id: string; children?: unknown[] }) => {
    order.push(node.id);
    if (node.children) {
      for (const child of node.children) {
        traverse(child as { id: string; children?: unknown[] });
      }
    }
  };
  traverse(hierarchyData);

  const positionMap = new Map<string, number>();
  order.forEach((id, index) => positionMap.set(id, index));
  return positionMap;
}

/**
 * Applies right-aligned layout to terminal nodes.
 * Aligns all terminal nodes to the same depth while maintaining depth-first ordering
 * to prevent branch crossings.
 */
function applyRightAlignedLayout(
  root: ReturnType<typeof hierarchy<{ id: string }>>,
  edges: AppEdge[],
  hierarchyData: { id: string; children?: unknown[] },
  direction: "LR" | "TB",
  nodeSpacing: { horizontal: number; vertical: number },
): void {
  const childrenMap = buildParentToChildNodeMap(edges);
  type HierarchyNodeType = ReturnType<typeof hierarchy<{ id: string }>>;

  // Find all terminal nodes (leaf nodes with no children)
  const terminalNodes: HierarchyNodeType[] = [];
  root.each((d) => {
    const isTerminal = (childrenMap[d.data.id]?.length ?? 0) === 0;
    if (isTerminal) terminalNodes.push(d);
  });

  if (terminalNodes.length === 0) return;

  // Find the rightmost depth for alignment
  const maxDepth = Math.max(
    ...terminalNodes.map((n) => (direction === "LR" ? (n.y ?? 0) : (n.x ?? 0))),
  );

  // Build depth-first ordering from hierarchyData (respects original vertical ordering)
  const depthFirstPosition = buildDepthFirstPositionMap(hierarchyData);

  // Sort terminals by depth-first position to prevent branch crossings
  terminalNodes.sort(
    (a, b) =>
      (depthFirstPosition.get(a.data.id) ?? 0) -
      (depthFirstPosition.get(b.data.id) ?? 0),
  );

  // Calculate spacing and center position
  const spacing =
    direction === "LR" ? nodeSpacing.vertical : nodeSpacing.horizontal;
  const originalPositions = terminalNodes.map((t) =>
    direction === "LR" ? (t.x ?? 0) : (t.y ?? 0),
  );
  const avgPosition =
    originalPositions.reduce((sum, pos) => sum + pos, 0) /
    originalPositions.length;
  const totalHeight = (terminalNodes.length - 1) * spacing;
  let currentPosition = avgPosition - totalHeight / 2;

  // Position terminals with even spacing
  for (const terminal of terminalNodes) {
    if (direction === "LR") {
      terminal.y = maxDepth;
      terminal.x = currentPosition;
    } else {
      terminal.x = maxDepth;
      terminal.y = currentPosition;
    }
    currentPosition += spacing;
  }
}
