import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useDashboardBreakdown } from "@/api/dashboard.api";
import { useTransactions } from "@/api/transactions.api";
import { formatCurrency } from "@/utils/formatCurrency";
import { getCategoryColor } from "@/utils/categoryColors";

const DEFAULT_CATEGORIES = [
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
  "Inversiones",
  "Varios",
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

const EMOJI_OPTIONS = [
  "📦","🛒","🍽️","🚗","❤️","👕","💻","🎬","🏠","📚",
  "✈️","📈","🎁","💰","🏋️","🎮","🎵","🎨","🏖️","🐾",
  "🧾","🔧","🌮","🍕","🎂","🛍️","🚌","🏥","🍺","💊",
  "🐶","🌱","⚽","📱","🎓","🏦","🔑","🎪","🌟","🍀",
];

interface CustomCategory {
  name: string;
  emoji: string;
}

function loadCustomCategories(): CustomCategory[] {
  try {
    const raw = localStorage.getItem("vault_custom_categories_v2");
    if (raw) return JSON.parse(raw);
    // migrate from old format (plain string array)
    const old = localStorage.getItem("vault_custom_categories");
    if (old) {
      const names: string[] = JSON.parse(old);
      return names.map((name) => ({ name, emoji: "✨" }));
    }
    return [];
  } catch {
    return [];
  }
}

function saveCustomCategories(cats: CustomCategory[]) {
  localStorage.setItem("vault_custom_categories_v2", JSON.stringify(cats));
  window.dispatchEvent(new Event("storage"));
}

function loadHiddenDefaults(): string[] {
  try {
    const raw = localStorage.getItem("vault_hidden_default_categories");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHiddenDefaults(hidden: string[]) {
  localStorage.setItem("vault_hidden_default_categories", JSON.stringify(hidden));
  window.dispatchEvent(new Event("storage"));
}

export function InstallmentsPage() {
  const { data: breakdown } = useDashboardBreakdown();
  const { data: transactions } = useTransactions();

  const hasBreakdown = !!(breakdown && breakdown.length > 0);
  const hasTransactions = !!(transactions && transactions.length > 0);

  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(loadCustomCategories);
  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>(loadHiddenDefaults);

  const visibleDefaults = DEFAULT_CATEGORIES.filter((c) => !hiddenDefaults.includes(c));

  // Delete modal
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<string | null>(null);
  const deleteImpact = transactions?.filter((t) => t.category === confirmDeleteCat).length ?? 0;

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("📦");
  const createNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (createModalOpen) setTimeout(() => createNameRef.current?.focus(), 50);
  }, [createModalOpen]);

  const allCategoryNames = [
    ...visibleDefaults,
    ...customCategories.map((c) => c.name),
  ];

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
    setCreateModalOpen(false);
    setNewCatName("");
    setNewCatEmoji("📦");
  };

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="page-title">Historial de gastos</h1>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          Tus movimientos procesados y resumen por categoría.
        </p>
      </div>

      {!hasTransactions && (
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
            <Link to="/accounts" className="btn-primary">
              Ir a Mis cuentas
            </Link>
            <button type="button" className="btn-ghost">
              ¿Cómo funciona?
            </button>
          </div>
        </div>
      )}

      {hasBreakdown && (
        <div className="card-vault mb-5">
          <h2 className="mb-4 section-label">Resumen por categoría</h2>
          <p className="mb-4 text-xs text-vault-muted2 dark:text-[#8b949e]">
            Gastos del período actual agrupados por categoría.
          </p>
          <ul className="flex flex-col gap-2">
            {breakdown
              .slice()
              .sort((a, b) => b.pct_of_total - a.pct_of_total)
              .map((item) => (
                <li key={item.category} className="flex items-center gap-3">
                  <span className="w-32 truncate text-sm text-vault-text dark:text-[#e6edf3]">
                    {item.category}
                  </span>
                  <div className="flex-1 overflow-hidden rounded-full bg-vault-border dark:bg-[#30363d]">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.min(item.pct_of_total, 100)}%`,
                        backgroundColor: getCategoryColor(item.category),
                      }}
                    />
                  </div>
                  <span className="w-20 text-right text-xs tabular-nums text-vault-muted2 dark:text-[#8b949e]">
                    {formatCurrency(item.amount_ars, "ARS")}
                  </span>
                  <span className="w-10 text-right text-xs tabular-nums text-vault-muted2 dark:text-[#8b949e]">
                    {item.pct_of_total.toFixed(0)}%
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Mis categorías */}
      <div className="card-vault">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-label">Mis categorías</h2>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="rounded-vault border border-vault-accent/40 bg-vault-accent/10 px-3 py-1 text-xs font-medium text-vault-accent hover:bg-vault-accent/20"
          >
            + Nueva categoría
          </button>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}
        >
          {visibleDefaults.map((cat) => {
            const color = getCategoryColor(cat);
            return (
              <div
                key={cat}
                className="group relative flex flex-col gap-1.5 rounded-xl border p-3"
                style={{
                  borderColor: `${color}50`,
                  backgroundColor: `${color}12`,
                }}
              >
                <button
                  type="button"
                  onClick={() => setConfirmDeleteCat(cat)}
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-vault-muted2 opacity-0 transition-all hover:bg-vault-red/10 hover:text-vault-red group-hover:opacity-100 dark:text-[#8b949e]"
                  title="Eliminar"
                >
                  ×
                </button>
                <span style={{ fontSize: 20 }}>{CATEGORY_EMOJIS[cat] ?? "📦"}</span>
                <span className="text-xs font-medium text-vault-text dark:text-[#e6edf3]">{cat}</span>
              </div>
            );
          })}

          {customCategories.map((cat) => {
            const color = getCategoryColor(cat.name);
            return (
              <div
                key={cat.name}
                className="group relative flex flex-col gap-1.5 rounded-xl border p-3"
                style={{
                  borderColor: `${color}50`,
                  backgroundColor: `${color}12`,
                }}
              >
                <button
                  type="button"
                  onClick={() => setConfirmDeleteCat(cat.name)}
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-vault-muted2 opacity-0 transition-all hover:bg-vault-red/10 hover:text-vault-red group-hover:opacity-100 dark:text-[#8b949e]"
                  title="Eliminar"
                >
                  ×
                </button>
                <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                <span className="text-xs font-medium text-vault-text dark:text-[#e6edf3]">{cat.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: confirmar eliminación */}
      {confirmDeleteCat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmDeleteCat(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-vault-border bg-white p-6 shadow-xl dark:border-[#30363d] dark:bg-[#161b22]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-medium text-vault-text dark:text-[#e6edf3]">
              Eliminar "{confirmDeleteCat}"
            </h3>
            <p className="mb-5 text-sm text-vault-muted2 dark:text-[#8b949e]">
              {deleteImpact > 0 ? (
                <>
                  <span className="font-medium text-vault-yellow">{deleteImpact} transacción{deleteImpact !== 1 ? "es" : ""}</span>{" "}
                  quedar{deleteImpact !== 1 ? "án" : "á"} sin categoría.
                </>
              ) : (
                "No hay transacciones con esta categoría."
              )}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteCat(null)}
                className="flex-1 rounded-vault border border-vault-border py-2 text-sm text-vault-muted2 hover:text-vault-text dark:border-[#30363d] dark:text-[#8b949e]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex-1 rounded-vault border border-vault-red/30 bg-vault-red/10 py-2 text-sm font-medium text-vault-red hover:bg-vault-red/20"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: crear categoría */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-vault-border bg-white p-6 shadow-xl dark:border-[#30363d] dark:bg-[#161b22]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-base font-medium text-vault-text dark:text-[#e6edf3]">
              Nueva categoría
            </h3>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                Nombre
              </label>
              <input
                ref={createNameRef}
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateCategory();
                  if (e.key === "Escape") setCreateModalOpen(false);
                }}
                placeholder="Ej: Mascotas"
                className="input-vault"
                maxLength={30}
              />
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                Ícono —{" "}
                <span className="text-base">{newCatEmoji}</span>
              </label>
              <div
                style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}
              >
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewCatEmoji(emoji)}
                    className={`flex items-center justify-center rounded-lg py-1 text-base transition-colors hover:bg-vault-s2 dark:hover:bg-[#21262d] ${
                      newCatEmoji === emoji
                        ? "bg-vault-accent/10 ring-1 ring-vault-accent/40"
                        : ""
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="flex-1 rounded-vault border border-vault-border py-2 text-sm text-vault-muted2 hover:text-vault-text dark:border-[#30363d] dark:text-[#8b949e]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={!newCatName.trim()}
                className="flex-1 rounded-vault bg-vault-accent py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
