"use client";

import React, { useEffect } from "react";

import { round, sum } from "es-toolkit/compat";

import { useStore } from "@/hooks/use-store";
import { CurrencyCode } from "@/lib/Currency";
import {
  HistogramData,
  TerminalNodeData,
  getHistogramData,
  getOverUnderData,
  getTerminalNodesData,
} from "@/lib/histogram";
import { RoundingCode } from "@/lib/rounding";
import {
  selectCurrentCurrency,
  selectCurrentRounding,
  selectCurrentTree,
} from "@/lib/selectors";
import { formatHistogramNumber } from "@/utils/format";

import { CanvasCenteredHelpMessage } from "./CanvasCenteredHelpMessage";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface HistogramProps extends React.HTMLAttributes<HTMLDivElement> {}

// TODO: how to optimize display of negative numbers?
export function Histogram(props: HistogramProps) {
  const { currentTree, storeState } = useStore((state) => ({
    currentTree: selectCurrentTree(state),
    storeState: state,
  }));

  const currency = useStore(selectCurrentCurrency);
  const rounding = useStore(selectCurrentRounding);

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
  const sumTerminalPathProb =
    terminalNodesData.length > 0
      ? sum(terminalNodesData.map(({ probability }) => probability!))
      : 0;

  // Find max probability for scaling
  const maxProbability = Math.max(
    ...histogramData.map((d) => d.probability),
    0,
  );

  if (sumTerminalPathProb < 1) {
    return (
      <div {...props}>
        <CanvasCenteredHelpMessage text="Missing terminal probabilities or values" />
      </div>
    );
  }

  if (sumTerminalPathProb > 1) {
    return (
      <div {...props}>
        <CanvasCenteredHelpMessage text="Terminal probabilities sum to more than 1.0" />
      </div>
    );
  }

  return (
    <div {...props} id="histogram-export">
      <h3 className="mb-4 text-lg font-semibold">
        Probability Distribution of Outcome Values
      </h3>
      {HistogramBars(histogramData, maxProbability, currency, rounding)}
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
        {HistogramBars(overUnderData, maxProbability, currency, rounding)}
      </div>
    </div>
  );
}

function HistogramBars(
  histogramData: HistogramData[],
  maxProbability: number,
  currency: CurrencyCode,
  rounding: RoundingCode,
) {
  return (
    <div className="space-y-px">
      {histogramData.map(({ value, binEnd, probability, binSize }) => {
        const widthPercentage =
          maxProbability > 0 ? (probability / maxProbability) * 100 : 0;

        // Create bin label with humanized numbers
        const binLabel =
          binSize === 1
            ? formatHistogramNumber(value, currency, rounding)
            : `${formatHistogramNumber(value, currency, rounding)} to ${formatHistogramNumber(binEnd - 1, currency, rounding)}`;

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
