import { useState, useRef, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ACCOUNT_TYPE_LABELS,
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  type Account,
  type AccountType,
  type CurrencyType,
} from "@/api/accounts.api";
import { useSubmitUpload, useUploadStatus, type UploadStatus } from "@/api/uploads.api";
import type { SkillModule } from "@/components/upload/ModuleSelector";
import { formatCurrency } from "@/utils/formatCurrency";
import { extractErrorMessage } from "@/utils/apiError";
import { getCurrentPeriod } from "@/utils/formatDate";

type BaseType = "credit_card" | "checking" | "broker" | "crypto" | "cash" | "savings_box";
type RightPanel = "none" | "new-account" | "upload";

const BASE_TYPE_OPTIONS: { value: BaseType; label: string }[] = [
  { value: "credit_card", label: "Tarjeta de crédito" },
  { value: "checking", label: "Cuenta corriente" },
  { value: "broker", label: "Broker / Comitente" },
  { value: "crypto", label: "Cripto" },
  { value: "cash", label: "Efectivo" },
  { value: "savings_box", label: "Caja de ahorro" },
];

const ENTITY_OPTIONS: Partial<Record<BaseType, string[]>> = {
  credit_card: ["BBVA", "Galicia", "Santander", "Macro", "Brubank", "Mercado Pago", "Uala", "Otro"],
  checking: ["BBVA", "Galicia", "Santander", "Macro", "Brubank", "Mercado Pago", "Uala", "Otro"],
  savings_box: ["BBVA", "Galicia", "Santander", "Macro", "Brubank", "Mercado Pago", "Uala", "Otro"],
  broker: ["INVIU", "IOL", "Bull Market", "Balanz", "Otro"],
  crypto: ["Binance", "Lemon Cash", "Ripio", "Otro"],
};

