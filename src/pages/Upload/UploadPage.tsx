import { useState, useRef, useEffect, useMemo, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAccounts, getAccountDisplayName, type AccountType } from "@/api/accounts.api";
import {
  useSubmitUpload,
  useUploadStatus,
  useUploads,
  useDeleteUpload,
  type Upload,
  type UploadStatus,
} from "@/api/uploads.api";
import {
  useExchangeRates,
  useRecalculatePeriod,
  useSetExchangeRate,
} from "@/api/exchangeRates.api";
import { useMepQuote } from "@/api/mepQuote.api";
import type { SkillModule } from "@/components/upload/ModuleSelector";
import { extractErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/formatDate";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getModulesForAccountType(accountType: AccountType): SkillModule[] {
  if (accountType === "credit_card_ars" || accountType === "credit_card_usd") {
    return ["flujo_mensual", "compromisos_futuros"];
  }
  if (accountType === "broker") return ["cuenta_comitente", "tablero_general"];
  if (accountType === "crypto") return ["flujo_mensual"];
  return ["flujo_mensual", "categorizacion_gasto", "tablero_general"];
}

function periodLabel(periodMonth: string): string {
  const [year, month] = periodMonth.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

const STATUS_LABELS: Record<UploadStatus, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  review: "Necesita revisión",
  done: "Completado",
  error: "Error",
};

const STATUS_COLORS: Record<UploadStatus, string> = {
  pending: "text-vault-muted2 dark:text-[#8b949e]",
  processing: "text-vault-accent",
  review: "text-vault-yellow",
  done: "text-vault-green",
  error: "text-vault-red",
};

