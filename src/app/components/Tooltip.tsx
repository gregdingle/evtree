interface TooltipProps {
  text: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * See also .tooltip class in globals.css.
 */
export default function Tooltip({
  text,
  children,
  className = "",
}: TooltipProps) {
  return (
    <div className={`relative group ${className}`}>
      {children}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 text-xs bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
        {text}
      </div>
    </div>
  );
}
