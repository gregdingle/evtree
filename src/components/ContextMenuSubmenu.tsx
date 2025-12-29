import { useEffect, useRef, useState } from "react";

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
  const [openUpwards, setOpenUpwards] = useState(false);
  const submenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // NOTE: see also similar logic in use-context-menu.ts
  useEffect(() => {
    if (isHovered && submenuRef.current && triggerRef.current) {
      const submenuRect = submenuRef.current.getBoundingClientRect();
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Check if submenu would go off the bottom of the screen with buffer
      const wouldGoOffBottom = submenuRect.bottom + 100 > viewportHeight;

      // Check if there's enough space above
      const spaceAbove = triggerRect.top;
      const submenuHeight = submenuRect.height;
      const hasSpaceAbove = spaceAbove >= submenuHeight;

      // TODO: should we fix this lint warning?
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenUpwards(wouldGoOffBottom && hasSpaceAbove);
    }
  }, [isHovered]);

  return (
    <div
      ref={triggerRef}
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={(e) => e.preventDefault()}
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
          ref={submenuRef}
          className={`absolute left-full ml-0 rounded border border-gray-300 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800 ${
            openUpwards ? "bottom-0" : "-top-1"
          }`}
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
