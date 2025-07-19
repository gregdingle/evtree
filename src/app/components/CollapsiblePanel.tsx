"use client";

import { useState } from "react";

interface CollapsiblePanelProps {
  children: React.ReactNode;
}

export default function CollapsiblePanel({ children }: CollapsiblePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -left-4 top-6 w-4 h-6 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-l-md transition-colors border-l border-t border-b bg-white dark:bg-gray-900 flex items-center justify-center"
        aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
      >
        {/* TODO: proper icon for collapse/expand */}
        {isCollapsed ? "«" : "»"}
      </button>

      {/* Panel content */}
      <div className={`${isCollapsed ? "w-0" : "w-full"}`}>{children}</div>
    </div>
  );
}
