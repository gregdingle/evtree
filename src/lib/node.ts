import { Node, XYPosition } from "@xyflow/react";
import { nanoid } from "nanoid";

export type NodeType = "decision" | "chance" | "terminal" | "note";

export type AppNode = Node<
  {
    // TODO: rename expr to formula?
    valueExpr?: string;
    costExpr?: string;
    /**
     * NOTE: not used right now
     */
    label?: string;
    /**
     * NOTE: used by note type only right now
     */
    description?: string;
  },
  NodeType
>;

export function createNode(
  position: XYPosition,
  type: NodeType = "chance",
  selected: boolean = true,
  data?: Partial<AppNode["data"]>,
): AppNode {
  const nodeId = nanoid(12);
  const newNode: AppNode = {
    id: nodeId,
    type,
    position,
    data: { label: "", description: "", ...data },
    origin: [0.5, 0.0] as [number, number],
    selected, // Mark as selected by default
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
} // TODO: move types into a lib file
