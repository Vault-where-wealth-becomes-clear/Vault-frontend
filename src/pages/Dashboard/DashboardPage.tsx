import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useDashboard,
  useDashboardBreakdown,
  useDashboardMonthlySeries,
  useFullDashboard,
} from "@/api/dashboard.api";
import { useExportXlsx } from "@/api/exports.api";
import { useExchangeRates, useSetExchangeRate } from "@/api/exchangeRates.api";
import { getCotizacionMEP } from "@/api/mepQuote.api";
import { useAccounts, getAccountDisplayName } from "@/api/accounts.api";
import { useUploads } from "@/api/uploads.api";
import { useTransactions } from "@/api/transactions.api";
import {
  AccountBalanceChart,
  type AccountBalancePoint,
  type AccountBalanceLine,
} from "@/components/charts/AccountBalanceChart";
import { BreakdownChart } from "@/components/charts/BreakdownChart";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { extractErrorMessage } from "@/utils/apiError";
import { formatCurrency, formatPercent } from "@/utils/formatCurrency";
import { formatPeriod } from "@/utils/formatDate";
import { computeUploadClosingBalance, groupTransactionsByUpload } from "@/utils/accountBalance";

const ADVANCED_SECTIONS: {
  key: "cartera" | "proyeccion" | "compromisos";
  label: string;
  cta: string;
}[] = [
  {
    key: "cartera",
    label: "Cartera de inversiones",
    cta: "Pedí este análisis la próxima vez que subas un extracto de broker",
  },
  {
    key: "proyeccion",
    label: "Proyección a 3 meses",
    cta: "Pedí este análisis la próxima vez que subas un extracto",
  },
  {
    key: "compromisos",
    label: "Cuotas pendientes",
    cta: "Pedí este análisis la próxima vez que subas un extracto",
  },
];

