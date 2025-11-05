import { nanoid } from "nanoid";

import { AppEdge } from "./edge";
import { AppNode } from "./node";
import { Variable } from "./variable";

// QUESTION: use nanoid from zod?
export interface DecisionTree {
  id: string;
  name: string;
  description?: string;
  createdAt: string; // ISO date string
  updatedAt?: string; // ISO date string
  nodes: Record<string, AppNode>;
  edges: Record<string, AppEdge>;
  variables?: Variable[];
}

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
