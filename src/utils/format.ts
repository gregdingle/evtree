import HRNumbers from "human-readable-numbers";

import { normalizeExpression } from "@/lib/expectedValue";

/**
 * @see https://www.npmjs.com/package/human-readable-numbers
 *
 * TODO: how to get nice Minus sign (−): Used for mathematical operations (Unicode U+2212)
 */
export function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  // NOTE: we don't want SI prefixes for small values here
  if (value < 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  return HRNumbers.toHumanString(value);
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
  if (Number.isFinite(Number(normalizeExpression(cost.toString())))) {
    return `-${cost}`;
  }
  // NOTE: use official minus sign for non-numeric costs... it just looks better
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
