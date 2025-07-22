"use client";

import { useStore } from "@/hooks/use-store";
import { downloadPNG } from "@/utils/download";
import { useReactFlow } from "@xyflow/react";
import Image from "next/image";
import { useHotkeys } from "react-hotkeys-hook";
import { ToolbarButton } from "./ToolbarButton";

export default function Toolbar() {
  // TODO: hook up to keyboard shortcuts
  const { undo, redo } = useStore.temporal.getState();
  const { onCopy, onPaste, onReset, onArrange } = useStore.getState();
  // TODO: why don't our app nodes work with the download?
  const { getNodes } = useReactFlow();

  const onDownloadClick = () => downloadPNG(getNodes(), "evtree.png");

  // NOTE: see https://github.com/JohannesKlauss/react-hotkeys-hook
  // TODO: consider best hotkeys
  // TODO: make hotkey usage also flash corresponding button
  useHotkeys("ctrl+z", () => undo());
  useHotkeys("ctrl+y", () => redo());
  useHotkeys("ctrl+c", onCopy);
  useHotkeys("ctrl+v", onPaste);
  useHotkeys("ctrl+r", onReset);
  useHotkeys("ctrl+a", onArrange);
  useHotkeys("ctrl+e", onDownloadClick);

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
        <ToolbarButton onClick={undo} tooltip="Ctrl+Z">
          undo
        </ToolbarButton>
        <ToolbarButton onClick={redo} tooltip="Ctrl+Y">
          redo
        </ToolbarButton>
        <ToolbarButton onClick={onCopy} tooltip="Ctrl+C">
          copy
        </ToolbarButton>
        <ToolbarButton onClick={onPaste} tooltip="Ctrl+V">
          paste
        </ToolbarButton>
        <ToolbarButton onClick={onReset} tooltip="Ctrl+R">
          reset
        </ToolbarButton>
        <ToolbarButton onClick={onArrange} tooltip="Ctrl+R">
          arrange
        </ToolbarButton>
        <ToolbarButton
          // TODO: change filename once we support multiple trees
          // TODO: how to make it work with dark mode?
          onClick={onDownloadClick}
          tooltip="Ctrl+R"
        >
          export
        </ToolbarButton>
      </div>
    </div>
  );
}
