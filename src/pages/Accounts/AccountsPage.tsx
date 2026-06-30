import { useState, useMemo, useRef, useEffect, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ACCOUNT_TYPE_LABELS,
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
  type Account,
  type AccountType,
  type CurrencyType,
} from "@/api/accounts.api";
import { useSubmitUpload, useUploadStatus, type UploadStatus } from "@/api/uploads.api";
import type { SkillModule } from "@/components/upload/ModuleSelector";
import { formatCurrency } from "@/utils/formatCurrency";
import { extractErrorMessage } from "@/utils/apiError";

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

const ENTITY_COLORS: Record<string, { bg: string; text: string }> = {
  BBVA: { bg: "#003087", text: "#ffffff" },
  Galicia: { bg: "#e30613", text: "#ffffff" },
  Santander: { bg: "#ec0000", text: "#ffffff" },
  Macro: { bg: "#ffcc00", text: "#1a1a1a" },
  Brubank: { bg: "#6c3fc5", text: "#ffffff" },
  "Mercado Pago": { bg: "#00b1ea", text: "#ffffff" },
  Uala: { bg: "#7b2d8b", text: "#ffffff" },
  INVIU: { bg: "#1a1a2e", text: "#ffffff" },
  IOL: { bg: "#ff6b00", text: "#ffffff" },
  "Bull Market": { bg: "#475569", text: "#ffffff" },
  Balanz: { bg: "#475569", text: "#ffffff" },
  Binance: { bg: "#f0b90b", text: "#1a1a1a" },
  "Lemon Cash": { bg: "#00e676", text: "#1a1a1a" },
  Ripio: { bg: "#0052cc", text: "#ffffff" },
};

function getEntityColor(name: string): { bg: string; text: string } {
  return ENTITY_COLORS[name] ?? { bg: "#475569", text: "#ffffff" };
}

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

function generateAccountName(
  base: BaseType,
  iss: string,
  ref: string,
  curr: CurrencyType,
  inst: string
): string {
  if (base === "credit_card") return [iss, ref].filter(Boolean).join(" · ");
  if (base === "checking") return ["CC", ref, curr].filter(Boolean).join(" · ");
  if (base === "savings_box") return ["CA", ref, curr].filter(Boolean).join(" · ");
  if (base === "broker") return ref || inst;
  if (base === "crypto") return inst;
  if (base === "cash") return ["Efectivo", ref, curr].filter(Boolean).join(" · ");
  return ref;
}

