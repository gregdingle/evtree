"use client";

import { useStore } from "@/hooks/use-store";
import { values } from "es-toolkit/compat";
import { useState } from "react";

// TODO: this is AI generated... refine!
// TODO: do not allow delete last tree? or support zero trees? revert to initial tree or what?
export default function LeftSidePanel() {
  const [newTreeName, setNewTreeName] = useState("");

  const { trees, currentTreeId, currentTree } = useStore((state) => ({
    trees: values(state.trees),
    currentTreeId: state.currentTreeId,
    currentTree: state.getCurrentTree(),
  }));

  const { createTree, deleteTree, setCurrentTree, duplicateTree } =
    useStore.getState();

  const handleCreateTree = () => {
    if (newTreeName.trim()) {
      createTree(newTreeName.trim());
      setNewTreeName("");
    }
  };

  const handleDuplicateTree = (treeId: string, treeName: string) => {
    const newName = prompt(
      "Enter name for duplicated tree:",
      `${treeName} (Copy)`
    );
    if (newName && newName.trim()) {
      duplicateTree(treeId, newName.trim());
    }
  };

  const handleDeleteTree = (treeId: string, treeName: string) => {
    if (trees.length <= 1) {
      alert("Cannot delete the last tree");
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${treeName}"?`)) {
      deleteTree(treeId);
    }
  };

  return (
    <div className="p-4 w-80">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Trees</h2>
        {currentTree && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Current: <span className="font-medium">{currentTree.name}</span>
          </p>
        )}
      </div>

      {/* Create new tree */}
      <div className="mb-6">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newTreeName}
            onChange={(e) => setNewTreeName(e.target.value)}
            placeholder="New tree name"
            className="flex-1 border-2 p-1 rounded-md text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreateTree();
              }
            }}
          />
          <button
            onClick={handleCreateTree}
            disabled={!newTreeName.trim()}
            className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
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
                className={`p-3 border rounded-md cursor-pointer transition-colors ${
                  currentTreeId === tree.id
                    ? "bg-blue-100 border-blue-300 dark:bg-blue-900 dark:border-blue-600"
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
                }`}
                onClick={() => setCurrentTree(tree.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{tree.name}</h3>
                    {tree.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                        {tree.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Nodes: {values(tree.nodes).length}, Edges:{" "}
                      {values(tree.edges).length}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Updated: {new Date(tree.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-1 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateTree(tree.id, tree.name);
                      }}
                      className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                      title="Duplicate tree"
                    >
                      📋
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTree(tree.id, tree.name);
                      }}
                      className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      title="Delete tree"
                    >
                      🗑️
                    </button>
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
