import { useEffect, useRef, useState } from "react";

import { Handle, NodeProps, Position } from "@xyflow/react";

import { useTreeHistoryHold } from "@/hooks/use-tree-history-hold";
import { useTreeStore } from "@/hooks/use-tree-store";
import { AppNode } from "@/lib/node";

export const NoteNode = ({ data, selected, id, width }: NodeProps<AppNode>) => {
  // Local state for inline editing
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { updateNodeData } = useTreeStore.getState();
  // NOTE: the text updates the tree on every key, and is one undo step
  const historyHold = useTreeHistoryHold();

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
    setIsEditing(false);
    historyHold.onBlur();
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

  const handleChange = (event: React.InputEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    const value = target.value;
    updateNodeData(id, { description: value === "" ? undefined : value });
    resizeTextarea(target);
  };

  // NOTE: width is optional prop, if not provided, use default width of 192px, w-48
  // NOTE: node.width comes from node.measured after first render, or input value
  const noteWidth = width ? `w-[${width}px]` : "w-[192px]";

  return (
    <div
      // NOTE: opaque canvas-colored base so the translucent note colors don't
      // show underlying nodes, edges and labels. Notes are on top of those.
      // NOTE: see .react-flow__node-note in src/app/globals.css
      className={`nopan group relative bg-amber-50 dark:bg-neutral-900 ${selected ? "cursor-move" : "cursor-pointer"}`}
    >
      <div
        // NOTE: border-dashed should match the strokeDasharray of ArrowEdge
        className={`min-h-12 ${noteWidth} border-2 border-dashed bg-yellow-100 p-2 dark:bg-yellow-900/20 ${
          selected ? "border-blue-500" : "border-gray-400"
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
            // NOTE: see https://stackoverflow.com/questions/38256332/in-react-whats-the-difference-between-onchange-and-oninput
            onInput={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            // NOTE: pb-1 is needed for textarea to not cut off descenders on last row of text
            className={`m-0 h-auto w-full resize-none overflow-hidden border-none bg-transparent px-1 pb-1 leading-snug text-gray-600 outline-none dark:text-gray-400 ${isEditing ? "nodrag" : ""}`}
            placeholder="Enter note content"
            spellCheck={false}
            // NOTE: autoFocus needed when node is not selected
            autoFocus={true}
            // NOTE: onFocus needed because autoFocus
            onFocus={(event) => {
              historyHold.onFocus();
              // NOTE: sets cursor to end of text
              const length = event.target.value.length;
              event.target.setSelectionRange(length, length);
            }}
          />
        ) : (
          <div
            // QUESTION: same hover colors as edge labels... but bg is yellow... do better?
            // NOTE: whitespace-pre-wrap is important for manual new lines
            className="cursor-pointer px-1 pb-1 leading-snug whitespace-pre-wrap  text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
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
    <div className="nopan h-4 w-4 cursor-move">
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
