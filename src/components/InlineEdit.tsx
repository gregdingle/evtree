import { useCallback, useEffect, useRef, useState } from "react";

import { useTreeCanvas } from "@/hooks/use-tree-canvas";

interface InlineEditProps {
  value: string | undefined;
  onCommit: (value: string | undefined) => void;
  displayFormatter?: (value: string | undefined) => string;
  placeholder?: string;
  multiline?: boolean;
  inputClassName?: string;
  displayClassName?: string;
  displayStyle?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  autoFocus?: boolean;
  allowEmpty?: boolean;
  children?: React.ReactNode;
}

/**
 * Reusable inline editing component for text fields.
 * Displays as clickable text that becomes an input when clicked.
 * Commits changes on blur or Enter key.
 * Cancels changes on Escape key.
 */
export function InlineEdit({
  value,
  onCommit,
  displayFormatter,
  placeholder = "???",
  multiline = false,
  inputClassName,
  displayClassName,
  displayStyle,
  inputStyle,
  autoFocus = true,
  allowEmpty = false,
  children,
}: InlineEditProps) {
  // Default classNames based on multiline mode
  const defaultInputClassName = multiline
    ? "resize-none overflow-hidden text-center px-px py-0.5 relative top-1.5"
    : "px-[3px] py-0 text-center";

  // QUESTION: change hover behavior for Responsive design Read-only mode?
  // NOTE: text-balance makes the lines of a wrapped label about the same
  // width, so that a short last line does not leave the first one wide enough
  // to run over the edge. Only for display: balanced text would move between
  // lines while typing, so the textarea wraps as usual.
  const defaultDisplayClassName = multiline
    ? "hover:bg-gray-100 dark:hover:bg-gray-700 rounded break-words py-0.5 whitespace-pre-wrap text-balance cursor-pointer"
    : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1.5 py-0.5 -mx-1 rounded";

  // NOTE: the same background while editing as on hover, so that the text
  // does not seem to change place when clicked
  const finalInputClassName = `${inputClassName ?? defaultInputClassName} rounded bg-gray-100 dark:bg-gray-700`;
  const finalDisplayClassName = displayClassName ?? defaultDisplayClassName;
  const [isEditing, setIsEditing] = useState(false);
  const [editingValue, setEditingValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  const handleTextareaResize = useCallback((target: HTMLTextAreaElement) => {
    // Reset height to recalculate
    target.style.height = "0px";
    // Set to scrollHeight
    target.style.height = target.scrollHeight + "px";
  }, []);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (isEditing && autoFocus) {
      if (multiline && textareaRef.current) {
        textareaRef.current.focus();
        handleTextareaResize(textareaRef.current);
      } else if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [isEditing, autoFocus, multiline, handleTextareaResize]);

  const { isReadOnly } = useTreeCanvas();

  const handleClick = () => {
    // NOTE: Responsive design! Read-only mode for below medium size screens,
    // and for static views
    if (isReadOnly) {
      return;
    }
    const displayed = displayFormatter
      ? displayFormatter(value)
      : (value ?? placeholder);
    const shouldClearInput = displayed === placeholder;
    setEditingValue(shouldClearInput ? "" : (value ?? ""));
    setIsEditing(true);
  };

  const commitValue = () => {
    const trimmedValue = editingValue.trim();
    onCommit(trimmedValue === "" && allowEmpty ? undefined : trimmedValue);
    setIsEditing(false);
  };

  const handleBlur = () => {
    commitValue();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      // Enter without Shift commits (for multiline, Shift+Enter adds line break)
      event.preventDefault();
      commitValue();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsEditing(false);
    }
  };

  const handleChange = (
    event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setEditingValue(event.currentTarget.value);
    if (
      multiline &&
      handleTextareaResize &&
      event.currentTarget instanceof HTMLTextAreaElement
    ) {
      handleTextareaResize(event.currentTarget);
    }
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={textareaRef}
          value={editingValue}
          onInput={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className={finalInputClassName}
          style={inputStyle}
        />
      );
    }

    return (
      <input
        ref={inputRef}
        type="text"
        value={editingValue}
        onInput={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className={finalInputClassName}
        style={{
          // NOTE: dynamically size input to fit content
          // NOTE: plus the 1px of padding on each side beyond the 1ch of slack
          width: `calc(${Math.max(3, editingValue.length + 1)}ch + 2px)`,
          ...inputStyle,
        }}
      />
    );
  }

  return (
    <div
      onClick={handleClick}
      className={finalDisplayClassName}
      style={displayStyle}
    >
      {displayFormatter ? displayFormatter(value) : (value ?? placeholder)}
      {children}
    </div>
  );
}
