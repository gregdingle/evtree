import { AppNode } from "@/hooks/use-store";
import { Position, XYPosition } from "@xyflow/react";
import { nanoid } from "nanoid";

export function createNode(position: XYPosition): AppNode {
  const nodeId = nanoid(12);
  const newNode: AppNode = {
    id: nodeId,
    type: "circle",
    position,
    data: { label: `Node ${nodeId}`, description: "" },
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
