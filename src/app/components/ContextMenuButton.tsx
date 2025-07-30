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
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${
        disabled ? "opacity-50" : ""
      } flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700`}
    >
      {children}
    </button>
  );
}
