import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAccounts, type AccountType } from "@/api/accounts.api";
import { useSubmitUpload, useUploadStatus, useUploads, type UploadStatus } from "@/api/uploads.api";
import {
  useExchangeRates,
  useRecalculatePeriod,
  useSetExchangeRate,
} from "@/api/exchangeRates.api";
import { useMepQuote } from "@/api/mepQuote.api";
import type { SkillModule } from "@/components/upload/ModuleSelector";
import { extractErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/formatDate";

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function getMonthEnd(): string {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

function getModulesForAccountType(accountType: AccountType): SkillModule[] {
  if (accountType === "credit_card_ars" || accountType === "credit_card_usd") {
    return ["flujo_mensual", "compromisos_futuros"];
  }
  if (accountType === "broker") return ["cuenta_comitente", "tablero_general"];
  if (accountType === "crypto") return ["flujo_mensual"];
  return ["flujo_mensual", "categorizacion_gasto", "tablero_general"];
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

  const [accountId, setAccountId] = useState("");
  const [periodStart, setPeriodStart] = useState(getMonthStart());
  const [periodEnd, setPeriodEnd] = useState(getMonthEnd());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [mepRateInput, setMepRateInput] = useState("");
  const [mepEditedByUser, setMepEditedByUser] = useState(false);

  const { data: activeStatus } = useUploadStatus(activeUploadId);

  const monthPrefix = periodStart.slice(0, 7);
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
      if (!declaredRate) {
        const rateValue = Number(mepRateInput);
        if (rateValue > 0) {
          await setExchangeRate.mutateAsync({ periodMonth: periodStart, mepRate: rateValue });
          await recalculatePeriod.mutateAsync(periodStart);
        }
      }
      const uploadId = await submitUpload.mutateAsync({
        accountId,
        periodMonth: periodStart,
        file,
        requestedModules,
      });
      setActiveUploadId(uploadId);
      setFile(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="page-title">Cargar extracto</h1>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          Subí un PDF o XLSX de tu cuenta para que la IA lo categorice automáticamente.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="card-vault col-span-2">
          {!accounts || accounts.length === 0 ? (
            <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
              {isLoadingAccounts
                ? "Cargando cuentas..."
                : "Primero crea una cuenta en “Mis cuentas” para poder cargar un extracto."}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
                    Selecciona una cuenta
                  </option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                    Desde
                  </label>
                  <input
                    type="date"
                    required
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="input-vault"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                    Hasta
                  </label>
                  <input
                    type="date"
                    required
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
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
                  type="file"
                  required
                  accept=".pdf,.xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="input-vault"
                />
              </div>

              {error && (
                <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                  {error}
                </div>
              )}

              <button type="submit" disabled={submitUpload.isPending} className="btn-primary mt-1">
                {submitUpload.isPending ? "Subiendo..." : "Subir extracto"}
              </button>
            </form>
          )}

          {activeStatus && (
            <div className="mt-4 rounded-vault border border-vault-border bg-vault-s2 dark:bg-[#21262d] px-3.5 py-2.5 text-sm">
              Estado del último envío:{" "}
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

        <div className="card-vault">
          <h2 className="mb-3 section-label">Historial</h2>
          {!uploads || uploads.length === 0 ? (
            <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
              Todavía no subiste ningún extracto.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {uploads.map((upload) => (
                <li
                  key={upload.id}
                  className="flex items-center justify-between gap-2 rounded-vault border border-vault-border bg-vault-s2 dark:bg-[#21262d] px-3 py-2 text-xs"
                >
                  <span className="flex items-center gap-1.5 text-vault-muted2 dark:text-[#8b949e]">
                    {upload.period_month}
                    {upload.pending_mep && <span title="Falta TC MEP">⚠</span>}
                  </span>
                  {upload.status === "review" ? (
                    <Link
                      to={`/uploads/${upload.id}/review`}
                      className="font-medium text-vault-yellow hover:underline"
                    >
                      Revisar →
                    </Link>
                  ) : (
                    <span className={`font-medium ${STATUS_COLORS[upload.status]}`}>
                      {STATUS_LABELS[upload.status]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
