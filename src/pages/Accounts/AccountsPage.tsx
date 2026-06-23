import { useState, type FormEvent } from "react";
import {
  ACCOUNT_TYPE_LABELS,
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  type AccountType,
  type CurrencyType,
} from "@/api/accounts.api";
import { formatCurrency } from "@/utils/formatCurrency";
import { extractErrorMessage } from "@/utils/apiError";

export function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();

  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("checking_ars");
  const [currency, setCurrency] = useState<CurrencyType>("ARS");
  const [balance, setBalance] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await createAccount.mutateAsync({
        name,
        account_type: accountType,
        currency,
        current_balance: Number(balance) || 0,
      });
      setName("");
      setBalance("0");
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="font-syne text-2xl font-bold">Mis cuentas</h1>
        <p className="text-sm text-vault-muted2">
          Las cuentas que registres acá son las que vas a poder usar para cargar extractos.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="card-vault col-span-2">
          <h2 className="mb-3 font-syne text-sm font-bold">Cuentas activas</h2>
          {isLoading ? (
            <p className="text-sm text-vault-muted2">Cargando...</p>
          ) : !accounts || accounts.length === 0 ? (
            <p className="text-sm text-vault-muted2">Todavía no registraste ninguna cuenta.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between gap-3 rounded-vault border border-vault-border bg-vault-s2 px-3.5 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium text-vault-text">{account.name}</p>
                    <p className="text-xs text-vault-muted2">
                      {ACCOUNT_TYPE_LABELS[account.account_type]}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-vault-text">
                      {formatCurrency(account.current_balance, account.currency)}
                    </span>
                    <button
                      onClick={() => deleteAccount.mutate(account.id)}
                      title="Eliminar cuenta"
                      className="text-vault-muted transition-colors hover:text-vault-red"
                    >
                      &#10005;
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-vault">
          <h2 className="mb-3 font-syne text-sm font-bold">Nueva cuenta</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-vault-muted2">Nombre</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-vault"
                placeholder="Cuenta sueldo"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-vault-muted2">Tipo</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType)}
                className="input-vault"
              >
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-vault-muted2">Moneda</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyType)}
                className="input-vault"
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-vault-muted2">
                Saldo actual
              </label>
              <input
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="input-vault"
              />
            </div>

            {error && (
              <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                {error}
              </div>
            )}

            <button type="submit" disabled={createAccount.isPending} className="btn-primary mt-1">
              {createAccount.isPending ? "Creando..." : "Crear cuenta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
