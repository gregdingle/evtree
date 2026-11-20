import { createContext, useContext } from "react";

/**
 * Called after any ContextMenuButton click, so every menu command closes the
 * menu, as is conventional. Provided by ContextMenu.
 */
export const ContextMenuCloseContext = createContext<(() => void) | undefined>(
  undefined,
);

interface ContextMenuButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function ContextMenuButton({
  onClick,
  disabled,
  children,
}: ContextMenuButtonProps) {
  const closeMenu = useContext(ContextMenuCloseContext);
  return (
    <button
      onClick={(event) => {
        // NOTE: important for preventing handlers on elements underneath context menu
        event.stopPropagation();
        onClick();
        closeMenu?.();
      }}
      disabled={disabled}
      className={`${
        disabled ? "opacity-50" : ""
      } flex w-full items-center gap-2 px-3 py-2 text-left whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-700`}
    >
      {children}
    </button>
  );
}
