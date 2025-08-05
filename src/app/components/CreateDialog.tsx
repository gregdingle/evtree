"use client";

import { useStore, type DecisionTree } from "@/hooks/use-store";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import {
  FolderOpenIcon,
  PlusIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * @see https://tailwindcss.com/plus/ui-blocks/application-ui/overlays/modal-dialogs
 */
export default function CreateDialog({ open, onClose }: CreateDialogProps) {
  const { createTree, loadTree } = useStore.getState();

  // TODO: replace all this form state with a local reducer?
  const [newTreeName, setNewTreeName] = useState("");
  const [newTreeDescription, setNewTreeDescription] = useState("");
  const [currentTab, setCurrentTab] = useState("create");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aiInputText, setAiInputText] = useState("");

  const tabs = [
    { name: "Create New", id: "create", icon: PlusIcon },
    { name: "Generate with AI", id: "ai", icon: SparklesIcon },
    { name: "Import File", id: "open", icon: FolderOpenIcon },
  ];

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
    }
  };

  const handleCreateWithAI = async () => {
    if (!aiInputText.trim() || !newTreeName.trim()) {
      console.error(
        "[EVTree] Name and description text required for AI generation",
      );
      return;
    }

    try {
      // TODO: Implement AI tree generation
      // This would typically call an AI service to convert text to decision tree
      console.warn("[EVTree] AI tree generation not yet implemented");

      // For now, just create a basic tree with the provided name and auto-generated description
      createTree(newTreeName.trim(), `Generated from: "${aiInputText}"`);

      setAiInputText("");
      setNewTreeName("");
      onClose();
    } catch (error) {
      console.error("[EVTree] Failed to generate tree with AI:", error);
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

      loadTree(treeData);
      onClose();
    } catch (error) {
      console.error("[EVTree] Failed to parse tree file:", error);
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
            className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-lg data-closed:sm:translate-y-0 data-closed:sm:scale-95 dark:bg-gray-800"
          >
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 dark:bg-gray-800">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 flex-1 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <DialogTitle
                    as="h3"
                    className="text-base font-semibold text-gray-900 dark:text-white"
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
                        className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-2 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 dark:bg-gray-700 dark:text-white dark:outline-gray-600"
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
                                  ? // TODO: use green highlight here or standard blue?
                                    "border-green-500 text-green-600 dark:border-green-400 dark:text-green-400"
                                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-300",
                                "group inline-flex items-center border-b-2 px-1 py-4 text-sm font-medium",
                              )}
                            >
                              <tab.icon
                                aria-hidden="true"
                                className={classNames(
                                  currentTab === tab.id
                                    ? "text-green-500 dark:text-green-400"
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
                        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                          Enter a name for your new decision tree
                        </p>
                        <input
                          type="text"
                          value={newTreeName}
                          onChange={(e) => setNewTreeName(e.target.value)}
                          placeholder="Enter tree name..."
                          className="mb-3 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500 dark:focus:ring-green-500"
                          autoFocus
                          required
                        />
                        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
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
                          className="mb-3 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500 dark:focus:ring-green-500"
                        />
                      </div>
                    )}

                    {currentTab === "ai" && (
                      <div>
                        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                          Enter a name for your AI-generated decision tree
                        </p>
                        <input
                          type="text"
                          value={newTreeName}
                          onChange={(e) => setNewTreeName(e.target.value)}
                          placeholder="Enter tree name..."
                          className="mb-3 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-green-600 focus:ring-inset sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500 dark:focus:ring-green-500"
                          required
                        />
                        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                          Describe your situation, or paste in the text of an
                          existing document
                        </p>
                        <textarea
                          rows={6}
                          value={aiInputText}
                          onChange={(e) => setAiInputText(e.target.value)}
                          placeholder={`Example: I'm representing a party in a legal dispute that has
generated years of expensive and acrimonious litigation over
alleged defects in railroad cars designed to carry larger
quantities of coal than a conventional railroad car. It is
undisputed that the cars were designed by Iron- Steel Products,
Inc.(Iron-Steel), manufactured by Bromfield Works (Bromfield),
and sold to the utility company South Western Lighting and Power
(SWL&P) to haul coal over tracks in the western United States.
Extensive cracking developed in these cars and will require
extensive repair. SWL&P filed suit against Iron-Steel for
defective design, alleging negligence, breach of contract, and
breach of a deceptive trade practices statute (the latter
allowing recovery of reasonable attorneys' fees and treble
damages). Iron-Steel denied the defective design claim and sued
Bromfield alleging negligent manufacturing. Iron-Steel has also
brought a motion to dismiss all claims by SWL&P against it under
two theories. First, Iron-Steel argues that SWL&P's claims are
barred by a settlement between them in related litigation in
another state, citing a recent decision in New Mexico. Second,
Iron-Steel argues that these claims are barred by the statute of
limitation, because SWL&P knew or could have known of the
cracking problem long before the suit was filed. Of course,
SWL&P opposes the motion to dismiss, arguing that the New Mexico
decision does not apply to bar the claim under these
circumstances, and that the statute of limitations began to run
at a later date, and thus had not expired by the date of filing.
SWL&P also argued that even if the statute of limitations would
bar the statutory claim for deceptive trade practices, the
common law claims would not be barred. Of course, once rulings
are obtained on these issues, there will remain the question of
whether any liability is found and if so, against whom --
Iron-Steel only, Bromfield only, or both Iron-Steel and
Bromfield with joint and several liability. It is reasonable to
assume that, if joint and several liability is found, the
allocations might be 50%/50% each, or Iron-Steel-66%/Bromfield-
33%, or the opposite.

For simplicity's sake, assume that high, mid-range and low jury
awards have been estimated at $7 million, $5 million, and $3
million respectively, depending upon how much of the damages
proof is accepted by the jury. Also assume that legal fees for
each side from now through full briefings and arguments on the
motion to dismiss will be $100,000. Assume that legal fees
thereafter, through trial and post-trial motions for each side
will be an additional $200,000.
                            `}
                          className="mb-3 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-green-600 focus:ring-inset sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500 dark:focus:ring-green-500"
                        />
                      </div>
                    )}

                    {currentTab === "open" && (
                      <div>
                        <p className="my-1.5 text-sm text-gray-500 dark:text-gray-400">
                          Create a new decision tree from an existing file
                        </p>
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) =>
                            setSelectedFile(e.target.files?.[0] || null)
                          }
                          className="block cursor-pointer rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:placeholder-gray-400"
                        />
                        <p className="my-1.5 text-xs text-gray-500 dark:text-gray-400">
                          Select a JSON file containing a previously downloaded
                          decision tree
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
                  className="inline-flex w-full justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 sm:ml-3 sm:w-auto dark:bg-green-700 dark:hover:bg-green-600 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
                >
                  Create
                </button>
              )}
              {currentTab === "ai" && (
                <button
                  onClick={handleCreateWithAI}
                  disabled={!aiInputText.trim() || !newTreeName.trim()}
                  className="inline-flex w-full justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 sm:ml-3 sm:w-auto dark:bg-green-700 dark:hover:bg-green-600 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
                >
                  Generate
                </button>
              )}
              {currentTab === "open" && (
                <button
                  onClick={handleOpenTree}
                  disabled={!selectedFile}
                  className="inline-flex w-full justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 sm:ml-3 sm:w-auto dark:bg-green-700 dark:hover:bg-green-600 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
                >
                  Import
                </button>
              )}
              <button
                type="button"
                onClick={() => onClose()}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-gray-800 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-700"
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
