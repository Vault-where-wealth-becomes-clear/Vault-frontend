import type { Upload } from "@/api/uploads.api";
import type { Transaction } from "@/api/transactions.api";

/**
 * Saldo de cierre real de un upload: saldo inicial + neto de sus propias
 * transacciones, calculado en el cliente (misma fórmula que usa "mes a mes").
 * No depende de closing_balance_{ars,usd} (requiere que el worker haya
 * podido leer el saldo impreso del PDF línea por línea — falla si el LLM no
 * alinea 1:1 con el extracto) ni de current_balance/saldo_final (valor que
 * calculó el LLM, no una cuenta determinística).
 */
export function computeUploadClosingBalance(
  upload: Pick<Upload, "opening_balance_ars" | "opening_balance_usd">,
  transactionsForUpload: Transaction[],
  isUsd: boolean
): number {
  const opening = Number(isUsd ? upload.opening_balance_usd : upload.opening_balance_ars);
  const net = transactionsForUpload.reduce(
    (sum, t) => sum + Number((isUsd ? t.amount_usd : t.amount_ars) ?? 0),
    0
  );
  return opening + net;
}

/** Agrupa transacciones por upload_id para lookups O(1) al calcular saldos. */
export function groupTransactionsByUpload(transactions: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (!t.upload_id) continue;
    if (!map.has(t.upload_id)) map.set(t.upload_id, []);
    map.get(t.upload_id)!.push(t);
  }
  return map;
}
