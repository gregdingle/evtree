import { round } from "es-toolkit";
import { isNaN, max, values } from "es-toolkit/compat";
import { Parser } from "expr-eval";

import { AppEdge } from "./edge";
import { AppNode, NodeType } from "./node";
import { Variable, variablesToRecord } from "./variable";

type AdjacencyList = Record<
  string,
  {
    edgeId: string;
    nodeId: string;
  }[]
>;

// TODO: how to keep in sync with ComputeNode and AppEdge types?
export interface ComputeNode {
  id: string;
  type?: NodeType;
  data: {
    value: number | null;
    cost: number | null;
    priorCosts: number;
  };
}

export interface ComputeEdge {
  id: string;
  source: string;
  target: string;
  data?: {
    probability: number | null;
  };
}

const EPSILON = 1e-10;

/**
 * Computes values recursively for input `nodes`. The value of a
 * node is defined as the average of its children's values weighted by the
 * probabilities of the associated edges. Updates values in-place.
 *
 * The probabilities of edges following a decision node will also be updated
 * in-place according to expected value. The probability of the edge that has
 * the highest expected value out of a decision node will be set to 1.0, while
 * the others will be set to 0.0. When there is a tie, the probabilities will be
 * set to 1 / n, where n is the number of edges with the highest expected value.
 *
 * NOTE: Node costs along a path are accumulated and assigned to the terminal
 * node. In this way, the costs are "bubbled back up" in the expected value of
 * each node.
 *
 * TODO: should we support edge values like silver decisions?
 *
 * TODO: hourlyRate The hourly rate for legal costs
 * TODO: discountRate The annual discount rate (as a decimal, e.g., 0.05 for 5%)
 * TODO: filingDate The filing date of the lawsuit
 * TODO: partyRole The role of the party ("plaintiff" or "defendant")
 * TODO: feeShiftingRate The percentage of legal costs that trial winners can recover (0 to 1)
 * TODO: preJudgmentRate The annual pre-judgment interest rate (as a decimal, e.g., 0.03 for 3%)
 * TODO: postJudgmentRate The annual post-judgment interest rate (as a decimal, e.g., 0.05 for 5%)
 */
export function computeNodeValues(
  nodes: Record<string, ComputeNode>,
  edges: Record<string, ComputeEdge>,
): { nodes: Record<string, ComputeNode>; edges: Record<string, ComputeEdge> } {
  const edgesArray = values(edges);
  const rootNodes = values(nodes).filter((node) => {
    // A root node has no incoming edges
    // TODO: extract to global findRootNodes function?
    return (
      !edgesArray.some((edge) => edge.target === node.id) &&
      node.type !== "note" &&
      node.type !== "ghost"
    );
  });
  if (rootNodes.length === 0) {
    console.warn("[EVTree] No root nodes found, cannot compute values.");
    return { nodes, edges };
  }

  const adjList = buildAdjacencyList(edgesArray);

  rootNodes.forEach((rootNode) => {
    computeNodeValuesRecursive(
      nodes,
      edges,
      rootNode,
      adjList,
      rootNode.data.cost ?? 0,
    );
  });

  return { nodes, edges };
}

function buildAdjacencyList(edges: ComputeEdge[]): AdjacencyList {
  const adjList: AdjacencyList = {};
  edges.forEach((edge) => {
    if (!adjList[edge.source]) {
      adjList[edge.source] = [];
    }
    adjList[edge.source]!.push({ edgeId: edge.id, nodeId: edge.target });
  });
  return adjList;
}

function computeNodeValuesRecursive(
  nodes: Record<string, ComputeNode>,
  edges: Record<string, ComputeEdge>,
  currentNode: ComputeNode,
  adjList: AdjacencyList,
  cumulativeCost: number,
) {
  const children = adjList[currentNode.id] || [];

  // Base case: if no children, use node's value directly minus the cost of all ancestors
  if (children.length === 0) {
    if (currentNode.data.value === null) {
      // eslint-disable-next-line no-console
      console.debug(`[EVTree] Terminal node ${currentNode.id} has null value.`);
    } else {
      currentNode.data.value -= cumulativeCost;
      currentNode.data.priorCosts =
        cumulativeCost - (currentNode.data.cost ?? 0);
    }
    return;
  }

  children.forEach(({ nodeId }) => {
    const childNode = nodes[nodeId];
    if (childNode) {
      computeNodeValuesRecursive(
        nodes,
        edges,
        childNode,
        adjList,
        cumulativeCost + (childNode.data.cost ?? 0),
      );
    } else {
      // NOTE: childNode may not exist if the tree is malformed
      console.warn(`[EVTree] Node ${currentNode.id} has missing node or edge`);
    }
  });

  // If this is a decision node, we need to update the edge probability
  const { maxChildValue, bestProbability } =
    currentNode.type === "decision"
      ? getBestChild(children, nodes)
      : { maxChildValue: null, bestProbability: null };

  let expectedValue: number | null = null;
  let totalProbability = 0;

  children.forEach(({ edgeId, nodeId }) => {
    const childNode = nodes[nodeId];
    const childEdge = edges[edgeId];
    if (!childNode || !childEdge) {
      // NOTE: childNode may not exist if the tree is malformed
      console.warn(`[EVTree] Node ${currentNode.id} has missing node or edge`);
      return;
    }
    const childValue = childNode.data.value;

    // For decision nodes, update edge probabilities based on expected value
    if (currentNode.type === "decision") {
      updateChildEdgeProbability(
        maxChildValue,
        bestProbability,
        childValue,
        childEdge,
      );
    }

    const childProbability = childEdge.data?.probability ?? null;
    if (childValue !== null && childProbability !== null) {
      if (expectedValue === null) {
        expectedValue = 0;
      }
      expectedValue += childValue * childProbability;
      totalProbability += childProbability;
    }
  });

  currentNode.data.priorCosts = cumulativeCost - (currentNode.data.cost ?? 0);

  // Use epsilon comparison for floating point tolerance
  const probabilityIsOne = Math.abs(totalProbability - 1) < EPSILON;

  if (probabilityIsOne) {
    // Assign the computed value (or leave as null if no non-null children)
    currentNode.data.value = expectedValue;
  } else {
    // eslint-disable-next-line no-console
    console.debug(
      `[EVTree] Node ${currentNode.id} has children with total probability not equal to 1.0 (got ${totalProbability}).`,
    );
    // NOTE: a null value should show up in the UI as '???'
    currentNode.data.value = null;
  }
}

