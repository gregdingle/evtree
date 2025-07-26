import { StoreState } from "@/hooks/use-store";
import { mapValues, omit } from "es-toolkit";
import { fromPairs, toPairs, values } from "es-toolkit/compat";
import { toComputeEdge, toComputeNode } from "./expectedValue";
import {
  buildChildToParentEdgeMap,
  buildChildToParentNodeMap,
  buildNodeToIncomingEdgeMap,
  buildParentToChildNodeMap,
} from "./maps";
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
    // NOTE: this happens when switching current tree because of stale react components
    return null;
  }

  // Build maps for efficient traversal
  const nodeToIncomingEdge = buildNodeToIncomingEdgeMap(currentTree.edges);
  const childToParentEdgeMap = buildChildToParentEdgeMap(currentTree.edges);

  // Find the edge that leads to this node
  const incomingEdgeId = nodeToIncomingEdge[nodeId];

  // If no incoming edge, this is a root node or disconnected
  if (!incomingEdgeId) {
    return null;
  }

  // Traverse the path from this node back to root, multiplying probabilities
  let totalProbability = 1;
  let currentEdgeId: string | undefined = incomingEdgeId;

  while (currentEdgeId) {
    const edge = currentTree.edges[currentEdgeId];
    if (!edge) {
      warnItemNotFound("Edge", currentEdgeId, "path probability calculation");
      return null;
    }

    const edgeProbability = edge.data?.probability ?? null;
    if (edgeProbability === null) {
      // If any edge in the path has no probability, the total is null
      return null;
    }

    totalProbability *= edgeProbability;

    // Move to the parent edge
    currentEdgeId = childToParentEdgeMap[currentEdgeId];
  }

  return totalProbability;
}

/**
 * Returns the real cumulative value of a path to a node from the node's root
 * parent. When used with a terminal node, the terminal node's value minus all
 * **costs** along the path to the terminal node.
 *
 * NOTE: For somewhat historical reasons, the expected value calculation of
 * computeNodeValues that sets each node's value does not take into account its
 * own cost or the costs of its ancestors. See note in computeNodeValues. The
 * advantage of the current two-pass approach is that we always preserve the user
 * inputted terminal node values.
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
    // NOTE: this happens when switching current tree because of stale react components
    return null;
  }

  if (node.data.value === null) {
    // NOTE: don't compute path value until the node has a value
    // TODO: is this the best way to handle this?
    return null;
  }

  let pathValue = node.data.value;
  let currentNodeId: string | undefined = nodeId;
  const childToParentMap = buildChildToParentNodeMap(currentTree.edges);
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

    // Move to the parent node
    currentNodeId = childToParentMap[currentNodeId];
  }

  return pathValue;
}

export function selectCollapsible(
  state: StoreState,
  nodeId: string | undefined
) {
  const tree = state.trees[state.currentTreeId!];
  if (!nodeId || !tree) {
    return { hasChildren: false, isCollapsed: false };
  }

  const parentToChildMap = buildParentToChildNodeMap(tree.edges);
  const children = parentToChildMap[nodeId];
  const hasChildren = children ? children.length > 0 : false;

  // Check if any child is hidden to determine collapsed state
  const isCollapsed =
    hasChildren && !!children?.some((nodeId) => tree.nodes[nodeId]?.hidden);

  return { hasChildren, isCollapsed };
}

export function selectUndoableState(state: StoreState) {
  // TODO: is going thru all the users trees necessary? why not just the current tree?
  return {
    ...state,
    clipboard: undefined,
    trees: fromPairs(
      toPairs(state.trees).map(([treeId, tree]) => [
        treeId,
        {
          ...tree,
          updatedAt: undefined,
          nodes: fromPairs(
            toPairs(tree.nodes).map(([id, node]) => [
              id,
              // NOTE: measured is something that ReactFlow adds
              // secondarily to nodes onNodesChange
              omit(node, ["selected", "measured"]),
            ])
          ),
          edges: fromPairs(
            toPairs(tree.edges).map(([id, edge]) => [
              id,
              omit(edge, ["selected"]),
            ])
          ),
        },
      ])
    ),
  };
}
