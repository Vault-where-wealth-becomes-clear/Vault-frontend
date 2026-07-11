import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccounts, getAccountDisplayName } from "@/api/accounts.api";
import { useAccountCartera, type InstrumentoTipo } from "@/api/cartera.api";
import { useExchangeRates } from "@/api/exchangeRates.api";
import { CarteraEvolutionChart } from "@/components/charts/CarteraEvolutionChart";
import { CarteraComposicion } from "@/components/cartera/CarteraComposicion";
import { NIVEL_LABELS, TIPO_LABELS } from "@/components/cartera/carteraLabels";
import { SummaryCard } from "@/components/ui/SummaryCard";
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
  const [displayCurrency, setDisplayCurrency] = useState<"ARS" | "USD">("ARS");

  // Amplia (para el gráfico de evolución) — siempre ancla al mes más reciente real.
  const { data: chart, isLoading: isLoadingChart } = useAccountCartera(selectedAccountId, 24);
  const effectiveMonth = selectedMonth ?? chart?.month;
  // Puntual (para posiciones/composición/alertas del mes elegido en el selector).
  const { data: detail, isLoading: isLoadingDetail } = useAccountCartera(
    selectedAccountId,
    1,
    effectiveMonth
  );

  const { data: exchangeRates } = useExchangeRates();
  const mepRateForMonth = useMemo(() => {
    if (!effectiveMonth) return null;
    const rate = exchangeRates?.find((r) => r.period_month.startsWith(effectiveMonth));
    return rate?.mep_rate ?? null;
  }, [exchangeRates, effectiveMonth]);

  const totalArsSelected = useMemo(
    () => detail?.posiciones.reduce((sum, p) => sum + p.valor_base_ars, 0) ?? null,
    [detail]
  );
  const totalDisplaySelected =
    totalArsSelected == null
      ? null
      : displayCurrency === "ARS"
        ? totalArsSelected
        : mepRateForMonth
          ? totalArsSelected / mepRateForMonth
          : null;

  // Columnas del comparativo mes a mes: unión de todos los tipos que aparecieron en
  // algún mes, ordenadas por peso en el mes más reciente (los más relevantes primero).
  const tipoColumns = useMemo(() => {
    const evolucion = chart?.evolucion ?? [];
    const allTipos = new Set<string>();
    evolucion.forEach((p) => Object.keys(p.composicion_por_tipo).forEach((t) => allTipos.add(t)));
    const latest = evolucion.at(-1)?.composicion_por_tipo ?? {};
    return Array.from(allTipos).sort((a, b) => (latest[b] ?? 0) - (latest[a] ?? 0));
  }, [chart]);

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
        <h1 className="page-title mb-2">Cuenta comitente</h1>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          Todavía no registraste ninguna cuenta comitente. Creá una en "Mis cuentas" para
          empezar a ver tu cartera acá.
        </p>
      </div>
    );
  }

  const monthOptions = [...(chart?.evolucion ?? [])].reverse();
  const selectedAccount = brokerAccounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Cuenta comitente</h1>
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

      {selectedAccount && (
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-vault-muted2 dark:text-[#8b949e]">
            Entidad financiera:{" "}
            <span className="font-medium text-vault-text dark:text-[#e6edf3]">
              {selectedAccount.institution || "—"}
            </span>
          </span>
          {selectedAccount.name && selectedAccount.name !== selectedAccount.institution && (
            <span className="text-vault-muted2 dark:text-[#8b949e]">
              Referencia:{" "}
              <span className="font-medium text-vault-text dark:text-[#e6edf3]">
                {selectedAccount.name}
              </span>
            </span>
          )}
        </div>
      )}

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
          <div className="mb-5">
            <SummaryCard
              label="Total de cartera"
              value={
                totalDisplaySelected != null
                  ? formatCurrency(totalDisplaySelected, displayCurrency)
                  : "—"
              }
              hint={effectiveMonth ? formatPeriod(effectiveMonth) : undefined}
            />
          </div>

          <div className="mb-5 card-vault">
            <h2 className="section-label mb-3">Evolución</h2>
            <CarteraEvolutionChart data={chart.evolucion} />
          </div>

          {chart.evolucion.length > 1 && tipoColumns.length > 0 && (
            <div className="mb-5 card-vault">
              <h2 className="section-label mb-3">Composición mes a mes</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-vault-border/50 text-left text-vault-muted2 dark:border-[#30363d]/50 dark:text-[#8b949e]">
                      <th className="py-1 pr-3 font-normal">Mes</th>
                      {tipoColumns.map((tipo) => (
                        <th key={tipo} className="py-1 pr-3 font-normal">
                          {TIPO_LABELS[tipo as InstrumentoTipo] ?? tipo}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chart.evolucion.map((point) => (
                      <tr
                        key={point.month}
                        className="border-b border-vault-border/30 last:border-0 dark:border-[#30363d]/30"
                      >
                        <td className="py-1.5 pr-3 capitalize text-vault-text dark:text-[#e6edf3]">
                          {formatPeriod(point.month)}
                        </td>
                        {tipoColumns.map((tipo) => {
                          const pct = point.composicion_por_tipo[tipo];
                          return (
                            <td key={tipo} className="py-1.5 pr-3 tabular-nums">
                              {pct != null ? `${(pct * 100).toFixed(0)}%` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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

              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="section-label mb-0">Composición</h2>
                <div className="flex overflow-hidden rounded-vault border border-vault-border dark:border-[#30363d]">
                  {(["ARS", "USD"] as const).map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => setDisplayCurrency(cur)}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                        displayCurrency === cur
                          ? "bg-vault-accent/10 text-vault-accent"
                          : "text-vault-muted2 hover:text-vault-text dark:text-[#8b949e]"
                      }`}
                    >
                      {cur}
                    </button>
                  ))}
                </div>
              </div>
              {displayCurrency === "USD" && !mepRateForMonth && (
                <p className="mb-2 text-xs text-vault-yellow">
                  Sin TC MEP declarado para este período — los montos en USD no se pueden calcular.
                </p>
              )}
              <CarteraComposicion
                posiciones={detail.posiciones}
                nivelDetectado={detail.nivel_detectado}
                displayCurrency={displayCurrency}
                mepRate={mepRateForMonth}
              />

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
