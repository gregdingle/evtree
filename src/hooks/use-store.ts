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
  OnSelectionChangeFunc,
  OnSelectionChangeParams,
} from "@xyflow/react";
import { debounce, isEqual, keyBy, omit } from "es-toolkit";
import { fromPairs, keys, toPairs, values } from "es-toolkit/compat";
import { nanoid } from "nanoid";
import { temporal } from "zundo";
import { StateCreator } from "zustand";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";

import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// TODO: fill in AppNode and AppEdge types with custom data
export type AppNode = Node<{ label?: string; description?: string }>;
export type AppEdge = Edge<{ label?: string; description?: string }>;

export interface StoreState {
  // TODO: AppNode type for custom data
  nodes: Record<string, AppNode>;
  edges: Record<string, AppEdge>;
  clipboard: { nodeIds: AppNode["id"][]; edgeIds: AppEdge["id"][] };
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange<AppEdge>;
  onConnect: OnConnect;
  onSelectionChange: OnSelectionChangeFunc;
  // NOTE: app-specific methods
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
}

const initialNodes = [
  {
    id: "1",
    type: "input",
    data: {
      label: "Input",
      description: "Starting point of the decision tree",
    },
    position: { x: 250, y: 25 },
  },
  {
    id: "2",
    data: {
      label: "Default",
      description: "Main decision node with multiple options",
    },
    position: { x: 100, y: 125 },
  },
  {
    id: "3",
    type: "output",
    data: {
      label: "Output",
      description: "Final outcome of the decision process",
    },
    position: { x: 250, y: 250 },
  },
] as AppNode[];

const initialEdges = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    data: {
      label: "Edge 1-2",
      description: "Connection from input to main decision node",
    },
  },
  {
    id: "e2-3",
    source: "2",
    target: "3",
    data: {
      label: "Edge 2-3",
      description: "Path from decision to final output",
    },
  },
] as AppEdge[];

// TODO: add persist when ready for persistence
// TODO: add when ready for persistence
// TODO: should exclude selection from being persisted?
//   {
//   name: "evtree-storage", // name of the item in the storage (must be unique)
//   // TODO: localStorage or sessionStorage?
//   storage: createJSONStorage(() => window.localStorage),
// }
//   )
const middlewares = (f: StateCreator<StoreState>) =>
  devtools(
    temporal(immer(f), {
      handleSet: (handleSet) =>
        // TODO: is throttle working as expected? the last char in a string
        // always triggers an undo save... it is not batched
        debounce<typeof handleSet>((state) => {
          handleSet(state);
        }, 1000),
      // NOTE: we don't want to track selection in history
      partialize: (state) => {
        return {
          ...state,
          nodes: fromPairs(
            toPairs(state.nodes).map(([id, node]) => [
              id,
              omit(node, ["selected"]),
            ])
          ),
          edges: fromPairs(
            toPairs(state.edges).map(([id, edge]) => [
              id,
              omit(edge, ["selected"]),
            ])
          ),
        };
      },
      // HACK: deep isEqual instead of shallow to fix extra pastState with undo after paste
      // TODO: figure out the extra store updates, then mirror the useStore hook
      // one-level-deep compare. See createWithEqualityFn.
      equality: (pastState, currentState) => isEqual(pastState, currentState),
    })
  );

