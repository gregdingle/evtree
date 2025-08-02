import { AppEdge } from "@/hooks/use-store";
import { formatProbability } from "@/utils/format";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
  Position,
} from "@xyflow/react";

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
  const { label, probability } = data ?? {};
  // NOTE: assumes the edge is always left to right
  const [edgePath, labelX, labelY, , offsetY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left,
    stepPosition: 0, // bend at source
  });
  // HACK: Adjust the default label position when at stepPosition=0 from the
  // vertical segment to the horizontal. When the edge is not left-to-right,
  // which should never happen, simply revert. Special-case when there is no
  // bend, only a single horizontal segment.
  // TODO: contribute this upstream to xyflow
  const isLeftToRight = sourceX < targetX;
  const midPointX = (targetX - sourceX) / 2;
  const adjY = isLeftToRight ? (labelY > sourceY ? offsetY : -offsetY) : 0;
  const adjX = isLeftToRight ? midPointX : 0;
  const translateX = sourceY == targetY ? sourceX + midPointX : labelX + adjX;
  const transform = `translate(-50%, -50%) translate(${translateX}px, ${
    labelY + adjY
  }px)`;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={`stroke-[3] ${selected ? "stroke-blue-500/50" : ""}`}
      />
      <EdgeLabelRenderer>
        <div className="nodrag nopan cursor-pointer text-xs">
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
            {formatProbability(probability, 0, "???", "")}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = {
  custom: CustomEdge,
};
