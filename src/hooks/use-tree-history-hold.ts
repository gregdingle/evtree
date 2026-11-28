import { useEffect, useRef } from "react";

import { pauseTreeHistory, resumeTreeHistory } from "./use-tree-store";

/**
 * Returns handlers for a text field that updates the tree on every key, so
 * that all that is typed in the field, from when it gets focus until it
 * loses it, is one undo step.
 *
 * NOTE: why not a step for each key, or for each word? Undo in the app takes
 * back an edit to the tree. While a field has focus, Cmd+Z is left to the
 * browser, which takes back typing, see the hotkeys in Toolbar.tsx.
 *
 * NOTE: a field can go away while it has focus, like the text of a note when
 * Enter is pressed, and then it gets no blur. So the history is also taken up
 * when the field is removed.
 */
export function useTreeHistoryHold() {
  const isHolding = useRef(false);
  useEffect(
    () => () => {
      if (isHolding.current) {
        resumeTreeHistory();
      }
    },
    [],
  );
  return {
    onFocus: () => {
      isHolding.current = true;
      pauseTreeHistory();
    },
    onBlur: () => {
      isHolding.current = false;
      resumeTreeHistory();
    },
  };
}
