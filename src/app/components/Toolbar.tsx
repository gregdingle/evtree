"use client";

import { useEffect, useState } from "react";

import { getStorage } from "@firebase/storage";
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ArrowsPointingOutIcon,
  CalculatorIcon,
  ChartBarIcon,
  ClipboardDocumentIcon,
  DocumentArrowDownIcon,
  DocumentDuplicateIcon,
  LinkIcon,
  PhotoIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { kebabCase } from "es-toolkit";
import { values } from "es-toolkit/compat";
import Image from "next/image";
import { useHotkeys } from "react-hotkeys-hook";

import { useDarkMode } from "@/hooks/use-dark-mode";
import { useStore } from "@/hooks/use-store";
import { useTemporalStore } from "@/hooks/use-temporal-store";
import {
  downloadHTMLElementAsPNG,
  downloadJson,
  downloadPNG,
} from "@/lib/download";
import { firebaseApp } from "@/lib/firebase";
import {
  selectCurrentTree,
  selectHasClipboardContent,
  selectHasNodes,
  selectHasSelectedItems,
  selectHasTerminalNodes,
  selectShowEVs,
  selectShowHistogram,
} from "@/lib/selectors";
import { uploadTreeForSharing } from "@/lib/share";
import { DecisionTree } from "@/lib/tree";

import { ToolbarButton } from "./ToolbarButton";

