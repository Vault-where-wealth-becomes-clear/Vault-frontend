import { useState } from "react";
import { useInstallments, useUpdateInstallment, type Installment } from "@/api/installments.api";
import { extractErrorMessage } from "@/utils/apiError";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

export function InstallmentsPage() {
  const { data: installments, isLoading } = useInstallments();
  const updateInstallment = useUpdateInstallment();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="font-syne text-2xl font-bold">Cuotas</h1>
        <p className="text-sm text-vault-muted2">
          Cuotas detectadas en tus tarjetas de crédito, ordenadas por próximo vencimiento.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
          {error}
        </div>
      )}

      <div className="card-vault">
        {isLoading ? (
          <p className="text-sm text-vault-muted2">Cargando...</p>
        ) : !installments || installments.length === 0 ? (
          <p className="text-sm text-vault-muted2">No tenés cuotas pendientes registradas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-vault-border text-left text-xs text-vault-muted2">
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
                  <td className="py-2.5 text-vault-text">{installment.description}</td>
                  <td className="py-2.5 text-vault-muted2">
                    {installment.current_installment}/{installment.total_installments}
                  </td>
                  <td className="py-2.5 font-mono text-vault-text">
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
                  <td className="py-2.5 text-vault-muted2">
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
                        className="text-xs font-medium text-vault-muted2 hover:text-vault-text"
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
    </div>
  );
}
