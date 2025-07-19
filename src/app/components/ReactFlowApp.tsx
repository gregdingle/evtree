"use client";

import { useDarkMode } from "@/hooks/use-dark-mode";
import { useStore } from "@/hooks/use-store";
import {
  Background,
  Controls,
  OnConnectEnd,
  ReactFlow,
  SelectionMode,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { edgeTypes } from "./EdgeTypes";
import { nodeTypes } from "./NodeTypes";

export default function ReactFlowApp() {
  const {
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodesDelete,
    onDragEndCreateNodeAt,
  } = useStore.getState();

  const nodes = useStore((state) => state.getCurrentNodes());
  const edges = useStore((state) => state.getCurrentEdges());

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

      onDragEndCreateNodeAt(position, connectionState.fromNode.id);
    }
  };

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        elementsSelectable={true}
        selectionOnDrag={true}
        selectionMode={SelectionMode.Partial}
        colorMode={colorMode}
        fitView
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onNodesDelete={onNodesDelete}
      >
        <Background />
        <Controls position="bottom-right" orientation="horizontal" />
      </ReactFlow>
    </div>
  );
}
