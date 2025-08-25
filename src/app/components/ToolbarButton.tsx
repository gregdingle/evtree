"use client";

import React from "react";

import Tooltip from "./Tooltip";

export interface ToolbarButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  tooltip?: string | React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}

// TODO: do disabled state, like no paste without copy
export function ToolbarButton({
  onClick,
  children,
  tooltip,
  active = false,
  disabled = false,
}: ToolbarButtonProps) {
  const handleClick = () => {
    if (!disabled) {
      onClick();
    }
  };

  const getButtonClasses = () => {
    if (disabled) {
      return "flex items-center gap-1 rounded px-2 py-1 opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600 flex-shrink-0";
    }
    return `flex items-center gap-1 rounded px-2 py-1 flex-shrink-0 ${
      active
        ? "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
        : "hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600"
    }`;
  };

  if (tooltip) {
    return (
      <Tooltip text={tooltip}>
        <button
          onClick={handleClick}
          disabled={disabled}
          className={getButtonClasses()}
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
      className={getButtonClasses()}
    >
      {children}
    </button>
  );
}
