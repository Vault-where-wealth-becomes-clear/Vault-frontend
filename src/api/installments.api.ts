import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface Installment {
  id: string;
  transaction_id: string;
  description: string;
  current_installment: number;
  total_installments: number;
  amount_per_installment: number;
  currency: "ARS" | "USD";
  next_due_date: string | null;
}

export function useInstallments() {
  return useQuery({
    queryKey: ["installments"],
    queryFn: async (): Promise<Installment[]> => {
      const { data } = await apiClient.get<Installment[]>("/installments");
      return data;
    },
  });
}

interface UpdateInstallmentParams {
  installmentId: string;
  amountPerInstallment?: number;
  totalInstallments?: number;
}

export function useUpdateInstallment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      installmentId,
      amountPerInstallment,
      totalInstallments,
    }: UpdateInstallmentParams): Promise<Installment> => {
      const { data } = await apiClient.patch<Installment>(`/installments/${installmentId}`, {
        amount_per_installment: amountPerInstallment,
        total_installments: totalInstallments,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installments"] });
    },
  });
}
