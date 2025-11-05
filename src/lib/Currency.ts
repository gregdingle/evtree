// Top currency codes with their symbols

export const CURRENCIES = {
  // HACK: use empty string key for nice display of no currency (-)
  // ... I may regret this later
  // NOTE: In the United States, Mexico, Australia, Argentina, Chile, Colombia,
  // New Zealand, Hong Kong, Pacific Island nations, and English-speaking
  // Canada, the sign is written before the number ("$5")
  "": { code: "", symbol: "", name: "No Currency -", before: false },
  USD: { code: "USD", symbol: "$", name: "US Dollar", before: true },
  EUR: { code: "EUR", symbol: "€", name: "Euro", before: false },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", before: true },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", before: true },
  CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan", before: true },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", before: true },
  CAD: { code: "CAD", symbol: "$", name: "Canadian Dollar", before: true },
  AUD: { code: "AUD", symbol: "$", name: "Australian Dollar", before: true },
  CHF: { code: "CHF", symbol: "CHF", name: "Swiss Franc", before: false },
  BRL: { code: "BRL", symbol: "$", name: "Brazilian Real", before: true },
} as const;

export type Currency = keyof typeof CURRENCIES;
