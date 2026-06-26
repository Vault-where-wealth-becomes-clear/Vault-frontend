import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  STANDARD_CATEGORIES,
  useConfirmReview,
  useCorrectTransaction,
  useReviewQueue,
} from "@/api/transactions.api";
import { extractErrorMessage } from "@/utils/apiError";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

export function ReviewPage() {
  const { uploadId } = useParams<{ uploadId: string }>();
  const navigate = useNavigate();
  const { data: transactions, isLoading } = useReviewQueue(uploadId ?? null);
  const correctTransaction = useCorrectTransaction();
  const confirmReview = useConfirmReview();

  const [categoryByTxn, setCategoryByTxn] = useState<Record<string, string>>({});
  const [rememberByTxn, setRememberByTxn] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (transactionId: string) => {
    const category = categoryByTxn[transactionId];
    if (!category) {
      setError("Elegí una categoría antes de guardar.");
      return;
    }
    setError(null);
    try {
      await correctTransaction.mutateAsync({
        transactionId,
        category,
        rememberRule: rememberByTxn[transactionId] ?? false,
      });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleConfirm = async () => {
    if (!uploadId) return;
    setError(null);
    try {
      await confirmReview.mutateAsync(uploadId);
      navigate("/upload");
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-vault-muted2 dark:text-[#8b949e]">
        Cargando transacciones a revisar...
      </div>
    );
  }

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="page-title">Revisar transacciones</h1>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          La IA no pudo categorizar estas transacciones con suficiente confianza. Asignales una
          categoría para terminar de procesar el extracto.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
          {error}
        </div>
      )}

      {!transactions || transactions.length === 0 ? (
        <div className="card-vault">
          <p className="mb-4 text-sm text-vault-muted2 dark:text-[#8b949e]">
            No quedan transacciones pendientes de revisión para este extracto.
          </p>
          <button onClick={handleConfirm} disabled={confirmReview.isPending} className="btn-primary">
            {confirmReview.isPending ? "Confirmando..." : "Confirmar y finalizar"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {transactions.map((txn) => (
            <div
              key={txn.id}
              className="card-vault flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-vault-text dark:text-[#e6edf3]">{txn.description}</p>
                <p className="text-xs text-vault-muted2 dark:text-[#8b949e]">
                  {formatDate(txn.date)} ·{" "}
                  {formatCurrency(txn.amount_ars, "ARS")}
                  {txn.confidence !== null && ` · confianza ${(txn.confidence * 100).toFixed(0)}%`}
                </p>
              </div>

              <select
                value={categoryByTxn[txn.id] ?? ""}
                onChange={(e) => setCategoryByTxn((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                className="input-vault w-48"
              >
                <option value="" disabled>
                  Elegí categoría
                </option>
                {STANDARD_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 text-xs text-vault-muted2 dark:text-[#8b949e]">
                <input
                  type="checkbox"
                  checked={rememberByTxn[txn.id] ?? false}
                  onChange={(e) =>
                    setRememberByTxn((prev) => ({ ...prev, [txn.id]: e.target.checked }))
                  }
                />
                Recordar regla
              </label>

              <button
                onClick={() => handleSave(txn.id)}
                disabled={correctTransaction.isPending}
                className="btn-primary"
              >
                Guardar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
