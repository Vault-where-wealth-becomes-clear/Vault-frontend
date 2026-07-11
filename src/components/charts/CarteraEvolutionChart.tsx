import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CarteraEvolucionPoint, InstrumentoTipo } from "@/api/cartera.api";
import { TIPO_LABELS } from "@/components/cartera/carteraLabels";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatPeriod } from "@/utils/formatDate";

const LINE_COLOR = "#d97706";

function tipoLabel(tipo: string): string {
  return TIPO_LABELS[tipo as InstrumentoTipo] ?? tipo;
}

interface LinePoint {
  month: string;
  total: number | null;
  [tipoValueKey: string]: string | number | null;
}

function LineTooltip({
  active,
  payload,
  label,
  tipos,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ value: number | null; payload: LinePoint }>;
  label?: string;
  tipos: string[];
  currency: "ARS" | "USD";
}) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  const point = payload[0].payload;
  return (
    <div
      className="rounded-lg border border-vault-border bg-white px-3 py-2.5 shadow-lg dark:border-[#68727f] dark:bg-[#474e58]"
      style={{ fontSize: 12 }}
    >
      <p className="mb-1 font-semibold capitalize text-vault-text dark:text-[#e6eaf0]">
        {label ? formatPeriod(label) : ""}
      </p>
      <p className="mb-1.5 flex items-center gap-1.5 text-vault-muted2 dark:text-[#99a3b0]">
        <span className="h-2 w-2 rounded-full" style={{ background: LINE_COLOR }} />
        Valor de cartera:{" "}
        <span className="font-medium text-vault-text dark:text-[#e6eaf0]">
          {formatCurrency(payload[0].value as number, currency)}
        </span>
      </p>
      {tipos.length > 0 && (
        <div className="flex flex-col gap-0.5 border-t border-vault-border/60 pt-1.5 dark:border-[#68727f]/60">
          {tipos
            .filter((tipo) => typeof point[tipo] === "number" && (point[tipo] as number) > 0)
            .map((tipo) => (
              <p key={tipo} className="flex items-center justify-between gap-3 text-vault-muted2 dark:text-[#99a3b0]">
                <span>{tipoLabel(tipo)}</span>
                <span className="font-medium text-vault-text dark:text-[#e6eaf0]">
                  {formatCurrency(point[tipo] as number, currency)}
                </span>
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

export function CarteraEvolutionChart({
  data,
  tipos,
  displayCurrency,
  getMepRateForMonth,
}: {
  data: CarteraEvolucionPoint[];
  /** Tipos a desglosar en el tooltip al pasar el mouse por un punto. */
  tipos: string[];
  displayCurrency: "ARS" | "USD";
  /** TC MEP para un mes dado — la evolución cruza varios meses, cada uno con su
   * propia cotización, así que no alcanza un único TC como en el resto de la página. */
  getMepRateForMonth: (month: string) => number | null;
}) {
  const linePoints = useMemo<LinePoint[]>(() => {
    return data.map((point) => {
      const rate = displayCurrency === "USD" ? getMepRateForMonth(point.month) : 1;
      const convert = (arsValue: number): number | null =>
        displayCurrency === "ARS" ? arsValue : rate ? arsValue / rate : null;

      const row: LinePoint = {
        month: point.month,
        total: convert(point.valor_base_ars),
      };
      for (const tipo of tipos) {
        const pct = point.composicion_por_tipo[tipo] ?? 0;
        row[tipo] = convert(pct * point.valor_base_ars);
      }
      return row;
    });
  }, [data, tipos, displayCurrency, getMepRateForMonth]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={linePoints} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d0d7e1" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={(m: string) => formatPeriod(m).replace(/ de \d+/, "")}
          tick={{ fill: "#7c8aa0", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatCurrency(v, displayCurrency, true)}
          tick={{ fill: "#7c8aa0", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip content={<LineTooltip tipos={tipos} currency={displayCurrency} />} />
        <Line
          type="monotone"
          dataKey="total"
          stroke={LINE_COLOR}
          strokeWidth={2}
          dot={{ r: 3, fill: LINE_COLOR, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
