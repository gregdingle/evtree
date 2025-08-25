import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  Position,
  getSmoothStepPath,
} from "@xyflow/react";

import { useStore } from "@/hooks/use-store";
import { AppEdge } from "@/lib/edge";
import { selectComputedProbability } from "@/lib/selectors";
import { formatProbability } from "@/utils/format";

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
}: EdgeProps<AppEdge>) {
  const { label } = data ?? {};

  // Use computed probability instead of stored probability
  const computedProbability = useStore((state) =>
    selectComputedProbability(state, id),
  );

  // NOTE: assumes the edge is always left to right
  const [edgePath, labelX, labelY, , offsetY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left,
    // NOTE: need to make space for potential terminal node label of previous
    // level in tree
    stepPosition: 0.25,
  });
  // HACK: Adjust the default label position when at stepPosition > 0 from the
  // vertical segment to the horizontal. When the edge is not left-to-right,
  // which should never happen, simply revert. Special-case when there is no
  // bend, only a single horizontal segment.
  // TODO: contribute this upstream to xyflow
  const isLeftToRight = sourceX < targetX;
  const midPointX = (targetX - sourceX) / 2;
  const adjY = isLeftToRight ? (labelY > sourceY ? offsetY : -offsetY) : 0;
  // Adjust X position based on step position to keep labels on horizontal segment
  const adjX = isLeftToRight ? Math.min(midPointX, 40) : 0;
  const translateX = sourceY == targetY ? sourceX + midPointX : labelX + adjX;
  const transform = `translate(-50%, -50%) translate(${translateX}px, ${
    labelY + adjY
  }px)`;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        // NOTE Tailwind: use ! to override inline/preceding stroke
        className={`${selected ? "!stroke-blue-500/50" : "!stroke-slate-400"}`}
        style={{ strokeLinecap: "round", strokeWidth: 3 }}
      />
      <EdgeLabelRenderer>
        <div className="nopan cursor-pointer text-xs">
          <div
            style={{
              transform,
              pointerEvents: "all",
            }}
            // TODO: add eslint tailwind something to detect non-existing classes
            className="absolute -top-3"
          >
            {label}
          </div>
          <div
            style={{
              transform,
              pointerEvents: "all",
            }}
            className="absolute top-3"
          >
            {formatProbability(computedProbability, 0, "???", "")}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = {
  custom: CustomEdge,
};
