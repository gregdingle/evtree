import { createContext, useContext } from "react";

import { selectShowEVs } from "@/lib/selectors";

import { useStore } from "./use-store";

export interface TreeCanvasMode {
  /**
   * Nothing on the canvas can be edited, because the screen is too small or
   * because the canvas is a static view
   */
  isReadOnly: boolean;
  /** The canvas is a static view of part of a tree, like SubTreeView */
  isStatic: boolean;
  /**
   * The ids of edges to show without a probability, like the branch that leads
   * into a SubTreeView, whose probability plays no part there
   */
  withoutProbabilityIds: ReadonlySet<string>;
}

export const NO_IDS: ReadonlySet<string> = new Set();

export const TreeCanvasContext = createContext<TreeCanvasMode>({
  isReadOnly: false,
  isStatic: false,
  withoutProbabilityIds: NO_IDS,
});

/**
 * How the surrounding TreeCanvas is shown, for the node and edge components
 */
export function useTreeCanvas(): TreeCanvasMode {
  return useContext(TreeCanvasContext);
}

/**
 * Whether the nodes and edges of the surrounding TreeCanvas show what is
 * computed from the tree: expected values, path probabilities, and the fading
 * of paths that cannot happen
 */
export function useShowEVs(): boolean {
  const { isReadOnly, isStatic } = useTreeCanvas();
  const showEVs = useStore(selectShowEVs);
  // NOTE: a static view is plain, because the text around it has the numbers
  if (isStatic) {
    return false;
  }
  // NOTE: Responsive design! No toolbar for below medium size screens, so always showEVs
  return showEVs || isReadOnly;
}
