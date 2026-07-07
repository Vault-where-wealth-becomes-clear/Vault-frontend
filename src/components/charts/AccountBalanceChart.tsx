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
import { formatCurrency } from "@/utils/formatCurrency";
import { formatPeriod } from "@/utils/formatDate";
import { getCategoryColor } from "@/utils/categoryColors";

export interface AccountBalancePoint {
  month: string;
  [accountId: string]: string | number | null;
}

export interface AccountBalanceLine {
  accountId: string;
  label: string;
  currency: "ARS" | "USD";
}

interface AccountBalanceChartProps {
  points: AccountBalancePoint[];
  lines: AccountBalanceLine[];
}

function ChartTooltip({
  active,
  payload,
  label,
  lines,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number | null; color: string }>;
  label?: string;
  lines: AccountBalanceLine[];
}) {
  if (!active || !payload?.length) return null;
  const lineByKey = new Map(lines.map((l) => [l.accountId, l]));
  return (
    <div
      className="rounded-lg border border-vault-border bg-white px-3 py-2.5 shadow-lg dark:border-[#30363d] dark:bg-[#161b22]"
      style={{ fontSize: 12 }}
    >
      <p className="mb-1.5 font-semibold capitalize text-vault-text dark:text-[#e6edf3]">
        {label ? formatPeriod(label) : ""}
      </p>
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p) => {
          const line = lineByKey.get(p.dataKey);
          if (!line) return null;
          return (
            <p
              key={p.dataKey}
              className="flex items-center gap-1.5 text-vault-muted2 dark:text-[#8b949e]"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {line.label}:{" "}
              <span className="font-medium text-vault-text dark:text-[#e6edf3]">
                {formatCurrency(p.value as number, line.currency)}
              </span>
            </p>
          );
        })}
    </div>
  );
}

/** Saldo de cada cuenta (entidad + tipo) a lo largo de los meses — una línea por cuenta. */
export function AccountBalanceChart({ points, lines }: AccountBalanceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(280, lines.length * 12 + 240)}>
      <LineChart data={points} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={(m: string) => formatPeriod(m).replace(/ de \d+/, "")}
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) =>
            new Intl.NumberFormat("es-AR", { notation: "compact" }).format(v)
          }
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<ChartTooltip lines={lines} />} />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value: string) => (
            <span className="text-vault-muted2 dark:text-[#8b949e]">{value}</span>
          )}
        />
        {lines.map((line, i) => (
          <Line
            key={line.accountId}
            type="monotone"
            dataKey={line.accountId}
            name={line.label}
            stroke={getCategoryColor(line.label, i)}
            strokeWidth={2}
            dot={{ r: 3, fill: getCategoryColor(line.label, i), strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
