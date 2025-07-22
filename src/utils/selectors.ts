import { StoreState } from "@/hooks/use-store";
import { mapValues } from "es-toolkit";
import { values } from "es-toolkit/compat";
import { toComputeEdge, toComputeNode } from "./expectedValue";
import { warnItemNotFound, warnNoCurrentTree } from "./warn";

export function selectComputedNodesAndEdges(state: StoreState) {
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
): number | null {
  const currentTree = selectCurrentTree(state);
  if (!currentTree) {
    return null;
  }

  const node = currentTree.nodes[nodeId];
  if (!node) {
    warnItemNotFound("Node", nodeId, "path probability calculation");
    return null;
  }

  // Find all edges that target this node (incoming edges)
  const incomingEdges = values(currentTree.edges).filter(
    (edge) => edge.target === nodeId
  );

  // If no incoming edges, check if this is a true root node or disconnected
  if (incomingEdges.length === 0) {
    // Find all edges that originate from this node (outgoing edges)
    const outgoingEdges = values(currentTree.edges).filter(
      (edge) => edge.source === nodeId
    );

    // If no outgoing edges either, this is a disconnected node
    if (outgoingEdges.length === 0) {
      return null;
    }

    // This is a true root node (has outgoing edges but no incoming)
    return 1;
  }

  // Calculate the sum of probabilities from all incoming paths
  // NOTE: in a normal decision tree, incomingEdges.length should never be more
  // than 1
  let totalProbability = null;
  for (const edge of incomingEdges) {
    const edgeProbability = edge.data?.probability ?? null;
    // Recursively calculate the probability of reaching the source node
    const sourceProbability = selectPathProbability(state, edge.source);
    if (sourceProbability !== null && edgeProbability !== null) {
      if (totalProbability === null) {
        totalProbability = 0;
      }
      // Multiply the source probability by this edge's probability
      totalProbability += sourceProbability * edgeProbability;
    }
  }

  return totalProbability;
}
