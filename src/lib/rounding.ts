// Top rounding standards
// See https://www.antidote.info/en/blog/reports/millions-billions-and-other-large-numbers

export const ROUNDING = {
  // HACK: use empty string key for nice display of no rouding (-)
  // ... I may regret this later
  "": { code: "", name: "- No Rounding - ", scale: undefined },
  US: {
    code: "US",
    name: "USA",
    scale: {
      K: 1000,
      M: 1000000,
      B: 1000000000,
      T: 1000000000000,
    } as Record<string, number>,
  },
  UK: {
    code: "UK",
    name: "UK",
    scale: {
      k: 1000,
      m: 1000000,
      bn: 1000000000,
      tn: 1000000000000,
    } as Record<string, number>,
  },
} as const;

export type RoundingCode = keyof typeof ROUNDING;
