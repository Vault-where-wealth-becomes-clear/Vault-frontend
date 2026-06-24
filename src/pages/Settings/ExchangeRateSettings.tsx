import { useState, type FormEvent } from "react";
import { useExchangeRates, useRecalculatePeriod, useSetExchangeRate } from "@/api/exchangeRates.api";
import { extractErrorMessage } from "@/utils/apiError";
import { formatPeriod, getCurrentPeriod } from "@/utils/formatDate";

export function ExchangeRateSettings() {
  const { data: rates, isLoading } = useExchangeRates();
  const setRate = useSetExchangeRate();
  const recalculate = useRecalculatePeriod();

  const [periodMonth, setPeriodMonth] = useState(getCurrentPeriod());
  const [mepRate, setMepRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const rate = Number(mepRate);
    if (!rate || rate <= 0) {
      setError("Ingresá un TC válido.");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await setRate.mutateAsync({ periodMonth, mepRate: rate });
      const result = await recalculate.mutateAsync(periodMonth);
      setNotice(`TC guardado. Se recalcularon ${result.updated} movimientos de ese período.`);
      setMepRate("");
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="card-vault mb-5 max-w-md">
      <h2 className="mb-1 font-syne text-sm font-bold">Tipo de cambio MEP</h2>
      <p className="mb-3 text-xs text-vault-muted2">
        Se usa para convertir tus movimientos en ARS a USD en el tablero. Sin un TC declarado para
        el período, los totales en USD no son confiables.
      </p>

      <form onSubmit={handleSubmit} className="mb-4 flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-vault-muted2">Período</label>
          <input
            type="date"
            required
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            className="input-vault"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-vault-muted2">TC MEP</label>
          <input
            type="number"
            step="0.01"
            required
            value={mepRate}
            onChange={(e) => setMepRate(e.target.value)}
            placeholder="1250.00"
            className="input-vault"
          />
        </div>
        <button type="submit" disabled={setRate.isPending || recalculate.isPending} className="btn-primary">
          Guardar
        </button>
      </form>

      {error && (
        <div className="mb-3 rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-3 rounded-vault border border-vault-green/20 bg-vault-green/10 px-3.5 py-2.5 text-sm text-vault-green">
          {notice}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-vault-muted2">Cargando...</p>
      ) : !rates || rates.length === 0 ? (
        <p className="text-sm text-vault-muted2">Todavía no declaraste ningún TC.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rates.map((rate) => (
            <li key={rate.id} className="flex items-center justify-between text-xs">
              <span className="capitalize text-vault-muted2">{formatPeriod(rate.period_month)}</span>
              <span className="font-mono text-vault-text">${rate.mep_rate.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
