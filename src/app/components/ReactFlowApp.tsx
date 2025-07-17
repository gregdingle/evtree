"use client";

import { useDarkMode } from "@/hooks/use-dark-mode";
import { useStore } from "@/hooks/use-store";
import { ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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

  // TODO: hook up to keyboard shortcuts
  const { undo, redo } = useStore.temporal.getState();

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <div className="flex justify-start space-x-2">
        <button onClick={() => undo()}>undo</button>
        <button onClick={() => redo()}>redo</button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
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