function updateChildEdgeProbability(
  maxChildValue: number | null,
  bestProbability: number | null,
  childValue: number | null,
  childEdge: ComputeEdge,
) {
  if (maxChildValue !== null && bestProbability !== null) {
    // Use epsilon comparison for floating point tolerance
    if (childValue !== null && Math.abs(childValue - maxChildValue) < EPSILON) {
      childEdge.data!.probability = bestProbability;
    } else {
      childEdge.data!.probability = 0;
    }
  }
}

function getBestChild(
  children: { edgeId: string; nodeId: string }[],
  nodes: Record<string, ComputeNode>,
) {
  const childNetValues = children
    .map(({ nodeId }) => nodes[nodeId]?.data)
    .filter((data) => data && data.value !== null)
    .map((data) => data!.value!);
  if (childNetValues.length === 0) {
    return { maxChildValue: null, bestProbability: null };
  }

  // Find the maximum net value of children for decision node
  const maxChildValue = max(childNetValues)!;

  // Find all edges with the maximum net value (to handle ties)
  const bestCount = childNetValues.filter(
    (netValue) => netValue === maxChildValue,
  ).length;
  const bestProbability = 1.0 / bestCount;
  return { maxChildValue, bestProbability };
}

export function toComputeNode(
  node: AppNode,
  variables: Variable[] = [],
): ComputeNode {
  return {
    id: node.id,
    type: node.type,
    data: {
      // NOTE: expressions evaluate to null if no expression is provided
      // TODO: can we do better than null?
      value: safeEvalExpr(
        node.data.valueExpr,
        variablesToRecord(variables, "value"),
        null,
      ),
      cost: safeEvalExpr(
        node.data.costExpr,
        variablesToRecord(variables, "cost"),
        null,
      ),
      priorCosts: 0,
    },
  };
}

export function toComputeEdge(
  edge: AppEdge,
  variables: Variable[] = [],
): ComputeEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: {
      probability: safeEvalExpr(
        edge.data?.probabilityExpr,
        variablesToRecord(variables, "probability"),
        null,
      ),
    },
  };
}

// TODO: dehumanize as in 1.0M to 1000000
// const customScale = new humanFormat.Scale(rounding.scale);
// customScale.parse('900K')
// NOTE: see handleNameChange in VariablesInput.tsx for variable name sanitization
export function safeEvalExpr<T extends number | null>(
  expression: string | undefined,
  variables: Record<string, number>,
  defaultValue: number | T,
): number | T {
  // Trim leading whitespace and any currency symbol, convert percentage
  expression = convertPercentage(normalizeExpression(expression));
  if (!expression) {
    return defaultValue;
  }

  try {
    const result = Parser.evaluate(expression, variables);
    if (isNaN(result)) {
      console.warn(
        `[EVTree] Invalid expression "${expression}" evaluated to NaN. Using default value ${defaultValue}.`,
      );
      return defaultValue;
    }
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.debug(
      `[EVTree] Using default value ${defaultValue} because failed expression:`,
      error,
    );
    return defaultValue;
  }
}

/**
 * Strip commas, spaces and currency symbols.
 *
 * TODO: strip all common currency symbols and number separators, or depend on
 * current currency setting? see currency.ts
 */
export function normalizeExpression(expression: string | undefined): string {
  return expression?.trim().replace(/[, $€]/g, "") ?? "";
}

/**
 * Convert a percentage expression like "25%" to its decimal equivalent, "0.25".
 * Invalid percentages return the original expression.
 *
 * TODO: would it be better to expect percentages everywhere and not allow
 * decimal probabilities? percentage is the current default for display
 */
export function convertPercentage(expression: string | undefined): string {
  if (expression?.trim().endsWith("%")) {
    const numStr = expression.trim().slice(0, -1).trim();
    // Empty string before % should return original
    if (numStr === "") {
      return expression;
    }
    const num = Number(numStr);
    if (!isNaN(num)) {
      // NOTE: see also EPSILON
      return round(num / 100, 10).toString();
    }
  }
  return expression ?? "";
}
