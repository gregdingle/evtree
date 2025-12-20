// Background colors
// NOTE: codes are CSS color values

export const BACKGROUNDS = {
  // HACK: use empty string key for nice display of default
  // ... I may regret this later
  "": { code: "", name: "- Default -" },
  white: {
    code: "white",
    name: "White",
  },
  // HACK: transparent just effects image export
  transparent: {
    code: "transparent",
    name: "Transparent",
  },
} as const;

export type BackgroundColorCode = keyof typeof BACKGROUNDS;
