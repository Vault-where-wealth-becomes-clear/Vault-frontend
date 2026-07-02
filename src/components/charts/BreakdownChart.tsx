import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BreakdownItem } from "@/api/dashboard.api";
import { formatCurrency } from "@/utils/formatCurrency";
import { getCategoryColor } from "@/utils/categoryColors";

interface BreakdownChartProps {
  data: BreakdownItem[];
  mepRate?: number;
}

interface PiePayload {
  category: string;
  amount_ars: number;
  amount_usd: number | null;
  pct_of_total: number;
}

function DonutTooltip({
  active,
  payload,
  mepRate,
}: {
  active?: boolean;
  payload?: Array<{ payload: PiePayload }>;
  mepRate?: number;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const usd = item.amount_usd ?? (mepRate ? item.amount_ars / mepRate : null);
  return (
    <div
      className="rounded-lg border border-vault-border bg-white px-3 py-2.5 shadow-lg dark:border-[#30363d] dark:bg-[#161b22]"
      style={{ fontSize: 12 }}
    >
      <p className="mb-1.5 font-semibold text-vault-text dark:text-[#e6edf3]">{item.category}</p>
      <p className="text-vault-text dark:text-[#e6edf3]">{formatCurrency(item.amount_ars, "ARS")}</p>
      {usd != null && (
        <p className="text-vault-muted2 dark:text-[#8b949e]">{formatCurrency(usd, "USD")}</p>
      )}
      <p className="mt-1 text-vault-muted2 dark:text-[#8b949e]">{item.pct_of_total.toFixed(1)}%</p>
    </div>
  );
}

export function BreakdownChart({ data, mepRate }: BreakdownChartProps) {
  const sorted = [...data].sort((a, b) => b.amount_ars - a.amount_ars);

  return (
    <div>
      {/* Top: legend (left) + donut (center) */}
      <div className="flex gap-8">
        {/* Legend */}
        <div className="flex min-w-[150px] flex-col justify-center gap-2">
          {sorted.map((item, i) => (
            <div key={item.category} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                style={{ background: getCategoryColor(item.category, i) }}
              />
              <span className="min-w-0 flex-1 truncate text-vault-muted2 dark:text-[#8b949e]">
                {item.category}
              </span>
              <span className="flex-shrink-0 tabular-nums font-medium text-vault-text dark:text-[#e6edf3]">
                {item.pct_of_total.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>

        {/* Donut */}
        <div className="flex flex-1 items-center justify-center">
          <ResponsiveContainer width={220} height={220}>
            <PieChart>
              <Pie
                data={sorted}
                dataKey="amount_ars"
                nameKey="category"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={2}
                stroke="none"
              >
                {sorted.map((entry, i) => (
                  <Cell
                    key={entry.category}
                    fill={getCategoryColor(entry.category, i)}
                    stroke="none"
                  />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip mepRate={mepRate} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom: horizontal bar chart */}
      <div className="mt-5 border-t border-vault-border pt-4 dark:border-[#30363d]">
        <ResponsiveContainer width="100%" height={sorted.length * 32 + 8}>
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ left: 0, right: 100, top: 0, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="category"
              width={110}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Bar dataKey="amount_ars" radius={[0, 3, 3, 0]} maxBarSize={18}>
              {sorted.map((entry, i) => (
                <Cell key={entry.category} fill={getCategoryColor(entry.category, i)} />
              ))}
              <LabelList
                dataKey="amount_ars"
                position="right"
                formatter={(v: number) => formatCurrency(v, "ARS")}
                style={{ fill: "#94a3b8", fontSize: 10 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
