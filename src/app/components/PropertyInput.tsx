// TODO: change to use tailwind plus input: https://tailwindcss.com/plus/ui-blocks/application-ui/forms/input-groups
// TODO: should PropertyInputProps inherit from
import React from "react";

import { InformationCircleIcon } from "@heroicons/react/24/outline";

import Tooltip from "./Tooltip";

// React.InputHTMLAttributes<HTMLInputElement>? how to handle textarea?
interface PropertyInputProps {
  label: string;
  value?: string;
  info?: string;
  optional?: boolean;
  textarea?: boolean; // Optional prop to indicate if this is a textarea
  select?: boolean; // Optional prop to indicate if this is a select
  options?: Array<{ value: string; label: string }>; // Options for select
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  inlineButton?: boolean;
  children?: React.ReactNode;
}

// TODO: change to use tailwind plus input: https://tailwindcss.com/plus/ui-blocks/application-ui/forms/input-groups
// TODO: we also want to support more kinds of numeric input like 1.0M
const PropertyInput = React.forwardRef<HTMLInputElement, PropertyInputProps>(
  (
    {
      label,
      value,
      info,
      optional,
      onChange,
      textarea,
      select,
      options,
      disabled,
      children,
      inlineButton,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        className={`mb-2 flex flex-wrap space-x-2 ${
          textarea ? "flex-col" : "items-center"
        }`}
      >
        <label
          htmlFor={label}
          // TODO: try to adjust width to fit all labels without line breaks?
          className={`w-20 select-none ${disabled ? "" : "cursor-pointer"}`}
        >
          {label}
          <div
            // NOTE: assumes textarea and select are on next line
            className={`text-xs text-gray-500 ${textarea || select ? "inline pl-2" : "block"}`}
          >
            {optional ? "(optional)" : ""}
          </div>
        </label>
        {textarea ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            id={label}
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            className={`min-w-0 rounded-md p-1 ${disabled ? "border-0" : "border-2"}`}
            rows={4}
            {...props}
          />
        ) : select ? (
          <select
            ref={ref as React.Ref<HTMLSelectElement>}
            id={label}
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            className={`block min-w-0 rounded-md p-1 ${
              disabled ? "border-0" : "border-2"
            }`}
          >
            {options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={ref}
            id={label}
            type="text"
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            className={`min-w-0 rounded-md p-1 ${
              disabled ? "border-0" : "border-2"
            }
            ${inlineButton ? "flex-1/4" : "flex-1/4"}
            `}
            spellCheck={false}
            {...props}
          />
        )}
        {children}
        {info && (
          <Tooltip
            text={info}
            position="left"
            className="inline-block pl-1 cursor-pointer"
          >
            <InformationCircleIcon className="h-6 w-6 text-gray-500" />
          </Tooltip>
        )}
      </div>
    );
  },
);

PropertyInput.displayName = "PropertyInput";

export default PropertyInput;