// NOTE: default selector changed to shallow for less re-renders
export const useStore = createWithEqualityFn<StoreState>()(
  middlewares((set, get) => ({
    nodes: keyBy(initialNodes, (node) => node.id),
    edges: keyBy(initialEdges, (edge) => edge.id),
    selection: { nodeIds: [], edgeIds: [] },
    clipboard: { nodeIds: [], edgeIds: [] },

    onNodesChange(changes) {
      const updatedNodesArray = applyNodeChanges(changes, values(get().nodes));
      set({
        nodes: keyBy(updatedNodesArray, (node) => node.id),
      });
    },

    onEdgesChange(changes) {
      const updatedEdgesArray = applyEdgeChanges(changes, values(get().edges));
      set({
        edges: keyBy(updatedEdgesArray, (edge) => edge.id),
      });
    },

    onConnect: (connection) => {
      const updatedEdgesArray = addEdge(connection, values(get().edges));
      set({
        edges: keyBy(updatedEdgesArray, (edge) => edge.id),
      });
    },

    // TODO: does onSelectionChange simply receive all nodes that have updated selected property?
    onSelectionChange: ({ nodes, edges }: OnSelectionChangeParams) => {
      set({
        nodes: { ...get().nodes, ...keyBy(nodes, (node) => node.id) },
        edges: { ...get().edges, ...keyBy(edges, (edge) => edge.id) },
      });
    },

    onNodeDataUpdate: (id, nodeData) => {
      set((state) => {
        const node = state.nodes[id];
        if (node) {
          node.data = { ...node.data, ...nodeData };
        } else {
          console.warn(`[EVTree] Node with id ${id} not found for data update`);
        }
        // TODO: should we return state here? what is immer API?
        return state;
      });
    },

    onEdgeDataUpdate: (id, edgeData) => {
      set((state) => {
        const edge = state.edges[id];
        if (edge) {
          edge.data = { ...edge.data, ...edgeData };
        } else {
          console.warn(`[EVTree] Edge with id ${id} not found for data update`);
        }
        return state;
      });
    },

    // TODO: reconnect edges to nodes after deletion as in the example at
    // https://reactflow.dev/examples/nodes/delete-middle-node ??
    onNodesDelete: (deleted) => {
      set((state) => {
        // Remove nodes and edges from the state
        deleted.forEach((node) => {
          delete state.nodes[node.id];
          // Remove edges connected to the deleted node
          keys(state.edges).forEach((edgeId) => {
            const edge = state.edges[edgeId];
            if (edge.source === node.id || edge.target === node.id) {
              delete state.edges[edgeId];
            }
          });
        });
        return state;
      });
    },

    onCopy: () => {
      set({
        clipboard: {
          nodeIds: values(get().nodes)
            .filter((node) => node.selected)
            .map((node) => node.id),
          edgeIds: values(get().edges)
            .filter((edge) => edge.selected)
            .map((edge) => edge.id),
        },
      });
    },

    onPaste: () => {
      set((state) => {
        const { nodes, edges, clipboard } = get();
        const PASTE_OFFSET = 50; // Offset for pasted nodes
        const nodeIdMap = new Map<string, string>(); // Map old IDs to new IDs

        // First pass: create nodes with offset positions and build ID mapping
        clipboard.nodeIds.forEach((nodeId) => {
          const node = nodes[nodeId];
          if (node) {
            const newNodeId = nanoid(12);
            nodeIdMap.set(nodeId, newNodeId);
            state.nodes[newNodeId] = {
              ...node,
              id: newNodeId,
              position: {
                x: node.position.x + PASTE_OFFSET,
                y: node.position.y + PASTE_OFFSET,
              },
              selected: true, // Select the new node
            };
            state.nodes[nodeId].selected = false; // Deselect the original node
          } else {
            console.warn(`[EVTree] Node with id ${nodeId} not found for paste`);
          }
        });

        // Second pass: create edges with updated source/target IDs
        const newEdgeIds: string[] = [];
        clipboard.edgeIds.forEach((edgeId) => {
          const edge = edges[edgeId];
          if (edge) {
            const newSourceId = nodeIdMap.get(edge.source);
            const newTargetId = nodeIdMap.get(edge.target);

            // Only create edge if both source and target nodes were pasted
            if (newSourceId && newTargetId) {
              const newEdgeId = nanoid(12);
              state.edges[newEdgeId] = {
                ...edge,
                id: newEdgeId,
                source: newSourceId,
                target: newTargetId,
                selected: true, // Select the new edge
              };
              // Deselect the original edge
              state.edges[edgeId].selected = false;
              newEdgeIds.push(newEdgeId);
            }
          } else {
            console.warn(`[EVTree] Edge with id ${edgeId} not found for paste`);
          }
        });

        return state;
      });
    },

    onReset: () => {
      set({
        nodes: keyBy(initialNodes, (node) => node.id),
        edges: keyBy(initialEdges, (edge) => edge.id),
        clipboard: { nodeIds: [], edgeIds: [] },
      });
    },

    onDragEndCreateNodeAt: (position, fromNodeId) => {
      set((state) => {
        // Generate unique IDs
        const nodeId = nanoid(12);
        const edgeId = `e${fromNodeId}-${nodeId}`;

        // Create new node at the specified position
        const newNode: AppNode = {
          id: nodeId,
          position,
          data: { label: `Node ${nodeId}`, description: "" },
          origin: [0.5, 0.0] as [number, number], // center horizontally, top vertically
        };

        // Create new edge from the source node to the new node
        const newEdge: AppEdge = {
          id: edgeId,
          source: fromNodeId,
          target: nodeId,
          data: { label: `Edge ${fromNodeId}-${nodeId}`, description: "" },
        };

        // Add both to the state
        state.nodes[nodeId] = newNode;
        state.edges[edgeId] = newEdge;

        return state;
      });
    },
  })),
  shallow
);
// TODO: consider 3rd party libs like shared-zustand or simple-zustand-devtools
// from https://zustand.docs.pmnd.rs/integrations/third-party-libraries

//
// TODO why not auto selectors working? See https://zustand.docs.pmnd.rs/guides/auto-generating-selectors
//