function getMonthBounds() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return {
    start: `${y}-${m}-01`,
    end: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

const MOVEMENT_CATEGORIES = [
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
  "Ingreso",
  "Varios",
];

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
  const updateAccount = useUpdateAccount();
  const submitUpload = useSubmitUpload();

  const [searchParams] = useSearchParams();
  const entityParam = searchParams.get("entity");

  const [rightPanel, setRightPanel] = useState<RightPanel>("none");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
    entityParam ? new Set([entityParam]) : new Set()
  );

  // New account form
  const [baseType, setBaseType] = useState<BaseType>("checking");
  const [institution, setInstitution] = useState("");
  const [issuer, setIssuer] = useState("");
  const [reference, setReference] = useState("");
  const [currency, setCurrency] = useState<CurrencyType>("ARS");
  const [balance, setBalance] = useState("0");
  const [notes, setNotes] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Upload panel
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [periodStart, setPeriodStart] = useState(() => getMonthBounds().start);
  const [periodEnd, setPeriodEnd] = useState(() => getMonthBounds().end);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const { data: activeStatus } = useUploadStatus(activeUploadId);

  // Edit section
  const [editOpen, setEditOpen] = useState(false);
  const [editReference, setEditReference] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Manual cash movement
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualDescription, setManualDescription] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const [manualType, setManualType] = useState<"ingreso" | "egreso">("egreso");
  const [manualAmount, setManualAmount] = useState("");
  const [manualSuccess, setManualSuccess] = useState(false);

  const groupedAccounts = useMemo(() => {
    const map = new Map<string, Account[]>();
    (accounts ?? []).forEach((account) => {
      const key = account.institution || "Sin entidad";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(account);
    });
    return map;
  }, [accounts]);

  const allGroupKeys = useMemo(() => Array.from(groupedAccounts.keys()), [groupedAccounts]);

  useEffect(() => {
    if (!entityParam) return;
    setExpandedGroups(new Set([entityParam]));
  }, [entityParam]);

  useEffect(() => {
    if (!entityParam || !groupedAccounts.has(entityParam)) return;
    const timer = setTimeout(() => {
      groupRefs.current.get(entityParam)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(timer);
  }, [entityParam, groupedAccounts]);

  // Derived form visibility
  const showEntidad = baseType !== "cash";
  const entityOptions = ENTITY_OPTIONS[baseType] ?? [];
  const showIssuer = baseType === "credit_card";
  const showReference = baseType !== "broker" && baseType !== "crypto";
  const showMoneda = baseType !== "credit_card";
  const showSaldoActual =
    baseType !== "credit_card" && baseType !== "checking" && baseType !== "savings_box";

  const referencePlaceholder =
    baseType === "credit_card"
      ? "Ej: viajes, cuotas..."
      : baseType === "checking" || baseType === "savings_box"
        ? "Ej: sueldo, ahorro..."
        : baseType === "cash"
          ? "Ej: billetera, casa..."
          : "";

  const isGroupExpanded = (key: string) => expandedGroups.has("all") || expandedGroups.has(key);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has("all")) {
        next.delete("all");
        allGroupKeys.forEach((k) => {
          if (k !== key) next.add(k);
        });
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleBaseTypeChange = (newType: BaseType) => {
    setBaseType(newType);
    setInstitution("");
    setIssuer("");
  };

  const openNewAccountForm = (preselectedInstitution?: string) => {
    setSelectedAccount(null);
    setRightPanel("new-account");
    setInstitution(preselectedInstitution ?? "");
  };

  const handleCreateSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    try {
      const institutionValue = baseType === "cash" ? "Efectivo" : institution || undefined;
      const newAccount = await createAccount.mutateAsync({
        name: generateAccountName(baseType, issuer, reference, currency, institutionValue ?? ""),
        account_type: resolveAccountType(baseType, currency),
        institution: institutionValue,
        currency: baseType === "credit_card" ? "ARS" : currency,
        current_balance: showSaldoActual ? Number(balance) || 0 : 0,
      });
      if (notes) {
        localStorage.setItem(`vault_notes_${newAccount.id}`, notes);
      }
      setInstitution("");
      setIssuer("");
      setReference("");
      setBalance("0");
      setNotes("");
      setRightPanel("none");
    } catch (err) {
      setCreateError(extractErrorMessage(err));
    }
  };

  const handleAccountClick = (account: Account) => {
    setSelectedAccount(account);
    setRightPanel("upload");
    const bounds = getMonthBounds();
    setPeriodStart(bounds.start);
    setPeriodEnd(bounds.end);
    setUploadFile(null);
    setUploadError(null);
    setActiveUploadId(null);
    setEditOpen(false);
    setConfirmDelete(false);
    setEditReference(account.name);
    setEditNotes(localStorage.getItem(`vault_notes_${account.id}`) ?? "");
  };

  const handleUploadSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!uploadFile || !selectedAccount) return;
    setUploadError(null);
    try {
      const uploadId = await submitUpload.mutateAsync({
        accountId: selectedAccount.id,
        periodMonth: periodStart,
        file: uploadFile,
        requestedModules: getModulesForAccountType(selectedAccount.account_type),
      });
      setActiveUploadId(uploadId);
      setUploadFile(null);
    } catch (err) {
      setUploadError(extractErrorMessage(err));
    }
  };

  const handleEditSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedAccount) return;
    setEditError(null);
    try {
      await updateAccount.mutateAsync({ id: selectedAccount.id, name: editReference });
      if (editNotes) {
        localStorage.setItem(`vault_notes_${selectedAccount.id}`, editNotes);
      } else {
        localStorage.removeItem(`vault_notes_${selectedAccount.id}`);
      }
      setEditOpen(false);
    } catch (err) {
      setEditError(extractErrorMessage(err));
    }
  };

  const handleManualMovement = async (event: FormEvent) => {
    event.preventDefault();
    // TODO: conectar con POST /transactions/manual cuando el backend lo implemente
    setManualSuccess(true);
    setTimeout(() => {
      setManualSuccess(false);
      setManualDescription("");
      setManualAmount("");
      setManualCategory("");
      setShowMovementForm(false);
    }, 2000);
  };

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="page-title">Mis cuentas</h1>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          Registrá tus cuentas bancarias, broker y billeteras digitales para que Vault las consolide
          en tu tablero y calcule tu patrimonio total.
        </p>
      </div>

      <div className={`mb-5 grid gap-4 ${rightPanel !== "none" ? "grid-cols-3" : "grid-cols-1"}`}>
        {/* Left panel */}
        <div className={`card-vault ${rightPanel !== "none" ? "col-span-2" : ""}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-label">Cuentas activas</h2>
            <button
              type="button"
              onClick={() => openNewAccountForm()}
              title="Agregar entidad financiera"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-vault-border2 text-sm text-vault-muted2 dark:text-[#8b949e] transition-colors hover:border-vault-accent hover:text-vault-accent"
            >
              +
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">Cargando...</p>
          ) : !accounts || accounts.length === 0 ? (
            <button
              type="button"
              onClick={() => openNewAccountForm()}
              className="flex w-full flex-col items-center gap-3 py-10 text-vault-muted2 dark:text-[#8b949e] transition-colors hover:text-vault-text"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-vault-border2 text-2xl">
                +
              </span>
              <span className="text-sm">Agregá tu primera cuenta</span>
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from(groupedAccounts.entries()).map(([groupKey, groupAccounts]) => {
                const expanded = isGroupExpanded(groupKey);
                const { bg, text } = getEntityColor(groupKey);
                const initials =
                  groupKey === "Sin entidad" ? "?" : groupKey.slice(0, 2).toUpperCase();

                return (
                  <div
                    key={groupKey}
                    ref={(el) => {
                      if (el) groupRefs.current.set(groupKey, el);
                      else groupRefs.current.delete(groupKey);
                    }}
                    className="overflow-hidden rounded-lg border border-vault-border dark:border-[#30363d]"
                  >
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupKey)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-vault-s2 dark:hover:bg-[#21262d]"
                    >
                      <div
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                        style={{ backgroundColor: bg, color: text }}
                      >
                        {initials}
                      </div>
                      <span className="flex-1 text-left font-medium text-vault-text dark:text-[#e6edf3]">
                        {groupKey}
                      </span>
                      <span className="text-xs text-vault-muted2 dark:text-[#8b949e]">
                        {groupAccounts.length} {groupAccounts.length === 1 ? "cuenta" : "cuentas"}
                      </span>
                      <span
                        className="inline-block text-vault-muted2 transition-transform duration-200 dark:text-[#8b949e]"
                        style={{ transform: expanded ? "rotate(90deg)" : "none" }}
                      >
                        ›
                      </span>
                    </button>

                    {/* Group body */}
                    {expanded && (
                      <div className="border-t border-vault-border dark:border-[#30363d]">
                        <ul>
                          {groupAccounts.map((account) => (
                            <li
                              key={account.id}
                              onClick={() => handleAccountClick(account)}
                              className={`flex cursor-pointer items-center justify-between gap-3 border-b border-vault-border/50 py-2.5 pr-3.5 text-sm transition-colors last:border-b-0 dark:border-[#30363d]/50 ${
                                selectedAccount?.id === account.id && rightPanel === "upload"
                                  ? "bg-[#eff6ff] dark:bg-[#1d2d50]"
                                  : "hover:bg-vault-s2 dark:hover:bg-[#21262d]"
                              }`}
                              style={{ paddingLeft: "52px" }}
                            >
                              <div>
                                <p className="font-medium text-vault-text dark:text-[#e6edf3]">
                                  {account.name}
                                </p>
                                <p className="flex items-center text-xs text-vault-muted2 dark:text-[#8b949e]">
                                  {ACCOUNT_TYPE_LABELS[account.account_type]}
                                  {account.account_type === "cash" && (
                                    <span
                                      className="ml-1 dark:bg-[#1d2d50] dark:text-[#93c5fd]"
                                      style={{
                                        fontSize: 10,
                                        background: "#eff6ff",
                                        color: "#1e3a8a",
                                        borderRadius: 4,
                                        padding: "1px 6px",
                                      }}
                                    >
                                      {account.currency}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <span className="tabular-nums text-vault-text dark:text-[#e6edf3]">
                                {formatCurrency(account.current_balance, account.currency)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {groupKey !== "Sin entidad" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openNewAccountForm(groupKey);
                            }}
                            className="flex w-full items-center gap-1.5 border-t border-vault-border/50 py-2 pr-3.5 text-xs text-vault-muted2 transition-colors hover:text-vault-accent dark:border-[#30363d]/50 dark:text-[#8b949e]"
                            style={{ paddingLeft: "52px" }}
                          >
                            + Agregar cuenta en {groupKey}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel: upload — cash */}
        {rightPanel === "upload" && selectedAccount && selectedAccount.account_type === "cash" && (
          <div className="card-vault flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="leading-snug text-vault-text dark:text-[#e6edf3]"
                  style={{ fontWeight: 300, fontSize: "16px" }}
                >
                  {selectedAccount.name}
                </p>
                <p className="mt-0.5 text-xs text-vault-muted2 dark:text-[#8b949e]">Efectivo</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRightPanel("none");
                  setSelectedAccount(null);
                }}
                className="mt-0.5 text-xs text-vault-muted2 transition-colors hover:text-vault-text dark:text-[#8b949e]"
              >
                ✕
              </button>
            </div>

            <div>
              {!showMovementForm ? (
                <button
                  type="button"
                  onClick={() => setShowMovementForm(true)}
                  className="btn-primary w-full"
                >
                  ＋ Registrar movimiento
                </button>
              ) : (
                <form onSubmit={handleManualMovement} className="flex flex-col gap-3">
                  {/* TIPO */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setManualType("ingreso")}
                      className={`flex-1 rounded-lg px-4 py-2 text-sm transition-colors ${
                        manualType === "ingreso"
                          ? "bg-vault-accent text-white"
                          : "border border-vault-border2 text-vault-muted2 dark:border-[#484f58] dark:text-[#8b949e]"
                      }`}
                    >
                      ↑ Ingreso
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualType("egreso")}
                      className={`flex-1 rounded-lg px-4 py-2 text-sm transition-colors ${
                        manualType === "egreso"
                          ? "bg-vault-accent text-white"
                          : "border border-vault-border2 text-vault-muted2 dark:border-[#484f58] dark:text-[#8b949e]"
                      }`}
                    >
                      ↓ Egreso
                    </button>
                  </div>

                  {/* FECHA */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                      Fecha
                    </label>
                    <input
                      type="date"
                      required
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="input-vault"
                    />
                  </div>

                  {/* DESCRIPCIÓN */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                      Descripción
                    </label>
                    <input
                      type="text"
                      value={manualDescription}
                      onChange={(e) => setManualDescription(e.target.value)}
                      placeholder="Ej: Supermercado Coto"
                      className="input-vault"
                    />
                  </div>

                  {/* CATEGORÍA */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                      Categoría
                    </label>
                    <select
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      className="input-vault"
                    >
                      <option value="" disabled>
                        Seleccioná una categoría
                      </option>
                      {MOVEMENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* MONTO */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                      Monto ({selectedAccount.currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      className="input-vault"
                    />
                  </div>

                  {manualSuccess ? (
                    <div
                      className="text-vault-green"
                      style={{ fontSize: 13, textAlign: "center", padding: "12px 0" }}
                    >
                      ✓ Movimiento registrado
                    </div>
                  ) : (
                    <button type="submit" className="btn-primary mt-2 w-full">
                      Registrar movimiento
                    </button>
                  )}
                </form>
              )}
            </div>

            {/* Edit section */}
            <div className="border-t border-vault-border pt-3 dark:border-[#30363d]">
              <button
                type="button"
                onClick={() => {
                  setEditOpen(!editOpen);
                  setConfirmDelete(false);
                }}
                className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 transition-colors hover:text-vault-text dark:text-[#8b949e]"
              >
                Editar cuenta
                <span
                  className="inline-block transition-transform duration-200"
                  style={{ transform: editOpen ? "rotate(90deg)" : "none" }}
                >
                  ›
                </span>
              </button>
              {editOpen && (
                <form onSubmit={handleEditSubmit} className="mt-3 flex flex-col gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                      Referencia
                    </label>
                    <input
                      type="text"
                      value={editReference}
                      onChange={(e) => setEditReference(e.target.value)}
                      className="input-vault"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                      Notas
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      maxLength={120}
                      placeholder="Anotaciones sobre esta cuenta (opcional)"
                      className="input-vault resize-none"
                    />
                  </div>
                  {editError && (
                    <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                      {editError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={updateAccount.isPending}
                    className="btn-primary mt-1"
                  >
                    {updateAccount.isPending ? "Guardando..." : "Guardar cambios"}
                  </button>
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="w-full rounded-vault border border-vault-red/30 bg-transparent py-2 text-sm text-vault-red transition-colors hover:bg-vault-red/5"
                    >
                      Eliminar cuenta
                    </button>
                  ) : (
                    <div className="rounded-vault border border-vault-red/20 bg-vault-red/5 px-3.5 py-3">
                      <p className="mb-3 text-xs text-vault-text dark:text-[#e6edf3]">
                        ¿Confirmás que querés eliminar esta cuenta? Esta acción no se puede
                        deshacer.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 rounded border border-vault-border py-1.5 text-xs text-vault-muted2 transition-colors hover:text-vault-text dark:border-[#30363d] dark:text-[#8b949e]"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedAccount) return;
                            deleteAccount.mutate(selectedAccount.id);
                            setRightPanel("none");
                            setSelectedAccount(null);
                          }}
                          className="flex-1 rounded border border-vault-red/30 bg-vault-red/10 py-1.5 text-xs text-vault-red transition-colors hover:bg-vault-red/20"
                        >
                          Sí, eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        )}

        {/* Right panel: upload — non-cash */}
        {rightPanel === "upload" && selectedAccount && selectedAccount.account_type !== "cash" && (
          <div className="card-vault flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="leading-snug text-vault-text dark:text-[#e6edf3]"
                  style={{ fontWeight: 300, fontSize: "18px" }}
                >
                  {selectedAccount.name}
                </p>
                <p className="mt-0.5 text-xs text-vault-muted2 dark:text-[#8b949e]">
                  {ACCOUNT_TYPE_LABELS[selectedAccount.account_type]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRightPanel("none");
                  setSelectedAccount(null);
                }}
                className="mt-0.5 text-xs text-vault-muted2 transition-colors hover:text-vault-text dark:text-[#8b949e]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="flex flex-col gap-3">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                  Período
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-vault-muted2 dark:text-[#8b949e]">
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
                    <label className="mb-1 block text-xs text-vault-muted2 dark:text-[#8b949e]">
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
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                  Archivo
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
                {uploadFile ? (
                  <div className="flex items-center justify-between rounded-lg border border-vault-green/30 bg-vault-green/5 px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-vault-green">✓</span>
                      <span className="max-w-[140px] truncate text-xs text-vault-text dark:text-[#e6edf3]">
                        {uploadFile.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadFile(null)}
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
                      const file = e.dataTransfer.files?.[0];
                      if (file) setUploadFile(file);
                    }}
                    className={`flex flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed px-4 py-6 text-center transition-colors ${
                      isDragging
                        ? "border-vault-accent bg-vault-accent/5"
                        : "border-vault-border2 dark:border-[#484f58]"
                    }`}
                  >
                    <span className="text-xl text-vault-muted2 dark:text-[#8b949e]">↑</span>
                    <p className="text-xs text-vault-muted2 dark:text-[#8b949e]">
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

              {uploadError && (
                <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                  {uploadError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitUpload.isPending || !uploadFile}
                className="btn-primary mt-1 w-full"
              >
                {submitUpload.isPending ? "Subiendo..." : "Subir extracto"}
              </button>
            </form>

            {activeStatus && (
              <>
                <div className="rounded-vault border border-vault-border bg-vault-s2 px-3.5 py-2.5 text-sm dark:bg-[#21262d]">
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
                <button
                  type="button"
                  onClick={() => {
                    setRightPanel("none");
                    setSelectedAccount(null);
                  }}
                  className="text-xs text-vault-muted2 transition-colors hover:text-vault-text dark:text-[#8b949e]"
                >
                  ← Volver a mis cuentas
                </button>
              </>
            )}

            {/* Edit section */}
            <div className="border-t border-vault-border pt-3 dark:border-[#30363d]">
              <button
                type="button"
                onClick={() => {
                  setEditOpen(!editOpen);
                  setConfirmDelete(false);
                }}
                className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 transition-colors hover:text-vault-text dark:text-[#8b949e]"
              >
                Editar cuenta
                <span
                  className="inline-block transition-transform duration-200"
                  style={{ transform: editOpen ? "rotate(90deg)" : "none" }}
                >
                  ›
                </span>
              </button>
              {editOpen && (
                <form onSubmit={handleEditSubmit} className="mt-3 flex flex-col gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                      Referencia
                    </label>
                    <input
                      type="text"
                      value={editReference}
                      onChange={(e) => setEditReference(e.target.value)}
                      className="input-vault"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                      Notas
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      maxLength={120}
                      placeholder="Anotaciones sobre esta cuenta (opcional)"
                      className="input-vault resize-none"
                    />
                  </div>
                  {editError && (
                    <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                      {editError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={updateAccount.isPending}
                    className="btn-primary mt-1"
                  >
                    {updateAccount.isPending ? "Guardando..." : "Guardar cambios"}
                  </button>
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="w-full rounded-vault border border-vault-red/30 bg-transparent py-2 text-sm text-vault-red transition-colors hover:bg-vault-red/5"
                    >
                      Eliminar cuenta
                    </button>
                  ) : (
                    <div className="rounded-vault border border-vault-red/20 bg-vault-red/5 px-3.5 py-3">
                      <p className="mb-3 text-xs text-vault-text dark:text-[#e6edf3]">
                        ¿Confirmás que querés eliminar esta cuenta? Esta acción no se puede
                        deshacer.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 rounded border border-vault-border py-1.5 text-xs text-vault-muted2 transition-colors hover:text-vault-text dark:border-[#30363d] dark:text-[#8b949e]"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedAccount) return;
                            deleteAccount.mutate(selectedAccount.id);
                            setRightPanel("none");
                            setSelectedAccount(null);
                          }}
                          className="flex-1 rounded border border-vault-red/30 bg-vault-red/10 py-1.5 text-xs text-vault-red transition-colors hover:bg-vault-red/20"
                        >
                          Sí, eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </div>
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
                className="text-xs text-vault-muted2 transition-colors hover:text-vault-text dark:text-[#8b949e]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                  Tipo
                </label>
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

              {showIssuer && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                    Emisor
                  </label>
                  <select
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    className="input-vault"
                  >
                    <option value="">Seleccioná un emisor</option>
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="Amex">Amex</option>
                  </select>
                </div>
              )}

              {showReference && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                    Referencia
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={referencePlaceholder}
                    className="input-vault"
                  />
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

              <div>
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={120}
                  placeholder="Anotaciones sobre esta cuenta (opcional)"
                  className="input-vault resize-none"
                />
              </div>

              {createError && (
                <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                  {createError}
                </div>
              )}

              <button type="submit" disabled={createAccount.isPending} className="btn-primary mt-1">
                {createAccount.isPending ? "Creando..." : "Crear cuenta"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
