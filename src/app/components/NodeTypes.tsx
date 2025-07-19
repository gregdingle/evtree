import { AppNode } from "@/hooks/use-store";
import { Handle, Position } from "@xyflow/react";

//
// NOTE: adapted from example at
// https://codesandbox.io/p/sandbox/react-flow-node-shapes-k47gz?file=%2Fsrc%2Freact-flow-renderer%2Fstyles.css%3A17%2C1-24%2C1
// see also https://reactflow.dev/learn/customization/custom-nodes
// see also https://github.com/SilverDecisions/SilverDecisions/wiki/Gallery
//

const SquareNode = ({ data }: { data: AppNode["data"] }) => {
  return (
    <div className="relative">
      <div className="absolute -top-8 max-w-24">{data.label}</div>
      <div className="bg-[#9ca8b3] p-4">
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
      </div>
    </div>
  );
};

const CircleNode = ({ data }: { data: AppNode["data"] }) => {
  return (
    <div className="relative">
      <div className="absolute -top-8 max-w-24">{data.label}</div>
      <div className="bg-[#9ca8b3] p-4 rounded-full">
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
      </div>
    </div>
  );
};

const TriangleNode = ({ data }: { data: AppNode["data"] }) => {
  return (
    <div className="relative">
      <div className="absolute -top-8 max-w-24">{data.label}</div>
      <div
        style={{
          // NOTE: this wacky CSS creates the triangle shape
          borderTop: "20px solid transparent",
          borderBottom: "20px solid transparent",
          borderRight: "32px solid #9ca8b3",
        }}
      ></div>
      <Handle type="source" position={Position.Left} />
    </div>
  );
};

export const nodeTypes = {
  circle: CircleNode,
  square: SquareNode,
  triangle: TriangleNode,
};