export function UploadPage() {
  const { data: accounts, isLoading: isLoadingAccounts } = useAccounts();
  const { data: uploads } = useUploads();
  const submitUpload = useSubmitUpload();
  const { data: exchangeRates } = useExchangeRates();
  const setExchangeRate = useSetExchangeRate();
  const recalculatePeriod = useRecalculatePeriod();
  const { data: mepQuote, isLoading: isLoadingMep, isError: isMepError } = useMepQuote();
  const deleteUpload = useDeleteUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [accountId, setAccountId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [mepRateInput, setMepRateInput] = useState("");
  const [mepEditedByUser, setMepEditedByUser] = useState(false);

  const { data: activeStatus } = useUploadStatus(activeUploadId);

  const monthPrefix = selectedMonth;
  const declaredRate = exchangeRates?.find((r) => r.period_month.startsWith(monthPrefix));

  useEffect(() => {
    if (declaredRate || mepEditedByUser || !mepQuote) return;
    setMepRateInput(String(mepQuote.venta));
  }, [declaredRate, mepEditedByUser, mepQuote]);

  useEffect(() => {
    setMepEditedByUser(false);
  }, [monthPrefix]);

  const selectedAccount = accounts?.find((a) => a.id === accountId);
  const requestedModules: SkillModule[] = selectedAccount
    ? getModulesForAccountType(selectedAccount.account_type)
    : ["flujo_mensual"];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !accountId) return;
    setError(null);
    try {
      const periodMonth = `${selectedMonth}-01`;
      if (!declaredRate) {
        const rateValue = Number(mepRateInput);
        if (rateValue > 0) {
          await setExchangeRate.mutateAsync({ periodMonth, mepRate: rateValue });
        }
      }
      if (declaredRate || Number(mepRateInput) > 0) {
        await recalculatePeriod.mutateAsync(periodMonth);
      }
      const uploadId = await submitUpload.mutateAsync({
        accountId,
        periodMonth,
        file,
        requestedModules,
      });
      setActiveUploadId(uploadId);
      setFile(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const accountMap = useMemo(() => new Map(accounts?.map((a) => [a.id, a]) ?? []), [accounts]);

  // Agrupar historial por período (YYYY-MM), más reciente primero
  const periodGroups = useMemo(() => {
    const map = new Map<string, Upload[]>();
    (uploads ?? []).forEach((u) => {
      const key = u.period_month.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(u);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [uploads]);

  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

  useEffect(() => {
    if (!hasAutoExpanded && periodGroups.length > 0) {
      setExpandedPeriods(new Set([periodGroups[0][0]]));
      setHasAutoExpanded(true);
    }
  }, [periodGroups, hasAutoExpanded]);

  const togglePeriod = (key: string) => {
    setExpandedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Modal: eliminar upload del historial
  const [deleteTarget, setDeleteTarget] = useState<Upload | null>(null);

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="page-title">Cargar extracto</h1>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          Subí un PDF o XLSX de tu cuenta para que la IA lo categorice automáticamente.
        </p>
      </div>

      {/* Sección 1: Formulario */}
      <div className="card-vault mb-5">
        <h2 className="section-label mb-4">Subir nuevo extracto</h2>
        {!accounts || accounts.length === 0 ? (
          <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
            {isLoadingAccounts
              ? "Cargando cuentas..."
              : 'Primero creá una cuenta en "Mis cuentas" para poder cargar un extracto.'}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                  Cuenta
                </label>
                <select
                  required
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="input-vault"
                >
                  <option value="" disabled>
                    Seleccioná una cuenta
                  </option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {getAccountDisplayName(account)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                  Mes
                </label>
                <input
                  type="month"
                  required
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input-vault"
                />
              </div>
            </div>

            <div className="rounded-vault border border-vault-border bg-vault-s2 dark:bg-[#21262d] px-3.5 py-2.5 text-sm">
              {declaredRate ? (
                <div className="flex items-center justify-between">
                  <span className="text-vault-muted2 dark:text-[#8b949e]">TC MEP declarado</span>
                  <span className="tabular-nums font-medium text-vault-text dark:text-[#e6edf3]">
                    ${declaredRate.mep_rate.toFixed(2)}
                  </span>
                </div>
              ) : isLoadingMep ? (
                <div className="h-4 w-40 animate-pulse rounded bg-vault-border dark:bg-[#30363d]" />
              ) : isMepError && !mepQuote ? (
                <p className="text-xs text-vault-yellow">
                  No se pudo obtener el TC MEP automáticamente. Ingresalo manualmente abajo.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                      TC MEP (auto)
                      {mepQuote?.fuente === "cache" && (
                        <span
                          title="Valor desactualizado — no se pudo refrescar"
                          className="ml-1.5 text-vault-yellow"
                        >
                          ⚠ desactualizado
                        </span>
                      )}
                    </label>
                    {mepQuote && (
                      <span className="text-xs text-vault-muted2 dark:text-[#8b949e]">
                        Actualizado: {formatDateTime(mepQuote.fechaActualizacion)}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={mepRateInput}
                    onChange={(e) => {
                      setMepRateInput(e.target.value);
                      setMepEditedByUser(true);
                    }}
                    placeholder="1250.00"
                    className="input-vault"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                Archivo
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center justify-between rounded-lg border border-vault-green/30 bg-vault-green/5 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-vault-green">✓</span>
                    <span className="truncate text-xs text-vault-text dark:text-[#e6edf3]">
                      {file.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="ml-2 text-xs text-vault-muted2 transition-colors hover:text-vault-red dark:text-[#8b949e]"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) setFile(f);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed px-4 py-8 text-center transition-colors ${
                    isDragging
                      ? "border-vault-accent bg-vault-accent/5"
                      : "border-vault-border2 dark:border-[#484f58]"
                  }`}
                >
                  <span className="text-2xl text-vault-muted2 dark:text-[#8b949e]">↑</span>
                  <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
                    Arrastrá tu PDF o XLSX acá
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 rounded border border-vault-border2 px-3 py-1 text-xs text-vault-muted2 transition-colors hover:border-vault-accent hover:text-vault-accent dark:border-[#484f58] dark:text-[#8b949e]"
                  >
                    Seleccionar archivo
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitUpload.isPending || !file || !accountId}
              className="btn-primary"
            >
              {submitUpload.isPending ? "Subiendo..." : "Subir extracto"}
            </button>
          </form>
        )}

        {activeStatus && (
          <div className="mt-4 rounded-vault border border-vault-border bg-vault-s2 dark:bg-[#21262d] px-3.5 py-2.5 text-sm">
            Estado:{" "}
            <span className={`font-medium ${STATUS_COLORS[activeStatus.status]}`}>
              {STATUS_LABELS[activeStatus.status]}
            </span>
            {activeStatus.error_message && (
              <p className="mt-1 text-xs text-vault-red">{activeStatus.error_message}</p>
            )}
            {activeStatus.status === "review" && (
              <Link
                to={`/uploads/${activeStatus.upload_id}/review`}
                className="mt-2 inline-block text-xs font-medium text-vault-accent hover:underline"
              >
                Revisar transacciones pendientes →
              </Link>
            )}
            {activeStatus.pending_mep && (
              <p className="mt-2 text-xs text-vault-yellow">
                Falta declarar el TC MEP de este período —{" "}
                <Link to="/settings" className="underline">
                  declaralo en Configuración
                </Link>{" "}
                para que el total en USD sea correcto.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Sección 2: Historial, agrupado por período */}
      <div className="card-vault">
        <h2 className="section-label mb-4">Historial de uploads</h2>
        {!uploads || uploads.length === 0 ? (
          <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
            Todavía no subiste ningún extracto.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {periodGroups.map(([periodKey, periodUploads]) => {
              const expanded = expandedPeriods.has(periodKey);
              return (
                <div
                  key={periodKey}
                  className="overflow-hidden rounded-lg border border-vault-border dark:border-[#30363d]"
                >
                  <button
                    type="button"
                    onClick={() => togglePeriod(periodKey)}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-sm transition-colors hover:bg-vault-s2 dark:hover:bg-[#21262d]"
                  >
                    <span className="flex-1 text-left font-medium capitalize text-vault-text dark:text-[#e6edf3]">
                      {periodLabel(`${periodKey}-01`)}
                    </span>
                    <span className="text-xs text-vault-muted2 dark:text-[#8b949e]">
                      {periodUploads.length} {periodUploads.length === 1 ? "extracto" : "extractos"}
                    </span>
                    <span
                      className="inline-block text-vault-muted2 transition-transform duration-200 dark:text-[#8b949e]"
                      style={{ transform: expanded ? "rotate(90deg)" : "none" }}
                    >
                      ›
                    </span>
                  </button>

                  {expanded && (
                    <div className="flex flex-col gap-2 border-t border-vault-border p-2 dark:border-[#30363d]">
                      {periodUploads.map((upload) => {
                        const account = accountMap.get(upload.account_id);
                        return (
                          <div
                            key={upload.id}
                            className="flex items-center gap-3 rounded-vault border border-vault-border bg-vault-s2 px-4 py-3 dark:bg-[#21262d]"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-vault-text dark:text-[#e6edf3]">
                                {account ? getAccountDisplayName(account) : "—"}
                              </p>
                              {upload.pending_mep && (
                                <p className="mt-0.5 text-xs text-vault-yellow">Falta TC MEP</p>
                              )}
                            </div>
                            <span
                              className={`flex-shrink-0 text-sm font-medium ${STATUS_COLORS[upload.status]}`}
                            >
                              {STATUS_LABELS[upload.status]}
                            </span>
                            {(upload.status === "review" || upload.status === "done") && (
                              <Link
                                to={`/uploads/${upload.id}/${upload.status === "review" ? "review" : "transactions"}`}
                                className={
                                  upload.status === "review"
                                    ? "flex-shrink-0 rounded border border-vault-yellow/40 bg-vault-yellow/10 px-2.5 py-1 text-xs font-medium text-vault-yellow hover:bg-vault-yellow/20"
                                    : "flex-shrink-0 rounded border border-vault-border px-2.5 py-1 text-xs text-vault-muted2 hover:border-vault-accent hover:text-vault-accent dark:border-[#30363d] dark:text-[#8b949e]"
                                }
                              >
                                {upload.status === "review" ? "Revisar" : "Ver"}
                              </Link>
                            )}
                            {(upload.status === "done" ||
                              upload.status === "review" ||
                              upload.status === "error") && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(upload)}
                                title="Eliminar extracto"
                                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-sm text-vault-muted2 transition-colors hover:bg-vault-red/10 hover:text-vault-red dark:text-[#8b949e]"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: confirmar eliminación de extracto */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-vault-border bg-white p-6 shadow-xl dark:border-[#30363d] dark:bg-[#161b22]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-medium text-vault-text dark:text-[#e6edf3]">
              Eliminar extracto
            </h3>
            <p className="mb-5 text-sm text-vault-muted2 dark:text-[#8b949e]">
              Vas a eliminar el extracto de{" "}
              <span className="font-medium text-vault-text dark:text-[#e6edf3]">
                {(() => {
                  const account = accountMap.get(deleteTarget.account_id);
                  return account ? getAccountDisplayName(account) : "—";
                })()}
              </span>{" "}
              —{" "}
              <span className="font-medium capitalize text-vault-text dark:text-[#e6edf3]">
                {periodLabel(deleteTarget.period_month)}
              </span>
              . Esto borrará todas las transacciones asociadas. ¿Confirmar?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-vault border border-vault-border py-2 text-sm text-vault-muted2 hover:text-vault-text dark:border-[#30363d] dark:text-[#8b949e]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteUpload.isPending}
                onClick={async () => {
                  if (!deleteTarget) return;
                  await deleteUpload.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="flex-1 rounded-vault border border-vault-red/30 bg-vault-red/10 py-2 text-sm font-medium text-vault-red hover:bg-vault-red/20 disabled:opacity-40"
              >
                {deleteUpload.isPending ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
