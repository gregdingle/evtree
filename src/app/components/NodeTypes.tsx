import { ReactNode, useEffect, useRef, useState } from "react";

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

const BaseNode = ({ children, id, selected, data }: BaseNodeProps) => {
  const { onNodeDataUpdate } = useStore.getState();

  // TODO: make the labels allowed to be wider than children shape, but still
  // line-break at some max limit
  const pathValue = useStore((state) => selectNetExpectedValue(state, id));
  const showEVs = useStore(selectShowEVs);

  // Local state for inline cost editing
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [editingCost, setEditingCost] = useState("");
  const costInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (isEditingCost && costInputRef.current) {
      costInputRef.current.focus();
    }
  }, [isEditingCost]);

  const handleCostClick = () => {
    setEditingCost(data.costExpr ?? "");
    setIsEditingCost(true);
  };

  const commitCost = () => {
    onNodeDataUpdate(id, {
      costExpr: editingCost === "" ? undefined : editingCost,
    });
    setIsEditingCost(false);
  };

  const handleCostBlur = () => {
    commitCost();
  };

  const handleCostKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitCost();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsEditingCost(false);
    }
  };

  const handleCostChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditingCost(event.target.value);
  };

  return (
    <div
      className={`nopan group relative text-s  ${selected ? "cursor-move" : "cursor-pointer"} z-10`}
    >
      {data.costExpr && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 transform text-center whitespace-nowrap">
          {isEditingCost ? (
            <input
              ref={costInputRef}
              type="text"
              value={editingCost}
              onChange={handleCostChange}
              onBlur={handleCostBlur}
              onKeyDown={handleCostKeyDown}
              spellCheck={false}
              className="px-0.5 py-0 text-center"
              style={{
                width: `${Math.max(3, editingCost.length + 1)}ch`,
              }}
            />
          ) : (
            <div
              onClick={handleCostClick}
              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1.5 py-0.5 -mx-1 rounded"
            >
              {formatCost(data.costExpr)}
            </div>
          )}
        </div>
      )}
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

  // Local state for inline editing
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [editingValue, setEditingValue] = useState("");
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [editingCost, setEditingCost] = useState("");
  const valueInputRef = useRef<HTMLInputElement>(null);
  const costInputRef = useRef<HTMLInputElement>(null);
  const [isParseable, setIsParseable] = useState(true);
  // TODO: extract common inline editing component from EdgeTypes.tsx and NodeTypes.tsx, and maybe even NoteNode.tsx

  // Auto-focus input when editing starts
  useEffect(() => {
    if (isEditingValue && valueInputRef.current) {
      valueInputRef.current.focus();
    } else if (isEditingCost && costInputRef.current) {
      costInputRef.current.focus();
    }
  }, [isEditingValue, isEditingCost]);

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

  const handleValueClick = () => {
    // NOTE: do not stopPropagation so we also select the node
    setEditingValue(data.valueExpr ?? "");
    setIsEditingValue(true);
  };

  const commitValue = () => {
    onNodeDataUpdate(id, {
      valueExpr: editingValue === "" ? undefined : editingValue,
    });
    setIsEditingValue(false);
  };

  const handleBlur = () => {
    commitValue();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitValue();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsEditingValue(false);
    }
  };

  const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditingValue(event.target.value);
  };

  const handleCostClick = () => {
    setEditingCost(data.costExpr ?? "");
    setIsEditingCost(true);
  };

  const commitCost = () => {
    onNodeDataUpdate(id, {
      costExpr: editingCost === "" ? undefined : editingCost,
    });
    setIsEditingCost(false);
  };

  const handleCostBlur = () => {
    commitCost();
  };

  const handleCostKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitCost();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsEditingCost(false);
    }
  };

  const handleCostChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditingCost(event.target.value);
  };

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
        className={`absolute left-8 w-fit ${topOffset} whitespace-nowrap z-10`}
      >
        {isEditingValue ? (
          // TODO: we only show the net path value, following silver decisions,
          // but this causes an inconsistency when between the displayed value
          // and the editing value when there is a cost to the node, or a cost
          // upstream... diff valueExpr and pathValue
          <input
            ref={valueInputRef}
            type="text"
            value={editingValue}
            onChange={handleValueChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="px-0.5 py-0 mt-0.5"
            style={{
              // NOTE: dynamically size input to fit content
              width: `${Math.max(3, editingValue.length + 1)}ch`,
            }}
          />
        ) : (
          <div
            onClick={handleValueClick}
            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1.5 py-0.5 -mx-1 rounded"
          >
            {/* NOTE: unlike other nodes, we do not show EV here, only inputted value,
              so it can be modified inline. See alternative:
              {formatValue(pathValue) || "???"}
            */}
            {data.valueExpr ?? "???"}
            {!isParseable && (
              <WarningCircle tooltip="Incomplete value expression. Click to edit." />
            )}
          </div>
        )}
      </div>
      {data.costExpr && (
        <div
          className={`absolute ${topOffset}`}
          style={{
            left: `${Math.max(3, (data.valueExpr?.length ?? 0) + 4)}ch`,
          }}
        >
          {isEditingCost ? (
            <input
              ref={costInputRef}
              type="text"
              value={editingCost}
              onChange={handleCostChange}
              onBlur={handleCostBlur}
              onKeyDown={handleCostKeyDown}
              spellCheck={false}
              className="px-0.5 py-0 mt-0.5"
              style={{
                width: `${Math.max(3, editingCost.length + 1)}ch`,
              }}
            />
          ) : (
            <div
              onClick={handleCostClick}
              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1.5 py-0.5 -mx-1 rounded"
              style={{
                width: `${Math.max(3, data.costExpr.length + 4)}ch`,
              }}
            >
              {formatCost(data.costExpr)}
            </div>
          )}
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
