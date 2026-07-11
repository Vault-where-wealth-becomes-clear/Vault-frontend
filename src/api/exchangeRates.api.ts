import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface ExchangeRate {
  id: string;
  period_month: string;
  mep_rate: number;
  source: "manual" | "api";
  set_at: string;
}

export function useExchangeRates() {
  return useQuery({
    queryKey: ["exchange-rates"],
    queryFn: async (): Promise<ExchangeRate[]> => {
      const { data } = await apiClient.get<ExchangeRate[]>("/exchange-rates");
      return data;
    },
  });
}

interface SetExchangeRateParams {
  periodMonth: string;
  mepRate: number;
  source?: "manual" | "api";
}

export function useSetExchangeRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      periodMonth,
      mepRate,
      source,
    }: SetExchangeRateParams): Promise<ExchangeRate> => {
      const { data } = await apiClient.post<ExchangeRate>("/exchange-rates", {
        period_month: periodMonth,
        mep_rate: mepRate,
        source: source ?? "manual",
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
  });
}

export function useRecalculatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (periodMonth: string): Promise<{ updated: number }> => {
      const { data } = await apiClient.post<{ updated: number }>(
        `/exchange-rates/${periodMonth}/recalculate`
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
    },
  });
}
