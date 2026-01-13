import {
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  CursorArrowRaysIcon,
  CursorArrowRippleIcon,
  DocumentDuplicateIcon,
  LinkIcon,
  PencilSquareIcon,
  PlayIcon,
  PlusIcon,
  RectangleGroupIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useReactFlow } from "@xyflow/react";

import { useStore } from "@/hooks/use-store";
import { getChildToParentNodeMap } from "@/lib/maps";
import { AppNode, NodeType } from "@/lib/node";
import {
  selectCollapsible,
  selectCurrentEdges,
  selectHasClipboardContent,
} from "@/lib/selectors";

import { ContextMenuButton } from "./ContextMenuButton";
import { ContextMenuSubmenu } from "./ContextMenuSubmenu";

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
 *
 * NOTE: need to adjust the height in useContextMenu to match the height of this
 * component! Currently set to 280px in useContextMenu.
 */
export function ContextMenu({
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
    arrangeSubtree,
    deleteSubTree,
    onCopy,
    connectToNearestNode,
    createNodeAt,
    onPaste,
  } = useStore.getState();

  const { hasChildren, isCollapsed } = useStore((state) =>
    selectCollapsible(state, contextNode?.id),
  );

  const edges = useStore(selectCurrentEdges);
  const hasClipboardContent = useStore(selectHasClipboardContent);

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

  const handleAddBranch = (nodeType: NodeType) => {
    if (!contextNode) return;

    // Create new node to the right
    // NOTE: 220px set to match "arrange" functionality
    const newPosition = {
      x: contextNode.position.x + 216,
      y: contextNode.position.y,
    };

    createNodeAt(newPosition, contextNode.id, nodeType);
    // HACK: Delay the arrangement to ensure the new node is rendered and
    // positioned by ReactFlow first
    // TODO: how to avoid double undo stack? this is a bug currently. why isn't
    // handleSet throttle working to avoid this?
    setTimeout(() => arrangeSubtree(contextNode.id), 0);
    onClose?.();
  };

  // TODO: refactor to use more accurate findNearestUpstreamNode
  // as in connectToNearestNode
  const childToParentMap = getChildToParentNodeMap(edges);

  const handlePaste = (clientX: number, clientY: number) => {
    const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });
    onPaste(flowPosition);
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
      // NOTE: Responsive design! Read-only mode for below medium size screens
      className="hidden rounded border border-gray-300 bg-white py-1 shadow-lg select-none md:block dark:border-gray-600 dark:bg-gray-800"
      // NOTE: prevent right click inside context menu from triggering another context menu
      onContextMenu={(e) => e.preventDefault()}
      // NOTE: prevent clicks inside context menu from closing it
      onClick={(e) => e.stopPropagation()}
    >
      {contextNode ? (
        <>
          <ContextMenuSubmenu
            title="Add Branch to..."
            icon={<PlusIcon className="h-4 w-4" />}
            disabled={contextNode?.type === "terminal"}
          >
            <ContextMenuButton onClick={() => handleAddBranch("chance")}>
              <div className="h-4 w-4 rounded-full border-1 border-current"></div>
              Chance Node
            </ContextMenuButton>
            <ContextMenuButton onClick={() => handleAddBranch("terminal")}>
              <PlayIcon className="-ml-0.75 h-5 w-5 rotate-180" />
              Terminal Node
            </ContextMenuButton>
            <ContextMenuButton onClick={() => handleAddBranch("decision")}>
              <div className="mr-0.25 h-3.5 w-3.5 border-1 border-current"></div>
              Decision Node
            </ContextMenuButton>
          </ContextMenuSubmenu>{" "}
          <ContextMenuSubmenu
            // TODO: why does converting to terminal from chance make the node change position slightly then the branch moves
            title="Convert to..."
            icon={<ArrowPathIcon className="h-4 w-4" />}
            disabled={false}
          >
            <ContextMenuButton
              onClick={() => handleConvertNode("chance")}
              disabled={contextNode?.type === "chance"}
            >
              <div className="h-4 w-4 rounded-full border-1 border-current"></div>
              Chance Node
            </ContextMenuButton>
            <ContextMenuButton
              onClick={() => handleConvertNode("terminal")}
              disabled={hasChildren || contextNode?.type === "terminal"}
            >
              <PlayIcon className="-ml-0.75 h-5 w-5 rotate-180" />
              Terminal Node
            </ContextMenuButton>
            <ContextMenuButton
              onClick={() => handleConvertNode("decision")}
              disabled={contextNode?.type === "decision"}
            >
              <div className="mr-0.25 h-3.5 w-3.5 border-1 border-current"></div>
              Decision Node
            </ContextMenuButton>
          </ContextMenuSubmenu>
          <ContextMenuButton
            onClick={() => contextNode && connectToNearestNode(contextNode.id)}
            disabled={contextNode && !!childToParentMap[contextNode.id]}
          >
            <LinkIcon className="h-4 w-4" />
            Connect to Nearest Node
          </ContextMenuButton>
          <hr className="m-2 border-gray-300 dark:border-gray-600" />
          <ContextMenuSubmenu
            title={hasChildren ? "Subtree..." : "Node..."}
            icon={<CursorArrowRaysIcon className="h-4 w-4" />}
            disabled={false}
          >
            <ContextMenuButton
              onClick={() => contextNode && selectSubtree(contextNode.id)}
            >
              <CursorArrowRippleIcon className="h-4 w-4" />
              Select {hasChildren ? "Subtree" : "Node"}
            </ContextMenuButton>
            <ContextMenuButton
              onClick={() => {
                if (contextNode) {
                  selectSubtree(contextNode.id);
                  onCopy();
                }
              }}
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
              Copy {hasChildren ? "Subtree" : "Node"}
            </ContextMenuButton>
            {hasChildren && (
              <>
                <ContextMenuButton
                  onClick={() => {
                    if (contextNode) {
                      selectSubtree(contextNode.id);
                      onCopy(true);
                    }
                  }}
                >
                  <span className="rotate-90 text-2xl">⑂</span>
                  {/* TODO: is this a good name? */}
                  Copy Structure Only
                </ContextMenuButton>
                <ContextMenuButton
                  onClick={() =>
                    contextNode && toggleNodeCollapse(contextNode.id)
                  }
                >
                  {isCollapsed ? (
                    <ChevronRightIcon className="h-4 w-4" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                  {isCollapsed ? "Expand Subtree" : "Collapse Subtree"}
                </ContextMenuButton>
                <ContextMenuButton
                  onClick={() => contextNode && arrangeSubtree(contextNode.id)}
                >
                  <RectangleGroupIcon className="h-4 w-4" />
                  Arrange {hasChildren ? "Subtree" : "Node"}
                </ContextMenuButton>
              </>
            )}
            <ContextMenuButton
              onClick={() => onPaste(undefined, contextNode.id)}
              disabled={!hasClipboardContent}
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
              Paste onto {hasChildren ? "Subtree" : "Node"}
            </ContextMenuButton>
            <ContextMenuButton
              onClick={() => contextNode && deleteSubTree(contextNode.id)}
            >
              <TrashIcon className="h-4 w-4" />
              Delete {hasChildren ? "Subtree" : "Node"}
            </ContextMenuButton>
          </ContextMenuSubmenu>
        </>
      ) : (
        // TODO: do some kind of grid instead of micro optimizations of margins for alignment
        <>
          <ContextMenuButton onClick={() => handleCreateNode("chance")}>
            <div className="h-4 w-4 rounded-full border-1 border-current"></div>
            Add Chance Node
          </ContextMenuButton>
          <ContextMenuButton onClick={() => handleCreateNode("terminal")}>
            <PlayIcon className="-ml-1 h-5 w-5 rotate-180" />
            Add Terminal Node
          </ContextMenuButton>
          <ContextMenuButton onClick={() => handleCreateNode("decision")}>
            <div className="mr-0.5 -ml-0.25 h-3.5 w-3.5 border-1 border-current"></div>
            Add Decision Node
          </ContextMenuButton>
          <hr className="m-2 border-gray-300 dark:border-gray-600" />
          <ContextMenuButton onClick={() => handleCreateNode("note")}>
            <PencilSquareIcon className="h-4 w-4" />
            Add Note
          </ContextMenuButton>
          <hr className="m-2 border-gray-300 dark:border-gray-600" />
          <ContextMenuButton
            onClick={() => {
              if (contextPosition) {
                handlePaste(contextPosition.x, contextPosition.y);
              }
            }}
            disabled={!hasClipboardContent}
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
            Paste
          </ContextMenuButton>
        </>
      )}
    </div>
  );
}
