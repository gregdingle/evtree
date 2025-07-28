import { ContextMenuProps } from "@/app/components/ContextMenu";
import { AppNode } from "@/hooks/use-store";
import { useRef, useState } from "react";

/**
 * @see https://reactflow.dev/examples/interaction/context-menu
 */
export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuProps | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const onContextMenu = (
    event: MouseEvent | React.MouseEvent,
    isNodeContext: boolean,
    node?: AppNode,
  ) => {
    // Prevent native context menu from showing
    event.preventDefault();

    // Calculate position of the context menu. We want to make sure it
    // doesn't get positioned off-screen.
    const pane = ref.current?.getBoundingClientRect();
    if (!pane) {
      return;
    }

    // Get click position relative to the container
    const relativeX = event.clientX - pane.left;
    const relativeY = event.clientY - pane.top;

    setMenu({
      top: relativeY < pane.height - 200 ? relativeY : undefined,
      left: relativeX < pane.width - 200 ? relativeX : undefined,
      right: relativeX >= pane.width - 200 ? pane.width - relativeX : undefined,
      bottom:
        relativeY >= pane.height - 200 ? pane.height - relativeY : undefined,
      // Store the actual screen coordinates for ReactFlow's screenToFlowPosition
      contextPosition: { x: event.clientX, y: event.clientY },
      contextNode: node,
    });
  };

  const closeMenu = () => setMenu(null);

  return {
    menu,
    ref,
    onContextMenu,
    closeMenu,
  };
}
