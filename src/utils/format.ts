import { trim } from "es-toolkit";
import HRNumbers from "human-readable-numbers";

import { CURRENCIES, CurrencyCode } from "@/lib/Currency";
import { normalizeExpression } from "@/lib/expectedValue";

/**
 * @see https://www.npmjs.com/package/human-readable-numbers
 *
 * TODO: how to get nice Minus sign (−): Used for mathematical operations (Unicode U+2212)
 */
export function formatValue(
  value: number | null | undefined,
  currencyCode: CurrencyCode,
): string {
  if (value === null || value === undefined) {
    return "";
  }

  // NOTE: we don't want SI prefixes for small values here
  if (Math.abs(value) < 1) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
      currency: currencyCode || undefined,
      style: currencyCode ? "currency" : "decimal",
    });
  }
  const humanized = HRNumbers.toHumanString(value);
  if (!currencyCode) {
    return humanized;
  }
  const currency = CURRENCIES[currencyCode];
  if (!currency) {
    console.error(`[EVTree] Unknown currency: ${currencyCode}`);
    return humanized;
  }
  if (currency.before) {
    if (value < 0) {
      // Move negative symbol before currency symbol
      return `-${currency.symbol}${trim(humanized, "-")}`;
    }
    return `${currency.symbol}${humanized}`;
  }
  // NOTE: put a half space here for humanized suffix like "M" or "K"
  return `${humanized} ${currency.symbol}`;
}

export function formatProbability(
  probability: number | null | undefined,
  sigDigits: number = 1,
  placeholder: string = "???",
  prefix: string = "P=",
): string {
  if (probability === null || probability === undefined) {
    return placeholder;
  }
  return (
    prefix +
    (100 * probability).toLocaleString(undefined, {
      minimumFractionDigits: sigDigits,
      maximumFractionDigits: sigDigits,
    }) +
    "%"
  );
}

/**
 * Wraps cost in parens and minus symbol so it works for expressions.
 *
 * @see https://graphicdesign.stackexchange.com/questions/68674/what-s-the-right-character-for-a-minus-sign
 */
export function formatCost(cost: string | number | undefined | null): string {
  if (cost === undefined || cost === null || cost == 0) {
    return "";
  }
  // NOTE: common case... no expression
  const num = Number(normalizeExpression(cost.toString()));
  if (Number.isFinite(num) && num >= 0) {
    return `-${cost}`;
  }
  // NOTE: use official minus sign for non-numeric costs... it just looks better
  // when prefixing the parens
  return `– (${cost})`;
}

/**
 * YYYY-MM-DD format (no timezone)
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (date === null || date === undefined) {
    return "";
  }
  if (typeof date === "string") {
    date = new Date(date);
  }
  return date.toISOString().split("T")[0]!;
}

export function formatValueLong(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Helper function to format numbers with 2 significant digits
 */
export const formatHistogramNumber = (
  num: number,
  currencyCode: CurrencyCode,
): string => {
  const currency = CURRENCIES[currencyCode];
  // First humanize, then limit to 2 significant digits
  const humanized = HRNumbers.toHumanString(num);

  if (humanized.length <= 4) return currency.symbol + humanized;

  return currency.symbol + humanized.slice(0, 4) + humanized.at(-1);
};
