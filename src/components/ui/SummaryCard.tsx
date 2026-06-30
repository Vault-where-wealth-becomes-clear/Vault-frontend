interface SummaryCardProps {
  label: string;
  value: string;
  hint?: string;
  hintColor?: "green" | "red" | "muted";
  className?: string;
}

const HINT_COLORS: Record<NonNullable<SummaryCardProps["hintColor"]>, string> = {
  green: "text-vault-green",
  red: "text-vault-red",
  muted: "text-vault-muted2 dark:text-[#8b949e]",
};

export function SummaryCard({
  label,
  value,
  hint,
  hintColor = "muted",
  className = "",
}: SummaryCardProps) {
  return (
    <div className={`card-vault ${className}`}>
      <p className="section-label mb-3">{label}</p>
      <p className="number-hero">{value}</p>
      {hint && <p className={`mt-2 text-sm ${HINT_COLORS[hintColor]}`}>{hint}</p>}
    </div>
  );
}
