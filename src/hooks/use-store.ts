"use client";

import {
  EdgeChange,
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
import { keys, values } from "es-toolkit/compat";
import { nanoid } from "nanoid";
import { ZundoOptions, temporal } from "zundo";
import { StateCreator } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";

import initialTrees from "@/data/initialTrees";
import { AppEdge, cloneEdge, createEdge } from "@/lib/edge";
import { toComputeEdge } from "@/lib/expectedValue";
import { arrangeSubtreeHelper } from "@/lib/layout";
import {
  collectSubtreeNodeIds,
  getNodeToIncomingEdgeMap,
  getParentToChildNodeMap,
} from "@/lib/maps";
import { findNearestUpstreamNode } from "@/lib/nearest";
import { AppNode, NodeType, cloneNode, createNode } from "@/lib/node";
import { selectUndoableState } from "@/lib/selectors";
import {
  DecisionTree,
  DecisionTreeSimpleProperties,
  createTree,
} from "@/lib/tree";
import { Variable } from "@/lib/variable";
import { warnItemNotFound, warnNoCurrentTree } from "@/utils/warn";

import { withArrangeAnimation } from "../lib/animate";

export interface StoreState {
  trees: Record<string, DecisionTree>;
  currentTreeId: string | null;
  clipboard?: { nodes: AppNode[]; edges: AppEdge[] };
  display: {
    showEVs?: boolean;
    showPathEVs?: boolean;
    showHistogram?: boolean;
  };

  // Tree management
  createTree: (name: string, description?: string) => string;
  deleteTree: (treeId: string) => void;
  setCurrentTree: (treeId: string) => void;
  duplicateTree: (treeId: string, newName: string) => string;
  loadTree: (treeData: DecisionTree, replace: boolean) => string;
  onTreeDataUpdate: (treeData: DecisionTreeSimpleProperties) => void;
  replaceVariables: (
    variables: Array<Omit<Variable, "value"> & { value: string }>,
    scope: Variable["scope"],
  ) => void;

  // Node/Edge operations (work on current tree)
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange<AppEdge>;
  onConnect: OnConnect;
  onNodeDataUpdate: (id: string, nodeData: Partial<AppNode["data"]>) => void;
  onEdgeDataUpdate: (id: string, edgeData: Partial<AppEdge["data"]>) => void;
  onNotePropertiesUpdate: (
    id: string,
    properties: Pick<AppNode, "width" | "height">,
  ) => void;
  balanceEdgeProbability: (id: string, significantDigits?: number) => void;
  // TODO: rename all onX methods to simply X
  onCopy: (stripValues?: boolean) => void;
  onPaste: (
    position?: { x: number; y: number },
    replaceNodeId?: string,
  ) => void;
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
  createGhostNodeWithArrow: (
    fromNodeId: string,
    position: { x: number; y: number },
    sourceHandle?: string | null,
  ) => void;
  onArrange: (rightAligned?: boolean) => void;
  arrangeSubtree: (nodeId: string, rightAligned?: boolean) => void;
  toggleNodeCollapse: (nodeId: string) => void;
  onConvertNode: (nodeId: string, newNodeType: NodeType) => void;
  selectSubtree: (nodeId: string) => void;
  deleteSubTree: (nodeId: string) => void;
  deleteSelected: () => void;
  connectToNearestNode: (nodeId: string) => void;
  onShowEVs: (showPathEVs?: boolean) => void;
  onShowHistogram: () => void;
}

// TODO: should we clear undo stack when switching trees? or better to be safe?
const temporalOptions: ZundoOptions<
  StoreState,
  ReturnType<typeof selectUndoableState>
> = {
  // NOTE: throttling is needed for actions like dragging nodes across the canvas
  handleSet: (handleSet) =>
    throttle((...args: unknown[]) => {
      // @ts-expect-error - handleSet expects specific args but we just pass all through
      handleSet(...args);
      // TODO: how to optimize throttle window for undo?
    }, 400),
  partialize: selectUndoableState,
  // NOTE: deep isEqual instead of shallow. this is needed to prevent
  // spurious undo states. see createWithEqualityFn in contrast.
  // TODO: figure out if this is a perf problem, figure out how to
  // minimize store updates. see partialize already developed to reduce
  // undo.
  equality: isEqual,
  // Auto-update timestamp whenever state is saved to history
  onSave: (pastState, currentState) => {
    // Only update when a change to a tree
    // NOTE: this does not seem to play nice with node measured even though that
    // is filtered in selectUndoableState

    withCurrentTree(currentState, (tree) => {
      const pastTreeState = pastState.trees[tree.id];
      if (pastTreeState !== tree) {
        // TODO: use dayjs for timestamps?
        tree.updatedAt = new Date().toISOString();
        return;
      }
    });
  },
};

const middlewares = (
  // NOTE: see https://github.com/pmndrs/zustand/issues/1013 for complex typing
  f: StateCreator<StoreState, [["zustand/devtools", unknown]]>,
) =>
  persist(
    // @ts-expect-error - Complex middleware type chain issue with immer/devtools/temporal
    temporal(immer(devtools(f)), temporalOptions),
    {
      // TODO: develop migration and invalidation protocol...
      // maybe using `merge` function of `persist`...
      // but for now just increment v number
      name: "evtree-storage-v6",
      storage: createJSONStorage(() => window.localStorage),
    },
  );

// NOTE: default selector changed to shallow for less re-renders
const useStoreBase = createWithEqualityFn<StoreState>()(
  middlewares((set, get) => ({
    trees: initialTrees,
    currentTreeId: "tree-1", // Default to the first tree
    clipboard: { nodes: [], edges: [] },
    display: {},

    // Tree management functions
    // TODO: include tree management in undo/redo? it is strange to undo across
    // tree creation boundary
    createTree: (name: string, description?: string) => {
      const newTree = createTree(name, description);
      set(
        (state) => {
          state.trees[newTree.id] = newTree;
          state.currentTreeId = newTree.id;

          // Clear any display settings
          state.display = {};

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
          // TODO: should do something about duplicate tree names?
          const loadedTree: DecisionTree = {
            ...treeData,
            id: treeId,
            // TODO: is it conventional to update these dates on load?
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

          // Clear any display settings
          state.display = {};

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
              // TODO: is it conventional to update these dates on duplicate?
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
            // TODO: make more dynamic and derive possible keys from
            // DecisionTreeSimpleProperties somehow
            if (treeData.name !== undefined) {
              tree.name = treeData.name;
            }
            if (treeData.description !== undefined) {
              tree.description = treeData.description;
            }
            if (treeData.currency !== undefined) {
              tree.currency = treeData.currency;
            }
            if (treeData.rounding !== undefined) {
              tree.rounding = treeData.rounding;
            }
          }),
        undefined,
        { type: "updateTreeData", updates: treeData },
      );
    },

    replaceVariables: (
      newVariables: Array<Omit<Variable, "value"> & { value: string }>,
      scope: Variable["scope"],
    ) => {
      const filteredVariables = newVariables
        .filter(({ name }) => name.trim()) // remove empty named variables
        .map(({ name, value }) => {
          const numValue = parseFloat(value.trim() || "0"); // replace '' with 0
          if (Number.isFinite(numValue)) {
            return {
              name: name.trim(),
              value: numValue,
              scope: scope,
            };
          }
          return null;
        })
        .filter((v) => v !== null);

      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            tree.variables = (tree.variables ?? [])
              .filter((v) => v.scope !== scope)
              .concat(filteredVariables);
          }),
        undefined,
        { type: "replaceVariables", variables: filteredVariables },
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
          }),
        undefined,
        { type: "onNodesChange", changesCount: changes.length },
      );
    },

    onEdgesChange(changes) {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            // NOTE: Special case: Delete any ghost nodes when their arrow edges
            // are removed.
            changes.forEach((change) => {
              if (change.type === "remove") {
                const edge = tree.edges[change.id];
                if (
                  edge?.type === "arrow" &&
                  tree.nodes[edge.target]?.type === "ghost"
                ) {
                  delete tree.nodes[edge.target];
                }
              }
            });

            const updatedEdgesArray = applyEdgeChanges(
              changes,
              values(tree.edges),
            );
            tree.edges = keyBy(updatedEdgesArray, (edge) => edge.id);
          }),
        undefined,
        { type: "edgesChange", changesCount: changes.length },
      );
    },

    onConnect: (connection) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const { source: fromNodeId, target: nodeId } = connection;
            clearSelections(tree);
            const newEdge = createEdge(fromNodeId, nodeId);
            const updatedEdgesArray = addEdge(newEdge, values(tree.edges));
            tree.edges = keyBy(updatedEdgesArray, (edge) => edge.id);
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
              edge.data = {
                ...edge.data,
                ...edgeData,
              };
            } else {
              warnItemNotFound("Edge", id, "data update");
            }
          }),
        undefined,
        { type: "updateEdgeData", edgeId: id, updates: edgeData },
      );
    },

    onNotePropertiesUpdate: (
      id: string,
      properties: Pick<AppNode, "width" | "height">,
    ) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const node = tree.nodes[id];
            if (node) {
              Object.assign(node, properties);
            } else {
              warnItemNotFound("Node", id, "note properties update");
            }
          }),
        undefined,
        { type: "onNotePropertiesUpdate", id, properties },
      );
    },

    balanceEdgeProbability(id, significantDigits = 6) {
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

            // Calculate sum of existing probabilities excluding the current edge
            const existingProbabilitySum = siblingEdges
              .filter((edge) => edge.id !== id)
              .reduce((sum, edge) => {
                const computeEdge = toComputeEdge(edge, tree.variables);
                const probability = computeEdge.data?.probability;
                return sum + (probability ?? 0);
              }, 0);

            // Set the remaining probability for the target edge
            const balancedProbability = Math.max(
              0,
              // TODO: could this lead to total prob less than 1?
              round(1.0 - existingProbabilitySum, significantDigits),
            );

            const edge = tree.edges[id];
            if (edge && edge.data) {
              edge.data.probabilityExpr = balancedProbability.toString();
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
                data: {},
              }));

              copiedEdges = copiedEdges.map((edge) => ({
                ...edge,
                data: {},
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

    onPaste: (position?: { x: number; y: number }, replaceNodeId?: string) => {
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
            const isReplacingNode =
              (replaceNodeId && replaceNodeId in tree.nodes) ||
              selectedNodes.length === 1;

            // Clear selections
            clearSelections(tree);

            if (isReplacingNode) {
              // TODO: extend from the selected node if the copied subtree
              // "starts with" a branch? current replace behavior is unintuitive
              // in this case

              const nodeToReplace = replaceNodeId
                ? tree.nodes[replaceNodeId]!
                : selectedNodes[0]!;

              // Get the position and incoming edge info BEFORE deletion
              const replacementPosition = nodeToReplace.position;
              const parentToChildMap = getParentToChildNodeMap(tree.edges);
              const nodeToIncomingEdgeMap = getNodeToIncomingEdgeMap(
                tree.edges,
              );
              const incomingEdgeId = nodeToIncomingEdgeMap[nodeToReplace.id];
              const incomingEdge = incomingEdgeId
                ? tree.edges[incomingEdgeId]
                : null;

              // Delete the selected node's subtree (but preserve incoming edge info)
              // TODO: use deleteSubTreeHelper? what about preserve incoming edge?
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
                  clearSelections(tree);
                  const reconnectionEdge = createEdge(
                    incomingEdge.source,
                    firstPastedNodeId,
                    true,
                    incomingEdge.data,
                  );
                  tree.edges[reconnectionEdge.id] = reconnectionEdge;

                  // TODO: Also arrange the new subtree?
                  // NOTE: we need to do this here instead of in event handler like handleAddBranch
                  // because we need to the new firstPastedNodeId
                  // HACK: Delay the arrangement to ensure the new node is rendered and
                  // positioned by ReactFlow first... but this causes double undo stack
                  // setTimeout(() => {
                  //   useStore.getState().arrangeSubtree(firstPastedNodeId);
                  // }, 0);
                }
              }
            } else {
              // Normal paste behavior - clear selections and paste with offset or explicit position

              let pasteOffsetX = PASTE_OFFSET;
              let pasteOffsetY = PASTE_OFFSET;

              if (position && clipboard.nodes.length > 0) {
                // If position is provided, calculate offset to place first node at that position
                const firstClipboardNode = clipboard.nodes[0]!;
                pasteOffsetX = position.x - firstClipboardNode.position.x;
                pasteOffsetY = position.y - firstClipboardNode.position.y;
              }

              // First pass: create nodes with offset positions and build ID mapping
              clipboard.nodes.forEach((clipboardNode) => {
                const nodePosition = {
                  x: clipboardNode.position.x + pasteOffsetX,
                  y: clipboardNode.position.y + pasteOffsetY,
                };
                const newNode = cloneNode(clipboardNode, nodePosition);
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
            clearSelections(tree);
            const newNode = createNode(position, nodeType);
            tree.nodes[newNode.id] = newNode;
          }),
        undefined,
        { type: "createNodeAt", nodeType, position },
      );
    },

    // TODO: why are newEdge and newNode not always selected after create on canvas?!!!
    createNodeAt: (position, fromNodeId, nodeType = "chance") => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            clearSelections(tree);
            const newNode = createNode(position, nodeType);
            const newEdge = createEdge(fromNodeId, newNode.id);
            tree.nodes[newNode.id] = newNode;
            tree.edges[newEdge.id] = newEdge;
          }),
        undefined,
        { type: "createNodeAt", position, fromNodeId, nodeType },
      );
    },

    createGhostNodeWithArrow: (fromNodeId, position, sourceHandle) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            clearSelections(tree);
            // Create a ghost node at the drop position
            const ghostNode = createNode(position, "ghost", false);
            // Mark it as a ghost node so we can style it differently
            // ghostNode.draggable = false;
            // ghostNode.selectable = false;

            // Create an arrow edge from the source note to the ghost node
            const arrowEdge = createEdge(
              fromNodeId,
              ghostNode.id,
              false,
              {},
              "arrow",
            );

            // Set the source handle if provided
            if (sourceHandle) {
              arrowEdge.sourceHandle = sourceHandle;
            }

            tree.nodes[ghostNode.id] = ghostNode;
            tree.edges[arrowEdge.id] = arrowEdge;
          }),
        undefined,
        { type: "createGhostNodeWithArrow", fromNodeId, position },
      );
    },

    onArrange: (rightAligned = false) => {
      withArrangeAnimation(() =>
        set(
          (state) =>
            withCurrentTree(state, (tree) => {
              // TODO: extract to global findRootNodes function?
              const edgesArray = values(tree.edges);
              values(tree.nodes)
                .filter((node) => {
                  // A root node has no incoming edges
                  return (
                    !edgesArray.some((edge) => edge.target === node.id) &&
                    node.type !== "note" &&
                    node.type !== "ghost"
                  );
                })
                .forEach((node) => {
                  arrangeSubtreeHelper(tree, node.id, rightAligned);
                });
            }),
          undefined,
          { type: "arrangeNodes", rightAligned },
        ),
      );
    },

    // TODO: this would be even nicer with an animation!
    arrangeSubtree: (nodeId: string, rightAligned = false) => {
      withArrangeAnimation(() =>
        set(
          (state) =>
            withCurrentTree(state, (tree) =>
              arrangeSubtreeHelper(tree, nodeId, rightAligned),
            ),
          undefined,
          { type: "arrangeSubtree", nodeId, rightAligned },
        ),
      );
    },

    toggleNodeCollapse: (nodeId: string) => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            const parentToChildMap = getParentToChildNodeMap(tree.edges);
            const nodeToIncomingEdgeMap = getNodeToIncomingEdgeMap(tree.edges);

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

            const parentToChildMap = getParentToChildNodeMap(tree.edges);
            const nodeToIncomingEdgeMap = getNodeToIncomingEdgeMap(tree.edges);

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
          withCurrentTree(state, (tree) => deleteSubTreeHelper(tree, nodeId)),
        undefined,
        { type: "deleteSubtree", nodeId },
      );
    },

    // TODO: there is a quirk of using the reactflow built-in "delete" key
    // handler: it results in two undo steps. by contrast, clicking the delete
    // button results in one. use beforeDelete API of reactflow?
    deleteSelected: () => {
      set(
        (state) =>
          withCurrentTree(state, (tree) => {
            // Delete subtrees of all selected nodes to ensure valid tree where
            // all edges are connecting
            values(tree.nodes)
              .filter((node) => node.selected)
              .forEach((node) => deleteSubTreeHelper(tree, node.id));

            // Delete edges individually
            const edgeChanges: EdgeChange<AppEdge>[] = values(tree.edges)
              .filter((edge) => edge.selected)
              .map((edge) => ({
                type: "remove",
                id: edge.id,
              }));
            tree.edges = keyBy(
              applyEdgeChanges(edgeChanges, values(tree.edges)),
              (edge) => edge.id,
            );
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

            const nodeToIncomingEdgeMap = getNodeToIncomingEdgeMap(tree.edges);
            // Node already has an incoming edge, cannot connect
            if (nodeToIncomingEdgeMap[selectedNode.id]) {
              console.warn("[EVTree] Node already has an incoming connection");
              return;
            }

            const nearestNode = findNearestUpstreamNode(
              tree.nodes,
              selectedNode,
            );

            if (!nearestNode) {
              console.warn("[EVTree] No suitable upstream node found");
              return;
            }

            clearSelections(tree);
            const newEdge = createEdge(nearestNode.id, selectedNode.id);

            tree.edges[newEdge.id] = newEdge;
          }),
        undefined,
        { type: "connectToNearestNode", nodeId },
      );
    },

    onShowEVs: (showPathEVs?: boolean) => {
      set(
        (state) => {
          // NOTE: see ToolbarButton for available combinations
          if (
            // button click with selected option
            showPathEVs !== undefined &&
            showPathEVs !== state.display.showPathEVs
          ) {
            state.display.showPathEVs = showPathEVs;
            if (!state.display.showEVs) {
              state.display.showEVs = true;
            }
          } else {
            // hotkey toggle
            state.display.showEVs = !state.display.showEVs;
          }
          return state;
        },
        undefined,
        { type: "onShowEVs", showPathEVs },
      );
    },

    onShowHistogram: () => {
      set(
        (state) => {
          state.display.showHistogram = !state.display.showHistogram;
          return state;
        },
        undefined,
        { type: "onShowHistogram" },
      );
    },
  })),
  // TODO: is this best as shallow or deep isEqual? any mutation to a node
  // seems to result in a call back to onNodesChange with updated `measured`
  shallow,
);

// TODO: consider more 3rd party libs like shared-zustand for sharing across tabs
// from https://zustand.docs.pmnd.rs/integrations/third-party-libraries

// NOTE: see https://github.com/Albert-Gao/auto-zustand-selectors-hook
export const useStore = createSelectorFunctions(
  // @ts-expect-error - Complex middleware type chain issue with immer/devtools/temporal
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

function deleteSubTreeHelper(tree: DecisionTree, nodeId: string) {
  const rootNode = tree.nodes[nodeId];
  if (!rootNode) {
    warnItemNotFound("Node", nodeId, "delete subtree");
    return;
  }

  const nodeIdsToDelete = collectSubtreeNodeIds(tree, nodeId);

  // Delete all edges that have source or target in the subtree
  values(tree.edges).forEach((edge) => {
    if (nodeIdsToDelete.has(edge.source) || nodeIdsToDelete.has(edge.target)) {
      delete tree.edges[edge.id];
    }
  });

  // Delete all nodes in the subtree
  nodeIdsToDelete.forEach((nodeId) => {
    delete tree.nodes[nodeId];
  });
}
