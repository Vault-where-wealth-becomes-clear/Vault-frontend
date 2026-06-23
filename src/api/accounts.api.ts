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
