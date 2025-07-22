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
  OnNodesDelete,
  Position,
} from "@xyflow/react";
import {
  isEqual,
  keyBy,
  mapValues,
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

// TODO: fill in AppNode and AppEdge types with custom data, and tighten up
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
  clipboard: { nodeIds: AppNode["id"][]; edgeIds: AppEdge["id"][] };

  // Tree management
  createTree: (name: string, description?: string) => string;
  deleteTree: (treeId: string) => void;
  setCurrentTree: (treeId: string) => void;
  duplicateTree: (treeId: string, newName: string) => string;
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
  onNodesDelete: OnNodesDelete<AppNode>;
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
        probability: 1.0,
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
  ] as AppEdge[],
  (edge) => edge.id
);

// Apply initial computations
const { nodes: computedNodes, edges: computedEdges } = computeNodeValues(
  mapValues(initialNodes, (node: AppNode) => ({
    id: node.id,
    type: node.type,
    data: { value: node.data.value, cost: node.data.cost },
  })),
  mapValues(initialEdges, (edge: AppEdge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: { probability: edge.data?.probability ?? null },
  }))
);

// Merge computed values back into initial nodes and edges
Object.keys(computedNodes).forEach((nodeId) => {
  if (initialNodes[nodeId]) {
    initialNodes[nodeId]!.data.value = computedNodes[nodeId]!.data.value;
  }
});

Object.keys(computedEdges).forEach((edgeId) => {
  if (initialEdges[edgeId] && computedEdges[edgeId]!.data) {
    if (!initialEdges[edgeId]!.data) {
      initialEdges[edgeId]!.data = {
        label: undefined,
        description: undefined,
        probability: null,
      };
    }
    initialEdges[edgeId]!.data!.probability =
      computedEdges[edgeId]!.data!.probability;
  }
});

const initialTrees: Record<string, DecisionTree> = {
  "tree-1": {
    id: "tree-1",
    name: "Default Tree",
    description: "This is the default decision tree",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: initialNodes,
    edges: initialEdges,
  },
};

