import { ReactNode, useEffect, useState } from "react";

import { Handle, NodeProps, Position } from "@xyflow/react";

import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useStore } from "@/hooks/use-store";
import { normalizeExpression, safeEvalExpr } from "@/lib/expectedValue";
import { AppNode } from "@/lib/node";
import {
  selectCollapsible,
  selectCurrentCurrency,
  selectCurrentRounding,
  selectCurrentVariables,
  selectHasParentNode,
  selectNetExpectedValue,
  selectPathProbability,
  selectShowEVs,
  selectShowPathEVs,
} from "@/lib/selectors";
import { variablesToRecord } from "@/lib/variable";
import { formatCost, formatProbability, formatValue } from "@/utils/format";

import { InlineEdit } from "./InlineEdit";
import { GhostNode, NoteNode } from "./NoteNode";
import { WarningCircle } from "./WarningCircle";

//
// NOTE: adapted from example at
// https://codesandbox.io/p/sandbox/react-flow-node-shapes-k47gz?file=%2Fsrc%2Freact-flow-renderer%2Fstyles.css%3A17%2C1-24%2C1
// see also https://reactflow.dev/learn/customization/custom-nodes
// see also https://github.com/SilverDecisions/SilverDecisions/wiki/Gallery
//

interface BaseNodeProps {
  data: AppNode["data"];
  id: string;
  selected: boolean;
  children: ReactNode;
  isCollapsed: boolean;
  hasParent: boolean;
}

const BaseNode = ({
  children,
  id,
  selected,
  hasParent,
  data,
}: BaseNodeProps) => {
  const pathValue = useStore((state) => selectNetExpectedValue(state, id));
  // NOTE: Responsive design! No toolbar for below medium size screens, so always showEVs
  const isMediumScreenSizeOrLarger = useBreakpoint("md");
  const showEVs = useStore(selectShowEVs) || !isMediumScreenSizeOrLarger;
  const showPathEVs = useStore(selectShowPathEVs);
  const currency = useStore(selectCurrentCurrency);
  const rounding = useStore(selectCurrentRounding);

  const shouldShowPathEV = showEVs && (showPathEVs || !hasParent);
  const { onNodeDataUpdate } = useStore.getState();

  return (
    <div
      className={`nopan group relative  ${selected ? "cursor-move" : "cursor-pointer"} z-10`}
    >
      {data.costExpr && (
        <div className="absolute -top-6.5 left-1/2 -translate-x-1/2 transform text-center whitespace-nowrap">
          <InlineEdit
            value={data.costExpr}
            onCommit={(value) => onNodeDataUpdate(id, { costExpr: value })}
            displayFormatter={(cost) => formatCost(cost, currency, rounding)}
          />
        </div>
      )}
      {children}
      {shouldShowPathEV && (
        <div
          className={`
            absolute
            left-1/2
            -translate-x-1/2
            transform
            border-green-500
            text-center
            whitespace-nowrap
            italic
            ${hasParent ? "-bottom-8 border-1" : "-bottom-9 border-3"}
            rounded
            px-1
          `}
        >
          {pathValue === null
            ? "???"
            : formatValue(pathValue, currency, rounding)}
        </div>
      )}
    </div>
  );
};

const DecisionNode = ({ data, selected, id }: NodeProps<AppNode>) => {
  const { isCollapsed } = useStore((state) => selectCollapsible(state, id));
  const hasParent = useStore((state) => selectHasParentNode(state, id));
  return (
    <BaseNode
      data={data}
      id={id}
      selected={selected}
      isCollapsed={isCollapsed}
      hasParent={hasParent}
    >
      <div
        // TODO: what transparency level looks best here?
        className={`
          bg-sky-400
          p-3.5
          ${selected ? "border-3 border-blue-500" : "border-3 border-sky-500"}
        `}
      >
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={!hasParent}
          className="opacity-0 group-hover:opacity-100"
        />
        <Handle
          type="source"
          position={Position.Right}
          className={`opacity-0 group-hover:opacity-100 ${isCollapsed ? "collapsed" : ""}`}
          isConnectable={isCollapsed ? false : true}
        />
      </div>
    </BaseNode>
  );
};

const ChanceNode = ({ data, selected, id }: NodeProps<AppNode>) => {
  const { isCollapsed } = useStore((state) => selectCollapsible(state, id));
  const hasParent = useStore((state) => selectHasParentNode(state, id));
  return (
    <BaseNode
      data={data}
      id={id}
      selected={selected}
      isCollapsed={isCollapsed}
      hasParent={hasParent}
    >
      <div
        className={`
          rounded-full
          bg-rose-400
        p-3.5
        ${selected ? "border-3 border-blue-500" : "border-3 border-rose-500"}
      `}
      >
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={!hasParent}
          // See https://reactflow.dev/learn/customization/handles#hiding-handles
          className={`opacity-0 group-hover:opacity-100 ${!hasParent ? "" : "invisible"}`}
        />
        <Handle
          type="source"
          position={Position.Right}
          className={`opacity-0 group-hover:opacity-100 ${isCollapsed ? "collapsed" : ""}`}
          isConnectable={isCollapsed ? false : true}
        />
      </div>
    </BaseNode>
  );
};

