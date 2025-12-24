"use client";

import { useRef } from "react";

import {
  Connection,
  Controls,
  OnConnectEnd,
  OnConnectStart,
  ReactFlow,
  SelectionMode,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useContextMenu } from "@/hooks/use-context-menu";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useStore } from "@/hooks/use-store";
import { BACKGROUNDS } from "@/lib/background";
import { AppEdge } from "@/lib/edge";
import { buildChildToParentNodeMap } from "@/lib/maps";
import {
  selectCurrentBackgroundColor,
  selectCurrentEdges,
  selectCurrentNodes,
} from "@/lib/selectors";

import { ArrowMarker } from "./ArrowMarker";
import { CanvasCenteredHelpMessage } from "./CanvasCenteredHelpMessage";
import ContextMenu from "./ContextMenu";
import { edgeTypes } from "./EdgeTypes";
import { nodeTypes } from "./NodeTypes";

export default function ReactFlowApp() {
  const { onNodesChange, onEdgesChange, onConnect, createNodeAt } =
    useStore.getState();

  const nodes = useStore(selectCurrentNodes);
  const edges = useStore(selectCurrentEdges);
  const backgroundColorCode = useStore(selectCurrentBackgroundColor);

  // Get system color mode preference
  // TODO: backgroundColor breaks dark mode!!!
  const colorMode = useDarkMode() ? "dark" : "light";
  const { screenToFlowPosition } = useReactFlow();

  // Get the actual background color from the code
  const backgroundColor = backgroundColorCode
    ? BACKGROUNDS[backgroundColorCode]?.code
    : undefined;

  // Context menu hook
  const { menu, ref, onContextMenu, closeMenu } = useContextMenu();

  const isMediumScreenSizeOrLarger = useBreakpoint("md");

  // Track which handle was clicked for connections
  const connectingHandleId = useRef<string | null>(null);

  const onConnectStart: OnConnectStart = (_event, { handleId }) => {
    connectingHandleId.current = handleId;
  };

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

      // Check min distance
      const fromPosition = connectionState.fromNode.position;
      const distanceSquared =
        Math.pow(position.x - fromPosition.x, 2) +
        Math.pow(position.y - fromPosition.y, 2);
      // NOTE: 40 pixels minimum depends on the size of the nodes
      if (distanceSquared < Math.pow(40, 2)) {
        // eslint-disable-next-line no-console
        console.debug("[EVTree] Connection too short, not creating node");
        connectingHandleId.current = null;
        return;
      }

      // For note nodes, create a ghost node with an arrow edge
      // See https://reactflow.dev/examples/edges/temporary-edges
      if (connectionState.fromNode.type === "note") {
        const { createGhostNodeWithArrow } = useStore.getState();
        createGhostNodeWithArrow(
          connectionState.fromNode.id,
          position,
          connectingHandleId.current,
        );
        connectingHandleId.current = null;
        return;
      }

      // TODO: make this work for connection to upstream nodes also
      createNodeAt(position, connectionState.fromNode.id);
    }

    connectingHandleId.current = null;
  };

  return (
    // TODO: how to fix height to fill to bottom of viewport only so that if
    // left or right panel overflows, the canvas doesn't also overflow. you can
    // produce this effect by adding more and more variables to a tree.
    // NOTE: see also message on RightSidePanel when more than 800px height
    <div ref={ref} className="relative h-full w-full">
      <div className="block [@media(min-height:800px)]:hidden">
        <CanvasCenteredHelpMessage
          text={`Window too small \nTry a bigger screen`}
        />
      </div>
      <ReactFlow
        className="hidden [@media(min-height:800px)]:block"
        ref={ref}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        selectionMode={SelectionMode.Partial}
        colorMode={colorMode}
        style={{ backgroundColor }}
        fitView
        onNodesChange={(changes) => {
          onNodesChange(changes);
          // TODO: is this best way to close context menu?
          closeMenu();
        }}
        onEdgesChange={(changes) => {
          onEdgesChange(changes);
          closeMenu();
        }}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneContextMenu={(event) => onContextMenu(event)}
        onNodeContextMenu={(event, node) => onContextMenu(event, node)}
        // TODO: is this best way to close context menu?
        onClick={closeMenu}
        maxZoom={4}
        minZoom={0.1}
        isValidConnection={(connection) => isValidConnection(edges, connection)}
        // NOTE: Responsive design! Read-only mode for below medium size screens
        elementsSelectable={isMediumScreenSizeOrLarger}
        selectionOnDrag={isMediumScreenSizeOrLarger}
        nodesDraggable={isMediumScreenSizeOrLarger}
        nodesConnectable={isMediumScreenSizeOrLarger}
        nodesFocusable={isMediumScreenSizeOrLarger}
        edgesFocusable={isMediumScreenSizeOrLarger}
      >
        {menu && <ContextMenu {...menu} onClose={closeMenu} />}

        {/*
          SVG definitions for arrow markers
          NOTE: see downloadPNG in download.ts for how this must be specially handled in export.
        */}
        {ArrowMarker()}
        {/* Empty canvas help text */}
        {nodes.length === 0 && !menu && (
          <CanvasCenteredHelpMessage
            text={`Right-click or \ncontrol+click to start`}
          />
        )}
      </ReactFlow>
      <Controls
        position="bottom-right"
        orientation="horizontal"
        showInteractive={false}
      />
    </div>
  );
}

// TODO: move to some utils file and write unit tests
function isValidConnection(edges: AppEdge[], connection: AppEdge | Connection) {
  const childToParentMap = buildChildToParentNodeMap(edges);

  // Check if the target node is an ancestor of the source node
  let currentNodeId: string | undefined = connection.source;
  while (currentNodeId) {
    if (currentNodeId === connection.target) {
      return false;
    }
    currentNodeId = childToParentMap[currentNodeId];
  }

  return true;
}
