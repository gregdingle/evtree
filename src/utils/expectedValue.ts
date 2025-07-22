import { AppEdge, AppNode } from "@/hooks/use-store";
import { values } from "es-toolkit/compat";

type AdjacencyList = Record<
  string,
  {
    edgeId: string;
    nodeId: string;
  }[]
>;

// TODO: how to keep in sync with ComputeNode and AppEdge types?
// TODO: make more explicit `number | undefined`?
export interface ComputeNode {
  id: string;
  data: {
    value?: number;
  };
}

export interface ComputeEdge {
  id: string;
  source: string;
  target: string;
  data?: {
    probability?: number;
  };
}

/**
 * Subset of AppNode needed for computeNodeValues.
 * TODO: make more explicit `number | undefined`?
 */
export interface ComputeNode {
  id: string;
  data: {
    value?: number;
  };
}

/**
 * Subset of AppEdge needed for computeNodeValues.
 * TODO: make more explicit `number | undefined`?
 */
export interface ComputeEdge {
  id: string;
  source: string;
  target: string;
  data?: {
    probability?: number;
  };
}

/**
 * Computes and assigns values recursively for input `nodes`. The value of a
 * node is defined as the average of its children's values weighted by the
 * probabilities of the associated edges.
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
  edges: Record<string, ComputeEdge>
): Record<string, ComputeNode> {
  const rootNodes = values(nodes).filter((node) => {
    // A root node has no incoming edges
    return !values(edges).some((edge) => edge.target === node.id);
  });
  if (rootNodes.length === 0) {
    console.warn("[EVTree] No root nodes found, cannot compute values.");
    return nodes;
  }

  const adjList = buildAdjacencyList(values(edges));

  rootNodes.forEach((rootNode) => {
    computeNodeValuesRecursive(nodes, edges, rootNode, adjList);
  });

  return nodes;
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
  adjList: AdjacencyList
) {
  const children = adjList[parentNode.id] || [];

  // Base case: if no children, use node's value directly
  if (children.length === 0) {
    if (parentNode.data.value === undefined) {
      // eslint-disable-next-line no-console
      console.debug(
        `[EVTree] Terminal node ${parentNode.id} has undefined value.`
      );
    }
    return;
  }

  children.forEach(({ nodeId }) => {
    computeNodeValuesRecursive(nodes, edges, nodes[nodeId]!, adjList);
  });

  let totalValue: number | undefined = undefined;
  let totalProbability = 0;

  children.forEach(({ edgeId, nodeId }) => {
    const childNode = nodes[nodeId]!;
    const childEdge = edges[edgeId]!;
    if (childNode) {
      const childValue = childNode.data.value;
      const childProbability = childEdge.data?.probability;
      if (childValue !== undefined && childProbability !== undefined) {
        if (totalValue === undefined) {
          totalValue = 0;
        }
        totalValue += childValue * childProbability;
        totalProbability += childProbability;
      }
    }
  });

  if (totalProbability < 1) {
    // eslint-disable-next-line no-console
    console.debug(
      `[EVTree] Node ${parentNode.id} has children with less than 1.0 total probability.`
    );
    // TODO: what to do about missing probability? highlight in UI somehow?
  }

  // Assign the computed value (or leave as undefined if no defined children)
  parentNode.data.value = totalValue;
}

export function toComputeNode(node: AppNode): ComputeNode {
  return {
    id: node.id,
    data: {
      value: node.data.value,
    },
  };
}

export function toComputeEdge(edge: AppEdge): ComputeEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: {
      probability: edge.data?.probability,
    },
  };
}
