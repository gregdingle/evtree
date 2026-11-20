import { values } from "es-toolkit/compat";

import { memoizeWeak } from "@/utils/memoize";

import { AppEdge, filterTreeEdges } from "./edge";
import { NodeType } from "./node";
import { DecisionTree } from "./tree";

// NOTE: minimal shapes so these also work for ComputeNode and ComputeEdge
type NodeLike = { id: string; type?: NodeType };
type EdgeLike = { source: string; target: string; type?: string };

// TODO: add basic unit tests for all functions in this file to define expected behavior

/**
 * NOTE: assumes a single incoming edge per node
 * NOTE: memoize is important to save nodes.length-1 calls per store update.
 * otherwise, selectPathValue is O(n^2) per store update.
 *
 * QUESTION: extract to new utils file along with buildAdjacencyList?
 */
export const getChildToParentNodeMap = memoizeWeak(function (
  edges: Record<string, EdgeLike> | EdgeLike[],
): Record<string, string> {
  const childToParentMap: Record<string, string> = {};
  const treeEdges = filterTreeEdges(values(edges));
  treeEdges.forEach((edge) => {
    childToParentMap[edge.target] = edge.source;
  });
  return childToParentMap;
});

/**
 * Returns the IDs of all root nodes. A root node has no incoming tree edge.
 * Notes and ghost nodes are annotations outside of trees, so never roots.
 *
 * @see getRootNodeId for the root of a given node
 */
export function getRootNodeIds(
  nodes: Record<string, NodeLike>,
  edges: Record<string, EdgeLike> | EdgeLike[],
): string[] {
  const parentMap = getChildToParentNodeMap(edges);
  return values(nodes)
    .filter(
      (node) =>
        !parentMap[node.id] && node.type !== "note" && node.type !== "ghost",
    )
    .map((node) => node.id);
}

/**
 * Returns the ID of the root node of the tree containing `nodeId`, by walking
 * up incoming tree edges.
 *
 * @see getRootNodeIds for all root nodes
 */
export function getRootNodeId(tree: DecisionTree, nodeId: string): string {
  const parentMap = getChildToParentNodeMap(tree.edges);
  let rootId = nodeId;
  while (parentMap[rootId]) {
    rootId = parentMap[rootId]!;
  }
  return rootId;
}

/**
 * Returns the root node of copied nodes and edges, like the clipboard: the
 * first copied node without a copied parent. Falls back to the first node.
 *
 * NOTE: not simply the first node, because copy keeps tree order, where a
 * parent can come after its children, like after insertNodeBefore.
 *
 * NOTE: not getRootNodeId or getRootNodeIds, because copied edges can include
 * an incoming edge from a node that wasn't copied, which paste uses to attach
 * branches. Only edges between copied nodes count here.
 */
export function getPasteRootNode<N extends { id: string }>(
  nodes: N[],
  edges: EdgeLike[],
): N | undefined {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const childIds = new Set(
    edges.filter((edge) => nodeIds.has(edge.source)).map((edge) => edge.target),
  );
  return nodes.find((node) => !childIds.has(node.id)) ?? nodes[0];
}

export const getNodeToIncomingEdgeMap = memoizeWeak(function (
  edges: Record<string, AppEdge> | AppEdge[],
): Record<string, string> {
  const nodeToIncomingEdge: Record<string, string> = {};
  const treeEdges = filterTreeEdges(values(edges));
  treeEdges.forEach((edge) => {
    nodeToIncomingEdge[edge.target] = edge.id;
  });
  return nodeToIncomingEdge;
});

export const getChildToParentEdgeMap = memoizeWeak(function (
  edges: Record<string, AppEdge> | AppEdge[],
): Record<string, string> {
  const childToParentMap: Record<string, string> = {};

  const treeEdges = filterTreeEdges(values(edges));

  // First pass: build a lookup map from target node to edge ID (O(n))
  const nodeToIncomingEdge: Record<string, string> = {};
  treeEdges.forEach((edge) => {
    nodeToIncomingEdge[edge.target] = edge.id;
  });

  // Second pass: for each edge, find its parent edge using the lookup map (O(n))
  treeEdges.forEach((childEdge) => {
    const parentEdgeId = nodeToIncomingEdge[childEdge.source];
    if (parentEdgeId) {
      childToParentMap[childEdge.id] = parentEdgeId;
    }
    // If no parent edge found, this edge starts from a root node
  });

  return childToParentMap;
});

export const getParentToChildNodeMap = memoizeWeak(function (
  edges: Record<string, AppEdge> | AppEdge[],
): Record<string, string[]> {
  const parentToChildMap: Record<string, string[]> = {};
  const treeEdges = filterTreeEdges(values(edges));
  treeEdges.forEach((edge) => {
    if (!parentToChildMap[edge.source]) {
      parentToChildMap[edge.source] = [];
    }
    parentToChildMap[edge.source]!.push(edge.target);
  });
  return parentToChildMap;
});

export function collectSubtreeNodeIds(
  tree: DecisionTree,
  nodeId: string,
): Set<string> {
  const parentToChildMap = getParentToChildNodeMap(tree.edges);

  // Collect all nodes in the subtree first
  const subTreeNodes = new Set<string>();
  const collectDescendants = (currentNodeId: string) => {
    subTreeNodes.add(currentNodeId);
    const children = parentToChildMap[currentNodeId] ?? [];
    children.forEach((childNodeId) => {
      collectDescendants(childNodeId);
    });
  };
  collectDescendants(nodeId);

  return subTreeNodes;
}
