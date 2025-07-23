import { AppEdge, AppNode } from "@/hooks/use-store";
import dagre from "@dagrejs/dagre";
import { Position } from "@xyflow/react";

//
// NOTE: see https://reactflow.dev/examples/layout/dagre
//

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

const nodeWidth = 172;
const nodeHeight = 36;

export const getLayoutedElements = (
  nodes: AppNode[],
  edges: AppEdge[],
  direction = "LR",
  verticalScale = 2,
  horizontalScale = 1
): { nodes: AppNode[]; edges: AppEdge[] } => {
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes: AppNode[] = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode: AppNode = {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      position: {
        x: nodeWithPosition.x * horizontalScale - nodeWidth / 2,
        y: nodeWithPosition.y * verticalScale - nodeHeight / 2,
      },
    };

    return newNode;
  });

  return { nodes: newNodes, edges };
};
