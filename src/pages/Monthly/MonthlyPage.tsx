import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDashboard } from "@/api/dashboard.api";
import { useUploads } from "@/api/uploads.api";
import { useAccounts, getAccountDisplayName, type AccountType } from "@/api/accounts.api";
import { useTransactions, type Transaction } from "@/api/transactions.api";
import { useExchangeRates } from "@/api/exchangeRates.api";
import { CategoryLedger } from "@/components/transactions/CategoryLedger";
import { getCategoryColor } from "@/utils/categoryColors";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  sumCreditDebitByCategory,
  type CategoryCreditDebit,
} from "@/utils/categoryGroups";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatPeriod } from "@/utils/formatDate";

function getMonthEnd(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

const CREDIT_CARD_TYPES = new Set<AccountType>(["credit_card_ars", "credit_card_usd"]);

interface CreditCardBreakdown {
  consumosArs: number;
  consumosUsd: number;
  impuestosArs: number;
  creditosArs: number;
  remanenteArs: number;
  remanenteUsd: number;
  totalArs: number;
  totalUsd: number;
}

/**
 * Regla 2: separa consumos/impuestos/créditos del período de tarjeta.
 * El total del período incluye TODAS las transacciones del resumen —
 * las cuotas de compras anteriores igual las cobra el banco este mes,
 * así que cuentan como consumo del período (se muestran con badge "cuota X/Y").
 * `remanenteArs`/`remanenteUsd`: saldo del período anterior que no se canceló
 * del todo (SALDO ANTERIOR - pago, extraído por el worker) — sin esto, ese
 * remanente desaparece del total mostrado.
 */
function computeCreditCardBreakdown(
  transactions: Transaction[],
  remanenteArs: number,
  remanenteUsd: number
): CreditCardBreakdown {
  let consumosArs = 0;
  let consumosUsd = 0;
  let impuestosArs = 0;
  let creditosArs = 0;

  for (const t of transactions) {
    const nativeAmount =
      t.currency === "USD" ? Number(t.amount_usd) || 0 : Number(t.amount_ars) || 0;

    if (t.category === "Impuestos") {
      if (t.currency === "ARS") {
        if (nativeAmount < 0) impuestosArs += Math.abs(nativeAmount);
        else creditosArs += nativeAmount; // CR.RG — reintegro fiscal
      }
      continue;
    }
    if (t.category === "Reintegro") {
      if (t.currency === "ARS" && nativeAmount > 0) creditosArs += nativeAmount;
      continue;
    }
    if (nativeAmount >= 0) continue; // ingresos/créditos sin categorizar no son consumo

    if (t.currency === "USD") consumosUsd += Math.abs(nativeAmount);
    else consumosArs += Math.abs(nativeAmount);
  }

  return {
    consumosArs,
    consumosUsd,
    impuestosArs,
    creditosArs,
    remanenteArs,
    remanenteUsd,
    totalArs: consumosArs + impuestosArs - creditosArs + remanenteArs,
    totalUsd: consumosUsd + remanenteUsd,
  };
}

interface AccountSummary {
  id: string;
  name: string;
  accountType: AccountType;
  currency: "ARS" | "USD";
  isCreditCard: boolean;
  hasData: boolean; // false when no upload AND no transactions for the period
  // Native currency (ARS for ARS accounts, USD for USD accounts)
  openingNative: number;
  deltaNative: number;
  closingNative: number;
  // Raw USD delta — used for entity total when mepForPeriod is available
  deltaUsd: number;
  // Raw ARS delta (amount_ars pre-converted at transaction time via worker MEP rate)
  deltaArs: number;
  totalSpentNative: number;
  creditCardBreakdown: CreditCardBreakdown | null;
  transactions: Transaction[];
  // Motivo por el que el período quedó en revisión sin que sea un error de
  // carga (ej. la reconciliación créditos-débitos+saldo anterior no cerró
  // contra el saldo impreso) — null si no hay nada para mostrar.
  reviewNote: string | null;
}

interface EntitySummary {
  institution: string;
  // Total delta in ARS: USD accounts converted via mepForPeriod (or per-txn rate fallback)
  totalDeltaArs: number;
  accounts: AccountSummary[];
}

function CategoryCreditDebitList({
  items,
  expandedCategory,
  onToggle,
  ledgerTransactions,
  emptyLabel,
}: {
  items: CategoryCreditDebit[];
  expandedCategory: string | null;
  onToggle: (category: string) => void;
  ledgerTransactions: Transaction[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="flex flex-col divide-y divide-vault-border/50 dark:divide-[#30363d]/50">
      {items.map((item, i) => {
        const isExpanded = expandedCategory === item.category;
        return (
          <div key={item.category}>
            <button
              type="button"
              onClick={() => onToggle(item.category)}
              className="flex w-full items-center gap-2 py-2 text-left text-xs transition-colors hover:bg-vault-s2/30 dark:hover:bg-[#21262d]/30"
            >
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                style={{ background: getCategoryColor(item.category, i) }}
              />
              <span className="min-w-0 flex-1 truncate text-vault-text dark:text-[#e6edf3]">
                {item.category}
              </span>
              <span className="flex-shrink-0 tabular-nums text-vault-red">
                {item.debitoArs > 0 && formatCurrency(item.debitoArs, "ARS")}
                {item.debitoUsd > 0 && (
                  <span className="text-vault-muted2 dark:text-[#8b949e]">
                    {" "}
                    {formatCurrency(item.debitoUsd, "USD")}
                  </span>
                )}
              </span>
              <span className="flex-shrink-0 tabular-nums text-vault-green">
                {item.creditoArs > 0 && formatCurrency(item.creditoArs, "ARS")}
                {item.creditoUsd > 0 && (
                  <span className="text-vault-muted2 dark:text-[#8b949e]">
                    {" "}
                    {formatCurrency(item.creditoUsd, "USD")}
                  </span>
                )}
              </span>
              <span
                className="inline-block w-3 flex-shrink-0 text-vault-muted2 transition-transform duration-150 dark:text-[#8b949e]"
                style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}
              >
                ›
              </span>
            </button>
            {isExpanded && (
              <div className="rounded-vault bg-vault-s2/30 px-2 pb-2 pt-1 dark:bg-[#21262d]/30">
                <CategoryLedger transactions={ledgerTransactions} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MonthlyPage() {
  const { data: uploads } = useUploads();
  const { data: accounts } = useAccounts();
  const { data: exchangeRates } = useExchangeRates();

  const months = useMemo(() => {
    const done = uploads?.filter((u) => u.status === "done") ?? [];
    const seen = new Set<string>();
    const ordered: string[] = [];
    [...done]
      .sort((a, b) => b.period_month.localeCompare(a.period_month))
      .forEach((u) => {
        const p = u.period_month.slice(0, 7);
        if (!seen.has(p)) {
          seen.add(p);
          ordered.push(p);
        }
      });
    return ordered;
  }, [uploads]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(() =>
    searchParams.get("period")
  );
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [expandedBreakdownCategory, setExpandedBreakdownCategory] = useState<string | null>(null);
  const [expandedFlujo, setExpandedFlujo] = useState<"ingresos" | "egresos" | null>(null);

  // El sidebar linkea directo a un mes (/monthly?period=YYYY-MM) — sincroniza
  // acá para que funcione incluso si ya estabas parado en esta página.
  useEffect(() => {
    const p = searchParams.get("period");
    if (p && p !== selectedPeriod) {
      setSelectedPeriod(p);
      setExpandedEntities(new Set());
      setExpandedAccounts(new Set());
      setExpandedBreakdownCategory(null);
      setExpandedFlujo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const period = selectedPeriod ?? months[0];
  const dateFrom = period ? `${period}-01` : undefined;
  const dateTo = period ? getMonthEnd(period) : undefined;

  const { data: summary, isLoading: isLoadingSummary } = useDashboard(period);
  const { data: periodTransactions, isLoading: isLoadingTransactions } = useTransactions({
    dateFrom,
    dateTo,
    enabled: !!period,
  });

  const categoryLedgerTransactions = useMemo(
    () =>
      expandedBreakdownCategory
        ? (periodTransactions ?? []).filter((t) => t.category === expandedBreakdownCategory)
        : [],
    [periodTransactions, expandedBreakdownCategory]
  );

  // Movimientos detrás de "Ingresos"/"Egresos" del flujo — misma definición que
  // el backend (get_flujo_del_mes): excluye tarjetas de crédito, que no son
  // salida de caja real hasta que se pagan.
  const flujoMovements = useMemo(() => {
    if (!expandedFlujo || !periodTransactions || !accounts) return [];
    const accountTypeById = new Map(accounts.map((a) => [a.id, a.account_type]));
    return periodTransactions.filter((t) => {
      const type = accountTypeById.get(t.account_id);
      if (type === "credit_card_ars" || type === "credit_card_usd") return false;
      return expandedFlujo === "ingresos" ? t.amount_ars > 0 : t.amount_ars < 0;
    });
  }, [periodTransactions, accounts, expandedFlujo]);

  // Todas las "cuentas" (categorías) de gasto e ingreso juntas en una sola
  // lista — cada una con su débito y su crédito, así una categoría de gasto
  // con un reintegro (ej. CR.RG bajo "Impuestos") muestra ambos lados en la
  // misma fila, respetando la moneda nativa de cada transacción.
  const cuentaItems = useMemo(() => {
    const categorySet = new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]);
    return sumCreditDebitByCategory(periodTransactions ?? [], categorySet);
  }, [periodTransactions]);

  const debitoTotalArs = cuentaItems.reduce((s, i) => s + i.debitoArs, 0);
  const debitoTotalUsd = cuentaItems.reduce((s, i) => s + i.debitoUsd, 0);
  const creditoTotalArs = cuentaItems.reduce((s, i) => s + i.creditoArs, 0);
  const creditoTotalUsd = cuentaItems.reduce((s, i) => s + i.creditoUsd, 0);

  const flujo = summary?.flujo_del_mes;
  const mepForPeriod = exchangeRates?.find((r) =>
    r.period_month.startsWith(period ?? "__")
  )?.mep_rate;

  const entityData = useMemo((): EntitySummary[] => {
    if (!accounts || !periodTransactions || !uploads || !period) return [];

    // Both ARS and USD opening balances — Decimal from Pydantic serializes as string, coerce.
    // "review" cuenta acá también: la carga puede haber quedado en revisión
    // por una reconciliación que no cerró (ver reviewNoteByAccount abajo),
    // pero eso no significa que el saldo inicial extraído esté vacío — si lo
    // excluyéramos, el saldo mostrado sería 0 en vez del valor real.
    const openingByAccount = new Map<string, { ars: number; usd: number }>();
    const reviewNoteByAccount = new Map<string, string>();
    [...uploads]
      .filter(
        (u) =>
          (u.status === "done" || u.status === "review") && u.period_month.slice(0, 7) === period
      )
      .sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at))
      .forEach((u) => {
        openingByAccount.set(u.account_id, {
          ars: Number(u.opening_balance_ars) || 0,
          usd: Number(u.opening_balance_usd) || 0,
        });
        if (u.status === "review" && u.error_message) {
          reviewNoteByAccount.set(u.account_id, u.error_message);
        }
      });

    const txByAccount = new Map<string, Transaction[]>();
    for (const t of periodTransactions) {
      const list = txByAccount.get(t.account_id);
      if (list) list.push(t);
      else txByAccount.set(t.account_id, [t]);
    }

    const byInstitution = new Map<string, AccountSummary[]>();

    // Iterate ALL active accounts — show even those without uploads/transactions for the period
    for (const account of accounts) {
      if (!account.is_active) continue;

      const isCreditCard = CREDIT_CARD_TYPES.has(account.account_type);
      const isUsd = account.currency === "USD";
      const opening = openingByAccount.get(account.id);
      const txns = txByAccount.get(account.id) ?? [];
      const hasData = opening !== undefined || txns.length > 0;

      const openingBalances = opening ?? { ars: 0, usd: 0 };

      // amount_ars: ARS native or MEP-converted ARS for USD txns (set by worker)
      // amount_usd: USD native or MEP-inverted USD for ARS txns (set by worker)
      const deltaArs = txns.reduce((sum, t) => sum + (Number(t.amount_ars) || 0), 0);
      const deltaUsd = txns.reduce((sum, t) => sum + (Number(t.amount_usd) || 0), 0);

      const openingNative = isUsd ? openingBalances.usd : openingBalances.ars;
      const deltaNative = isUsd ? deltaUsd : deltaArs;
      const closingNative = openingNative + deltaNative;

      const totalSpentNative = txns
        .filter((t) => (isUsd ? Number(t.amount_usd) : Number(t.amount_ars)) < 0)
        .reduce(
          (sum, t) => sum + Math.abs(isUsd ? Number(t.amount_usd) || 0 : Number(t.amount_ars) || 0),
          0
        );

      const creditCardBreakdown = isCreditCard
        ? computeCreditCardBreakdown(txns, openingBalances.ars, openingBalances.usd)
        : null;

      const institution = account.institution ?? "Sin entidad";
      const accSummary: AccountSummary = {
        id: account.id,
        name: getAccountDisplayName(account),
        accountType: account.account_type,
        currency: account.currency,
        isCreditCard,
        hasData,
        openingNative,
        deltaNative,
        closingNative,
        deltaUsd,
        deltaArs,
        totalSpentNative,
        creditCardBreakdown,
        transactions: [...txns].sort((a, b) => a.date.localeCompare(b.date)),
        reviewNote: reviewNoteByAccount.get(account.id) ?? null,
      };

      const existing = byInstitution.get(institution);
      if (existing) existing.push(accSummary);
      else byInstitution.set(institution, [accSummary]);
    }

    return Array.from(byInstitution.entries())
      .map(([institution, accs]) => {
        // Entity total in ARS: exclude credit cards, only count accounts with data
        // USD accounts converted via mepForPeriod; fallback to per-txn amount_ars
        const nonCCWithData = accs.filter((a) => !a.isCreditCard && a.hasData);
        const totalDeltaArs = nonCCWithData.reduce((sum, a) => {
          if (a.currency === "USD" && mepForPeriod) {
            return sum + a.deltaUsd * mepForPeriod;
          }
          return sum + a.deltaArs;
        }, 0);
        return { institution, totalDeltaArs, accounts: accs };
      })
      .sort((a, b) => a.institution.localeCompare(b.institution));
  }, [accounts, periodTransactions, uploads, period, mepForPeriod]);

  const toggleEntity = (name: string) => {
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAccount = (id: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMonthSelect = (m: string) => {
    setSelectedPeriod(m);
    setSearchParams({ period: m }, { replace: true });
    setExpandedEntities(new Set());
    setExpandedAccounts(new Set());
    setExpandedBreakdownCategory(null);
    setExpandedFlujo(null);
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Left: month list */}
      <div className="w-52 flex-shrink-0 overflow-y-auto border-r border-vault-border p-4 dark:border-[#30363d]">
        <p className="section-label mb-3">Períodos</p>
        {months.length === 0 ? (
          <p className="text-xs text-vault-muted2 dark:text-[#8b949e]">
            {uploads === undefined ? "Cargando..." : "Sin extractos procesados aún."}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {months.map((m) => (
              <li key={m}>
                <button
                  type="button"
                  onClick={() => handleMonthSelect(m)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm capitalize transition-colors ${
                    period === m
                      ? "bg-[#eff6ff] font-medium text-[#1e3a8a] dark:bg-[#1d2d50] dark:text-[#93c5fd]"
                      : "text-vault-muted2 hover:bg-[#f1f5f9] hover:text-vault-text dark:text-[#c9d1d9] dark:hover:bg-[#21262d] dark:hover:text-[#e6edf3]"
                  }`}
                >
                  {formatPeriod(m)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Right: content */}
      <div className="flex-1 overflow-y-auto p-7">
        {!period ? (
          <div className="flex h-full items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
            Seleccioná un mes para ver el detalle.
          </div>
        ) : (
          <>
            <h1 className="page-title mb-6 capitalize">{formatPeriod(period)}</h1>

            {isLoadingSummary ? (
              <div className="flex h-32 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                Cargando...
              </div>
            ) : (
              <>
                {/* 1. Flujo del período */}
                {flujo && (
                  <div className="mb-5 card-vault">
                    <h2 className="section-label mb-3">Flujo del período</h2>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedFlujo((prev) => (prev === "ingresos" ? null : "ingresos"))
                        }
                        className={`flex flex-col gap-1 rounded-vault bg-vault-green/5 px-4 py-3 text-left transition-colors hover:bg-vault-green/10 ${
                          expandedFlujo === "ingresos" ? "ring-1 ring-vault-green/40" : ""
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                          Ingresos
                        </span>
                        <span className="tabular-nums text-lg font-semibold text-vault-green">
                          {formatCurrency(flujo.ingresos_ars, "ARS")}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedFlujo((prev) => (prev === "egresos" ? null : "egresos"))
                        }
                        className={`flex flex-col gap-1 rounded-vault bg-vault-red/5 px-4 py-3 text-left transition-colors hover:bg-vault-red/10 ${
                          expandedFlujo === "egresos" ? "ring-1 ring-vault-red/40" : ""
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                          Egresos
                        </span>
                        <span className="tabular-nums text-lg font-semibold text-vault-red">
                          {formatCurrency(Math.abs(flujo.egresos_ars), "ARS")}
                        </span>
                      </button>
                      <div
                        className={`flex flex-col gap-1 rounded-vault px-4 py-3 ${
                          flujo.resultado_ars >= 0 ? "bg-vault-green/5" : "bg-vault-red/5"
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                          Resultado
                        </span>
                        <span
                          className={`tabular-nums text-lg font-semibold ${
                            flujo.resultado_ars >= 0 ? "text-vault-green" : "text-vault-red"
                          }`}
                        >
                          {flujo.resultado_ars >= 0 ? "+" : ""}
                          {formatCurrency(flujo.resultado_ars, "ARS")}
                        </span>
                      </div>
                    </div>

                    {expandedFlujo && (
                      <div className="mt-3 rounded-vault bg-vault-s2/30 px-2 pb-2 pt-1.5 dark:bg-[#21262d]/30">
                        <CategoryLedger transactions={flujoMovements} />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Por entidad */}
                {entityData.length > 0 && (
                  <div className="mb-5 card-vault">
                    <h2 className="section-label mb-1">Por entidad</h2>
                    <div className="flex flex-col divide-y divide-vault-border dark:divide-[#30363d]">
                      {entityData.map((entity) => {
                        const isEntityOpen = expandedEntities.has(entity.institution);
                        return (
                          <div key={entity.institution}>
                            {/* Entity row — delta in ARS (USD accounts converted via mepForPeriod) */}
                            <button
                              type="button"
                              onClick={() => toggleEntity(entity.institution)}
                              className="flex w-full items-center gap-3 py-3 text-left"
                            >
                              <span className="min-w-0 flex-1 text-sm font-medium text-vault-text dark:text-[#e6edf3]">
                                {entity.institution}
                              </span>
                              <span
                                className={`flex-shrink-0 tabular-nums text-sm font-semibold ${
                                  entity.totalDeltaArs >= 0 ? "text-vault-green" : "text-vault-red"
                                }`}
                              >
                                {entity.totalDeltaArs >= 0 ? "+" : ""}
                                {formatCurrency(entity.totalDeltaArs, "ARS")}
                              </span>
                              <span
                                className="flex-shrink-0 text-sm text-vault-muted2 transition-transform duration-200 dark:text-[#8b949e]"
                                style={{ transform: isEntityOpen ? "rotate(90deg)" : "none" }}
                              >
                                ›
                              </span>
                            </button>

                            {/* Accounts */}
                            {isEntityOpen && (
                              <div className="mb-2 ml-1 border-l-2 border-vault-border pl-3 dark:border-[#30363d]">
                                {entity.accounts.map((account) => {
                                  const isAccountOpen = expandedAccounts.has(account.id);
                                  return (
                                    <div
                                      key={account.id}
                                      className="border-b border-vault-border/40 last:border-0 dark:border-[#30363d]/40"
                                    >
                                      {/* Account row — native currency; dimmed when no data */}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          account.hasData ? toggleAccount(account.id) : undefined
                                        }
                                        className={`flex w-full items-center gap-2 py-2 text-left ${!account.hasData ? "cursor-default" : ""}`}
                                      >
                                        <span
                                          className={`min-w-0 flex-1 text-xs ${account.hasData ? "text-vault-muted2 dark:text-[#8b949e]" : "text-vault-muted2/50 dark:text-[#8b949e]/50"}`}
                                        >
                                          {account.name}
                                        </span>
                                        {!account.hasData ? (
                                          <span className="flex-shrink-0 text-xs text-vault-muted2/50 dark:text-[#8b949e]/50">
                                            Sin extracto cargado
                                          </span>
                                        ) : account.isCreditCard && account.creditCardBreakdown ? (
                                          <span className="flex-shrink-0 text-xs text-vault-muted2 dark:text-[#8b949e]">
                                            Total del período:{" "}
                                            <span className="font-medium text-vault-red">
                                              {formatCurrency(
                                                account.creditCardBreakdown.totalArs,
                                                "ARS"
                                              )}
                                            </span>
                                            {account.creditCardBreakdown.totalUsd > 0 && (
                                              <>
                                                {" + "}
                                                <span className="font-medium text-vault-red">
                                                  {formatCurrency(
                                                    account.creditCardBreakdown.totalUsd,
                                                    "USD"
                                                  )}
                                                </span>
                                              </>
                                            )}
                                          </span>
                                        ) : (
                                          <>
                                            <span className="flex-shrink-0 text-xs text-vault-muted2 dark:text-[#8b949e]">
                                              {formatCurrency(
                                                account.openingNative,
                                                account.currency
                                              )}{" "}
                                              →{" "}
                                              {formatCurrency(
                                                account.closingNative,
                                                account.currency
                                              )}
                                            </span>
                                            <span
                                              className={`flex-shrink-0 tabular-nums text-xs font-semibold ${
                                                account.deltaNative >= 0
                                                  ? "text-vault-green"
                                                  : "text-vault-red"
                                              }`}
                                            >
                                              {account.deltaNative >= 0 ? "+" : ""}
                                              {formatCurrency(
                                                account.deltaNative,
                                                account.currency
                                              )}
                                            </span>
                                          </>
                                        )}
                                        {account.hasData && (
                                          <span
                                            className="flex-shrink-0 text-xs text-vault-muted2 transition-transform duration-200 dark:text-[#8b949e]"
                                            style={{
                                              transform: isAccountOpen ? "rotate(90deg)" : "none",
                                            }}
                                          >
                                            ›
                                          </span>
                                        )}
                                      </button>

                                      {account.reviewNote && (
                                        <p className="-mt-1 mb-2 flex items-start gap-1 text-[11px] text-vault-red">
                                          <span aria-hidden="true">⚠</span>
                                          <span>{account.reviewNote}</span>
                                        </p>
                                      )}

                                      {/* Desglose del período — tarjetas de crédito (Regla 2) */}
                                      {account.hasData &&
                                        isAccountOpen &&
                                        account.isCreditCard &&
                                        account.creditCardBreakdown && (
                                          <div className="mb-2 grid grid-cols-2 gap-2 rounded-vault bg-vault-s2/40 px-3 py-2 text-xs dark:bg-[#21262d]/40 sm:grid-cols-4">
                                            <div className="flex flex-col gap-0.5">
                                              <span className="text-[10px] uppercase tracking-wide text-vault-muted2 dark:text-[#8b949e]">
                                                Consumos ARS
                                              </span>
                                              <span className="tabular-nums font-medium text-vault-text dark:text-[#e6edf3]">
                                                {formatCurrency(
                                                  account.creditCardBreakdown.consumosArs,
                                                  "ARS"
                                                )}
                                              </span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                              <span className="text-[10px] uppercase tracking-wide text-vault-muted2 dark:text-[#8b949e]">
                                                Consumos USD
                                              </span>
                                              <span className="tabular-nums font-medium text-vault-text dark:text-[#e6edf3]">
                                                {formatCurrency(
                                                  account.creditCardBreakdown.consumosUsd,
                                                  "USD"
                                                )}
                                              </span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                              <span className="text-[10px] uppercase tracking-wide text-vault-muted2 dark:text-[#8b949e]">
                                                Impuestos ARS
                                              </span>
                                              <span className="tabular-nums font-medium text-vault-text dark:text-[#e6edf3]">
                                                {formatCurrency(
                                                  account.creditCardBreakdown.impuestosArs,
                                                  "ARS"
                                                )}
                                              </span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                              <span className="text-[10px] uppercase tracking-wide text-vault-muted2 dark:text-[#8b949e]">
                                                Créditos ARS
                                              </span>
                                              <span className="tabular-nums font-medium text-vault-green">
                                                {account.creditCardBreakdown.creditosArs > 0
                                                  ? "-"
                                                  : ""}
                                                {formatCurrency(
                                                  account.creditCardBreakdown.creditosArs,
                                                  "ARS"
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                        )}

                                      {/* Transactions — libro diario (bank) or simple list (credit card) */}
                                      {account.hasData && isAccountOpen && (
                                        <div className="mb-2 overflow-x-auto rounded-vault bg-vault-s2/40 dark:bg-[#21262d]/40">
                                          {account.transactions.length === 0 ? (
                                            <p className="px-3 py-2 text-xs text-vault-muted2 dark:text-[#8b949e]">
                                              Sin transacciones registradas.
                                            </p>
                                          ) : account.isCreditCard ? (
                                            /* Estilo resumen BBVA: columnas Pesos / Dólares */
                                            <table className="w-full min-w-[420px] text-xs">
                                              <thead>
                                                <tr className="border-b border-vault-border/40 dark:border-[#30363d]/40">
                                                  {["Fecha", "Descripción", "Pesos", "Dólares"].map(
                                                    (h, i) => (
                                                      <th
                                                        key={h}
                                                        className={`py-1.5 text-[10px] font-semibold uppercase tracking-wider text-vault-muted2 dark:text-[#8b949e] ${
                                                          i === 0
                                                            ? "pl-3 text-left"
                                                            : i === 1
                                                              ? "text-left"
                                                              : i === 3
                                                                ? "pr-3 text-right"
                                                                : "text-right"
                                                        }`}
                                                      >
                                                        {h}
                                                      </th>
                                                    )
                                                  )}
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {account.creditCardBreakdown &&
                                                  (account.creditCardBreakdown.remanenteArs > 0 ||
                                                    account.creditCardBreakdown.remanenteUsd >
                                                      0) && (
                                                    <tr className="border-b border-vault-border/20 italic dark:border-[#30363d]/20">
                                                      <td className="py-1.5 pl-3 text-vault-muted2 dark:text-[#8b949e]">
                                                        —
                                                      </td>
                                                      <td className="max-w-[180px] truncate py-1.5 text-vault-muted2 dark:text-[#8b949e]">
                                                        Saldo anterior sin pagar
                                                        <span
                                                          className="ml-1.5 rounded bg-vault-red/10 px-1 py-0.5 text-[10px] font-medium text-vault-red not-italic"
                                                          title="SALDO ANTERIOR menos SU PAGO del resumen previo — no es un consumo del período, es deuda que se arrastra"
                                                        >
                                                          arrastre
                                                        </span>
                                                      </td>
                                                      <td className="py-1.5 text-right tabular-nums font-medium text-vault-red">
                                                        {account.creditCardBreakdown.remanenteArs >
                                                        0
                                                          ? formatCurrency(
                                                              account.creditCardBreakdown
                                                                .remanenteArs,
                                                              "ARS"
                                                            )
                                                          : ""}
                                                      </td>
                                                      <td className="py-1.5 pr-3 text-right tabular-nums font-medium text-vault-red">
                                                        {account.creditCardBreakdown.remanenteUsd >
                                                        0
                                                          ? formatCurrency(
                                                              account.creditCardBreakdown
                                                                .remanenteUsd,
                                                              "USD"
                                                            )
                                                          : ""}
                                                      </td>
                                                    </tr>
                                                  )}
                                                {account.transactions.map((t) => {
                                                  const ars = Number(t.amount_ars) || 0;
                                                  const usd = Number(t.amount_usd) || 0;
                                                  return (
                                                    <tr
                                                      key={t.id}
                                                      className="border-b border-vault-border/20 last:border-0 dark:border-[#30363d]/20"
                                                    >
                                                      <td className="py-1.5 pl-3 text-vault-muted2 dark:text-[#8b949e]">
                                                        {fmtDate(t.date)}
                                                      </td>
                                                      <td className="max-w-[180px] truncate py-1.5 text-vault-muted2 dark:text-[#8b949e]">
                                                        {t.description}
                                                        {t.total_installments && (
                                                          <span
                                                            className="ml-1.5 rounded bg-vault-accent/10 px-1 py-0.5 text-[10px] font-medium text-vault-accent"
                                                            title="Número de cuota de esta compra"
                                                          >
                                                            cuota {t.current_installment}/
                                                            {t.total_installments}
                                                          </span>
                                                        )}
                                                      </td>
                                                      <td
                                                        className={`py-1.5 text-right tabular-nums font-medium ${
                                                          ars >= 0
                                                            ? "text-vault-green"
                                                            : "text-vault-red"
                                                        }`}
                                                      >
                                                        {t.currency === "ARS"
                                                          ? `${ars >= 0 ? "+" : ""}${formatCurrency(Math.abs(ars), "ARS")}`
                                                          : ""}
                                                      </td>
                                                      <td
                                                        className={`py-1.5 pr-3 text-right tabular-nums font-medium ${
                                                          usd >= 0
                                                            ? "text-vault-green"
                                                            : "text-vault-red"
                                                        }`}
                                                      >
                                                        {t.currency === "USD"
                                                          ? `${usd >= 0 ? "+" : ""}${formatCurrency(Math.abs(usd), "USD")}`
                                                          : ""}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                              {account.creditCardBreakdown && (
                                                <tfoot>
                                                  <tr className="border-t border-vault-border/40 dark:border-[#30363d]/40">
                                                    <td
                                                      colSpan={2}
                                                      className="py-1.5 pl-3 font-semibold text-vault-text dark:text-[#e6edf3]"
                                                    >
                                                      Total del período
                                                    </td>
                                                    <td className="py-1.5 text-right tabular-nums font-semibold text-vault-red">
                                                      {formatCurrency(
                                                        account.creditCardBreakdown.totalArs,
                                                        "ARS"
                                                      )}
                                                    </td>
                                                    <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-vault-red">
                                                      {account.creditCardBreakdown.totalUsd > 0
                                                        ? formatCurrency(
                                                            account.creditCardBreakdown.totalUsd,
                                                            "USD"
                                                          )
                                                        : ""}
                                                    </td>
                                                  </tr>
                                                </tfoot>
                                              )}
                                            </table>
                                          ) : (
                                            /* Libro diario in native currency */
                                            <table className="w-full min-w-[500px] text-xs">
                                              <thead>
                                                <tr className="border-b border-vault-border/40 dark:border-[#30363d]/40">
                                                  {[
                                                    "Fecha",
                                                    "Descripción",
                                                    "Débito",
                                                    "Crédito",
                                                    "Saldo",
                                                  ].map((h, i) => (
                                                    <th
                                                      key={h}
                                                      className={`py-1.5 text-[10px] font-semibold uppercase tracking-wider text-vault-muted2 dark:text-[#8b949e] ${
                                                        i === 0
                                                          ? "pl-3 text-left"
                                                          : i === 1
                                                            ? "text-left"
                                                            : i === 4
                                                              ? "pr-3 text-right"
                                                              : "text-right"
                                                      }`}
                                                    >
                                                      {h}
                                                    </th>
                                                  ))}
                                                </tr>
                                              </thead>
                                              <tbody>
                                                <tr className="border-b border-vault-border/20 bg-vault-s2/60 dark:border-[#30363d]/20 dark:bg-[#21262d]/60">
                                                  <td className="py-1.5 pl-3 text-vault-muted2 dark:text-[#8b949e]">
                                                    —
                                                  </td>
                                                  <td className="max-w-[180px] truncate py-1.5 font-medium text-vault-text dark:text-[#e6edf3]">
                                                    Saldo anterior
                                                  </td>
                                                  <td className="py-1.5 text-right tabular-nums text-vault-muted2 dark:text-[#8b949e]">
                                                    —
                                                  </td>
                                                  <td className="py-1.5 text-right tabular-nums text-vault-muted2 dark:text-[#8b949e]">
                                                    —
                                                  </td>
                                                  <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-vault-text dark:text-[#e6edf3]">
                                                    {formatCurrency(
                                                      account.openingNative,
                                                      account.currency
                                                    )}
                                                  </td>
                                                </tr>
                                                {(() => {
                                                  let balance = account.openingNative;
                                                  return account.transactions.map((t) => {
                                                    const amt =
                                                      account.currency === "USD"
                                                        ? Number(t.amount_usd) || 0
                                                        : Number(t.amount_ars) || 0;
                                                    balance += amt;
                                                    return (
                                                      <tr
                                                        key={t.id}
                                                        className="border-b border-vault-border/20 last:border-0 dark:border-[#30363d]/20"
                                                      >
                                                        <td className="py-1.5 pl-3 text-vault-muted2 dark:text-[#8b949e]">
                                                          {fmtDate(t.date)}
                                                        </td>
                                                        <td className="max-w-[180px] truncate py-1.5 text-vault-muted2 dark:text-[#8b949e]">
                                                          {t.description}
                                                        </td>
                                                        <td className="py-1.5 text-right tabular-nums text-vault-red">
                                                          {amt < 0
                                                            ? formatCurrency(
                                                                Math.abs(amt),
                                                                account.currency
                                                              )
                                                            : ""}
                                                        </td>
                                                        <td className="py-1.5 text-right tabular-nums text-vault-green">
                                                          {amt >= 0
                                                            ? formatCurrency(amt, account.currency)
                                                            : ""}
                                                        </td>
                                                        <td
                                                          className={`py-1.5 pr-3 text-right tabular-nums font-medium ${
                                                            balance >= 0
                                                              ? "text-vault-text dark:text-[#e6edf3]"
                                                              : "text-vault-red"
                                                          }`}
                                                        >
                                                          {formatCurrency(
                                                            balance,
                                                            account.currency
                                                          )}
                                                        </td>
                                                      </tr>
                                                    );
                                                  });
                                                })()}
                                              </tbody>
                                            </table>
                                          )}
                                        </div>
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
                  </div>
                )}

                {/* 3. Gastos e ingresos por categoría (débito/crédito juntos) */}
                <div className="card-vault">
                  <h2 className="section-label mb-1">Gastos e ingresos por categoría</h2>
                  {isLoadingTransactions ? (
                    <div className="flex h-32 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                      Cargando...
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 flex gap-6">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                            Débito total
                          </p>
                          <p
                            className="tabular-nums font-light text-vault-red"
                            style={{ fontSize: 24 }}
                          >
                            {formatCurrency(debitoTotalArs, "ARS")}
                            {debitoTotalUsd > 0 && (
                              <span className="ml-1.5 text-sm text-vault-muted2 dark:text-[#8b949e]">
                                + {formatCurrency(debitoTotalUsd, "USD")}
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                            Crédito total
                          </p>
                          <p
                            className="tabular-nums font-light text-vault-green"
                            style={{ fontSize: 24 }}
                          >
                            {formatCurrency(creditoTotalArs, "ARS")}
                            {creditoTotalUsd > 0 && (
                              <span className="ml-1.5 text-sm text-vault-muted2 dark:text-[#8b949e]">
                                + {formatCurrency(creditoTotalUsd, "USD")}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <CategoryCreditDebitList
                        items={cuentaItems}
                        expandedCategory={expandedBreakdownCategory}
                        onToggle={(cat) =>
                          setExpandedBreakdownCategory((prev) => (prev === cat ? null : cat))
                        }
                        ledgerTransactions={categoryLedgerTransactions}
                        emptyLabel="Sin movimientos registrados para este período."
                      />
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
