import { useStore } from "@/hooks/use-store";
import { selectCurrentTree } from "@/lib/selectors";
import { debounce, range } from "es-toolkit";
import { toPairs } from "es-toolkit/compat";
import React, { useState } from "react";

export default function VariablesInput() {
  // Subscribe to store directly
  const { variables, onTreeDataUpdate } = useStore((state) => {
    const currentTree = selectCurrentTree(state);
    return {
      variables: currentTree?.variables ?? {},
      onTreeDataUpdate: state.onTreeDataUpdate,
    };
  });

  // Derive initial UI state from store variables
  const initialVariablesArray = React.useMemo(() => {
    const entries = toPairs(variables);
    const minRows = Math.max(3, entries.length + 1);
    return range(0, minRows).map((i) => {
      if (i < entries.length) {
        const entry = entries[i];
        if (entry) {
          return { name: entry[0], value: entry[1].toString() };
        }
      }
      return { name: "", value: "" };
    });
  }, [variables]);

  // Local state for immediate UI updates
  const [localVariables, setLocalVariables] = useState(initialVariablesArray);

  // TODO: make deleting the name or value remove the variable from the UI, as
  // it does on reload

  // TODO: make this work in a simple way
  // Sync local state when store changes (for undo/redo)
  // useEffect(() => {
  //   setLocalVariables(initialVariablesArray);
  // }, [initialVariablesArray]);

  const debouncedOnChange = debounce((vars: Record<string, number>) => {
    onTreeDataUpdate({ variables: vars });
  }, 200);

  const handleNameChange = (index: number, name: string) => {
    const newVariables = [...localVariables];
    const current = newVariables[index];
    if (current) {
      newVariables[index] = { ...current, name };
      setLocalVariables(newVariables);
      updateVariables(newVariables);
    }
  };

  const handleValueChange = (index: number, value: string) => {
    const newVariables = [...localVariables];
    const current = newVariables[index];
    if (current) {
      newVariables[index] = { ...current, value };
      setLocalVariables(newVariables);
      updateVariables(newVariables);
    }
  };

  const updateVariables = (
    newVariables: Array<{ name: string; value: string }>,
  ) => {
    // Convert back to Record<string, number>, filtering out empty entries
    const filteredVariables: Record<string, number> = {};
    newVariables.forEach(({ name, value }) => {
      if (name.trim() && value.trim()) {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          filteredVariables[name.trim()] = numValue;
        }
      }
    });

    debouncedOnChange(filteredVariables);
  };

  const addMoreRows = () => {
    const newVariables = [
      ...localVariables,
      ...range(0, 3).map(() => ({ name: "", value: "" })),
    ];
    setLocalVariables(newVariables);
  };

  return (
    <div className="mb-2">
      <label className="mb-2 block cursor-pointer select-none">Variables</label>
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
              placeholder={`var${index + 1}`}
              className="min-w-0 rounded-md border-2 p-1 text-sm"
              // TODO: add validation for variable names
            />
            <span className="text-gray-500 dark:text-gray-400">=</span>
            <input
              type="number"
              value={variable.value}
              onChange={(e) => handleValueChange(index, e.target.value)}
              placeholder={`${index + 1}000`}
              className="min-w-0 rounded-md border-2 p-1 text-sm"
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
    </div>
  );
}
