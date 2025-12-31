// TODO: change to use tailwind plus input: https://tailwindcss.com/plus/ui-blocks/application-ui/forms/input-groups
// TODO: should PropertyInputProps inherit from
import React from "react";

import { InformationCircleIcon } from "@heroicons/react/24/outline";

import Tooltip from "./Tooltip";

// React.InputHTMLAttributes<HTMLInputElement>? how to handle textarea?
interface PropertyInputProps {
  label: string;
  value?: string;
  checked?: boolean; // For checkbox type
  // TODO: consider swithing to tailwind input that has right help icon. see:
  // https://tailwindcss.com/plus/ui-blocks/application-ui/forms/input-groups#component-474bd025b849b44eb3c46df09a496b7a
  info?: string;
  // TODO: consider switching to tailwind input that has right hint. see:
  // https://tailwindcss.com/plus/ui-blocks/application-ui/forms/input-groups#component-cd2d41bc1bca37b76acacab5925d507c
  optional?: boolean;
  textarea?: boolean; // Optional prop to indicate if this is a textarea
  select?: boolean; // Optional prop to indicate if this is a select
  checkbox?: boolean; // Optional prop to indicate if this is a checkbox
  options?: Array<{ value: string; label: string }>; // Options for select
  onChange?: (value: string) => void;
  onCheckboxChange?: (checked: boolean) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  step?: number; // for type "number"
  children?: React.ReactNode;
}

// TODO: change to use tailwind plus input: https://tailwindcss.com/plus/ui-blocks/application-ui/forms/input-groups
// TODO: we also want to support more kinds of numeric input like 1.0M
const PropertyInput = React.forwardRef<HTMLInputElement, PropertyInputProps>(
  (
    {
      label,
      value,
      checked,
      info,
      optional,
      onChange,
      onCheckboxChange,
      textarea,
      select,
      checkbox,
      options,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div className={`my-4 flex flex-wrap items-center space-x-2`}>
        <label
          htmlFor={label}
          // TODO: try to adjust width to fit all labels without line breaks?
          className={`w-20 select-none ${disabled ? "" : "cursor-pointer"}`}
        >
          <span
            title={info}
            className={textarea || checkbox ? `whitespace-pre` : ""}
          >
            {label}
          </span>
          <div
            // NOTE: assumes textarea and select are on next line
            className={`text-xs text-gray-500 ${textarea || select ? "inline pl-2" : "block"}`}
          >
            {optional ? "(optional)" : ""}
          </div>
        </label>
        {checkbox ? (
          <input
            ref={ref}
            id={label}
            type="checkbox"
            checked={checked ?? false}
            onInput={(e) => onCheckboxChange?.(e.currentTarget.checked)}
            disabled={disabled}
            className="h-5 w-5 flex-1/4 cursor-pointer"
            {...props}
          />
        ) : textarea ? (
          <>
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              id={label}
              value={value ?? ""}
              onInput={(e) => onChange?.(e.currentTarget.value)}
              disabled={disabled}
              className={`min-w-0 flex-3/4 rounded-md p-1 ${disabled ? "border-0" : "border-2"}`}
              rows={4}
              {...props}
            />
            {info && (
              <Tooltip
                text={info}
                position="left"
                className="cursor-pointer pl-1 not-italic"
              >
                <InformationCircleIcon className="h-6 w-6 text-gray-500" />
              </Tooltip>
            )}
          </>
        ) : select ? (
          <select
            ref={ref as React.Ref<HTMLSelectElement>}
            id={label}
            value={value ?? ""}
            onInput={(e) => onChange?.(e.currentTarget.value)}
            disabled={disabled}
            className={`min-w-0 flex-1/4 rounded-md p-1 ${
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
            type={props.type || "text"}
            value={value ?? ""}
            onInput={(e) => onChange?.(e.currentTarget.value)}
            disabled={disabled}
            className={`min-w-0 flex-1/4 rounded-md p-1 ${
              disabled ? "border-0" : "border-2"
            }`}
            spellCheck={false}
            {...props}
          />
        )}
        {info && !textarea && (
          <Tooltip
            text={info}
            position="left"
            className="inline-block cursor-pointer pl-1 not-italic"
          >
            <InformationCircleIcon className="h-6 w-6 text-gray-500" />
          </Tooltip>
        )}
        {children}
      </div>
    );
  },
);

PropertyInput.displayName = "PropertyInput";

export default PropertyInput;
