"use client";

import React, { useEffect, useRef, useState } from "react";

import { CheckIcon } from "@heroicons/react/24/outline";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { keys, toPairs, values } from "es-toolkit/compat";

import { Tooltip } from "./Tooltip";

export interface ToolbarButtonProps {
  onButtonClick: (dropdownKey?: string) => void;
  children: React.ReactNode;
  tooltip?: string | React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  dropdownItems?:
    | Record<string, string> // options
    | Record<string, { label: string; onClick: () => void }>; // actions
}

/**
 * When dropdownItems are provided, the button gains a down chevron that opens a
 * dropdown menu. When dropdownItems are strings, they are treated as options
 * that modify the action of the main button. When dropdownItems are objects
 * with onClick handlers, they are treated as actions that perform an action
 * immediately.
 *
 * @see https://tailwindcss.com/plus/ui-blocks/application-ui/elements/button-groups#component-bfc7e9cc9d7b5762cb139096ac3266c1
 */
export function ToolbarButton({
  onButtonClick,
  children,
  tooltip,
  active = false,
  disabled = false,
  dropdownItems = {},
}: ToolbarButtonProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const firstDropdownKey = keys(dropdownItems)[0];
  const [dropdownKey, setDropdownKey] = useState<string | undefined>(
    // TODO: is this a good way to set initial dropdown key?
    // does it assume static dropdownItems?
    // what is the selected option is set outside the component?
    firstDropdownKey,
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    if (!disabled) {
      onButtonClick(dropdownKey);
      setIsDropdownOpen(false);
    }
  };

  const handleDropdownToggle = () => {
    if (!disabled) {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  const handleDropdownItemClick = (key: string, onClick?: () => void) => {
    setDropdownKey(key);

    if (onClick) {
      // action item
      onClick();
      // TODO: make dropdown fade out smoothly so user can see selection
      setIsDropdownOpen(false);
    } else {
      // option item
      if (active) {
        // NOTE: allow live toggle between options of an active modal button
        onButtonClick(key);
      }
    }
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

  const hasActionItems =
    firstDropdownKey &&
    typeof dropdownItems[firstDropdownKey] === "object" &&
    "onClick" in dropdownItems[firstDropdownKey];

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
              onClick={hasActionItems ? handleDropdownToggle : handleClick}
              disabled={disabled}
              className={`${getButtonClasses()} rounded-l rounded-r-none`}
            >
              {children}
              {hasActionItems && (
                <ChevronDownIcon className="h-4 w-4 stroke-gray-700 dark:stroke-gray-100" />
              )}
            </button>
          </Tooltip>
          {!hasActionItems && (
            <button
              onClick={handleDropdownToggle}
              disabled={disabled}
              className={`${getButtonClasses()} rounded-l-none rounded-r`}
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
            >
              <ChevronDownIcon className="-mx-1 h-4 w-4 stroke-gray-700 dark:stroke-gray-100" />
            </button>
          )}
        </div>
        {isDropdownOpen && (
          <div
            // TODO: consolidate menu styles somewhere. see also ContextMenu.tsx and LeftSidePanel.tsx
            className="absolute top-full right-0 z-50 mt-1 w-fit bg-white py-1 shadow-lg dark:bg-gray-800"
            role="menu"
          >
            {toPairs(dropdownItems).map(([key, label]) => {
              const isActionItem =
                typeof label === "object" && "onClick" in label;
              return (
                <button
                  key={key}
                  onClick={() =>
                    handleDropdownItemClick(
                      key,
                      isActionItem ? label.onClick : undefined,
                    )
                  }
                  className={`block w-full px-2 py-2 text-left whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-700`}
                  role="menuitem"
                >
                  {!isActionItem && (
                    <CheckIcon
                      className={`inline-block ${dropdownKey === key ? "" : "invisible"} h-5 w-5 stroke-gray-700 align-text-bottom dark:stroke-gray-100`}
                    />
                  )}
                  <span className="mx-1 text-gray-700 dark:text-gray-200">
                    {isActionItem ? label.label : label}
                  </span>
                </button>
              );
            })}
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
