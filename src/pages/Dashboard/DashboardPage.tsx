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
import { useAccounts, getAccountDisplayName } from "@/api/accounts.api";
import { useUploads } from "@/api/uploads.api";
import { MonthlySeriesChart } from "@/components/charts/MonthlySeriesChart";
import { AccountBalanceChart, type AccountBalancePoint, type AccountBalanceLine } from "@/components/charts/AccountBalanceChart";
import { BreakdownChart } from "@/components/charts/BreakdownChart";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { extractErrorMessage } from "@/utils/apiError";
import { formatCurrency, formatPercent } from "@/utils/formatCurrency";
import { formatPeriod } from "@/utils/formatDate";

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

  const latestDonePeriod = useMemo(() => {
    const done = uploads?.filter((u) => u.status === "done") ?? [];
    return done.map((u) => u.period_month.slice(0, 7)).sort().pop();
  }, [uploads]);

  const donePeriodSet = useMemo(
    () => new Set((uploads?.filter((u) => u.status === "done") ?? []).map((u) => u.period_month.slice(0, 7))),
    [uploads]
  );

  const period = latestDonePeriod;

  const { data: summary, isLoading: isLoadingSummary } = useDashboard(period);
  const { data: breakdown, isLoading: isLoadingBreakdown } = useDashboardBreakdown(period);
  const { data: monthlySeries, isLoading: isLoadingMonthlySeries } = useDashboardMonthlySeries(
    summary?.period
  );
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

  const toggleCurrency = (currency: "USD" | "ARS") => {
    setCurrencyDisplay(currency);
    localStorage.setItem("vault_currency_display", currency);
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
      const res = await fetch("https://dolarapi.com/v1/dolares/mep");
      if (!res.ok) throw new Error("HTTP");
      const json = await res.json();
      const venta = Number(json.venta);
      if (!venta || isNaN(venta)) throw new Error("invalid");
      setLiveMep(venta);
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

  // Saldo por cuenta a lo largo de los meses — una línea por cuenta (tarjetas
  // de crédito excluidas: current_balance nunca se actualiza para ellas).
  // El saldo de cierre de cada mes es el saldo de apertura del upload
  // siguiente (SF(N) = SI(N+1), invariante ya reconciliado en el worker);
  // para el mes más reciente de cada cuenta se usa el current_balance vivo.
  const accountBalanceSeries = useMemo(() => {
    if (!accounts || !uploads) return { points: [] as AccountBalancePoint[], lines: [] as AccountBalanceLine[] };

    const nonCcAccounts = accounts.filter(
      (a) => a.is_active && a.account_type !== "credit_card_ars" && a.account_type !== "credit_card_usd"
    );
    const doneUploads = uploads.filter((u) => u.status === "done");

    const monthSet = new Set<string>();
    const perAccountBalances = new Map<string, Map<string, number>>();

    for (const account of nonCcAccounts) {
      const accountUploads = doneUploads
        .filter((u) => u.account_id === account.id)
        .sort((a, b) => a.period_month.localeCompare(b.period_month));
      if (accountUploads.length === 0) continue;

      const isUsd = account.currency === "USD";
      const balances = new Map<string, number>();
      accountUploads.forEach((u, i) => {
        const month = u.period_month.slice(0, 7);
        const next = accountUploads[i + 1];
        const closing = next
          ? Number(isUsd ? next.opening_balance_usd : next.opening_balance_ars)
          : Number(account.current_balance);
        balances.set(month, closing);
        monthSet.add(month);
      });
      perAccountBalances.set(account.id, balances);
    }

    const months = Array.from(monthSet).sort().slice(-6);
    const points: AccountBalancePoint[] = months.map((month) => {
      const point: AccountBalancePoint = { month };
      for (const [accountId, balances] of perAccountBalances) {
        point[accountId] = balances.has(month) ? balances.get(month)! : null;
      }
      return point;
    });

    const lines: AccountBalanceLine[] = nonCcAccounts
      .filter((a) => perAccountBalances.has(a.id))
      .map((a) => ({ accountId: a.id, label: getAccountDisplayName(a), currency: a.currency }));

    return { points, lines };
  }, [accounts, uploads]);

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
  const filteredBreakdown = breakdown?.filter((item) => item.amount_ars !== 0 && item.pct_of_total !== 0) ?? [];

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
            {summary.period ? `Datos de ${formatPeriod(summary.period)}` : "Resumen de tu patrimonio y movimientos."}
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
            <div style={{ display: "flex", justifyContent: "center", gap: 0, alignItems: "flex-start" }}>
              {steps.map((step, i) => (
                <>
                  <div
                    key={step.n}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "0 12px" }}
                  >
                    <div
                      className={step.active ? "" : "border border-vault-border dark:border-[#30363d]"}
                      style={{ width: 40, height: 40, borderRadius: "50%", background: step.active ? "#1e3a8a" : "transparent", color: step.active ? "white" : undefined, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 500, flexShrink: 0 }}
                    >
                      <span className={step.active ? "text-white" : "text-vault-muted2 dark:text-[#8b949e]"}>{step.n}</span>
                    </div>
                    <p className="text-center text-sm font-medium text-vault-text dark:text-[#e6edf3]">{step.title}</p>
                    <p className="text-center text-xs text-vault-muted2 dark:text-[#8b949e]">{step.desc}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <div key={`sep-${i}`} className="bg-vault-border dark:bg-[#30363d]" style={{ width: 48, height: 1, marginTop: 20, flexShrink: 0 }} />
                  )}
                </>
              ))}
            </div>
          </div>
          <div style={{ padding: "0 32px 24px", display: "flex", gap: 10 }}>
            <Link to="/accounts" className="btn-primary">Agregar mi primera cuenta</Link>
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
                  <span className="font-medium text-vault-text dark:text-[#e6edf3]">TC MEP: ${liveMep.toFixed(2)}</span>
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
              <Link to="/settings" className="ml-auto text-xs text-vault-accent hover:underline">Configurar manualmente</Link>
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

          {/* Row 2: gráfico compuesto — resultado, patrimonio, cartera y gasto mensual */}
          <div className="mb-5 card-vault">
            <h2 className="section-label mb-4">Evolución mensual</h2>
            {isLoadingMonthlySeries || !monthlySeries ? (
              <div className="flex h-44 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                Cargando...
              </div>
            ) : filteredMonthlySeries.length === 0 ? (
              <div className="flex h-44 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                Sin datos históricos aún.
              </div>
            ) : (
              <MonthlySeriesChart data={filteredMonthlySeries} />
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
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredMonthlySeries]
                      .reverse()
                      .map((point) => (
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

          {/* Row 7: saldo de cuentas — una línea por cuenta a lo largo de los meses */}
          <div className="mt-5 card-vault">
            <h2 className="section-label mb-4">Saldo de cuentas</h2>
            {accountBalanceSeries.points.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                Sin extractos procesados aún para mostrar saldos históricos.
              </div>
            ) : (
              <AccountBalanceChart
                points={accountBalanceSeries.points}
                lines={accountBalanceSeries.lines}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
