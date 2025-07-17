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
  OnSelectionChangeFunc,
  OnSelectionChangeParams,
} from "@xyflow/react";
import { keyBy } from "es-toolkit";
import { values } from "es-toolkit/compat";
import { temporal } from "zundo";
import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// TODO: fill in AppNode and AppEdge types with custom data
type AppNode = Node<{ label?: string; description?: string }>;
type AppEdge = Edge<{ label?: string; description?: string }>;

export interface StoreState {
  // TODO: AppNode type for custom data
  nodes: Record<string, AppNode>;
  edges: Record<string, AppEdge>;
  selection: { nodes: AppNode[]; edges: AppEdge[] };
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange<AppEdge>;
  onConnect: OnConnect;
  onSelectionChange: OnSelectionChangeFunc;
  // NOTE: app-specific methods
  onNodeDataUpdate: (id: string, nodeData: Partial<AppNode["data"]>) => void;
  onEdgeDataUpdate: (id: string, edgeData: Partial<AppEdge["data"]>) => void;
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
//   {
//   name: "evtree-storage", // name of the item in the storage (must be unique)
//   // TODO: localStorage or sessionStorage?
//   storage: createJSONStorage(() => window.localStorage),
// }
//   )
const middlewares = (f: StateCreator<StoreState>) =>
  devtools(temporal(immer(f)));

// TODO: change default selector to be shallow
export const useStore = create<StoreState>()(
  middlewares((set, get) => ({
    nodes: keyBy(initialNodes, (node) => node.id),
    edges: keyBy(initialEdges, (edge) => edge.id),
    selection: { nodes: [], edges: [] },

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

    onSelectionChange: (selection: OnSelectionChangeParams) => {
      set({
        selection,
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
  }))
);
// TODO: consider 3rd party libs like shared-zustand or simple-zustand-devtools
// from https://zustand.docs.pmnd.rs/integrations/third-party-libraries

//
// TODO why not auto selectors working? See https://zustand.docs.pmnd.rs/guides/auto-generating-selectors
//
