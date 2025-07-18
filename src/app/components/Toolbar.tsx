"use client";

import { useStore } from "@/hooks/use-store";
import Image from "next/image";
import { useHotkeys } from "react-hotkeys-hook";

export default function Toolbar() {
  // TODO: hook up to keyboard shortcuts
  const { undo, redo } = useStore.temporal.getState();
  const { onCopy, onPaste, onReset, onArrange } = useStore.getState();

  // NOTE: see https://github.com/JohannesKlauss/react-hotkeys-hook
  // TODO: consider best hotkeys
  // TODO: make hotkey usage also flash corresponding button
  useHotkeys("ctrl+z", () => undo(), { preventDefault: true });
  useHotkeys("ctrl+y", () => redo(), { preventDefault: true });
  useHotkeys("ctrl+c", () => onCopy(), { preventDefault: true });
  useHotkeys("ctrl+v", () => onPaste(), { preventDefault: true });
  useHotkeys("ctrl+r", () => onReset(), { preventDefault: true });
  useHotkeys("ctrl+a", () => onArrange(), { preventDefault: true });

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
        <ToolbarButton onClick={() => undo()} tooltip="Ctrl+Z">
          undo
        </ToolbarButton>
        <ToolbarButton onClick={() => redo()} tooltip="Ctrl+Y">
          redo
        </ToolbarButton>
        <ToolbarButton onClick={() => onCopy()} tooltip="Ctrl+C">
          copy
        </ToolbarButton>
        <ToolbarButton onClick={() => onPaste()} tooltip="Ctrl+V">
          paste
        </ToolbarButton>
        <ToolbarButton onClick={() => onReset()} tooltip="Ctrl+R">
          reset
        </ToolbarButton>
        <ToolbarButton onClick={() => onArrange()} tooltip="Ctrl+R">
          arrange
        </ToolbarButton>
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  tooltip?: string;
}

function ToolbarButton({ onClick, children, tooltip }: ToolbarButtonProps) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 rounded"
      >
        {children}
      </button>
      {tooltip && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
          {tooltip}
        </div>
      )}
    </div>
  );
}
