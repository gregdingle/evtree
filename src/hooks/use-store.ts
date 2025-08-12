"use client";

import {
  EdgeChange,
  NodeChange,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react";
import {
  ZustandFuncSelectors,
  createSelectorFunctions,
} from "auto-zustand-selectors-hook";
import { cloneDeep, isEqual, keyBy, round, throttle } from "es-toolkit";
import { keys, max, values } from "es-toolkit/compat";
import { nanoid } from "nanoid";
import { temporal } from "zundo";
import { StateCreator } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";

import initialTrees from "@/data/initialTrees";
import { AppEdge, cloneEdge, createEdge } from "@/lib/edge";
import { getLayoutedElements } from "@/lib/layout";
import {
  buildNodeToIncomingEdgeMap,
  buildParentToChildNodeMap,
} from "@/lib/maps";
import { getNearestUpstreamNode } from "@/lib/nearest";
import { AppNode, NodeType, cloneNode, createNode } from "@/lib/node";
import { selectUndoableState } from "@/lib/selectors";
import { DecisionTree, createTree } from "@/lib/tree";
import { warnItemNotFound, warnNoCurrentTree } from "@/utils/warn";

export interface StoreState {
  trees: Record<string, DecisionTree>;
  currentTreeId: string | null;
  clipboard?: { nodes: AppNode[]; edges: AppEdge[] };

  // Tree management
  createTree: (name: string, description?: string) => string;
  deleteTree: (treeId: string) => void;
  setCurrentTree: (treeId: string) => void;
  duplicateTree: (treeId: string, newName: string) => string;
  loadTree: (treeData: DecisionTree, replace: boolean) => string;
  onTreeDataUpdate: (
    treeData: Partial<Pick<DecisionTree, "name" | "description" | "variables">>,
  ) => void;

  // Node/Edge operations (work on current tree)
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange<AppEdge>;
  onConnect: OnConnect;
  onNodeDataUpdate: (id: string, nodeData: Partial<AppNode["data"]>) => void;
  onEdgeDataUpdate: (id: string, edgeData: Partial<AppEdge["data"]>) => void;
  balanceEdgeProbability: (id: string) => void;
  onCopy: (stripValues?: boolean) => void;
  onPaste: () => void;
  onReset: () => void;
  onCreateNodeAt: (
    position: { x: number; y: number },
    nodeType: NodeType,
  ) => void;
  createNodeAt: (
    position: { x: number; y: number },
    fromNodeId: string,
    nodeType?: NodeType,
  ) => void;
  onArrange: () => void;
  toggleNodeCollapse: (nodeId: string) => void;
  onConvertNode: (nodeId: string, newNodeType: NodeType) => void;
  selectSubtree: (nodeId: string) => void;
  deleteSubTree: (nodeId: string) => void;
  deleteSelected: () => void;
  connectToNearestNode: (nodeId: string) => void;
}

const middlewares = (
  // NOTE: see https://github.com/pmndrs/zustand/issues/1013 for complex typing
  f: StateCreator<StoreState, [["zustand/devtools", unknown]]>,
) =>
  persist(
    temporal(immer(devtools(f)), {
      // NOTE: throttling is needed for actions like dragging nodes across the canvas
      handleSet: (handleSet) =>
        throttle<typeof handleSet>((state) => {
          handleSet(state);
          // TODO: how to optimize timeout?
        }, 400),
      partialize: selectUndoableState,
      // NOTE: deep isEqual instead of shallow. this is needed to prevent
      // spurious undo states. see createWithEqualityFn in contrast.
      // TODO: figure out if this is a perf problem, figure out how to
      // minimize store updates. see partialize already developed to reduce
      // undo.
      equality: isEqual,
    }),
    {
      // TODO: develop migration and invalidation protocol
      name: "evtree-storage-v1",
      // TODO: localStorage or sessionStorage?
      storage: createJSONStorage(() => window.localStorage),
    },
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
      const newTree = createTree(name, description);
      set(
        (state) => {
          state.trees[newTree.id] = newTree;
          state.currentTreeId = newTree.id;
          return state;
        },
        undefined,
        { type: "createTree", name, description },
      );
      return newTree.id;
    },

    deleteTree: (treeId: string) => {
      set(
        (state) => {
          delete state.trees[treeId];
          // If we deleted the current tree, switch to another one
          if (state.currentTreeId === treeId) {
            const remainingTreeIds = keys(state.trees);
            state.currentTreeId =
              remainingTreeIds.length > 0 ? remainingTreeIds[0]! : null;
          }
          return state;
        },
        undefined,
        { type: "deleteTree", treeId },
      );
    },

    loadTree: (treeData: DecisionTree, replace: boolean) => {
      // NOTE: Always assign a new ID to avoid accidental overwrite old versions
      const treeId = replace ? treeData.id : nanoid(12);
      set(
        (state) => {
          const loadedTree: DecisionTree = {
            ...treeData,
            id: treeId,
            // TODO: should do something about duplicate names?
            updatedAt: new Date().toISOString(),
          };
          state.trees[treeId] = loadedTree;
          state.currentTreeId = treeId;
          return state;
        },
        undefined,
        { type: "loadTree", treeName: treeData.name, replace },
      );
      return treeId;
    },

    // TODO: how to prevent this from updatedAt being set via onNodesChange or
    // something like that?
    setCurrentTree: (treeId: string) => {
      set(
        (state) => {
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
        },
        undefined,
        { type: "setCurrentTree", treeId },
      );
    },

    duplicateTree: (treeId: string, newName: string) => {
      const newTreeId = nanoid(12);
      set(
        (state) => {
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
        },
        undefined,
        { type: "duplicateTree", treeId, newName },
      );
      return newTreeId;
    },

    onTreeDataUpdate: (treeData) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            if (treeData.name !== undefined) {
              tree.name = treeData.name;
            }
            if (treeData.description !== undefined) {
              tree.description = treeData.description;
            }
            if (treeData.variables !== undefined) {
              tree.variables = treeData.variables;
            }
            tree.updatedAt = new Date().toISOString();
          }),
        undefined,
        { type: "updateTreeData", updates: treeData },
      );
    },

    onNodesChange(changes) {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const updatedNodesArray = applyNodeChanges(
              changes,
              values(tree.nodes),
            );
            tree.nodes = keyBy(updatedNodesArray, (node) => node.id);
            tree.updatedAt = new Date().toISOString();
          }),
        undefined,
        { type: "onNodesChange", changesCount: changes.length },
      );
    },

    onEdgesChange(changes) {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const updatedEdgesArray = applyEdgeChanges(
              changes,
              values(tree.edges),
            );
            tree.edges = keyBy(updatedEdgesArray, (edge) => edge.id);
            tree.updatedAt = new Date().toISOString();
          }),
        undefined,
        { type: "edgesChange", changesCount: changes.length },
      );
    },

    // TODO: still not selecting newEdge always!
    onConnect: (connection) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const { source: fromNodeId, target: nodeId } = connection;
            clearSelections(tree);
            const newEdge = createEdge(fromNodeId, nodeId);
            const updatedEdgesArray = addEdge(newEdge, values(tree.edges));
            tree.edges = keyBy(updatedEdgesArray, (edge) => edge.id);
            tree.updatedAt = new Date().toISOString();
          }),
        undefined,
        {
          type: "onConnect",
          source: connection.source,
          target: connection.target,
        },
      );
    },

    onNodeDataUpdate: (id, nodeData) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const node = tree.nodes[id];
            if (node) {
              node.data = { ...node.data, ...nodeData };
              tree.updatedAt = new Date().toISOString();
            } else {
              warnItemNotFound("Node", id, "data update");
            }
          }),
        undefined,
        { type: "onNodeDataUpdate", id, nodeData },
      );
    },

    onEdgeDataUpdate: (id, edgeData) => {
      set(
        (state) =>
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
          }),
        undefined,
        { type: "updateEdgeData", edgeId: id, updates: edgeData },
      );
    },

    balanceEdgeProbability(id) {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const targetEdge = tree.edges[id];
            if (!targetEdge) {
              warnItemNotFound("Edge", id, "balance edge probability");
              return;
            }

            // Find all sibling edges (edges from the same source node)
            const siblingEdges = values(tree.edges).filter(
              (edge) => edge.source === targetEdge.source,
            );

            // Calculate sum of existing probabilities (excluding the target edge)
            const existingProbabilitySum = siblingEdges
              .filter(
                (edge) =>
                  edge.id !== id && edge.data?.probability !== undefined,
              )
              .reduce((sum, edge) => sum + (edge.data?.probability ?? 0), 0);

            // Count undefined probabilities (including the target edge)
            const undefinedProbabilityCount = siblingEdges.filter(
              (edge) => edge.data?.probability === undefined || edge.id === id,
            ).length;

            // Calculate balanced probability, round to 2 decimals
            const balancedProbability = round(
              max([0, 1.0 - existingProbabilitySum])! /
                undefinedProbabilityCount,
              2,
            );
            const edge = tree.edges[id];
            if (edge && edge.data) {
              edge.data.probability = balancedProbability;
              tree.updatedAt = new Date().toISOString();
            } else {
              warnItemNotFound("Edge", id, "data update");
            }
          }),
        undefined,
        { type: "balanceEdgeProbability", id },
      );
    },

    onCopy: (stripData = false) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            // NOTE: important to cloneDeep to avoid reference issues!
            let copiedNodes = cloneDeep(
              values(tree.nodes).filter((node) => node.selected),
            );
            let copiedEdges = cloneDeep(
              values(tree.edges).filter((edge) => edge.selected),
            );

            if (stripData) {
              copiedNodes = copiedNodes.map((node) => ({
                ...node,
                data: {
                  label: node.data.label,
                  description: node.data.description,
                },
              }));

              copiedEdges = copiedEdges.map((edge) => ({
                ...edge,
                data: {
                  probability: null,
                },
              }));
            }

            state.clipboard = {
              nodes: copiedNodes,
              edges: copiedEdges,
            };
          }),
        undefined,
        { type: "onCopy", stripData },
      );
    },

    onPaste: () => {
      const { clipboard } = get();
      if (!clipboard) return;

      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const PASTE_OFFSET = 50;
            const nodeIdMap = new Map<string, string>();

            // Check if exactly one node is selected for replacement
            const selectedNodes = values(tree.nodes).filter(
              (node) => node.selected,
            );
            const isReplacingNode = selectedNodes.length === 1;

            // Clear selections
            clearSelections(tree);

            if (isReplacingNode) {
              const nodeToReplace = selectedNodes[0]!;

              // Get the position and incoming edge info BEFORE deletion
              const replacementPosition = nodeToReplace.position;
              const parentToChildMap = buildParentToChildNodeMap(tree.edges);
              const nodeToIncomingEdgeMap = buildNodeToIncomingEdgeMap(
                tree.edges,
              );
              const incomingEdgeId = nodeToIncomingEdgeMap[nodeToReplace.id];
              const incomingEdge = incomingEdgeId
                ? tree.edges[incomingEdgeId]
                : null;

              // Delete the selected node's subtree (but preserve incoming edge info)
              const deleteDescendants = (currentNodeId: string) => {
                const children = parentToChildMap[currentNodeId] ?? [];
                children.forEach((childNodeId) => {
                  deleteDescendants(childNodeId);
                });
                delete tree.nodes[currentNodeId];
                delete tree.edges[nodeToIncomingEdgeMap[currentNodeId]!];
              };

              deleteDescendants(nodeToReplace.id);

              // Paste nodes at the replacement position
              clipboard.nodes.forEach((clipboardNode, index) => {
                const position =
                  index === 0
                    ? replacementPosition // First node goes to the exact replacement position
                    : {
                        // Maintain relative position to the first node
                        x:
                          replacementPosition.x +
                          (clipboardNode.position.x -
                            clipboard.nodes[0]!.position.x),
                        y:
                          replacementPosition.y +
                          (clipboardNode.position.y -
                            clipboard.nodes[0]!.position.y),
                      };
                const newNode = cloneNode(clipboardNode, position);
                tree.nodes[newNode.id] = newNode;
                nodeIdMap.set(clipboardNode.id, newNode.id);
              });

              // Paste edges
              clipboard.edges.forEach((clipboardEdge) => {
                const newSourceId = nodeIdMap.get(clipboardEdge.source);
                const newTargetId = nodeIdMap.get(clipboardEdge.target);

                if (newSourceId && newTargetId) {
                  const newEdge = cloneEdge(
                    clipboardEdge,
                    newSourceId,
                    newTargetId,
                  );
                  tree.edges[newEdge.id] = newEdge;
                }
              });

              // Connect the first pasted node to the incoming edge if it existed
              if (incomingEdge && clipboard.nodes.length > 0) {
                const firstPastedNodeId = nodeIdMap.get(clipboard.nodes[0]!.id);
                if (firstPastedNodeId) {
                  const reconnectionEdge = createEdge(
                    incomingEdge.source,
                    firstPastedNodeId,
                  );
                  // Preserve the original edge data
                  reconnectionEdge.data = {
                    label: incomingEdge.data?.label,
                    description: incomingEdge.data?.description,
                    probability: incomingEdge.data?.probability ?? null,
                  };
                  tree.edges[reconnectionEdge.id] = reconnectionEdge;
                }
              }
            } else {
              // Normal paste behavior - clear selections and paste with offse

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
                    newTargetId,
                  );
                  tree.edges[newEdge.id] = newEdge;
                }
              });
            }

            tree.updatedAt = new Date().toISOString();
          }),
        undefined,
        { type: "onPaste" },
      );
    },

    onReset: () => {
      const { currentTreeId } = get();
      if (!currentTreeId) {
        warnNoCurrentTree("reset");
        return;
      }

      set(
        (state) => ({
          ...state,
          trees: initialTrees,
          clipboard: { nodes: [], edges: [] },
        }),
        undefined,
        { type: "onReset" },
      );
    },

    onCreateNodeAt: (position, nodeType) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const newNode = createNode(position, nodeType);
            clearSelections(tree);
            tree.nodes[newNode.id] = newNode;
            tree.updatedAt = new Date().toISOString();
          }),
        undefined,
        { type: "createNodeAt", nodeType, position },
      );
    },

    // TODO: should this be in the store at all or should we just rely on onNodesChange?
    // And review all other store methods!
    // TODO: why are newEdge and newNode not selected after create on canvas?
    createNodeAt: (position, fromNodeId, nodeType = "chance") => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const newNode = createNode(position, nodeType);
            const newEdge = createEdge(fromNodeId, newNode.id);
            tree.nodes[newNode.id] = newNode;
            tree.edges[newEdge.id] = newEdge;
            // TODO: use dayjs?
            tree.updatedAt = new Date().toISOString();
          }),
        undefined,
        { type: "createNodeAt", position, fromNodeId, nodeType },
      );
    },

    // Preserve relative vertical order during auto arrange
    onArrange: () => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const { nodes, edges } = getLayoutedElements(
              values(tree.nodes),
              values(tree.edges),
              "LR", // direction
              1.5, // verticalScale
              3, // horizontalScale
              true, // preserveVerticalOrder
            );
            tree.nodes = keyBy(nodes, (node) => node.id);
            tree.edges = keyBy(edges, (edge) => edge.id);
            tree.updatedAt = new Date().toISOString();
          }),
        undefined,
        { type: "arrangeNodes" },
      );
    },

    toggleNodeCollapse: (nodeId: string) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const parentToChildMap = buildParentToChildNodeMap(tree.edges);
            const nodeToIncomingEdgeMap = buildNodeToIncomingEdgeMap(
              tree.edges,
            );

            // Check if any children exist to determine if we should collapse or expand
            const children = parentToChildMap[nodeId] ?? [];
            if (children.length === 0) return; // No children to collapse/expand

            // Determine toggle state based on first child's current hidden state
            const shouldHide = !tree.nodes[children[0]!]?.hidden;

            const toggleDescendants = (currentNodeId: string) => {
              const nodeChildren = parentToChildMap[currentNodeId] ?? [];
              nodeChildren.forEach((childNodeId) => {
                tree.nodes[childNodeId]!.hidden = shouldHide;
                const incomingEdgeId = nodeToIncomingEdgeMap[childNodeId];
                tree.edges[incomingEdgeId!]!.hidden = shouldHide;
                toggleDescendants(childNodeId);
              });
            };

            toggleDescendants(nodeId);
            tree.updatedAt = new Date().toISOString();
          }),
        undefined,
        { type: "toggleNodeCollapse", nodeId },
      );
    },

    onConvertNode: (nodeId: string, newNodeType: NodeType) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const node = tree.nodes[nodeId];
            if (!node) {
              warnItemNotFound("Node", nodeId, "convert node");
              return;
            }

            // Update the node type while preserving all other properties
            const updatedNode: AppNode = {
              ...node,
              type: newNodeType,
            };

            tree.nodes[nodeId] = updatedNode;
            tree.updatedAt = new Date().toISOString();
          }),
        undefined,
        { type: "onConvertNode", nodeId, newNodeType },
      );
    },

    selectSubtree: (nodeId: string) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const rootNode = tree.nodes[nodeId];
            if (!rootNode) {
              warnItemNotFound("Node", nodeId, "select subtree");
              return;
            }

            clearSelections(tree);

            const parentToChildMap = buildParentToChildNodeMap(tree.edges);
            const nodeToIncomingEdgeMap = buildNodeToIncomingEdgeMap(
              tree.edges,
            );

            const selectDescendants = (currentNodeId: string) => {
              const children = parentToChildMap[currentNodeId] ?? [];
              children.forEach((childNodeId) => {
                selectDescendants(childNodeId);
              });
              // NOTE: don't select incoming edge to the root itself
              // TODO: or should we???
              if (currentNodeId !== nodeId) {
                tree.edges[nodeToIncomingEdgeMap[currentNodeId]!]!.selected =
                  true;
              }
              tree.nodes[currentNodeId]!.selected = true;
            };

            selectDescendants(nodeId);
          }),
        undefined,
        { type: "selectSubtree", nodeId },
      );
    },

    deleteSubTree: (nodeId: string) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const rootNode = tree.nodes[nodeId];
            if (!rootNode) {
              warnItemNotFound("Node", nodeId, "delete subtree");
              return;
            }

            const parentToChildMap = buildParentToChildNodeMap(tree.edges);
            const nodeToIncomingEdgeMap = buildNodeToIncomingEdgeMap(
              tree.edges,
            );

            const deleteDescendants = (currentNodeId: string) => {
              const children = parentToChildMap[currentNodeId] ?? [];
              children.forEach((childNodeId) => {
                deleteDescendants(childNodeId);
              });
              delete tree.nodes[currentNodeId];
              delete tree.edges[nodeToIncomingEdgeMap[currentNodeId]!];
            };

            deleteDescendants(nodeId);

            tree.updatedAt = new Date().toISOString();
          }),
        undefined,
        { type: "deleteSubtree", nodeId },
      );
    },

    deleteSelected: () => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const selectedNodes = values(tree.nodes).filter(
              (node) => node.selected,
            );
            const selectedEdges = values(tree.edges).filter(
              (edge) => edge.selected,
            );

            if (selectedNodes.length === 0 && selectedEdges.length === 0)
              return;

            // TODO: is it needed to do this in terms of NodeChange and EdgeChange?
            const nodeChanges: NodeChange<AppNode>[] = selectedNodes.map(
              (node) => ({
                type: "remove",
                id: node.id,
              }),
            );

            const edgeChanges: EdgeChange<AppEdge>[] = selectedEdges.map(
              (edge) => ({
                type: "remove",
                id: edge.id,
              }),
            );

            // Apply the changes directly to the tree
            tree.nodes = keyBy(
              applyNodeChanges(nodeChanges, values(tree.nodes)),
              (node) => node.id,
            );
            tree.edges = keyBy(
              applyEdgeChanges(edgeChanges, values(tree.edges)),
              (edge) => edge.id,
            );

            tree.updatedAt = new Date().toISOString();
          }),
        undefined,
        {
          type: "deleteSelected",
        },
      );
    },

    connectToNearestNode: (nodeId: string) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const selectedNode = tree.nodes[nodeId];
            if (!selectedNode) {
              warnItemNotFound("Node", nodeId, "connect to nearest node");
              return;
            }

            const nodeToIncomingEdgeMap = buildNodeToIncomingEdgeMap(
              tree.edges,
            );
            // Node already has an incoming edge, cannot connect
            if (nodeToIncomingEdgeMap[selectedNode.id]) {
              console.warn("[EVTree] Node already has an incoming connection");
              return;
            }

            const nearestNode = getNearestUpstreamNode(
              tree.nodes,
              selectedNode,
            );

            if (!nearestNode) {
              console.warn("[EVTree] No suitable upstream node found");
              return;
            }

            const newEdge = createEdge(nearestNode.id, selectedNode.id);

            tree.edges[newEdge.id] = newEdge;
            tree.updatedAt = new Date().toISOString();
          }),
        undefined,
        { type: "connectToNearestNode", nodeId },
      );
    },
  })),
  // TODO: is this best as shallow or deep isEqual? any mutation to a node
  // results in a call back to onNodesChange with updated `measured`
  shallow,
);

// TODO: consider more 3rd party libs like shared-zustand
// from https://zustand.docs.pmnd.rs/integrations/third-party-libraries

// NOTE: see https://github.com/Albert-Gao/auto-zustand-selectors-hook
export const useStore = createSelectorFunctions(
  useStoreBase,
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
  callback: (tree: DecisionTree) => void,
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
