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
  muted: "text-vault-muted2",
};

export function SummaryCard({ label, value, hint, hintColor = "muted", className = "" }: SummaryCardProps) {
  return (
    <div className={`card-vault ${className}`}>
      <p className="mb-2 text-xs font-medium text-vault-muted2">{label}</p>
      <p className="font-syne text-2xl font-bold text-vault-text">{value}</p>
      {hint && <p className={`mt-1.5 text-xs ${HINT_COLORS[hintColor]}`}>{hint}</p>}
    </div>
  );
}
