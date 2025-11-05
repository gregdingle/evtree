import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  Position,
  getSmoothStepPath,
  getStraightPath,
} from "@xyflow/react";

import { useStore } from "@/hooks/use-store";
import { AppEdge } from "@/lib/edge";
import {
  selectComputedProbability,
  selectHasDecisionNodeSource,
  selectShouldShowProbabilityWarning,
  selectShowEVs,
} from "@/lib/selectors";
import { formatProbability } from "@/utils/format";

import { InlineEdit } from "./InlineEdit";
import { WarningCircle } from "./WarningCircle";

/**
 * @see https://reactflow.dev/learn/customization/edge-labels
 */
export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
  style,
}: EdgeProps<AppEdge>) {
  const { label } = data ?? {};

  const { onEdgeDataUpdate, balanceEdgeProbability } = useStore.getState();

  // Use computed probability instead of stored probability
  const computedProbability = useStore((state) =>
    selectComputedProbability(state, id),
  );

  const shouldWarn = useStore((state) =>
    selectShouldShowProbabilityWarning(state, id),
  );

  const hasDecisionNodeSource = useStore((state) =>
    selectHasDecisionNodeSource(state, id),
  );

  const showEVs = useStore(selectShowEVs);

  // NOTE: assumes the edge is always left to right
  const stepPosition = 0.25;
  const [edgePath, labelX, labelY, , offsetY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left,
    // NOTE: need to make space for potential terminal node label of previous
    // level in tree
    stepPosition,
    borderRadius: 20, // increase from default of 5
  });
  // HACK: Adjust the default label position when at stepPosition > 0 from the
  // vertical segment to the horizontal. When the edge is not left-to-right,
  // which should never happen, simply revert.
  // TODO: contribute this upstream to xyflow
  const isLeftToRight = sourceX < targetX;
  const midPointX = (targetX - sourceX) / 2;
  const adjY = isLeftToRight ? (labelY > sourceY ? offsetY : -offsetY) : 0;
  // Adjust X position based on step position to keep labels on horizontal segment
  // HACK: Min 18px of margin from vertical segment looks good enough
  const adjX = isLeftToRight ? Math.min(midPointX, 18) : 0;
  // TODO: Special-case when there is no bend, only a single horizontal segment, no siblings?
  const translateX = labelX + adjX;
  const transformProb = `translate(-${(stepPosition / 2) * 100}%, -50%) translate(${translateX}px, ${
    labelY + adjY
  }px)`;
  const transformLabel = `translate(-${(stepPosition / 2) * 100}%, -100%) translate(${translateX}px, ${
    labelY + adjY
  }px)`;

  // HACK: width by empirical testing... 30px min to fit "???" placeholder
  const labelWidth = Math.max(30, (targetX - sourceX) / 1.5);

  // TODO: The above code positions and sizes the label container pretty good,
  // but not perfect. We need to start over from first principles of the
  // getSmoothStepPath function and CSS transform to make it perfect.

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        // NOTE Tailwind: use ! to override inline/preceding stroke
        className={`${selected ? "!stroke-blue-500/50" : "!stroke-slate-400"}`}
        style={{
          strokeLinecap: "round",
          strokeWidth: 3,
          // TODO: animation is NOT finished... see getLayoutedElements
          transition: style?.transition
            ? // HACK: make animation work with SVG path
              style.transition.replace("transform", "d")
            : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div className="nopan text-s leading-tight">
          <div
            style={{
              transform: transformLabel,
              pointerEvents: "all",
              // TODO: animation is NOT finished... see getLayoutedElements
              transition: style?.transition,
              maxWidth: `${labelWidth}px`,
            }}
            className="absolute -top-0.5 text-center z-10"
          >
            <InlineEdit
              value={label}
              onCommit={(value) => onEdgeDataUpdate(id, { label: value })}
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
              // TODO: animation is NOT finished... see getLayoutedElements
              transition: style?.transition,
            }}
            className="absolute top-4 text-center z-10"
          >
            {hasDecisionNodeSource ? (
              showEVs && (
                <div
                  className="dark:hover:bg-gray-700 py-0.5 rounded italic"
                  style={{ width: `${labelWidth}px` }}
                >
                  {formatProbability(computedProbability, 0, "???", "")}
                </div>
              )
            ) : (
              <div className="py-0.5" style={{ width: `${labelWidth}px` }}>
                <InlineEdit
                  value={data?.probabilityExpr}
                  onCommit={(value) =>
                    onEdgeDataUpdate(id, { probabilityExpr: value })
                  }
                  displayFormatter={() =>
                    formatProbability(computedProbability, 0, "???", "")
                  }
                  placeholder="???"
                  inputClassName="py-0.5 text-center"
                  inputStyle={{ width: `${labelWidth}px` }}
                  displayStyle={{ width: `${labelWidth}px` }}
                >
                  {shouldWarn ? (
                    <WarningCircle
                      tooltip="Incomplete probabilities. Click to fix."
                      onClick={(event) => {
                        event.stopPropagation();
                        balanceEdgeProbability(id);
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
      className={`${selected ? "!stroke-blue-500/50" : "!stroke-gray-400"}`}
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