export function DashboardPage() {
  const { data: uploads } = useUploads();
  // Sin filtro: todas las transacciones del usuario, para poder reconstruir
  // el saldo histórico de cuentas sin extractos (ej. efectivo) a partir de
  // sus movimientos manuales — no tienen uploads que den un saldo por período.
  const { data: allTransactions } = useTransactions();

  const latestDonePeriod = useMemo(() => {
    const done = uploads?.filter((u) => u.status === "done") ?? [];
    return done
      .map((u) => u.period_month.slice(0, 7))
      .sort()
      .pop();
  }, [uploads]);

  const donePeriodSet = useMemo(
    () =>
      new Set(
        (uploads?.filter((u) => u.status === "done") ?? []).map((u) => u.period_month.slice(0, 7))
      ),
    [uploads]
  );

  const period = latestDonePeriod;

  const { data: summary, isLoading: isLoadingSummary } = useDashboard(period);
  const { data: breakdown, isLoading: isLoadingBreakdown } = useDashboardBreakdown(period);
  const { data: monthlySeries } = useDashboardMonthlySeries(summary?.period);
  const { data: fullDashboard } = useFullDashboard(period);
  const { data: exchangeRates } = useExchangeRates();
  const { data: accounts } = useAccounts();
  const exportXlsx = useExportXlsx();
  const setRate = useSetExchangeRate();

  const [exportError, setExportError] = useState<string | null>(null);
  const [currencyDisplay, setCurrencyDisplay] = useState<"USD" | "ARS">(() => {
    return (localStorage.getItem("vault_currency_display") as "USD" | "ARS") ?? "USD";
  });
  const [mepFetching, setMepFetching] = useState(false);
  const [liveMep, setLiveMep] = useState<number | null>(null);
  const [mepSaving, setMepSaving] = useState(false);
  const [hiddenAccountIds, setHiddenAccountIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("vault_liquid_assets_hidden_accounts");
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  const toggleCurrency = (currency: "USD" | "ARS") => {
    setCurrencyDisplay(currency);
    localStorage.setItem("vault_currency_display", currency);
  };

  const toggleAccountVisibility = (accountId: string) => {
    setHiddenAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      localStorage.setItem("vault_liquid_assets_hidden_accounts", JSON.stringify([...next]));
      return next;
    });
  };

  const handleExport = async () => {
    setExportError(null);
    try {
      const url = await exportXlsx.mutateAsync();
      window.open(url, "_blank");
    } catch (err) {
      setExportError(extractErrorMessage(err));
    }
  };

  const handleFetchLiveMep = async () => {
    setMepFetching(true);
    setLiveMep(null);
    try {
      const quote = await getCotizacionMEP();
      setLiveMep(quote.venta);
    } catch {
      // silently fail
    } finally {
      setMepFetching(false);
    }
  };

  const handleSaveLiveMep = async () => {
    if (!liveMep || !summary) return;
    setMepSaving(true);
    try {
      await setRate.mutateAsync({ periodMonth: summary.period, mepRate: liveMep });
      setLiveMep(null);
    } finally {
      setMepSaving(false);
    }
  };

  const currentPeriodRate = exchangeRates?.find((r) =>
    r.period_month.startsWith(summary?.period ?? "__")
  );
  const mepForPeriod = currentPeriodRate?.mep_rate;

  // Serie mensual: solo meses con extractos procesados (evita meses vacíos en 0)
  const filteredMonthlySeries = useMemo(() => {
    if (!monthlySeries) return [];
    if (donePeriodSet.size === 0) return monthlySeries;
    return monthlySeries.filter((p) => donePeriodSet.has(p.month));
  }, [monthlySeries, donePeriodSet]);

  // TC MEP más cercano a un mes dado — igual estrategia que el worker
  // (_get_mep_rate: exacto o el más reciente disponible), para poder
  // convertir cuentas ARS/USD a una sola moneda en el gráfico.
  const getMepRateForMonth = useMemo(() => {
    const sorted = [...(exchangeRates ?? [])].sort((a, b) =>
      a.period_month.localeCompare(b.period_month)
    );
    return (month: string): number | null => {
      const exact = sorted.find((r) => r.period_month.slice(0, 7) === month);
      if (exact) return exact.mep_rate;
      const priorOrEqual = sorted.filter((r) => r.period_month.slice(0, 7) <= month);
      if (priorOrEqual.length > 0) return priorOrEqual[priorOrEqual.length - 1].mep_rate;
      return sorted[0]?.mep_rate ?? null;
    };
  }, [exchangeRates]);

  // Saldo por cuenta a lo largo de los meses — una línea por cuenta (tarjetas
  // de crédito excluidas: current_balance nunca se actualiza para ellas).
  // El saldo de cierre de cada mes es el saldo de apertura del upload
  // siguiente (SF(N) = SI(N+1), invariante ya reconciliado en el worker);
  // para el mes más reciente de cada cuenta se usa el current_balance vivo.
  // Todas las cuentas se convierten a currencyDisplay (el mismo toggle
  // USD/ARS del resto del tablero) para que las magnitudes sean comparables
  // entre cuentas — antes una CA en USD se veía "chiquita" al lado de
  // cuentas en ARS solo por estar en otra moneda, sin conversión real.
  const accountBalanceSeries = useMemo(() => {
    if (!accounts || !uploads)
      return { points: [] as AccountBalancePoint[], lines: [] as AccountBalanceLine[] };

    const nonCcAccounts = accounts.filter(
      (a) =>
        a.is_active && a.account_type !== "credit_card_ars" && a.account_type !== "credit_card_usd"
    );
    const doneUploads = uploads.filter((u) => u.status === "done");

    const toDisplayCurrency = (
      nativeValue: number,
      accountIsUsd: boolean,
      month: string
    ): number | null => {
      const targetIsUsd = currencyDisplay === "USD";
      if (accountIsUsd === targetIsUsd) return nativeValue;
      const rate = getMepRateForMonth(month);
      if (rate == null) return null; // sin TC para convertir — mejor no mostrar un número engañoso
      return accountIsUsd ? nativeValue * rate : nativeValue / rate;
    };

    const monthSet = new Set<string>();
    const perAccountBalances = new Map<string, Map<string, number | null>>();
    const txnsByUpload = groupTransactionsByUpload(allTransactions ?? []);

    for (const account of nonCcAccounts) {
      const accountUploads = doneUploads
        .filter((u) => u.account_id === account.id)
        .sort((a, b) => a.period_month.localeCompare(b.period_month));
      if (accountUploads.length === 0) continue;

      const isUsd = account.currency === "USD";
      const balances = new Map<string, number | null>();
      accountUploads.forEach((u) => {
        const month = u.period_month.slice(0, 7);
        // Saldo inicial + neto de las transacciones de ESTE upload — no
        // depende de closing_balance_{ars,usd} (requiere que el worker haya
        // podido leer el saldo impreso, falla si el LLM no alinea 1:1 con el
        // extracto) ni de current_balance (valor derivado por el LLM).
        const closing = computeUploadClosingBalance(u, txnsByUpload.get(u.id) ?? [], isUsd);
        balances.set(month, toDisplayCurrency(closing, isUsd, month));
        monthSet.add(month);
      });
      perAccountBalances.set(account.id, balances);
    }

    const months = Array.from(monthSet).sort().slice(-6);
    const latestMonth = months[months.length - 1];

    // Cuentas sin ningún extracto cargado (ej. efectivo/caja de seguridad) no
    // tienen un saldo de apertura/cierre por período — se reconstruye el
    // saldo corriente sumando sus transacciones manuales hasta el final de
    // cada mes. Así una cuenta con un depósito de hace varios meses (ej.
    // 29-12) aparece con ese saldo desde ese mes en adelante, no solo en el
    // más reciente del gráfico.
    if (months.length > 0) {
      for (const account of nonCcAccounts) {
        if (perAccountBalances.has(account.id)) continue;
        const accountTxns = (allTransactions ?? []).filter((t) => t.account_id === account.id);
        const isUsd = account.currency === "USD";
        if (accountTxns.length > 0) {
          const balances = new Map<string, number | null>();
          for (const month of months) {
            const txnsUpToMonth = accountTxns.filter((t) => t.date.slice(0, 7) <= month);
            if (txnsUpToMonth.length === 0) {
              balances.set(month, null); // la cuenta todavía no existía en este mes
              continue;
            }
            const running = txnsUpToMonth.reduce(
              (acc, t) => acc + Number(isUsd ? (t.amount_usd ?? 0) : t.amount_ars),
              0
            );
            balances.set(month, toDisplayCurrency(running, isUsd, month));
          }
          perAccountBalances.set(account.id, balances);
        } else if (latestMonth) {
          // Sin transacciones ni extractos — último recurso: current_balance
          // anclado al mes más reciente (mejor que no mostrar nada).
          const balance = Number(account.current_balance);
          if (!balance) continue;
          perAccountBalances.set(
            account.id,
            new Map([[latestMonth, toDisplayCurrency(balance, isUsd, latestMonth)]])
          );
        }
      }
    }

    const points: AccountBalancePoint[] = months.map((month) => {
      const point: AccountBalancePoint = { month };
      for (const [accountId, balances] of perAccountBalances) {
        point[accountId] = balances.has(month) ? balances.get(month)! : null;
      }
      return point;
    });

    const lines: AccountBalanceLine[] = nonCcAccounts
      .filter((a) => perAccountBalances.has(a.id))
      .map((a) => ({
        accountId: a.id,
        label: getAccountDisplayName(a),
        currency: currencyDisplay,
      }));

    return { points, lines };
  }, [accounts, uploads, allTransactions, currencyDisplay, getMepRateForMonth]);

  // Gráfico de activos líquidos: editable — el usuario elige qué cuentas se
  // muestran vía hiddenAccountIds (persistido en localStorage). Las líneas
  // ocultas no se pasan al chart; los puntos se dejan como están, el chart
  // solo dibuja lo que aparece en `lines`.
  const visibleAccountBalanceLines = useMemo(
    () => accountBalanceSeries.lines.filter((l) => !hiddenAccountIds.has(l.accountId)),
    [accountBalanceSeries.lines, hiddenAccountIds]
  );

  // Patrimonio neto real por mes para "Flujo del mes": suma de TODAS las
  // cuentas del gráfico de activos líquidos (no solo las visibles — ocultar
  // una cuenta del gráfico no debería cambiar el patrimonio total), ya
  // convertidas a currencyDisplay. No usar point.patrimonio_usd del backend
  // acá: ese valor es el patrimonio que calculó el LLM de la ÚLTIMA cuenta
  // procesada ese período (cada extracto solo ve su propia cuenta), no una
  // suma real de todas las cuentas — por eso cuentas sin extracto (efectivo,
  // caja de seguridad) quedaban afuera del patrimonio de meses pasados.
  const netWorthByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const point of accountBalanceSeries.points) {
      let sum = 0;
      let hasAny = false;
      for (const line of accountBalanceSeries.lines) {
        const v = point[line.accountId];
        if (typeof v === "number") {
          sum += v;
          hasAny = true;
        }
      }
      if (hasAny) map.set(point.month, sum);
    }
    return map;
  }, [accountBalanceSeries]);

  if (isLoadingSummary || !summary) {
    return (
      <div className="flex h-full items-center justify-center text-vault-muted2 dark:text-[#8b949e]">
        Cargando tablero...
      </div>
    );
  }

  const isEmpty = !accounts || accounts.length === 0;
  const insights = [...(summary.insights ?? []), ...(fullDashboard?.insights ?? [])];

  // Breakdown: filter out zero-amount items
  const filteredBreakdown =
    breakdown?.filter((item) => item.amount_ars !== 0 && item.pct_of_total !== 0) ?? [];

  const steps = [
    { n: 1, active: true, title: "Creá una cuenta", desc: "Agregá tu billetera" },
    { n: 2, active: false, title: "Subí tu extracto", desc: "PDF o XLSX de tu resumen mensual" },
    {
      n: 3,
      active: false,
      title: "Vault hace el resto",
      desc: "La IA categoriza y actualiza tu tablero",
    },
  ];

  return (
    <div className="p-7">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="page-title">Tablero</h1>
          <p className="text-[14px] font-light text-vault-muted2 dark:text-[#8b949e]">
            {summary.period
              ? `Datos de ${formatPeriod(summary.period)}`
              : "Resumen de tu patrimonio y movimientos."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-vault-border2">
              {(["USD", "ARS"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCurrency(c)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    currencyDisplay === c
                      ? "bg-[#1e3a8a] text-white"
                      : "bg-transparent text-vault-muted2 dark:text-[#8b949e] hover:text-vault-text"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button onClick={handleExport} disabled={exportXlsx.isPending} className="btn-primary">
              {exportXlsx.isPending ? "Generando..." : "Exportar XLSX"}
            </button>
          </div>
          {exportError && <p className="text-xs text-vault-red">{exportError}</p>}
        </div>
      </div>

      {isEmpty ? (
        <div className="card-vault overflow-hidden p-0">
          <div style={{ padding: "32px 32px 24px" }}>
            <h2
              className="text-vault-text dark:text-[#e6edf3]"
              style={{ fontSize: 22, fontWeight: 300, marginTop: 0, marginBottom: 8 }}
            >
              Tu tablero está listo.
            </h2>
            <p
              className="text-vault-muted2 dark:text-[#8b949e]"
              style={{ fontSize: 13, marginTop: 0, marginBottom: 28 }}
            >
              Agregá tu primera cuenta para empezar a ver tu patrimonio real.
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 0,
                alignItems: "flex-start",
              }}
            >
              {steps.map((step, i) => (
                <>
                  <div
                    key={step.n}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 10,
                      padding: "0 12px",
                    }}
                  >
                    <div
                      className={
                        step.active ? "" : "border border-vault-border dark:border-[#30363d]"
                      }
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: step.active ? "#1e3a8a" : "transparent",
                        color: step.active ? "white" : undefined,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                        fontWeight: 500,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        className={
                          step.active ? "text-white" : "text-vault-muted2 dark:text-[#8b949e]"
                        }
                      >
                        {step.n}
                      </span>
                    </div>
                    <p className="text-center text-sm font-medium text-vault-text dark:text-[#e6edf3]">
                      {step.title}
                    </p>
                    <p className="text-center text-xs text-vault-muted2 dark:text-[#8b949e]">
                      {step.desc}
                    </p>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      key={`sep-${i}`}
                      className="bg-vault-border dark:bg-[#30363d]"
                      style={{ width: 48, height: 1, marginTop: 20, flexShrink: 0 }}
                    />
                  )}
                </>
              ))}
            </div>
          </div>
          <div style={{ padding: "0 32px 24px", display: "flex", gap: 10 }}>
            <Link to="/accounts" className="btn-primary">
              Agregar mi primera cuenta
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* MEP banner */}
          {currencyDisplay === "ARS" && !mepForPeriod && (
            <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-vault-border bg-vault-s1 dark:bg-[#161b22] px-4 py-3 text-sm text-vault-muted2 dark:text-[#8b949e] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <span>Sin TC MEP para este período.</span>
              {liveMep ? (
                <>
                  <span className="font-medium text-vault-text dark:text-[#e6edf3]">
                    TC MEP: ${liveMep.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveLiveMep}
                    disabled={mepSaving}
                    className="rounded border border-vault-accent/40 bg-vault-accent/10 px-2.5 py-0.5 text-xs text-vault-accent hover:bg-vault-accent/20"
                  >
                    {mepSaving ? "Guardando..." : "Guardar y usar"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleFetchLiveMep}
                  disabled={mepFetching}
                  className="rounded border border-vault-accent/40 bg-vault-accent/10 px-2.5 py-0.5 text-xs text-vault-accent hover:bg-vault-accent/20"
                >
                  {mepFetching ? "Obteniendo..." : "Obtener TC MEP actual"}
                </button>
              )}
              <Link to="/settings" className="ml-auto text-xs text-vault-accent hover:underline">
                Configurar manualmente
              </Link>
            </div>
          )}

          {/* Row 1: patrimonio card (full width) */}
          <div className="mb-5">
            <SummaryCard
              label="Patrimonio total"
              value={
                currencyDisplay === "USD"
                  ? formatCurrency(summary.total_usd, "USD")
                  : mepForPeriod
                    ? formatCurrency(summary.total_usd * mepForPeriod, "ARS")
                    : formatCurrency(summary.total_usd, "USD")
              }
              hint={`${formatPercent(summary.variation_pct)} vs. mes anterior`}
              hintColor={summary.variation_pct >= 0 ? "green" : "red"}
            />
          </div>

          {/* Row 2: activos líquidos — saldo por cuenta a lo largo de los meses,
              editable: el usuario elige qué cuentas se muestran. */}
          <div className="mb-5 card-vault">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-label mb-0">Activos líquidos</h2>
              {accountBalanceSeries.lines.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {accountBalanceSeries.lines.map((line) => {
                    const isHidden = hiddenAccountIds.has(line.accountId);
                    return (
                      <button
                        key={line.accountId}
                        type="button"
                        onClick={() => toggleAccountVisibility(line.accountId)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          isHidden
                            ? "border-vault-border2 text-vault-muted2 opacity-50 dark:border-[#30363d] dark:text-[#8b949e]"
                            : "border-vault-accent/40 bg-vault-accent/10 text-vault-accent"
                        }`}
                        title={isHidden ? "Mostrar en el gráfico" : "Ocultar del gráfico"}
                      >
                        {line.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {accountBalanceSeries.points.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                Sin extractos procesados aún para mostrar saldos históricos.
              </div>
            ) : visibleAccountBalanceLines.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                Todas las cuentas están ocultas — activá alguna arriba para verla en el gráfico.
              </div>
            ) : (
              <AccountBalanceChart
                points={accountBalanceSeries.points}
                lines={visibleAccountBalanceLines}
              />
            )}
          </div>

          {/* Row 3: insights */}
          {insights.length > 0 && (
            <div className="mb-5 card-vault">
              <h2 className="section-label mb-4">Insights</h2>
              <ul className="flex flex-col gap-2">
                {insights.map((insight) => (
                  <li
                    key={insight}
                    className="flex items-start gap-2.5 rounded-vault border border-vault-border bg-vault-s2 dark:bg-[#21262d] px-3.5 py-2.5 text-sm text-vault-muted2 dark:text-[#8b949e]"
                  >
                    <span className="mt-0.5 text-vault-accent">&#8226;</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Row 4: flujo del mes — tabla de los últimos meses disponibles */}
          {filteredMonthlySeries.length > 0 && (
            <div className="mb-5 card-vault">
              <h2 className="section-label mb-3">Flujo del mes</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-vault-border dark:border-[#30363d]">
                      <th className="py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                        Mes
                      </th>
                      <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                        Ingresos
                      </th>
                      <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                        Egresos
                      </th>
                      <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                        Resultado
                      </th>
                      <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-vault-muted2 dark:text-[#8b949e]">
                        Patrimonio neto ({currencyDisplay})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredMonthlySeries].reverse().map((point) => (
                      <tr
                        key={point.month}
                        className="border-b border-vault-border/50 last:border-0 dark:border-[#30363d]/50"
                      >
                        <td className="py-2 capitalize text-vault-text dark:text-[#e6edf3]">
                          {formatPeriod(point.month)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-vault-green">
                          {formatCurrency(point.ingresos_ars, "ARS")}
                        </td>
                        <td className="py-2 text-right tabular-nums text-vault-red">
                          {formatCurrency(Math.abs(point.egresos_ars), "ARS")}
                        </td>
                        <td
                          className={`py-2 text-right tabular-nums font-medium ${
                            point.resultado_ars >= 0 ? "text-vault-green" : "text-vault-red"
                          }`}
                        >
                          {point.resultado_ars >= 0 ? "+" : ""}
                          {formatCurrency(point.resultado_ars, "ARS")}
                        </td>
                        <td className="py-2 text-right tabular-nums font-medium text-vault-text dark:text-[#e6edf3]">
                          {netWorthByMonth.has(point.month)
                            ? formatCurrency(netWorthByMonth.get(point.month)!, currencyDisplay)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Row 5: gastos por categoría (pie chart) */}
          <div className="mb-5 card-vault">
            <h2 className="section-label mb-4">Gastos por categoría</h2>
            {isLoadingBreakdown ? (
              <div className="flex h-32 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                Cargando...
              </div>
            ) : filteredBreakdown.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                Todavía no hay movimientos este mes.
              </div>
            ) : (
              <BreakdownChart data={filteredBreakdown} mepRate={mepForPeriod} />
            )}
          </div>

          {/* Row 6: análisis avanzado (al final de la página) */}
          <div className="card-vault">
            <h2 className="section-label mb-4">Análisis avanzado</h2>
            <div className="grid grid-cols-3 gap-4">
              {ADVANCED_SECTIONS.map((section) => {
                const data = fullDashboard?.[section.key];
                return (
                  <div
                    key={section.key}
                    className="rounded-vault border border-vault-border bg-vault-s2 dark:bg-[#21262d] px-3.5 py-2.5 text-sm"
                  >
                    <p className="mb-1 font-medium">{section.label}</p>
                    {data ? (
                      <p className="text-xs text-vault-green">Disponible para este período</p>
                    ) : (
                      <p className="text-xs text-vault-muted2 dark:text-[#8b949e]">{section.cta}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
