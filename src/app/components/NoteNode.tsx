import { useEffect, useRef, useState } from "react";

import { Handle, NodeProps, Position } from "@xyflow/react";

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
      className={`nopan group relative text-s ${selected ? "cursor-move" : "cursor-pointer"}`}
    >
      <div
        // NOTE: border-dashed should match the strokeDasharray of ArrowEdge
        className={`w-48 min-h-12 p-2 border-2 border-dashed ${
          // TODO: when note is selected, the bg is transparent, so the underlying content is visible... it's weird
          selected
            ? "border-blue-500 bg-blue-500/10"
            : "border-gray-400 bg-yellow-100 dark:bg-yellow-900/20"
        }`}
      >
        {/* Handles for creating arrow edges */}
        <Handle
          type="source"
          position={Position.Right}
          isConnectableStart={true}
          isConnectableEnd={false}
          id={`${id}-right`}
          className="opacity-0 group-hover:opacity-100"
        />
        <Handle
          type="source"
          position={Position.Left}
          isConnectableStart={true}
          isConnectableEnd={false}
          id={`${id}-left`}
          className="opacity-0 group-hover:opacity-100"
        />
        <Handle
          type="source"
          position={Position.Top}
          isConnectableStart={true}
          isConnectableEnd={false}
          id={`${id}-top`}
          className="opacity-0 group-hover:opacity-100"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectableStart={true}
          isConnectableEnd={false}
          id={`${id}-bottom`}
          className="opacity-0 group-hover:opacity-100"
        />

        {/* Description section */}
        {isEditing ? (
          <textarea
            ref={inputRef}
            defaultValue={data.description || ""}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            // NOTE: pb-1 is needed for textarea to not cut off descenders on last row of text
            className={`h-auto overflow-hidden px-1 pb-1 m-0 text-gray-600 dark:text-gray-400 leading-snug bg-transparent border-none outline-none w-full resize-none ${isEditing ? "nodrag" : ""}`}
            placeholder="Enter note content"
            spellCheck={false}
            // NOTE: autoFocus needed when node is not selected
            autoFocus={true}
            // NOTE: onFocus needed because autoFocus
            onFocus={(event) => {
              // NOTE: sets cursor to end of text
              const length = event.target.value.length;
              event.target.setSelectionRange(length, length);
            }}
          />
        ) : (
          <div
            // TODO: same hover colors as edge labels... but bg is yellow... do better?
            // NOTE: whitespace-pre-wrap is important for manual new lines
            className="px-1 pb-1 text-gray-600 dark:text-gray-400 leading-snug  hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer whitespace-pre-wrap"
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
  // Reset height to recalculate
  target.style.height = "0px";
  // Set to scrollHeight
  target.style.height = `${target.scrollHeight - 7}px`;
}

export function GhostNode({}: NodeProps<AppNode>) {
  return (
    <div className="nopan cursor-move w-4 h-4">
      &nbsp;
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="invisible !left-1/2 !translate-x-1/2"
      />
    </div>
  );
}
