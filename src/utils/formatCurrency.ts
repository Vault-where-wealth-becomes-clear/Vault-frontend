import { usePrivacyStore } from "@/store/privacy.store";

/** Máscara fija (no depende de la cantidad de dígitos del monto real, para no
 * filtrar información por el largo del string) usada por cualquier pantalla
 * cuando el usuario activó "tapar importes". */
export const HIDDEN_AMOUNT = "*****";

export function formatCurrency(
  amount: number,
  currency: "ARS" | "USD" = "ARS",
  compact = false
): string {
  if (usePrivacyStore.getState().hideAmounts) {
    return HIDDEN_AMOUNT;
  }
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
