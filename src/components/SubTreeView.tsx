"use client";

import { useMemo } from "react";

import { ReactFlowProvider } from "@xyflow/react";

import { useTreeStore } from "@/hooks/use-tree-store";
import { getSubTreeElements } from "@/lib/issues";
import { selectCurrentTree } from "@/lib/selectors";

import { TreeCanvas } from "./TreeCanvas";

interface SubTreeViewProps {
  nodeId: string;
  className?: string;
}

/**
 * A static view of one node of the current tree with its branches, cropped
 * from what is around it. See getSubTreeElements.
 *
 * NOTE: the nodes and edges keep their ids, so they show the same labels,
 * probabilities and values as in MainTreeView, read from the store.
 *
 * TODO: mount lazily when scrolled into view, if a large tree proves slow
 */
export function SubTreeView({ nodeId, className }: SubTreeViewProps) {
  const tree = useTreeStore(selectCurrentTree);
  const elements = useMemo(
    () => tree && getSubTreeElements(tree, nodeId),
    [tree, nodeId],
  );
  // NOTE: the probability of the branch that leads to the node plays no part
  // in the calculation at the node, so only its label is shown
  const incomingEdgeId = elements?.incomingEdgeId;
  const withoutProbabilityIds = useMemo(
    () => new Set(incomingEdgeId ? [incomingEdgeId] : []),
    [incomingEdgeId],
  );

  if (!elements) {
    return null;
  }
  const { nodes, edges, bounds } = elements;

  return (
    <div
      // NOTE: inert so that nothing in the view can be clicked, focused or
      // hovered, whatever the node and edge components do
      inert
      // NOTE: the size of the crop, and no zoom, so that the sides of the box
      // cut the branches that lead in and out exactly where intended
      className={`overflow-hidden ${className ?? ""}`}
      style={{ width: bounds.width, height: bounds.height }}
    >
      {/*
        NOTE: a provider of its own, or else it would share, and overwrite, the
        React Flow state of MainTreeView
      */}
      <ReactFlowProvider>
        <TreeCanvas
          readOnly
          withoutProbabilityIds={withoutProbabilityIds}
          nodes={nodes}
          edges={edges}
          viewport={{ x: -bounds.x, y: -bounds.y, zoom: 1 }}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          // NOTE: let the page scroll when the pointer is over the view
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
        />
      </ReactFlowProvider>
    </div>
  );
}