// TODO: should exclude selection from being persisted?
const middlewares = (f: StateCreator<StoreState>) =>
  devtools(
    persist(
      // TODO: bug in zundo onNodesDelete... edges do take another undo to come back!
      temporal(subscribeWithSelector(immer(f)), {
        // NOTE: throttling is needed for dragging nodes into position
        handleSet: (handleSet) => {
          // TODO: onDragEndCreateNodeAt sometimes takes 3 clicks to undo
          return throttle<typeof handleSet>((state) => {
            handleSet(state);
          }, 1000);
        },
        // NOTE: we don't want to track selection in history
        partialize: (state) => {
          // TODO: is going thru all the users trees necessary? why not just the current tree?
          return {
            ...state,
            trees: fromPairs(
              toPairs(state.trees).map(([treeId, tree]) => [
                treeId,
                {
                  ...tree,
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
        // HACK: deep isEqual instead of shallow to fix extra pastState with undo after paste
        // TODO: figure out the extra store updates, then mirror the useStore hook
        // one-level-deep compare. See createWithEqualityFn.
        equality: (pastState, currentState) => isEqual(pastState, currentState),
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
    clipboard: { nodeIds: [], edgeIds: [] },

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
        nodes: initialNodes,
        edges: initialEdges,
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

    setCurrentTree: (treeId: string) => {
      set((state) => {
        // Clear selections in current tree before switching
        if (state.currentTreeId) {
          const currentTree = state.trees[state.currentTreeId];
          if (currentTree) {
            // TODO: extract to shared function clearCurrentSelection
            // Clear node and edge selections
            [...values(currentTree.nodes), ...values(currentTree.edges)]
              .filter((item) => item.selected)
              .forEach((item) => {
                item.selected = false;
              });
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

    // ReactFlow operations (work on current tree)
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

    onConnect: (connection) => {
      set((state) =>
        withCurrentTree(state, (tree) => {
          const { source: fromNodeId, target: nodeId } = connection;
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
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("balance edge probability");
        return;
      }

      const tree = get().trees[currentTreeId];
      if (!tree) {
        warnItemNotFound("Tree", currentTreeId, "balance edge probability");
        return;
      }

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

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (tree) {
          const edge = tree.edges[id];
          if (edge && edge.data) {
            edge.data.probability = balancedProbability;
            tree.updatedAt = new Date().toISOString();
          } else {
            warnItemNotFound("Edge", id, "data update");
          }
        } else {
          warnItemNotFound("Tree", currentTreeId, "edge data update");
        }
        return state;
      });
    },

    onNodesDelete: (deleted) => {
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("nodes delete");
        return;
      }

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (tree) {
          deleted.forEach((node) => {
            delete tree.nodes[node.id];
            // Remove edges connected to the deleted node
            keys(tree.edges).forEach((edgeId) => {
              const edge = tree.edges[edgeId];
              if (edge) {
                if (edge.source === node.id || edge.target === node.id) {
                  delete tree.edges[edgeId];
                }
              } else {
                warnItemNotFound("Edge", edgeId, "nodes delete");
              }
            });
          });
          tree.updatedAt = new Date().toISOString();
        } else {
          warnItemNotFound("Tree", currentTreeId, "nodes delete");
        }
        return state;
      });
    },

    onCopy: () => {
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("copy");
        return;
      }

      set((state) =>
        withCurrentTree(state, (tree) => {
          const nodes = values(tree.nodes);
          const edges = values(tree.edges);

          state.clipboard = {
            nodeIds: nodes
              .filter((node) => node.selected)
              .map((node) => node.id),
            edgeIds: edges
              .filter((edge) => edge.selected)
              .map((edge) => edge.id),
          };
        })
      );
    },

    onPaste: () => {
      const { currentTreeId, clipboard } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("paste");
        return;
      }

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (!tree) return state;

        const PASTE_OFFSET = 50;
        const nodeIdMap = new Map<string, string>();

        // First pass: create nodes with offset positions and build ID mapping
        clipboard.nodeIds.forEach((nodeId) => {
          const node = tree.nodes[nodeId];
          if (node) {
            const position = {
              x: node.position.x + PASTE_OFFSET,
              y: node.position.y + PASTE_OFFSET,
            };
            const newNode = cloneNode(node, position);
            tree.nodes[newNode.id] = newNode;
            nodeIdMap.set(nodeId, newNode.id);
            node.selected = false;
          } else {
            warnItemNotFound("Node", nodeId, "paste");
          }
        });

        // Second pass: create edges with updated source/target IDs
        clipboard.edgeIds.forEach((edgeId) => {
          const edge = tree.edges[edgeId];
          if (edge) {
            const newSourceId = nodeIdMap.get(edge.source);
            const newTargetId = nodeIdMap.get(edge.target);

            if (newSourceId && newTargetId) {
              const newEdge = cloneEdge(edge, newSourceId, newTargetId);
              tree.edges[newEdge.id] = newEdge;
              edge.selected = false;
            }
          } else {
            warnItemNotFound("Edge", edgeId, "paste");
          }
        });

        tree.updatedAt = new Date().toISOString();
        return state;
      });
    },

    onReset: () => {
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("reset");
        return;
      }

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (tree) {
          tree.nodes = initialNodes;
          tree.edges = initialEdges;
          tree.updatedAt = new Date().toISOString();
        } else {
          warnItemNotFound("Tree", currentTreeId, "reset");
        }
        return state;
      });

      set({ clipboard: { nodeIds: [], edgeIds: [] } });
    },

    onCreateNodeAt: (position, nodeType) => {
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("create node");
        return;
      }

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (tree) {
          const newNode = createNode(position, nodeType);
          tree.nodes[newNode.id] = newNode;
          tree.updatedAt = new Date().toISOString();
          // Clear current selection and select the new node
          values(tree.nodes).forEach((node) => {
            node.selected = node.id === newNode.id;
          });
          values(tree.edges).forEach((edge) => {
            edge.selected = false;
          });
        } else {
          warnItemNotFound("Tree", currentTreeId, "create node");
        }
        return state;
      });
    },

    onDragEndCreateNodeAt: (position, fromNodeId) => {
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("drag end create node");
        return;
      }

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (tree) {
          const newNode = createNode(position);
          const newEdge = createEdge(fromNodeId, newNode.id);
          // TODO: why not selected after create on canvas?
          tree.nodes[newNode.id] = newNode;
          tree.edges[newEdge.id] = newEdge;
          // TODO: use dayjs?
          tree.updatedAt = new Date().toISOString();
        } else {
          warnItemNotFound("Tree", currentTreeId, "drag end create node");
        }
        return state;
      });
    },

    onArrange: () => {
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("arrange");
        return;
      }

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (tree) {
          const { nodes, edges } = getLayoutedElements(
            values(tree.nodes),
            values(tree.edges)
          );
          tree.nodes = keyBy(nodes, (node) => node.id);
          tree.edges = keyBy(edges, (edge) => edge.id);
          tree.updatedAt = new Date().toISOString();
        } else {
          warnItemNotFound("Tree", currentTreeId, "arrange");
        }
        return state;
      });
    },
  })),
  shallow
);

/**
 * This is a store subscription that re-computes node values. It selects only the subset of node and edge data needed to
 * trigger re-computation only when needed.
 * @see https://zustand.docs.pmnd.rs/middlewares/subscribe-with-selector
 *
 * TODO: check worst-case performance of this subscription... it could be slow
 *
 * TODO: how to guarantee idempotentcy of this subscription to prevent infinite loops?
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
  // TODO: will the deep equal be too slow?
  // { equalityFn: isEqual }
  { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
);

// TODO: consider more 3rd party libs like shared-zustand or simple-zustand-devtools
// from https://zustand.docs.pmnd.rs/integrations/third-party-libraries

// NOTE: see https://github.com/Albert-Gao/auto-zustand-selectors-hook
export const useStore = createSelectorFunctions(
  useStoreBase
) as typeof useStoreBase & ZustandFuncSelectors<StoreState>;

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
