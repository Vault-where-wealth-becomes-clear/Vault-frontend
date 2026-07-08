import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CarteraEvolucionPoint } from "@/api/cartera.api";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatPeriod } from "@/utils/formatDate";

// Mismo color usado para "Cuenta comitente" en el gráfico compuesto del Dashboard
// (MonthlySeriesChart) — una sola serie acá, así que no hace falta leyenda (el
// título de la sección ya la nombra).
const COLOR = "#d97706";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number | null }>;
  label?: string;
}) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  return (
    <div
      className="rounded-lg border border-vault-border bg-white px-3 py-2.5 shadow-lg dark:border-[#30363d] dark:bg-[#161b22]"
      style={{ fontSize: 12 }}
    >
      <p className="mb-1 font-semibold capitalize text-vault-text dark:text-[#e6edf3]">
        {label ? formatPeriod(label) : ""}
      </p>
      <p className="flex items-center gap-1.5 text-vault-muted2 dark:text-[#8b949e]">
        <span className="h-2 w-2 rounded-full" style={{ background: COLOR }} />
        Valor de cartera:{" "}
        <span className="font-medium text-vault-text dark:text-[#e6edf3]">
          {formatCurrency(payload[0].value as number, "ARS")}
        </span>
      </p>
    </div>
  );
}

export function CarteraEvolutionChart({ data }: { data: CarteraEvolucionPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={(m: string) => formatPeriod(m).replace(/ de \d+/, "")}
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatCurrency(v, "ARS", true)}
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} />
        <Line
          type="monotone"
          dataKey="valor_base_ars"
          stroke={COLOR}
          strokeWidth={2}
          dot={{ r: 3, fill: COLOR, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
