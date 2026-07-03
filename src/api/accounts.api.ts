import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export type AccountType =
  | "credit_card_ars"
  | "credit_card_usd"
  | "checking_ars"
  | "checking_usd"
  | "broker"
  | "crypto"
  | "cash"
  | "savings_box";

export type CurrencyType = "ARS" | "USD";

export interface Account {
  id: string;
  name: string;
  account_type: AccountType;
  institution: string | null;
  currency: CurrencyType;
  current_balance: number;
  is_active: boolean;
}

export interface AccountCreate {
  name: string;
  account_type: AccountType;
  institution?: string;
  currency: CurrencyType;
  current_balance: number;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  credit_card_ars: "Tarjeta de crédito (ARS)",
  credit_card_usd: "Tarjeta de crédito (USD)",
  checking_ars: "Cuenta corriente (ARS)",
  checking_usd: "Cuenta corriente (USD)",
  broker: "Broker",
  crypto: "Cripto",
  cash: "Efectivo",
  savings_box: "Caja de ahorro",
};

/**
 * Nombre a mostrar en toda la app: "Entidad · Tipo · Moneda · Referencia"
 * (ej. "BBVA · CA · ARS · sueldo", "BBVA · Visa · ARS", "Efectivo · ARS · billetera").
 * El tipo (emisor de tarjeta) y la referencia viajan embebidos en `account.name`
 * desde que se crea la cuenta — no hay campos `issuer`/`reference` separados,
 * así que se extraen de los segmentos separados por "·" según la convención de
 * `generateAccountName` (AccountsPage.tsx): [prefijo, referencia?, moneda] para
 * CC/CA/Efectivo, [emisor, referencia?] para tarjetas.
 */
export function getAccountDisplayName(account: Account): string {
  const entity = account.institution?.trim() || "";
  const parts = account.name
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);

  let typeLabel = "";
  let reference = "";

  switch (account.account_type) {
    case "checking_ars":
    case "checking_usd":
      typeLabel = "CC";
      reference = parts.length === 3 ? parts[1] : "";
      break;
    case "savings_box":
      typeLabel = "CA";
      reference = parts.length === 3 ? parts[1] : "";
      break;
    case "cash":
      reference = parts.length === 3 ? parts[1] : "";
      break;
    case "credit_card_ars":
    case "credit_card_usd": {
      const issuer = parts[0];
      typeLabel = issuer && issuer !== entity ? issuer : "Tarjeta";
      reference = parts.length === 2 ? parts[1] : "";
      break;
    }
    case "broker":
      typeLabel = "Broker";
      break;
    case "crypto":
      typeLabel = "Cripto";
      break;
    default:
      typeLabel = account.name;
  }

  return [entity, typeLabel, account.currency, reference].filter(Boolean).join(" · ");
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async (): Promise<Account[]> => {
      const { data } = await apiClient.get<Account[]>("/accounts");
      return data;
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AccountCreate): Promise<Account> => {
      const { data } = await apiClient.post<Account>("/accounts", body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: Partial<AccountCreate> & { id: string }): Promise<Account> => {
      const { data } = await apiClient.patch<Account>(`/accounts/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string): Promise<void> => {
      await apiClient.delete(`/accounts/${accountId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
