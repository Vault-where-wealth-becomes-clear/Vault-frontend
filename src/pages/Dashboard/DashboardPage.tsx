import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useDashboard,
  useDashboardBreakdown,
  useDashboardEvolution,
  useFullDashboard,
  type BreakdownItem,
  type DashboardSummary,
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
import { formatPeriod, getCurrentPeriod } from "@/utils/formatDate";

const MOCK_SUMMARY: DashboardSummary = {
  period: getCurrentPeriod(),
  total_usd: 12450,
  variation_pct: 4.3,
  insights: [
    "Tu patrimonio creció 4.3% este mes.",
    "El mayor gasto fue en Restaurantes (18% del total).",
    "Tus inversiones representan el 35% del portafolio.",
  ],
};

const MOCK_EVOLUTION: EvolutionPoint[] = [
  { month: "2025-07", total_usd: 9800 },
  { month: "2025-08", total_usd: 10100 },
  { month: "2025-09", total_usd: 9950 },
  { month: "2025-10", total_usd: 10400 },
  { month: "2025-11", total_usd: 11200 },
  { month: "2025-12", total_usd: 11800 },
  { month: "2026-01", total_usd: 11500 },
  { month: "2026-02", total_usd: 11900 },
  { month: "2026-03", total_usd: 12100 },
  { month: "2026-04", total_usd: 11700 },
  { month: "2026-05", total_usd: 12000 },
  { month: "2026-06", total_usd: 12450 },
];

const MOCK_BREAKDOWN: BreakdownItem[] = [
  { category: "Supermercado", amount_ars: 180000, amount_usd: 150, pct_of_total: 30 },
  { category: "Restaurantes", amount_ars: 108000, amount_usd: 90, pct_of_total: 18 },
  { category: "Transporte", amount_ars: 72000, amount_usd: 60, pct_of_total: 12 },
  { category: "Servicios", amount_ars: 60000, amount_usd: 50, pct_of_total: 10 },
  { category: "Entretenimiento", amount_ars: 48000, amount_usd: 40, pct_of_total: 8 },
  { category: "Varios", amount_ars: 132000, amount_usd: 110, pct_of_total: 22 },
];

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
  const { data: summary, isLoading: isLoadingSummary } = useDashboard();
  const { data: breakdown, isLoading: isLoadingBreakdown } = useDashboardBreakdown();
  const { data: evolution, isLoading: isLoadingEvolution } = useDashboardEvolution();
  const { data: fullDashboard } = useFullDashboard();
  const { data: exchangeRates } = useExchangeRates();
  const { data: accounts } = useAccounts();
  const exportXlsx = useExportXlsx();
  const setRate = useSetExchangeRate();

  const [exportError, setExportError] = useState<string | null>(null);
  const [currencyDisplay, setCurrencyDisplay] = useState<"USD" | "ARS">(() => {
    return (localStorage.getItem("vault_currency_display") as "USD" | "ARS") ?? "USD";
  });
  const [demoMode, setDemoMode] = useState(false);
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
      // silently fail — leave liveMep null
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

  if (isLoadingSummary || !summary) {
    return (
      <div className="flex h-full items-center justify-center text-vault-muted2 dark:text-[#8b949e]">
        Cargando tablero...
      </div>
    );
  }

  const isEmpty = !accounts || accounts.length === 0;
  const insights = [...(summary.insights ?? []), ...(fullDashboard?.insights ?? [])];

  const activeSummary = demoMode ? MOCK_SUMMARY : summary;
  const activeEvolution = demoMode ? MOCK_EVOLUTION : evolution;
  const activeBreakdown = demoMode ? MOCK_BREAKDOWN : breakdown;

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
      {demoMode && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-vault-accent/30 bg-vault-accent/10 px-4 py-2.5 text-sm">
          <span className="text-vault-accent">Estás viendo datos de ejemplo</span>
          <button
            type="button"
            onClick={() => setDemoMode(false)}
            className="ml-auto text-xs text-vault-muted2 underline hover:text-vault-text dark:text-[#8b949e]"
          >
            Salir del ejemplo
          </button>
        </div>
      )}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="page-title">{formatPeriod(activeSummary.period)}</h1>
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

      {isEmpty && !demoMode ? (
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
            <button type="button" onClick={() => setDemoMode(true)} className="btn-ghost">
              Ver ejemplo
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-4 gap-4">
            {currencyDisplay === "ARS" && !mepForPeriod && !demoMode ? (
              <div className="col-span-4 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-vault-border bg-vault-s1 dark:bg-[#161b22] px-4 py-3 text-sm text-vault-muted2 dark:text-[#8b949e] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
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
            ) : (
              <SummaryCard
                label="Patrimonio total"
                value={
                  currencyDisplay === "USD" || demoMode
                    ? formatCurrency(activeSummary.total_usd, "USD")
                    : formatCurrency(activeSummary.total_usd * mepForPeriod!, "ARS")
                }
                hint={`${formatPercent(activeSummary.variation_pct)} vs. mes anterior`}
                hintColor={activeSummary.variation_pct >= 0 ? "green" : "red"}
              />
            )}
          </div>

          <div className="mb-5 grid grid-cols-3 gap-4">
            <div className="card-vault col-span-2">
              <h2 className="section-label mb-4">Evolución del patrimonio</h2>
              {!demoMode && (isLoadingEvolution || !activeEvolution) ? (
                <div className="flex h-44 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                  Cargando...
                </div>
              ) : (
                <PatrimonioChart data={activeEvolution!} />
              )}
            </div>

            <div className="card-vault">
              <h2 className="section-label mb-4">Gastos por categoría</h2>
              {!demoMode && (isLoadingBreakdown || !activeBreakdown) ? (
                <div className="flex h-32 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                  Cargando...
                </div>
              ) : !activeBreakdown || activeBreakdown.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-center text-sm text-vault-muted2 dark:text-[#8b949e]">
                  Todavía no hay movimientos este mes.
                </div>
              ) : (
                <BreakdownChart data={activeBreakdown} />
              )}
            </div>
          </div>

          <div className="mb-5 card-vault">
            <h2 className="section-label mb-4">Insights</h2>
            {(demoMode ? MOCK_SUMMARY.insights : insights).length === 0 ? (
              <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
                Todavía no hay suficientes movimientos para generar insights.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(demoMode ? MOCK_SUMMARY.insights : insights).map((insight) => (
                  <li
                    key={insight}
                    className="flex items-start gap-2.5 rounded-vault border border-vault-border bg-vault-s2 dark:bg-[#21262d] px-3.5 py-2.5 text-sm text-vault-muted2 dark:text-[#8b949e]"
                  >
                    <span className="mt-0.5 text-vault-accent">&#8226;</span>
                    {insight}
                  </li>
                ))}
              </ul>
            )}
          </div>

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
