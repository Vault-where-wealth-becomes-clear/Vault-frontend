export const CATEGORY_COLORS: Record<string, string> = {
  // User-specified
  Supermercado:    "#4CAF50",
  Restaurantes:    "#FF9800",
  Transporte:      "#2196F3",
  Ropa:            "#E91E63",
  Entretenimiento: "#9C27B0",
  Impuestos:       "#F44336",
  Servicios:       "#00BCD4",
  Viajes:          "#FF5722",
  "Sin categoría": "#9E9E9E",

  // Completados
  Delivery:        "#FFCA28",
  Combustible:     "#29B6F6",
  Salud:           "#EC407A",
  Educación:       "#5C6BC0",
  Electrónica:     "#26A69A",
  Suscripciones:   "#7E57C2",
  Transferencias:  "#66BB6A",
  Inversiones:     "#D4E157",
  Varios:          "#78909C",

  // Aliases usados en InstallmentsPage
  Indumentaria:    "#E91E63",
  Tecnología:      "#26A69A",
};

const FALLBACK_PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
];

export function getCategoryColor(category: string, fallbackIndex = 0): string {
  return CATEGORY_COLORS[category] ?? FALLBACK_PALETTE[fallbackIndex % FALLBACK_PALETTE.length];
}
