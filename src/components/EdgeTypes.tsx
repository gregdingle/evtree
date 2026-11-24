import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  Position,
  getStraightPath,
} from "@xyflow/react";

import { useStore } from "@/hooks/use-store";
import { useShowEVs, useTreeCanvas } from "@/hooks/use-tree-canvas";
import { AppEdge } from "@/lib/edge";
import { convertProbabilityInputToDecimal } from "@/lib/percentage";
import {
  selectComputedProbability,
  selectHasDecisionNodeSource,
  selectPathProbability,
  selectShouldShowProbabilityWarning,
} from "@/lib/selectors";
import { getSmoothStepPathWithAbsoluteStep } from "@/lib/smoothStepPath";
import { formatProbability } from "@/utils/format";

import { InlineEdit } from "./InlineEdit";
import { WarningCircle } from "./WarningCircle";

/**
 * @see https://reactflow.dev/learn/customization/edge-labels
 */
export function CustomEdge({
  id,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps<AppEdge>) {
  const { label } = data ?? {};

  const { updateEdgeData, balanceEdgeProbability } = useStore.getState();

  // Use computed probability instead of stored probability
  const computedProbability = useStore((state) =>
    selectComputedProbability(state, id),
  );
  const isZeroProbability = useStore(
    (state) => selectPathProbability(state, target) === 0,
  );

  // QUESTION: best significant digits for users? precision vs usability tradeoff?
  const significantDigits = 6;
  const shouldWarn = useStore((state) =>
    selectShouldShowProbabilityWarning(state, id, significantDigits),
  );

  const hasDecisionNodeSource = useStore((state) =>
    selectHasDecisionNodeSource(state, id),
  );

  // NOTE: Responsive design! No toolbar for below medium size screens, so always showEVs
  const showEVs = useShowEVs();
  const { withoutProbabilityIds } = useTreeCanvas();

  // NOTE: assumes the edge is always left to right
  // NOTE: empirically determined to provide enough space for a terminal node
  // label not to overlap with the elbow sibiling subtree
  const stepPositionPx = 80; // Absolute pixel distance from source
  const [edgePath, labelX, labelY, , offsetY] =
    getSmoothStepPathWithAbsoluteStep({
      sourceX,
      sourceY,
      sourcePosition: Position.Right,
      targetX,
      targetY,
      targetPosition: Position.Left,
      stepPositionPx,
      borderRadius: 20, // increase from default of 5
    });
  // HACK: Adjust the default label position when at stepPosition > 0 from the
  // vertical segment to the horizontal. When the edge is not left-to-right,
  // which should never happen, simply revert.
  // TODO: contribute this upstream to xyflow
  const isLeftToRight = sourceX < targetX;
  const midPointX = (targetX - sourceX) / 2;
  const adjY = isLeftToRight ? (labelY > sourceY ? offsetY : -offsetY) : 0;
  // Adjust X position to keep labels on horizontal segment
  // With absolute step positioning, we can use stepPositionPx directly
  const adjX = isLeftToRight ? Math.min(midPointX, stepPositionPx / 2) : 0;
  const translateX = labelX + adjX;

  // Simplified transforms now that we use absolute positioning
  const transformProb = `translate(-50%, -50%) translate(${translateX}px, ${labelY + adjY}px)`;
  const transformLabel = `translate(-50%, -100%) translate(${translateX}px, ${labelY + adjY}px)`;

  // HACK: width by empirical testing... 30px min to fit "???" placeholder
  const labelWidth = Math.max(30, (targetX - sourceX) / 1.5);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        // NOTE Tailwind: use ! to override inline/preceding stroke
        className={`${selected ? "!stroke-blue-500" : "!stroke-slate-400"} ${showEVs && isZeroProbability ? "opacity-50" : ""}`}
        style={{
          strokeLinecap: "round",
          strokeWidth: 3,
        }}
      />
      <EdgeLabelRenderer>
        <div className="nopan leading-tight">
          <div
            style={{
              transform: transformLabel,
              pointerEvents: "all",
              maxWidth: `${labelWidth}px`,
            }}
            className={`absolute -top-0.5 z-10 text-center ${showEVs && isZeroProbability ? "opacity-50" : ""}`}
          >
            <InlineEdit
              value={label}
              onCommit={(value) => updateEdgeData(id, { label: value })}
              displayFormatter={() => label || "???"}
              placeholder="???"
              multiline={true}
              inputStyle={{ width: `${labelWidth}px` }}
              displayStyle={{ width: `${labelWidth}px` }}
            />
          </div>
          <div
            style={{
              transform: transformProb,
              pointerEvents: "all",
            }}
            className={`absolute top-4 z-10 text-center ${showEVs && isZeroProbability ? "opacity-50" : ""} ${withoutProbabilityIds.has(id) ? "hidden" : ""}`}
          >
            {hasDecisionNodeSource ? (
              showEVs && (
                <div
                  className="rounded py-0.5 italic dark:hover:bg-gray-700"
                  style={{ width: `${labelWidth}px` }}
                >
                  {formatProbability(computedProbability, 0, "???", "")}
                </div>
              )
            ) : (
              <div className="py-0.5" style={{ width: `${labelWidth}px` }}>
                <InlineEdit
                  value={data?.probabilityExpr}
                  onCommit={(value) => {
                    // QUESTION: should the right-side input work the same way?
                    updateEdgeData(id, {
                      probabilityExpr: convertProbabilityInputToDecimal(value),
                    });
                  }}
                  displayFormatter={() =>
                    formatProbability(computedProbability, 0, "??%", "")
                  }
                  placeholder="??%"
                  inputClassName="py-0.5 text-center"
                  inputStyle={{ width: `${labelWidth}px` }}
                  displayStyle={{ width: `${labelWidth}px` }}
                >
                  {shouldWarn ? (
                    <WarningCircle
                      // NOTE: it doesn't always fix in one click: if the sum of
                      // other probabilities is >1, clicking this only sets it
                      // to 0%, need to click on another edge to fully balance.
                      tooltip="Incomplete probabilities. Click to fix."
                      onClick={(event) => {
                        event.stopPropagation();
                        balanceEdgeProbability(id, significantDigits);
                      }}
                    />
                  ) : null}
                </InlineEdit>
              </div>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

/**
 * Simple arrow edge for note nodes that doesn't participate in tree logic.
 * Uses a straight path and arrow marker.
 */
function ArrowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  style,
  sourcePosition,
}: EdgeProps<AppEdge>) {
  // HACK: offset to make it look like edge is continuation of NoteNode border
  const offsetY =
    sourcePosition == Position.Top
      ? 4
      : sourcePosition == Position.Bottom
        ? -4
        : 0;
  const offsetX =
    sourcePosition == Position.Left
      ? 4
      : sourcePosition == Position.Right
        ? -4
        : 0;
  // NOTE: getSimpleBezierPath will not point the arrow head as well
  const [edgePath] = getStraightPath({
    sourceX: sourceX + offsetX,
    sourceY: sourceY + offsetY,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      className={`${selected ? "!stroke-blue-500" : "!stroke-gray-400"}`}
      style={{
        strokeWidth: 2,
        // NOTE: strokeDasharray should match the border of the NoteNode
        strokeDasharray: "6,4",
        transition: style?.transition,
      }}
      markerEnd={selected ? "url(#arrow-selected)" : "url(#arrow)"}
    />
  );
}

export const edgeTypes = {
  // TODO: rename CustomEdge to BranchEdge or something
  custom: CustomEdge,
  arrow: ArrowEdge,
};
