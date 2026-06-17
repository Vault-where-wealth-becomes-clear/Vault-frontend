import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { BreakdownItem } from "@/api/dashboard.api";
import { formatCurrency } from "@/utils/formatCurrency";

const COLORS = ["#c8f135", "#5b9cf6", "#a78bfa", "#fb923c", "#fbbf24", "#535970"];

interface BreakdownChartProps {
  data: BreakdownItem[];
}

export function BreakdownChart({ data }: BreakdownChartProps) {
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={120} height={120}>
        <PieChart>
          <Pie data={data} dataKey="amount_ars" nameKey="category" innerRadius={36} outerRadius={56} paddingAngle={2}>
            {data.map((entry, index) => (
              <Cell key={entry.category} fill={COLORS[index % COLORS.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#1a1d28",
              border: "1px solid rgba(255,255,255,0.13)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => formatCurrency(value, "ARS")}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex flex-1 flex-col gap-1.5">
        {data.map((item, index) => (
          <div key={item.category} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2 w-2 flex-shrink-0 rounded-sm"
                style={{ background: COLORS[index % COLORS.length] }}
              />
              <span className="truncate text-vault-muted2">{item.category}</span>
            </div>
            <span className="flex-shrink-0 font-mono text-vault-text">
              {item.pct_of_total.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