function resolveAccountType(base: BaseType, currency: CurrencyType): AccountType {
  if (base === "credit_card") return "credit_card_ars";
  if (base === "checking") return currency === "USD" ? "checking_usd" : "checking_ars";
  return base as AccountType;
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

export function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const submitUpload = useSubmitUpload();

  const [rightPanel, setRightPanel] = useState<RightPanel>("none");

  // New account form
  const [name, setName] = useState("");
  const [baseType, setBaseType] = useState<BaseType>("checking");
  const [institution, setInstitution] = useState("");
  const [currency, setCurrency] = useState<CurrencyType>("ARS");
  const [balance, setBalance] = useState("0");
  const [createError, setCreateError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Upload panel
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [uploadPeriod, setUploadPeriod] = useState(getCurrentPeriod());
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const { data: activeStatus } = useUploadStatus(activeUploadId);

  // Derived visibility
  const showEntidad = baseType !== "cash";
  const entityOptions = ENTITY_OPTIONS[baseType] ?? [];
  const showMoneda = baseType !== "credit_card";
  const showSaldoActual =
    baseType !== "credit_card" && baseType !== "checking" && baseType !== "savings_box";

  const handleBaseTypeChange = (newType: BaseType) => {
    setBaseType(newType);
    setInstitution("");
  };

  const openNewAccountForm = () => {
    setSelectedAccount(null);
    setRightPanel("new-account");
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleCreateSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    try {
      await createAccount.mutateAsync({
        name,
        account_type: resolveAccountType(baseType, currency),
        institution: institution || undefined,
        currency: baseType === "credit_card" ? "ARS" : currency,
        current_balance: showSaldoActual ? Number(balance) || 0 : 0,
      });
      setName("");
      setInstitution("");
      setBalance("0");
    } catch (err) {
      setCreateError(extractErrorMessage(err));
    }
  };

  const handleAccountClick = (account: Account) => {
    setSelectedAccount(account);
    setRightPanel("upload");
    setUploadPeriod(getCurrentPeriod());
    setUploadFile(null);
    setUploadError(null);
    setActiveUploadId(null);
  };

  const handleUploadSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!uploadFile || !selectedAccount) return;
    setUploadError(null);
    try {
      const uploadId = await submitUpload.mutateAsync({
        accountId: selectedAccount.id,
        periodMonth: uploadPeriod,
        file: uploadFile,
        requestedModules: getModulesForAccountType(selectedAccount.account_type),
      });
      setActiveUploadId(uploadId);
      setUploadFile(null);
    } catch (err) {
      setUploadError(extractErrorMessage(err));
    }
  };

  const hasAccounts = !isLoading && !!accounts?.length;

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="page-title">Mis cuentas</h1>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          Las cuentas que registres acá son las que vas a poder usar para cargar extractos.
        </p>
      </div>

      <div className={`mb-5 grid gap-4 ${rightPanel !== "none" ? "grid-cols-3" : "grid-cols-1"}`}>
        {/* Left panel */}
        <div className={`card-vault ${rightPanel !== "none" ? "col-span-2" : ""}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-label">Cuentas activas</h2>
            {hasAccounts && (
              <button
                type="button"
                onClick={openNewAccountForm}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-vault-border2 text-sm text-vault-muted2 dark:text-[#8b949e] transition-colors hover:border-vault-accent hover:text-vault-accent"
              >
                +
              </button>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">Cargando...</p>
          ) : !accounts || accounts.length === 0 ? (
            <button
              type="button"
              onClick={openNewAccountForm}
              className="flex w-full flex-col items-center gap-3 py-10 text-vault-muted2 dark:text-[#8b949e] transition-colors hover:text-vault-text"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-vault-border2 text-2xl">
                +
              </span>
              <span className="text-sm">Agregá tu primera cuenta</span>
            </button>
          ) : (
            <ul className="flex flex-col gap-2">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  onClick={() => handleAccountClick(account)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                    selectedAccount?.id === account.id && rightPanel === "upload"
                      ? "border-vault-accent/40 bg-[#eff6ff] dark:bg-[#1d2d50] dark:border-vault-accent/40"
                      : "border-vault-border bg-vault-s2 dark:bg-[#21262d] hover:border-vault-border2 dark:bg-[#21262d] dark:border-[#30363d] dark:hover:border-[#484f58]"
                  }`}
                >
                  <div>
                    <p className="font-medium text-vault-text dark:text-[#e6edf3]">{account.name}</p>
                    <p className="text-xs text-vault-muted2 dark:text-[#8b949e]">
                      {ACCOUNT_TYPE_LABELS[account.account_type]}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-vault-text dark:text-[#e6edf3]">
                      {formatCurrency(account.current_balance, account.currency)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAccount.mutate(account.id);
                      }}
                      title="Eliminar cuenta"
                      className="text-vault-muted dark:text-[#8b949e] transition-colors hover:text-vault-red"
                    >
                      &#10005;
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right panel: upload */}
        {rightPanel === "upload" && selectedAccount && (
          <div className="card-vault">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-label">Cargar extracto</h2>
              <button
                type="button"
                onClick={() => {
                  setRightPanel("none");
                  setSelectedAccount(null);
                }}
                className="text-xs text-vault-muted2 dark:text-[#8b949e] transition-colors hover:text-vault-text"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 truncate text-sm font-medium text-vault-text dark:text-[#e6edf3]">
              {selectedAccount.name}
            </p>

            <form onSubmit={handleUploadSubmit} className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                  Período
                </label>
                <input
                  type="date"
                  required
                  value={uploadPeriod}
                  onChange={(e) => setUploadPeriod(e.target.value)}
                  className="input-vault"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                  Archivo
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.xlsx"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="input-vault"
                />
              </div>

              {uploadError && (
                <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                  {uploadError}
                </div>
              )}

              <button type="submit" disabled={submitUpload.isPending} className="btn-primary mt-1">
                {submitUpload.isPending ? "Subiendo..." : "Subir extracto"}
              </button>
            </form>

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
                    Revisar transacciones →
                  </Link>
                )}
                {activeStatus.pending_mep && (
                  <p className="mt-2 text-xs text-vault-yellow">
                    Falta el TC MEP —{" "}
                    <Link to="/settings" className="underline">
                      declaralo en Configuración
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Right panel: new account */}
        {rightPanel === "new-account" && (
          <div className="card-vault">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-label">Nueva cuenta</h2>
              <button
                type="button"
                onClick={() => setRightPanel("none")}
                className="text-xs text-vault-muted2 dark:text-[#8b949e] transition-colors hover:text-vault-text"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                  Nombre
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-vault"
                  placeholder="Cuenta sueldo"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">Tipo</label>
                <select
                  value={baseType}
                  onChange={(e) => handleBaseTypeChange(e.target.value as BaseType)}
                  className="input-vault"
                >
                  {BASE_TYPE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {showEntidad && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                    Entidad
                  </label>
                  <select
                    required
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="input-vault"
                  >
                    <option value="" disabled>
                      Seleccioná una entidad
                    </option>
                    {entityOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {showMoneda && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                    Moneda
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyType)}
                    className="input-vault"
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              )}

              {showSaldoActual && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                    Saldo actual
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="input-vault"
                  />
                </div>
              )}

              {createError && (
                <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                  {createError}
                </div>
              )}

              <button
                type="submit"
                disabled={createAccount.isPending}
                className="btn-primary mt-1"
              >
                {createAccount.isPending ? "Creando..." : "Crear cuenta"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
