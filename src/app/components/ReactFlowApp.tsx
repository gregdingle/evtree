"use client";

import { useDarkMode } from "@/hooks/use-dark-mode";
import { useStore } from "@/hooks/use-store";
import { OnConnectEnd, ReactFlow, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { pick, values } from "es-toolkit/compat";

import type { StoreState } from "@/hooks/use-store";

export default function ReactFlowApp() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    onNodesDelete,
    onDragEndCreateNodeAt,
  } = useStore((state: StoreState) =>
    pick(state, [
      "nodes",
      "edges",
      "onNodesChange",
      "onEdgesChange",
      "onConnect",
      "onSelectionChange",
      "onNodesDelete",
      "onDragEndCreateNodeAt",
    ])
  );
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

      onDragEndCreateNodeAt(position, connectionState.fromNode.id);
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
