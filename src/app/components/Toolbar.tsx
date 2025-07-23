"use client";

import { useStore } from "@/hooks/use-store";
import { downloadJson, downloadPNG } from "@/utils/download";
import { selectCurrentTree } from "@/utils/selectors";
import { useReactFlow } from "@xyflow/react";
import Image from "next/image";
import { useHotkeys } from "react-hotkeys-hook";
import { ToolbarButton } from "./ToolbarButton";

export default function Toolbar() {
  // TODO: hook up to keyboard shortcuts
  const { undo, redo } = useStore.temporal.getState();
  const { onCopy, onPaste, onReset, onArrange } = useStore.getState();
  const tree = useStore(selectCurrentTree);
  // TODO: why don't our app nodes work with the download?
  const { getNodes } = useReactFlow();

  const onExportClick = () => downloadPNG(getNodes(), "evtree.png");
  // TODO: implement a onLoadClick to load a tree from a file
  const onDownloadClick = () => tree && downloadJson(tree, "evtree.json");

  // NOTE: see https://github.com/JohannesKlauss/react-hotkeys-hook
  // TODO: consider best hotkeys
  // TODO: make hotkey usage also flash corresponding button
  useHotkeys("ctrl+z", () => undo(), { enableOnFormTags: true });
  useHotkeys("ctrl+y", () => redo(), { enableOnFormTags: true });
  useHotkeys("ctrl+c", onCopy, { enableOnFormTags: true });
  useHotkeys("ctrl+v", onPaste, { enableOnFormTags: true });
  useHotkeys("ctrl+r", onReset, { enableOnFormTags: true });
  useHotkeys("ctrl+a", onArrange, { enableOnFormTags: true });
  useHotkeys("ctrl+e", onExportClick, { enableOnFormTags: true });
  useHotkeys("ctrl+d", onDownloadClick, { enableOnFormTags: true });

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
          onClick={onExportClick}
          tooltip="Ctrl+R"
        >
          export
        </ToolbarButton>
        <ToolbarButton
          // TODO: change filename once we support multiple trees
          // TODO: how to make it work with dark mode?
          onClick={onDownloadClick}
          tooltip="Ctrl+D"
        >
          download
        </ToolbarButton>
      </div>
    </div>
  );
}
