import { AppNode, useStore } from "@/hooks/use-store";
import { formatProbability, formatValue } from "@/utils/format";
import {
  selectCollapsible,
  selectPathProbability,
  selectPathValue,
} from "@/utils/selectors";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { ReactNode } from "react";

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

const BaseNode = ({ data, children, id }: BaseNodeProps) => {
  // TODO: make the labels allowed to be wider than children shape, but still
  // line-break at some max limit
  const pathValue = useStore((state) => selectPathValue(state, id));

  return (
    <div className="nodrag nopan relative cursor-pointer text-xs">
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 -translate-y-1/2 transform text-center whitespace-nowrap">
        {data.label}
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
  return (
    <BaseNode
      data={data}
      id={id}
      selected={selected}
      hasChildren={hasChildren}
      isCollapsed={isCollapsed}
    >
      <div className={`p-4 ${selected ? "bg-blue-500/50" : "bg-slate-400"}`}>
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
      </div>
    </BaseNode>
  );
};

const ChanceNode = ({ data, selected, id }: NodeProps<AppNode>) => {
  const { hasChildren, isCollapsed } = useStore((state) =>
    selectCollapsible(state, id),
  );
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
        <Handle type="target" position={Position.Left} />
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
  const pathValue = useStore((state) => selectPathValue(state, id));

  return (
    <div className="nodrag nopan relative cursor-pointer text-xs">
      {data.label && (
        <div className="absolute -top-2 left-8 whitespace-nowrap">
          {data.label}
        </div>
      )}
      <div
        // NOTE: this wacky CSS creates the triangle shape
        className={`h-0 w-0 border-t-[15px] border-r-[24px] border-b-[15px] border-l-0 border-t-transparent border-b-transparent border-l-transparent ${
          selected ? "border-r-blue-500/50" : "border-r-slate-400"
        }`}
      />
      <Handle type="target" position={Position.Left} />
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

export const nodeTypes = {
  chance: ChanceNode,
  decision: DecisionNode,
  terminal: TerminalNode,
};
