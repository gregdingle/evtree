import { Edge } from "@xyflow/react";

export type AppEdge = Edge<{
  label?: string;
  description?: string;
  // NOTE: transformed into probability by safeEvalExpr in toComputeEdge
  probabilityExpr?: string;
}>;

export type EdgeType = "custom" | "arrow";

export function createEdge(
  fromNodeId: string,
  toNodeId: string,
  selected: boolean = true,
  data?: Partial<AppEdge["data"]>,
  edgeType: EdgeType = "custom",
): AppEdge {
  const edgeId = `e${fromNodeId}-${toNodeId}`;
  const newEdge: AppEdge = {
    id: edgeId,
    source: fromNodeId,
    target: toNodeId,
    type: edgeType,
    data: { label: "", description: "", ...data },
    selected, // Mark as selected by default
  };
  return newEdge;
}

export function cloneEdge(
  edge: AppEdge,
  newSourceId: string,
  newTargetId: string,
): AppEdge {
  // TODO: change separator to something that is not in nano ID like ::
  const edgeId = `e${newSourceId}-${newTargetId}`;
  const newEdge: AppEdge = {
    ...edge,
    id: edgeId,
    source: newSourceId,
    target: newTargetId,
    selected: true,
  };
  return newEdge;
} // TODO: rename to branch be consistent with decision tree terminology?

/**
 * Filters out arrow edges that don't participate in tree logic.
 */
export function filterTreeEdges(edges: AppEdge[]): AppEdge[] {
  return edges.filter((edge) => edge.type !== "arrow");
}
