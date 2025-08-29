import { useEffect, useRef, useState } from "react";

import { NodeProps } from "@xyflow/react";

import { useStore } from "@/hooks/use-store";
import { AppNode } from "@/lib/node";

export const NoteNode = ({ data, selected, id }: NodeProps<AppNode>) => {
  // Local state for inline editing
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { onNodeDataUpdate } = useStore.getState();

  // Auto-resize textarea on content change
  useEffect(() => {
    if (isEditing && inputRef.current) {
      resizeTextarea(inputRef.current);
    }
  }, [data.description, isEditing]);

  const handleClick = () => {
    // Allow click to propagate for selection, but also enter edit mode
    setIsEditing(true);
  };

  const handleBlur = () => {
    // TODO: onBlur, the text jumps a few pixels as it switches from textarea... not sure why
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      setIsEditing(false);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsEditing(false);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = event.target;
    const value = target.value;
    onNodeDataUpdate(id, { description: value === "" ? undefined : value });
    resizeTextarea(target);
  };

  return (
    <div
      className={`nopan relative text-s ${selected ? "cursor-move" : "cursor-pointer"}`}
    >
      <div
        className={`w-40 min-h-24 p-2 border-2 border-dashed ${
          // TODO: when note is selected, the bg is transparent, so the underlying content is visible... it's weird
          selected
            ? "border-blue-500 bg-blue-500/10"
            : "border-gray-400 bg-yellow-100 dark:bg-yellow-900/20"
        }`}
      >
        {/* Description section */}
        {isEditing ? (
          <textarea
            ref={inputRef}
            value={data.description || ""}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`h-auto overflow-hidden px-1 m-0 text-gray-600 dark:text-gray-400 leading-relaxed bg-transparent border-none outline-none w-full resize-none min-h-[3rem] ${isEditing ? "nodrag" : ""}`}
            placeholder="Enter note content"
            spellCheck={false}
            autoFocus={isEditing}
          />
        ) : (
          <div
            // TODO: same hover colors as edge labels... but bg is yellow... do better?
            className="px-1 text-gray-600 dark:text-gray-400 leading-relaxed  hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            onClick={isEditing ? undefined : handleClick}
          >
            {data.description || (
              <span className="text-gray-400 italic">
                Click to edit note...
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * NOTE: 7px is a hack to make it exact height... may need adjusting
 */
function resizeTextarea(target: HTMLTextAreaElement) {
  target.style.height = `${target.scrollHeight - 7}px`;
}
