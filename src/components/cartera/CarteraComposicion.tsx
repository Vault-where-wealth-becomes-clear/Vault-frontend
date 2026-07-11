import { useMemo, useState } from "react";
import type { CarteraPosicion, InstrumentoTipo } from "@/api/cartera.api";
import { formatCurrency, formatPercent } from "@/utils/formatCurrency";
import { TIPO_LABELS } from "./carteraLabels";

type DisplayCurrency = "ARS" | "USD";

interface TipoGroup {
  tipo: InstrumentoTipo;
  valorArs: number;
  posiciones: CarteraPosicion[];
}

/**
 * Separa ticker y detalle de una posición. Prioriza el campo `ticker` (ya viene así
 * desde el LLM en uploads nuevos). Para snapshots subidos antes de que ese campo
 * existiera, cae a dos formatos vistos en datos reales:
 * - "CEDEAR APPLE INC (AAPL)" -> detalle "CEDEAR APPLE INC", ticker "AAPL"
 * - "BPOD7" (instrumento = solo el ticker, sin descripción) -> detalle y ticker iguales
 * Efectivo y FCI legítimamente no tienen ticker — no se fuerza ninguno.
 */
function parseInstrumento(pos: CarteraPosicion): { detalle: string; ticker: string | null } {
  if (pos.ticker) return { detalle: pos.instrumento, ticker: pos.ticker };

  const withParens = pos.instrumento.match(/^(.*)\s\(([A-Za-z0-9.\-/]+)\)\s*$/);
  if (withParens) return { detalle: withParens[1].trim(), ticker: withParens[2] };

  const looksLikeBareTicker = /^[A-Z0-9]{2,8}$/.test(pos.instrumento);
  if (looksLikeBareTicker && pos.tipo !== "efectivo_comitente") {
    return { detalle: pos.instrumento, ticker: pos.instrumento };
  }

  return { detalle: pos.instrumento, ticker: null };
}

/** Convierte un valor en ARS a la moneda de visualización elegida. null si se pidió
 * USD pero no hay TC MEP para el período — nunca se inventa un valor. */
function toDisplay(valorArs: number, displayCurrency: DisplayCurrency, mepRate: number | null) {
  if (displayCurrency === "ARS") return valorArs;
  return mepRate ? valorArs / mepRate : null;
}

function formatDisplay(value: number | null, displayCurrency: DisplayCurrency): string {
  return value == null ? "—" : formatCurrency(value, displayCurrency);
}

/**
 * Composición de cartera agrupada por tipo de instrumento, con drill-down a tabla de
 * posiciones individuales de cada grupo (ticker, detalle, cantidad, precio y total en
 * la moneda de visualización elegida, % cartera y % dentro del tipo).
 */
