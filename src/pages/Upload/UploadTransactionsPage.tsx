import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUploads } from "@/api/uploads.api";
import { useAccounts } from "@/api/accounts.api";
import {
  useUploadTransactions,
  useCorrectTransaction,
  useConfirmReview,
  STANDARD_CATEGORIES,
} from "@/api/transactions.api";
import { formatCurrency } from "@/utils/formatCurrency";
import { extractErrorMessage } from "@/utils/apiError";

const CREDIT_CARD_TYPES = new Set(["credit_card_ars", "credit_card_usd"]);

function loadAllCategories(): string[] {
  try {
    const raw = localStorage.getItem("vault_custom_categories_v2");
    const custom: Array<{ name: string }> = raw ? JSON.parse(raw) : [];
    return [...STANDARD_CATEGORIES, ...custom.map((c) => c.name)];
  } catch {
    return [...STANDARD_CATEGORIES];
  }
}

export function UploadTransactionsPage() {
  const { uploadId } = useParams<{ uploadId: string }>();
  const navigate = useNavigate();

  const { data: uploads } = useUploads();
  const { data: accounts } = useAccounts();
  const { data: transactions, isLoading } = useUploadTransactions(uploadId ?? null);
  const correctTransaction = useCorrectTransaction();
  const confirmReview = useConfirmReview();

  const [allCategories, setAllCategories] = useState<string[]>(loadAllCategories);

  // Re-sync if user adds categories in another tab or via InstallmentsPage
  useEffect(() => {
    const onStorage = () => setAllCategories(loadAllCategories());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const upload = uploads?.find((u) => u.id === uploadId);
  const account = accounts?.find((a) => a.id === upload?.account_id);
  const isCreditCard = account ? CREDIT_CARD_TYPES.has(account.account_type) : false;
  const isUsd = account?.currency === "USD";

  const [year, month] = (upload?.period_month ?? "2000-01-01").split("-").map(Number);
  const periodLabel = new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });

  const changedCount = Object.keys(edits).length;

  // For libro diario: sort ASC and compute running saldo
  const libroRows = useMemo(() => {
    if (!transactions) return [];
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    let saldo = 0;
    return sorted.map((txn) => {
      const amount = isUsd && txn.amount_usd != null ? txn.amount_usd : txn.amount_ars;
      saldo += amount;
      return { txn, amount, saldo };
    });
  }, [transactions, isUsd]);

  const handleSave = async () => {
    if (!changedCount) return;
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all(
        Object.entries(edits).map(([txnId, category]) =>
          correctTransaction.mutateAsync({ transactionId: txnId, category, rememberRule: false })
        )
      );
      setEdits({});
    } catch (err) {
      setSaveError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReview = async () => {
    if (!uploadId) return;
    setConfirming(true);
    setSaveError(null);
    try {
      await confirmReview.mutateAsync(uploadId);
      navigate("/accounts");
    } catch (err) {
      setSaveError(extractErrorMessage(err));
      setConfirming(false);
    }
  };

  const currency = isUsd ? "USD" : "ARS";

  const thClass =
    "px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]";
  const thClassRight = thClass + " text-right";

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-vault-muted2 dark:text-[#8b949e]">
        Cargando transacciones...
      </div>
    );
  }

  return (
    <div className="p-7">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-vault border border-vault-border text-vault-muted2 hover:border-vault-accent hover:text-vault-accent dark:text-[#8b949e]"
            aria-label="Volver"
          >
            ‹
          </button>
          <div>
            <h1 className="page-title capitalize">{periodLabel}</h1>
            <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
              {account?.name && <span className="mr-2">{account.name} ·</span>}
              {transactions?.length ?? 0} transacciones
            </p>
          </div>
        </div>

        {changedCount > 0 && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Guardando..." : `Guardar cambios (${changedCount})`}
          </button>
        )}
      </div>

      {saveError && (
        <div className="mb-4 rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
          {saveError}
        </div>
      )}

      {upload?.status === "review" && (
        <div className="mb-4 flex items-center gap-3 rounded-vault border border-vault-yellow/30 bg-vault-yellow/5 px-4 py-3 text-sm">
          <span className="font-medium text-vault-yellow">Pendiente de revisión</span>
          <span className="text-vault-muted2 dark:text-[#8b949e]">
            Corregí las categorías y luego confirmá.
          </span>
          <button
            type="button"
            onClick={handleConfirmReview}
            disabled={confirming || changedCount > 0}
            className="ml-auto rounded border border-vault-yellow/40 bg-vault-yellow/10 px-3 py-1 text-xs font-medium text-vault-yellow hover:bg-vault-yellow/20 disabled:opacity-40"
          >
            {confirming ? "Confirmando..." : "Confirmar revisión"}
          </button>
          {changedCount > 0 && (
            <span className="text-xs text-vault-muted2 dark:text-[#8b949e]">
              (guardá los cambios primero)
            </span>
          )}
        </div>
      )}

      <div className="card-vault overflow-hidden p-0">
        {!transactions || transactions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-vault-muted2 dark:text-[#8b949e]">
            No hay transacciones para este extracto.
          </div>
        ) : isCreditCard ? (
          /* ── Formato tarjeta: Fecha | Descripción | Monto | Categoría ── */
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-vault-border dark:border-[#30363d]">
                <th className={thClass}>Fecha</th>
                <th className={thClass}>Descripción</th>
                <th className={thClassRight}>Monto</th>
                <th className={thClass}>Categoría</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn, i) => {
                const currentCategory = edits[txn.id] ?? txn.category ?? "";
                const isEdited = txn.id in edits;
                return (
                  <tr
                    key={txn.id}
                    className={`border-b border-vault-border/50 last:border-b-0 transition-colors dark:border-[#30363d]/50 ${
                      isEdited ? "bg-vault-accent/5" : i % 2 !== 0 ? "bg-vault-s2/40 dark:bg-[#161b22]/40" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-vault-muted2 dark:text-[#8b949e]">
                      {new Date(txn.date + "T12:00:00").toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="max-w-[260px] px-4 py-2.5">
                      <p className="truncate text-vault-text dark:text-[#e6edf3]">{txn.description}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                      <span className={txn.amount_ars >= 0 ? "text-vault-green" : "text-vault-text dark:text-[#e6edf3]"}>
                        {formatCurrency(Math.abs(txn.amount_ars), "ARS")}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={currentCategory}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                        className="input-vault py-1 text-xs"
                      >
                        <option value="">Sin categoría</option>
                        {allCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* ── Formato libro diario: Fecha | Descripción | Debe | Haber | Saldo | Categoría ── */
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-vault-border dark:border-[#30363d]">
                <th className={thClass}>Fecha</th>
                <th className={thClass}>Descripción</th>
                <th className={thClassRight}>Débito</th>
                <th className={thClassRight}>Crédito</th>
                <th className={thClassRight}>Saldo</th>
                <th className={thClass}>Categoría</th>
              </tr>
            </thead>
            <tbody>
              {libroRows.map(({ txn, amount, saldo }, i) => {
                const currentCategory = edits[txn.id] ?? txn.category ?? "";
                const isEdited = txn.id in edits;
                const isDebe = amount < 0;
                return (
                  <tr
                    key={txn.id}
                    className={`border-b border-vault-border/50 last:border-b-0 transition-colors dark:border-[#30363d]/50 ${
                      isEdited ? "bg-vault-accent/5" : i % 2 !== 0 ? "bg-vault-s2/40 dark:bg-[#161b22]/40" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-vault-muted2 dark:text-[#8b949e]">
                      {new Date(txn.date + "T12:00:00").toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="max-w-[220px] px-4 py-2.5">
                      <p className="truncate text-vault-text dark:text-[#e6edf3]">{txn.description}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-vault-red">
                      {isDebe ? formatCurrency(Math.abs(amount), currency) : ""}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-vault-green">
                      {!isDebe ? formatCurrency(Math.abs(amount), currency) : ""}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-medium ${saldo >= 0 ? "text-vault-green" : "text-vault-red"}`}>
                      {formatCurrency(Math.abs(saldo), currency)}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={currentCategory}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                        className="input-vault py-1 text-xs"
                      >
                        <option value="">Sin categoría</option>
                        {allCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
