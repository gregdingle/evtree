// TODO: change to use tailwind plus input: https://tailwindcss.com/plus/ui-blocks/application-ui/forms/input-groups
// TODO: should PropertyInputProps inherit from
import React, { useEffect, useState } from "react";

import { debounce } from "es-toolkit";

// React.InputHTMLAttributes<HTMLInputElement>? how to handle textarea?
interface PropertyInputProps {
  label: string;
  value?: string;
  textarea?: boolean; // Optional prop to indicate if this is a textarea
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

// TODO: change to use tailwind plus input: https://tailwindcss.com/plus/ui-blocks/application-ui/forms/input-groups
// TODO: we also want to support more kinds of numeric input like 1.0M
const PropertyInput = React.forwardRef<HTMLInputElement, PropertyInputProps>(
  ({ label, value, onChange, textarea, disabled, children, ...props }, ref) => {
    const debouncedOnChange = debounce(onChange ?? (() => {}), 200);

    // Use a local state for immediate UI updates
    const [localValue, setLocalValue] = useState(value || "");

    // Update local value when prop value changes
    useEffect(() => {
      setLocalValue(value || "");
    }, [value]);

    const handleChange = (newValue: string) => {
      if (disabled) return;
      setLocalValue(newValue);
      debouncedOnChange(newValue);
    };

    return (
      <div
        className={`mb-2 flex space-x-2 ${
          textarea ? "flex-col" : "items-center"
        } ${children && !textarea ? "flex-nowrap" : "flex-wrap"}`}
      >
        <label htmlFor={label} className="w-20 cursor-pointer select-none">
          {label}
        </label>
        {textarea ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            id={label}
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className={`min-w-0 flex-grow rounded-md border-2 p-1 ${
              disabled
                ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                : ""
            }`}
            rows={8}
            {...props}
          />
        ) : (
          <input
            ref={ref}
            id={label}
            type="text"
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className={`min-w-0 flex-grow rounded-md border-2 p-1 ${
              disabled
                ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                : ""
            }`}
            {...props}
          />
        )}
        {children}
      </div>
    );
  },
);

PropertyInput.displayName = "PropertyInput";

export default PropertyInput;
