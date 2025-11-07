import { mapValues, memoize, omit } from "es-toolkit";
import { fromPairs, toPairs, values } from "es-toolkit/compat";

import { StoreState } from "@/hooks/use-store";
import { AppEdge, filterTreeEdges } from "@/lib/edge";
import { AppNode } from "@/lib/node";
import { DecisionTree } from "@/lib/tree";
import { Variable } from "@/lib/variable";
import { warnItemNotFound, warnNoCurrentTree } from "@/utils/warn";

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
import { CurrencyCode } from "./Currency";

export function selectCurrentTree(state: StoreState): DecisionTree | undefined {
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

export function selectCurrentNodes(state: StoreState): AppNode[] {
  const currentTree = selectCurrentTree(state);
  return currentTree ? values(currentTree.nodes) : [];
}

export function selectCurrentEdges(state: StoreState): AppEdge[] {
  const currentTree = selectCurrentTree(state);
  return currentTree ? values(currentTree.edges) : [];
}

export function selectCurrentVariables(state: StoreState): Variable[] {
  const currentTree = selectCurrentTree(state);
  return currentTree?.variables ?? [];
}

export function selectCurrentCurrency(state: StoreState): CurrencyCode {
  const currentTree = selectCurrentTree(state);
  return currentTree?.currency ?? "";
}

/**
 * Returns computed values for all nodes in the current tree, performing
 * the expected value calculation on-demand during React component rendering.
 *
 * TODO: better to use createCachedSelector from reselect package?
 * TODO: rename computeNodeValues to computeExpectedValues or computeNetExpectedValues?
 */
export const selectNetExpectedValues = memoize(
  (
    state: StoreState,
  ): {
    nodeValues?: Record<string, number | null>;
    nodeCumulativeCosts?: Record<string, number | null>;
    edgeProbabilities?: Record<string, number | null>;
  } => {
    const { currentTreeId } = state;
    if (!currentTreeId) {
      return {};
    }
    const tree = state.trees[currentTreeId];
    if (!tree) {
      return {};
    }

    // Filter out arrow edges from tree logic calculations
    const treeEdges = filterTreeEdges(values(tree.edges));
    const treeEdgesMap = fromPairs(treeEdges.map((edge) => [edge.id, edge]));

    const { nodes, edges } = computeNodeValues(
      mapValues(tree.nodes, (node) => toComputeNode(node, tree.variables)),
      mapValues(treeEdgesMap, (edge) => toComputeEdge(edge, tree.variables)),
    );

    return {
      nodeValues: mapValues(nodes, (node) => node.data.value),
      nodeCumulativeCosts: mapValues(nodes, (node) => node.data.priorCosts),
      edgeProbabilities: mapValues(
        edges,
        (edge) => edge.data?.probability ?? null,
      ),
    };
  },
);

/**
 * Returns the computed probability for a specific edge.
 */
export function selectComputedProbability(
  state: StoreState,
  edgeId: string,
): number | null {
  const { edgeProbabilities } = selectNetExpectedValues(state);
  return (edgeProbabilities && edgeProbabilities[edgeId]) ?? null;
}

export function selectShouldShowProbabilityWarning(
  state: StoreState,
  edgeId: string,
): boolean {
  const { currentTreeId } = state;
  if (!currentTreeId) {
    return false;
  }
  const tree = state.trees[currentTreeId];
  if (!tree) {
    return false;
  }

  const targetEdge = tree.edges[edgeId];
  if (!targetEdge) {
    return false;
  }

  const { edgeProbabilities } = selectNetExpectedValues(state);
  if (!edgeProbabilities) {
    return false;
  }

  const targetEdgeProbability = edgeProbabilities[edgeId];
  if (targetEdgeProbability === undefined || targetEdgeProbability === null) {
    return false;
  }

  // Find all sibling edges (edges from the same source node), excluding arrow edges
  const treeEdges = filterTreeEdges(values(tree.edges));
  const probabilitySum = treeEdges
    .filter((edge) => edge.source === targetEdge.source)
    .reduce((sum, edge) => {
      const probability = edgeProbabilities[edge.id];
      return sum + (probability ?? 0);
    }, 0);

  return (
    targetEdgeProbability < 0 ||
    targetEdgeProbability > 1 ||
    Math.abs(probabilitySum - 1) > 1e-6 // Allow small floating-point tolerance
  );
}

/**
 * Returns the probability of a node being reached from it's root parent.
 *
 * NOTE: this could be computed in computeNodeValues for all edges in one pass,
 * except that decision nodes can modify edge probabilities based on expected
 * value!
 *
 * TODO: unit tests
 */
export function selectPathProbability(
  state: StoreState,
  nodeId: string,
): number | null {
  const currentTree = selectCurrentTree(state);
  if (!currentTree) {
    return null;
  }

  const { edgeProbabilities } = selectNetExpectedValues(state);
  if (!edgeProbabilities) {
    return null;
  }

  // Build maps for efficient traversal
  const nodeToIncomingEdge = buildNodeToIncomingEdgeMap(currentTree.edges);
  const childToParentEdgeMap = buildChildToParentEdgeMap(currentTree.edges);

  // Find the edge that leads to this node
  const incomingEdgeId = nodeToIncomingEdge[nodeId];

  // If no incoming edge, this is a root node
  if (!incomingEdgeId) {
    return 1.0;
  }

  // Traverse the path from this node back to root, multiplying probabilities
  let totalProbability = 1;
  let currentEdgeId: string | undefined = incomingEdgeId;

  while (currentEdgeId) {
    const edgeProbability = edgeProbabilities[currentEdgeId] ?? null;
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

export function selectPathProbabilities(
  state: StoreState,
  nodeIds: string[],
): Record<string, number | null> {
  return fromPairs(
    nodeIds.map((nodeId) => [nodeId, selectPathProbability(state, nodeId)]),
  );
}

/**
 * Returns the expected value of a node in the tree considering costs along the
 * path to the node.
 */
export function selectNetExpectedValue(
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
  const { nodeValues } = selectNetExpectedValues(state);
  const nodeValue = nodeValues && nodeValues[nodeId];

  return Number.isFinite(nodeValue) ? Number(nodeValue) : null;
}

export function selectCollapsible(
  state: StoreState,
  nodeId: string | undefined,
): { hasChildren: boolean; isCollapsed: boolean } {
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

function selectParentNode(
  state: StoreState,
  nodeId: string | undefined,
): string | undefined {
  const tree = state.trees[state.currentTreeId!];
  if (!nodeId || !tree) {
    return undefined;
  }

  const childToParentMap = buildChildToParentNodeMap(tree.edges);
  return childToParentMap[nodeId];
}

export function selectHasParentNode(
  state: StoreState,
  nodeId: string | undefined,
): boolean {
  return Boolean(selectParentNode(state, nodeId));
}

export function selectHasDecisionNodeSource(
  state: StoreState,
  edgeId: string | undefined,
): boolean {
  const tree = state.trees[state.currentTreeId!];
  if (!edgeId || !tree) {
    return false;
  }
  const edge = tree.edges[edgeId];
  if (!edge || !edge.source) {
    return false;
  }
  return tree.nodes[edge.source]?.type === "decision";
}

export function selectHasSelectedItems(state: StoreState): boolean {
  const tree = selectCurrentTree(state);
  if (!tree) return false;

  const hasSelectedNodes = values(tree.nodes).some((node) => node.selected);
  const hasSelectedEdges = values(tree.edges).some((edge) => edge.selected);

  return hasSelectedNodes || hasSelectedEdges;
}

export function selectHasClipboardContent(state: StoreState): boolean {
  const { clipboard } = state;
  if (!clipboard) return false;
  return clipboard.nodes.length > 0 || clipboard.edges.length > 0;
}

export function selectClipboardNodes(state: StoreState): AppNode[] {
  const { clipboard } = state;
  if (!clipboard) return [];
  return clipboard.nodes;
}

export function selectHasNodes(state: StoreState): boolean {
  const tree = selectCurrentTree(state);
  if (!tree) return false;

  return values(tree.nodes).length > 0;
}

export function selectHasTerminalNodes(state: StoreState): boolean {
  const tree = selectCurrentTree(state);
  if (!tree) return false;

  return values(tree.nodes).some((node) => node.type === "terminal");
}

// NOTE: default here should match useStoreBase definition
export function selectShowEVs(state: StoreState): boolean {
  return state.settings.showEVs ?? false;
}

// NOTE: default here should match useStoreBase definition
export function selectShowHistogram(state: StoreState): boolean {
  return state.settings.showHistogram ?? false;
}

export function selectUndoableState(state: StoreState): StoreState {
  // TODO: is going thru all the users trees necessary? why not just the current tree?
  return {
    ...state,
    // TODO: do we really want this to be undefined?
    clipboard: undefined,
    // NOTE: settings are UI preferences, not part of the tree state
    settings: {} as unknown as StoreState["settings"],
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
