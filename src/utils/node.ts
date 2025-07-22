import { AppNode } from "@/hooks/use-store";
import { Position, XYPosition } from "@xyflow/react";
import { nanoid } from "nanoid";

// TODO: dedupe with NodeTypes.tsx somehow... where source of truth?
export type NodeType = "decision" | "chance" | "terminal";

export function createNode(
  position: XYPosition,
  type: NodeType = "chance"
): AppNode {
  const nodeId = nanoid(12);
  const newNode: AppNode = {
    id: nodeId,
    type,
    position,
    data: { label: "", description: "", value: undefined },
    origin: [0.5, 0.0] as [number, number],
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    selected: true, // Mark as selected by default
  };
  return newNode;
}

export function cloneNode(node: AppNode, position: XYPosition): AppNode {
  const nodeId = nanoid(12);
  const newNode: AppNode = {
    ...node,
    id: nodeId,
    position,
    selected: true,
  };
  return newNode;
}
