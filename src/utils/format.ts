// TODO: how to get nice Minus sign (−): Used for mathematical operations (Unicode U+2212)
export function formatValue(value: number | undefined | null): string {
  if (value === undefined || value === null) {
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
  probability: number | undefined | null
): string {
  if (probability === undefined || probability === null) {
    return "???";
  }
  return (
    "P=" +
    probability.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
