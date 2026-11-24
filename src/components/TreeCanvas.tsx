"use client";

import { Ref, useMemo } from "react";

import { ReactFlow, ReactFlowProps } from "@xyflow/react";
// TODO: React Flow 13 adds the import path "@xyflow/react/style.css" and puts
// its styles in @layer xyflow, see the React Flow overrides in globals.css
// NOTE: ts-ignore not ts-expect-error because TS 7 (VS Code native preview) errors here but TS 5 (build) does not
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Next.js processes this global stylesheet import.
import "@xyflow/react/dist/style.css";

import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { NO_IDS, TreeCanvasContext } from "@/hooks/use-tree-canvas";
import { AppEdge } from "@/lib/edge";
import { AppNode } from "@/lib/node";

import { edgeTypes } from "./EdgeTypes";
import { nodeTypes } from "./NodeTypes";

interface TreeCanvasProps extends ReactFlowProps<AppNode, AppEdge> {
  ref?: Ref<HTMLDivElement>;
  /** For a static view of part of a tree, see SubTreeView */
  readOnly?: boolean;
  /** The ids of edges to show without a probability */
  withoutProbabilityIds?: ReadonlySet<string>;
}

/**
 * How a tree is drawn, for both the editor (MainTreeView) and static views
 * (SubTreeView). It knows nothing about how a tree is edited.
 */
export function TreeCanvas({
  readOnly = false,
  withoutProbabilityIds = NO_IDS,
  children,
  ...props
}: TreeCanvasProps) {
  // Get system color mode preference
  const colorMode = useDarkMode() ? "dark" : "light";

  // NOTE: Responsive design! Read-only mode for below medium size screens
  const isMediumScreenSizeOrLarger = useBreakpoint("md");
  const isReadOnly = readOnly || !isMediumScreenSizeOrLarger;

  const mode = useMemo(
    () => ({ isReadOnly, isStatic: readOnly, withoutProbabilityIds }),
    [isReadOnly, readOnly, withoutProbabilityIds],
  );

  return (
    <TreeCanvasContext.Provider value={mode}>
      <ReactFlow
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={colorMode}
        elementsSelectable={!isReadOnly}
        selectionOnDrag={!isReadOnly}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        nodesFocusable={!isReadOnly}
        edgesFocusable={!isReadOnly}
        {...props}
      >
        {children}
      </ReactFlow>
    </TreeCanvasContext.Provider>
  );
}