export default function Toolbar() {
  const { undo, redo } = useStore.temporal.getState();
  const { canUndo, canRedo } = useTemporalStore((state) => ({
    canUndo: state.pastStates.length > 0,
    canRedo: state.futureStates.length > 0,
  }));

  const {
    onCopy,
    onPaste,
    onReset,
    onArrange,
    deleteSelected,
    onShowEVs,
    onShowHistogram,
  } = useStore.getState();

  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [isArrangeDisabled, setIsArrangeDisabled] = useState(false);

  const currentTree = useStore(selectCurrentTree);
  const hasSelectedItems = useStore(selectHasSelectedItems);
  const hasClipboardContent = useStore(selectHasClipboardContent);

  const hasNodes = useStore(selectHasNodes);
  const hasTerminalNodes = useStore(selectHasTerminalNodes);
  const areEVsShowing = useStore(selectShowEVs);
  const isHistogramOpen = useStore(selectShowHistogram);

  const isDarkMode = useDarkMode();

  const handleDownloadTree = (treeToDownload: DecisionTree) => {
    if (!treeToDownload) return;
    downloadJson(
      treeToDownload,
      `treedecisions-${kebabCase(treeToDownload.name ?? "untitled")}.json`,
    );
  };

  const handleShareLink = async (treeToShare: DecisionTree) => {
    if (!treeToShare || !firebaseApp) return;

    try {
      const shareableLink = await uploadTreeForSharing(
        treeToShare,
        getStorage(firebaseApp),
      );
      window.navigator.clipboard.writeText(shareableLink);
      setIsLinkCopied(true);
    } catch (error) {
      console.error(
        `[EVTree] Error uploading tree for sharing: ${(error as Error).message}`,
      );
    }
  };

  const handleExportImage = (tree: DecisionTree) => {
    if (!tree) return;

    const filename = `treedecisions-${kebabCase(tree.name ?? "untitled")}`;
    // TODO: consider transparent bg color for embedding elsewhere more easily
    // , or custom bg color
    const backgroundColor = isDarkMode ? "#141414" : "#fffbeb";

    // If histogram is open, export it instead of the tree
    if (isHistogramOpen) {
      const histogramElement =
        window.document.getElementById("histogram-export");
      if (histogramElement) {
        downloadHTMLElementAsPNG(
          histogramElement,
          `${filename}-histogram.png`,
          backgroundColor,
        );
      } else {
        console.error("[EVTree] Histogram element not found");
      }
    } else {
      // Export the tree as usual
      downloadPNG(values(tree.nodes ?? []), `${filename}.png`, backgroundColor);
    }
  };

  const handleArrange = () => {
    onArrange();
    // HACK: allow reactflow to before disabling
    setTimeout(() => setIsArrangeDisabled(true), 0);
  };

  // Re-enable arrange button when nodes change
  useEffect(() => {
    setIsArrangeDisabled(false);
    setIsLinkCopied(false);
  }, [currentTree?.nodes]);

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
  useHotkeys("ctrl+h", onShowHistogram, { enableOnFormTags: false });
  useHotkeys("ctrl+e", onShowEVs, { enableOnFormTags: false });
  useHotkeys("ctrl+delete", deleteSelected, { enableOnFormTags: true });
  useHotkeys("ctrl+s", () => currentTree && handleShareLink(currentTree), {
    enableOnFormTags: true,
  });
  useHotkeys(
    "ctrl+shift+s",
    () => currentTree && handleDownloadTree(currentTree),
    {
      enableOnFormTags: true,
    },
  );

  return (
    // HACK: see also RightSidePanel "Email us" feedback link that depends on
    // height of Toolbar, also 'Empty canvas help text'
    <div className="flex h-full items-center space-x-4 p-4">
      <div
        // NOTE: w-80 is the same width as the left side panel, so that the
        // toolbar actions are aligned
        className="flex w-80 items-center space-x-2"
      >
        <Image
          src="/favicon.svg"
          alt="TreeDecisions logo"
          width={24}
          height={24}
          className="dark:invert"
        />
        <h2 className="text-lg">TreeDecisions</h2>
      </div>
      <div className="flex justify-start space-x-2 mx-8">
        <ToolbarButton
          onClick={onCopy}
          tooltip="Ctrl+C"
          disabled={!hasSelectedItems}
        >
          <DocumentDuplicateIcon className="h-4 w-4" />
          Copy
        </ToolbarButton>
        <ToolbarButton
          onClick={onPaste}
          tooltip="Ctrl+V"
          disabled={!hasClipboardContent}
        >
          <ClipboardDocumentIcon className="h-4 w-4" />
          Paste
        </ToolbarButton>
        <ToolbarButton
          onClick={deleteSelected}
          tooltip="Ctrl+Delete"
          disabled={!hasSelectedItems}
        >
          <TrashIcon className="h-4 w-4" />
          Delete
        </ToolbarButton>
        {/*
        TODO: disabled for users, see hotkey
        <ToolbarButton onClick={onReset} tooltip="Ctrl+Shift+R">
          Reset
        </ToolbarButton> */}
        <ToolbarButton
          onClick={handleArrange}
          tooltip="Ctrl+A"
          disabled={!hasNodes || isArrangeDisabled}
        >
          <ArrowsPointingOutIcon className="h-4 w-4" />
          Arrange
        </ToolbarButton>
        {/* NOTE: by request, moved undo-redo next to arrange */}
        <ToolbarButton
          onClick={() => undo()}
          tooltip="Ctrl+Z"
          disabled={!canUndo}
        >
          <ArrowUturnLeftIcon className="h-4 w-4" />
          Undo
        </ToolbarButton>
        <ToolbarButton
          onClick={() => redo()}
          tooltip="Ctrl+Y"
          disabled={!canRedo}
        >
          <ArrowUturnRightIcon className="h-4 w-4" />
          Redo
        </ToolbarButton>
        <VerticalDivider />
        <ToolbarButton
          onClick={onShowHistogram}
          tooltip={
            isHistogramOpen
              ? `Hide Histogram \n(Ctrl+H)`
              : `Show Histogram \n(Ctrl+H)`
          }
          active={isHistogramOpen}
          disabled={!hasTerminalNodes}
        >
          <ChartBarIcon className="h-4 w-4" />
          Histogram
        </ToolbarButton>
        <ToolbarButton
          onClick={onShowEVs}
          tooltip={
            areEVsShowing ? `Hide EVs \n(Ctrl+E)` : `Show EVs \n(Ctrl+E)`
          }
          // TODO: less strong active blue color? maybe just border? or use proper toggle switch?
          active={areEVsShowing}
          disabled={!hasTerminalNodes}
        >
          <CalculatorIcon className="h-4 w-4" />
          Calculate
        </ToolbarButton>
        <VerticalDivider />
        <ToolbarButton
          onClick={() => currentTree && handleExportImage(currentTree)}
          tooltip={
            isHistogramOpen ? "Export histogram to PNG" : "Export tree to PNG"
          }
          disabled={!hasNodes}
        >
          <PhotoIcon className="h-4 w-4" />
          Export Image
        </ToolbarButton>
        {
          // NOTE: saving and sharing links is preferred when firebase is configured
          firebaseApp && (
            <ToolbarButton
              onClick={() => currentTree && handleShareLink(currentTree)}
              tooltip="Upload tree and copy URL for sharing"
              disabled={!hasNodes || isLinkCopied}
            >
              <LinkIcon className="h-4 w-4" />
              {isLinkCopied ? "Link Copied" : "Save & Copy Link"}
            </ToolbarButton>
          )
        }
        <ToolbarButton
          onClick={() => currentTree && handleDownloadTree(currentTree)}
          tooltip="Download tree as JSON"
          disabled={!hasNodes}
        >
          <DocumentArrowDownIcon className="h-4 w-4" />
          Download File
        </ToolbarButton>
      </div>
    </div>
  );
}

function VerticalDivider() {
  return (
    <>
      <div className="pl-2" />
      <div className="h-8 w-px bg-gray-300 dark:bg-gray-600" />
      <div className="pr-2" />
    </>
  );
}
