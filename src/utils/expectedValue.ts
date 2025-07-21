import { AppEdge, AppNode } from "@/hooks/use-store";
import { values } from "es-toolkit/compat";

type AdjacencyList = Record<
  string,
  {
    edgeId: string;
    nodeId: string;
  }[]
>;

/**
 * Computes and assigns values recursively for input `nodes`. The value of a
 * node is defined as the average of its children's values weighted by the
 * probabilities of the associated edges.
 *
 * TODO: should we support edge values like silver decisions?
 */
export function computeNodeValues(
  nodes: Record<string, AppNode>,
  edges: Record<string, AppEdge>
): void {
  const adjList = buildAdjacencyList(values(edges));
  const rootNodes = values(nodes).filter((node) => {
    // A root node has no incoming edges
    return !adjList[node.id];
  });
  if (rootNodes.length === 0) {
    console.warn("[EVTree] No root nodes found, cannot compute values.");
    return;
  }

  rootNodes.forEach((rootNode) => {
    computeNodeValuesRecursive(nodes, edges, rootNode, adjList);
  });
}

function buildAdjacencyList(edges: AppEdge[]): AdjacencyList {
  const adjList: AdjacencyList = {};
  edges.forEach((edge) => {
    if (!adjList[edge.source]) {
      adjList[edge.source] = [];
    }
    adjList[edge.source].push({ edgeId: edge.id, nodeId: edge.target });
  });
  return adjList;
}

function computeNodeValuesRecursive(
  nodes: Record<string, AppNode>,
  edges: Record<string, AppEdge>,
  parentNode: AppNode,
  adjList: AdjacencyList
) {
  const children = adjList[parentNode.id] || [];

  // Base case: if no children, use node's value directly
  if (children.length === 0) {
    if (parentNode.data.value === undefined) {
      console.warn(
        `[EVTree] Terminal node ${parentNode.id} has undefined value.`
      );
    }
    return;
  }

  children.forEach(({ nodeId }) => {
    computeNodeValuesRecursive(nodes, edges, nodes[nodeId], adjList);
  });

  let totalValue = 0;
  let totalProbability = 0;
  children.forEach(({ edgeId, nodeId }) => {
    const childNode = nodes[nodeId];
    const childEdge = edges[edgeId];
    if (childNode) {
      const childValue = childNode.data.value;
      const childProbability = childEdge.data?.probability;
      if (childValue === undefined || childProbability === undefined) {
        return;
      }
      totalValue += childValue * childProbability;
      totalProbability += childProbability;
    }
  });
  if (totalProbability < 1) {
    console.warn(
      `[EVTree] Node ${parentNode.id} has children with less than 1.0 total probability.`
    );
    // TODO: what to do about missing probability?
  }
  parentNode.data.value = totalValue;
}
