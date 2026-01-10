"use client";

let arrangeFadeTimeoutId: number | null = null;
let arrangeAnimationTimeoutId: number | null = null;

/**
 * NOTE: Why imperative control of animation instead of React? This animation is
 * a cross-cutting, UI-only side effect that needs tight timing relative to a
 * big layout mutation (lots of nodes/edges changing). Keeping it imperative
 * reduces coupling, avoids undo/redo implications, and makes “start animation
 * immediately” more robust.
 */
export function withArrangeAnimation(run: () => void) {
  if (typeof window === "undefined") {
    console.warn("[EVTree] Cannot run animation outside of browser");
    run();
    return;
  }
  const wrapper = window.document.querySelector(".evtree");
  if (!(wrapper instanceof HTMLElement)) {
    console.warn(
      '[EVTree] Cannot find ".evtree" wrapper element. Skipping animation.',
    );
    run();
    return;
  }

  // Fade should be quick even if the move animation is long.
  const arrangeMs = 500;
  const fadeMs = 250;

  wrapper.style.setProperty("--evtree-arrange-move-ms", `${arrangeMs}ms`);
  wrapper.style.setProperty("--evtree-arrange-fade-ms", `${fadeMs}ms`);
  wrapper.classList.add("evtree--arranging");

  // Prevent any concurrent animations
  if (arrangeFadeTimeoutId !== null) {
    window.clearTimeout(arrangeFadeTimeoutId);
  }
  if (arrangeAnimationTimeoutId !== null) {
    window.clearTimeout(arrangeAnimationTimeoutId);
  }

  // Run after a paint boundary so the transition styles are applied by browser
  // before node positions state update.
  window.requestAnimationFrame(() => {
    // First let edges fade out, then apply the new layout while hidden.
    arrangeFadeTimeoutId = window.setTimeout(() => {
      arrangeFadeTimeoutId = null;

      // Run state change to rearrange nodes
      run();

      // Keep edges hidden during the move; then fade back in.
      arrangeAnimationTimeoutId = window.setTimeout(() => {
        const container = window.document.querySelector(".evtree");
        if (container instanceof HTMLElement) {
          container.classList.remove("evtree--arranging");
        } else {
          console.warn(
            '[EVTree] Cannot find ".evtree" wrapper element to remove arranging class.',
          );
        }
        arrangeAnimationTimeoutId = null;
      }, arrangeMs);
    }, fadeMs);
  });
}
