export const CATEGORY_COLORS: Record<string, string> = {
  Supermercado:    "#22c55e",
  Restaurantes:    "#f97316",
  Delivery:        "#eab308",
  Combustible:     "#0ea5e9",
  Transporte:      "#6366f1",
  Salud:           "#ec4899",
  Educación:       "#8b5cf6",
  Entretenimiento: "#f59e0b",
  Ropa:            "#a78bfa",
  Electrónica:     "#06b6d4",
  Servicios:       "#64748b",
  Suscripciones:   "#c084fc",
  Transferencias:  "#34d399",
  Inversiones:     "#84cc16",
  Impuestos:       "#fbbf24",
  Varios:          "#94a3b8",
};

const FALLBACK_PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
];

export function getCategoryColor(category: string, fallbackIndex = 0): string {
  return CATEGORY_COLORS[category] ?? FALLBACK_PALETTE[fallbackIndex % FALLBACK_PALETTE.length];
}
