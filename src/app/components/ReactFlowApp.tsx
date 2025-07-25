"use client";

import { useContextMenu } from "@/hooks/use-context-menu";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useStore } from "@/hooks/use-store";
import { selectCurrentEdges, selectCurrentNodes } from "@/utils/selectors";
import {
  Background,
  Controls,
  OnConnectEnd,
  ReactFlow,
  SelectionMode,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ContextMenu from "./ContextMenu";
import { edgeTypes } from "./EdgeTypes";
import { nodeTypes } from "./NodeTypes";

export default function ReactFlowApp() {
  const { onNodesChange, onEdgesChange, onConnect, onDragEndCreateNodeAt } =
    useStore.getState();

  const nodes = useStore(selectCurrentNodes);
  const edges = useStore(selectCurrentEdges);

  // Get system color mode preference
  const colorMode = useDarkMode() ? "dark" : "light";
  const { screenToFlowPosition } = useReactFlow();

  // Context menu hook
  const { menu, ref, onContextMenu, closeMenu } = useContextMenu();

  // NOTE: adapted from https://reactflow.dev/examples/nodes/add-node-on-edge-drop
  const onConnectEnd: OnConnectEnd = (event, connectionState) => {
    // when a connection is dropped on the pane it's not valid
    if (!connectionState.isValid && connectionState.fromNode) {
      // we need to remove the wrapper bounds, in order to get the correct position
      const { clientX, clientY } =
        "changedTouches" in event ? event.changedTouches[0]! : event;

      const position = screenToFlowPosition({
        x: clientX,
        y: clientY,
      });

      onDragEndCreateNodeAt(position, connectionState.fromNode.id);
    }
  };

  return (
    <div ref={ref} className="h-full w-full relative">
      <ReactFlow
        ref={ref}
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
        onPaneContextMenu={(event) => onContextMenu(event, false)}
        onNodeContextMenu={(event, node) => onContextMenu(event, true, node)}
        // TODO: is this best way to close context menu?
        onClick={closeMenu}
        maxZoom={4}
        minZoom={0.1}
        // TODO: use isValidConnection to check for left-to-right connections only? check for cycles?
      >
        <Background />
        <Controls
          position="bottom-right"
          orientation="horizontal"
          showInteractive={false}
        />
        {menu && <ContextMenu {...menu} onClose={closeMenu} />}
      </ReactFlow>
    </div>
  );
}
