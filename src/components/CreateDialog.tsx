"use client";

import { useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
// NOTE: headlessui is complementary library from Tailwind Labs
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import {
  ArrowPathIcon,
  FolderOpenIcon,
  PlusIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useReactFlow } from "@xyflow/react";
import { isEmpty } from "es-toolkit/compat";

import { useTreeStore } from "@/hooks/use-tree-store";
import {
  AIGenerationError,
  type AIGenerationProgress,
  EXTRACTABLE_FILE_TYPES,
  convertAIStructureToDecisionTree,
  extractTextFromFile,
  formatElapsed,
  generateDecisionTree,
} from "@/lib/ai";
import { ARRANGE_FADE_MS } from "@/lib/animate";
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
export function CreateDialog({ open, onClose }: CreateDialogProps) {
  const { fitView, zoomTo } = useReactFlow();

  const { createTree, loadTree, arrange } = useTreeStore.getState();

  // TODO: replace all this form state with a local reducer?
  const [newTreeName, setNewTreeName] = useState("");
  const [newTreeDescription, setNewTreeDescription] = useState("");
  const [currentTab, setCurrentTab] = useState("create");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [aiInputText, setAiInputText] = useState("");
  // NOTE: the name of the file that the text for AI was extracted from, for
  // the description of the tree. The user can still edit the text.
  const [aiSourceFileName, setAiSourceFileName] = useState<string | null>(null);
  const [aiProgress, setAiProgress] = useState<AIGenerationProgress>();
  const [generationStartedAt, setGenerationStartedAt] = useState<number>();
  const [now, setNow] = useState(0);
  const abortControllerRef = useRef<AbortController>(undefined);

  // NOTE: tick every second while generating, to show the elapsed time
  useEffect(() => {
    if (!generationStartedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [generationStartedAt]);

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
    const startedAt = Date.now();
    setGenerationStartedAt(startedAt);
    setNow(startedAt);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const aiTreeStructure = await generateDecisionTree(
        aiInputText.trim(),
        setAiProgress,
        abortController.signal,
      );

      // Convert the hierarchical AI structure to flat DecisionTree format
      const decisionTree = convertAIStructureToDecisionTree(
        aiTreeStructure,
        newTreeName.trim(),
        // NOTE: the whole text, to check the quotes of the AI against, and
        // the file to name in the description of the tree
        { text: aiInputText, fileName: aiSourceFileName ?? undefined },
      );

      // Sanity check
      if (isEmpty(decisionTree.nodes) || isEmpty(decisionTree.edges)) {
        console.error("[EVTree] Generated tree is empty");
        window.alert("Generated tree is empty. Please check input.");
        return;
      }

      loadTree(decisionTree, true);
      // TODO: optimize auto arrange, figure out what's going on with timing,
      // avoid spurious undo stack entries
      setTimeout(() => {
        arrange();
        // NOTE: fit after the arrange, which moves the nodes only after its
        // fade, see withArrangeAnimation. React Flow queues a fitView() until
        // it next has nodes that are all measured. Here the nodes are already
        // measured, so a fit asked for at once would run on the next frame,
        // while the nodes are all still in one place.
        setTimeout(() => {
          fitView();
        }, ARRANGE_FADE_MS + 100);
      }, 100);

      setAiInputText("");
      setAiSourceFileName(null);
      setNewTreeName("");
      setNewTreeDescription("");
      onClose();
    } catch (error) {
      // NOTE: cancelled by the user
      if (abortController.signal.aborted) {
        return;
      }
      console.error(error);
      // TODO: better than window.alert
      window.alert(
        error instanceof AIGenerationError
          ? `Failed to generate tree with AI after ${formatElapsed(error.elapsedMs)} while ${error.phase}${error.status ? ` (error ${error.status})` : ""}. Please try again.`
          : "Failed to generate tree with AI. Please try again.",
      );
    } finally {
      setIsGenerating(false);
      setAiProgress(undefined);
      setGenerationStartedAt(undefined);
      abortControllerRef.current = undefined;
    }
  };

  const handleCancel = () => {
    // NOTE: the first cancel stops a generation in progress, the next closes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    } else {
      onClose();
    }
  };

  function getAiStatusText(progress?: AIGenerationProgress): string {
    switch (progress?.phase) {
      case "thinking":
        return progress.status ?? "Thinking";
      case "writing":
        return `Writing the tree (${progress.nodes ?? 0} nodes so far)`;
      case "parsing":
      case "validating":
        return "Checking the tree";
      default:
        return "Waiting for the AI";
    }
  }

  const handleFileUploadForAI = async (
    e: React.InputEvent<HTMLInputElement>,
  ) => {
    const file = e.currentTarget.files?.[0];
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
      setAiSourceFileName(file.name);
    } catch (error) {
      console.error(error);
      // TODO: better than window.alert
      window.alert(
        `${(error as Error).message}. Please try another file or enter the text manually.`,
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
                        onInput={(e) => setCurrentTab(e.currentTarget.value)}
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
                          onInput={(e) => setNewTreeName(e.currentTarget.value)}
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
                          onInput={(e) =>
                            setNewTreeDescription(e.currentTarget.value)
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
                          onInput={(e) => setNewTreeName(e.currentTarget.value)}
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
                            onInput={(e) => {
                              setAiInputText(e.currentTarget.value);
                              // NOTE: text that is cleared and typed or
                              // pasted again is no longer from the file
                              if (!e.currentTarget.value) {
                                setAiSourceFileName(null);
                              }
                            }}
                            placeholder={`Example: I'm representing Iron-Steel, the defendant, in a legal dispute that has generated years of expensive and acrimonious litigation over alleged defects in railroad cars designed to carry larger quantities of coal than a conventional railroad car. It is undisputed that...`}
                            className="flex-2/3 rounded-md border-0 px-3 py-1.5 text-base text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 focus:ring-inset dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500 dark:focus:ring-blue-500"
                          />
                          <div className="mt-2 mb-4 flex-1/3 rounded-md border-0 px-3 py-1.5 text-base text-blue-600">
                            {!isExtractingText ? (
                              <input
                                type="file"
                                onInput={handleFileUploadForAI}
                                accept={EXTRACTABLE_FILE_TYPES}
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
                        {isGenerating && (
                          <div className="flex items-center gap-2 text-base text-gray-500 dark:text-gray-400">
                            <ArrowPathIcon className="size-4 shrink-0 animate-spin" />
                            <span className="truncate">
                              {getAiStatusText(aiProgress)}
                            </span>
                            <span className="ml-auto shrink-0 tabular-nums">
                              {formatElapsed(
                                Math.max(0, now - (generationStartedAt ?? now)),
                              )}{" "}
                              · usually 1–3 min
                            </span>
                          </div>
                        )}
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
                          onInput={(e) =>
                            setSelectedFile(e.currentTarget.files?.[0] || null)
                          }
                          className="my-1.5 text-base text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-base file:font-semibold file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                        />
                        <p
                          className="my-1.5 text-sm text-gray-500 dark:text-gray-400"
                          // NOTE: sync terminology with download button
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
                  {isGenerating ? "Generating..." : "Generate"}
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
                onClick={handleCancel}
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
