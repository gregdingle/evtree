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
  DocumentDuplicateIcon,
  LinkIcon,
  PhotoIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { kebabCase } from "es-toolkit";
import { values } from "es-toolkit/compat";
import Image from "next/image";
import Link from "next/link";
import { useHotkeys } from "react-hotkeys-hook";

import { useDarkMode } from "@/hooks/use-dark-mode";
import { useStore } from "@/hooks/use-store";
import { useTemporalStore } from "@/hooks/use-temporal-store";
import {
  exportHTMLElementAsPNG,
  exportJson,
  exportPDF,
  exportPNG,
} from "@/lib/export";
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

  const currentTree = useStore(selectCurrentTree);
  const hasSelectedItems = useStore(selectHasSelectedItems);
  const hasClipboardContent = useStore(selectHasClipboardContent);

  const hasNodes = useStore(selectHasNodes);
  const hasTerminalNodes = useStore(selectHasTerminalNodes);
  const areEVsShowing = useStore(selectShowEVs);
  const isHistogramOpen = useStore(selectShowHistogram);

  const isDarkMode = useDarkMode();

  const handleDownloadTree = (treeToDownload: DecisionTree) => {
    exportJson(
      treeToDownload,
      `treedecisions-${kebabCase(treeToDownload.name ?? "untitled")}.json`,
    );
  };

  const handleShareLink = async (treeToShare: DecisionTree) => {
    if (!firebaseApp) return;

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

  const handleExportImage = (tree: DecisionTree, backgroundColor?: string) => {
    const filename = `treedecisions-${kebabCase(tree.name ?? "untitled")}`;
    backgroundColor =
      backgroundColor ??
      (isDarkMode
        ? // NOTE: #171717 is neutral-900, very close to ReactFlow default dark mode (#141414)... see also page.tsx
          "#171717"
        : "#fffbeb"); // amber-50

    // If histogram is open, export it instead of the tree
    if (isHistogramOpen) {
      const histogramElement =
        window.document.getElementById("histogram-export");
      if (histogramElement) {
        exportHTMLElementAsPNG(
          histogramElement,
          `${filename}-histogram.png`,
          backgroundColor,
        );
      } else {
        console.error("[EVTree] Histogram element not found");
      }
    } else {
      // Export the tree as usual
      exportPNG(
        values(tree.nodes ?? []),
        `${filename}.png`,
        backgroundColor,
        isDarkMode,
      );
    }
  };

  const handleExportPDF = (tree: DecisionTree) => {
    const filename = `treedecisions-${kebabCase(tree.name ?? "untitled")}.pdf`;

    exportPDF(values(tree.nodes ?? []), filename, isDarkMode, tree.name);
  };

  const handleArrange = (mode?: string) => {
    onArrange(mode === "rightAligned");
  };

  const handleReset = () => {
    if (
      // TODO: upgrade to proper modal dialog
      window.confirm(
        "Are you sure you want to reset all trees? This will delete all your work.",
      )
    ) {
      onReset();
    }
  };

  useEffect(() => {
    setIsLinkCopied(false);
  }, [currentTree?.nodes]);

  // TODO: dark mode toggle button

  // NOTE: see https://github.com/JohannesKlauss/react-hotkeys-hook
  // TODO: consider best hotkeys
  // TODO: make hotkey usage also flash corresponding button
  useHotkeys("ctrl+z", () => undo(), { enableOnFormTags: true });
  useHotkeys("ctrl+y", () => redo(), { enableOnFormTags: true });
  useHotkeys("ctrl+c", () => onCopy(), { enableOnFormTags: true });
  useHotkeys("ctrl+v", () => onPaste(), { enableOnFormTags: true });
  // NOTE: reset only available as a hotkey as a hidden feature
  useHotkeys("ctrl+shift+r", handleReset, { enableOnFormTags: true });
  useHotkeys("ctrl+a", () => onArrange(), { enableOnFormTags: false });
  useHotkeys("ctrl+h", onShowHistogram, { enableOnFormTags: false });
  useHotkeys("ctrl+e", () => onShowEVs(), { enableOnFormTags: false });
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
      <Link className="w-80 flex-1" href="/">
        <div
          // NOTE: w-80 is the same width as the left side panel, so that the
          // toolbar actions are aligned
          className="flex items-center space-x-2 select-none"
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
      </Link>
      <div className="mx-8 flex flex-wrap justify-start xl:space-x-2">
        <ToolbarButton
          onButtonClick={() => onCopy()}
          tooltip="Ctrl+C"
          disabled={!hasSelectedItems || isHistogramOpen}
        >
          <DocumentDuplicateIcon className="h-4 w-4" />
          Copy
        </ToolbarButton>
        <ToolbarButton
          onButtonClick={() => onPaste()}
          tooltip="Ctrl+V"
          disabled={!hasClipboardContent}
        >
          <ClipboardDocumentIcon className="h-4 w-4" />
          Paste
        </ToolbarButton>
        <ToolbarButton
          onButtonClick={deleteSelected}
          tooltip="Ctrl+Delete"
          disabled={!hasSelectedItems || isHistogramOpen}
        >
          <TrashIcon className="h-4 w-4" />
          Delete
        </ToolbarButton>
        {/*
        NOTE: disabled for users, see hotkey
        TODO: surface Reset somehow to users?
        <ToolbarButton onClick={onReset} tooltip="Ctrl+Shift+R">
          Reset
        </ToolbarButton> */}
        <ToolbarButton
          onButtonClick={handleArrange}
          tooltip="Ctrl+A"
          disabled={!hasNodes || isHistogramOpen}
          dropdownItems={{
            compact: "Compact",
            rightAligned: "Right-aligned",
          }}
        >
          <ArrowsPointingOutIcon className="h-4 w-4" />
          Arrange
        </ToolbarButton>
        {/* NOTE: by request, moved undo-redo next to arrange */}
        <ToolbarButton
          onButtonClick={() => undo()}
          tooltip="Ctrl+Z"
          disabled={!canUndo || isHistogramOpen}
        >
          <ArrowUturnLeftIcon className="h-4 w-4" />
          Undo
        </ToolbarButton>
        <ToolbarButton
          onButtonClick={() => redo()}
          tooltip="Ctrl+Y"
          disabled={!canRedo || isHistogramOpen}
        >
          <ArrowUturnRightIcon className="h-4 w-4" />
          Redo
        </ToolbarButton>
        <VerticalDivider />
        <ToolbarButton
          onButtonClick={(key) => onShowEVs(key === "show")}
          tooltip={
            areEVsShowing ? `Hide EVs \n(Ctrl+E)` : `Show EVs \n(Ctrl+E)`
          }
          active={areEVsShowing}
          disabled={!hasTerminalNodes || isHistogramOpen}
          dropdownItems={{
            show: "Show path values",
            hide: "Hide path values",
          }}
        >
          <CalculatorIcon className="h-4 w-4" />
          Calculate
        </ToolbarButton>
        <ToolbarButton
          onButtonClick={onShowHistogram}
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
        <VerticalDivider />
        {
          // NOTE: saving and sharing links is preferred when firebase is configured
          firebaseApp && (
            <ToolbarButton
              onButtonClick={() => currentTree && handleShareLink(currentTree)}
              tooltip="Upload tree and copy URL for sharing"
              disabled={!hasNodes || isLinkCopied}
            >
              <LinkIcon className="h-4 w-4" />
              {isLinkCopied ? (
                "Link Copied"
              ) : (
                <>
                  <span className="hidden xl:inline">Save & </span>Copy Link
                </>
              )}
            </ToolbarButton>
          )
        }
        <ToolbarButton
          onButtonClick={() => currentTree && handleExportImage(currentTree)}
          // NOTE: no tooltip because it conflicts with dropdown... remove if no solution
          // tooltip={
          //   isHistogramOpen ? "Export histogram to file" : "Export tree to file"
          // }
          disabled={!hasNodes}
          dropdownItems={{
            png: {
              label: "Export to PNG",
              onClick: () => currentTree && handleExportImage(currentTree),
            },
            transparentPng: {
              label: "Export to transparent PNG",
              onClick: () =>
                currentTree && handleExportImage(currentTree, "transparent"),
            },
            pdf: {
              label: "Export to PDF",
              onClick: () => currentTree && handleExportPDF(currentTree),
            },
            json: {
              label: "Export to JSON",
              onClick: () => currentTree && handleDownloadTree(currentTree),
            },
          }}
        >
          <PhotoIcon className="h-4 w-4" />
          Export <span className="hidden xl:inline">to File</span>
        </ToolbarButton>
      </div>
    </div>
  );
}

function VerticalDivider() {
  return (
    <div className="hidden xl:block">
      <div className="pl-2" />
      <div className="h-8 w-px bg-gray-300 dark:bg-gray-600" />
      <div className="pr-2" />
    </div>
  );
}
