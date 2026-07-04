export function formatCurrency(
  amount: number,
  currency: "ARS" | "USD" = "ARS",
  compact = false
): string {
  const opts: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "USD" ? 2 : 1,
    maximumFractionDigits: currency === "USD" ? 2 : 1,
    notation: compact ? "compact" : "standard",
  };
  return new Intl.NumberFormat("es-AR", opts).format(amount);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
