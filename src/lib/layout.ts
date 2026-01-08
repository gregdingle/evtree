import { hierarchy, tree } from "d3-hierarchy";
import { values } from "es-toolkit/compat";

import { AppEdge } from "./edge";
import { collectSubtreeNodeIds, getParentToChildNodeMap } from "./maps";
import { AppNode } from "./node";
import { DecisionTree } from "./tree";

// Default node dimensions for layout when measured dimensions aren't available
// These serve as fallbacks for newly created nodes that haven't been rendered yet
// TODO: are these numbers actually similar to `measured`?
const DEFAULT_NODE_HEIGHT = 72;

export const MINIMUM_DISTANCE = 10; // Minimum distance between subtree and surrounding nodes

/**
 * Calculates offset to maintain root position after auto arranging.
 *
 * Collision avoidance: If the arranged subtree would overlap with surrounding nodes,
 * the entire subtree (including root) is shifted vertically to find the nearest
 * non-conflicting position. This means the root node position may move on the y-axis.
 *
 * The algorithm:
 * 1. Calculates initial offset to maintain root at its current position
 * 2. Checks for vertical overlaps with surrounding nodes (excluding notes and ghosts)
 * 3. Generates candidate positions above/below each surrounding node
 * 4. Selects the position with minimal adjustment that has no conflicts
 * 5. Applies the adjustment to offsetY, which affects the entire subtree
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
 * Uses left-to-right (LR) layout direction.
 *
 * @param nodes - Array of nodes to layout
 * @param edges - Array of edges
 * @param nodeSpacing - Spacing between nodes { horizontal, vertical }
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
  // TODO: node spacing dynamically by longest labels or terminal values?
  nodeSpacing = { horizontal: 200, vertical: 150 },
  separate = { siblings: 0.5, parents: 2 },
  rightAligned = false,
): { nodes: AppNode[]; edges: AppEdge[] } => {
  const childrenMap = getParentToChildNodeMap(edges);

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
    .nodeSize([nodeSpacing.vertical, nodeSpacing.horizontal])
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
    applyRightAlignedLayout(root, edges, hierarchyData, nodeSpacing);
  }

  // Create node position map
  const nodePositions = new Map<string, { x: number; y: number }>();
  root.each((d) => {
    const node = nodes.find((n) => n.id === d.data.id);
    const height = node?.measured?.height ?? DEFAULT_NODE_HEIGHT;

    // D3 tree uses (x, y) where x is the perpendicular axis
    // For LR layout: swap x and y
    const [primaryAxis, secondaryAxis] = [d.y ?? 0, d.x ?? 0];

    nodePositions.set(d.data.id, {
      x: primaryAxis,
      y: secondaryAxis - height / 2,
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

    return newNode;
  });

  return { nodes: newNodes, edges };
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
 * Uses left-to-right (LR) layout direction.
 */
function applyRightAlignedLayout(
  root: ReturnType<typeof hierarchy<{ id: string }>>,
  edges: AppEdge[],
  hierarchyData: { id: string; children?: unknown[] },
  nodeSpacing: { horizontal: number; vertical: number },
): void {
  const childrenMap = getParentToChildNodeMap(edges);
  type HierarchyNodeType = ReturnType<typeof hierarchy<{ id: string }>>;

  // Find all terminal nodes (leaf nodes with no children)
  const terminalNodes: HierarchyNodeType[] = [];
  root.each((d) => {
    const isTerminal = (childrenMap[d.data.id]?.length ?? 0) === 0;
    if (isTerminal) terminalNodes.push(d);
  });

  if (terminalNodes.length === 0) return;

  // Find the rightmost depth for alignment (LR layout uses y axis)
  const maxDepth = Math.max(...terminalNodes.map((n) => n.y ?? 0));

  // Build depth-first ordering from hierarchyData (respects original vertical ordering)
  const depthFirstPosition = buildDepthFirstPositionMap(hierarchyData);

  // Sort terminals by depth-first position to prevent branch crossings
  terminalNodes.sort(
    (a, b) =>
      (depthFirstPosition.get(a.data.id) ?? 0) -
      (depthFirstPosition.get(b.data.id) ?? 0),
  );

  // Calculate spacing and center position (LR layout uses vertical spacing for y axis)
  const spacing = nodeSpacing.vertical;
  const originalPositions = terminalNodes.map((t) => t.x ?? 0);
  const avgPosition =
    originalPositions.reduce((sum, pos) => sum + pos, 0) /
    originalPositions.length;
  const totalHeight = (terminalNodes.length - 1) * spacing;
  let currentPosition = avgPosition - totalHeight / 2;

  // Position terminals with even spacing (LR layout: y is depth, x is position)
  for (const terminal of terminalNodes) {
    terminal.y = maxDepth;
    terminal.x = currentPosition;
    currentPosition += spacing;
  }
}

export function arrangeSubtreeHelper(
  tree: DecisionTree,
  rootNodeId: string,
  rightAligned = false,
) {
  // Collect all nodes in the subtree
  const subtreeNodeIds = collectSubtreeNodeIds(tree, rootNodeId);

  // Extract subtree nodes and edges
  const subtreeNodes = Array.from(subtreeNodeIds).map((id) => tree.nodes[id]!);
  const subtreeEdges = values(tree.edges).filter(
    (edge) =>
      subtreeNodeIds.has(edge.source) && subtreeNodeIds.has(edge.target),
  );

  // Apply layout to the subtree
  const { nodes: layoutedNodes } = getLayoutedElementsD3(
    rootNodeId,
    subtreeNodes,
    subtreeEdges,
    { horizontal: 250, vertical: 100 },
    { siblings: 0.25, parents: 1.5 },
    rightAligned,
  );

  const { offsetX, offsetY } = computeLayoutedNodeOffsets(
    layoutedNodes,
    rootNodeId,
    tree.nodes,
    subtreeNodeIds,
  );

  // Update positions of nodes in the subtree with final offset
  layoutedNodes.forEach((layoutedNode) => {
    tree.nodes[layoutedNode.id]!.position = {
      x: layoutedNode.position.x + offsetX,
      y: layoutedNode.position.y + offsetY,
    };
  });
}
