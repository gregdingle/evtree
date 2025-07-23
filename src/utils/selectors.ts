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
 * TODO: for reducing UI noise, make #selectPathProbability return null when
 * path length is 1 edge
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

/**
 * Returns the real cumulative value of a path to a node from the node's root
 * parent. When used with a terminal node, the terminal node's value minus all
 * **costs** along the path to the terminal node.
 */
export function selectPathValue(
  state: StoreState,
  nodeId: string
): number | null {
  const currentTree = selectCurrentTree(state);
  if (!currentTree) {
    return null;
  }

  const node = currentTree.nodes[nodeId];
  if (!node) {
    warnItemNotFound("Node", nodeId, "path value calculation");
    return null;
  }

  if (node.data.value === null) {
    // NOTE: don't compute path value until the node has a value
    // TODO: is this the best way to handle this?
    return null;
  }

  let pathValue = node.data.value;
  let currentNodeId = nodeId;
  const edges = values(currentTree.edges);
  while (currentNodeId) {
    const currentNode = currentTree.nodes[currentNodeId];
    if (!currentNode) {
      warnItemNotFound("Node", currentNodeId, "path value calculation");
      return null;
    }

    // Add the node's cost to the path value
    if (currentNode.data.cost !== null) {
      pathValue -= currentNode.data.cost;
    }

    // Move to the parent node (the source of the incoming edge)
    // TODO: use an adjList here instead? see buildAdjacencyList
    const incomingEdges = edges.filter((edge) => edge.target === currentNodeId);
    if (incomingEdges.length === 0) {
      // No incoming edges means this is a root node
      break;
    }
    // For simplicity, we assume only one incoming edge per node
    if (incomingEdges.length > 1) {
      console.warn(
        `[EVTree] Multiple incoming edges found for node ${currentNodeId}, using the first one.`
      );
    }
    currentNodeId = incomingEdges[0]!.source;
  }

  return pathValue;
}
