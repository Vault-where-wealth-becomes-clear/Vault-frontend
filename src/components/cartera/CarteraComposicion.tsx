import { useMemo, useState } from "react";
import type { CarteraPosicion, InstrumentoTipo } from "@/api/cartera.api";
import { formatCurrency, formatPercent } from "@/utils/formatCurrency";
import { TIPO_LABELS } from "./carteraLabels";

interface TipoGroup {
  tipo: InstrumentoTipo;
  valorArs: number;
  posiciones: CarteraPosicion[];
}

/**
 * Composición de cartera agrupada por tipo de instrumento, con drill-down a las
 * posiciones individuales de cada grupo (valor en su moneda nativa, % que representa
 * sobre toda la cartera y % que representa dentro de su propio tipo).
 */
export function CarteraComposicion({
  posiciones,
  nivelDetectado,
}: {
  posiciones: CarteraPosicion[];
  nivelDetectado: 1 | 2 | 3;
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
        return (
          <div key={group.tipo}>
            <button
              type="button"
              onClick={() => setExpandedTipo(isOpen ? null : group.tipo)}
              className="flex w-full items-center gap-2 py-1 text-left text-xs"
            >
              <span className="w-24 flex-shrink-0 truncate text-vault-muted2 dark:text-[#8b949e]">
                {TIPO_LABELS[group.tipo] ?? group.tipo}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-vault-s2 dark:bg-[#21262d]">
                <div
                  className="h-full rounded-full bg-vault-accent"
                  style={{ width: `${Math.min(pct * 100, 100)}%` }}
                />
              </div>
              <span className="w-24 flex-shrink-0 text-right tabular-nums text-vault-text dark:text-[#e6edf3]">
                {formatCurrency(group.valorArs, "ARS")}
              </span>
              <span className="w-10 flex-shrink-0 text-right tabular-nums text-vault-muted2 dark:text-[#8b949e]">
                {(pct * 100).toFixed(0)}%
              </span>
              <span
                className="flex-shrink-0 text-vault-muted2 transition-transform duration-200 dark:text-[#8b949e]"
                style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
              >
                ›
              </span>
            </button>

            {isOpen && (
              <div className="mb-1 ml-2 flex flex-col gap-1 border-l-2 border-vault-border pl-3 dark:border-[#30363d]">
                {group.posiciones.map((pos, i) => {
                  const pctInstrumento = group.valorArs ? pos.valor_base_ars / group.valorArs : 0;
                  return (
                    <div
                      key={`${pos.instrumento}-${i}`}
                      className="flex flex-col gap-0.5 border-b border-vault-border/30 py-1 last:border-0 dark:border-[#30363d]/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-vault-text dark:text-[#e6edf3]">
                          {pos.instrumento}
                        </span>
                        <span className="flex-shrink-0 tabular-nums text-xs text-vault-text dark:text-[#e6edf3]">
                          {formatCurrency(pos.valor_moneda, pos.moneda)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-vault-muted2 dark:text-[#8b949e]">
                        <span>% cartera: {(pos.pct_cartera * 100).toFixed(1)}%</span>
                        <span>% {TIPO_LABELS[group.tipo] ?? group.tipo}: {(pctInstrumento * 100).toFixed(0)}%</span>
                        {nivelDetectado === 3 && pos.resultado_realizado_ars != null && (
                          <span
                            className={
                              pos.resultado_realizado_ars >= 0 ? "text-vault-green" : "text-vault-red"
                            }
                          >
                            Result.: {formatCurrency(pos.resultado_realizado_ars, "ARS")}
                          </span>
                        )}
                        {nivelDetectado === 3 && pos.rendimiento_pct != null && (
                          <span>Rend.: {formatPercent(pos.rendimiento_pct)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
