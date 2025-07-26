import { AppEdge } from "@/hooks/use-store";
import { memoize } from "es-toolkit";
import { values } from "es-toolkit/compat";

/**
 * NOTE: assumes a single incoming edge per node
 * NOTE: memoize is important to save nodes.length-1 calls per store update.
 * otherwise, selectPathValue is O(n^2) per store update.
 *
 * TODO: extract to new utils file along with buildAdjacencyList?
 */
export const buildChildToParentNodeMap = memoize(function (
  edges: Record<string, AppEdge>
): Record<string, string> {
  const childToParentMap: Record<string, string> = {};
  values(edges).forEach((edge) => {
    childToParentMap[edge.target] = edge.source;
  });
  return childToParentMap;
});

export const buildNodeToIncomingEdgeMap = memoize(function (
  edges: Record<string, AppEdge>
): Record<string, string> {
  const nodeToIncomingEdge: Record<string, string> = {};
  values(edges).forEach((edge) => {
    nodeToIncomingEdge[edge.target] = edge.id;
  });
  return nodeToIncomingEdge;
});

export const buildChildToParentEdgeMap = memoize(function (
  edges: Record<string, AppEdge>
): Record<string, string> {
  const childToParentMap: Record<string, string> = {};

  // First pass: build a lookup map from target node to edge ID (O(n))
  const nodeToIncomingEdge: Record<string, string> = {};
  values(edges).forEach((edge) => {
    nodeToIncomingEdge[edge.target] = edge.id;
  });

  // Second pass: for each edge, find its parent edge using the lookup map (O(n))
  values(edges).forEach((childEdge) => {
    const parentEdgeId = nodeToIncomingEdge[childEdge.source];
    if (parentEdgeId) {
      childToParentMap[childEdge.id] = parentEdgeId;
    }
    // If no parent edge found, this edge starts from a root node
  });

  return childToParentMap;
});

export const buildParentToChildNodeMap = memoize(function (
  edges: Record<string, AppEdge>
): Record<string, string[]> {
  const parentToChildMap: Record<string, string[]> = {};
  values(edges).forEach((edge) => {
    if (!parentToChildMap[edge.source]) {
      parentToChildMap[edge.source] = [];
    }
    parentToChildMap[edge.source]!.push(edge.target);
  });
  return parentToChildMap;
});
