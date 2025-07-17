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
import { temporal } from "zundo";
import { create } from "zustand";

// TODO: fill in AppNode and AppEdge types with custom data
type AppNode = Node<{ label?: string; description?: string }>;
type AppEdge = Edge<{ label?: string; description?: string }>;

export interface StoreState {
  // TODO: AppNode type for custom data
  nodes: AppNode[];
  edges: AppEdge[];
  selection: { nodes: AppNode[]; edges: AppEdge[] };
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange<AppEdge>;
  onConnect: OnConnect;
  onSelectionChange: OnSelectionChangeFunc;
  //   TODO: re-enable if needed
  //   setNodes: (nodes: Node[]) => void;
  //   setEdges: (edges: Edge[]) => void;
}
const initialNodes = [
  {
    id: "1",
    type: "input",
    data: { label: "Input" },
    position: { x: 250, y: 25 },
  },
  {
    id: "2",
    data: { label: "Default" },
    position: { x: 100, y: 125 },
  },
  {
    id: "3",
    type: "output",
    data: { label: "Output" },
    position: { x: 250, y: 250 },
  },
] as AppNode[];

const initialEdges = [
  { id: "e1-2", source: "1", target: "2", data: { label: "Edge 1-2" } },
  { id: "e2-3", source: "2", target: "3", data: { label: "Edge 2-3" } },
] as AppEdge[];

export const useStore = create<StoreState>()(
  // TODO: Uncomment when ready for persistence
  //   persist(
  temporal(
    (set, get) => ({
      nodes: initialNodes,
      edges: initialEdges,
      selection: { nodes: [], edges: [] },

      onNodesChange(changes) {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        });
      },

      onEdgesChange(changes) {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },

      onConnect: (connection) => {
        set({
          edges: addEdge(connection, get().edges),
        });
      },

      onSelectionChange: (selection: OnSelectionChangeParams) => {
        console.log("onSelectionChange", selection);
        set({
          selection,
        });
      },
      // TODO: re-enable if needed
      //   setNodes: (nodes) => {
      //     set({ nodes });
      //   },

      //   setEdges: (edges) => {
      //     set({ edges });
      //   },
    })
    // TODO: Uncomment when ready for persistence
    //   {
    //   name: "evtree-storage", // name of the item in the storage (must be unique)
    //   // TODO: localStorage or sessionStorage?
    //   storage: createJSONStorage(() => window.localStorage),
    // }
    //   )
  )
);
// TODO: consider 3rd party libs like shared-zustand or simple-zustand-devtools
// from https://zustand.docs.pmnd.rs/integrations/third-party-libraries

//
// TODO why not auto selectors working? See https://zustand.docs.pmnd.rs/guides/auto-generating-selectors
//
