import { StoreState } from "@/hooks/use-store";
import { warnItemNotFound, warnNoCurrentTree } from "@/utils/warn";
import { mapValues, memoize, omit } from "es-toolkit";
import { fromPairs, toPairs, values } from "es-toolkit/compat";
import {
  computeNodeValues,
  toComputeEdge,
  toComputeNode,
} from "../lib/expectedValue";
import {
  buildChildToParentEdgeMap,
  buildChildToParentNodeMap,
  buildNodeToIncomingEdgeMap,
  buildParentToChildNodeMap,
} from "../lib/maps";

/**
 * Returns computed values for all nodes in the current tree, performing
 * the expected value calculation on-demand during React component rendering.
 *
 * TODO: better to use createCachedSelector from reselect package?
 * TODO: DRY between selectComputedNodeValues and selectComputedEdgeValues and computeNodeValues
 */
const selectComputedNodeValues = memoize((state: StoreState) => {
  const { currentTreeId } = state;
  if (!currentTreeId) {
    return {};
  }
  const tree = state.trees[currentTreeId];
  if (!tree) {
    return {};
  }

  const computeNodes = mapValues(tree.nodes, (node) =>
    toComputeNode(node, tree.variables),
  );
  const computeEdges = mapValues(tree.edges, toComputeEdge);

  const { nodes: computedNodes } = computeNodeValues(
    computeNodes,
    computeEdges,
  );

  // TODO: is best return structure?
  return mapValues(computedNodes, (node) => ({
    value: node.data.value,
    cost: node.data.cost,
  }));
});

/**
 * Returns computed edge probabilities for all edges in the current tree.
 * This includes updated probabilities for decision nodes based on expected value.
 *
 * TODO: better to use createCachedSelector from reselect package?
 */
const selectComputedEdgeValues = memoize((state: StoreState) => {
  const { currentTreeId } = state;
  if (!currentTreeId) {
    return {};
  }
  const tree = state.trees[currentTreeId];
  if (!tree) {
    return {};
  }

  const computeNodes = mapValues(tree.nodes, (node) =>
    toComputeNode(node, tree.variables),
  );
  const computeEdges = mapValues(tree.edges, toComputeEdge);

  const { edges: computedEdges } = computeNodeValues(
    computeNodes,
    computeEdges,
  );

  return mapValues(computedEdges, (edge) => ({
    probability: edge.data?.probability ?? null,
  }));
});

/**
 * Returns the computed probability for a specific edge.
 */
export function selectEdgeComputedProbability(
  state: StoreState,
  edgeId: string,
): number | null {
  const computedEdgeValues = selectComputedEdgeValues(state);
  return computedEdgeValues[edgeId]?.probability ?? null;
}

/**
 * Returns the computed value and cost for a specific node.
 */
export function selectNodeComputedValue(
  state: StoreState,
  nodeId: string,
): { value: number | null; cost: number | null } | null {
  const computedValues = selectComputedNodeValues(state);
  return computedValues[nodeId] ?? null;
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
  nodeId: string,
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
 * computeNodeValues does not take into account its own cost or the costs of its
 * ancestors. See note in computeNodeValues.
 */
export function selectPathValue(
  state: StoreState,
  nodeId: string,
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

  // Get computed values for all nodes
  const computedValues = selectComputedNodeValues(state);
  const nodeValue = computedValues[nodeId];

  if (!nodeValue || nodeValue.value === null) {
    // NOTE: don't compute path value until the node has a value
    // TODO: is this the best way to handle this?
    return null;
  }

  let pathValue = nodeValue.value;
  let currentNodeId: string | undefined = nodeId;
  const childToParentMap = buildChildToParentNodeMap(currentTree.edges);
  while (currentNodeId) {
    const currentComputedValue = computedValues[currentNodeId];
    if (!currentComputedValue) {
      warnItemNotFound(
        "Node",
        currentNodeId,
        "path value calculation (computed value)",
      );
      return null;
    }

    // Add the node's cost to the path value
    if (currentComputedValue.cost !== null) {
      pathValue -= currentComputedValue.cost;
    }

    // Move to the parent node
    currentNodeId = childToParentMap[currentNodeId];
  }

  return pathValue;
}

export function selectCollapsible(
  state: StoreState,
  nodeId: string | undefined,
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

function selectParentNode(state: StoreState, nodeId: string | undefined) {
  const tree = state.trees[state.currentTreeId!];
  if (!nodeId || !tree) {
    return false;
  }

  const childToParentMap = buildChildToParentNodeMap(tree.edges);
  return childToParentMap[nodeId];
}

export function selectHasParentNode(
  state: StoreState,
  nodeId: string | undefined,
) {
  return Boolean(selectParentNode(state, nodeId));
}

export function selectHasSelectedItems(state: StoreState) {
  const tree = selectCurrentTree(state);
  if (!tree) return false;

  const hasSelectedNodes = values(tree.nodes).some((node) => node.selected);
  const hasSelectedEdges = values(tree.edges).some((edge) => edge.selected);

  return hasSelectedNodes || hasSelectedEdges;
}

export function selectHasClipboardContent(state: StoreState) {
  const { clipboard } = state;
  if (!clipboard) return false;
  return clipboard.nodes.length > 0 || clipboard.edges.length > 0;
}

export function selectHasNodes(state: StoreState) {
  const tree = selectCurrentTree(state);
  if (!tree) return false;

  return values(tree.nodes).length > 0;
}

export function selectHasTerminalNodes(state: StoreState) {
  const tree = selectCurrentTree(state);
  if (!tree) return false;

  return values(tree.nodes).some((node) => node.type === "terminal");
}

export function selectUndoableState(state: StoreState) {
  // TODO: is going thru all the users trees necessary? why not just the current tree?
  return {
    ...state,
    // TODO: do we really want this to be undefined?
    clipboard: undefined,
    trees: fromPairs(
      toPairs(state.trees).map(([treeId, tree]) => [
        treeId,
        {
          ...tree,
          // TODO: do we really want this to be undefined?
          updatedAt: undefined,
          nodes: fromPairs(
            toPairs(tree.nodes).map(([id, node]) => [
              id,
              // NOTE: measured is something that ReactFlow adds
              // secondarily to nodes onNodesChange
              omit(node, ["selected", "measured"]),
            ]),
          ),
          edges: fromPairs(
            toPairs(tree.edges).map(([id, edge]) => [
              id,
              omit(edge, ["selected"]),
            ]),
          ),
        },
      ]),
    ),
  };
}
