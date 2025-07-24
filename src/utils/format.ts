// TODO: how to get nice Minus sign (−): Used for mathematical operations (Unicode U+2212)
export function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return value.toLocaleString(undefined, {
    currency: "USD",
    style: "currency",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatProbability(
  probability: number | null | undefined,
  sigDigits: number = 2,
  placeholder: string = "???"
): string {
  if (probability === null || probability === undefined) {
    return placeholder;
  }
  return (
    "P=" +
    probability.toLocaleString(undefined, {
      minimumFractionDigits: sigDigits,
      maximumFractionDigits: sigDigits,
    })
  );
}

export function formatCost(cost: number | undefined | null): string {
  if (cost === undefined || cost === null || cost == 0) {
    return "";
  }
  return " " + formatValue(cost * -1);
}
