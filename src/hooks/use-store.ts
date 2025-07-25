"use client";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  Position,
} from "@xyflow/react";
import {
  cloneDeep,
  isEqual,
  keyBy,
  omit,
  round,
  throttle,
  toMerged,
} from "es-toolkit";
import { fromPairs, keys, max, toPairs, values } from "es-toolkit/compat";
import { nanoid } from "nanoid";
import { temporal } from "zundo";
import { StateCreator } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";

import bathtubTreeData from "@/utils/demo-bathtub-tree.json";
import demoSexualTreeData from "@/utils/demo-sexual-tree.json";
import { cloneEdge, createEdge } from "@/utils/edge";
import { computeNodeValues } from "@/utils/expectedValue";
import { getLayoutedElements } from "@/utils/layout";
import { cloneNode, createNode } from "@/utils/node";
import { selectComputedNodesAndEdges } from "@/utils/selectors";
import { warnItemNotFound, warnNoCurrentTree } from "@/utils/warn";
import {
  createSelectorFunctions,
  ZustandFuncSelectors,
} from "auto-zustand-selectors-hook";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export type NodeType = "decision" | "chance" | "terminal";

export type AppNode = Node<
  {
    label?: string;
    description?: string;
    // NOTE: it's important for value to have a null value so computed nulls
    // will be merged in. see computeNodeValues
    value: number | null;
    cost: number | null;
  },
  NodeType
>;

// TODO: rename to branch be consistent with decision tree terminology?
export type AppEdge = Edge<{
  label?: string;
  description?: string;
  probability: number | null;
}>;

export interface DecisionTree {
  id: string;
  name: string;
  description?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  nodes: Record<string, AppNode>;
  edges: Record<string, AppEdge>;
}

export interface StoreState {
  trees: Record<string, DecisionTree>;
  currentTreeId: string | null;
  clipboard: { nodes: AppNode[]; edges: AppEdge[] };

  // Tree management
  createTree: (name: string, description?: string) => string;
  deleteTree: (treeId: string) => void;
  setCurrentTree: (treeId: string) => void;
  duplicateTree: (treeId: string, newName: string) => string;
  loadTree: (treeData: DecisionTree) => string;
  onTreeDataUpdate: (
    treeData: Partial<Pick<DecisionTree, "name" | "description">>
  ) => void;

  // Node/Edge operations (work on current tree)
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange<AppEdge>;
  onConnect: OnConnect;
  onNodeDataUpdate: (id: string, nodeData: Partial<AppNode["data"]>) => void;
  onEdgeDataUpdate: (id: string, edgeData: Partial<AppEdge["data"]>) => void;
  balanceEdgeProbability: (id: string) => void;
  onCopy: () => void;
  onPaste: () => void;
  onReset: () => void;
  onCreateNodeAt: (
    position: { x: number; y: number },
    nodeType: NodeType
  ) => void;
  onDragEndCreateNodeAt: (
    position: { x: number; y: number },
    fromNodeId: string
  ) => void;
  onArrange: () => void;
  toggleNodeCollapse: (nodeId: string) => void;
}

