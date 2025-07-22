import { AppNode, useStore } from "@/hooks/use-store";
import { formatProbability, formatValue } from "@/utils/format";
import { selectPathProbability } from "@/utils/selectors";
import { Handle, NodeProps, Position } from "@xyflow/react";

//
// NOTE: adapted from example at
// https://codesandbox.io/p/sandbox/react-flow-node-shapes-k47gz?file=%2Fsrc%2Freact-flow-renderer%2Fstyles.css%3A17%2C1-24%2C1
// see also https://reactflow.dev/learn/customization/custom-nodes
// see also https://github.com/SilverDecisions/SilverDecisions/wiki/Gallery
//

const SquareNode = ({ data, selected }: NodeProps<AppNode>) => {
  return (
    <div className="relative text-xs">
      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 max-w-24 text-center">
        {data.label}
      </div>
      <div className={`p-8 ${selected ? "bg-blue-500/50" : "bg-[#9ca8b3]"}`}>
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
      </div>
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 max-w-24 text-center whitespace-nowrap">
        {formatValue(data.value)}
        {data.cost && ` ${formatValue(data.cost * -1)}`}
      </div>
    </div>
  );
};

const CircleNode = ({ data, selected }: NodeProps<AppNode>) => {
  return (
    <div className="relative text-xs">
      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 max-w-24 text-center">
        {data.label}
      </div>
      <div
        className={` p-8 rounded-full ${
          selected ? "bg-blue-500/50" : "bg-[#9ca8b3]"
        }`}
      >
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
      </div>
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 max-w-24 text-center whitespace-nowrap">
        {formatValue(data.value)}
        {data.cost && ` ${formatValue(data.cost * -1)}`}
      </div>
    </div>
  );
};

const TriangleNode = ({ data, selected, id }: NodeProps<AppNode>) => {
  const pathProbability = useStore((state) => selectPathProbability(state, id));
  return (
    <div className="relative text-xs">
      <div className="absolute -top-0 left-14 max-w-24">{data.label}</div>
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
        {formatValue(data.value)}
        {data.cost && ` ${formatValue(data.cost * -1)}`}
      </div>
      <div className="absolute top-10 left-14">
        {/* // TODO: always show pathProbability? */}
        {formatProbability(pathProbability)}
      </div>
    </div>
  );
};

export const nodeTypes = {
  circle: CircleNode,
  square: SquareNode,
  triangle: TriangleNode,
};
