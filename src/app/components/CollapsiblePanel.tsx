"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

interface CollapsiblePanelProps {
  side: "left" | "right";
  children: React.ReactNode;
}

export default function CollapsiblePanel({
  side,
  children,
}: CollapsiblePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isLeft = side === "left";

  // Button positioning and styling based on side
  const buttonClasses = `z-50 absolute top-6 w-4 h-6 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors bg-white dark:bg-gray-900 flex items-center justify-center ${
    isLeft
      ? "-right-4 rounded-r-md border-r border-t border-b"
      : "-left-4 rounded-l-md border-l border-t border-b"
  }`;

  const ChevronIcon = () => {
    if (isLeft) {
      return isCollapsed ? (
        <ChevronRightIcon className="h-4 w-4 cursor-pointer" />
      ) : (
        <ChevronLeftIcon className="h-4 w-4 cursor-pointer" />
      );
    } else {
      return isCollapsed ? (
        <ChevronLeftIcon className="h-4 w-4 cursor-pointer" />
      ) : (
        <ChevronRightIcon className="h-4 w-4 cursor-pointer" />
      );
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={buttonClasses}
        aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
      >
        <ChevronIcon />
      </button>

      {/* Panel content */}
      <div className={`${isCollapsed ? "w-0" : "w-full"} overflow-hidden`}>
        {!isCollapsed && children}
      </div>
    </div>
  );
}
