import { ReactNode, useEffect, useRef, useState } from "react";

import { Handle, NodeProps, Position } from "@xyflow/react";

import { useStore } from "@/hooks/use-store";
import { AppNode } from "@/lib/node";
import {
  selectCollapsible,
  selectHasParentNode,
  selectNetExpectedValue,
  selectPathProbability,
} from "@/lib/selectors";
import { formatProbability, formatValue } from "@/utils/format";

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

const BaseNode = ({ children, id }: BaseNodeProps) => {
  // TODO: make the labels allowed to be wider than children shape, but still
  // line-break at some max limit
  const pathValue = useStore((state) => selectNetExpectedValue(state, id));

  return (
    <div className="nopan relative cursor-pointer text-xs">
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 -translate-y-1/2 transform text-center whitespace-nowrap">
        {/* TODO: deprecated... remove if not needed {data.label} */}
      </div>
      {children}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 transform text-center whitespace-nowrap">
        {formatValue(pathValue)}
        {/* TODO: show cost separately? {formatCost(data.cost)} */}
      </div>
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
      <div className={`p-4 ${selected ? "bg-blue-500/50" : "bg-slate-400"}`}>
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={!hasParent}
        />
        <Handle
          type="source"
          position={Position.Right}
          className={isCollapsed ? "collapsed" : ""}
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
          selected ? "bg-blue-500/50" : "bg-slate-400"
        }`}
      >
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={!hasParent}
          // See https://reactflow.dev/learn/customization/handles#hiding-handles
          className={!hasParent ? "" : "invisible"}
        />
        <Handle
          type="source"
          position={Position.Right}
          className={isCollapsed ? "collapsed" : ""}
          isConnectable={isCollapsed ? false : true}
        />
      </div>
    </BaseNode>
  );
};

const TerminalNode = ({ data, selected, id }: NodeProps<AppNode>) => {
  const pathProbability = useStore((state) => selectPathProbability(state, id));
  const pathValue = useStore((state) => selectNetExpectedValue(state, id));
  const hasParent = useStore((state) => selectHasParentNode(state, id));

  return (
    <div className="nopan relative cursor-pointer text-xs">
      {data.label && (
        <div className="absolute -top-2 left-8 whitespace-nowrap">
          {/* TODO: deprecated... remove if not needed {data.label} */}
        </div>
      )}
      <div
        // NOTE: this wacky CSS creates the triangle shape
        className={`h-0 w-0 border-t-[15px] border-r-[24px] border-b-[15px] border-l-0 border-t-transparent border-b-transparent border-l-transparent ${
          selected ? "border-r-blue-500/50" : "border-r-slate-400"
        }`}
      />
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={!hasParent}
        // See https://reactflow.dev/learn/customization/handles#hiding-handles
        className={!hasParent ? "" : "invisible"}
      />
      <div
        className={`absolute left-8 max-w-32 ${
          data.label ? "top-2" : "-top-1"
        } whitespace-nowrap`}
      >
        {/* NOTE: we only show the net path value, following silver decisions
        {formatValue(data.value)}
        {formatCost(data.cost)}
        */}
        {formatValue(pathValue)}
      </div>
      <div className={`absolute ${data.label ? "top-6" : "top-5"} left-8`}>
        {/*
         TODO: always show pathProbability?
         NOTE: don't show the ??? placeholder for null pathProbability
         */}
        {formatProbability(pathProbability, 1, "")}
      </div>
    </div>
  );
};

const NoteNode = ({ data, selected, id }: NodeProps<AppNode>) => {
  // Local state for inline editing
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { onNodeDataUpdate } = useStore.getState();

  // Auto-resize textarea on content change
  // TODO: fix small height diff bug
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [data.description, isEditing]);

  const handleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      setIsEditing(false);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsEditing(false);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    onNodeDataUpdate(id, { description: value === "" ? undefined : value });

    // Auto-resize textarea immediately on input
    event.target.style.height = "auto";
    event.target.style.height = `${event.target.scrollHeight - 4}px`;
  };

  return (
    <div className="nopan relative cursor-pointer text-xs">
      <div
        className={`w-36 min-h-24 p-4 border-2 border-dashed ${
          selected
            ? "border-blue-500 bg-blue-500/10"
            : "border-gray-400 bg-yellow-100 dark:bg-yellow-900/20"
        }`}
      >
        {/* Description section */}
        {isEditing ? (
          <textarea
            ref={inputRef}
            value={data.description || ""}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed bg-transparent border-none outline-none w-full resize-none min-h-[3rem]"
            placeholder="Enter note content"
            spellCheck={false}
          />
        ) : (
          <div
            className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed cursor-text"
            onClick={handleClick}
          >
            {data.description || (
              <span className="text-gray-400 italic">
                Click to edit note...
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const nodeTypes = {
  chance: ChanceNode,
  decision: DecisionNode,
  terminal: TerminalNode,
  note: NoteNode,
};
