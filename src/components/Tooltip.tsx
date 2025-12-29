interface TooltipProps {
  text: string | React.ReactNode;
  position?: "top" | "bottom" | "left" | "right" | "bottomright";
  className?: string;
  children: React.ReactNode;
}

/**
 * See also .tooltip class in globals.css.
 */
export default function Tooltip({
  text,
  position = "bottom",
  children,
  className = "",
}: TooltipProps) {
  if (!text) {
    return <>{children}</>;
  }

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
    bottomleft: "top-full right-0 mt-2",
    bottomright: "top-full left-0 mt-2",
  };

  return (
    <div className={`group relative ${className}`}>
      {children}
      <div
        className={`absolute ${positionClasses[position]} pointer-events-none z-50 transform rounded bg-gray-900 px-2 py-1 text-sm whitespace-pre text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-100 dark:text-gray-900`}
      >
        {text}
      </div>
    </div>
  );
}
