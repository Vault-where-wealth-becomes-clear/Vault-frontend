/**
 * Agrupación canónica de categorías (ver también STANDARD_CATEGORIES en
 * transactions.api.ts). Se usa para separar análisis de gastos vs. ingresos —
 * sumar "Ingreso operativo" (el sueldo) junto con categorías de gasto infla/
 * distorsiona el desglose y los porcentajes de "gastos por categoría".
 */
export const EXPENSE_CATEGORIES = new Set([
  "Supermercado",
  "Restaurantes",
  "Transporte",
  "Salud",
  "Indumentaria",
  "Tecnología",
  "Entretenimiento",
  "Servicios",
  "Educación",
  "Viajes",
  "Suscripciones",
  "Impuestos",
  "Varios",
]);

export const INCOME_CATEGORIES = new Set([
  "Ingreso operativo",
  "Rendimiento",
  "Cambio de moneda",
  "Pago deuda",
  "Transferencia interna",
]);

export interface CategoryTotal {
  category: string;
  amount_ars: number;
  amount_usd: number;
  pct: number;
}

/**
 * Suma transacciones por categoría, filtradas a `categorySet`, respetando la
 * moneda nativa de cada transacción (t.currency) — nunca sumar amount_usd de
 * una transacción en ARS, eso mezcla el equivalente-en-dólares de un gasto en
 * pesos con un gasto real en dólares y produce totales USD irreales.
 * `sign` filtra por el signo nativo: "negative" para gastos, "positive" para
 * ingresos (ambos según `amount_ars`, cuyo signo es consistente con `amount_usd`).
 */
export function sumByCategory(
  transactions: {
    category: string | null;
    amount_ars: number;
    amount_usd: number | null;
    currency: "ARS" | "USD";
  }[],
  categorySet: Set<string>,
  sign: "negative" | "positive" = "negative"
): CategoryTotal[] {
  const map = new Map<string, { amount_ars: number; amount_usd: number }>();
  for (const t of transactions) {
    if (!t.category || !categorySet.has(t.category)) continue;
    const isMatch = sign === "negative" ? (t.amount_ars ?? 0) < 0 : (t.amount_ars ?? 0) > 0;
    if (!isMatch) continue;
    const prev = map.get(t.category) ?? { amount_ars: 0, amount_usd: 0 };
    map.set(t.category, {
      amount_ars: prev.amount_ars + (t.currency === "ARS" ? Math.abs(t.amount_ars) : 0),
      amount_usd: prev.amount_usd + (t.currency === "USD" ? Math.abs(t.amount_usd ?? 0) : 0),
    });
  }
  const totalArs = Array.from(map.values()).reduce((s, v) => s + v.amount_ars, 0) || 1;
  return Array.from(map.entries())
    .map(([category, vals]) => ({
      category,
      amount_ars: vals.amount_ars,
      amount_usd: vals.amount_usd,
      pct: (vals.amount_ars / totalArs) * 100,
    }))
    .filter((item) => item.amount_ars > 0 || item.amount_usd > 0)
    .sort((a, b) => b.amount_ars - a.amount_ars);
}

export interface CategoryCreditDebit {
  category: string;
  debitoArs: number;
  debitoUsd: number;
  creditoArs: number;
  creditoUsd: number;
}

/**
 * Todas las "cuentas" (categorías) de gasto e ingreso juntas en una sola
 * lista, cada una con su débito y su crédito — así una categoría de gasto
 * con un reintegro (ej. un CR.RG bajo "Impuestos") muestra ambos lados en
 * la misma fila, en vez de perder el crédito por filtrar por signo.
 */
export function sumCreditDebitByCategory(
  transactions: {
    category: string | null;
    amount_ars: number;
    amount_usd: number | null;
    currency: "ARS" | "USD";
  }[],
  categorySet: Set<string>
): CategoryCreditDebit[] {
  const map = new Map<string, CategoryCreditDebit>();
  for (const t of transactions) {
    if (!t.category || !categorySet.has(t.category)) continue;
    const prev = map.get(t.category) ?? {
      category: t.category,
      debitoArs: 0,
      debitoUsd: 0,
      creditoArs: 0,
      creditoUsd: 0,
    };
    const amt = t.currency === "USD" ? Number(t.amount_usd) || 0 : Number(t.amount_ars) || 0;
    if (amt < 0) {
      if (t.currency === "USD") prev.debitoUsd += Math.abs(amt);
      else prev.debitoArs += Math.abs(amt);
    } else {
      if (t.currency === "USD") prev.creditoUsd += amt;
      else prev.creditoArs += amt;
    }
    map.set(t.category, prev);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.debitoArs + b.creditoArs - (a.debitoArs + a.creditoArs)
  );
}
