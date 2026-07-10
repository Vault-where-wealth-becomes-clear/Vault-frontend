import { useState, useMemo, useRef, useEffect, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ACCOUNT_TYPE_LABELS,
  getAccountDisplayName,
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
  type Account,
  type AccountType,
  type CurrencyType,
} from "@/api/accounts.api";
import {
  useSubmitUpload,
  useUploadStatus,
  useAccountUploads,
  useUploads,
  useDeleteUpload,
  type UploadStatus,
} from "@/api/uploads.api";
import {
  useCreateManualTransaction,
  useTransactions,
  type Transaction,
} from "@/api/transactions.api";
import { computeUploadClosingBalance, groupTransactionsByUpload } from "@/utils/accountBalance";
import { CarteraSummaryCard } from "./CarteraSummaryCard";
import type { SkillModule } from "@/components/upload/ModuleSelector";
import { formatCurrency } from "@/utils/formatCurrency";
import { extractErrorMessage } from "@/utils/apiError";

type BaseType = "credit_card" | "checking" | "broker" | "crypto" | "cash" | "savings_box";
type RightPanel = "none" | "new-account" | "upload";
type AccountSubView = "default" | "upload" | "periods" | "movement";

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

function groupByInstitution(list: Account[]): Map<string, Account[]> {
  const map = new Map<string, Account[]>();
  list.forEach((account) => {
    const key = account.institution || "Sin entidad";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(account);
  });
  return map;
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

// Cuentas con formato de libro diario (saldo inicial/final por período,
// reconciliado por el worker) — el saldo mostrado en "Mis cuentas" solo
// tiene sentido para estas y para efectivo (saldo manual en tiempo real).
// Tarjetas de crédito no tienen saldo de cuenta (son consumo/deuda del
// período), y broker/cripto se valúan por posiciones, no por saldo de caja.
const LEDGER_ACCOUNT_TYPES = new Set<AccountType>(["checking_ars", "checking_usd", "savings_box"]);

/** null si esta cuenta no tiene un saldo que tenga sentido mostrar en "Mis cuentas". */
function getAccountDisplayBalance(
  account: Account,
  latestClosingBalanceByAccount: Map<string, number>
): number | null {
  if (account.account_type === "cash") return Number(account.current_balance);
  if (LEDGER_ACCOUNT_TYPES.has(account.account_type)) {
    return latestClosingBalanceByAccount.get(account.id) ?? null;
  }
  return null;
}

export function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const { data: allUploads } = useUploads();
  // Sin filtro: todas las transacciones del usuario, para calcular el saldo
  // de cierre real de cada upload (saldo inicial + neto de sus transacciones)
  // sin depender de ningún valor derivado por el LLM.
  const { data: allTransactions } = useTransactions();
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const updateAccount = useUpdateAccount();
  const submitUpload = useSubmitUpload();
  const deleteUpload = useDeleteUpload();
  const createManualTransaction = useCreateManualTransaction();

  const [searchParams] = useSearchParams();
  const entityParam = searchParams.get("entity");
  const newParam = searchParams.get("new");

  const [rightPanel, setRightPanel] = useState<RightPanel>(() =>
    newParam === "true" ? "new-account" : "none"
  );
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
  const [accountSubView, setAccountSubView] = useState<AccountSubView>("default");
  const [periodStart, setPeriodStart] = useState(() => getMonthBounds().start);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const { data: activeStatus } = useUploadStatus(activeUploadId);
  const { data: accountUploads } = useAccountUploads(selectedAccount?.id ?? null);
  const { data: accountTransactions } = useTransactions({
    accountId: selectedAccount?.id,
    enabled: !!selectedAccount,
  });
  const recentTransactions = useMemo<Transaction[]>(() => {
    if (!accountTransactions) return [];
    return [...accountTransactions]
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
      .slice(0, 10);
  }, [accountTransactions]);

  // Delete upload modal
  const [deleteUploadId, setDeleteUploadId] = useState<string | null>(null);
  const deleteUploadEntry = accountUploads?.find((u) => u.id === deleteUploadId);
  const deleteUploadLabel = deleteUploadEntry
    ? (() => {
        const [year, month] = deleteUploadEntry.period_month.split("-");
        return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("es-AR", {
          month: "long",
          year: "numeric",
        });
      })()
    : "";

  // Edit section
  const [editOpen, setEditOpen] = useState(false);
  const [editReference, setEditReference] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Manual cash movement
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualDescription, setManualDescription] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const [manualType, setManualType] = useState<"ingreso" | "egreso">("egreso");
  const [manualAmount, setManualAmount] = useState("");
  const [manualSuccess, setManualSuccess] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Cuenta comitente separada de las cuentas generales (banco/billetera): se valúa por
  // posiciones de cartera, no por saldo de caja, así que necesita su propia sección en
  // vez de mezclarse con checking/savings_box/credit_card/cash/crypto por institución.
  const generalAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.account_type !== "broker"),
    [accounts]
  );
  const comitenteAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.account_type === "broker"),
    [accounts]
  );
  const generalGroups = useMemo(() => groupByInstitution(generalAccounts), [generalAccounts]);
  const comitenteGroups = useMemo(() => groupByInstitution(comitenteAccounts), [comitenteAccounts]);

  const allGroupKeys = useMemo(
    () => [...generalGroups.keys(), ...comitenteGroups.keys()],
    [generalGroups, comitenteGroups]
  );

  // Saldo final del último período cargado por cuenta (no account.current_balance:
  // ese campo lo pisa el último upload PROCESADO, no el cronológicamente más
  // reciente — si se cargan meses fuera de orden queda desactualizado). Solo
  // se calcula para cuentas con formato de libro diario.
  const latestClosingBalanceByAccount = useMemo(() => {
    const map = new Map<string, number>();
    if (!accounts || !allUploads) return map;
    const txnsByUpload = groupTransactionsByUpload(allTransactions ?? []);
    for (const account of accounts) {
      if (!LEDGER_ACCOUNT_TYPES.has(account.account_type)) continue;
      const done = allUploads
        .filter((u) => u.account_id === account.id && u.status === "done")
        .sort((a, b) => b.period_month.localeCompare(a.period_month));
      if (done.length === 0) continue;
      const latest = done[0];
      const isUsd = account.currency === "USD";
      map.set(
        account.id,
        computeUploadClosingBalance(latest, txnsByUpload.get(latest.id) ?? [], isUsd)
      );
    }
    return map;
  }, [accounts, allUploads, allTransactions]);

  useEffect(() => {
    if (newParam === "true") {
      setRightPanel("new-account");
      setSelectedAccount(null);
      setCreateError(null);
      setBaseType("checking");
      setInstitution("");
      setIssuer("");
      setReference("");
      setBalance("0");
      setNotes("");
    }
  }, [newParam]);

  useEffect(() => {
    if (!entityParam) return;
    setExpandedGroups(new Set([entityParam]));
  }, [entityParam]);

  useEffect(() => {
    if (!entityParam) return;
    if (!generalGroups.has(entityParam) && !comitenteGroups.has(entityParam)) return;
    const timer = setTimeout(() => {
      groupRefs.current.get(entityParam)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(timer);
  }, [entityParam, generalGroups, comitenteGroups]);

  // Derived form visibility
  const showEntidad = baseType !== "cash";
  const entityOptions = ENTITY_OPTIONS[baseType] ?? [];
  const showIssuer = baseType === "credit_card";
  const showReference = baseType !== "crypto";
  const showMoneda = baseType !== "credit_card" && baseType !== "broker";
  const showSaldoActual =
    baseType !== "credit_card" &&
    baseType !== "checking" &&
    baseType !== "savings_box" &&
    baseType !== "broker";

  const referencePlaceholder =
    baseType === "credit_card"
      ? "Ej: viajes, cuotas..."
      : baseType === "checking" || baseType === "savings_box"
        ? "Ej: sueldo, ahorro..."
        : baseType === "cash"
          ? "Ej: billetera, casa..."
          : baseType === "broker"
            ? "Ej: cuenta ARS, cuenta USD..."
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
    setCreateError(null);
    setReference("");
    setBalance("0");
    setNotes("");
    setIssuer("");
    if (preselectedInstitution === "Efectivo") {
      setBaseType("cash");
      setInstitution("");
    } else {
      setBaseType("checking");
      setInstitution(preselectedInstitution ?? "");
    }
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
    setAccountSubView("default");
    const bounds = getMonthBounds();
    setPeriodStart(bounds.start);
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
    if (!selectedAccount || !manualAmount) return;
    setManualError(null);
    try {
      await createManualTransaction.mutateAsync({
        account_id: selectedAccount.id,
        date: manualDate,
        description: manualDescription || "Movimiento manual",
        amount: Number(manualAmount),
        currency: selectedAccount.currency,
        category: manualCategory || null,
        transaction_type: manualType,
      });
      setManualSuccess(true);
      setTimeout(() => {
        setManualSuccess(false);
        setManualDescription("");
        setManualAmount("");
        setManualCategory("");
        setAccountSubView("default");
      }, 2000);
    } catch (err) {
      setManualError(extractErrorMessage(err));
    }
  };

  const renderAccountGroups = (groups: Map<string, Account[]>) =>
    Array.from(groups.entries()).map(([groupKey, groupAccounts]) => {
      const expanded = isGroupExpanded(groupKey);
      const { bg, text } = getEntityColor(groupKey);
      const initials = groupKey === "Sin entidad" ? "?" : groupKey.slice(0, 2).toUpperCase();

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
                        {getAccountDisplayName(account)}
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
                    {(() => {
                      const displayBalance = getAccountDisplayBalance(
                        account,
                        latestClosingBalanceByAccount
                      );
                      return (
                        displayBalance !== null && (
                          <span className="tabular-nums text-vault-text dark:text-[#e6edf3]">
                            {formatCurrency(displayBalance, account.currency)}
                          </span>
                        )
                      );
                    })()}
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
    });

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
            <div className="flex flex-col gap-4">
              {generalGroups.size > 0 && (
                <div className="flex flex-col gap-2">{renderAccountGroups(generalGroups)}</div>
              )}
              {comitenteGroups.size > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                    Cuenta comitente
                  </p>
                  {renderAccountGroups(comitenteGroups)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel: upload — cash */}
        {rightPanel === "upload" && selectedAccount && selectedAccount.account_type === "cash" && (
          <div className="card-vault flex flex-col overflow-hidden p-0">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-vault-border px-4 py-4 dark:border-[#30363d]">
              <div>
                <p
                  className="leading-snug text-vault-text dark:text-[#e6edf3]"
                  style={{ fontWeight: 300, fontSize: "16px" }}
                >
                  {getAccountDisplayName(selectedAccount)}
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

            {/* Saldo */}
            <div className="border-b border-vault-border px-4 py-4 dark:border-[#30363d]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                Saldo actual
              </p>
              <p
                className="mt-1 tabular-nums font-light text-vault-text dark:text-[#e6edf3]"
                style={{ fontSize: 28 }}
              >
                {formatCurrency(selectedAccount.current_balance, selectedAccount.currency)}
              </p>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {accountSubView === "default" && (
                <>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                    Últimas transacciones
                  </p>
                  {recentTransactions.length === 0 ? (
                    <p className="text-xs text-vault-muted2 dark:text-[#8b949e]">
                      Sin transacciones registradas.
                    </p>
                  ) : (
                    <ul>
                      {recentTransactions.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-baseline gap-2 border-b border-vault-border/30 py-1.5 text-xs last:border-0 dark:border-[#30363d]/30"
                        >
                          <span className="w-[46px] flex-shrink-0 text-vault-muted2 dark:text-[#8b949e]">
                            {new Date(t.date + "T12:00:00").toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-vault-muted2 dark:text-[#8b949e]">
                            {t.description}
                          </span>
                          <span
                            className={`flex-shrink-0 tabular-nums font-medium ${t.amount_ars >= 0 ? "text-vault-green" : "text-vault-text dark:text-[#e6edf3]"}`}
                          >
                            {t.amount_ars >= 0 ? "+" : ""}
                            {formatCurrency(t.amount_ars, selectedAccount.currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {accountSubView === "movement" && (
                <form onSubmit={handleManualMovement} className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    {(["ingreso", "egreso"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setManualType(type)}
                        className={`flex-1 rounded-lg px-4 py-2 text-sm transition-colors ${manualType === type ? "bg-vault-accent text-white" : "border border-vault-border2 text-vault-muted2 dark:border-[#484f58] dark:text-[#8b949e]"}`}
                      >
                        {type === "ingreso" ? "↑ Ingreso" : "↓ Egreso"}
                      </button>
                    ))}
                  </div>
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
                  {manualError && (
                    <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                      {manualError}
                    </div>
                  )}
                  {manualSuccess ? (
                    <div
                      className="text-vault-green"
                      style={{ fontSize: 13, textAlign: "center", padding: "12px 0" }}
                    >
                      ✓ Movimiento registrado
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={createManualTransaction.isPending}
                      className="btn-primary mt-1 w-full"
                    >
                      {createManualTransaction.isPending
                        ? "Registrando..."
                        : "Registrar movimiento"}
                    </button>
                  )}
                </form>
              )}
            </div>

            {/* Buttons */}
            <div className="border-t border-vault-border px-4 py-3 dark:border-[#30363d]">
              <button
                type="button"
                onClick={() =>
                  setAccountSubView((v) => (v === "movement" ? "default" : "movement"))
                }
                className={`w-full rounded-vault border py-1.5 text-xs font-medium transition-colors ${
                  accountSubView === "movement"
                    ? "border-vault-border text-vault-muted2 hover:text-vault-text dark:border-[#30363d] dark:text-[#8b949e]"
                    : "border-vault-accent/40 bg-vault-accent/10 text-vault-accent hover:bg-vault-accent/20"
                }`}
              >
                {accountSubView === "movement" ? "Cancelar" : "+ Registrar movimiento"}
              </button>
            </div>

            {/* Edit section */}
            <div className="border-t border-vault-border px-4 py-3 dark:border-[#30363d]">
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
          <div className="card-vault flex flex-col overflow-hidden p-0">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-vault-border px-4 py-4 dark:border-[#30363d]">
              <div>
                <p
                  className="leading-snug text-vault-text dark:text-[#e6edf3]"
                  style={{ fontWeight: 300, fontSize: "18px" }}
                >
                  {getAccountDisplayName(selectedAccount)}
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

            {/* Saldo — solo cuentas con formato de libro diario (checking/caja de
                ahorro): tarjetas de crédito, broker y cripto no tienen un saldo
                de cuenta que tenga sentido mostrar acá. */}
            {LEDGER_ACCOUNT_TYPES.has(selectedAccount.account_type) && (
              <div className="border-b border-vault-border px-4 py-4 dark:border-[#30363d]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                  Saldo final (
                  {latestClosingBalanceByAccount.has(selectedAccount.id)
                    ? "último período cargado"
                    : "sin extractos aún"}
                  )
                </p>
                <p
                  className="mt-1 tabular-nums font-light text-vault-text dark:text-[#e6edf3]"
                  style={{ fontSize: 28 }}
                >
                  {latestClosingBalanceByAccount.has(selectedAccount.id)
                    ? formatCurrency(
                        latestClosingBalanceByAccount.get(selectedAccount.id)!,
                        selectedAccount.currency
                      )
                    : "—"}
                </p>
              </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {/* Default: cuenta comitente muestra la cartera, el resto últimas transacciones */}
              {accountSubView === "default" && selectedAccount.account_type === "broker" && (
                <CarteraSummaryCard accountId={selectedAccount.id} />
              )}
              {accountSubView === "default" && selectedAccount.account_type !== "broker" && (
                <>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                    Últimas transacciones
                  </p>
                  {recentTransactions.length === 0 ? (
                    <p className="text-xs text-vault-muted2 dark:text-[#8b949e]">
                      Sin transacciones registradas.
                    </p>
                  ) : (
                    <ul>
                      {recentTransactions.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-baseline gap-2 border-b border-vault-border/30 py-1.5 text-xs last:border-0 dark:border-[#30363d]/30"
                        >
                          <span className="w-[46px] flex-shrink-0 text-vault-muted2 dark:text-[#8b949e]">
                            {new Date(t.date + "T12:00:00").toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-vault-muted2 dark:text-[#8b949e]">
                            {t.description}
                          </span>
                          <span
                            className={`flex-shrink-0 tabular-nums font-medium ${t.amount_ars >= 0 ? "text-vault-green" : "text-vault-text dark:text-[#e6edf3]"}`}
                          >
                            {t.amount_ars >= 0 ? "+" : ""}
                            {formatCurrency(t.amount_ars, selectedAccount.currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {accountSubView === "default" && activeStatus && (
                <div className="mt-3 rounded-vault border border-vault-border bg-vault-s2 px-3 py-2.5 text-xs dark:bg-[#21262d]">
                  Último envío:{" "}
                  <span className={`font-medium ${STATUS_COLORS[activeStatus.status]}`}>
                    {STATUS_LABELS[activeStatus.status]}
                  </span>
                  {activeStatus.status === "review" && (
                    <Link to={`/uploads/${activeStatus.upload_id}/review`} className="ml-2 text-vault-accent hover:underline">Revisar →</Link>
                  )}
                </div>
              )}

              {/* Upload form */}
              {accountSubView === "upload" && (
                <form onSubmit={handleUploadSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                      Mes
                    </label>
                    <input
                      type="month"
                      required
                      value={periodStart.slice(0, 7)}
                      onChange={(e) => {
                        setPeriodStart(`${e.target.value}-01`);
                      }}
                      className="input-vault"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                      Archivo
                    </label>
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
                          className="ml-2 text-xs text-vault-muted2 hover:text-vault-red dark:text-[#8b949e]"
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
                          if (f) setUploadFile(f);
                        }}
                        className={`flex flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed px-4 py-5 text-center transition-colors ${isDragging ? "border-vault-accent bg-vault-accent/5" : "border-vault-border2 dark:border-[#484f58]"}`}
                      >
                        <span className="text-xl text-vault-muted2 dark:text-[#8b949e]">↑</span>
                        <p className="text-xs text-vault-muted2 dark:text-[#8b949e]">PDF o XLSX</p>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-1 rounded border border-vault-border2 px-3 py-1 text-xs text-vault-muted2 hover:border-vault-accent hover:text-vault-accent dark:border-[#484f58] dark:text-[#8b949e]"
                        >
                          Seleccionar
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
                  {activeStatus && (
                    <div className="rounded-vault border border-vault-border bg-vault-s2 px-3.5 py-2.5 text-sm dark:bg-[#21262d]">
                      Estado:{" "}
                      <span className={`font-medium ${STATUS_COLORS[activeStatus.status]}`}>
                        {STATUS_LABELS[activeStatus.status]}
                      </span>
                      {activeStatus.status === "review" && (
                        <Link
                          to={`/uploads/${activeStatus.upload_id}/review`}
                          className="mt-1 block text-xs text-vault-accent hover:underline"
                        >
                          Revisar transacciones →
                        </Link>
                      )}
                      {activeStatus.pending_mep && (
                        <p className="mt-1 text-xs text-vault-yellow">
                          Falta TC MEP —{" "}
                          <Link to="/settings" className="underline">
                            configurar
                          </Link>
                        </p>
                      )}
                    </div>
                  )}
                </form>
              )}

              {/* Periods list */}
              {accountSubView === "periods" && (
                <>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                    Períodos cargados
                  </p>
                  {!accountUploads || accountUploads.length === 0 ? (
                    <p className="text-xs text-vault-muted2 dark:text-[#8b949e]">
                      Todavía no hay extractos subidos.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {accountUploads.map((u) => {
                        const [year, month] = u.period_month.split("-");
                        const label = new Date(
                          Number(year),
                          Number(month) - 1,
                          1
                        ).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
                        const statusColor =
                          u.status === "done"
                            ? "text-vault-green"
                            : u.status === "review"
                              ? "text-vault-yellow"
                              : u.status === "error"
                                ? "text-vault-red"
                                : u.status === "processing"
                                  ? "text-vault-accent"
                                  : "text-vault-muted2 dark:text-[#8b949e]";
                        const statusLabel =
                          u.status === "done"
                            ? "Completado"
                            : u.status === "review"
                              ? "Revisar"
                              : u.status === "processing"
                                ? "Procesando"
                                : u.status === "error"
                                  ? "Error"
                                  : "Pendiente";
                        return (
                          <li
                            key={u.id}
                            className="flex items-center justify-between rounded-vault border border-vault-border bg-vault-s2 px-3 py-2 dark:bg-[#21262d]"
                          >
                            <div>
                              <p className="text-xs font-medium capitalize text-vault-text dark:text-[#e6edf3]">
                                {label}
                              </p>
                              <p className={`text-[11px] ${statusColor}`}>{statusLabel}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {(u.status === "review" || u.status === "done") && (
                                <Link
                                  to={`/uploads/${u.id}/transactions`}
                                  className={
                                    u.status === "review"
                                      ? "rounded border border-vault-yellow/40 bg-vault-yellow/10 px-2.5 py-0.5 text-[11px] font-medium text-vault-yellow hover:bg-vault-yellow/20"
                                      : "rounded border border-vault-border px-2.5 py-0.5 text-[11px] text-vault-muted2 hover:border-vault-accent hover:text-vault-accent dark:border-[#30363d] dark:text-[#8b949e]"
                                  }
                                >
                                  Ver
                                </Link>
                              )}
                              {(u.status === "done" ||
                                u.status === "review" ||
                                u.status === "error") && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteUploadId(u.id);
                                  }}
                                  className="flex h-5 w-5 items-center justify-center rounded text-[13px] text-vault-muted2 hover:bg-vault-red/10 hover:text-vault-red dark:text-[#8b949e]"
                                  title="Eliminar extracto"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>

            {/* Buttons */}
            <div className="border-t border-vault-border px-4 py-3 dark:border-[#30363d]">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccountSubView((v) => (v === "upload" ? "default" : "upload"));
                    setUploadFile(null);
                    setUploadError(null);
                  }}
                  className={`flex-1 rounded-vault border py-1.5 text-xs font-medium transition-colors ${accountSubView === "upload" ? "border-vault-border text-vault-muted2 hover:text-vault-text dark:border-[#30363d] dark:text-[#8b949e]" : "border-vault-accent/40 bg-vault-accent/10 text-vault-accent hover:bg-vault-accent/20"}`}
                >
                  {accountSubView === "upload" ? "Cancelar" : "+ Subir extracto"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAccountSubView((v) => (v === "periods" ? "default" : "periods"))
                  }
                  className={`flex-1 rounded-vault border py-1.5 text-xs font-medium transition-colors ${accountSubView === "periods" ? "border-vault-accent/40 bg-vault-accent/10 text-vault-accent" : "border-vault-border2 text-vault-muted2 hover:border-vault-accent hover:text-vault-accent dark:border-[#484f58] dark:text-[#8b949e]"}`}
                >
                  Ver todos los períodos
                </button>
              </div>
            </div>

            {/* Edit section */}
            <div className="border-t border-vault-border px-4 py-3 dark:border-[#30363d]">
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

      {/* Modal: confirmar eliminación de extracto */}
      {deleteUploadId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDeleteUploadId(null)}
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
              <span className="font-medium capitalize text-vault-text dark:text-[#e6edf3]">
                {deleteUploadLabel}
              </span>
              . Esto borrará todas las transacciones asociadas. ¿Confirmar?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteUploadId(null)}
                className="flex-1 rounded-vault border border-vault-border py-2 text-sm text-vault-muted2 hover:text-vault-text dark:border-[#30363d] dark:text-[#8b949e]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteUpload.isPending}
                onClick={async () => {
                  if (!deleteUploadId) return;
                  await deleteUpload.mutateAsync(deleteUploadId);
                  setDeleteUploadId(null);
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
