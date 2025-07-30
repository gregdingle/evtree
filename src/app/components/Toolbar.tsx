"use client";

import { useStore } from "@/hooks/use-store";
import Image from "next/image";
import { useHotkeys } from "react-hotkeys-hook";
import { ToolbarButton } from "./ToolbarButton";

interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  onHistogramClick: () => void;
}
export default function Toolbar({ onHistogramClick }: ToolbarProps) {
  const { undo, redo } = useStore.temporal.getState();
  const { onCopy, onPaste, onReset, onArrange } = useStore.getState();

  // TODO: dark mode toggle button

  // NOTE: see https://github.com/JohannesKlauss/react-hotkeys-hook
  // TODO: consider best hotkeys
  // TODO: make hotkey usage also flash corresponding button
  useHotkeys("ctrl+z", () => undo(), { enableOnFormTags: true });
  useHotkeys("ctrl+y", () => redo(), { enableOnFormTags: true });
  useHotkeys("ctrl+c", () => onCopy(), { enableOnFormTags: true });
  useHotkeys("ctrl+v", onPaste, { enableOnFormTags: true });
  // TODO: is reset sufficiently hidden from normal users?
  useHotkeys("ctrl+shift+r", onReset, { enableOnFormTags: true });
  useHotkeys("ctrl+a", onArrange, { enableOnFormTags: false });
  useHotkeys("ctrl+h", onHistogramClick, { enableOnFormTags: false });
  // TODO: add our own hotkey for delete that works when an input is focused and overrides the built-in react flow hotkeys

  return (
    <div className="flex h-full items-center space-x-4 p-4">
      <div
        // NOTE: w-80 is the same width as the left side panel, so that the
        // toolbar actions are aligned
        className="flex w-80 items-center space-x-2"
      >
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
        <ToolbarButton onClick={onCopy} tooltip="Ctrl+C">
          copy
        </ToolbarButton>
        <ToolbarButton onClick={onPaste} tooltip="Ctrl+V">
          paste
        </ToolbarButton>
        {/*
        TODO: disabled for users, see hotkey
        <ToolbarButton onClick={onReset} tooltip="Ctrl+Shift+R">
          reset
        </ToolbarButton> */}
        <ToolbarButton onClick={onArrange} tooltip="Ctrl+R">
          arrange
        </ToolbarButton>
        <ToolbarButton onClick={onHistogramClick} tooltip="Ctrl+H">
          histogram
        </ToolbarButton>
      </div>
    </div>
  );
}
