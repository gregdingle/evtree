import { values } from "es-toolkit/compat";

import { AppNode } from "./node";

// TODO: use same default height and width as in layout.ts and anywhere else?
const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 100;

export function findNearestUpstreamNode(
  nodes: Record<string, AppNode>,
  selectedNode: AppNode,
): AppNode | null {
  const upstreamNodes = getUpstreamNodes(nodes, selectedNode);

  if (upstreamNodes.length === 0) {
    console.warn("[EVTree] No upstream nodes found to connect to");
    return null;
  }

  return findNearestNode(selectedNode, upstreamNodes);
}

/**
 * Finds nearest upstream node based on center y position and right edge to left edge distance
 */
function getUpstreamNodes(
  nodes: Record<string, AppNode>,
  selectedNode: AppNode,
) {
  return values(nodes).filter((node) => {
    if (node.id === selectedNode.id) return false; // Exclude self
    if (!(node.type === "chance" || node.type === "decision")) return false; // Exclude terminal and note nodes

    // Node must be upstream (to the left) of selected node
    const nodeRightEdge =
      node.position.x + (node.measured?.width ?? DEFAULT_NODE_WIDTH);
    const selectedLeftEdge = selectedNode.position.x;

    return nodeRightEdge <= selectedLeftEdge;
  });
}

function findNearestNode(selectedNode: AppNode, upstreamNodes: AppNode[]) {
  let nearestNode: AppNode | null = null;
  let minDistance = Infinity;

  const selectedCenterY =
    selectedNode.position.y +
    (selectedNode.measured?.height ?? DEFAULT_NODE_HEIGHT) / 2;
  const selectedLeftEdge = selectedNode.position.x;

  for (const upstreamNode of upstreamNodes) {
    const upstreamCenterY =
      upstreamNode.position.y +
      (upstreamNode.measured?.height ?? DEFAULT_NODE_HEIGHT) / 2;
    const upstreamRightEdge =
      upstreamNode.position.x +
      (upstreamNode.measured?.width ?? DEFAULT_NODE_WIDTH);

    // Calculate distance: y-axis center distance + x-axis edge distance
    const yCenterDistance = Math.abs(selectedCenterY - upstreamCenterY);
    const xEdgeDistance = selectedLeftEdge - upstreamRightEdge;

    // Weighted distance calculation (prioritize y-axis alignment)
    const totalDistance = yCenterDistance * 2 + Math.max(0, xEdgeDistance);

    if (totalDistance < minDistance) {
      minDistance = totalDistance;
      nearestNode = upstreamNode;
    }
  }

  return nearestNode;
}
