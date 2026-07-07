export const CATEGORY_COLORS: Record<string, string> = {
  // Gastos
  Supermercado: "#4CAF50",
  Restaurantes: "#FF9800",
  Transporte: "#2196F3",
  Salud: "#EC407A",
  Indumentaria: "#E91E63",
  Tecnología: "#26A69A",
  Entretenimiento: "#9C27B0",
  Servicios: "#00BCD4",
  Educación: "#5C6BC0",
  Viajes: "#FF5722",
  Suscripciones: "#7E57C2",
  Impuestos: "#F44336",
  Varios: "#78909C",
  // Ingresos y movimientos
  "Ingreso operativo": "#66BB6A",
  Rendimiento: "#D4E157",
  "Cambio de moneda": "#29B6F6",
  "Pago deuda": "#FFCA28",
  "Transferencia interna": "#90A4AE",
  // Transitorio
  Reintegro: "#A5D6A7",
  "Sin categoría": "#9E9E9E",
};

const FALLBACK_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#6366f1",
];

export function getCategoryColor(category: string, fallbackIndex = 0): string {
  return CATEGORY_COLORS[category] ?? FALLBACK_PALETTE[fallbackIndex % FALLBACK_PALETTE.length];
}
