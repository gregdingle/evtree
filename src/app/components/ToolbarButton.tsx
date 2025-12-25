"use client";

import React, { useEffect, useRef, useState } from "react";

import { CheckIcon } from "@heroicons/react/24/outline";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { keys, toPairs, values } from "es-toolkit/compat";

import Tooltip from "./Tooltip";

export interface ToolbarButtonProps {
  onClick: (dropdownKey?: string) => void;
  children: React.ReactNode;
  tooltip?: string | React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  dropdownItems?: Record<string, string>;
}

/**
 * @see https://tailwindcss.com/plus/ui-blocks/application-ui/elements/button-groups#component-bfc7e9cc9d7b5762cb139096ac3266c1
 */
export function ToolbarButton({
  onClick,
  children,
  tooltip,
  active = false,
  disabled = false,
  dropdownItems = {},
}: ToolbarButtonProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownKey, setDropdownKey] = useState<string | undefined>(
    // TODO: is this a good way to set initial dropdown key?
    // does it assume static dropdownItems?
    // what is the selected option is set outside the component?
    keys(dropdownItems)[0],
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    if (!disabled) {
      onClick(dropdownKey);
      setIsDropdownOpen(false);
    }
  };

  const handleDropdownToggle = () => {
    if (!disabled) {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  const handleDropdownItemClick = (key: string) => {
    setDropdownKey(key);
    // TODO: finish "menu type" button dropdown behavior
    if (active) {
      onClick(key);
    }

    // TODO: make dropdown fade out smoothly so user can see selection
    // setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      window.document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      window.document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const getButtonClasses = () => {
    if (disabled) {
      return "flex items-center gap-1 rounded px-2 py-1 opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600 flex-shrink-0 whitespace-nowrap select-none";
    }
    return `flex items-center gap-1 px-2 py-1 flex-shrink-0 whitespace-nowrap select-none
      hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600
    ${active ? "bg-gray-200 dark:bg-gray-600" : ""}`;
  };

  if (values(dropdownItems).length > 0) {
    return (
      <div
        className={`relative inline-flex rounded border border-transparent hover:border-gray-100 dark:hover:border-gray-700`}
        ref={dropdownRef}
      >
        <div className="inline-flex rounded">
          <Tooltip text={tooltip}>
            <button
              onClick={handleClick}
              disabled={disabled}
              className={`${getButtonClasses()} rounded-l rounded-r-none`}
            >
              {children}
            </button>
          </Tooltip>
          <button
            onClick={handleDropdownToggle}
            disabled={disabled}
            className={`${getButtonClasses()} rounded-r rounded-l-none`}
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
          >
            <ChevronDownIcon className="h-4 w-4 -mx-1 stroke-gray-700 dark:stroke-gray-100" />
          </button>
        </div>
        {isDropdownOpen && (
          <div
            // TODO: consolidate menu styles somewhere. see also ContextMenu.tsx and LeftSidePanel.tsx
            className="absolute right-0 top-full mt-1 py-1 dark:bg-gray-800 shadow-lg bg-white z-50"
          >
            <div className="py-1" role="menu">
              {toPairs(dropdownItems).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleDropdownItemClick(key)}
                  className={`block text-left px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap`}
                  role="menuitem"
                >
                  <CheckIcon
                    className={`inline-block ${dropdownKey === key ? "" : "invisible"} align-text-bottom h-5 w-5 stroke-gray-700 dark:stroke-gray-100`}
                  />
                  <span className="mx-1 text-gray-700 dark:text-gray-200">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tooltip) {
    return (
      <Tooltip text={tooltip}>
        <button
          onClick={handleClick}
          disabled={disabled}
          className={`${getButtonClasses()} rounded`}
        >
          {children}
        </button>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`${getButtonClasses()} rounded`}
    >
      {children}
    </button>
  );
}
