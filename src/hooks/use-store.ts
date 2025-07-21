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
import { isEqual, keyBy, omit, throttle, toMerged } from "es-toolkit";
import { fromPairs, isEmpty, keys, toPairs, values } from "es-toolkit/compat";
import { nanoid } from "nanoid";
import { temporal } from "zundo";
import { StateCreator } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";

import { cloneEdge, createEdge } from "@/utils/edge";
import { computeNodeValues } from "@/utils/expectedValue";
import { getLayoutedElements } from "@/utils/layout";
import { cloneNode, createNode, NodeType } from "@/utils/node";
import { selectComputedNodesAndEdges } from "@/utils/selectors";
import { warnItemNotFound, warnNoCurrentTree } from "@/utils/warn";
import {
  createSelectorFunctions,
  ZustandFuncSelectors,
} from "auto-zustand-selectors-hook";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// TODO: fill in AppNode and AppEdge types with custom data, and tighten up
export type AppNode = Node<{
  label?: string;
  description?: string;
  value?: number;
}>;
export type AppEdge = Edge<{
  label?: string;
  description?: string;
  probability?: number;
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

  // TODO: consider separate selector functions like selectCurrentTree for memoization
  // TODO: shorten selector names
  // Selectors for current tree
  getCurrentTree: () => DecisionTree | null;
  getCurrentNodes: () => AppNode[];
  getCurrentEdges: () => AppEdge[];

  // Node/Edge operations (work on current tree)
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange<AppEdge>;
  onConnect: OnConnect;
  onNodeDataUpdate: (id: string, nodeData: Partial<AppNode["data"]>) => void;
  onEdgeDataUpdate: (id: string, edgeData: Partial<AppEdge["data"]>) => void;
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
      id: "square",
      type: "square",
      data: {
        label: "square",
        description: "square description",
        value: undefined,
      },
      position: { x: 100, y: 0 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "circle",
      type: "circle",
      data: {
        label: "circle",
        description: "circle description",
        value: undefined,
      },
      position: { x: 300, y: 0 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "triangle1",
      type: "triangle",
      data: {
        label: "triangle1",
        description: "triangle1 description",
        value: 500,
      },
      position: { x: 500, y: -75 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "triangle2",
      type: "triangle",
      data: {
        label: "triangle2",
        description: "triangle2 description",
        value: 1000,
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
      id: "square-circle",
      source: "square",
      target: "circle",
      type: "custom",
      data: {
        label: "s to c",
        description: "Connection from square to circle",
        probability: 1.0,
      },
    },
    {
      id: "circle-triangle1",
      source: "circle",
      target: "triangle1",
      type: "custom",
      data: {
        label: "c to t1",
        description: "Path from circle to triangle1",
        value: 1000,
        probability: 0.5,
      },
    },
    {
      id: "circle-triangle2",
      source: "circle",
      target: "triangle2",
      type: "custom",
      data: {
        label: "c to t2",
        description: "Path from circle to triangle2",
        value: 0,
        probability: 0.5,
      },
    },
  ] as AppEdge[],
  (edge) => edge.id
);

computeNodeValues(initialNodes, initialEdges);

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
            remainingTreeIds.length > 0 ? remainingTreeIds[0] : null;
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
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("tree data update");
        return;
      }

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (tree) {
          if (treeData.name !== undefined) {
            tree.name = treeData.name;
          }
          if (treeData.description !== undefined) {
            tree.description = treeData.description;
          }
          tree.updatedAt = new Date().toISOString();
        } else {
          warnItemNotFound("Tree", currentTreeId, "tree data update");
        }
        return state;
      });
    },

    // Selectors for current tree
    getCurrentTree: () => {
      const { trees, currentTreeId } = get();
      return currentTreeId ? trees[currentTreeId] || null : null;
    },

    getCurrentNodes: () => {
      const currentTree = get().getCurrentTree();
      return currentTree ? values(currentTree.nodes) : [];
    },

    getCurrentEdges: () => {
      const currentTree = get().getCurrentTree();
      return currentTree ? values(currentTree.edges) : [];
    },

    // ReactFlow operations (work on current tree)
    onNodesChange(changes) {
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("nodes change");
        return;
      }

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (tree) {
          const updatedNodesArray = applyNodeChanges(
            changes,
            values(tree.nodes)
          );
          tree.nodes = keyBy(updatedNodesArray, (node) => node.id);
          tree.updatedAt = new Date().toISOString();
        } else {
          warnItemNotFound("Tree", currentTreeId, "nodes change");
        }
        return state;
      });
    },

    onEdgesChange(changes) {
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("edges change");
        return;
      }

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (tree) {
          const updatedEdgesArray = applyEdgeChanges(
            changes,
            values(tree.edges)
          );
          tree.edges = keyBy(updatedEdgesArray, (edge) => edge.id);
          tree.updatedAt = new Date().toISOString();
        } else {
          warnItemNotFound("Tree", currentTreeId, "edges change");
        }
        return state;
      });
    },

    onConnect: (connection) => {
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("connection");
        return;
      }

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (tree) {
          const { source: fromNodeId, target: nodeId } = connection;
          const newEdge = createEdge(fromNodeId, nodeId);
          const updatedEdgesArray = addEdge(newEdge, values(tree.edges));
          tree.edges = keyBy(updatedEdgesArray, (edge) => edge.id);
          tree.updatedAt = new Date().toISOString();
        } else {
          warnItemNotFound("Tree", currentTreeId, "connection");
        }
        return state;
      });
    },

    onNodeDataUpdate: (id, nodeData) => {
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("node data update");
        return;
      }

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (tree) {
          const node = tree.nodes[id];
          if (node) {
            node.data = { ...node.data, ...nodeData };
            tree.updatedAt = new Date().toISOString();
          } else {
            warnItemNotFound("Node", id, "data update");
          }
        } else {
          warnItemNotFound("Tree", currentTreeId, "node data update");
        }
        return state;
      });
    },

    onEdgeDataUpdate: (id, edgeData) => {
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("edge data update");
        return;
      }

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (tree) {
          const edge = tree.edges[id];
          if (edge) {
            edge.data = { ...edge.data, ...edgeData };
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
              if (edge.source === node.id || edge.target === node.id) {
                delete tree.edges[edgeId];
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
      const { getCurrentNodes, getCurrentEdges } = get();
      const nodes = getCurrentNodes();
      const edges = getCurrentEdges();

      set({
        clipboard: {
          nodeIds: nodes.filter((node) => node.selected).map((node) => node.id),
          edgeIds: edges.filter((edge) => edge.selected).map((edge) => edge.id),
        },
      });
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
            tree.nodes[nodeId].selected = false;
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
              tree.edges[edgeId].selected = false;
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
      const { currentTreeId, getCurrentNodes, getCurrentEdges } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("arrange");
        return;
      }

      set((state) => {
        const tree = state.trees[currentTreeId];
        if (tree) {
          const { nodes, edges } = getLayoutedElements(
            getCurrentNodes(),
            getCurrentEdges()
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
 */
useStoreBase.subscribe(
  selectComputedNodesAndEdges,
  ({ computeNodes, computeEdges }) => {
    if (isEmpty(computeNodes) && isEmpty(computeEdges)) {
      return;
    }
    const updatedComputeNodes = computeNodeValues(computeNodes, computeEdges);
    const state = useStoreBase.getState();
    const currentTreeId = state.currentTreeId!;
    const currentTree = state.trees[currentTreeId];
    useStoreBase.setState({
      trees: {
        ...state.trees,
        [currentTreeId]: {
          ...currentTree,
          nodes: toMerged(currentTree.nodes, updatedComputeNodes),
        },
      },
    });
  },
  // TODO: will the deep equal be too slow?
  { equalityFn: isEqual }
);

// TODO: consider more 3rd party libs like shared-zustand or simple-zustand-devtools
// from https://zustand.docs.pmnd.rs/integrations/third-party-libraries

// NOTE: see https://github.com/Albert-Gao/auto-zustand-selectors-hook
export const useStore = createSelectorFunctions(
  useStoreBase
) as typeof useStoreBase & ZustandFuncSelectors<StoreState>;
