import { nanoid } from "nanoid";

import { CurrencyCode } from "./currency";
import { AppEdge } from "./edge";
import { AppNode } from "./node";
import { RoundingCode } from "./rounding";
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
  currency?: CurrencyCode;
  rounding?: RoundingCode;
  terminalValueDisplay?: "outcome" | "net";
}

export type DecisionTreeUpdatableProperties = Partial<
  Pick<
    DecisionTree,
    "name" | "description" | "currency" | "rounding" | "terminalValueDisplay"
  >
>;

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
