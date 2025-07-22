import { AppEdge, AppNode, StoreState } from "@/hooks/use-store";
import { mapValues } from "es-toolkit";
import { values } from "es-toolkit/compat";
import { ComputeEdge, ComputeNode } from "./expectedValue";
import { warnItemNotFound, warnNoCurrentTree } from "./warn";

export function selectComputedNodesAndEdges(state: StoreState) {
  function toComputeNode(node: AppNode): ComputeNode {
    return {
      id: node.id,
      data: {
        value: node.data.value,
      },
    };
  }
  function toComputeEdge(edge: AppEdge): ComputeEdge {
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: {
        probability: edge.data?.probability,
      },
    };
  }
  const { currentTreeId } = state;
  if (!currentTreeId) {
    warnNoCurrentTree("computeNodeValues");
    return { computeNodes: {}, computeEdges: {} };
  }
  const tree = state.trees[currentTreeId!];
  if (!tree) {
    warnItemNotFound("Tree", currentTreeId, "computeNodeValues");
    return { computeNodes: {}, computeEdges: {} };
  }
  return {
    computeNodes: mapValues(tree.nodes, toComputeNode),
    computeEdges: mapValues(tree.edges, toComputeEdge),
  };
}

export function selectCurrentTree(state: StoreState) {
  const { trees, currentTreeId } = state;
  if (!currentTreeId) {
    // NOTE: this should never happen
    warnNoCurrentTree();
    return;
  }

  const tree = state.trees[currentTreeId];
  if (!tree) {
    // NOTE: this should never happen
    warnItemNotFound("Tree", currentTreeId);
    return;
  }

  return trees[currentTreeId];
}

export function selectCurrentNodes(state: StoreState) {
  const currentTree = selectCurrentTree(state);
  return currentTree ? values(currentTree.nodes) : [];
}

export function selectCurrentEdges(state: StoreState) {
  const currentTree = selectCurrentTree(state);
  return currentTree ? values(currentTree.edges) : [];
}
