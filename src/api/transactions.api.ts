import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export const STANDARD_CATEGORIES = [
  // Gastos
  "Supermercado",
  "Restaurantes",
  "Transporte",
  "Salud",
  "Indumentaria",
  "Tecnología",
  "Entretenimiento",
  "Servicios",
  "Educación",
  "Viajes",
  "Suscripciones",
  "Impuestos",
  "Varios",
  // Ingresos y movimientos
  "Ingreso operativo",
  "Rendimiento",
  "Cambio de moneda",
  "Pago deuda",
  "Transferencia interna",
  // Transitorio
  "Reintegro",
  "Sin categoría",
];

export interface Transaction {
  id: string;
  upload_id: string | null;
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
  current_installment: number | null;
  total_installments: number | null;
}

interface TransactionFilters {
  accountId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  enabled?: boolean;
}

export function useTransactions(filters: TransactionFilters = {}) {
  const { enabled = true, ...queryFilters } = filters;
  return useQuery({
    queryKey: ["transactions", queryFilters],
    enabled,
    queryFn: async (): Promise<Transaction[]> => {
      const { data } = await apiClient.get<Transaction[]>("/transactions", {
        params: {
          account_id: queryFilters.accountId,
          category: queryFilters.category,
          date_from: queryFilters.dateFrom,
          date_to: queryFilters.dateTo,
        },
      });
      return data;
    },
  });
}

export function useUploadTransactions(uploadId: string | null) {
  return useQuery({
    queryKey: ["transactions", "upload", uploadId],
    enabled: !!uploadId,
    queryFn: async (): Promise<Transaction[]> => {
      const { data } = await apiClient.get<Transaction[]>("/transactions", {
        params: { upload_id: uploadId },
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

export interface ManualTransactionCreate {
  account_id: string;
  date: string;
  description: string;
  amount: number;
  currency: "ARS" | "USD";
  category: string | null;
  transaction_type: "ingreso" | "egreso";
}

export function useCreateManualTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: ManualTransactionCreate): Promise<Transaction> => {
      const { data } = await apiClient.post<Transaction>("/transactions/manual", body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-breakdown"] });
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
