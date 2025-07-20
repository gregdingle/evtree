import { useStore } from "@/hooks/use-store";
import { NodeType } from "@/utils/node";
import { useReactFlow } from "@xyflow/react";

export interface ContextMenuProps {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  contextPosition?: { x: number; y: number };
  onClose?: () => void;
}

/**
 * @see https://reactflow.dev/examples/interaction/context-menu
 */
export default function ContextMenu({
  top,
  left,
  right,
  bottom,
  contextPosition,
  onClose,
}: ContextMenuProps) {
  const { onCreateNodeAt } = useStore.getState();
  const { screenToFlowPosition } = useReactFlow();

  const handleCreateNode = (nodeType: NodeType) => {
    if (!contextPosition) return;

    // Convert the relative position to ReactFlow coordinates
    const flowPosition = screenToFlowPosition(contextPosition);
    onCreateNodeAt(flowPosition, nodeType);
    onClose?.();
  };

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        right,
        bottom,
        zIndex: 1000,
      }}
      className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg py-1"
    >
      <button
        onClick={() => handleCreateNode("square")}
        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left flex items-center gap-2"
      >
        Create Square
      </button>
      <button
        onClick={() => handleCreateNode("circle")}
        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left flex items-center gap-2"
      >
        Create Circle
      </button>
      <button
        onClick={() => handleCreateNode("triangle")}
        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left flex items-center gap-2"
      >
        Create Triangle
      </button>
    </div>
  );
}
