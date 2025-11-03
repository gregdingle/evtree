import { useEffect, useRef, useState } from "react";

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
} from "@/lib/selectors";
import { formatProbability } from "@/utils/format";

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

  // Local state for inline editing
  const [editingField, setEditingField] = useState<
    "label" | "probability" | null
  >(null);
  const labelInputRef = useRef<HTMLTextAreaElement>(null);
  const probabilityInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editingField === "label" && labelInputRef.current) {
      labelInputRef.current.focus();
      handleTextareaResize(labelInputRef.current);
    } else if (editingField === "probability" && probabilityInputRef.current) {
      probabilityInputRef.current.focus();
    }
  }, [editingField]);

  // Auto-resize textarea to fit content
  const handleTextareaResize = (target: HTMLTextAreaElement) => {
    // Reset height to recalculate
    target.style.height = "0px";
    // Set to scrollHeight
    target.style.height = target.scrollHeight + "px";
  };

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
    if (event.key === "Enter" && !event.shiftKey) {
      // Enter without Shift saves
      event.preventDefault();
      setEditingField(null);
    } else if (event.key === "Enter" && event.shiftKey) {
      // Shift+Enter adds a line break (allow default behavior)
      // No preventDefault needed - let textarea handle it naturally
    } else if (event.key === "Escape") {
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

  const handleLabelChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    onEdgeDataUpdate(id, { label: value === "" ? undefined : value });
    handleTextareaResize(event.target);
  };

  const handleProbabilityChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;
    onEdgeDataUpdate(id, { probabilityExpr: value === "" ? undefined : value });
  };

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
  // Special-case when there is no bend, only a single horizontal segment.
  const translateX = sourceY == targetY ? labelX : labelX + adjX;
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
            // HACK: adjust offset position based for textarea vs span
            className={`absolute ${editingField === "label" ? "top-1" : "-top-0.5"} text-center cursor-pointer`}
            onClick={handleLabelClick}
          >
            {editingField === "label" ? (
              <textarea
                ref={labelInputRef}
                value={label ?? ""}
                onChange={handleLabelChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="resize-none overflow-hidden text-center py-0.5"
                spellCheck={false}
                style={{ width: `${labelWidth}px` }}
              />
            ) : (
              <span
                style={{ width: `${labelWidth}px` }}
                className="block hover:bg-gray-100 dark:hover:bg-gray-700 rounded break-words py-0.5 whitespace-pre-wrap"
              >
                {label || "???"}
              </span>
            )}
          </div>
          <div
            style={{
              transform: transformProb,
              pointerEvents: "all",
              // TODO: animation is NOT finished... see getLayoutedElements
              transition: style?.transition,
            }}
            className="absolute top-4 text-center"
          >
            {editingField === "probability" ? (
              <input
                ref={probabilityInputRef}
                type="text"
                value={data?.probabilityExpr ?? ""}
                onChange={handleProbabilityChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="py-0.5 text-center"
                spellCheck={false}
                style={{ width: `${labelWidth}px` }}
              />
            ) : (
              <span
                onClick={
                  hasDecisionNodeSource ? undefined : handleProbabilityClick
                }
                className={`block dark:hover:bg-gray-700 py-0.5 rounded ${hasDecisionNodeSource ? "cursor-not-allowed" : "hover:bg-gray-100 cursor-pointer"}`}
                style={{ width: `${labelWidth}px` }}
              >
                {formatProbability(computedProbability, 0, "???", "")}
                {shouldWarn ? (
                  // TODO: should we show this somehow in inline edit mode?
                  <WarningCircle
                    tooltip="Incomplete probabilities. Click to fix."
                    onClick={(event) => {
                      event.stopPropagation();
                      balanceEdgeProbability(id);
                    }}
                  />
                ) : null}
              </span>
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
