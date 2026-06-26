import { useState } from "react";
import { useInstallments, useUpdateInstallment, type Installment } from "@/api/installments.api";
import { extractErrorMessage } from "@/utils/apiError";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

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

function loadCustomCategories(): string[] {
  try {
    return JSON.parse(localStorage.getItem("vault_custom_categories") ?? "[]");
  } catch {
    return [];
  }
}

export function InstallmentsPage() {
  const { data: installments, isLoading } = useInstallments();
  const updateInstallment = useUpdateInstallment();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [customCategories, setCustomCategories] = useState<string[]>(loadCustomCategories);
  const [newCategory, setNewCategory] = useState("");

  const startEdit = (installment: Installment) => {
    setEditingId(installment.id);
    setAmountDraft(String(installment.amount_per_installment));
    setError(null);
  };

  const saveEdit = async (installmentId: string) => {
    const amount = Number(amountDraft);
    if (!amount || amount <= 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    setError(null);
    try {
      await updateInstallment.mutateAsync({ installmentId, amountPerInstallment: amount });
      setEditingId(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    const all = [...DEFAULT_CATEGORIES, ...customCategories];
    if (all.map((c) => c.toLowerCase()).includes(trimmed.toLowerCase())) return;
    const updated = [...customCategories, trimmed];
    setCustomCategories(updated);
    localStorage.setItem("vault_custom_categories", JSON.stringify(updated));
    setNewCategory("");
  };

  const removeCategory = (category: string) => {
    const updated = customCategories.filter((c) => c !== category);
    setCustomCategories(updated);
    localStorage.setItem("vault_custom_categories", JSON.stringify(updated));
  };

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="page-title">Historial de gastos</h1>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          Tus movimientos procesados y compromisos futuros detectados.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
          {error}
        </div>
      )}

      <div className="card-vault">
        {isLoading ? (
          <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">Cargando...</p>
        ) : !installments || installments.length === 0 ? (
          <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">No tenés cuotas pendientes registradas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-vault-border text-left text-xs text-vault-muted2 dark:text-[#8b949e]">
                <th className="pb-2 font-medium">Descripción</th>
                <th className="pb-2 font-medium">Cuota</th>
                <th className="pb-2 font-medium">Monto</th>
                <th className="pb-2 font-medium">Próximo vencimiento</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {installments.map((installment) => (
                <tr key={installment.id} className="border-b border-vault-border last:border-0">
                  <td className="py-2.5 text-vault-text dark:text-[#e6edf3]">{installment.description}</td>
                  <td className="py-2.5 text-vault-muted2 dark:text-[#8b949e]">
                    {installment.current_installment}/{installment.total_installments}
                  </td>
                  <td className="py-2.5 tabular-nums text-vault-text dark:text-[#e6edf3]">
                    {editingId === installment.id ? (
                      <input
                        type="number"
                        step="0.01"
                        autoFocus
                        value={amountDraft}
                        onChange={(e) => setAmountDraft(e.target.value)}
                        className="input-vault w-28 py-1"
                      />
                    ) : (
                      formatCurrency(installment.amount_per_installment, installment.currency)
                    )}
                  </td>
                  <td className="py-2.5 text-vault-muted2 dark:text-[#8b949e]">
                    {installment.next_due_date ? formatDate(installment.next_due_date) : "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    {editingId === installment.id ? (
                      <button
                        onClick={() => saveEdit(installment.id)}
                        disabled={updateInstallment.isPending}
                        className="text-xs font-medium text-vault-accent hover:underline"
                      >
                        Guardar
                      </button>
                    ) : (
                      <button
                        onClick={() => startEdit(installment)}
                        className="text-xs font-medium text-vault-muted2 dark:text-[#8b949e] hover:text-vault-text"
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card-vault mt-4">
        <h2 className="mb-3 section-label">Mis categorías</h2>

        <div className="mb-3 flex flex-wrap gap-2">
          {DEFAULT_CATEGORIES.map((cat) => (
            <span
              key={cat}
              className="rounded-full border border-vault-border bg-vault-s2 dark:bg-[#21262d] px-3 py-1 text-xs text-vault-muted2 dark:text-[#8b949e]"
            >
              {cat}
            </span>
          ))}
          {customCategories.map((cat) => (
            <span
              key={cat}
              className="flex items-center gap-1 rounded-full border border-vault-accent/30 bg-[#eff6ff] px-3 py-1 text-xs text-vault-accent"
            >
              {cat}
              <button
                type="button"
                onClick={() => removeCategory(cat)}
                className="ml-0.5 leading-none text-vault-accent/60 transition-colors hover:text-vault-red"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            placeholder="Nueva categoría..."
            className="input-vault flex-1"
          />
          <button type="button" onClick={addCategory} className="btn-primary px-3 py-2.5">
            +
          </button>
        </div>
      </div>
    </div>
  );
}
