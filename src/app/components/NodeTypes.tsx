import { AppNode } from "@/hooks/use-store";
import { formatValue } from "@/utils/format";
import { Handle, Position } from "@xyflow/react";

//
// NOTE: adapted from example at
// https://codesandbox.io/p/sandbox/react-flow-node-shapes-k47gz?file=%2Fsrc%2Freact-flow-renderer%2Fstyles.css%3A17%2C1-24%2C1
// see also https://reactflow.dev/learn/customization/custom-nodes
// see also https://github.com/SilverDecisions/SilverDecisions/wiki/Gallery
//

const SquareNode = ({ data }: { data: AppNode["data"] }) => {
  return (
    <div className="relative text-xs">
      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 max-w-24 text-center">
        {data.label}
      </div>
      <div className="bg-[#9ca8b3] p-8">
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
      </div>
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 max-w-24 text-center">
        {formatValue(data.value)}
      </div>
    </div>
  );
};

const CircleNode = ({ data }: { data: AppNode["data"] }) => {
  return (
    <div className="relative text-xs">
      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 max-w-24 text-center">
        {data.label}
      </div>
      <div className="bg-[#9ca8b3] p-8 rounded-full">
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
      </div>
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 max-w-24 text-center">
        {formatValue(data.value)}
      </div>
    </div>
  );
};

const TriangleNode = ({ data }: { data: AppNode["data"] }) => {
  return (
    <div className="relative text-xs">
      <div className="absolute -top-0 left-14 max-w-24">{data.label}</div>
      <div
        style={{
          // NOTE: this wacky CSS creates the triangle shape
          borderTop: "30px solid transparent",
          borderBottom: "30px solid transparent",
          borderRight: "48px solid #9ca8b3",
        }}
      />
      <Handle type="target" position={Position.Left} />
      <div className="absolute top-10 left-14 max-w-24">
        {formatValue(data.value)}
      </div>
    </div>
  );
};

export const nodeTypes = {
  circle: CircleNode,
  square: SquareNode,
  triangle: TriangleNode,
};
