import { AppNode, NodeType, useStore } from "@/hooks/use-store";
import { buildChildToParentNodeMap } from "@/utils/maps";
import { selectCollapsible, selectCurrentEdges } from "@/utils/selectors";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  DocumentDuplicateIcon,
  LinkIcon,
  PlayIcon,
  RectangleGroupIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useReactFlow } from "@xyflow/react";
import { ContextMenuButton } from "./ContextMenuButton";

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
            <RectangleGroupIcon className="h-4 w-4" />
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
            <ClipboardDocumentIcon className="h-4 w-4" />
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
            <DocumentDuplicateIcon className="h-4 w-4" />
            {/* TODO: is this a good name? */}
            Copy Subtree Structure
          </ContextMenuButton>
          <ContextMenuButton
            onClick={() => contextNode && toggleNodeCollapse(contextNode.id)}
            disabled={!hasChildren}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
            {isCollapsed ? "Expand Subtree" : "Collapse Subtree"}
          </ContextMenuButton>
          <ContextMenuButton
            onClick={() => contextNode && deleteSubTree(contextNode.id)}
          >
            <TrashIcon className="h-4 w-4" />
            Delete Subtree
          </ContextMenuButton>
          <hr className="m-2 border-gray-300 dark:border-gray-600" />
          <ContextMenuButton
            onClick={() => handleConvertNode("decision")}
            disabled={contextNode?.type === "decision"}
          >
            <div className="mr-0.25 h-3.5 w-3.5 border-1 border-current"></div>
            Convert to Decision Node
          </ContextMenuButton>
          <ContextMenuButton
            onClick={() => handleConvertNode("chance")}
            disabled={contextNode?.type === "chance"}
          >
            <div className="h-4 w-4 rounded-full border-1 border-current"></div>
            Convert to Chance Node
          </ContextMenuButton>
          <ContextMenuButton
            onClick={() => handleConvertNode("terminal")}
            disabled={hasChildren || contextNode?.type === "terminal"}
          >
            <PlayIcon className="-ml-0.75 h-5 w-5 rotate-180" />
            Convert to Terminal Node
          </ContextMenuButton>
          <hr className="m-2 border-gray-300 dark:border-gray-600" />
          <ContextMenuButton
            onClick={() => contextNode && connectToNearestNode(contextNode.id)}
            disabled={contextNode && !!childToParentMap[contextNode.id]}
          >
            <LinkIcon className="h-4 w-4" />
            Connect to Nearest Node
          </ContextMenuButton>
        </>
      ) : (
        <>
          <ContextMenuButton onClick={() => handleCreateNode("decision")}>
            <div className="h-4 w-4 border-1 border-current"></div>
            Create Decision Node
          </ContextMenuButton>
          <ContextMenuButton onClick={() => handleCreateNode("chance")}>
            <div className="h-4 w-4 rounded-full border-1 border-current"></div>
            Create Chance Node
          </ContextMenuButton>
          <ContextMenuButton onClick={() => handleCreateNode("terminal")}>
            <PlayIcon className="-ml-0.75 h-5 w-5 rotate-180" />
            Create Terminal Node
          </ContextMenuButton>
        </>
      )}
    </div>
  );
}
