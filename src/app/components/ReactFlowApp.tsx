"use client";

import { useDarkMode } from "@/hooks/use-dark-mode";
import { useStore } from "@/hooks/use-store";
import { ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { values } from "es-toolkit/compat";
import { useShallow } from "zustand/react/shallow";

import type { StoreState } from "@/hooks/use-store";

const selector = (state: StoreState) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  onSelectionChange: state.onSelectionChange,
});

export default function ReactFlowApp() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
  } = useStore(useShallow(selector));
  // TODO: why was this not working?
  // const nodes = useStore.use.nodes()

  // Get system color mode preference
  const colorMode = useDarkMode() ? "dark" : "light";

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={values(nodes)}
        edges={values(edges)}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        colorMode={colorMode}
        fitView
      />
    </div>
  );
}
