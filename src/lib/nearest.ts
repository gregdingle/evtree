import { values } from "es-toolkit/compat";
import { AppNode } from "./node";

export function getNearestUpstreamNode(
  nodes: Record<string, AppNode>,
  selectedNode: AppNode,
): AppNode | null {
  // Find all potential upstream nodes
  const potentialUpstreamNodes = values(nodes).filter((node) => {
    if (node.id === selectedNode.id) return false; // Exclude self

    // Node must be upstream (to the left) of selected node
    const nodeRightEdge = node.position.x + (node.measured?.width ?? 200);
    const selectedLeftEdge = selectedNode.position.x;

    return nodeRightEdge <= selectedLeftEdge;
  });

  if (potentialUpstreamNodes.length === 0) {
    console.warn("[EVTree] No upstream nodes found to connect to");
    return null;
  }

  // Find nearest upstream node based on center y position and right edge to left edge distance
  let nearestNode: AppNode | null = null;
  let minDistance = Infinity;

  const selectedCenterY =
    selectedNode.position.y + (selectedNode.measured?.height ?? 100) / 2;
  const selectedLeftEdge = selectedNode.position.x;

  for (const upstreamNode of potentialUpstreamNodes) {
    const upstreamCenterY =
      upstreamNode.position.y + (upstreamNode.measured?.height ?? 100) / 2;
    const upstreamRightEdge =
      upstreamNode.position.x + (upstreamNode.measured?.width ?? 200);

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
