"use client";

import React, { useEffect } from "react";

import { round, values } from "es-toolkit/compat";
import HRNumbers from "human-readable-numbers";

import { StoreState, useStore } from "@/hooks/use-store";
import {
  selectCurrentTree,
  selectNetExpectedValue,
  selectPathProbability,
} from "@/lib/selectors";
import { DecisionTree } from "@/lib/tree";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface HistogramProps extends React.HTMLAttributes<HTMLDivElement> {}

interface TerminalNodeData {
  nodeId: string;
  probability: number | null;
  value: number | null;
}

type HistogramData = {
  value: number;
  binEnd: number;
  probability: number;
  binSize: number;
};

// TODO: how to optimize display of negative numbers?
export function Histogram(props: HistogramProps) {
  const { currentTree, storeState } = useStore((state) => ({
    currentTree: selectCurrentTree(state),
    storeState: state,
  }));

  const terminalNodesData: TerminalNodeData[] = getTerminalNodesData(
    currentTree,
    storeState,
  );

  let initialOverUnder = terminalNodesData.reduce(
    (sum, { probability, value }) => {
      if (probability === null || value === null) return sum;
      return sum + probability * value;
    },
    0,
  );
  // Round initial breakpoint to 1 significant digit
  initialOverUnder = round(
    initialOverUnder,
    -Math.floor(Math.log10(Math.abs(initialOverUnder))),
  );

  const [breakpoint, setBreakpoint] = React.useState<number>(initialOverUnder);
  useEffect(() => {
    setBreakpoint(initialOverUnder);
  }, [initialOverUnder]);

  if (!currentTree) {
    return (
      <div {...props}>
        <h3 className="mb-4 text-lg font-semibold">Histogram</h3>
        <p className="text-gray-500">No tree selected</p>
      </div>
    );
  }

  // Calculate histogram bins with even intervals
  const histogramData = getHistogramData(terminalNodesData);

  const overUnderData = getOverUnderData(terminalNodesData, breakpoint);

  // Calculate min/max from terminal node values for input constraints
  const minTerminalValue =
    terminalNodesData.length > 0
      ? Math.min(...terminalNodesData.map(({ value }) => value!))
      : 0;
  const maxTerminalValue =
    terminalNodesData.length > 0
      ? Math.max(...terminalNodesData.map(({ value }) => value!))
      : 0;

  // Find max probability for scaling
  const maxProbability = Math.max(
    ...histogramData.map((d) => d.probability),
    0,
  );

  if (terminalNodesData.length === 0) {
    return (
      <div {...props}>
        <h3 className="mb-4 text-lg font-semibold">
          Probability Distribution Of Terminal Values
        </h3>
        <p className="text-gray-500">
          No terminal nodes with probability found
        </p>
      </div>
    );
  }

  return (
    <div {...props}>
      <h3 className="mb-4 text-lg font-semibold">
        Probability Distribution Of Terminal Values
      </h3>
      {HistogramBars(histogramData, maxProbability)}
      <h3 className="mt-8 mb-4 text-lg font-semibold">
        Probability Over-Under
        <input
          name="breakpoint"
          value={breakpoint}
          type="number"
          step={Math.abs(initialOverUnder)}
          min={minTerminalValue}
          max={maxTerminalValue}
          onChange={(e) => setBreakpoint(parseFloat(e.target.value))}
          className="mx-4 rounded border-2 p-1"
          style={{
            // NOTE: dynamically size input to fit content, +4 for up-down buttons
            width: `${Math.max(3, (breakpoint ?? "").toString().length + 4)}ch`,
          }}
        />
      </h3>
      <div className="space-y-px">
        {HistogramBars(overUnderData, maxProbability)}
      </div>
    </div>
  );
}

// Helper function to format numbers with 2 significant digits
// TODO: handle currency in a general way
const formatNumber = (num: number): string => {
  // First humanize, then limit to 2 significant digits
  const humanized = HRNumbers.toHumanString(num);

  if (humanized.length <= 4) return "" + humanized;

  return "" + humanized.slice(0, 4) + humanized.at(-1);
};

function HistogramBars(histogramData: HistogramData[], maxProbability: number) {
  return (
    <div className="space-y-px">
      {histogramData.map(({ value, binEnd, probability, binSize }) => {
        const widthPercentage =
          maxProbability > 0 ? (probability / maxProbability) * 100 : 0;

        // Create bin label with humanized numbers
        const binLabel =
          binSize === 1
            ? formatNumber(value)
            : `${formatNumber(value)} - ${formatNumber(binEnd - 1)}`;

        return (
          <div key={binLabel} className="flex items-center space-x-4">
            {/* Bin label (y-axis) */}
            <div className="w-32 text-right">{binLabel}</div>

            {/* Bar */}
            <div className="flex h-12 flex-1 items-center">
              <div
                className="h-full min-w-[2px] bg-blue-500 transition-colors duration-200 hover:bg-blue-600"
                style={{
                  width: `${widthPercentage}%`,
                }}
                title={`Range: ${binLabel}, Probability: ${(
                  probability * 100
                ).toFixed(1)}%`}
              />
            </div>

            {/* Probability label */}
            <div className="w-16 text-right text-gray-600">
              {(probability * 100).toFixed(1)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getTerminalNodesData(
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

// TODO: extract to utils and add unit tests
function getHistogramData(
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
 * TODO: extract to utils and add unit tests
 */
function getOverUnderData(
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
