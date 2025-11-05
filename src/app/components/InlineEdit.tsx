import { useCallback, useEffect, useRef, useState } from "react";

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
    ? "resize-none overflow-hidden text-center py-0.5 relative top-1.5"
    : "px-0.5 py-0 text-center";
  const defaultDisplayClassName = multiline
    ? "hover:bg-gray-100 dark:hover:bg-gray-700 rounded break-words py-0.5 whitespace-pre-wrap cursor-pointer"
    : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1.5 py-0.5 -mx-1 rounded";

  const finalInputClassName = inputClassName ?? defaultInputClassName;
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

  const handleClick = () => {
    setEditingValue(value ?? "");
    setIsEditing(true);
  };

  const commitValue = () => {
    const trimmedValue = editingValue.trim();
    onCommit(trimmedValue === "" && !allowEmpty ? undefined : editingValue);
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
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setEditingValue(event.target.value);
    if (
      multiline &&
      handleTextareaResize &&
      event.target instanceof HTMLTextAreaElement
    ) {
      handleTextareaResize(event.target);
    }
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={textareaRef}
          value={editingValue}
          onChange={handleChange}
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
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className={finalInputClassName}
        style={{
          // NOTE: dynamically size input to fit content
          width: `${Math.max(3, editingValue.length + 1)}ch`,
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
