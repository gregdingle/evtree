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

/**
 * Returns the probability of a node being reached from it's root parent.
 */
export function selectPathProbability(
  state: StoreState,
  nodeId: string
): number {
  const currentTree = selectCurrentTree(state);
  if (!currentTree) {
    return 0;
  }

  const node = currentTree.nodes[nodeId];
  if (!node) {
    warnItemNotFound("Node", nodeId, "path probability calculation");
    return 0;
  }

  // Find all edges that target this node (incoming edges)
  const incomingEdges = values(currentTree.edges).filter(
    (edge) => edge.target === nodeId
  );

  // If no incoming edges, this is a root node with probability 1
  if (incomingEdges.length === 0) {
    return 1;
  }

  // Calculate the sum of probabilities from all incoming paths
  // NOTE: in a normal decision tree, incomingEdges.length should never be more
  // than 1
  let totalProbability = 0;
  for (const edge of incomingEdges) {
    const edgeProbability = edge.data?.probability ?? 0;
    // Recursively calculate the probability of reaching the source node
    const sourceProbability = selectPathProbability(state, edge.source);
    // Multiply the source probability by this edge's probability
    totalProbability += sourceProbability * edgeProbability;
  }

  return totalProbability;
}
