import { Node, XYPosition } from "@xyflow/react";
import { nanoid } from "nanoid";

/**
 * NOTE: the "note" and "ghost" node types are for annotations outside of the
 * logical decision tree.
 */
export type NodeType = "decision" | "chance" | "terminal" | "note" | "ghost";

/**
 * Core datastructure that extends the React Flow type. Each NodeType uses a
 * subset of properties.
 */
export type AppNode = Node<
  {
    valueExpr?: string;
    costExpr?: string;
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
    data: { description: "", ...data },
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
}
