"use client";

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

  // Chevron direction based on side and collapse state
  const getChevron = () => {
    if (isLeft) {
      return isCollapsed ? "»" : "«";
    } else {
      return isCollapsed ? "«" : "»";
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={buttonClasses}
        aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
      >
        {/* TODO: proper icon for collapse/expand */}
        {getChevron()}
      </button>

      {/* Panel content */}
      <div className={`${isCollapsed ? "w-0" : "w-full"} overflow-hidden`}>
        {!isCollapsed && children}
      </div>
    </div>
  );
}
