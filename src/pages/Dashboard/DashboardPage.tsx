import { useState } from "react";
import { Link } from "react-router-dom";
import { useDashboard, useDashboardBreakdown, useDashboardEvolution, useFullDashboard } from "@/api/dashboard.api";
import { useExportXlsx } from "@/api/exports.api";
import { useExchangeRates } from "@/api/exchangeRates.api";
import { PatrimonioChart } from "@/components/charts/PatrimonioChart";
import { BreakdownChart } from "@/components/charts/BreakdownChart";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { extractErrorMessage } from "@/utils/apiError";
import { formatCurrency, formatPercent } from "@/utils/formatCurrency";
import { formatPeriod } from "@/utils/formatDate";

const ADVANCED_SECTIONS: { key: "cartera" | "proyeccion" | "compromisos"; label: string; cta: string }[] = [
  { key: "cartera", label: "Cartera de inversiones", cta: "Pedí este análisis la próxima vez que subas un extracto de broker" },
  { key: "proyeccion", label: "Proyección a 3 meses", cta: "Pedí este análisis la próxima vez que subas un extracto" },
  { key: "compromisos", label: "Cuotas pendientes", cta: "Pedí este análisis la próxima vez que subas un extracto" },
];

export function DashboardPage() {
  const { data: summary, isLoading: isLoadingSummary } = useDashboard();
  const { data: breakdown, isLoading: isLoadingBreakdown } = useDashboardBreakdown();
  const { data: evolution, isLoading: isLoadingEvolution } = useDashboardEvolution();
  const { data: fullDashboard } = useFullDashboard();
  const { data: exchangeRates } = useExchangeRates();
  const exportXlsx = useExportXlsx();
  const [exportError, setExportError] = useState<string | null>(null);
  const [currencyDisplay, setCurrencyDisplay] = useState<"USD" | "ARS">(() => {
    return (localStorage.getItem("vault_currency_display") as "USD" | "ARS") ?? "USD";
  });

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

  return (
    <div className="p-7">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="page-title">{formatPeriod(summary.period)}</h1>
          <p className="text-[14px] font-light text-vault-muted2 dark:text-[#8b949e]">Resumen de tu patrimonio y movimientos.</p>
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

      <div className="mb-5 grid grid-cols-4 gap-4">
        {currencyDisplay === "ARS" && !mepForPeriod ? (
          <div className="col-span-4 flex items-center gap-1.5 rounded-xl border border-vault-border bg-vault-s1 dark:bg-[#161b22] px-4 py-3 text-sm text-vault-muted2 dark:text-[#8b949e] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <span>Sin TC MEP para este período —</span>
            <Link to="/settings" className="text-vault-accent hover:underline">
              configuralo en Configuración
            </Link>
            <span>para ver valores en ARS.</span>
          </div>
        ) : (
          <SummaryCard
            label="Patrimonio total"
            value={
              currencyDisplay === "USD"
                ? formatCurrency(summary.total_usd, "USD")
                : formatCurrency(summary.total_usd * mepForPeriod!, "ARS")
            }
            hint={`${formatPercent(summary.variation_pct)} vs. mes anterior`}
            hintColor={summary.variation_pct >= 0 ? "green" : "red"}
          />
        )}
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="card-vault col-span-2">
          <h2 className="section-label mb-4">Evolución del patrimonio</h2>
          {isLoadingEvolution || !evolution ? (
            <div className="flex h-44 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
              Cargando...
            </div>
          ) : (
            <PatrimonioChart data={evolution} />
          )}
        </div>

        <div className="card-vault">
          <h2 className="section-label mb-4">Gastos por categoría</h2>
          {isLoadingBreakdown || !breakdown ? (
            <div className="flex h-32 items-center justify-center text-sm text-vault-muted2 dark:text-[#8b949e]">
              Cargando...
            </div>
          ) : breakdown.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-center text-sm text-vault-muted2 dark:text-[#8b949e]">
              Todavía no hay movimientos este mes.
            </div>
          ) : (
            <BreakdownChart data={breakdown} />
          )}
        </div>
      </div>

      <div className="mb-5 card-vault">
        <h2 className="section-label mb-4">Insights</h2>
        {summary.insights.length === 0 && (!fullDashboard || fullDashboard.insights.length === 0) ? (
          <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
            Todavía no hay suficientes movimientos para generar insights.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...summary.insights, ...(fullDashboard?.insights ?? [])].map((insight) => (
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
    </div>
  );
}
