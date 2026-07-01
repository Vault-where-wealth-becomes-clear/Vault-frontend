import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EvolutionPoint } from "@/api/dashboard.api";

interface PatrimonioChartProps {
  data: EvolutionPoint[];
  selectedMonth?: string;
  onMonthClick?: (point: EvolutionPoint) => void;
}

export function PatrimonioChart({ data, selectedMonth, onMonthClick }: PatrimonioChartProps) {
  const handleClick = (e: { activePayload?: { payload: EvolutionPoint }[] } | null) => {
    if (e?.activePayload?.[0]?.payload) {
      onMonthClick?.(e.activePayload[0].payload);
    }
  };

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart
        data={data}
        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        onClick={handleClick}
        style={{ cursor: onMonthClick ? "pointer" : undefined }}
      >
        <defs>
          <linearGradient id="patGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="month"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid rgba(37,99,235,0.20)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#64748b" }}
          formatter={(value: number) => [`USD ${value.toLocaleString("es-AR")}`, "Patrimonio"]}
        />
        {selectedMonth && (
          <ReferenceLine
            x={selectedMonth}
            stroke="#1e3a8a"
            strokeDasharray="4 2"
            strokeOpacity={0.6}
          />
        )}
        <Area
          type="monotone"
          dataKey="total_usd"
          stroke="#1e3a8a"
          strokeWidth={2}
          fill="url(#patGradient)"
          connectNulls={false}
          dot={{ r: 3, fill: "#1e3a8a", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#1e3a8a" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
