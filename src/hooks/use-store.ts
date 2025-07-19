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
import { isEqual, keyBy, omit } from "es-toolkit";
import { fromPairs, keys, toPairs, values } from "es-toolkit/compat";
import { nanoid } from "nanoid";
import { temporal } from "zundo";
import { StateCreator } from "zustand";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";

import { getLayoutedElements } from "@/utils/layout";
import {
  createSelectorFunctions,
  ZustandFuncSelectors,
} from "auto-zustand-selectors-hook";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// TODO: fill in AppNode and AppEdge types with custom data
export type AppNode = Node<{ label?: string; description?: string }>;
export type AppEdge = Edge<{ label?: string; description?: string }>;

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
  onDragEndCreateNodeAt: (
    position: { x: number; y: number },
    fromNodeId: string
  ) => void;
  onArrange: () => void;
}

// Utility function for consistent warning messages
const warnNoCurrentTree = (operation: string) => {
  console.warn(`[EVTree] No current tree selected for ${operation}`);
};

const warnItemNotFound = (
  itemType: "Node" | "Edge" | "Tree",
  id: string,
  operation: string
) => {
  console.warn(`[EVTree] ${itemType} with id ${id} not found for ${operation}`);
};

const initialNodes = [
  {
    id: "1",
    type: "input",
    data: {
      label: "Input",
      description: "Starting point of the decision tree",
    },
    position: { x: 0, y: 0 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  {
    id: "2",
    data: {
      label: "Default",
      description: "Main decision node with multiple options",
    },
    position: { x: 225, y: -50 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  {
    id: "3",
    type: "output",
    data: {
      label: "Output",
      description: "Final outcome of the decision process",
    },
    position: { x: 225, y: 50 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
] as AppNode[];

const initialEdges = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    type: "smoothstep",
    data: {
      label: "Edge 1-2",
      description: "Connection from input to main decision node",
    },
  },
  {
    id: "e1-3",
    source: "1",
    target: "3",
    type: "smoothstep",
    data: {
      label: "Edge 1-3",
      description: "Path from input to final output",
    },
  },
] as AppEdge[];

const initialTrees: Record<string, DecisionTree> = {
  "tree-1": {
    id: "tree-1",
    name: "Default Tree",
    description: "This is the default decision tree",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: keyBy(initialNodes, (node) => node.id),
    edges: keyBy(initialEdges, (edge) => edge.id),
  },
};

// TODO: should exclude selection from being persisted?
const middlewares = (f: StateCreator<StoreState>) =>
  devtools(
    persist(
      // TODO: bug in zundo onNodesDelete... edges do not come back!
      temporal(immer(f), {
        // handleSet: (handleSet) => {
        //   // TODO: is throttle working as expected? the last char in a string
        //   // always triggers an undo save... it is not batched
        //   // TODO: also the onDragEndCreateNodeAt is not always working to undo
        //   // TODO: also undoing a delete of a node takes two steps!
        //   return debounce<typeof handleSet>((state) => {
        //     handleSet(state);
        //   }, 1000);
        // },
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
      const treeId = nanoid(12);
      const newTree: DecisionTree = {
        id: treeId,
        name,
        description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodes: keyBy(initialNodes, (node) => node.id),
        edges: keyBy(initialEdges, (edge) => edge.id),
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
      set({ currentTreeId: treeId });
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
          const updatedEdgesArray = addEdge(connection, values(tree.edges));
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
            const newNodeId = nanoid(12);
            nodeIdMap.set(nodeId, newNodeId);
            tree.nodes[newNodeId] = {
              ...node,
              id: newNodeId,
              position: {
                x: node.position.x + PASTE_OFFSET,
                y: node.position.y + PASTE_OFFSET,
              },
              selected: true,
            };
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
              const newEdgeId = nanoid(12);
              tree.edges[newEdgeId] = {
                ...edge,
                id: newEdgeId,
                source: newSourceId,
                target: newTargetId,
                selected: true,
              };
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
          tree.nodes = keyBy(initialNodes, (node) => node.id);
          tree.edges = keyBy(initialEdges, (edge) => edge.id);
          tree.updatedAt = new Date().toISOString();
        } else {
          warnItemNotFound("Tree", currentTreeId, "reset");
        }
        return state;
      });

      set({ clipboard: { nodeIds: [], edgeIds: [] } });
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
          const nodeId = nanoid(12);
          const edgeId = `e${fromNodeId}-${nodeId}`;

          const newNode: AppNode = {
            id: nodeId,
            position,
            data: { label: `Node ${nodeId}`, description: "" },
            origin: [0.5, 0.0] as [number, number],
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          };

          const newEdge: AppEdge = {
            id: edgeId,
            source: fromNodeId,
            target: nodeId,
            type: "smoothstep",
            data: { label: `Edge ${fromNodeId}-${nodeId}`, description: "" },
          };

          tree.nodes[nodeId] = newNode;
          tree.edges[edgeId] = newEdge;
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
// TODO: consider more 3rd party libs like shared-zustand or simple-zustand-devtools
// from https://zustand.docs.pmnd.rs/integrations/third-party-libraries

// NOTE: see https://github.com/Albert-Gao/auto-zustand-selectors-hook
export const useStore = createSelectorFunctions(
  useStoreBase
) as typeof useStoreBase & ZustandFuncSelectors<StoreState>;
