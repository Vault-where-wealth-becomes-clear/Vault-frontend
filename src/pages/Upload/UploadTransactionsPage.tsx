import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUploads } from "@/api/uploads.api";
import { useAccounts, getAccountDisplayName } from "@/api/accounts.api";
import {
  useUploadTransactions,
  useCorrectTransaction,
  useConfirmReview,
  STANDARD_CATEGORIES,
} from "@/api/transactions.api";
import { formatCurrency } from "@/utils/formatCurrency";
import { extractErrorMessage } from "@/utils/apiError";
import { getCategoryColor } from "@/utils/categoryColors";

const CREDIT_CARD_TYPES = new Set(["credit_card_ars", "credit_card_usd"]);

function CategorySelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (cat: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const color = value ? getCategoryColor(value) : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors ${
          color
            ? "text-vault-text dark:text-[#e6edf3]"
            : "border-vault-border text-vault-muted2 dark:border-[#30363d] dark:text-[#8b949e]"
        }`}
        style={color ? { backgroundColor: `${color}18`, borderColor: `${color}45` } : undefined}
      >
        {color && (
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
        )}
        <span>{value || "Sin categoría"}</span>
        <span className="ml-0.5 text-[9px] opacity-40">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-52 w-44 overflow-y-auto rounded-lg border border-vault-border bg-white shadow-lg dark:border-[#30363d] dark:bg-[#161b22]">
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-vault-s2 dark:hover:bg-[#21262d]"
          >
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#9E9E9E]" />
            <span className="text-vault-muted2 dark:text-[#8b949e]">Sin categoría</span>
          </button>
          {options.map((cat) => {
            const c = getCategoryColor(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => { onChange(cat); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-vault-s2 dark:hover:bg-[#21262d] ${
                  cat === value ? "bg-vault-s2 dark:bg-[#21262d]" : ""
                }`}
              >
                <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: c }} />
                <span className="text-vault-text dark:text-[#e6edf3]">{cat}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

  // Credit card summary (ARS and USD totals, split by Impuestos)
  // Only counts negative amounts — credits like CR.RG are excluded from expense totals
  const ccSummary = useMemo(() => {
    if (!isCreditCard || !transactions) return null;
    let arsConsumos = 0;
    let usdConsumos = 0;
    let arsImpuestos = 0;
    let usdImpuestos = 0;
    for (const txn of transactions) {
      const cat = (edits[txn.id] ?? txn.category ?? "").toLowerCase();
      const isImpuesto = cat === "impuestos";
      if (txn.currency === "USD" && txn.amount_usd != null && txn.amount_usd < 0) {
        if (isImpuesto) usdImpuestos += Math.abs(txn.amount_usd);
        else usdConsumos += Math.abs(txn.amount_usd);
      } else if (txn.currency !== "USD" && txn.amount_ars < 0) {
        if (isImpuesto) arsImpuestos += Math.abs(txn.amount_ars);
        else arsConsumos += Math.abs(txn.amount_ars);
      }
    }
    return { arsConsumos, usdConsumos, arsImpuestos, usdImpuestos, arsTotal: arsConsumos + arsImpuestos };
  }, [isCreditCard, transactions, edits]);

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
              {account && <span className="mr-2">{getAccountDisplayName(account)} ·</span>}
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

      {ccSummary && (
        <div className="mb-4 grid grid-cols-4 gap-3">
          <div className="rounded-vault border border-vault-border bg-white px-4 py-3 dark:border-[#30363d] dark:bg-[#161b22]">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
              Consumos ARS
            </p>
            <p className="text-base font-medium tabular-nums text-vault-text dark:text-[#e6edf3]">
              {formatCurrency(ccSummary.arsConsumos, "ARS")}
            </p>
          </div>
          {ccSummary.usdConsumos > 0 && (
            <div className="rounded-vault border border-vault-border bg-white px-4 py-3 dark:border-[#30363d] dark:bg-[#161b22]">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                Consumos USD
              </p>
              <p className="text-base font-medium tabular-nums text-vault-text dark:text-[#e6edf3]">
                {formatCurrency(ccSummary.usdConsumos, "USD")}
              </p>
            </div>
          )}
          {(ccSummary.arsImpuestos > 0 || ccSummary.usdImpuestos > 0) && (
            <div className="rounded-vault border border-vault-yellow/30 bg-vault-yellow/5 px-4 py-3 dark:border-vault-yellow/20">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-vault-yellow/80">
                Impuestos y percepciones
              </p>
              {ccSummary.arsImpuestos > 0 && (
                <p className="text-base font-medium tabular-nums text-vault-text dark:text-[#e6edf3]">
                  {formatCurrency(ccSummary.arsImpuestos, "ARS")}
                </p>
              )}
              {ccSummary.usdImpuestos > 0 && (
                <p className="text-sm tabular-nums text-vault-muted2 dark:text-[#8b949e]">
                  {formatCurrency(ccSummary.usdImpuestos, "USD")}
                </p>
              )}
            </div>
          )}
          <div className="rounded-vault border border-vault-accent/30 bg-vault-accent/5 px-4 py-3 dark:border-vault-accent/20">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-vault-accent/70">
              Total ARS
            </p>
            <p className="text-base font-medium tabular-nums text-vault-text dark:text-[#e6edf3]">
              {formatCurrency(ccSummary.arsTotal, "ARS")}
            </p>
            <p className="mt-0.5 text-[10px] text-vault-muted2 dark:text-[#8b949e]">
              consumos + impuestos
            </p>
          </div>
        </div>
      )}

      <div className="card-vault overflow-hidden p-0">
        {!transactions || transactions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-vault-muted2 dark:text-[#8b949e]">
            No hay transacciones para este extracto.
          </div>
        ) : isCreditCard ? (
          /* ── Formato tarjeta: Fecha | Descripción | Monto | Moneda | Categoría ── */
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-vault-border dark:border-[#30363d]">
                <th className={thClass}>Fecha</th>
                <th className={thClass}>Descripción</th>
                <th className={thClassRight}>Monto</th>
                <th className={thClass}>Moneda</th>
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
                      <span className="text-vault-text dark:text-[#e6edf3]">
                        {txn.currency === "USD" && txn.amount_usd != null
                          ? formatCurrency(Math.abs(txn.amount_usd), "USD")
                          : formatCurrency(Math.abs(txn.amount_ars), "ARS")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                          txn.currency === "USD"
                            ? "bg-vault-accent/10 text-vault-accent"
                            : "bg-vault-s2 text-vault-muted2 dark:bg-[#21262d] dark:text-[#8b949e]"
                        }`}
                      >
                        {txn.currency}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <CategorySelect
                        value={currentCategory}
                        options={allCategories}
                        onChange={(cat) => setEdits((prev) => ({ ...prev, [txn.id]: cat }))}
                      />
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
              {(() => {
                const openingBalance = isUsd
                  ? (upload?.opening_balance_usd ?? 0)
                  : (upload?.opening_balance_ars ?? 0);
                return openingBalance !== 0 ? (
                  <tr className="border-b border-vault-border/50 dark:border-[#30363d]/50 bg-vault-s2/50 dark:bg-[#21262d]/40">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-vault-muted2 dark:text-[#8b949e]">
                      —
                    </td>
                    <td className="px-4 py-2 text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                      Saldo anterior
                    </td>
                    <td /><td />
                    <td className={`whitespace-nowrap px-4 py-2 text-right tabular-nums text-xs font-semibold ${
                      openingBalance >= 0 ? "text-vault-green" : "text-vault-red"
                    }`}>
                      {formatCurrency(Math.abs(openingBalance), currency)}
                    </td>
                    <td />
                  </tr>
                ) : null;
              })()}
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
                      <CategorySelect
                        value={currentCategory}
                        options={allCategories}
                        onChange={(cat) => setEdits((prev) => ({ ...prev, [txn.id]: cat }))}
                      />
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
