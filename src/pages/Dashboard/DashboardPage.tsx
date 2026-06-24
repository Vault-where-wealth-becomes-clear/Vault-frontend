import { useState } from "react";
import { useDashboard, useDashboardBreakdown, useDashboardEvolution, useFullDashboard } from "@/api/dashboard.api";
import { useExportXlsx } from "@/api/exports.api";
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
  const exportXlsx = useExportXlsx();
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setExportError(null);
    try {
      const url = await exportXlsx.mutateAsync();
      window.open(url, "_blank");
    } catch (err) {
      setExportError(extractErrorMessage(err));
    }
  };

  if (isLoadingSummary || !summary) {
    return (
      <div className="flex h-full items-center justify-center text-vault-muted2">
        Cargando tablero...
      </div>
    );
  }

  return (
    <div className="p-7">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-syne text-2xl font-bold capitalize">{formatPeriod(summary.period)}</h1>
          <p className="text-sm text-vault-muted2">Resumen de tu patrimonio y movimientos.</p>
        </div>
        <div className="text-right">
          <button onClick={handleExport} disabled={exportXlsx.isPending} className="btn-ghost">
            {exportXlsx.isPending ? "Generando..." : "Exportar XLSX"}
          </button>
          {exportError && <p className="mt-1.5 text-xs text-vault-red">{exportError}</p>}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-4">
        <SummaryCard
          label="Patrimonio total"
          value={formatCurrency(summary.total_usd, "USD")}
          hint={`${formatPercent(summary.variation_pct)} vs. mes anterior`}
          hintColor={summary.variation_pct >= 0 ? "green" : "red"}
        />
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="card-vault col-span-2">
          <h2 className="mb-3 font-syne text-sm font-bold">Evolución del patrimonio</h2>
          {isLoadingEvolution || !evolution ? (
            <div className="flex h-44 items-center justify-center text-sm text-vault-muted2">
              Cargando...
            </div>
          ) : (
            <PatrimonioChart data={evolution} />
          )}
        </div>

        <div className="card-vault">
          <h2 className="mb-3 font-syne text-sm font-bold">Gastos por categoría</h2>
          {isLoadingBreakdown || !breakdown ? (
            <div className="flex h-32 items-center justify-center text-sm text-vault-muted2">
              Cargando...
            </div>
          ) : breakdown.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-center text-sm text-vault-muted2">
              Todavía no hay movimientos este mes.
            </div>
          ) : (
            <BreakdownChart data={breakdown} />
          )}
        </div>
      </div>

      <div className="mb-5 card-vault">
        <h2 className="mb-3 font-syne text-sm font-bold">Insights</h2>
        {summary.insights.length === 0 && (!fullDashboard || fullDashboard.insights.length === 0) ? (
          <p className="text-sm text-vault-muted2">
            Todavía no hay suficientes movimientos para generar insights.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...summary.insights, ...(fullDashboard?.insights ?? [])].map((insight) => (
              <li
                key={insight}
                className="flex items-start gap-2.5 rounded-vault border border-vault-border bg-vault-s2 px-3.5 py-2.5 text-sm text-vault-muted2"
              >
                <span className="mt-0.5 text-vault-accent">&#8226;</span>
                {insight}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card-vault">
        <h2 className="mb-3 font-syne text-sm font-bold">Análisis avanzado</h2>
        <div className="grid grid-cols-3 gap-4">
          {ADVANCED_SECTIONS.map((section) => {
            const data = fullDashboard?.[section.key];
            return (
              <div
                key={section.key}
                className="rounded-vault border border-vault-border bg-vault-s2 px-3.5 py-2.5 text-sm"
              >
                <p className="mb-1 font-medium">{section.label}</p>
                {data ? (
                  <p className="text-xs text-vault-green">Disponible para este período</p>
                ) : (
                  <p className="text-xs text-vault-muted2">{section.cta}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
