import { AppNode, NodeType, useStore } from "@/hooks/use-store";
import { buildChildToParentNodeMap } from "@/utils/maps";
import { selectCollapsible, selectCurrentEdges } from "@/utils/selectors";
import { useReactFlow } from "@xyflow/react";

export interface ContextMenuProps {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  contextPosition?: { x: number; y: number };
  onClose?: () => void;
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
  contextNode,
}: ContextMenuProps) {
  const {
    onCreateNodeAt,
    onConvertNode,
    toggleNodeCollapse,
    selectSubtree,
    deleteSubTree,
    onCopy,
    connectToNearestNode,
  } = useStore.getState();

  const { hasChildren, isCollapsed } = useStore((state) =>
    selectCollapsible(state, contextNode?.id),
  );

  const edges = useStore(selectCurrentEdges);

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

  const childToParentMap = buildChildToParentNodeMap(edges);

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
      className="rounded border border-gray-300 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
    >
      {contextNode ? (
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
            onClick={() => {
              if (contextNode) {
                selectSubtree(contextNode.id);
                onCopy(true);
              }
            }}
          >
            {/* TODO: is this a good name? */}
            Copy Subtree Structure
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
          <hr className="m-2 border-gray-300 dark:border-gray-600" />
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
          <hr className="m-2 border-gray-300 dark:border-gray-600" />
          <ContextMenuButton
            onClick={() => contextNode && connectToNearestNode(contextNode.id)}
            disabled={contextNode && !!childToParentMap[contextNode.id]}
          >
            Connect to Nearest Node
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
      } flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700`}
    >
      {children}
    </button>
  );
}
