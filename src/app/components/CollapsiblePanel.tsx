"use client";

import { useState } from "react";

import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/solid";

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
  // NOTE: Responsive design! Encourage hiding panel on small screens by making button bigger
  const buttonClasses = `z-10 absolute top-6 w-8 h-12 md:w-4 md:h-6 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors bg-white dark:bg-gray-900 flex items-center justify-center ${
    isLeft
      ? "-right-8 md:-right-4 rounded-r-md border-r border-t border-b"
      : "-left-8 md:-left-4 rounded-l-md border-l border-t border-b"
  }`;

  const ChevronIcon = () => {
    // NOTE: Responsive design! Encourage hiding panel on small screens by making button bigger
    if (isLeft) {
      return isCollapsed ? (
        <ChevronDoubleRightIcon className="h-6 w-6 cursor-pointer md:h-4 md:w-4" />
      ) : (
        <ChevronDoubleLeftIcon className="h-6 w-6 cursor-pointer md:h-4 md:w-4" />
      );
    } else {
      return isCollapsed ? (
        <ChevronDoubleLeftIcon className="h-6 w-6 cursor-pointer md:h-4 md:w-4" />
      ) : (
        <ChevronDoubleRightIcon className="h-6 w-6 cursor-pointer md:h-4 md:w-4" />
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
