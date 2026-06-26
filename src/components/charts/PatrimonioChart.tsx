import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EvolutionPoint } from "@/api/dashboard.api";

interface PatrimonioChartProps {
  data: EvolutionPoint[];
}

export function PatrimonioChart({ data }: PatrimonioChartProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id="patGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fill: "#535970", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid rgba(37,99,235,0.20)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#828ca8" }}
          formatter={(value: number) => [`USD ${value.toLocaleString("es-AR")}`, "Patrimonio"]}
        />
        <Area type="monotone" dataKey="total_usd" stroke="#2563eb" strokeWidth={2} fill="url(#patGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
