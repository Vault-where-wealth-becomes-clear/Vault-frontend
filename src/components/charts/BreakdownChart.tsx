import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { BreakdownItem } from "@/api/dashboard.api";
import { formatCurrency } from "@/utils/formatCurrency";
import { getCategoryColor } from "@/utils/categoryColors";

interface BreakdownChartProps {
  data: BreakdownItem[];
}

export function BreakdownChart({ data }: BreakdownChartProps) {
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={120} height={120}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount_ars"
            nameKey="category"
            innerRadius={36}
            outerRadius={56}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.category}
                fill={getCategoryColor(entry.category, index)}
                stroke="none"
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
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
                style={{ background: getCategoryColor(item.category, index) }}
              />
              <span className="truncate text-vault-muted2 dark:text-[#8b949e]">
                {item.category}
              </span>
            </div>
            <span className="flex-shrink-0 tabular-nums text-vault-text dark:text-[#e6edf3]">
              {item.pct_of_total.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
