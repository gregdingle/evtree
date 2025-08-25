import { useEffect, useRef, useState } from "react";

import { ExclamationCircleIcon } from "@heroicons/react/24/solid";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  Position,
  getSmoothStepPath,
} from "@xyflow/react";

import { useStore } from "@/hooks/use-store";
import { AppEdge } from "@/lib/edge";
import {
  selectComputedProbability,
  selectShouldShowProbabilityWarning,
} from "@/lib/selectors";
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

  // Local state for inline editing
  const [editingField, setEditingField] = useState<
    "label" | "probability" | null
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { onEdgeDataUpdate } = useStore.getState();

  // Use computed probability instead of stored probability
  const computedProbability = useStore((state) =>
    selectComputedProbability(state, id),
  );

  const shouldWarn = useStore((state) =>
    selectShouldShowProbabilityWarning(state, id),
  );

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingField]);

  const handleLabelClick = () => {
    // NOTE: do not stopPropagation so we also select the edge
    setEditingField("label");
  };

  const handleProbabilityClick = () => {
    // NOTE: do not stopPropagation so we also select the edge
    setEditingField("probability");
  };

  const handleBlur = () => {
    setEditingField(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      setEditingField(null);
    } else if (event.key === "Tab") {
      event.preventDefault();
      // Switch between label and probability inputs
      // TODO: should tab thru all siblings? or all inputs in tree?
      if (editingField === "label") {
        setEditingField("probability");
      } else if (editingField === "probability") {
        setEditingField("label");
      }
    }
  };

  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    onEdgeDataUpdate(id, { label: value === "" ? undefined : value });
  };

  const handleProbabilityChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;
    onEdgeDataUpdate(id, { probabilityExpr: value === "" ? undefined : value });
  };

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
            className="absolute -top-3"
          >
            {editingField === "label" ? (
              <input
                ref={inputRef}
                type="text"
                value={label ?? ""}
                onChange={handleLabelChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="px-1 py-0.5 focus:outline-none text-center"
                spellCheck={false}
              />
            ) : (
              <span
                onClick={handleLabelClick}
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1 py-0.5 rounded"
              >
                {label || "???"}
              </span>
            )}
          </div>
          <div
            style={{
              transform,
              pointerEvents: "all",
            }}
            className="absolute top-3"
          >
            {editingField === "probability" ? (
              <input
                ref={inputRef}
                type="text"
                value={data?.probabilityExpr ?? ""}
                onChange={handleProbabilityChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="px-1 py-0.5 focus:outline-none text-center"
                spellCheck={false}
              />
            ) : (
              <span
                onClick={handleProbabilityClick}
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1 py-0.5 rounded"
              >
                {formatProbability(computedProbability, 0, "???", "")}
                {shouldWarn ? (
                  // TODO: should we show this somehow in inline edit mode?
                  <ExclamationCircleIcon className="ml-0.5 -mt-0.5 inline-block h-3 w-3 fill-red-600" />
                ) : null}
              </span>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = {
  custom: CustomEdge,
};
