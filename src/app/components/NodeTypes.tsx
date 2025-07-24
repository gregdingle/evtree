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
}

interface CollapseButtonProps {
  nodeId: string;
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggle: (nodeId: string) => void;
}

const CollapseButton = ({
  nodeId,
  hasChildren,
  isCollapsed,
  onToggle,
}: CollapseButtonProps) => {
  if (!hasChildren) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(nodeId);
      }}
      // TODO: center arrow better somehow
      className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-gray-300 rounded-full text-xs hover:bg-gray-100 z-10"
      style={{ pointerEvents: "all" }}
    >
      {/* // TODO: do these icons make sense? */}
      {isCollapsed ? "◀" : "▶"}
    </button>
  );
};

const BaseNode = ({ data, children, id, selected }: BaseNodeProps) => {
  // TODO: make the labels allowed to be wider than children shape, but still
  // line-break at some max limit
  const pathValue = useStore((state) => selectPathValue(state, id));
  const { toggleNodeCollapse } = useStore.getState();

  // Check if this node has children
  const { hasChildren, isCollapsed } = useStore((state) =>
    selectCollapsible(state, id)
  );

  return (
    <div className="relative text-xs">
      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center whitespace-nowrap">
        {data.label}
      </div>
      {children}
      {
        // TODO: is there is a risk of losing track of collapsed nodes when the
        // button only shows when the node is selected?
        selected && (
          <CollapseButton
            nodeId={id}
            hasChildren={hasChildren}
            isCollapsed={isCollapsed}
            onToggle={toggleNodeCollapse}
          />
        )
      }
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-center whitespace-nowrap">
        {formatValue(pathValue)}
        {/* TODO: show cost separately? {formatCost(data.cost)} */}
      </div>
    </div>
  );
};

const DecisionNode = ({ data, selected, id }: NodeProps<AppNode>) => {
  return (
    <BaseNode data={data} id={id} selected={selected}>
      <div className={`p-8 ${selected ? "bg-blue-500/50" : "bg-[#9ca8b3]"}`}>
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
      </div>
    </BaseNode>
  );
};

const ChanceNode = ({ data, selected, id }: NodeProps<AppNode>) => {
  return (
    <BaseNode data={data} id={id} selected={selected}>
      <div
        className={` p-8 rounded-full ${
          selected ? "bg-blue-500/50" : "bg-[#9ca8b3]"
        }`}
      >
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
      </div>
    </BaseNode>
  );
};

const TerminalNode = ({ data, selected, id }: NodeProps<AppNode>) => {
  const pathProbability = useStore((state) => selectPathProbability(state, id));
  const pathValue = useStore((state) => selectPathValue(state, id));

  return (
    <div className="relative text-xs">
      <div className="absolute -top-0 left-14 whitespace-nowrap">
        {data.label}
      </div>
      <div
        style={{
          // NOTE: this wacky CSS creates the triangle shape
          borderTop: "30px solid transparent",
          borderBottom: "30px solid transparent",
          borderRight: `48px solid ${
            // TODO: sync selected color with tree selected color and tailwind color above
            selected ? "rgba(0, 123, 255, 0.5)" : "#9ca8b3"
          }`,
        }}
      />
      <Handle type="target" position={Position.Left} />
      <div className={`absolute left-14 max-w-32 top-5 whitespace-nowrap`}>
        {/* NOTE: we only show the net path value, following silver decisions
        {formatValue(data.value)}
        {formatCost(data.cost)}
        */}
        {formatValue(pathValue)}
      </div>
      <div className="absolute top-10 left-14">
        {/*
         TODO: always show pathProbability?
         NOTE: don't show the ??? placeholder for null pathProbability
         */}
        {formatProbability(pathProbability, 3, "")}
      </div>
    </div>
  );
};

export const nodeTypes = {
  chance: ChanceNode,
  decision: DecisionNode,
  terminal: TerminalNode,
};
