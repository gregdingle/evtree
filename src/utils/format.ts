import { trim } from "es-toolkit";
import humanFormat from "human-format";

import { CURRENCIES, CurrencyCode } from "@/lib/Currency";
import { normalizeExpression } from "@/lib/expectedValue";
import { ROUNDING, RoundingCode } from "@/lib/rounding";

/**
 * @see https://www.npmjs.com/package/human-format
 */
export function formatValue(
  value: number | null | undefined,
  currencyCode: CurrencyCode,
  roundingCode: RoundingCode,
): string {
  if (value === null || value === undefined) {
    return "";
  }

  // Get the rounding configuration
  const rounding = ROUNDING[roundingCode];

  // If no rounding code or scale is empty, don't round
  if (!roundingCode || !rounding.scale) {
    const formatted = value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
    if (!currencyCode) {
      return formatted;
    }
    const currency = CURRENCIES[currencyCode];
    if (!currency) {
      console.error(`[EVTree] Unknown currency: ${currencyCode}`);
      return formatted;
    }
    if (currency.before) {
      if (value < 0) {
        return `-${currency.symbol}${trim(formatted, "-")}`;
      }
      return `${currency.symbol}${formatted}`;
    }
    return `${formatted} ${currency.symbol}`;
  }

  // Create custom scale from rounding configuration
  const customScale = new humanFormat.Scale(rounding.scale);

  // Use human-format with custom scale
  const humanized = humanFormat(value, {
    scale: customScale,
    maxDecimals: "auto",
    separator: "",
  });
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
  roundingCode: RoundingCode,
): string => {
  const currency = CURRENCIES[currencyCode];
  const rounding = ROUNDING[roundingCode];

  // If no rounding code or scale is empty, format without scale
  if (!roundingCode || !rounding.scale) {
    const formatted = num.toLocaleString(undefined, {
      maximumFractionDigits: 2,
      maximumSignificantDigits: 4,
    });
    return currency.symbol + formatted;
  }

  // Create custom scale from rounding configuration
  const customScale = new humanFormat.Scale(rounding.scale);

  const humanized = humanFormat(num, {
    scale: customScale,
    maxDecimals: "auto",
    separator: "",
  });

  return currency.symbol + humanized;
};
