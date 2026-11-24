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
  ListBulletIcon,
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
  selectShowWalkthru,
} from "@/lib/selectors";
import { uploadTreeForSharing } from "@/lib/share";
import { DecisionTree } from "@/lib/tree";

import { ToolbarButton } from "./ToolbarButton";

export function Toolbar() {
  const { undo, redo } = useStore.temporal.getState();
  const { canUndo, canRedo } = useTemporalStore((state) => ({
    canUndo: state.pastStates.length > 0,
    canRedo: state.futureStates.length > 0,
  }));

  const {
    copy,
    paste,
    reset,
    arrange,
    deleteSelected,
    showEVs,
    showHistogram,
    showWalkthru,
  } = useStore.getState();

  const [isLinkCopied, setIsLinkCopied] = useState(false);

  const currentTree = useStore(selectCurrentTree);
  const hasSelectedItems = useStore(selectHasSelectedItems);
  const hasClipboardContent = useStore(selectHasClipboardContent);

  const hasNodes = useStore(selectHasNodes);
  const hasTerminalNodes = useStore(selectHasTerminalNodes);
  const areEVsShowing = useStore(selectShowEVs);
  const isHistogramOpen = useStore(selectShowHistogram);
  const isWalkthruOpen = useStore(selectShowWalkthru);
  // NOTE: the histogram and the walkthru take the place of the canvas
  const isCanvasHidden = isHistogramOpen || isWalkthruOpen;

  const isDarkMode = useDarkMode();
  // The builder mounts the toolbar only after client validation.
  const isMac = window.navigator.userAgent.includes("Mac");

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

    // If the walkthru or histogram is open, export it instead of the tree
    if (isWalkthruOpen) {
      const walkthruElement = window.document.getElementById("walkthru-export");
      if (walkthruElement) {
        exportHTMLElementAsPNG(
          walkthruElement,
          `${filename}-walkthrough.png`,
          backgroundColor,
        );
      } else {
        console.error("[EVTree] Walkthru element not found");
      }
    } else if (isHistogramOpen) {
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
    arrange(mode === "rightAligned");
  };

  const handleReset = () => {
    if (
      // TODO: upgrade to proper modal dialog
      window.confirm(
        "Are you sure you want to reset all trees? This will delete all your work.",
      )
    ) {
      reset();
    }
  };

  useEffect(() => {
    // TODO: fix this lint error instead of suppressing it
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLinkCopied(false);
  }, [currentTree?.nodes]);

  // TODO: dark mode toggle button

  // NOTE: see https://github.com/JohannesKlauss/react-hotkeys-hook
  // Keep Ctrl shortcuts and add Cmd alternatives for familiar actions individually.
  // Undo, redo, copy, and paste leave text editing to the browser. Cmd+S shares
  // the tree even from form fields and prevents browser save when available.
  // TODO: make hotkey usage also flash corresponding button
  useHotkeys("ctrl+z", () => undo());
  useHotkeys("meta+z", () => undo(), {
    enabled: canUndo,
    preventDefault: true,
  });
  useHotkeys("ctrl+y", () => redo());
  useHotkeys("meta+y, meta+shift+z", () => redo(), {
    enabled: canRedo,
    preventDefault: true,
  });
  useHotkeys("ctrl+c", () => copy());
  useHotkeys("meta+c", () => copy(), {
    enabled: hasSelectedItems,
    preventDefault: true,
  });
  useHotkeys("ctrl+v", () => paste());
  useHotkeys("meta+v", () => paste(), {
    enabled: hasClipboardContent,
    preventDefault: true,
  });
  // NOTE: reset only available as a hotkey as a hidden feature
  useHotkeys("ctrl+shift+r", handleReset, { enableOnFormTags: true });
  useHotkeys("ctrl+a", () => arrange(), { enableOnFormTags: false });
  useHotkeys("ctrl+h", showHistogram, { enableOnFormTags: false });
  useHotkeys("ctrl+e", () => showEVs(), { enableOnFormTags: false });
  useHotkeys("ctrl+delete", deleteSelected, { enableOnFormTags: true });
  useHotkeys("ctrl+s", () => currentTree && handleShareLink(currentTree), {
    enableOnFormTags: true,
  });
  useHotkeys("meta+s", () => currentTree && handleShareLink(currentTree), {
    enabled: Boolean(firebaseApp && currentTree),
    enableOnFormTags: true,
    preventDefault: true,
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
      <div className="mx-8 flex flex-wrap justify-start 2xl:space-x-2">
        <ToolbarButton
          onButtonClick={() => copy()}
          tooltip={isMac ? "Cmd+C" : "Ctrl+C"}
          disabled={!hasSelectedItems || isCanvasHidden}
        >
          <DocumentDuplicateIcon className="h-4 w-4" />
          Copy
        </ToolbarButton>
        <ToolbarButton
          onButtonClick={() => paste()}
          tooltip={isMac ? "Cmd+V" : "Ctrl+V"}
          disabled={!hasClipboardContent}
        >
          <ClipboardDocumentIcon className="h-4 w-4" />
          Paste
        </ToolbarButton>
        <ToolbarButton
          onButtonClick={deleteSelected}
          tooltip="Ctrl+Delete"
          disabled={!hasSelectedItems || isCanvasHidden}
        >
          <TrashIcon className="h-4 w-4" />
          Delete
        </ToolbarButton>
        {/*
        NOTE: disabled for users, see hotkey
        QUESTION: surface Reset somehow to users?
        <ToolbarButton onClick={onReset} tooltip="Ctrl+Shift+R">
          Reset
        </ToolbarButton> */}
        <ToolbarButton
          onButtonClick={handleArrange}
          tooltip="Ctrl+A"
          disabled={!hasNodes || isCanvasHidden}
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
          tooltip={isMac ? "Cmd+Z" : "Ctrl+Z"}
          disabled={!canUndo || isCanvasHidden}
        >
          <ArrowUturnLeftIcon className="h-4 w-4" />
          Undo
        </ToolbarButton>
        <ToolbarButton
          onButtonClick={() => redo()}
          tooltip={isMac ? "Cmd+Shift+Z" : "Ctrl+Y"}
          disabled={!canRedo || isCanvasHidden}
        >
          <ArrowUturnRightIcon className="h-4 w-4" />
          Redo
        </ToolbarButton>
        <VerticalDivider />
        <ToolbarButton
          onButtonClick={(key) => showEVs(key === "show")}
          tooltip={
            areEVsShowing ? `Hide EVs \n(Ctrl+E)` : `Show EVs \n(Ctrl+E)`
          }
          active={areEVsShowing}
          disabled={!hasTerminalNodes || isCanvasHidden}
          dropdownItems={{
            show: "Show path values",
            hide: "Hide path values",
          }}
        >
          <CalculatorIcon className="h-4 w-4" />
          Calculate
        </ToolbarButton>
        <ToolbarButton
          onButtonClick={showHistogram}
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
          onButtonClick={showWalkthru}
          tooltip={
            isWalkthruOpen
              ? "Hide Walkthrough"
              : "Show Walkthrough: \nthe tree explained issue by issue"
          }
          active={isWalkthruOpen}
          disabled={!hasNodes}
        >
          <ListBulletIcon className="h-4 w-4" />
          Walkthrough
        </ToolbarButton>
        <VerticalDivider />
        {
          // NOTE: saving and sharing links is preferred when firebase is configured
          firebaseApp && (
            <ToolbarButton
              onButtonClick={() => currentTree && handleShareLink(currentTree)}
              tooltip={`Upload tree and copy URL for sharing (${isMac ? "Cmd+S" : "Ctrl+S"})`}
              disabled={!hasNodes || isLinkCopied}
            >
              <LinkIcon className="h-4 w-4" />
              {isLinkCopied ? (
                "Link Copied"
              ) : (
                <>
                  <span className="hidden 2xl:inline">Save & </span>Copy Link
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
          Export <span className="hidden 2xl:inline">to File</span>
        </ToolbarButton>
      </div>
    </div>
  );
}

function VerticalDivider() {
  return (
    <div className="hidden 2xl:block">
      <div className="pl-2" />
      <div className="h-8 w-px bg-gray-300 dark:bg-gray-600" />
      <div className="pr-2" />
    </div>
  );
}
