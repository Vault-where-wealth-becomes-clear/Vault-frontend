import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useInstallments } from "@/api/installments.api";
import { formatCurrency } from "@/utils/formatCurrency";

const DEFAULT_CATEGORIES = [
  "Supermercado", "Restaurantes", "Transporte", "Salud", "Indumentaria",
  "Tecnología", "Entretenimiento", "Servicios", "Educación", "Viajes",
  "Inversiones", "Varios",
];

const CATEGORY_EMOJIS: Record<string, string> = {
  Supermercado: "🛒",
  Restaurantes: "🍽️",
  Transporte: "🚗",
  Salud: "❤️",
  Indumentaria: "👕",
  Tecnología: "💻",
  Entretenimiento: "🎬",
  Servicios: "🏠",
  Educación: "📚",
  Viajes: "✈️",
  Inversiones: "📈",
  Varios: "📦",
};

const DEMO_SUMMARY = [
  { category: "Supermercado", current: 45200, prev: 38900, pct: 16,  dir: "up",      share: 22 },
  { category: "Restaurantes", current: 28400, prev: 31200, pct: 9,   dir: "down",    share: 14 },
  { category: "Transporte",   current: 18600, prev: 17800, pct: 4,   dir: "up",      share: 9  },
  { category: "Salud",        current: 12000, prev: 8500,  pct: 41,  dir: "up",      share: 6  },
  { category: "Servicios",    current: 35000, prev: 35000, pct: 0,   dir: "neutral", share: 17 },
  { category: "Otros",        current: 62800, prev: 58100, pct: 8,   dir: "up",      share: 31 },
];

const DEMO_TRANSACTIONS: Record<string, { date: string; desc: string; amount: number; account: string }[]> = {
  Supermercado: [
    { date: "15 jun", desc: "Coto Florida",   amount: 12400, account: "Galicia CC" },
    { date: "12 jun", desc: "Día Palermo",    amount: 8600,  account: "Efectivo · ARS" },
    { date: "08 jun", desc: "Carrefour",      amount: 15800, account: "Galicia CC" },
    { date: "03 jun", desc: "Walmart Online", amount: 8400,  account: "Mercado Pago" },
  ],
  Restaurantes: [
    { date: "20 jun", desc: "Burger King",    amount: 6800,  account: "Galicia CC" },
    { date: "17 jun", desc: "Café Martinez",  amount: 4200,  account: "Efectivo · ARS" },
    { date: "10 jun", desc: "La Cabrera",     amount: 17400, account: "Galicia CC" },
  ],
  Transporte: [
    { date: "22 jun", desc: "Uber",           amount: 3200,  account: "Mercado Pago" },
    { date: "18 jun", desc: "SUBE carga",     amount: 5000,  account: "Efectivo · ARS" },
    { date: "11 jun", desc: "Cabify",         amount: 4100,  account: "Galicia CC" },
    { date: "05 jun", desc: "Peaje Panamer.", amount: 6300,  account: "Galicia CC" },
  ],
  Salud: [
    { date: "14 jun", desc: "Farmacity",      amount: 5400,  account: "Galicia CC" },
    { date: "07 jun", desc: "Consulta médica",amount: 6600,  account: "Efectivo · ARS" },
  ],
  Servicios: [
    { date: "05 jun", desc: "Internet Fibertel", amount: 12000, account: "Galicia Deb." },
    { date: "05 jun", desc: "Luz (EDESUR)",      amount: 11000, account: "Galicia Deb." },
    { date: "05 jun", desc: "Gas MetroGAS",      amount: 12000, account: "Galicia Deb." },
  ],
  Otros: [
    { date: "21 jun", desc: "Amazon",         amount: 18400, account: "Galicia CC" },
    { date: "16 jun", desc: "Zara",           amount: 24600, account: "Galicia CC" },
    { date: "09 jun", desc: "Steam",          amount: 9800,  account: "Mercado Pago" },
    { date: "02 jun", desc: "Netflix",        amount: 10000, account: "Galicia Deb." },
  ],
};