export function CarteraComposicion({
  posiciones,
  nivelDetectado,
  displayCurrency = "ARS",
  mepRate = null,
}: {
  posiciones: CarteraPosicion[];
  nivelDetectado: 1 | 2 | 3;
  displayCurrency?: DisplayCurrency;
  mepRate?: number | null;
}) {
  const [expandedTipo, setExpandedTipo] = useState<string | null>(null);

  const totalArs = useMemo(
    () => posiciones.reduce((sum, p) => sum + p.valor_base_ars, 0),
    [posiciones]
  );

  const groups = useMemo<TipoGroup[]>(() => {
    const map = new Map<string, CarteraPosicion[]>();
    posiciones.forEach((p) => {
      const list = map.get(p.tipo);
      if (list) list.push(p);
      else map.set(p.tipo, [p]);
    });
    return Array.from(map.entries())
      .map(([tipo, list]) => ({
        tipo: tipo as InstrumentoTipo,
        valorArs: list.reduce((sum, p) => sum + p.valor_base_ars, 0),
        posiciones: [...list].sort((a, b) => b.valor_base_ars - a.valor_base_ars),
      }))
      .sort((a, b) => b.valorArs - a.valorArs);
  }, [posiciones]);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {groups.map((group) => {
        const pct = totalArs ? group.valorArs / totalArs : 0;
        const isOpen = expandedTipo === group.tipo;
        const groupDisplayValue = toDisplay(group.valorArs, displayCurrency, mepRate);
        return (
          <div key={group.tipo}>
            <button
              type="button"
              onClick={() => setExpandedTipo(isOpen ? null : group.tipo)}
              className="flex w-full items-center gap-2 py-1 text-left text-xs"
            >
              <span className="w-24 flex-shrink-0 truncate text-vault-muted2 dark:text-[#99a3b0]">
                {TIPO_LABELS[group.tipo] ?? group.tipo}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-vault-s2 dark:bg-[#505862]">
                <div
                  className="h-full rounded-full bg-vault-accent"
                  style={{ width: `${Math.min(pct * 100, 100)}%` }}
                />
              </div>
              <span className="w-24 flex-shrink-0 text-right tabular-nums text-vault-text dark:text-[#e6eaf0]">
                {formatDisplay(groupDisplayValue, displayCurrency)}
              </span>
              <span className="w-10 flex-shrink-0 text-right tabular-nums text-vault-muted2 dark:text-[#99a3b0]">
                {(pct * 100).toFixed(0)}%
              </span>
              <span
                className="flex-shrink-0 text-vault-muted2 transition-transform duration-200 dark:text-[#99a3b0]"
                style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
              >
                ›
              </span>
            </button>

            {isOpen && (
              <div className="mb-2 ml-2 overflow-x-auto border-l-2 border-vault-border pl-3 dark:border-[#68727f]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-vault-border/50 text-left text-vault-muted2 dark:border-[#68727f]/50 dark:text-[#99a3b0]">
                      <th className="py-1 pr-2 font-normal">Ticker</th>
                      <th className="py-1 pr-2 font-normal">Detalle</th>
                      <th className="py-1 pr-2 font-normal">Cantidad</th>
                      <th className="py-1 pr-2 font-normal">Precio ({displayCurrency})</th>
                      <th className="py-1 pr-2 font-normal">Total ({displayCurrency})</th>
                      <th className="py-1 pr-2 font-normal">% cartera</th>
                      <th className="py-1 pr-2 font-normal">% {TIPO_LABELS[group.tipo] ?? group.tipo}</th>
                      {nivelDetectado === 3 && <th className="py-1 pr-2 font-normal">Result.</th>}
                      {nivelDetectado === 3 && <th className="py-1 font-normal">Rend. %</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {group.posiciones.map((pos, i) => {
                      const { detalle, ticker } = parseInstrumento(pos);
                      const pctInstrumento = group.valorArs ? pos.valor_base_ars / group.valorArs : 0;
                      const totalDisplay = toDisplay(pos.valor_base_ars, displayCurrency, mepRate);
                      const precioDisplay =
                        totalDisplay != null && pos.cantidad ? totalDisplay / pos.cantidad : null;
                      return (
                        <tr
                          key={`${pos.instrumento}-${i}`}
                          className="border-b border-vault-border/30 last:border-0 dark:border-[#68727f]/30"
                        >
                          <td className="py-1.5 pr-2 text-vault-text dark:text-[#e6eaf0]">
                            {ticker ?? "—"}
                          </td>
                          <td className="py-1.5 pr-2 text-vault-muted2 dark:text-[#99a3b0]">
                            {detalle}
                          </td>
                          <td className="py-1.5 pr-2 tabular-nums">{pos.cantidad}</td>
                          <td className="py-1.5 pr-2 tabular-nums">
                            {formatDisplay(precioDisplay, displayCurrency)}
                          </td>
                          <td className="py-1.5 pr-2 tabular-nums text-vault-text dark:text-[#e6eaf0]">
                            {formatDisplay(totalDisplay, displayCurrency)}
                          </td>
                          <td className="py-1.5 pr-2 tabular-nums">
                            {(pos.pct_cartera * 100).toFixed(1)}%
                          </td>
                          <td className="py-1.5 pr-2 tabular-nums">{(pctInstrumento * 100).toFixed(0)}%</td>
                          {nivelDetectado === 3 && (
                            <td
                              className={`py-1.5 pr-2 tabular-nums ${
                                (pos.resultado_realizado_ars ?? 0) >= 0
                                  ? "text-vault-green"
                                  : "text-vault-red"
                              }`}
                            >
                              {pos.resultado_realizado_ars != null
                                ? formatCurrency(pos.resultado_realizado_ars, "ARS")
                                : "—"}
                            </td>
                          )}
                          {nivelDetectado === 3 && (
                            <td className="py-1.5 tabular-nums">
                              {pos.rendimiento_pct != null ? formatPercent(pos.rendimiento_pct) : "—"}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
