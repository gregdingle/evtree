import HRNumbers from "human-readable-numbers";
// TODO: how to get nice Minus sign (−): Used for mathematical operations (Unicode U+2212)
export function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return HRNumbers.toHumanString(value);
}

export function formatProbability(
  probability: number | null | undefined,
  sigDigits: number = 1,
  placeholder: string = "???",
  prefix: string = "P="
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

export function formatCost(cost: number | undefined | null): string {
  if (cost === undefined || cost === null || cost == 0) {
    return "";
  }
  return " " + formatValue(cost * -1);
}
