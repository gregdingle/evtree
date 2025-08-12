import { AppEdge, AppNode, DecisionTree } from "@/hooks/use-store";
import { nanoid } from "nanoid";
// QUESTION: use nanoid from zod?

export function createTree(
  name: string,
  description?: string,
  nodes?: Record<string, AppNode>,
  edges?: Record<string, AppEdge>,
): DecisionTree {
  return {
    id: nanoid(12),
    name,
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: nodes ?? {},
    edges: edges ?? {},
  };
}
