"use client";

import React from "react";
import Tooltip from "./Tooltip";

export interface ToolbarButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  tooltip?: string | React.ReactNode;
}

// TODO: do disabled state, like no paste without copy
export function ToolbarButton({
  onClick,
  children,
  tooltip,
}: ToolbarButtonProps) {
  if (tooltip) {
    return (
      <Tooltip text={tooltip}>
        <button
          onClick={onClick}
          className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 rounded"
        >
          {children}
        </button>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 rounded"
    >
      {children}
    </button>
  );
}
