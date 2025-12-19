import React, { useEffect, useState } from "react";

import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { range, upperFirst } from "es-toolkit";

import { useStore } from "@/hooks/use-store";
import { selectCurrentTree } from "@/lib/selectors";

import Tooltip from "./Tooltip";

/**
 * See VariablesList for the complementing component that allows selecting
 * variables for an expression.
 */
export default function VariablesInput({
  scope,
  info,
}: {
  scope: "value" | "cost" | "probability";
  info: string;
}) {
  // Subscribe to store directly - also get currentTreeId to detect tree switches
  const { currentTreeId, variables } = useStore((state) => {
    const currentTree = selectCurrentTree(state);
    return {
      currentTreeId: state.currentTreeId,
      variables: currentTree?.variables?.filter((v) => v.scope === scope) ?? [],
    };
  });

  const { replaceVariables } = useStore.getState();

  // Derive initial UI state from store variables
  const initialVariablesArray = React.useMemo(() => {
    const entries = variables.map((v) => [v.name, v.value, v.scope] as const);
    const minRows = Math.max(3, entries.length + 1);
    return range(0, minRows).map((i) => {
      if (i < entries.length) {
        const entry = entries[i];
        if (entry) {
          return {
            name: entry[0],
            value: entry[1].toString(),
            scope: entry[2],
          };
        }
      }
      return { name: "", value: "", scope };
    });
  }, [scope, variables]);

  // Local state for immediate UI updates
  const [localVariables, setLocalVariables] = useState(initialVariablesArray);

  // Sync local state only when tree switches (not when variables change)
  useEffect(() => {
    setLocalVariables(initialVariablesArray);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTreeId]); // Only depend on tree ID, not variables

  // TODO: make deleting the name or value remove the variable from the UI, as
  // it does on reload

  const handleNameChange = (index: number, name: string) => {
    // Whitelist: letters, numbers, underscores
    // Strip out any other characters (spaces, special chars, etc.)
    // NOTE: see Parser.evaluate for how variable names are actually parsed
    const sanitizedName = name
      .replace(/^[^a-zA-Z]/, "")
      .replace(/[^a-zA-Z0-9_]/g, "");

    const newVariables = [...localVariables];
    const current = newVariables[index];
    if (current) {
      newVariables[index] = { ...current, name: sanitizedName };
      setLocalVariables(newVariables);
      replaceVariables(newVariables, scope);
    }
  };

  const handleValueChange = (index: number, value: string) => {
    const newVariables = [...localVariables];
    const current = newVariables[index];
    if (current) {
      newVariables[index] = { ...current, value };
      setLocalVariables(newVariables);
      replaceVariables(newVariables, scope);
    }
  };

  const addMoreRows = () => {
    const newVariables = [
      ...localVariables,
      ...range(0, 3).map(() => ({ name: "", value: "", scope })),
    ];
    setLocalVariables(newVariables);
  };

  return (
    <details className="my-4" open={variables.length > 0}>
      <summary className="mb-2 cursor-pointer select-none">
        <span title={info}>{upperFirst(scope)} Variables</span>
        <span
          // NOTE: see also PropertyInput.tsx for similar styling
          className="text-xs text-gray-500 pl-2"
        >
          {" "}
          (optional)
        </span>
        {info && (
          <Tooltip
            text={info}
            position="top"
            className="inline-block pl-1 cursor-pointer float-right"
          >
            <InformationCircleIcon className="h-6 w-6 -mb-1 text-gray-500" />
          </Tooltip>
        )}
      </summary>
      <div className="space-y-1">
        {localVariables.map((variable, index) => (
          <div
            key={index}
            className="grid w-full max-w-full grid-cols-[1fr_auto_1fr] items-center gap-2"
          >
            <input
              type="text"
              value={variable.name}
              onChange={(e) => handleNameChange(index, e.target.value)}
              placeholder={`${scope.slice(0, 4)}var${index + 1}`}
              className="min-w-0 rounded-md border-2 p-1 text-sm"
              spellCheck={false}
            />
            <span className="text-gray-500 dark:text-gray-400">=</span>
            <input
              type="number"
              value={variable.value}
              onChange={(e) => handleValueChange(index, e.target.value)}
              placeholder={
                scope === "probability" ? `0.${index + 1}` : `${index + 1}000`
              }
              className="min-w-0 rounded-md border-2 p-1 text-sm"
              step={scope === "probability" ? 0.1 : 1000}
              // TODO: always a good idea to have var values >= 0 ?
              min={0}
              max={scope === "probability" ? 1 : undefined}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addMoreRows}
          className="mt-2 rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          + more rows
        </button>
      </div>
    </details>
  );
}
