import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTransactions, type Transaction } from "@/api/transactions.api";
import { formatCurrency } from "@/utils/formatCurrency";
import { getCategoryColor } from "@/utils/categoryColors";

// ─── canonical lists ──────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = new Set([
  "Supermercado", "Restaurantes", "Transporte", "Salud", "Indumentaria",
  "Tecnología", "Entretenimiento", "Servicios", "Educación", "Viajes",
  "Suscripciones", "Impuestos", "Varios",
]);

const DEFAULT_CATEGORIES = [
  "Supermercado", "Restaurantes", "Transporte", "Salud", "Indumentaria",
  "Tecnología", "Entretenimiento", "Servicios", "Educación", "Viajes",
  "Suscripciones", "Impuestos", "Varios",
  "Ingreso operativo", "Rendimiento", "Cambio de moneda", "Pago deuda",
  "Transferencia interna", "Reintegro", "Sin categoría",
];

const DEFAULT_EMOJIS: Record<string, string> = {
  Supermercado: "🛒", Restaurantes: "🍽️", Transporte: "🚗", Salud: "❤️",
  Indumentaria: "👕", Tecnología: "💻", Entretenimiento: "🎬", Servicios: "🏠",
  Educación: "📚", Viajes: "✈️", Suscripciones: "🔄", Impuestos: "🧾",
  Varios: "📦", "Ingreso operativo": "💼", Rendimiento: "📈",
  "Cambio de moneda": "💱", "Pago deuda": "💳", "Transferencia interna": "↔️",
  Reintegro: "↩️", "Sin categoría": "❓",
};

const EMOJI_OPTIONS = [
  "📦","🛒","🍽️","🚗","❤️","👕","💻","🎬","🏠","📚",
  "✈️","📈","🎁","💰","🏋️","🎮","🎵","🎨","🏖️","🐾",
  "🧾","🔧","🌮","🍕","🎂","🛍️","🚌","🏥","🍺","💊",
  "🐶","🌱","⚽","📱","🎓","🏦","🔑","🔄","💱","💳",
  "↔️","↩️","❓","💼","💵","🏷️","⭐","🎪","🌟","🍀",
];

// ─── storage helpers ──────────────────────────────────────────────────────────

interface CustomCategory { name: string; emoji: string; }
interface CategoryOverride { emoji?: string; color?: string; }

function loadCustomCategories(): CustomCategory[] {
  try {
    const raw = localStorage.getItem("vault_custom_categories_v2");
    if (raw) return JSON.parse(raw);
    const old = localStorage.getItem("vault_custom_categories");
    if (old) return (JSON.parse(old) as string[]).map((name) => ({ name, emoji: "✨" }));
    return [];
  } catch { return []; }
}
function saveCustomCategories(cats: CustomCategory[]) {
  localStorage.setItem("vault_custom_categories_v2", JSON.stringify(cats));
  window.dispatchEvent(new Event("storage"));
}
function loadHiddenDefaults(): string[] {
  try { return JSON.parse(localStorage.getItem("vault_hidden_default_categories") ?? "[]"); }
  catch { return []; }
}
function saveHiddenDefaults(hidden: string[]) {
  localStorage.setItem("vault_hidden_default_categories", JSON.stringify(hidden));
  window.dispatchEvent(new Event("storage"));
}
function loadOverrides(): Record<string, CategoryOverride> {
  try { return JSON.parse(localStorage.getItem("vault_category_overrides") ?? "{}"); }
  catch { return {}; }
}
function saveOverrides(overrides: Record<string, CategoryOverride>) {
  localStorage.setItem("vault_category_overrides", JSON.stringify(overrides));
}

// ─── period helpers ───────────────────────────────────────────────────────────

function addMonths(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── pie tooltip ──────────────────────────────────────────────────────────────

interface PieEntry { category: string; amount_ars: number; amount_usd: number; pct: number; }

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PieEntry }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      className="rounded-lg border border-vault-border bg-white px-3 py-2 shadow-lg dark:border-[#30363d] dark:bg-[#161b22]"
      style={{ fontSize: 12 }}
    >
      <p className="mb-1 font-semibold text-vault-text dark:text-[#e6edf3]">{p.category}</p>
      <p className="text-vault-text dark:text-[#e6edf3]">{formatCurrency(p.amount_ars, "ARS")}</p>
      {p.amount_usd > 0 && (
        <p className="text-vault-muted2 dark:text-[#8b949e]">{formatCurrency(p.amount_usd, "USD")}</p>
      )}
      <p className="text-vault-muted2 dark:text-[#8b949e]">{p.pct.toFixed(1)}%</p>
    </div>
  );
}

