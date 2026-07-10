import type { Transaction } from "@/api/transactions.api";
import { formatCurrency } from "@/utils/formatCurrency";

function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

interface CategoryLedgerProps {
  transactions: Transaction[];
}

/**
 * Libro diario (débito/crédito) para una categoría — usa la moneda nativa de
 * cada transacción (t.currency), nunca la moneda de la cuenta, para no mezclar
 * pesos y dólares en la misma columna.
 */
export function CategoryLedger({ transactions }: CategoryLedgerProps) {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-vault-muted2 dark:text-[#8b949e]">
        Sin movimientos.
      </p>
    );
  }

  let debitoArs = 0;
  let debitoUsd = 0;
  let creditoArs = 0;
  let creditoUsd = 0;
  for (const t of sorted) {
    const amt = t.currency === "USD" ? Number(t.amount_usd) || 0 : Number(t.amount_ars) || 0;
    if (amt < 0) {
      if (t.currency === "USD") debitoUsd += Math.abs(amt);
      else debitoArs += Math.abs(amt);
    } else {
      if (t.currency === "USD") creditoUsd += amt;
      else creditoArs += amt;
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-xs">
        <thead>
          <tr className="border-b border-vault-border/40 dark:border-[#30363d]/40">
            <th className="py-1.5 pl-1 text-left text-[10px] font-semibold uppercase tracking-wider text-vault-muted2 dark:text-[#8b949e]">
              Fecha
            </th>
            <th className="py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-vault-muted2 dark:text-[#8b949e]">
              Descripción
            </th>
            <th className="py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-vault-muted2 dark:text-[#8b949e]">
              Débito
            </th>
            <th className="py-1.5 pr-1 text-right text-[10px] font-semibold uppercase tracking-wider text-vault-muted2 dark:text-[#8b949e]">
              Crédito
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const amt =
              t.currency === "USD" ? Number(t.amount_usd) || 0 : Number(t.amount_ars) || 0;
            return (
              <tr
                key={t.id}
                className="border-b border-vault-border/20 last:border-0 dark:border-[#30363d]/20"
              >
                <td className="py-1.5 pl-1 text-vault-muted2 dark:text-[#8b949e]">
                  {fmtDate(t.date)}
                </td>
                <td className="max-w-[220px] truncate py-1.5 text-vault-muted2 dark:text-[#8b949e]">
                  {t.description}
                </td>
                <td className="py-1.5 text-right tabular-nums text-vault-red">
                  {amt < 0 ? formatCurrency(Math.abs(amt), t.currency) : ""}
                </td>
                <td className="py-1.5 pr-1 text-right tabular-nums text-vault-green">
                  {amt >= 0 ? formatCurrency(amt, t.currency) : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-vault-border/50 font-medium dark:border-[#30363d]/50">
            <td
              colSpan={2}
              className="py-1.5 pl-1 text-right text-vault-muted2 dark:text-[#8b949e]"
            >
              Total
            </td>
            <td className="py-1.5 text-right tabular-nums text-vault-red">
              {debitoArs > 0 && formatCurrency(debitoArs, "ARS")}
              {debitoUsd > 0 && (
                <>
                  <br />
                  {formatCurrency(debitoUsd, "USD")}
                </>
              )}
            </td>
            <td className="py-1.5 pr-1 text-right tabular-nums text-vault-green">
              {creditoArs > 0 && formatCurrency(creditoArs, "ARS")}
              {creditoUsd > 0 && (
                <>
                  <br />
                  {formatCurrency(creditoUsd, "USD")}
                </>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
