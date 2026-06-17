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
            <stop offset="5%" stopColor="#c8f135" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#c8f135" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fill: "#535970", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            background: "#1a1d28",
            border: "1px solid rgba(255,255,255,0.13)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#828ca8" }}
          formatter={(value: number) => [`USD ${value.toLocaleString("es-AR")}`, "Patrimonio"]}
        />
        <Area type="monotone" dataKey="total_usd" stroke="#c8f135" strokeWidth={2} fill="url(#patGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
