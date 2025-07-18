"use client";

import { useDarkMode } from "@/hooks/use-dark-mode";
import { useStore } from "@/hooks/use-store";
import { OnConnectEnd, ReactFlow, useReactFlow } from "@xyflow/react";
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
  onNodesDelete: state.onNodesDelete,
  createNodeAt: state.createNodeAt,
});

export default function ReactFlowApp() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    onNodesDelete,
    createNodeAt,
  } = useStore(useShallow(selector));
  // TODO: why was this not working?
  // const nodes = useStore.use.nodes()

  // Get system color mode preference
  const colorMode = useDarkMode() ? "dark" : "light";
  const { screenToFlowPosition } = useReactFlow();

  // NOTE: adapted from https://reactflow.dev/examples/nodes/add-node-on-edge-drop
  const onConnectEnd: OnConnectEnd = (event, connectionState) => {
    // when a connection is dropped on the pane it's not valid
    if (!connectionState.isValid && connectionState.fromNode) {
      // we need to remove the wrapper bounds, in order to get the correct position
      const { clientX, clientY } =
        "changedTouches" in event ? event.changedTouches[0] : event;

      const position = screenToFlowPosition({
        x: clientX,
        y: clientY,
      });

      createNodeAt(position, connectionState.fromNode.id);
    }
  };

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={values(nodes)}
        edges={values(edges)}
        elementsSelectable={true}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onConnectEnd={onConnectEnd}
        onNodesDelete={onNodesDelete}
        colorMode={colorMode}
        fitView
      />
    </div>
  );
}
