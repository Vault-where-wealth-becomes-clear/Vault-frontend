import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useInstallments } from "@/api/installments.api";

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

function loadCustomCategories(): string[] {
  try {
    return JSON.parse(localStorage.getItem("vault_custom_categories") ?? "[]");
  } catch {
    return [];
  }
}

export function InstallmentsPage() {
  const { data: installments } = useInstallments();

  const [customCategories, setCustomCategories] = useState<string[]>(loadCustomCategories);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingCategory) addInputRef.current?.focus();
  }, [addingCategory]);

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      setAddingCategory(false);
      return;
    }
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

      <div className="card-vault">
        <h2 className="mb-4 section-label">Mis categorías</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
            gap: 8,
          }}
        >
          {DEFAULT_CATEGORIES.map((cat) => (
            <div
              key={cat}
              className="flex flex-col gap-1.5 rounded-xl border border-vault-border p-3 dark:border-[#30363d]"
            >
              <span style={{ fontSize: 20 }}>{CATEGORY_EMOJIS[cat] ?? "📦"}</span>
              <span className="text-xs font-medium text-vault-text dark:text-[#e6edf3]">{cat}</span>
            </div>
          ))}

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

          {addingCategory ? (
            <div className="flex flex-col gap-1.5 rounded-xl border-2 border-dashed border-vault-accent/40 p-3">
              <input
                ref={addInputRef}
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCategory();
                  }
                  if (e.key === "Escape") {
                    setAddingCategory(false);
                    setNewCategory("");
                  }
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
              <span className="text-vault-muted2 dark:text-[#8b949e]" style={{ fontSize: 20 }}>
                +
              </span>
              <span className="text-xs text-vault-muted2 dark:text-[#8b949e]">Nueva</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
