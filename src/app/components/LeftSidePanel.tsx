"use client";

import { useState } from "react";

import {
  ChevronDownIcon,
  DocumentArrowDownIcon,
  DocumentDuplicateIcon,
  PhotoIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useReactFlow } from "@xyflow/react";
import { kebabCase, sortBy } from "es-toolkit";
import { values } from "es-toolkit/compat";

import { useStore } from "@/hooks/use-store";
import { downloadJson, downloadPNG } from "@/lib/download";
import { formatDate } from "@/utils/format";

import { ContextMenuButton } from "./ContextMenuButton";
import CreateDialog from "./CreateDialog";
import Tooltip from "./Tooltip";

// TODO: allow delete last tree? or support zero trees? revert to initial tree or what?
export default function LeftSidePanel() {
  const [showMoreMenu, setShowMoreMenu] = useState<string | null>(null);
  const [isDialogOpen, setOpenDialog] = useState(false);

  const { fitView } = useReactFlow();

  const { trees, currentTreeId } = useStore((state) => ({
    trees: sortBy(values(state.trees), ["updatedAt"]).reverse(),
    currentTreeId: state.currentTreeId,
  }));

  const { deleteTree, setCurrentTree, duplicateTree } = useStore.getState();

  const handleSetCurrentTree = (treeId: string) => {
    setCurrentTree(treeId);
    // HACK: optimized for fitting in the terminal labels of Hello World Tree
    fitView({ padding: 0.3 });
  };

  const handleDuplicateTree = (treeId: string, treeName: string) => {
    const newName = window.prompt(
      "Enter name for duplicated tree:",
      `${treeName} (Copy)`,
    );
    if (newName && newName.trim()) {
      duplicateTree(treeId, newName.trim());
    }
  };

  const handleDeleteTree = (treeId: string, treeName: string) => {
    if (trees.length <= 1) {
      window.alert("Cannot delete the last tree");
      return;
    }

    // TODO: convert to tailwind dialog
    if (window.confirm(`Are you sure you want to delete "${treeName}"?`)) {
      deleteTree(treeId);
    }
  };

  const handleExportTree = (treeToExport: NonNullable<(typeof trees)[0]>) => {
    if (!treeToExport) return;
    downloadPNG(
      values(treeToExport.nodes ?? []),
      `evtree-${kebabCase(treeToExport.name ?? "untitled")}.png`,
    );
    setShowMoreMenu(null);
  };

  const handleDownloadTree = (
    treeToDownload: NonNullable<(typeof trees)[0]>,
  ) => {
    if (!treeToDownload) return;
    downloadJson(
      treeToDownload,
      `evtree-${kebabCase(treeToDownload.name ?? "untitled")}.json`,
    );
    setShowMoreMenu(null);
  };

  return (
    <div className="w-80 p-4">
      <div className="mb-4 flex justify-between space-x-2">
        <h2 className="text-lg font-semibold">Decision Trees</h2>
        <button
          onClick={() => setOpenDialog(true)}
          className="flex-shrink-0 rounded-md bg-blue-500 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
        >
          Create
        </button>
        <CreateDialog
          open={isDialogOpen}
          onClose={() => setOpenDialog(false)}
        />
      </div>

      {/* Tree list */}
      <div className="">
        {trees.length === 0 ? (
          <p className="text-gray-500">No trees available</p>
        ) : (
          <div className="space-y-2">
            {trees.map((tree, index) => (
              <div
                key={tree.id}
                className={`cursor-pointer rounded-md border p-3 transition-colors ${
                  currentTreeId === tree.id
                    ? "border-blue-500 bg-blue-500/50"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                }`}
                onClick={() => handleSetCurrentTree(tree.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate">{tree.name}</h3>
                    {tree.description && (
                      <p className="my-1 truncate text-gray-600 dark:text-gray-400">
                        {tree.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {tree.updatedAt !== tree.createdAt
                        ? `Updated ${formatDate(tree.updatedAt)}`
                        : `Created ${formatDate(tree.createdAt)}`}
                    </p>
                  </div>
                  <div className="ml-2 flex space-x-1">
                    <div className="relative">
                      <Tooltip text="Tree actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMoreMenu(
                              showMoreMenu === tree.id ? null : tree.id,
                            );
                          }}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <ChevronDownIcon className="h-5 w-5" />
                        </button>
                      </Tooltip>
                      {showMoreMenu === tree.id && (
                        <>
                          {/* Backdrop to close menu when clicking outside */}
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowMoreMenu(null)}
                          />
                          {/* More menu */}
                          <div
                            className={`absolute z-20 w-48 rounded border border-gray-300 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800 ${
                              index >= trees.length - 1
                                ? "right-0 bottom-8"
                                : "top-8 right-0"
                            }`}
                          >
                            <ContextMenuButton
                              onClick={() => {
                                handleDuplicateTree(tree.id, tree.name);
                                setShowMoreMenu(null);
                              }}
                            >
                              <DocumentDuplicateIcon className="h-4 w-4" />
                              Duplicate Tree
                            </ContextMenuButton>
                            <ContextMenuButton
                              onClick={() => {
                                handleDeleteTree(tree.id, tree.name);
                                setShowMoreMenu(null);
                              }}
                            >
                              <TrashIcon className="h-4 w-4" />
                              Delete Tree
                            </ContextMenuButton>
                            <ContextMenuButton
                              onClick={() => handleExportTree(tree)}
                            >
                              <PhotoIcon className="h-4 w-4" />
                              Export as PNG
                            </ContextMenuButton>
                            <ContextMenuButton
                              onClick={() => handleDownloadTree(tree)}
                            >
                              <DocumentArrowDownIcon className="h-4 w-4" />
                              Download as JSON
                            </ContextMenuButton>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
