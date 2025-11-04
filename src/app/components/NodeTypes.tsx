import { ReactNode, useEffect, useState } from "react";

import { Handle, NodeProps, Position } from "@xyflow/react";

import { useStore } from "@/hooks/use-store";
import { safeEvalExpr } from "@/lib/expectedValue";
import { AppNode } from "@/lib/node";
import {
  selectCollapsible,
  selectCurrentVariables,
  selectHasParentNode,
  selectNetExpectedValue,
  selectPathProbability,
  selectShowEVs,
} from "@/lib/selectors";
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
  hasChildren: boolean;
  isCollapsed: boolean;
}

const BaseNode = ({ children, id, selected }: BaseNodeProps) => {
  const pathValue = useStore((state) => selectNetExpectedValue(state, id));
  const showEVs = useStore(selectShowEVs);

  return (
    <div
      className={`nopan group relative text-s  ${selected ? "cursor-move" : "cursor-pointer"} z-10`}
    >
      {/* TODO: deprecated... remove if no longer needed
      {data.costExpr && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 transform text-center whitespace-nowrap">
          <InlineEdit
            value={data.costExpr}
            onCommit={(value) => onNodeDataUpdate(id, { costExpr: value })}
            displayFormatter={formatCost}
          />
        </div>
      )}
         */}
      {children}
      {showEVs && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 transform text-center whitespace-nowrap italic">
          {formatValue(pathValue)}
        </div>
      )}
    </div>
  );
};

const DecisionNode = ({ data, selected, id }: NodeProps<AppNode>) => {
  const { hasChildren, isCollapsed } = useStore((state) =>
    selectCollapsible(state, id),
  );
  const hasParent = useStore((state) => selectHasParentNode(state, id));
  return (
    <BaseNode
      data={data}
      id={id}
      selected={selected}
      hasChildren={hasChildren}
      isCollapsed={isCollapsed}
    >
      <div className={`p-4 ${selected ? "bg-blue-500/50" : "bg-red-400"}`}>
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
  const { hasChildren, isCollapsed } = useStore((state) =>
    selectCollapsible(state, id),
  );
  const hasParent = useStore((state) => selectHasParentNode(state, id));
  return (
    <BaseNode
      data={data}
      id={id}
      selected={selected}
      hasChildren={hasChildren}
      isCollapsed={isCollapsed}
    >
      <div
        className={`rounded-full p-4 ${
          selected ? "bg-blue-500/50" : "bg-yellow-400"
        }`}
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
  const showEVs = useStore(selectShowEVs) && pathProbability !== null;
  const variables = useStore(selectCurrentVariables);

  const [isParseable, setIsParseable] = useState(true);

  useEffect(() => {
    const value = data.valueExpr;
    if (value) {
      const parsed = safeEvalExpr(value, variables, null);
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
      className={`nopan group relative text-s ${selected ? "cursor-move" : "cursor-pointer"}`}
    >
      <div
        // NOTE: this wacky CSS creates the triangle shape
        className={`h-0 w-0 border-t-[15px] border-r-[24px] border-b-[15px] border-l-0 border-t-transparent border-b-transparent border-l-transparent ${
          selected ? "border-r-blue-500/50" : "border-r-green-400"
        }`}
      />
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={!hasParent}
        // See https://reactflow.dev/learn/customization/handles#hiding-handles
        className={`opacity-0 group-hover:opacity-100 ${!hasParent ? "" : "invisible"}`}
      />
      <div
        className={`absolute left-8 w-fit ${topOffset} whitespace-nowrap z-10 flex items-center gap-1`}
      >
        <InlineEdit
          value={data.valueExpr}
          onCommit={(value) => onNodeDataUpdate(id, { valueExpr: value })}
          inputClassName="px-0.5 py-0 mt-0.5"
        />
        {!isParseable && (
          <WarningCircle tooltip="Incomplete value expression. Click to edit." />
        )}
      </div>
      {data.costExpr && (
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
      )}
      {showEVs && (
        <div className={`absolute italic top-4 left-8`}>
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
