import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useDashboard,
  useDashboardBreakdown,
  useDashboardEvolution,
  useFullDashboard,
  type EvolutionPoint,
} from "@/api/dashboard.api";
import { useExportXlsx } from "@/api/exports.api";
import { useExchangeRates, useSetExchangeRate } from "@/api/exchangeRates.api";
import { useAccounts } from "@/api/accounts.api";
import { PatrimonioChart } from "@/components/charts/PatrimonioChart";
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

function addMonths(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function DashboardPage() {
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const [selectedChartPoint, setSelectedChartPoint] = useState<EvolutionPoint | null>(null);

  const { data: summary, isLoading: isLoadingSummary } = useDashboard(period);
  const { data: breakdown, isLoading: isLoadingBreakdown } = useDashboardBreakdown(period);
  const { data: evolution, isLoading: isLoadingEvolution } = useDashboardEvolution(
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

  const handleChartMonthClick = (point: EvolutionPoint) => {
    setSelectedChartPoint((prev) => (prev?.month === point.month ? null : point));
  };

  const currentPeriodRate = exchangeRates?.find((r) =>
    r.period_month.startsWith(summary?.period ?? "__")
  );
  const mepForPeriod = currentPeriodRate?.mep_rate;

  if (isLoadingSummary || !summary) {
    return (
      <div className="flex h-full items-center justify-center text-vault-muted2 dark:text-[#8b949e]">
        Cargando tablero...
      </div>
    );
  }

  const isEmpty = !accounts || accounts.length === 0;
  const insights = [...(summary.insights ?? []), ...(fullDashboard?.insights ?? [])];

  // Patrimony display: chart selection overrides summary
  const displayPatrimonio = selectedChartPoint?.total_usd ?? summary.total_usd;
  const patrimonioLabel = selectedChartPoint
    ? `Patrimonio al ${formatPeriod(selectedChartPoint.month)}`
    : "Patrimonio total";
  const patrimonioHint = selectedChartPoint
    ? "Hacé click en el gráfico para cambiar"
    : `${formatPercent(summary.variation_pct)} vs. mes anterior`;

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

  const flujo = summary.flujo_del_mes;

  return (
    <div className="p-7">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setPeriod(addMonths(summary.period, -1)); setSelectedChartPoint(null); }}
              className="flex h-7 w-7 items-center justify-center rounded-vault border border-vault-border text-vault-muted2 hover:border-vault-accent hover:text-vault-accent dark:text-[#8b949e]"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <h1 className="page-title">{formatPeriod(summary.period)}</h1>
            <button
              type="button"
              onClick={() => { setPeriod(addMonths(summary.period, 1)); setSelectedChartPoint(null); }}
              disabled={summary.period >= addMonths(new Date().toISOString().slice(0, 7), 0)}
              className="flex h-7 w-7 items-center justify-center rounded-vault border border-vault-border text-vault-muted2 hover:border-vault-accent hover:text-vault-accent disabled:opacity-30 dark:text-[#8b949e]"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>
          <p className="text-[14px] font-light text-vault-muted2 dark:text-[#8b949e]">
            Resumen de tu patrimonio y movimientos.
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
              label={patrimonioLabel}
              value={
                currencyDisplay === "USD"
                  ? formatCurrency(displayPatrimonio, "USD")
                  : mepForPeriod
                  ? formatCurrency(displayPatrimonio * mepForPeriod, "ARS")
                  : formatCurrency(displayPatrimonio, "USD")
              }
              hint={patrimonioHint}
              hintColor={
                selectedChartPoint
                  ? "muted"
                  : summary.variation_pct >= 0
                  ? "green"
                  : "red"
              }
            />
          </div>

          {/* Row 2: chart (2/3) + flujo del mes (1/3) */}
          <div className="mb-5 grid grid-cols-3 gap-4">
            <div className="card-vault col-span-2">
              <h2 className="section-label mb-4">Evolución patrimonial</h2>
              {isLoadingEvolution || !evolution ? (
                <div className="flex h-44 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                  Cargando...
                </div>
              ) : evolution.length === 0 ? (
                <div className="flex h-44 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                  Sin datos históricos aún.
                </div>
              ) : (
                <PatrimonioChart
                  data={evolution}
                  selectedMonth={selectedChartPoint?.month}
                  onMonthClick={handleChartMonthClick}
                />
              )}
              {selectedChartPoint && (
                <p className="mt-1 text-center text-[11px] text-vault-muted2 dark:text-[#8b949e]">
                  Hacé click en el mismo punto para deseleccionar
                </p>
              )}
            </div>

            {/* Flujo del mes */}
            <div className="card-vault flex flex-col gap-3">
              <h2 className="section-label">Flujo del mes</h2>
              {flujo ? (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between rounded-vault bg-vault-green/5 px-3 py-2.5">
                      <span className="text-xs text-vault-muted2 dark:text-[#8b949e]">Ingresos</span>
                      <span className="text-sm font-semibold tabular-nums text-vault-green">
                        {formatCurrency(flujo.ingresos_ars, "ARS")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-vault bg-vault-red/5 px-3 py-2.5">
                      <span className="text-xs text-vault-muted2 dark:text-[#8b949e]">Egresos</span>
                      <span className="text-sm font-semibold tabular-nums text-vault-red">
                        {formatCurrency(Math.abs(flujo.egresos_ars), "ARS")}
                      </span>
                    </div>
                  </div>
                  <div className={`mt-auto rounded-vault border px-3 py-2.5 ${
                    flujo.resultado_ars >= 0
                      ? "border-vault-green/30 bg-vault-green/5"
                      : "border-vault-red/30 bg-vault-red/5"
                  }`}>
                    <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-vault-muted2 dark:text-[#8b949e]">
                      Resultado del período
                    </p>
                    <p className={`text-xl font-semibold tabular-nums ${
                      flujo.resultado_ars >= 0 ? "text-vault-green" : "text-vault-red"
                    }`}>
                      {flujo.resultado_ars >= 0 ? "+" : ""}
                      {formatCurrency(flujo.resultado_ars, "ARS")}
                    </p>
                    {flujo.ingresos_usd > 0 || flujo.egresos_usd < 0 ? (
                      <p className="mt-0.5 text-[11px] text-vault-muted2 dark:text-[#8b949e]">
                        USD {flujo.resultado_ars >= 0 ? "+" : ""}
                        {(flujo.ingresos_usd + flujo.egresos_usd).toFixed(2)}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                  Sin movimientos este mes.
                </div>
              )}
            </div>
          </div>

          {/* Row 3: gastos por categoría (full width, solo con movimiento real) */}
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

          {/* Row 4: insights */}
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

          {/* Row 5: análisis avanzado */}
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
