import type { ReactNode } from "react";

interface SummaryCardProps {
  label: string;
  value: string;
  hint?: string;
  hintColor?: "green" | "red" | "muted";
  className?: string;
  /** Slot chico junto al label — ej. el toggle de tapar importes en Patrimonio total. */
  action?: ReactNode;
}

const HINT_COLORS: Record<NonNullable<SummaryCardProps["hintColor"]>, string> = {
  green: "text-vault-green",
  red: "text-vault-red",
  muted: "text-vault-muted2 dark:text-[#99a3b0]",
};

export function SummaryCard({
  label,
  value,
  hint,
  hintColor = "muted",
  className = "",
  action,
}: SummaryCardProps) {
  return (
    <div className={`card-vault ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="section-label mb-3">{label}</p>
        {action}
      </div>
      <p className="number-hero">{value}</p>
      {hint && <p className={`mt-2 text-sm ${HINT_COLORS[hintColor]}`}>{hint}</p>}
    </div>
  );
}
