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
