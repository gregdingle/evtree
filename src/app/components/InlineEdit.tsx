import { useEffect, useRef, useState } from "react";

interface InlineEditProps {
  value: string | undefined;
  onCommit: (value: string | undefined) => void;
  displayFormatter?: (value: string | undefined) => string;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  inputClassName?: string;
  displayClassName?: string;
  displayStyle?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  autoFocus?: boolean;
  allowEmpty?: boolean;
  onResize?: (element: HTMLTextAreaElement) => void;
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
  className = "",
  inputClassName = "px-0.5 py-0",
  displayClassName = "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1.5 py-0.5 -mx-1 rounded",
  displayStyle,
  inputStyle,
  autoFocus = true,
  allowEmpty = false,
  onResize,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingValue, setEditingValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (isEditing && autoFocus) {
      if (multiline && textareaRef.current) {
        textareaRef.current.focus();
        if (onResize) {
          onResize(textareaRef.current);
        }
      } else if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [isEditing, autoFocus, multiline, onResize]);

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
    if (multiline && onResize && event.target instanceof HTMLTextAreaElement) {
      onResize(event.target);
    }
  };

  const displayValue = displayFormatter
    ? displayFormatter(value)
    : (value ?? placeholder);

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
          className={`${inputClassName} ${className}`}
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
        className={`${inputClassName} ${className}`}
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
      className={`${displayClassName} ${className}`}
      style={displayStyle}
    >
      {displayValue}
    </div>
  );
}
