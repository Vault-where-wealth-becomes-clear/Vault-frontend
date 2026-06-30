import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export const STANDARD_CATEGORIES = [
  "Supermercado",
  "Restaurantes",
  "Delivery",
  "Combustible",
  "Transporte",
  "Salud",
  "Educación",
  "Entretenimiento",
  "Ropa",
  "Electrónica",
  "Servicios",
  "Suscripciones",
  "Transferencias",
  "Inversiones",
  "Sin categoría",
];

export interface Transaction {
  id: string;
  upload_id: string;
  account_id: string;
  date: string;
  description: string;
  amount_ars: number;
  amount_usd: number | null;
  currency: "ARS" | "USD";
  category: string | null;
  confidence: number | null;
  needs_review: boolean;
  is_corrected: boolean;
  created_at: string;
}

interface TransactionFilters {
  accountId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: async (): Promise<Transaction[]> => {
      const { data } = await apiClient.get<Transaction[]>("/transactions", {
        params: {
          account_id: filters.accountId,
          category: filters.category,
          date_from: filters.dateFrom,
          date_to: filters.dateTo,
        },
      });
      return data;
    },
  });
}

export function useReviewQueue(uploadId: string | null) {
  return useQuery({
    queryKey: ["review-queue", uploadId],
    enabled: !!uploadId,
    queryFn: async (): Promise<Transaction[]> => {
      const { data } = await apiClient.get<Transaction[]>(`/transactions/review/${uploadId}`);
      return data;
    },
  });
}

interface CorrectTransactionParams {
  transactionId: string;
  category: string;
  rememberRule: boolean;
}

export function useCorrectTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transactionId,
      category,
      rememberRule,
    }: CorrectTransactionParams): Promise<Transaction> => {
      const { data } = await apiClient.patch<Transaction>(`/transactions/${transactionId}`, {
        category,
        remember_rule: rememberRule,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useConfirmReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (uploadId: string): Promise<void> => {
      await apiClient.post(`/transactions/confirm-review/${uploadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    },
  });
}
