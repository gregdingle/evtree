import { AppNode } from "@/hooks/use-store";
import { Handle, Position } from "@xyflow/react";

//
// NOTE: adapted from example at
// https://codesandbox.io/p/sandbox/react-flow-node-shapes-k47gz?file=%2Fsrc%2Freact-flow-renderer%2Fstyles.css%3A17%2C1-24%2C1
// see also https://reactflow.dev/learn/customization/custom-nodes
//

const RectangleNode = ({ data }: { data: AppNode["data"] }) => {
  return (
    <div style={{ background: "#9ca8b3", padding: "14px" }}>
      <Handle type="target" position={Position.Left} />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

const CircleNode = ({ data }: { data: AppNode["data"] }) => {
  return (
    <div
      style={{
        backgroundColor: "#9ca8b3",
        padding: "14px",
        borderRadius: "50px",
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

const TriangleNode = ({ data }: { data: AppNode["data"] }) => {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} />
      <div
        style={{
          borderLeft: "50px solid transparent",
          borderRight: "50px solid transparent",
          borderBottom: "80px solid #9ca8b3",
        }}
      >
        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 text-center text-sm font-medium text-white w-12">
          {data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export const nodeTypes = {
  circle: CircleNode,
  rectangle: RectangleNode,
  triangle: TriangleNode,
};
