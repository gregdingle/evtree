"use client";

import { useStore } from "@/hooks/use-store";
import { DocumentDuplicateIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useReactFlow } from "@xyflow/react";
import { sortBy } from "es-toolkit";
import { values } from "es-toolkit/compat";
import { useState } from "react";
import Tooltip from "./Tooltip";

// TODO: allow delete last tree? or support zero trees? revert to initial tree or what?
export default function LeftSidePanel() {
  const [newTreeName, setNewTreeName] = useState("");
  const { fitView } = useReactFlow();

  const { trees, currentTreeId } = useStore((state) => ({
    trees: sortBy(values(state.trees), ["updatedAt"]).reverse(),
    currentTreeId: state.currentTreeId,
  }));

  const { createTree, deleteTree, setCurrentTree, duplicateTree } =
    useStore.getState();

  const handleSetCurrentTree = (treeId: string) => {
    setCurrentTree(treeId);
    // Fit view after a brief delay to allow the tree to render
    setTimeout(() => {
      fitView();
    }, 100);
  };

  const handleCreateTree = () => {
    if (newTreeName.trim()) {
      createTree(newTreeName.trim());
      setNewTreeName("");
    }
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

    if (window.confirm(`Are you sure you want to delete "${treeName}"?`)) {
      deleteTree(treeId);
    }
  };

  return (
    <div className="w-80 p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Trees</h2>
      </div>

      {/* Create new tree */}
      <div className="mb-6">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newTreeName}
            onChange={(e) => setNewTreeName(e.target.value)}
            placeholder="New tree name"
            className="flex-1 rounded-md border-2 p-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreateTree();
              }
            }}
          />
          <button
            onClick={handleCreateTree}
            disabled={!newTreeName.trim()}
            className="rounded-md bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
          >
            Create
          </button>
        </div>
      </div>

      {/* Tree list */}
      <div className="">
        {trees.length === 0 ? (
          <p className="text-gray-500">No trees available</p>
        ) : (
          <div className="space-y-2">
            {trees.map((tree) => (
              <div
                key={tree.id}
                className={`cursor-pointer rounded-md border p-3 transition-colors ${
                  currentTreeId === tree.id
                    ? "border-blue-300 bg-blue-100 dark:border-blue-600 dark:bg-blue-900"
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
                      Updated {new Date(tree.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="ml-2 flex space-x-1">
                    <Tooltip text="Duplicate tree">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateTree(tree.id, tree.name);
                        }}
                        className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                      >
                        <DocumentDuplicateIcon className="h-5 w-5" />
                      </button>
                    </Tooltip>
                    <Tooltip text="Delete tree">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTree(tree.id, tree.name);
                        }}
                        className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </Tooltip>
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
