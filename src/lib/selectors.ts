import { mapValues, omit } from "es-toolkit";
import { fromPairs, toPairs, values } from "es-toolkit/compat";

import { TreeStoreState } from "@/hooks/use-tree-store";
import { AppEdge, filterTreeEdges } from "@/lib/edge";
import { AppNode } from "@/lib/node";
import { DecisionTree } from "@/lib/tree";
import { Variable } from "@/lib/variable";
import { memoizeWeak } from "@/utils/memoize";
import { warnItemNotFound, warnNoCurrentTree } from "@/utils/warn";

import {
  computeNodeValues,
  toComputeEdge,
  toComputeNode,
} from "../lib/expectedValue";
import {
  getChildToParentEdgeMap,
  getChildToParentNodeMap,
  getNodeToIncomingEdgeMap,
  getParentToChildNodeMap,
} from "../lib/maps";
import { CurrencyCode } from "./currency";
import { RoundingCode } from "./rounding";

export function selectCurrentTree(
  state: TreeStoreState,
): DecisionTree | undefined {
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

export function selectCurrentNodes(state: TreeStoreState): AppNode[] {
  const currentTree = selectCurrentTree(state);
  return currentTree ? values(currentTree.nodes) : [];
}

export function selectCurrentEdges(state: TreeStoreState): AppEdge[] {
  const currentTree = selectCurrentTree(state);
  return currentTree ? values(currentTree.edges) : [];
}

export function selectCurrentVariables(state: TreeStoreState): Variable[] {
  const currentTree = selectCurrentTree(state);
  return currentTree?.variables ?? [];
}

export function selectCurrentCurrency(state: TreeStoreState): CurrencyCode {
  const currentTree = selectCurrentTree(state);
  return currentTree?.currency ?? "";
}

export function selectCurrentRounding(state: TreeStoreState): RoundingCode {
  const currentTree = selectCurrentTree(state);
  return currentTree?.rounding ?? "";
}

export function selectCurrentTerminalValueDisplay(
  state: TreeStoreState,
): "outcome" | "net" {
  const currentTree = selectCurrentTree(state);
  return currentTree?.terminalValueDisplay ?? "net";
}

export interface NetExpectedValues {
  nodeValues?: Record<string, number | null>;
  nodeCumulativeCosts?: Record<string, number | null>;
  edgeProbabilities?: Record<string, number | null>;
}

// NOTE: memoized on the tree, not the store state, so it's only recomputed
// when the current tree changes
export const computeNetExpectedValues = memoizeWeak(
  (tree: DecisionTree): NetExpectedValues => {
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
 * Returns computed values for all nodes in the current tree, performing
 * the expected value calculation on-demand during React component rendering.
 *
 * QUESTION: rename computeNodeValues to computeExpectedValues or computeNetExpectedValues?
 */
export function selectNetExpectedValues(
  state: TreeStoreState,
): NetExpectedValues {
  const { currentTreeId } = state;
  if (!currentTreeId) {
    return {};
  }
  const tree = state.trees[currentTreeId];
  if (!tree) {
    return {};
  }
  return computeNetExpectedValues(tree);
}

/**
 * Returns the computed probability for a specific edge.
 */
export function selectComputedProbability(
  state: TreeStoreState,
  edgeId: string,
): number | null {
  const { edgeProbabilities } = selectNetExpectedValues(state);
  return (edgeProbabilities && edgeProbabilities[edgeId]) ?? null;
}

export function selectShouldShowProbabilityWarning(
  state: TreeStoreState,
  edgeId: string,
  significantDigits: number,
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

  // Find all sibling edges (edges from the same source node), excluding arrow edges
  const treeEdges = filterTreeEdges(values(tree.edges));
  const probabilitySum = treeEdges
    .filter((edge) => edge.source === targetEdge.source)
    .reduce((sum, edge) => {
      const probability = edgeProbabilities[edge.id];
      return sum + (probability ?? 0);
    }, 0);

  const targetEdgeProbability = edgeProbabilities[edgeId] ?? 0;
  const lastEdited = state.display.lastEditedProbability;
  const isLastEdited =
    lastEdited?.treeId === tree.id && lastEdited.edgeId === edgeId;
  return (
    targetEdgeProbability < 0 ||
    targetEdgeProbability > 1 ||
    // NOTE: only show sum warning if there is at least some probability
    // assigned in a group of branches
    // NOTE: suppress warning on the last edited edge, because we assume the
    // user intended it and will only want to change other edges if necessary
    (!isLastEdited &&
      probabilitySum > 0 &&
      // NOTE: Should always allow small floating-point tolerance
      Math.abs(probabilitySum - 1) > 10 ** -significantDigits)
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
 * TODO: some kind of caching to avoid O(n^2) worst case
 */
export function selectPathProbability(
  state: TreeStoreState,
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
  const nodeToIncomingEdge = getNodeToIncomingEdgeMap(currentTree.edges);
  const childToParentEdgeMap = getChildToParentEdgeMap(currentTree.edges);

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
  state: TreeStoreState,
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
  state: TreeStoreState,
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
  state: TreeStoreState,
  nodeId: string | undefined,
): { hasChildren: boolean; isCollapsed: boolean } {
  const tree = state.trees[state.currentTreeId!];
  if (!nodeId || !tree) {
    return { hasChildren: false, isCollapsed: false };
  }

  const parentToChildMap = getParentToChildNodeMap(tree.edges);
  const children = parentToChildMap[nodeId];
  const hasChildren = children ? children.length > 0 : false;

  // Check if any child is hidden to determine collapsed state
  const isCollapsed =
    hasChildren && !!children?.some((nodeId) => tree.nodes[nodeId]?.hidden);

  return { hasChildren, isCollapsed };
}

function selectParentNode(
  state: TreeStoreState,
  nodeId: string | undefined,
): string | undefined {
  const tree = state.trees[state.currentTreeId!];
  if (!nodeId || !tree) {
    return undefined;
  }

  const childToParentMap = getChildToParentNodeMap(tree.edges);
  return childToParentMap[nodeId];
}

export function selectHasParentNode(
  state: TreeStoreState,
  nodeId: string | undefined,
): boolean {
  return Boolean(selectParentNode(state, nodeId));
}

export function selectHasDecisionNodeSource(
  state: TreeStoreState,
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

export function selectHasSelectedItems(state: TreeStoreState): boolean {
  const tree = selectCurrentTree(state);
  if (!tree) return false;

  const hasSelectedNodes = values(tree.nodes).some((node) => node.selected);
  const hasSelectedEdges = values(tree.edges).some((edge) => edge.selected);

  return hasSelectedNodes || hasSelectedEdges;
}

export function selectHasClipboardContent(state: TreeStoreState): boolean {
  const { clipboard } = state;
  if (!clipboard) return false;
  return clipboard.nodes.length > 0 || clipboard.edges.length > 0;
}

export function selectClipboardNodes(state: TreeStoreState): AppNode[] {
  const { clipboard } = state;
  if (!clipboard) return [];
  return clipboard.nodes;
}

export function selectHasNodes(state: TreeStoreState): boolean {
  const tree = selectCurrentTree(state);
  if (!tree) return false;

  return values(tree.nodes).length > 0;
}

export function selectHasTerminalNodes(state: TreeStoreState): boolean {
  const tree = selectCurrentTree(state);
  if (!tree) return false;

  return values(tree.nodes).some((node) => node.type === "terminal");
}

// NOTE: default here should match useTreeStoreBase definition
export function selectShowEVs(state: TreeStoreState): boolean {
  return state.display.showEVs ?? false;
}

export function selectShowPathEVs(state: TreeStoreState): boolean {
  return state.display.showPathEVs ?? true;
}

// NOTE: default here should match useTreeStoreBase definition
export function selectShowHistogram(state: TreeStoreState): boolean {
  return state.display.showHistogram ?? false;
}

export function selectShowIssues(state: TreeStoreState): boolean {
  return state.display.showIssues ?? false;
}

export function selectUndoableState(
  state: TreeStoreState,
): Omit<TreeStoreState, "clipboard" | "display"> {
  // QUESTION: is going thru all the users trees necessary? why not just the current tree?
  return omit(
    {
      ...state,
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
    },
    ["clipboard", "display"],
  );
}
