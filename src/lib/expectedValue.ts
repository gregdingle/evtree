import { isNaN, max, values } from "es-toolkit/compat";
import { Parser } from "expr-eval";
import { AppEdge } from "./edge";
import { AppNode, NodeType } from "./node";

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

/**
 * Computes values recursively for input `nodes`. The value of a
 * node is defined as the average of its children's values weighted by the
 * probabilities of the associated edges. Updates values in-place.
 *
 * The probabilities following a decision node will also be updated in-place
 * according to expected value. The probability of the edge that has the highest
 * expected value out of a decision node will be set to 1.0, while the others
 * will be set to 0.0. When there is a tie, the probabilities will be set to 1 /
 * n, where n is the number of edges with the highest expected value.
 *
 * NOTE: Any cost associated with a node is subtracted from its value before being
 * added to the expected value of the parent. However, the parent's OWN COST and
 * it's ANCESTORS's costs are NOT added in. You can think of the expected value
 * at a node as the FORWARD-LOOKING VALUE only.
 *
 * TODO: Figure out how and whether to replace selectPathValue with cumulative
 * costs here for gain in code simplicity and performance. We will also probably
 * want to do this to support feeShiftingRate or other features. For each node,
 * the cost from parents should be added to the expected net value from children
 * to get the final node value.
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
  const rootNodes = values(nodes).filter((node) => {
    // A root node has no incoming edges
    return !values(edges).some((edge) => edge.target === node.id);
  });
  if (rootNodes.length === 0) {
    console.warn("[EVTree] No root nodes found, cannot compute values.");
    return { nodes, edges };
  }

  const adjList = buildAdjacencyList(values(edges));

  rootNodes.forEach((rootNode) => {
    computeNodeValuesRecursive(nodes, edges, rootNode, adjList);
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
  parentNode: ComputeNode,
  adjList: AdjacencyList,
) {
  const children = adjList[parentNode.id] || [];

  // Base case: if no children, use node's value directly
  if (children.length === 0) {
    if (parentNode.data.value === null) {
      // eslint-disable-next-line no-console
      console.debug(`[EVTree] Terminal node ${parentNode.id} has null value.`);
    }
    return;
  }

  children.forEach(({ nodeId }) => {
    computeNodeValuesRecursive(nodes, edges, nodes[nodeId]!, adjList);
  });

  // If this is a decision node, we need to update the edge probability
  const { maxChildValue, bestProbability } =
    parentNode.type === "decision"
      ? getBestChild(children, nodes)
      : { maxChildValue: null, bestProbability: null };

  let totalValue: number | null = null;
  let totalProbability = 0;

  children.forEach(({ edgeId, nodeId }) => {
    const childNode = nodes[nodeId]!;
    const childEdge = edges[edgeId]!;
    const childValue = childNode.data.value;
    const childCost = childNode.data.cost;

    // For decision nodes, update edge probabilities based on expected value
    if (parentNode.type === "decision") {
      if (maxChildValue !== null && bestProbability !== null) {
        if (
          childValue !== null &&
          childValue - (childCost ?? 0) === maxChildValue
        ) {
          childEdge.data!.probability = bestProbability;
        } else {
          childEdge.data!.probability = 0;
        }
      }
    }

    const childProbability = childEdge.data?.probability ?? null;
    if (childValue !== null && childProbability !== null) {
      if (totalValue === null) {
        totalValue = 0;
      }
      totalValue += (childValue - (childCost ?? 0)) * childProbability;
      totalProbability += childProbability;
    }
  });

  if (totalProbability < 1) {
    // eslint-disable-next-line no-console
    console.debug(
      `[EVTree] Node ${parentNode.id} has children with less than 1.0 total probability.`,
    );
    // TODO: what to do about missing probability? highlight in UI somehow?
  }

  // Assign the computed value (or leave as undefined if no defined children)
  parentNode.data.value = totalValue;
}

function getBestChild(
  children: { edgeId: string; nodeId: string }[],
  nodes: Record<string, ComputeNode>,
) {
  const childNetValues = children
    .map(({ nodeId }) => nodes[nodeId]!.data)
    .filter((data) => data.value !== null)
    .map((data) => data.value! - (data.cost ?? 0));
  if (childNetValues.length === 0) {
    return { maxChildValue: null, bestProbability: null };
  }

  // Find the maximum net value of children for decision node
  const maxChildValue = max(childNetValues);

  // Find all edges with the maximum net value (to handle ties)
  const bestCount = childNetValues.filter(
    (netValue) => netValue === maxChildValue,
  ).length;
  const bestProbability = 1.0 / bestCount;
  return { maxChildValue, bestProbability };
}

export function toComputeNode(
  node: AppNode,
  // TODO: get variables from tree settings
  variables: Record<string, number> = {},
): ComputeNode {
  return {
    id: node.id,
    type: node.type,
    data: {
      // NOTE: expressions evaluate to null if no expression is provided
      // TODO: can we do better than null?
      value: safeEvalExpr(node.data.valueExpr, variables, null),
      cost: safeEvalExpr(node.data.costExpr, variables, null),
    },
  };
}

export function toComputeEdge(edge: AppEdge): ComputeEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: {
      probability: edge.data?.probability ?? null,
    },
  };
}

// TODO: remove commas, as in 1,000 to 1000?
// TODO: dehumanize as in 1.0M to 1000000?
function safeEvalExpr(
  expression: string | undefined,
  variables: Record<string, number>,
  defaultValue: number | null,
): number | null {
  if (typeof expression === "undefined" || expression.trim() === "") {
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
  } catch {
    // TODO: too noisy for production, but useful for debugging
    // console.warn(
    //   `[EVTree] Using default value ${defaultValue} because failed expression:`,
    //   error,
    // );
    return defaultValue;
  }
}
