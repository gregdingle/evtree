"use client";

import React from "react";
import Tooltip from "./Tooltip";

export interface ToolbarButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  tooltip?: string | React.ReactNode;
  active?: boolean;
}

// TODO: do disabled state, like no paste without copy
export function ToolbarButton({
  onClick,
  children,
  tooltip,
  active = false,
}: ToolbarButtonProps) {
  if (tooltip) {
    return (
      <Tooltip text={tooltip}>
        <button
          onClick={onClick}
          className={`flex items-center gap-1 rounded px-2 py-1 ${
            active
              ? "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              : "hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600"
          }`}
        >
          {children}
        </button>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded px-2 py-1 ${
        active
          ? "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
          : "hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600"
      }`}
    >
      {children}
    </button>
  );
}
