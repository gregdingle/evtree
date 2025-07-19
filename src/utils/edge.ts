import { AppEdge } from "@/hooks/use-store";

export function createEdge(fromNodeId: string, toNodeId: string): AppEdge {
  const edgeId = `e${fromNodeId}-${toNodeId}`;
  const newEdge: AppEdge = {
    id: edgeId,
    source: fromNodeId,
    target: toNodeId,
    type: "smoothstep",
    data: { label: `Edge ${fromNodeId}-${toNodeId}`, description: "" },
    selected: true, // Mark as selected by default
  };
  return newEdge;
}

export function cloneEdge(
  edge: AppEdge,
  newSourceId: string,
  newTargetId: string
): AppEdge {
  const edgeId = `e${newSourceId}-${newTargetId}`;
  const newEdge: AppEdge = {
    ...edge,
    id: edgeId,
    source: newSourceId,
    target: newTargetId,
    selected: true,
  };
  return newEdge;
}