const TerminalNode = ({ data, selected, id }: NodeProps<AppNode>) => {
  const { onNodeDataUpdate } = useStore.getState();

  const pathProbability = useStore((state) => selectPathProbability(state, id));
  const hasParent = useStore((state) => selectHasParentNode(state, id));
  // NOTE: Responsive design! No toolbar for below medium size screens, so always showEVs
  const isMediumScreenSizeOrLarger = useBreakpoint("md");
  const showEVs =
    (useStore(selectShowEVs) || !isMediumScreenSizeOrLarger) &&
    pathProbability !== null;
  const variables = useStore(selectCurrentVariables);
  const currency = useStore(selectCurrentCurrency);
  const rounding = useStore(selectCurrentRounding);
  const pathValue = useStore((state) => selectNetExpectedValue(state, id));

  const [isParseable, setIsParseable] = useState(true);

  useEffect(() => {
    const valueExpr = data.valueExpr;
    // NOTE: if value is unset, consider it parseable
    if (valueExpr === undefined) {
      setIsParseable(true);
    } else {
      const parsed = safeEvalExpr(
        valueExpr,
        variablesToRecord(variables, "value"),
        null,
      );
      if (parsed === null) {
        setIsParseable(false);
      } else {
        setIsParseable(true);
      }
    }
  }, [variables, data.valueExpr]);

  const topOffset = showEVs ? "-top-2.5" : "top-0.5";
  return (
    <div
      // TODO: sholud also "nodrag" when not selected?
      className={`nopan group relative ${selected ? "cursor-move" : "cursor-pointer"}`}
    >
      <div className="relative">
        {/* Selection border triangle (outer) */}
        <div
          className={`
            absolute
            h-0
            w-0
            border-t-[19px]
            border-r-[32px]
            border-b-[19px]
            border-l-0
            border-t-transparent
            border-b-transparent
            border-l-transparent
            ${selected ? "border-r-blue-500" : "border-r-green-500"}
          `}
          style={{ top: "-4px", left: "-3px" }}
        />
        {/* Main triangle */}
        <div
          // NOTE: this wacky CSS creates the triangle shape
          className={`
            relative
            h-0
            w-0
            border-t-[15px]
            border-r-[24px]
            border-b-[15px]
            border-l-0
            border-t-transparent
            border-r-green-400
            border-b-transparent
            border-l-transparent
          `}
          style={{ left: "2px" }}
        />
      </div>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={!hasParent}
        // See https://reactflow.dev/learn/customization/handles#hiding-handles
        className={`opacity-0 group-hover:opacity-100 ${!hasParent ? "" : "invisible"}`}
      />
      <div
        className={`absolute left-9 w-fit ${topOffset} z-10 flex items-center gap-1 whitespace-nowrap`}
      >
        <InlineEdit
          value={data.valueExpr}
          onCommit={(value) => onNodeDataUpdate(id, { valueExpr: value })}
          displayFormatter={() =>
            isParseable && pathValue !== null
              ? formatValue(pathValue, currency, rounding)
              : "???"
          }
          inputClassName="px-0.5 py-0 mt-0.5"
          displayClassName={
            // NOTE: show how the value is computed when evaluated value differs
            (isParseable &&
            pathValue !== null &&
            // TODO: used parsed value here?
            pathValue !== Number(normalizeExpression(data.valueExpr))
              ? "italic "
              : "") +
            // HACK: copied from InlineEdit defaultDisplayClassName
            "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1.5 py-0.5 -mx-1 rounded"
          }
          allowEmpty={true}
        >
          {!isParseable && (
            <WarningCircle tooltip="Incomplete value expression. Click to edit." />
          )}
        </InlineEdit>
      </div>
      {/*
      TODO: deprecated... decided to show expected net value on canvas only...
        remove me if no longer needed
      data.costExpr && (
        <div
          className={`absolute ${topOffset}`}
          style={{
            left: `${Math.max(3, (data.valueExpr?.length ?? 0) + 4)}ch`,
          }}
        >
          <InlineEdit
            value={data.costExpr}
            onCommit={(value) => onNodeDataUpdate(id, { costExpr: value })}
            displayFormatter={formatCost}
            inputClassName="px-0.5 py-0 mt-0.5"
            displayStyle={{
              width: `${Math.max(3, (data.costExpr?.length ?? 0) + 4)}ch`,
            }}
          />
        </div>
      )*/}
      {showEVs && (
        <div className={`absolute top-4 left-9 italic`}>
          {
            // NOTE: don't show the ??? placeholder for null pathProbability
            formatProbability(pathProbability, 1, "")
          }
        </div>
      )}
    </div>
  );
};

export const nodeTypes = {
  chance: ChanceNode,
  decision: DecisionNode,
  terminal: TerminalNode,
  note: NoteNode,
  ghost: GhostNode,
};
