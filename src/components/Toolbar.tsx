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
import { useTreeStore } from "@/hooks/use-tree-store";
import { useTreeTemporalStore } from "@/hooks/use-tree-temporal-store";
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
  selectShowIssues,
} from "@/lib/selectors";
import { uploadTreeForSharing } from "@/lib/share";
import { DecisionTree } from "@/lib/tree";

import { ToolbarButton } from "./ToolbarButton";

export function Toolbar() {
  const { undo, redo } = useTreeStore.temporal.getState();
  const { canUndo, canRedo } = useTreeTemporalStore((state) => ({
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
    showIssues,
  } = useTreeStore.getState();

  const [isLinkCopied, setIsLinkCopied] = useState(false);

  const currentTree = useTreeStore(selectCurrentTree);
  const hasSelectedItems = useTreeStore(selectHasSelectedItems);
  const hasClipboardContent = useTreeStore(selectHasClipboardContent);

  const hasNodes = useTreeStore(selectHasNodes);
  const hasTerminalNodes = useTreeStore(selectHasTerminalNodes);
  const areEVsShowing = useTreeStore(selectShowEVs);
  const isHistogramOpen = useTreeStore(selectShowHistogram);
  const isIssuesOpen = useTreeStore(selectShowIssues);
  // NOTE: the histogram and the issues view take the place of the canvas
  const isCanvasHidden = isHistogramOpen || isIssuesOpen;

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

    // If the issues view or histogram is open, export it instead of the tree
    if (isIssuesOpen) {
      const issuesElement = window.document.getElementById("issues-export");
      if (issuesElement) {
        exportHTMLElementAsPNG(
          issuesElement,
          `${filename}-issues.png`,
          backgroundColor,
        );
      } else {
        console.error("[EVTree] Issues element not found");
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
  // NOTE: a hotkey works exactly when its button does. The histogram and the
  // issues view take the place of the canvas, so what acts on the canvas is off
  // then. That also leaves Cmd+C to the browser, for copying text out of the
  // issues view while a node is selected.
  const isEnabled = {
    copy: hasSelectedItems && !isCanvasHidden,
    paste: hasClipboardContent && !isCanvasHidden,
    deleteSelected: hasSelectedItems && !isCanvasHidden,
    arrange: hasNodes && !isCanvasHidden,
    undo: canUndo && !isCanvasHidden,
    redo: canRedo && !isCanvasHidden,
    showEVs: hasTerminalNodes && !isCanvasHidden,
    showHistogram: hasTerminalNodes,
    showIssues: hasNodes,
    shareLink: Boolean(firebaseApp) && hasNodes && !isLinkCopied,
  };

  useHotkeys("ctrl+z", () => undo(), { enabled: isEnabled.undo });
  useHotkeys("meta+z", () => undo(), {
    enabled: isEnabled.undo,
    preventDefault: true,
  });
  useHotkeys("ctrl+y", () => redo(), { enabled: isEnabled.redo });
  useHotkeys("meta+y, meta+shift+z", () => redo(), {
    enabled: isEnabled.redo,
    preventDefault: true,
  });
  useHotkeys("ctrl+c", () => copy(), { enabled: isEnabled.copy });
  useHotkeys("meta+c", () => copy(), {
    enabled: isEnabled.copy,
    preventDefault: true,
  });
  useHotkeys("ctrl+v", () => paste(), { enabled: isEnabled.paste });
  useHotkeys("meta+v", () => paste(), {
    enabled: isEnabled.paste,
    preventDefault: true,
  });
  // NOTE: reset only available as a hotkey as a hidden feature
  useHotkeys("ctrl+shift+r", handleReset, { enableOnFormTags: true });
  useHotkeys("ctrl+a", () => arrange(), {
    enabled: isEnabled.arrange,
    enableOnFormTags: false,
  });
  useHotkeys("ctrl+h", showHistogram, {
    enabled: isEnabled.showHistogram,
    enableOnFormTags: false,
  });
  useHotkeys("ctrl+e", () => showEVs(), {
    enabled: isEnabled.showEVs,
    enableOnFormTags: false,
  });
  useHotkeys("ctrl+delete", deleteSelected, {
    enabled: isEnabled.deleteSelected,
    enableOnFormTags: true,
  });
  useHotkeys("ctrl+s", () => currentTree && handleShareLink(currentTree), {
    enabled: isEnabled.shareLink,
    enableOnFormTags: true,
  });
  useHotkeys("meta+s", () => currentTree && handleShareLink(currentTree), {
    enabled: isEnabled.shareLink,
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
          disabled={!isEnabled.copy}
        >
          <DocumentDuplicateIcon className="h-4 w-4" />
          Copy
        </ToolbarButton>
        <ToolbarButton
          onButtonClick={() => paste()}
          tooltip={isMac ? "Cmd+V" : "Ctrl+V"}
          disabled={!isEnabled.paste}
        >
          <ClipboardDocumentIcon className="h-4 w-4" />
          Paste
        </ToolbarButton>
        <ToolbarButton
          onButtonClick={deleteSelected}
          tooltip="Ctrl+Delete"
          disabled={!isEnabled.deleteSelected}
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
          disabled={!isEnabled.arrange}
          // TODO: consider another option that also orders the branches of
          // each node by the size of what follows, largest first, as is done
          // for an AI-generated tree, see getBranchPlaces in ai-convert.ts.
          // Arrange keeps the branches in the order that the user placed
          // them, so it would have to be an option and not the default.
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
          disabled={!isEnabled.undo}
        >
          <ArrowUturnLeftIcon className="h-4 w-4" />
          Undo
        </ToolbarButton>
        <ToolbarButton
          onButtonClick={() => redo()}
          tooltip={isMac ? "Cmd+Shift+Z" : "Ctrl+Y"}
          disabled={!isEnabled.redo}
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
          disabled={!isEnabled.showEVs}
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
          disabled={!isEnabled.showHistogram}
        >
          <ChartBarIcon className="h-4 w-4" />
          Histogram
        </ToolbarButton>
        <ToolbarButton
          onButtonClick={showIssues}
          tooltip={
            isIssuesOpen
              ? "Hide Issues"
              : "Show Issues: \nthe tree explained issue by issue"
          }
          active={isIssuesOpen}
          disabled={!isEnabled.showIssues}
        >
          <ListBulletIcon className="h-4 w-4" />
          Issues
        </ToolbarButton>
        <VerticalDivider />
        {
          // NOTE: saving and sharing links is preferred when firebase is configured
          firebaseApp && (
            <ToolbarButton
              onButtonClick={() => currentTree && handleShareLink(currentTree)}
              tooltip={`Upload tree and copy URL for sharing (${isMac ? "Cmd+S" : "Ctrl+S"})`}
              disabled={!isEnabled.shareLink}
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
