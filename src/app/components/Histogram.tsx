"use client";

import { DecisionTree, StoreState, useStore } from "@/hooks/use-store";
import {
  selectCurrentTree,
  selectPathProbability,
  selectPathValue,
} from "@/utils/selectors";
import { values } from "es-toolkit/compat";
import HRNumbers from "human-readable-numbers";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface HistogramProps extends React.HTMLAttributes<HTMLDivElement> {}

interface TerminalNodeData {
  nodeId: string;
  probability: number | null;
  value: number | null;
}

// TODO: how to optimize display of negative numbers?
export function Histogram(props: HistogramProps) {
  const { currentTree, storeState } = useStore((state) => ({
    currentTree: selectCurrentTree(state),
    storeState: state,
  }));

  if (!currentTree) {
    return (
      <div {...props}>
        <h3 className="text-lg font-semibold mb-4">Histogram</h3>
        <p className="text-gray-500">No tree selected</p>
      </div>
    );
  }

  const terminalNodesData: TerminalNodeData[] = getTerminalNodesData(
    currentTree,
    storeState
  );

  // Calculate histogram bins with even intervals
  const histogramData = getHistogramData(terminalNodesData);

  // Find max probability for scaling
  const maxProbability = Math.max(
    ...histogramData.map((d) => d.probability),
    0
  );

  if (terminalNodesData.length === 0) {
    return (
      <div {...props}>
        <h3 className="text-lg font-semibold mb-4">Histogram</h3>
        <p className="text-gray-500">
          No terminal nodes with complete probability paths found
        </p>
      </div>
    );
  }

  return (
    <div {...props}>
      <h3 className="text-lg font-semibold mb-4">Histogram</h3>
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
            <div key={value} className="flex items-center space-x-4">
              {/* Bin label (y-axis) */}
              <div className="w-32 text-right">{binLabel}</div>

              {/* Bar */}
              <div className="flex-1 flex items-center h-8">
                <div
                  className="bg-blue-500 hover:bg-blue-600 transition-colors duration-200 h-full min-w-[2px]"
                  style={{
                    width: `${widthPercentage}%`,
                  }}
                  title={`Range: ${binLabel}, Probability: ${(
                    probability * 100
                  ).toFixed(1)}%`}
                />
              </div>

              {/* Probability label */}
              <div className="w-16 text-gray-600 text-right">
                {(probability * 100).toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper function to format numbers with 2 significant digits
const formatNumber = (num: number): string => {
  // First humanize, then limit to 2 significant digits
  const humanized = HRNumbers.toHumanString(num);

  if (humanized.length <= 4) return "$" + humanized;

  // TODO: handle i18n currency
  return "$" + humanized.slice(0, 4) + humanized.at(-1);
};

function getTerminalNodesData(
  currentTree: DecisionTree,
  storeState: StoreState
): TerminalNodeData[] {
  if (!currentTree) return [];

  const terminalNodes = values(currentTree.nodes).filter(
    // TODO: should we only get type="terminal" nodes, or any nodes that do not have children?
    (node) => node.type === "terminal"
  );

  return terminalNodes
    .map((node) => ({
      nodeId: node.id,
      probability: selectPathProbability(storeState, node.id),
      value: selectPathValue(storeState, node.id),
    }))
    .filter((data) => data.probability !== null && data.value !== null);
}

// TODO: extract to utils and add unit tests
function getHistogramData(terminalNodesData: TerminalNodeData[]) {
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
