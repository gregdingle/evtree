"use client";

import { useStore } from "@/hooks/use-store";
import { useTemporalStore } from "@/hooks/use-temporal-store";
import {
  selectHasClipboardContent,
  selectHasNodes,
  selectHasSelectedItems,
  selectHasTerminalNodes,
} from "@/utils/selectors";
import {
  ArrowsPointingOutIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ChartBarIcon,
  ClipboardDocumentIcon,
  DocumentDuplicateIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import { useHotkeys } from "react-hotkeys-hook";
import { ToolbarButton } from "./ToolbarButton";

interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  onHistogramClick: () => void;
  isHistogramOpen: boolean;
}
export default function Toolbar({
  onHistogramClick,
  isHistogramOpen,
}: ToolbarProps) {
  const { undo, redo } = useStore.temporal.getState();
  const { canUndo, canRedo } = useTemporalStore((state) => ({
    canUndo: state.pastStates.length > 0,
    canRedo: state.futureStates.length > 0,
  }));
  const { onCopy, onPaste, onReset, onArrange, deleteSelected } =
    useStore.getState();
  const hasSelectedItems = useStore(selectHasSelectedItems);
  const hasClipboardContent = useStore(selectHasClipboardContent);
  const hasNodes = useStore(selectHasNodes);
  const hasTerminalNodes = useStore(selectHasTerminalNodes);

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
  useHotkeys("ctrl+delete", deleteSelected, { enableOnFormTags: true });

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
        <ToolbarButton
          onClick={() => undo()}
          tooltip="Ctrl+Z"
          disabled={!canUndo}
        >
          <ArrowUturnLeftIcon className="h-4 w-4" />
          undo
        </ToolbarButton>
        <ToolbarButton
          onClick={() => redo()}
          tooltip="Ctrl+Y"
          disabled={!canRedo}
        >
          <ArrowUturnRightIcon className="h-4 w-4" />
          redo
        </ToolbarButton>
        <ToolbarButton
          onClick={onCopy}
          tooltip="Ctrl+C"
          disabled={!hasSelectedItems}
        >
          <DocumentDuplicateIcon className="h-4 w-4" />
          copy
        </ToolbarButton>
        <ToolbarButton
          onClick={onPaste}
          tooltip="Ctrl+V"
          disabled={!hasClipboardContent}
        >
          <ClipboardDocumentIcon className="h-4 w-4" />
          paste
        </ToolbarButton>
        <ToolbarButton
          onClick={deleteSelected}
          tooltip="Ctrl+Delete"
          disabled={!hasSelectedItems}
        >
          <TrashIcon className="h-4 w-4" />
          delete
        </ToolbarButton>
        {/*
        TODO: disabled for users, see hotkey
        <ToolbarButton onClick={onReset} tooltip="Ctrl+Shift+R">
          reset
        </ToolbarButton> */}
        <ToolbarButton
          onClick={onArrange}
          tooltip="Ctrl+R"
          disabled={!hasNodes}
        >
          <ArrowsPointingOutIcon className="h-4 w-4" />
          arrange
        </ToolbarButton>
        <ToolbarButton
          onClick={onHistogramClick}
          tooltip={
            isHistogramOpen
              ? "Hide Histogram (Ctrl+H)"
              : "Show Histogram (Ctrl+H)"
          }
          active={isHistogramOpen}
          disabled={!hasTerminalNodes}
        >
          <ChartBarIcon className="h-4 w-4" />
          histogram
        </ToolbarButton>
      </div>
    </div>
  );
}
