import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccounts, getAccountDisplayName } from "@/api/accounts.api";
import { useAccountCartera } from "@/api/cartera.api";
import { CarteraEvolutionChart } from "@/components/charts/CarteraEvolutionChart";
import { CarteraComposicion } from "@/components/cartera/CarteraComposicion";
import { NIVEL_LABELS } from "@/components/cartera/carteraLabels";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatPeriod } from "@/utils/formatDate";

export function CarteraPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: allAccounts, isLoading: isLoadingAccounts } = useAccounts();
  const brokerAccounts = useMemo(
    () => (allAccounts ?? []).filter((a) => a.account_type === "broker"),
    [allAccounts]
  );

  const accountParam = searchParams.get("account");
  const selectedAccountId =
    accountParam && brokerAccounts.some((a) => a.id === accountParam)
      ? accountParam
      : brokerAccounts[0]?.id;

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Amplia (para el gráfico de evolución) — siempre ancla al mes más reciente real.
  const { data: chart, isLoading: isLoadingChart } = useAccountCartera(selectedAccountId, 24);
  const effectiveMonth = selectedMonth ?? chart?.month;
  // Puntual (para posiciones/composición/alertas del mes elegido en el selector).
  const { data: detail, isLoading: isLoadingDetail } = useAccountCartera(
    selectedAccountId,
    1,
    effectiveMonth
  );

  useEffect(() => {
    setSelectedMonth(null);
  }, [selectedAccountId]);

  const handleAccountChange = (id: string) => {
    setSearchParams({ account: id }, { replace: true });
  };

  if (isLoadingAccounts) {
    return <div className="p-7 text-sm text-vault-muted2 dark:text-[#8b949e]">Cargando...</div>;
  }

  if (brokerAccounts.length === 0) {
    return (
      <div className="p-7">
        <h1 className="page-title mb-2">Cartera</h1>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          Todavía no registraste ninguna cuenta comitente. Creá una en "Mis cuentas" para
          empezar a ver tu cartera acá.
        </p>
      </div>
    );
  }

  const monthOptions = [...(chart?.evolucion ?? [])].reverse();

  return (
    <div className="p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Cartera</h1>
          <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
            Evolución y composición de tu cuenta comitente en el tiempo.
          </p>
        </div>
        {brokerAccounts.length > 1 && (
          <select
            value={selectedAccountId}
            onChange={(e) => handleAccountChange(e.target.value)}
            className="input-vault w-auto"
          >
            {brokerAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {getAccountDisplayName(a)}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoadingChart ? (
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">Cargando...</p>
      ) : !chart ? (
        <div className="card-vault">
          <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
            Todavía no subiste ningún archivo para esta cuenta comitente. Subí un snapshot
            de tenencias del broker en "Mis cuentas" para empezar a ver tu cartera acá.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 card-vault">
            <h2 className="section-label mb-3">Evolución</h2>
            <CarteraEvolutionChart data={chart.evolucion} />
          </div>

          <div className="mb-5 flex items-center gap-2">
            <span className="text-xs text-vault-muted2 dark:text-[#8b949e]">Mes:</span>
            <select
              value={effectiveMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-vault w-auto"
            >
              {monthOptions.map((point) => (
                <option key={point.month} value={point.month}>
                  {formatPeriod(point.month)}
                </option>
              ))}
            </select>
          </div>

          {isLoadingDetail ? (
            <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">Cargando...</p>
          ) : detail ? (
            <div className="card-vault">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex-shrink-0 rounded-full border border-vault-accent/40 bg-vault-accent/10 px-2 py-0.5 text-[10px] font-semibold text-vault-accent">
                  Nivel {detail.nivel_detectado}
                </span>
                <span className="text-xs text-vault-muted2 dark:text-[#8b949e]">
                  {NIVEL_LABELS[detail.nivel_detectado]}
                </span>
              </div>

              {(detail.alertas.length > 0 || detail.insights.length > 0) && (
                <ul className="mb-3 flex flex-col gap-1">
                  {detail.alertas.map((alerta, i) => (
                    <li key={`alert-${i}`} className="text-xs text-vault-text dark:text-[#e6edf3]">
                      {alerta}
                    </li>
                  ))}
                  {detail.insights.map((insight, i) => (
                    <li key={`insight-${i}`} className="text-xs text-vault-muted2 dark:text-[#8b949e]">
                      {insight}
                    </li>
                  ))}
                </ul>
              )}

              <h2 className="section-label mb-2">Composición</h2>
              <CarteraComposicion posiciones={detail.posiciones} nivelDetectado={detail.nivel_detectado} />

              {detail.rendimientos_netos_ars != null && (
                <p className="mt-3 text-xs text-vault-muted2 dark:text-[#8b949e]">
                  Rendimientos netos del mes:{" "}
                  <span className="font-medium text-vault-text dark:text-[#e6edf3]">
                    {formatCurrency(detail.rendimientos_netos_ars, "ARS")}
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="card-vault">
              <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
                Sin snapshot para este mes.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
