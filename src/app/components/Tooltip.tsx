interface TooltipProps {
  text: string | React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
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
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div className={`relative group ${className}`}>
      {children}
      <div
        className={`absolute ${positionClasses[position]} z-50 whitespace-pre transform px-2 py-1 text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none`}
      >
        {text}
      </div>
    </div>
  );
}