const initialNodes = keyBy(
  [
    {
      id: "decision",
      type: "decision",
      data: {
        label: "decision",
        description: "decision description",
        value: null,
        cost: null,
      },
      position: { x: 100, y: 0 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "chance",
      type: "chance",
      data: {
        label: "chance",
        description: "chance description",
        value: null,
        cost: null,
      },
      position: { x: 300, y: 0 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "terminal1",
      type: "terminal",
      data: {
        label: "terminal1",
        description: "terminal1 description",
        value: 500,
        cost: null,
      },
      position: { x: 500, y: -75 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "terminal2",
      type: "terminal",
      data: {
        label: "terminal2",
        description: "terminal2 description",
        value: 1000,
        cost: null,
      },
      position: { x: 500, y: 75 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "terminal3",
      type: "terminal",
      data: {
        label: "terminal3",
        description: "terminal3 description",
        value: 250,
        cost: null,
      },
      position: { x: 300, y: 150 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
  ] as AppNode[],
  (node) => node.id
);

const initialEdges = keyBy(
  [
    {
      id: "decision-chance",
      source: "decision",
      target: "chance",
      type: "custom",
      data: {
        label: "d to c",
        description: "Connection from decision to chance",
        probability: null,
      },
    },
    {
      id: "chance-terminal1",
      source: "chance",
      target: "terminal1",
      type: "custom",
      data: {
        label: "c to t1",
        description: "Path from chance to terminal1",
        probability: 0.5,
      },
    },
    {
      id: "chance-terminal2",
      source: "chance",
      target: "terminal2",
      type: "custom",
      data: {
        label: "c to t2",
        description: "Path from chance to terminal2",
        probability: 0.5,
      },
    },
    {
      id: "decision-terminal3",
      source: "decision",
      target: "terminal3",
      type: "custom",
      data: {
        label: "d to t3",
        description: "Path from decision to terminal3",
        probability: null,
      },
    },
  ] as AppEdge[],
  (edge) => edge.id
);

// Apply initial computations
computeNodeValues(initialNodes, initialEdges);

const initialTrees: Record<string, DecisionTree> = {
  "tree-1": {
    id: "tree-1",
    name: "Hello World Tree",
    description:
      "This is a demo tree that has all the various types of nodes arranged in a typical pattern",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: initialNodes,
    edges: initialEdges,
  },
  [demoSexualTreeData.id]: demoSexualTreeData as unknown as DecisionTree,
  [bathtubTreeData.id]: bathtubTreeData as unknown as DecisionTree,
};

const middlewares = (f: StateCreator<StoreState>) =>
  devtools(
    persist(
      temporal(subscribeWithSelector(immer(f)), {
        // NOTE: throttling is needed for actions like dragging nodes into position
        handleSet: (handleSet) => {
          return throttle<typeof handleSet>(
            (state) => handleSet(state),
            1000, // ignore handleSet for 1 sec following a prev handleSet
            // NOTE: important not have both leading and trailing, or else we
            // get unwanted undo
            { edges: ["leading"] }
          );
        },
        partialize: (state) => {
          // TODO: is going thru all the users trees necessary? why not just the current tree?
          return {
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
                      omit(node, ["selected"]),
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
        },
        // NOTE: deep isEqual instead of shallow. this is needed to prevent
        // spurious undo states. see createWithEqualityFn in contrast.
        // TODO: figure out if this is a perf problem, figure out how to
        // minimize store updates
        equality: isEqual,
      }),
      {
        // TODO: develop migration and invalidation protocol
        name: "evtree-storage-v1",
        // TODO: localStorage or sessionStorage?
        storage: createJSONStorage(() => window.localStorage),
      }
    )
  );

// NOTE: default selector changed to shallow for less re-renders
const useStoreBase = createWithEqualityFn<StoreState>()(
  middlewares((set, get) => ({
    trees: initialTrees,
    currentTreeId: "tree-1", // Default to the first tree
    clipboard: { nodes: [], edges: [] },

    // Tree management functions
    createTree: (name: string, description?: string) => {
      // TODO: extract nanoid12 to a utility function
      // TODO: extract to createTree
      const treeId = nanoid(12);
      const newTree: DecisionTree = {
        id: treeId,
        name,
        description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodes: {},
        edges: {},
      };
      set((state) => {
        state.trees[treeId] = newTree;
        state.currentTreeId = treeId;
        return state;
      });
      return treeId;
    },

    deleteTree: (treeId: string) => {
      set((state) => {
        delete state.trees[treeId];
        // If we deleted the current tree, switch to another one
        if (state.currentTreeId === treeId) {
          const remainingTreeIds = keys(state.trees);
          state.currentTreeId =
            remainingTreeIds.length > 0 ? remainingTreeIds[0]! : null;
        }
        return state;
      });
    },

    loadTree: (treeData: DecisionTree) => {
      const treeId = nanoid(12);
      set((state) => {
        const loadedTree: DecisionTree = {
          ...treeData,
          id: treeId, // Always assign a new ID to avoid conflicts
          // TODO: should do something about duplicate names?
          updatedAt: new Date().toISOString(),
        };
        state.trees[treeId] = loadedTree;
        state.currentTreeId = treeId;
        return state;
      });
      return treeId;
    },

    setCurrentTree: (treeId: string) => {
      set((state) => {
        // Clear selections in current tree before switching
        if (state.currentTreeId) {
          const currentTree = state.trees[state.currentTreeId];
          if (currentTree) {
            // Clear node and edge selections
            clearSelections(currentTree);
          }
        }

        // Switch to new tree
        state.currentTreeId = treeId;
        return state;
      });
    },

    duplicateTree: (treeId: string, newName: string) => {
      const newTreeId = nanoid(12);
      set((state) => {
        const sourceTree = state.trees[treeId];
        if (sourceTree) {
          state.trees[newTreeId] = {
            ...sourceTree,
            id: newTreeId,
            name: newName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          state.currentTreeId = newTreeId;
        }
        return state;
      });
      return newTreeId;
    },

    onTreeDataUpdate: (treeData) => {
      set((state) =>
        withCurrentTree(state, (tree) => {
          if (treeData.name !== undefined) {
            tree.name = treeData.name;
          }
          if (treeData.description !== undefined) {
            tree.description = treeData.description;
          }
          tree.updatedAt = new Date().toISOString();
        })
      );
    },

    onNodesChange(changes) {
      set((state) =>
        withCurrentTree(state, (tree) => {
          const updatedNodesArray = applyNodeChanges(
            changes,
            values(tree.nodes)
          );
          tree.nodes = keyBy(updatedNodesArray, (node) => node.id);
          tree.updatedAt = new Date().toISOString();
        })
      );
    },

    onEdgesChange(changes) {
      set((state) =>
        withCurrentTree(state, (tree) => {
          const updatedEdgesArray = applyEdgeChanges(
            changes,
            values(tree.edges)
          );
          tree.edges = keyBy(updatedEdgesArray, (edge) => edge.id);
          tree.updatedAt = new Date().toISOString();
        })
      );
    },

    // TODO: still not selecting newEdge always!
    onConnect: (connection) => {
      set((state) =>
        withCurrentTree(state, (tree) => {
          const { source: fromNodeId, target: nodeId } = connection;
          clearSelections(tree);
          const newEdge = createEdge(fromNodeId, nodeId);
          const updatedEdgesArray = addEdge(newEdge, values(tree.edges));
          tree.edges = keyBy(updatedEdgesArray, (edge) => edge.id);
          tree.updatedAt = new Date().toISOString();
        })
      );
    },

    onNodeDataUpdate: (id, nodeData) => {
      set((state) =>
        withCurrentTree(state, (tree) => {
          const node = tree.nodes[id];
          if (node) {
            node.data = { ...node.data, ...nodeData };
            tree.updatedAt = new Date().toISOString();
          } else {
            warnItemNotFound("Node", id, "data update");
          }
        })
      );
    },

    onEdgeDataUpdate: (id, edgeData) => {
      set((state) =>
        withCurrentTree(state, (tree) => {
          const edge = tree.edges[id];
          if (edge) {
            const currentData = edge.data ?? {
              label: undefined,
              description: undefined,
              probability: null,
            };
            edge.data = {
              ...currentData,
              ...edgeData,
              probability:
                edgeData?.probability !== undefined
                  ? edgeData.probability
                  : currentData.probability,
            };
            tree.updatedAt = new Date().toISOString();
          } else {
            warnItemNotFound("Edge", id, "data update");
          }
        })
      );
    },

    balanceEdgeProbability(id) {
      set((state) =>
        withCurrentTree(state, (tree) => {
          const targetEdge = tree.edges[id];
          if (!targetEdge) {
            warnItemNotFound("Edge", id, "balance edge probability");
            return;
          }

          // Find all sibling edges (edges from the same source node)
          const siblingEdges = values(tree.edges).filter(
            (edge) => edge.source === targetEdge.source
          );

          // Calculate sum of existing probabilities (excluding the target edge)
          const existingProbabilitySum = siblingEdges
            .filter(
              (edge) => edge.id !== id && edge.data?.probability !== undefined
            )
            .reduce((sum, edge) => sum + (edge.data?.probability ?? 0), 0);

          // Count undefined probabilities (including the target edge)
          const undefinedProbabilityCount = siblingEdges.filter(
            (edge) => edge.data?.probability === undefined || edge.id === id
          ).length;

          // Calculate balanced probability, round to 2 decimals
          const balancedProbability = round(
            max([0, 1.0 - existingProbabilitySum])! / undefinedProbabilityCount,
            2
          );
          const edge = tree.edges[id];
          if (edge && edge.data) {
            edge.data.probability = balancedProbability;
            tree.updatedAt = new Date().toISOString();
          } else {
            warnItemNotFound("Edge", id, "data update");
          }
        })
      );
    },

    onCopy: () => {
      set((state) =>
        withCurrentTree(state, (tree) => {
          const nodes = values(tree.nodes);
          const edges = values(tree.edges);

          state.clipboard = {
            // NOTE: important to cloneDeep to avoid reference issues!
            nodes: cloneDeep(nodes.filter((node) => node.selected)),
            edges: cloneDeep(edges.filter((edge) => edge.selected)),
          };
        })
      );
    },

    onPaste: () => {
      const { clipboard } = get();
      set((state) =>
        withCurrentTree(state, (tree) => {
          const PASTE_OFFSET = 50;
          const nodeIdMap = new Map<string, string>();

          // Clear current selections
          clearSelections(tree);

          // First pass: create nodes with offset positions and build ID mapping
          clipboard.nodes.forEach((clipboardNode) => {
            const position = {
              x: clipboardNode.position.x + PASTE_OFFSET,
              y: clipboardNode.position.y + PASTE_OFFSET,
            };
            const newNode = cloneNode(clipboardNode, position);
            tree.nodes[newNode.id] = newNode;
            nodeIdMap.set(clipboardNode.id, newNode.id);
          });

          // Second pass: create edges with updated source/target IDs
          clipboard.edges.forEach((clipboardEdge) => {
            const newSourceId = nodeIdMap.get(clipboardEdge.source);
            const newTargetId = nodeIdMap.get(clipboardEdge.target);

            if (newSourceId && newTargetId) {
              const newEdge = cloneEdge(
                clipboardEdge,
                newSourceId,
                newTargetId
              );
              tree.edges[newEdge.id] = newEdge;
            }
          });

          tree.updatedAt = new Date().toISOString();
        })
      );
    },

    onReset: () => {
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("reset");
        return;
      }

      set((state) => ({
        ...state,
        trees: initialTrees,
        clipboard: { nodes: [], edges: [] },
      }));
    },

    onCreateNodeAt: (position, nodeType) => {
      set((state) =>
        withCurrentTree(state, (tree) => {
          const newNode = createNode(position, nodeType);
          clearSelections(tree);
          tree.nodes[newNode.id] = newNode;
          tree.updatedAt = new Date().toISOString();
        })
      );
    },

    // TODO: should this be in the store at all or should we just rely on onNodesChange?
    // And review all other store methods!
    // TODO: why are newEdge and newNode not selected after create on canvas?
    onDragEndCreateNodeAt: (position, fromNodeId) => {
      set((state) =>
        withCurrentTree(state, (tree) => {
          const newNode = createNode(position);
          const newEdge = createEdge(fromNodeId, newNode.id);
          tree.nodes[newNode.id] = newNode;
          tree.edges[newEdge.id] = newEdge;
          // TODO: use dayjs?
          tree.updatedAt = new Date().toISOString();
        })
      );
    },

    // TODO: it would be great if auto arrange somehow preserve the relative order of nodes and edges
    onArrange: () => {
      set((state) =>
        withCurrentTree(state, (tree) => {
          const { nodes, edges } = getLayoutedElements(
            values(tree.nodes),
            values(tree.edges)
          );
          tree.nodes = keyBy(nodes, (node) => node.id);
          tree.edges = keyBy(edges, (edge) => edge.id);
          tree.updatedAt = new Date().toISOString();
        })
      );
    },

    toggleNodeCollapse: (nodeId: string) => {
      set((state) =>
        withCurrentTree(state, (tree) => {
          // Find all descendant nodes and edges using a stack-based traversal
          const outgoers: string[] = [];
          const connectedEdges: string[] = [];
          const stack = [nodeId];
          const seen = new Set<string>();

          while (stack.length > 0) {
            const currentNodeId = stack.pop()!;
            if (seen.has(currentNodeId)) continue;
            seen.add(currentNodeId);

            // Find all edges that start from this node
            const childEdges = values(tree.edges).filter(
              (edge) => edge.source === currentNodeId
            );

            childEdges.forEach((edge) => {
              connectedEdges.push(edge.id);
              const childNodeId = edge.target;

              // Only add if it's not the original node
              if (childNodeId !== nodeId) {
                outgoers.push(childNodeId);
                stack.push(childNodeId);
              }
            });
          }

          // Toggle hidden state for all descendant nodes and edges
          const shouldHide =
            outgoers.length > 0 ? !tree.nodes[outgoers[0]!]?.hidden : true;

          outgoers.forEach((nodeId) => {
            if (tree.nodes[nodeId]) {
              tree.nodes[nodeId].hidden = shouldHide;
            }
          });

          connectedEdges.forEach((edgeId) => {
            if (tree.edges[edgeId]) {
              tree.edges[edgeId].hidden = shouldHide;
            }
          });

          // TODO: implement tree.updatedAt as a store subscription? or put in
          // existing subscribe?
          tree.updatedAt = new Date().toISOString();
        })
      );
    },
  })),
  shallow
);

/**
 * This is a store subscription that re-computes node values. It selects only the subset of node and edge data needed to
 * trigger re-computation only when needed.
 * @see https://zustand.docs.pmnd.rs/middlewares/subscribe-with-selector
 *
 * NOTE: needs to be idempotent to prevent infinite loops
 *
 * TODO: check worst-case performance of this subscription... it could be
 * slow... it would be better if we just passed patches back and forth
 *
 * TODO: is this messing up undo history? It seems like it is, because it is
 * adding extra states
 */
useStoreBase.subscribe(
  selectComputedNodesAndEdges,
  ({ computeNodes, computeEdges }) => {
    const { nodes: updatedComputeNodes, edges: updatedComputeEdges } =
      computeNodeValues(computeNodes, computeEdges);
    const state = useStoreBase.getState();
    withCurrentTree(state, (tree) => {
      // NOTE: need to maintain immutability here
      useStoreBase.setState({
        trees: {
          ...state.trees,
          [tree.id]: {
            ...tree,
            nodes: toMerged(tree.nodes, updatedComputeNodes),
            edges: toMerged(tree.edges, updatedComputeEdges),
          },
        },
      });
    });
  },
  {
    // NOTE: deep isEqual instead of shallow. this is needed to prevent
    // spurious undo states. see createWithEqualityFn in contrast.
    // TODO: figure out if this is a perf problem, figure out how to
    // minimize store updates
    equalityFn: isEqual,
  }
);

// TODO: consider more 3rd party libs like shared-zustand or simple-zustand-devtools
// from https://zustand.docs.pmnd.rs/integrations/third-party-libraries

// NOTE: see https://github.com/Albert-Gao/auto-zustand-selectors-hook
export const useStore = createSelectorFunctions(
  useStoreBase
) as typeof useStoreBase & ZustandFuncSelectors<StoreState>;

function clearSelections(currentTree: DecisionTree) {
  [...values(currentTree.nodes), ...values(currentTree.edges)]
    .filter((item) => item.selected)
    .forEach((item) => {
      item.selected = false;
    });
}

function withCurrentTree(
  state: StoreState,
  callback: (tree: DecisionTree) => void
): StoreState {
  const { currentTreeId } = state;
  if (!currentTreeId) {
    warnNoCurrentTree();
    return state;
  }
  const tree = state.trees[currentTreeId];
  if (tree) {
    callback(tree);
  } else {
    warnItemNotFound("Tree", currentTreeId);
  }
  return state;
}
