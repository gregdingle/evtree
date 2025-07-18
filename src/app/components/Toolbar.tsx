"use client";

import { useStore } from "@/hooks/use-store";
import Image from "next/image";

export default function Toolbar() {
  // TODO: hook up to keyboard shortcuts
  const { undo, redo } = useStore.temporal.getState();
  const { onCopy, onPaste, onReset } = useStore((state) => state);

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
        <ToolbarButton onClick={() => undo()}>undo</ToolbarButton>
        <ToolbarButton onClick={() => redo()}>redo</ToolbarButton>
        <ToolbarButton onClick={() => onCopy()}>copy</ToolbarButton>
        <ToolbarButton onClick={() => onPaste()}>paste</ToolbarButton>
        <ToolbarButton onClick={() => onReset()}>reset</ToolbarButton>
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 rounded"
    >
      {children}
    </button>
  );
}
