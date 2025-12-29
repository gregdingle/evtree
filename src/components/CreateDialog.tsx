"use client";

import { useState } from "react";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
// NOTE: headlessui is complementary library from Tailwind Labs
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import {
  FolderOpenIcon,
  PlusIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useReactFlow } from "@xyflow/react";
import { isEmpty, truncate } from "es-toolkit/compat";

import { useStore } from "@/hooks/use-store";
import {
  convertAIStructureToDecisionTree,
  extractTextFromFile,
  generateDecisionTree,
} from "@/lib/ai";
import { firebaseApp } from "@/lib/firebase";
import { type DecisionTree } from "@/lib/tree";

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * @see https://tailwindcss.com/plus/ui-blocks/application-ui/overlays/modal-dialogs
 *
 * TODO: make styles more consistent with rest of app, like text size and inputs
 * TODO: change to use tailwind plus input: https://tailwindcss.com/plus/ui-blocks/application-ui/forms/input-groups
 */
export default function CreateDialog({ open, onClose }: CreateDialogProps) {
  const { fitView, zoomTo } = useReactFlow();

  const { createTree, loadTree, onArrange } = useStore.getState();

  // TODO: replace all this form state with a local reducer?
  const [newTreeName, setNewTreeName] = useState("");
  const [newTreeDescription, setNewTreeDescription] = useState("");
  const [currentTab, setCurrentTab] = useState("create");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [aiInputText, setAiInputText] = useState("");

  const tabs = [
    { name: "Create New", id: "create", icon: PlusIcon },
    // NOTE: Although sharing links is preferred, always allow Import From File
    // to handle edge cases
    { name: "Import from File", id: "open", icon: FolderOpenIcon },
  ];

  if (firebaseApp) {
    tabs.push({ name: "Generate with AI", id: "ai", icon: SparklesIcon });
  }

  // TODO: replace with cx function?
  function classNames(...classes: (string | boolean | undefined)[]): string {
    return classes.filter(Boolean).join(" ");
  }

  const handleCreateTree = () => {
    if (newTreeName.trim()) {
      createTree(newTreeName.trim(), newTreeDescription.trim());
      setNewTreeName("");
      setNewTreeDescription("");
      onClose();

      // NOTE: just to set zoom appropriately for first node
      setTimeout(() => {
        zoomTo(2);
      }, 100);
    }
  };

  const handleCreateWithAI = async () => {
    if (!aiInputText.trim() || !newTreeName.trim()) {
      console.error(
        "[EVTree] Name and description text required for AI generation",
      );
      // TODO: form validation... use homeform, zod and tailwind pro inputs
      return;
    }

    setIsGenerating(true);

    try {
      const aiTreeStructure = await generateDecisionTree(aiInputText.trim());

      // Convert the hierarchical AI structure to flat DecisionTree format
      const decisionTree = convertAIStructureToDecisionTree(
        aiTreeStructure,
        newTreeName.trim(),
        // TODO: optimize description?
        `Generated from AI based on text: \n\n"${truncate(aiInputText.trim(), { length: 1000 })}"`,
      );

      // Sanity check
      if (isEmpty(decisionTree.nodes) || isEmpty(decisionTree.edges)) {
        console.error("[EVTree] Generated tree is empty");
        window.alert("Generated tree is empty. Please check input.");
        return;
      }

      loadTree(decisionTree, true);
      // TODO: optimize auto arrange, figure out what's going on with timing
      setTimeout(() => {
        onArrange();
        fitView();
      }, 100);

      setAiInputText("");
      setNewTreeName("");
      setNewTreeDescription("");
      onClose();
    } catch (error) {
      console.error(error);
      // TODO: better than alert
      window.alert("Failed to generate tree with AI. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUploadForAI = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setIsExtractingText(true);

    try {
      // QUESTION: better to do two-step process as here or one-step by calling
      // createDecisionTreeFromText with the document?
      const extractedText = await extractTextFromFile(file);
      setAiInputText(extractedText);
    } catch (error) {
      console.error(error);
      // TODO: better than alert
      window.alert(
        "Failed to extract text from file. Please check the console for details or try entering text manually.",
      );
      setSelectedFile(null);
    } finally {
      setIsExtractingText(false);
    }
  };

  const handleOpenTree = async () => {
    if (!selectedFile) {
      console.error("[EVTree] No file selected");
      return;
    }

    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);

      // Validate tree data
      if (!data || typeof data !== "object") {
        console.error("[EVTree] Invalid file format");
        return;
      }

      const treeData = data as unknown as DecisionTree;

      // Sanity check required fields
      if (
        typeof treeData.name !== "string" ||
        !treeData.name ||
        typeof treeData.nodes !== "object" ||
        !treeData.nodes ||
        typeof treeData.edges !== "object" ||
        !treeData.edges
      ) {
        console.error(
          "[EVTree] Invalid tree file format - missing required fields",
        );
        return;
      }

      loadTree(treeData, false);
      onClose();
    } catch (error) {
      // TODO: error cause here?
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-10">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative min-w-xl transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-lg data-closed:sm:translate-y-0 data-closed:sm:scale-95 dark:bg-gray-800"
          >
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 dark:bg-gray-800">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 flex-1 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-semibold text-gray-900 dark:text-white"
                  >
                    Create New Decision Tree
                  </DialogTitle>

                  {/* Tab Navigation */}
                  <div className="mt-4">
                    <div className="grid grid-cols-1 sm:hidden">
                      <select
                        value={currentTab}
                        onChange={(e) => setCurrentTab(e.target.value)}
                        aria-label="Select a tab"
                        className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-2 pr-8 pl-3 text-lg text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 dark:bg-gray-700 dark:text-white dark:outline-gray-600"
                      >
                        {tabs.map((tab) => (
                          <option key={tab.id} value={tab.id}>
                            {tab.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon
                        aria-hidden="true"
                        className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end fill-gray-500 dark:fill-gray-400"
                      />
                    </div>
                    <div className="hidden sm:block">
                      <div className="border-b border-gray-200 dark:border-gray-600">
                        <nav
                          aria-label="Tabs"
                          className="-mb-px flex space-x-8"
                        >
                          {tabs.map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => setCurrentTab(tab.id)}
                              aria-current={
                                currentTab === tab.id ? "page" : undefined
                              }
                              className={classNames(
                                currentTab === tab.id
                                  ? // TODO: use blue highlight here or standard blue?
                                    "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-300",
                                "group inline-flex items-center border-b-2 px-1 py-4 text-base font-medium",
                              )}
                            >
                              <tab.icon
                                aria-hidden="true"
                                className={classNames(
                                  currentTab === tab.id
                                    ? "text-blue-500 dark:text-blue-400"
                                    : "text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300",
                                  "mr-2 -ml-0.5 size-5",
                                )}
                              />
                              <span>{tab.name}</span>
                            </button>
                          ))}
                        </nav>
                      </div>
                    </div>
                  </div>

                  {/* Tab Content */}
                  <div className="mt-4">
                    {currentTab === "create" && (
                      <div>
                        <p className="mb-3 text-base text-gray-500 dark:text-gray-400">
                          Enter a name for your new decision tree
                        </p>
                        <input
                          type="text"
                          value={newTreeName}
                          onChange={(e) => setNewTreeName(e.target.value)}
                          placeholder="Enter tree name..."
                          className="mb-3 block w-full rounded-md border-0 px-3 py-1.5 text-base text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500 dark:focus:ring-blue-500"
                          autoFocus
                          required
                        />
                        <p className="mb-3 text-base text-gray-500 dark:text-gray-400">
                          Enter an optional description for your new decision
                          tree
                        </p>
                        <textarea
                          rows={3}
                          value={newTreeDescription}
                          onChange={(e) =>
                            setNewTreeDescription(e.target.value)
                          }
                          placeholder="Enter tree description..."
                          className="mb-3 block w-full rounded-md border-0 px-3 py-1.5 text-base text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500 dark:focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {currentTab === "ai" && (
                      <div>
                        <p className="mb-3 text-base text-gray-500 dark:text-gray-400">
                          Enter a name for your AI-generated decision tree
                        </p>
                        <input
                          type="text"
                          value={newTreeName}
                          onChange={(e) => setNewTreeName(e.target.value)}
                          placeholder="Enter tree name..."
                          className="mb-3 block w-full rounded-md border-0 px-3 py-1.5 text-base text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 focus:ring-inset dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500 dark:focus:ring-blue-500"
                          required
                        />

                        <p className="mb-3 text-base text-gray-500 dark:text-gray-400">
                          Describe your situation, paste in some text, or upload
                          a document
                        </p>
                        <div className="mb-3 flex items-center">
                          <textarea
                            rows={7}
                            value={aiInputText}
                            onChange={(e) => setAiInputText(e.target.value)}
                            placeholder={`Example: I'm representing a party in a legal dispute that has generated years of expensive and acrimonious litigation over alleged defects in railroad cars designed to carry larger quantities of coal than a conventional railroad car. It isundisputed that...`}
                            className="flex-2/3 rounded-md border-0 px-3 py-1.5 text-base text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 focus:ring-inset dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500 dark:focus:ring-blue-500"
                          />
                          <div className="mt-2 mb-4 flex-1/3 rounded-md border-0 px-3 py-1.5 text-base text-blue-600">
                            {!isExtractingText ? (
                              <input
                                type="file"
                                onChange={handleFileUploadForAI}
                                accept=".pdf,.doc,.docx,.txt,.rtf"
                                // NOTE: text-transparent to hide the "no file chosen" system text
                                className="block w-full text-base text-transparent file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-base file:font-semibold file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                              />
                            ) : (
                              <div
                                className="animate-pulse"
                                // TODO: better to use a spinner?
                              >
                                ✨ Extracting text
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {currentTab === "open" && (
                      <div>
                        <p className="my-1.5 text-base text-gray-500 dark:text-gray-400">
                          Create a new decision tree from an existing file
                        </p>
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) =>
                            setSelectedFile(e.target.files?.[0] || null)
                          }
                          className="my-1.5 text-base text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-base file:font-semibold file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                        />
                        <p
                          className="my-1.5 text-sm text-gray-500 dark:text-gray-400"
                          // TODO: sync terminology with download button
                        >
                          Select a previously downloaded JSON file
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 dark:bg-gray-700">
              {currentTab === "create" && (
                <button
                  onClick={handleCreateTree}
                  disabled={!newTreeName.trim()}
                  className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-base font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 sm:ml-3 sm:w-auto dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
                >
                  Create
                </button>
              )}
              {currentTab === "ai" && (
                <button
                  onClick={handleCreateWithAI}
                  disabled={
                    !aiInputText.trim() || !newTreeName.trim() || isGenerating
                  }
                  className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-base font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 sm:ml-3 sm:w-auto dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
                >
                  {isGenerating ? (
                    // TODO: spinner
                    <>Generating...</>
                  ) : (
                    "Generate"
                  )}
                </button>
              )}
              {currentTab === "open" && (
                <button
                  onClick={handleOpenTree}
                  disabled={!selectedFile}
                  className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-base font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 sm:ml-3 sm:w-auto dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
                >
                  Import
                </button>
              )}
              <button
                type="button"
                onClick={() => onClose()}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-base font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-gray-800 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
