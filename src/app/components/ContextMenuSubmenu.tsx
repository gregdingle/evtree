import { useState } from "react";

interface ContextMenuSubmenuProps {
  title: string;
  icon: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
}

export function ContextMenuSubmenu({
  title,
  icon,
  disabled = false,
  children,
}: ContextMenuSubmenuProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`${
          disabled ? "opacity-50" : ""
        } flex w-full cursor-default items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700`}
      >
        {icon}
        {title}
        <span className="ml-auto text-xs">▶</span>
      </div>

      {isHovered && !disabled && (
        <div
          className="absolute -top-1 left-full ml-0 rounded border border-gray-300 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
          style={{ minWidth: "180px", zIndex: 1001 }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}