function loadCustomCategories(): string[] {
  try {
    return JSON.parse(localStorage.getItem("vault_custom_categories") ?? "[]");
  } catch {
    return [];
  }
}

function VariationCell({ dir, pct }: { dir: string; pct: number }) {
  if (dir === "up")      return <span className="text-vault-red">↑ {pct}%</span>;
  if (dir === "down")    return <span className="text-vault-green">↓ {pct}%</span>;
  return <span className="text-vault-muted2 dark:text-[#8b949e]">→ 0%</span>;
}

export function InstallmentsPage() {
  const { data: installments } = useInstallments();

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const [customCategories, setCustomCategories] = useState<string[]>(loadCustomCategories);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingCategory) addInputRef.current?.focus();
  }, [addingCategory]);

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) { setAddingCategory(false); return; }
    const all = [...DEFAULT_CATEGORIES, ...customCategories];
    if (!all.map((c) => c.toLowerCase()).includes(trimmed.toLowerCase())) {
      const updated = [...customCategories, trimmed];
      setCustomCategories(updated);
      localStorage.setItem("vault_custom_categories", JSON.stringify(updated));
    }
    setNewCategory("");
    setAddingCategory(false);
  };

  const removeCategory = (cat: string) => {
    const updated = customCategories.filter((c) => c !== cat);
    setCustomCategories(updated);
    localStorage.setItem("vault_custom_categories", JSON.stringify(updated));
  };

  const isEmpty = !installments || installments.length === 0;

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="page-title">Historial de gastos</h1>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          Tus movimientos procesados y resumen por categoría.
        </p>
      </div>

      {/* SECCIÓN 1 — Empty state */}
      {isEmpty && (
        <div className="card-vault mb-5 flex flex-col items-center py-10 text-center">
          <span
            className="text-vault-muted2 dark:text-[#8b949e]"
            style={{ fontSize: 32, marginBottom: 12 }}
          >
            ◷
          </span>
          <p
            className="text-vault-text dark:text-[#e6edf3]"
            style={{ fontSize: 16, fontWeight: 300, marginBottom: 8 }}
          >
            No hay movimientos registrados
          </p>
          <p className="mb-6 max-w-xs text-sm text-vault-muted2 dark:text-[#8b949e]">
            Subí tu primer extracto o registrá un movimiento manual para empezar a ver tu historial.
          </p>
          <div className="flex gap-3">
            <Link to="/accounts" className="btn-primary">
              Ir a Mis cuentas
            </Link>
            <button type="button" className="btn-ghost">
              ¿Cómo funciona?
            </button>
          </div>
        </div>
      )}

      {/* SECCIÓN 2 — Resumen por categoría (demo) */}
      <div className="card-vault mb-5 overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-vault-border px-4 py-3 dark:border-[#30363d]">
          <h2 className="section-label">Resumen por categoría</h2>
          <span className="rounded-full bg-vault-yellow/20 px-2 py-0.5 text-[10px] text-vault-yellow">
            Datos de ejemplo
          </span>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vault-border text-left dark:border-[#30363d]">
              {["Categoría", "Mes actual", "Mes anterior", "Variación", "% del total"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEMO_SUMMARY.map((row, i) => {
              const isExpanded = expandedCategory === row.category;
              const txns = DEMO_TRANSACTIONS[row.category] ?? [];
              return (
                <>
                  <tr
                    key={row.category}
                    onClick={() => setExpandedCategory(isExpanded ? null : row.category)}
                    className={`cursor-pointer border-b border-vault-border/50 transition-colors last:border-0 dark:border-[#30363d]/50 ${
                      i % 2 === 1 ? "bg-vault-s2 dark:bg-[#161b22]" : ""
                    } ${isExpanded ? "bg-[#eff6ff] dark:bg-[#1d2d50]" : "hover:bg-vault-s2 dark:hover:bg-[#21262d]"}`}
                  >
                    <td className="px-4 py-2.5 font-medium text-vault-text dark:text-[#e6edf3]">
                      <span className="flex items-center gap-2">
                        <span>{CATEGORY_EMOJIS[row.category] ?? "📦"}</span>
                        {row.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-vault-text dark:text-[#e6edf3]">
                      {formatCurrency(row.current, "ARS")}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-vault-muted2 dark:text-[#8b949e]">
                      {formatCurrency(row.prev, "ARS")}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      <VariationCell dir={row.dir} pct={row.pct} />
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-vault-muted2 dark:text-[#8b949e]">
                      {row.share}%
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${row.category}-detail`} className="border-b border-vault-border/50 dark:border-[#30363d]/50">
                      <td colSpan={5} className="bg-[#eff6ff] px-4 pb-3 pt-1 dark:bg-[#1d2d50]">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-vault-accent dark:text-[#93c5fd]">
                          Demo — aquí aparecerán tus transacciones reales
                        </p>
                        <div className="flex flex-col gap-1">
                          {txns.map((t, ti) => (
                            <div
                              key={ti}
                              className="flex items-center justify-between rounded-lg border border-vault-border/50 bg-white px-3 py-2 text-xs dark:border-[#30363d]/50 dark:bg-[#161b22]"
                            >
                              <span className="w-14 flex-shrink-0 text-vault-muted2 dark:text-[#8b949e]">
                                {t.date}
                              </span>
                              <span className="flex-1 text-vault-text dark:text-[#e6edf3]">{t.desc}</span>
                              <span className="mr-4 text-vault-muted2 dark:text-[#8b949e]">{t.account}</span>
                              <span className="tabular-nums font-medium text-vault-text dark:text-[#e6edf3]">
                                {formatCurrency(t.amount, "ARS")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* SECCIÓN 3 — Mis categorías (grid) */}
      <div className="card-vault">
        <h2 className="mb-4 section-label">Mis categorías</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
            gap: 8,
          }}
        >
          {/* Predeterminadas */}
          {DEFAULT_CATEGORIES.map((cat) => (
            <div
              key={cat}
              className="flex flex-col gap-1.5 rounded-xl border border-vault-border p-3 dark:border-[#30363d]"
            >
              <span style={{ fontSize: 20 }}>{CATEGORY_EMOJIS[cat] ?? "📦"}</span>
              <span className="text-xs font-medium text-vault-text dark:text-[#e6edf3]">{cat}</span>
            </div>
          ))}

          {/* Personalizadas */}
          {customCategories.map((cat) => (
            <div
              key={cat}
              className="relative flex flex-col gap-1.5 rounded-xl border border-vault-accent/30 p-3"
            >
              <button
                type="button"
                onClick={() => removeCategory(cat)}
                className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-vault-muted2 transition-colors hover:bg-vault-red/10 hover:text-vault-red dark:text-[#8b949e]"
              >
                ×
              </button>
              <span style={{ fontSize: 20 }}>✨</span>
              <span className="text-xs font-medium text-vault-text dark:text-[#e6edf3]">{cat}</span>
            </div>
          ))}

          {/* Card agregar */}
          {addingCategory ? (
            <div className="flex flex-col gap-1.5 rounded-xl border-2 border-dashed border-vault-accent/40 p-3">
              <input
                ref={addInputRef}
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addCategory(); }
                  if (e.key === "Escape") { setAddingCategory(false); setNewCategory(""); }
                }}
                onBlur={addCategory}
                placeholder="Nombre..."
                className="w-full rounded border border-vault-border bg-transparent text-xs text-vault-text outline-none placeholder:text-vault-muted2 dark:border-[#30363d] dark:text-[#e6edf3]"
                style={{ padding: "2px 4px" }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingCategory(true)}
              className="flex flex-col gap-1.5 rounded-xl border-2 border-dashed border-vault-border2 p-3 transition-colors hover:border-vault-accent/40 dark:border-[#484f58]"
            >
              <span className="text-vault-muted2 dark:text-[#8b949e]" style={{ fontSize: 20 }}>+</span>
              <span className="text-xs text-vault-muted2 dark:text-[#8b949e]">Nueva</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
