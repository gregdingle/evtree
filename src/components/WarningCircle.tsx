import { ReactNode } from "react";

import { ExclamationCircleIcon } from "@heroicons/react/24/solid";

interface WarningCircleProps {
  tooltip: string;
  onClick?: (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => void;
}

/**
 * NOTE: see .evtree .tooltip CSS class for styling
 */
export function WarningCircle({
  tooltip,
  onClick,
}: WarningCircleProps): ReactNode {
  return (
    <span
      className="tooltip"
      // TODO: it doesn't always fix... if the sum of other
      // probabilities is >1, clicking this only sets it to 0%
      data-tooltip={tooltip}
    >
      <ExclamationCircleIcon
        onClick={onClick}
        className="-mt-1 ml-0.5 inline-block h-4 w-4 fill-red-600"
      />
    </span>
  );
}
