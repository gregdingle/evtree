import { AppNode, NodeType, useStore } from "@/hooks/use-store";
import { useReactFlow } from "@xyflow/react";

export interface ContextMenuProps {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  contextPosition?: { x: number; y: number };
  onClose?: () => void;
  isNodeContext?: boolean;
  contextNode?: AppNode;
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
  isNodeContext,
  contextNode,
}: ContextMenuProps) {
  const { onCreateNodeAt, onConvertNode } = useStore.getState();
  const { screenToFlowPosition } = useReactFlow();

  const handleCreateNode = (nodeType: NodeType) => {
    if (!contextPosition) return;

    // Convert the relative position to ReactFlow coordinates
    const flowPosition = screenToFlowPosition(contextPosition);
    onCreateNodeAt(flowPosition, nodeType);
    onClose?.();
  };

  const handleConvertNode = (nodeType: NodeType) => {
    if (!contextNode) return;

    onConvertNode(contextNode.id, nodeType);
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
      {isNodeContext ? (
        // TODO: hide or disable the current node type from the menu
        // TODO: put in more actions like delete, copy, paste (replace), select subtree
        <>
          <button
            onClick={() => handleConvertNode("decision")}
            className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left flex items-center gap-2"
          >
            Convert to Decision Node
          </button>
          <button
            onClick={() => handleConvertNode("chance")}
            className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left flex items-center gap-2"
          >
            Convert to Chance Node
          </button>
          <button
            onClick={() => handleConvertNode("terminal")}
            className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left flex items-center gap-2"
          >
            Convert to Terminal Node
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => handleCreateNode("decision")}
            className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left flex items-center gap-2"
          >
            Create Decision Node
          </button>
          <button
            onClick={() => handleCreateNode("chance")}
            className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left flex items-center gap-2"
          >
            Create Chance Node
          </button>
          <button
            onClick={() => handleCreateNode("terminal")}
            className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left flex items-center gap-2"
          >
            Create Terminal Node
          </button>
        </>
      )}
    </div>
  );
}
