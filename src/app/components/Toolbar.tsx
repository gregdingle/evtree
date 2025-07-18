"use client";

import { useStore } from "@/hooks/use-store";
import { useStore as useReactFlowStore } from "@xyflow/react";
import Image from "next/image";

export default function Toolbar() {
  // TODO: hook up to keyboard shortcuts
  const { undo, redo } = useStore.temporal.getState();
  const { onCopy, onPaste } = useStore((state) => state);

  // TODO: hook up selection which is not in <ReactFlow> props
  const resetSelectedElements = useReactFlowStore(
    (state) => state.resetSelectedElements
  );
  const addSelectedNodes = useReactFlowStore((state) => state.addSelectedNodes);
  const addSelectedEdges = useReactFlowStore((state) => state.addSelectedEdges);
  return (
    <div className="flex items-center space-x-4 p-4 h-full">
      <div className="flex items-center space-x-1">
        <Image
          src="/favicon.svg"
          alt="EVTree logo"
          width={24}
          height={24}
          className="dark:invert"
        />
        <h2 className="text-lg font-semibold">EVTree</h2>
      </div>
      <div className="flex justify-start space-x-2">
        <button onClick={() => undo()}>undo</button>
        <button onClick={() => redo()}>redo</button>
        <button onClick={() => onCopy()}>copy</button>
        <button onClick={() => onPaste()}>paste</button>
      </div>
    </div>
  );
}