// ─── summary computer ────────────────────────────────────────────────────────

function computeSummary(transactions: Transaction[], period: string): PieEntry[] {
  const map = new Map<string, { amount_ars: number; amount_usd: number }>();
  for (const t of transactions) {
    if (t.date.slice(0, 7) !== period) continue;
    if (!t.category || !EXPENSE_CATEGORIES.has(t.category)) continue;
    if ((t.amount_ars ?? 0) >= 0) continue;
    const prev = map.get(t.category) ?? { amount_ars: 0, amount_usd: 0 };
    map.set(t.category, {
      amount_ars: prev.amount_ars + Math.abs(t.amount_ars),
      amount_usd: prev.amount_usd + Math.abs(t.amount_usd ?? 0),
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
    .filter((item) => item.amount_ars > 0)
    .sort((a, b) => b.amount_ars - a.amount_ars);
}

// ─── inline pie + table block ─────────────────────────────────────────────────

function SummaryBlock({
  items,
  onCategoryClick,
  getColor,
}: {
  items: PieEntry[];
  onCategoryClick: (cat: string) => void;
  getColor: (name: string, i: number) => string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      {/* pie */}
      <div className="flex-shrink-0" style={{ width: 160, height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="amount_ars"
              nameKey="category"
              innerRadius={44}
              outerRadius={72}
              paddingAngle={2}
              stroke="none"
              onClick={(d) => onCategoryClick(d.category)}
              style={{ cursor: "pointer" }}
            >
              {items.map((entry, i) => (
                <Cell key={entry.category} fill={getColor(entry.category, i)} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* table */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-vault-border dark:border-[#30363d]">
              <th className="pb-2 text-left font-medium text-vault-muted2 dark:text-[#8b949e]">Categoría</th>
              <th className="pb-2 text-right font-medium text-vault-muted2 dark:text-[#8b949e]">ARS</th>
              <th className="pb-2 text-right font-medium text-vault-muted2 dark:text-[#8b949e]">USD</th>
              <th className="pb-2 text-right font-medium text-vault-muted2 dark:text-[#8b949e]">%</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={item.category}
                className="cursor-pointer border-b border-vault-border/50 last:border-0 transition-colors hover:bg-vault-s2/50 dark:border-[#30363d]/50 dark:hover:bg-[#21262d]/50"
                onClick={() => onCategoryClick(item.category)}
              >
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: getColor(item.category, i) }} />
                    <span className="text-vault-text dark:text-[#e6edf3]">{item.category}</span>
                  </div>
                </td>
                <td className="py-2 text-right tabular-nums text-vault-text dark:text-[#e6edf3]">
                  {formatCurrency(item.amount_ars, "ARS")}
                </td>
                <td className="py-2 pl-4 text-right tabular-nums text-vault-muted2 dark:text-[#8b949e]">
                  {item.amount_usd > 0 ? formatCurrency(item.amount_usd, "USD") : "—"}
                </td>
                <td className="py-2 pl-3 text-right tabular-nums text-vault-muted2 dark:text-[#8b949e]">
                  {item.pct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── component ────────────────────────────────────────────────────────────────

export function InstallmentsPage() {
  const { data: transactions, isLoading } = useTransactions({ dateFrom: "2026-01-01" });

  // Period nav
  const [selectedPeriod, setSelectedPeriod] = useState(currentMonthStr);
  const today = useMemo(currentMonthStr, []);

  // Category detail modal
  const [categoryDetail, setCategoryDetail] = useState<string | null>(null);

  // Mis categorías state
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(loadCustomCategories);
  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>(loadHiddenDefaults);
  const [overrides, setOverrides] = useState<Record<string, CategoryOverride>>(loadOverrides);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // delete
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<string | null>(null);
  const deleteImpact = transactions?.filter((t) => t.category === confirmDeleteCat).length ?? 0;

  // create
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("📦");
  const [newCatColor, setNewCatColor] = useState("#78909C");
  const createNameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (createModalOpen) setTimeout(() => createNameRef.current?.focus(), 50);
  }, [createModalOpen]);

  // edit
  const [editingCat, setEditingCat] = useState<{ name: string; isDefault: boolean } | null>(null);
  const [editEmoji, setEditEmoji] = useState("📦");
  const [editColor, setEditColor] = useState("#78909C");
  const [editName, setEditName] = useState("");

  const visibleDefaults = DEFAULT_CATEGORIES.filter((c) => !hiddenDefaults.includes(c));
  const allCategoryNames = [...visibleDefaults, ...customCategories.map((c) => c.name)];

  const getColor = (name: string, fallbackIndex = 0) =>
    overrides[name]?.color ?? getCategoryColor(name, fallbackIndex);
  const getEmoji = (name: string) => {
    const custom = customCategories.find((c) => c.name === name);
    return overrides[name]?.emoji ?? custom?.emoji ?? DEFAULT_EMOJIS[name] ?? "📦";
  };

  // ── period summary ────────────────────────────────────────────────────────
  const monthlyData = useMemo(
    () => computeSummary(transactions ?? [], selectedPeriod),
    [transactions, selectedPeriod]
  );
  const monthlyTotal = monthlyData.reduce((s, item) => s + item.amount_ars, 0);

  // ── cumulative acumulado ─────────────────────────────────────────────────
  const acumulado = useMemo(() => {
    if (!transactions) return [];
    const map = new Map<string, { amount_ars: number; amount_usd: number }>();
    for (const t of transactions) {
      if (!t.category || !EXPENSE_CATEGORIES.has(t.category)) continue;
      if ((t.amount_ars ?? 0) >= 0) continue;
      const prev = map.get(t.category) ?? { amount_ars: 0, amount_usd: 0 };
      map.set(t.category, {
        amount_ars: prev.amount_ars + Math.abs(t.amount_ars),
        amount_usd: prev.amount_usd + Math.abs(t.amount_usd ?? 0),
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
      .filter((item) => item.amount_ars > 0)
      .sort((a, b) => b.amount_ars - a.amount_ars);
  }, [transactions]);

  // ── category detail transactions ─────────────────────────────────────────
  const categoryTransactions = useMemo(() => {
    if (!categoryDetail || !transactions) return [];
    return transactions
      .filter(
        (t) =>
          t.date.slice(0, 7) === selectedPeriod &&
          t.category === categoryDetail &&
          (t.amount_ars ?? 0) < 0
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions, categoryDetail, selectedPeriod]);

  const hasTransactions = !!(transactions && transactions.length > 0);

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleDeleteConfirm = () => {
    if (!confirmDeleteCat) return;
    if (DEFAULT_CATEGORIES.includes(confirmDeleteCat)) {
      const updated = [...hiddenDefaults, confirmDeleteCat];
      setHiddenDefaults(updated);
      saveHiddenDefaults(updated);
    } else {
      const updated = customCategories.filter((c) => c.name !== confirmDeleteCat);
      setCustomCategories(updated);
      saveCustomCategories(updated);
    }
    setConfirmDeleteCat(null);
  };

  const handleCreateCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (allCategoryNames.map((n) => n.toLowerCase()).includes(trimmed.toLowerCase())) {
      setCreateModalOpen(false);
      return;
    }
    const updated = [...customCategories, { name: trimmed, emoji: newCatEmoji }];
    setCustomCategories(updated);
    saveCustomCategories(updated);
    const newOverrides = { ...overrides, [trimmed]: { color: newCatColor } };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
    setCreateModalOpen(false);
    setNewCatName("");
    setNewCatEmoji("📦");
    setNewCatColor("#78909C");
  };

  const openEdit = (name: string, isDefault: boolean) => {
    setEditingCat({ name, isDefault });
    setEditName(name);
    setEditEmoji(getEmoji(name));
    setEditColor(getColor(name));
  };

  const handleSaveEdit = () => {
    if (!editingCat) return;
    const newOverrides = { ...overrides, [editingCat.name]: { emoji: editEmoji, color: editColor } };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
    if (!editingCat.isDefault && editName.trim() && editName !== editingCat.name) {
      const updated = customCategories.map((c) =>
        c.name === editingCat.name ? { ...c, name: editName.trim() } : c
      );
      setCustomCategories(updated);
      saveCustomCategories(updated);
    }
    setEditingCat(null);
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-7">
      {/* ── Header + period nav ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="page-title">Historial de gastos</h1>
          <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
            Tus movimientos procesados y resumen por categoría.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedPeriod(addMonths(selectedPeriod, -1))}
            disabled={selectedPeriod <= "2026-01"}
            className="flex h-7 w-7 items-center justify-center rounded-vault border border-vault-border text-vault-muted2 hover:border-vault-accent hover:text-vault-accent disabled:opacity-30 dark:text-[#8b949e]"
          >
            ‹
          </button>
          <span className="min-w-[120px] text-center text-sm font-medium capitalize text-vault-text dark:text-[#e6edf3]">
            {formatPeriodLabel(selectedPeriod)}
          </span>
          <button
            type="button"
            onClick={() => setSelectedPeriod(addMonths(selectedPeriod, 1))}
            disabled={selectedPeriod >= today}
            className="flex h-7 w-7 items-center justify-center rounded-vault border border-vault-border text-vault-muted2 hover:border-vault-accent hover:text-vault-accent disabled:opacity-30 dark:text-[#8b949e]"
          >
            ›
          </button>
        </div>
      </div>

      {!hasTransactions && !isLoading && (
        <div className="card-vault mb-5 flex flex-col items-center py-10 text-center">
          <span className="text-vault-muted2 dark:text-[#8b949e]" style={{ fontSize: 32, marginBottom: 12 }}>
            ◷
          </span>
          <p className="text-vault-text dark:text-[#e6edf3]" style={{ fontSize: 16, fontWeight: 300, marginBottom: 8 }}>
            No hay movimientos registrados
          </p>
          <p className="mb-6 max-w-xs text-sm text-vault-muted2 dark:text-[#8b949e]">
            Subí tu primer extracto o registrá un movimiento manual para empezar a ver tu historial.
          </p>
          <div className="flex gap-3">
            <Link to="/accounts" className="btn-primary">Ir a Mis cuentas</Link>
            <button type="button" className="btn-ghost">¿Cómo funciona?</button>
          </div>
        </div>
      )}

      {/* ── Monthly panel (primary) ── */}
      <div className="card-vault mb-5">
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="section-label">Gastos de {formatPeriodLabel(selectedPeriod)}</h2>
          {monthlyTotal > 0 && (
            <span className="text-xs text-vault-muted2 dark:text-[#8b949e]">
              hacé click en una categoría para ver el detalle
            </span>
          )}
        </div>
        {isLoading ? (
          <div className="flex h-24 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
            Cargando...
          </div>
        ) : monthlyTotal > 0 ? (
          <>
            <p
              className="mb-5 tabular-nums font-light text-vault-text dark:text-[#e6edf3]"
              style={{ fontSize: 36 }}
            >
              {formatCurrency(monthlyTotal, "ARS")}
            </p>
            <SummaryBlock
              items={monthlyData}
              onCategoryClick={setCategoryDetail}
              getColor={getColor}
            />
          </>
        ) : (
          <div className="flex h-20 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
            Sin gastos registrados para este período.
          </div>
        )}
      </div>

      {/* ── Acumulado desde enero 2026 (secondary) ── */}
      {acumulado.length > 0 && (
        <div className="card-vault mb-5">
          <h2 className="mb-1 section-label">Acumulado desde enero 2026</h2>
          <p className="mb-4 text-xs text-vault-muted2 dark:text-[#8b949e]">
            Total acumulado por categoría — ARS y USD.
          </p>
          <SummaryBlock
            items={acumulado}
            onCategoryClick={setCategoryDetail}
            getColor={getColor}
          />
        </div>
      )}

      {/* ── Mis categorías (colapsable) ── */}
      <div className="card-vault overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setCategoriesOpen((v) => !v)}
          className={`flex w-full cursor-pointer items-center justify-between px-4 py-4 transition-colors hover:bg-vault-s2 dark:hover:bg-[#21262d] ${
            categoriesOpen ? "border-b border-vault-border dark:border-[#30363d]" : ""
          }`}
        >
          <h2 className="section-label">Mis categorías</h2>
          <span
            className="inline-block text-sm text-vault-muted2 transition-transform duration-200 dark:text-[#8b949e]"
            style={{ transform: categoriesOpen ? "rotate(90deg)" : "none" }}
          >
            ›
          </span>
        </button>

        {categoriesOpen && (
          <div className="px-4 pb-4 pt-3">
            <div
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 12 }}
            >
              {visibleDefaults.map((cat) => {
                const color = getColor(cat);
                return (
                  <div
                    key={cat}
                    className="group relative flex flex-col gap-1.5 rounded-xl border p-3"
                    style={{ borderColor: `${color}50`, backgroundColor: `${color}12` }}
                  >
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCat(cat)}
                      className="absolute right-5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-vault-muted2 opacity-0 transition-all hover:bg-vault-red/10 hover:text-vault-red group-hover:opacity-100 dark:text-[#8b949e]"
                      title="Eliminar"
                    >×</button>
                    <button
                      type="button"
                      onClick={() => openEdit(cat, true)}
                      className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-vault-muted2 opacity-0 transition-all hover:bg-vault-s2 hover:text-vault-text group-hover:opacity-100 dark:text-[#8b949e]"
                      title="Editar"
                    >✎</button>
                    <span style={{ fontSize: 20 }}>{getEmoji(cat)}</span>
                    <span className="text-xs font-medium text-vault-text dark:text-[#e6edf3]">{cat}</span>
                    <span className="mt-0.5 h-1.5 w-full rounded-full" style={{ backgroundColor: color }} />
                  </div>
                );
              })}
              {customCategories.map((cat) => {
                const color = getColor(cat.name);
                return (
                  <div
                    key={cat.name}
                    className="group relative flex flex-col gap-1.5 rounded-xl border p-3"
                    style={{ borderColor: `${color}50`, backgroundColor: `${color}12` }}
                  >
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCat(cat.name)}
                      className="absolute right-5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-vault-muted2 opacity-0 transition-all hover:bg-vault-red/10 hover:text-vault-red group-hover:opacity-100 dark:text-[#8b949e]"
                      title="Eliminar"
                    >×</button>
                    <button
                      type="button"
                      onClick={() => openEdit(cat.name, false)}
                      className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-vault-muted2 opacity-0 transition-all hover:bg-vault-s2 hover:text-vault-text group-hover:opacity-100 dark:text-[#8b949e]"
                      title="Editar"
                    >✎</button>
                    <span style={{ fontSize: 20 }}>{getEmoji(cat.name)}</span>
                    <span className="text-xs font-medium text-vault-text dark:text-[#e6edf3]">{cat.name}</span>
                    <span className="mt-0.5 h-1.5 w-full rounded-full" style={{ backgroundColor: color }} />
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="rounded-vault border border-vault-accent/40 bg-vault-accent/10 px-3 py-1.5 text-xs font-medium text-vault-accent hover:bg-vault-accent/20"
            >
              + Nueva categoría
            </button>
          </div>
        )}
      </div>

      {/* ── Modal: category detail ── */}
      {categoryDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCategoryDetail(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-vault-border bg-white shadow-xl dark:border-[#30363d] dark:bg-[#161b22]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-vault-border px-6 py-4 dark:border-[#30363d]">
              <div>
                <h3 className="text-base font-medium capitalize text-vault-text dark:text-[#e6edf3]">
                  {categoryDetail}
                </h3>
                <p className="text-xs capitalize text-vault-muted2 dark:text-[#8b949e]">
                  {formatPeriodLabel(selectedPeriod)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryDetail(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-vault-muted2 hover:bg-vault-s2 hover:text-vault-text dark:text-[#8b949e] dark:hover:bg-[#21262d]"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              {categoryTransactions.length === 0 ? (
                <p className="text-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                  Sin transacciones en este período.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-vault-border dark:border-[#30363d]">
                      <th className="pb-2 text-left font-medium text-vault-muted2 dark:text-[#8b949e]">Fecha</th>
                      <th className="pb-2 text-left font-medium text-vault-muted2 dark:text-[#8b949e]">Descripción</th>
                      <th className="pb-2 text-right font-medium text-vault-muted2 dark:text-[#8b949e]">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryTransactions.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-vault-border/50 last:border-0 dark:border-[#30363d]/50"
                      >
                        <td className="py-2 pr-3 whitespace-nowrap text-vault-muted2 dark:text-[#8b949e]">
                          {new Date(t.date + "T12:00:00").toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </td>
                        <td className="max-w-[220px] py-2 pr-3">
                          <p className="truncate text-vault-text dark:text-[#e6edf3]">{t.description}</p>
                        </td>
                        <td className="py-2 text-right tabular-nums text-vault-text dark:text-[#e6edf3]">
                          {formatCurrency(Math.abs(t.amount_ars), "ARS")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-vault-border dark:border-[#30363d]">
                      <td colSpan={2} className="pt-2 text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                        Total
                      </td>
                      <td className="pt-2 text-right tabular-nums font-semibold text-vault-text dark:text-[#e6edf3]">
                        {formatCurrency(
                          categoryTransactions.reduce((s, t) => s + Math.abs(t.amount_ars), 0),
                          "ARS"
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: confirmar eliminación ── */}
      {confirmDeleteCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDeleteCat(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-vault-border bg-white p-6 shadow-xl dark:border-[#30363d] dark:bg-[#161b22]" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-base font-medium text-vault-text dark:text-[#e6edf3]">
              Eliminar "{confirmDeleteCat}"
            </h3>
            <p className="mb-5 text-sm text-vault-muted2 dark:text-[#8b949e]">
              {deleteImpact > 0 ? (
                <><span className="font-medium text-vault-yellow">{deleteImpact} transacción{deleteImpact !== 1 ? "es" : ""}</span>{" "}quedar{deleteImpact !== 1 ? "án" : "á"} sin categoría.</>
              ) : "No hay transacciones con esta categoría."}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDeleteCat(null)} className="flex-1 rounded-vault border border-vault-border py-2 text-sm text-vault-muted2 hover:text-vault-text dark:border-[#30363d] dark:text-[#8b949e]">Cancelar</button>
              <button type="button" onClick={handleDeleteConfirm} className="flex-1 rounded-vault border border-vault-red/30 bg-vault-red/10 py-2 text-sm font-medium text-vault-red hover:bg-vault-red/20">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: crear categoría ── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreateModalOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-vault-border bg-white p-6 shadow-xl dark:border-[#30363d] dark:bg-[#161b22]" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-base font-medium text-vault-text dark:text-[#e6edf3]">Nueva categoría</h3>
            <div className="mb-3">
              <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">Nombre</label>
              <input ref={createNameRef} type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); if (e.key === "Escape") setCreateModalOpen(false); }} placeholder="Ej: Mascotas" className="input-vault" maxLength={30} />
            </div>
            <div className="mb-3">
              <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">Color</label>
              <input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)} className="h-9 w-full cursor-pointer rounded-vault border border-vault-border p-1 dark:border-[#30363d]" />
            </div>
            <div className="mb-5">
              <label className="mb-2 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">Ícono — <span className="text-base">{newCatEmoji}</span></label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
                {EMOJI_OPTIONS.map((emoji) => (<button key={emoji} type="button" onClick={() => setNewCatEmoji(emoji)} className={`flex items-center justify-center rounded-lg py-1 text-base transition-colors hover:bg-vault-s2 dark:hover:bg-[#21262d] ${newCatEmoji === emoji ? "bg-vault-accent/10 ring-1 ring-vault-accent/40" : ""}`}>{emoji}</button>))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCreateModalOpen(false)} className="flex-1 rounded-vault border border-vault-border py-2 text-sm text-vault-muted2 hover:text-vault-text dark:border-[#30363d] dark:text-[#8b949e]">Cancelar</button>
              <button type="button" onClick={handleCreateCategory} disabled={!newCatName.trim()} className="flex-1 rounded-vault bg-vault-accent py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: editar categoría ── */}
      {editingCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingCat(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-vault-border bg-white p-6 shadow-xl dark:border-[#30363d] dark:bg-[#161b22]" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-base font-medium text-vault-text dark:text-[#e6edf3]">Editar "{editingCat.name}"</h3>
            {!editingCat.isDefault && (
              <div className="mb-3">
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">Nombre</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="input-vault" maxLength={30} />
              </div>
            )}
            <div className="mb-3">
              <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">Color</label>
              <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-9 w-full cursor-pointer rounded-vault border border-vault-border p-1 dark:border-[#30363d]" />
            </div>
            <div className="mb-5">
              <label className="mb-2 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">Ícono — <span className="text-base">{editEmoji}</span></label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
                {EMOJI_OPTIONS.map((emoji) => (<button key={emoji} type="button" onClick={() => setEditEmoji(emoji)} className={`flex items-center justify-center rounded-lg py-1 text-base transition-colors hover:bg-vault-s2 dark:hover:bg-[#21262d] ${editEmoji === emoji ? "bg-vault-accent/10 ring-1 ring-vault-accent/40" : ""}`}>{emoji}</button>))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingCat(null)} className="flex-1 rounded-vault border border-vault-border py-2 text-sm text-vault-muted2 hover:text-vault-text dark:border-[#30363d] dark:text-[#8b949e]">Cancelar</button>
              <button type="button" onClick={handleSaveEdit} className="flex-1 rounded-vault bg-vault-accent py-2 text-sm font-medium text-white hover:opacity-90">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
