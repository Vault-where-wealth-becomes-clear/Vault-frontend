import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
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

/** Solo un pie chart — tocar una sección muestra nombre, importe total y porcentaje. */
export function BreakdownChart({ data, mepRate }: BreakdownChartProps) {
  const sorted = [...data].sort((a, b) => b.amount_ars - a.amount_ars);
  const [selected, setSelected] = useState<PiePayload | null>(null);

  const handleClick = (entry: PiePayload) => {
    setSelected((prev) => (prev?.category === entry.category ? null : entry));
  };

  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-8">
      <div className="flex-shrink-0" style={{ width: 220, height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={sorted}
              dataKey="amount_ars"
              nameKey="category"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={2}
              stroke="none"
              onClick={handleClick}
              style={{ cursor: "pointer" }}
            >
              {sorted.map((entry, i) => (
                <Cell key={entry.category} fill={getCategoryColor(entry.category, i)} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip mepRate={mepRate} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="min-w-[180px] text-center sm:text-left">
        {selected ? (
          <>
            <p className="text-sm font-medium text-vault-text dark:text-[#e6edf3]">
              {selected.category}
            </p>
            <p
              className="mt-1 tabular-nums font-light text-vault-text dark:text-[#e6edf3]"
              style={{ fontSize: 28 }}
            >
              {formatCurrency(selected.amount_ars, "ARS")}
            </p>
            <p className="mt-0.5 text-sm text-vault-muted2 dark:text-[#8b949e]">
              {selected.pct_of_total.toFixed(1)}% del total
            </p>
          </>
        ) : (
          <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
            Tocá una sección para ver el detalle.
          </p>
        )}
      </div>
    </div>
  );
}
