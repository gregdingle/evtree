import { AppNode, NodeType, useStore } from "@/hooks/use-store";
import { selectCollapsible } from "@/utils/selectors";
import { useReactFlow } from "@xyflow/react";

export interface ContextMenuProps {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  contextPosition?: { x: number; y: number };
  onClose?: () => void;
  // TODO: remove isNodeContext not needed , just use contextNode
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
  const {
    onCreateNodeAt,
    onConvertNode,
    toggleNodeCollapse,
    selectSubtree,
    deleteSubTree,
    onCopy,
  } = useStore.getState();

  const { hasChildren, isCollapsed } = useStore((state) =>
    selectCollapsible(state, contextNode?.id)
  );

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
        // TODO: hide or disable the current node type from the menu and apply
        // TODO: put in more actions like delete, copy, paste (replace), select subtree
        <>
          <ContextMenuButton
            onClick={() => contextNode && selectSubtree(contextNode.id)}
            disabled={!hasChildren}
          >
            Select Subtree
          </ContextMenuButton>
          <ContextMenuButton
            onClick={() => {
              if (contextNode) {
                selectSubtree(contextNode.id);
                onCopy();
              }
            }}
          >
            Copy Subtree
          </ContextMenuButton>
          <ContextMenuButton
            onClick={() => contextNode && toggleNodeCollapse(contextNode.id)}
            disabled={!hasChildren}
          >
            {isCollapsed ? "Expand Subtree" : "Collapse Subtree"}
          </ContextMenuButton>
          <ContextMenuButton
            onClick={() => contextNode && deleteSubTree(contextNode.id)}
          >
            Delete Subtree
          </ContextMenuButton>
          <ContextMenuButton
            onClick={() => handleConvertNode("decision")}
            disabled={contextNode?.type === "decision"}
          >
            Convert to Decision Node
          </ContextMenuButton>
          <ContextMenuButton
            onClick={() => handleConvertNode("chance")}
            disabled={contextNode?.type === "chance"}
          >
            Convert to Chance Node
          </ContextMenuButton>
          <ContextMenuButton
            onClick={() => handleConvertNode("terminal")}
            disabled={hasChildren || contextNode?.type === "terminal"}
          >
            Convert to Terminal Node
          </ContextMenuButton>
        </>
      ) : (
        <>
          <ContextMenuButton onClick={() => handleCreateNode("decision")}>
            Create Decision Node
          </ContextMenuButton>
          <ContextMenuButton onClick={() => handleCreateNode("chance")}>
            Create Chance Node
          </ContextMenuButton>
          <ContextMenuButton onClick={() => handleCreateNode("terminal")}>
            Create Terminal Node
          </ContextMenuButton>
        </>
      )}
    </div>
  );
}

interface ContextMenuButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function ContextMenuButton({
  onClick,
  disabled,
  children,
}: ContextMenuButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${
        disabled ? "opacity-50" : ""
      } px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left flex items-center gap-2`}
    >
      {children}
    </button>
  );
}
