import { round } from "es-toolkit";
import { isNaN } from "es-toolkit/compat";

export function isPercentage(
  expression: string | undefined,
): expression is string {
  return expression?.trim().endsWith("%") ?? false;
}

/**
 * Convert a percentage expression like "25%" to its decimal equivalent, "0.25".
 * Invalid percentages return the original expression.
 *
 * QUESTION: would it be better to expect percentages everywhere and not allow
 * decimal probabilities? percentage is the current default for display
 */
export function convertPercentageToDecimal(
  expression: string | undefined,
): string {
  if (isPercentage(expression)) {
    const numStr = expression.trim().slice(0, -1).trim();
    // Empty string before % should return original
    if (numStr === "") {
      return expression;
    }
    const num = Number(numStr);
    if (!isNaN(num)) {
      // NOTE: see also EPSILON
      return round(num / 100, 10).toString();
    }
  }
  return expression ?? "";
}

/**
 * For user-friendliness, allow entering probabilities as percentages, with or
 * without %. Integers other than 1 are treated as percentages. They are
 * converted to decimal internally.
 *
 * QUESTION: should we store percentages internally instead?
 */
export function convertProbabilityInputToDecimal(
  value: string | undefined,
): string | undefined {
  if (isPercentage(value)) {
    return convertPercentageToDecimal(value);
  }
  if (
    Number.isInteger(Number(value)) &&
    Number(value) !== 1 // NOTE: to allow 1.0 as valid decimal
  ) {
    return convertPercentageToDecimal(value + "%");
  }
  return value;
}
