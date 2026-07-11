import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlySeriesPoint } from "@/api/dashboard.api";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatPeriod } from "@/utils/formatDate";

interface MonthlySeriesChartProps {
  data: MonthlySeriesPoint[];
}

const SERIES: { key: keyof MonthlySeriesPoint; name: string; color: string }[] = [
  { key: "resultado_usd", name: "Resultado del mes", color: "#16a34a" },
  { key: "patrimonio_usd", name: "Patrimonio neto", color: "#1e3a8a" },
  { key: "cartera_usd", name: "Cuenta comitente", color: "#d97706" },
  { key: "gasto_usd", name: "Gasto del mes", color: "#dc2626" },
];

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number | null; color: string; name: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border border-vault-border bg-white px-3 py-2.5 shadow-lg dark:border-[#68727f] dark:bg-[#474e58]"
      style={{ fontSize: 12 }}
    >
      <p className="mb-1.5 font-semibold capitalize text-vault-text dark:text-[#e6eaf0]">
        {label ? formatPeriod(label) : ""}
      </p>
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p) => (
          <p
            key={p.dataKey}
            className="flex items-center gap-1.5 text-vault-muted2 dark:text-[#99a3b0]"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}:{" "}
            <span className="font-medium text-vault-text dark:text-[#e6eaf0]">
              {formatCurrency(p.value as number, "USD")}
            </span>
          </p>
        ))}
    </div>
  );
}

export function MonthlySeriesChart({ data }: MonthlySeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
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
          tickFormatter={(v: number) => formatCurrency(v, "USD", true)}
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value: string) => (
            <span className="text-vault-muted2 dark:text-[#99a3b0]">{value}</span>
          )}
        />
        {SERIES.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
