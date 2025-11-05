// Top currency codes with their symbols

export const CURRENCIES = {
  // HACK: use empty string key for nice display of no currency (-)
  // ... I may regret this later
  "": { code: "", symbol: "", name: "No Currency -" },
  USD: { code: "USD", symbol: "$", name: "US Dollar" },
  EUR: { code: "EUR", symbol: "€", name: "Euro" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound" },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee" },
  CAD: { code: "CAD", symbol: "$", name: "Canadian Dollar" },
  AUD: { code: "AUD", symbol: "$", name: "Australian Dollar" },
  CHF: { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  BRL: { code: "BRL", symbol: "$", name: "Brazilian Real" },
} as const;

export type Currency = keyof typeof CURRENCIES;
