import { values } from "es-toolkit/compat";

import { StoreState } from "@/hooks/use-store";

import { selectNetExpectedValue, selectPathProbability } from "./selectors";
import { DecisionTree } from "./tree";

export interface TerminalNodeData {
  nodeId: string;
  probability: number | null;
  value: number | null;
}

export type HistogramData = {
  value: number;
  binEnd: number;
  probability: number;
  binSize: number;
};

/**
 * TODO: refactor this into a selector
 */
export function getTerminalNodesData(
  currentTree: DecisionTree | undefined,
  storeState: StoreState,
): TerminalNodeData[] {
  if (!currentTree) return [];

  const terminalNodes = values(currentTree.nodes).filter(
    // TODO: should we only get type="terminal" nodes, or any nodes that do not have children?
    (node) => node.type === "terminal",
  );

  return terminalNodes
    .map((node) => ({
      nodeId: node.id,
      probability: selectPathProbability(storeState, node.id),
      value: selectNetExpectedValue(storeState, node.id),
    }))
    .filter((data) => data.probability !== null && data.value !== null);
}

// TODO: add unit tests
export function getHistogramData(
  terminalNodesData: TerminalNodeData[],
): HistogramData[] {
  if (terminalNodesData.length === 0) return [];

  // Find the range of values
  const values = terminalNodesData
    .map(({ value }) => value!)
    .filter((v) => v !== null);

  if (values.length === 0) return [];

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  // Determine bin size - you can adjust this logic
  const range = maxValue - minValue;
  const binSize = range <= 10 ? 1 : Math.ceil(range / 10); // Max 10 bins, or 1 unit bins for small ranges

  // Create evenly spaced bins
  const bins = new Map<number, { probability: number }>();

  // Initialize all bins from min to max
  for (
    let binStart = Math.floor(minValue / binSize) * binSize;
    binStart <= maxValue;
    binStart += binSize
  ) {
    bins.set(binStart, { probability: 0 });
  }

  // Populate bins with data
  terminalNodesData.forEach(({ probability, value }) => {
    if (probability === null || value === null) return;

    // Find which bin this value belongs to
    const binStart = Math.floor(value / binSize) * binSize;

    if (bins.has(binStart)) {
      const bin = bins.get(binStart)!;
      bin.probability += probability;
    }
  });

  return Array.from(bins.entries())
    .map(([binStart, { probability }]) => ({
      value: binStart,
      binEnd: binStart + binSize,
      probability,
      binSize,
    }))
    .sort((a, b) => a.value - b.value);
}

/**
 * Creates a two-bin histogram around a breakpoint value.
 * Returns bins for "under" and "over or equal to" the breakpoint.
 * TODO: add unit tests
 */
export function getOverUnderData(
  terminalNodesData: TerminalNodeData[],
  breakpoint: number,
): HistogramData[] {
  if (terminalNodesData.length === 0) return [];

  let underProbability = 0;
  let overProbability = 0;
  let maxValue = -Infinity;

  // Calculate probabilities for each bin and track max
  terminalNodesData.forEach(({ probability, value }) => {
    if (probability === null || value === null) return;

    if (value < breakpoint) {
      underProbability += probability;
    } else {
      overProbability += probability;
    }

    maxValue = Math.max(maxValue, value);
  });

  // Always return exactly two bins, starting from 0
  return [
    {
      value: Math.min(
        0,
        Math.min(...terminalNodesData.map(({ value }) => value!)),
      ),
      binEnd: breakpoint,
      probability: underProbability,
      binSize: breakpoint,
    },
    {
      value: breakpoint,
      binEnd: maxValue > -Infinity ? maxValue + 1 : breakpoint + 1,
      probability: overProbability,
      binSize: maxValue > -Infinity ? maxValue - breakpoint + 1 : 1,
    },
  ];
}
