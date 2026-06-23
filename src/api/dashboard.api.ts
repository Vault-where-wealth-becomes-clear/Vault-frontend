import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface DashboardSummary {
  period: string;
  total_usd: number;
  variation_pct: number;
  insights: string[];
}

export interface BreakdownItem {
  category: string;
  amount_ars: number;
  amount_usd: number | null;
  pct_of_total: number;
}

export interface EvolutionPoint {
  month: string;
  total_usd: number;
}

export function useDashboard(period?: string) {
  return useQuery({
    queryKey: ["dashboard", period],
    queryFn: async (): Promise<DashboardSummary> => {
      const params = period ? `?period=${period}` : "";
      const { data } = await apiClient.get<DashboardSummary>(`/dashboard${params}`);
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useDashboardBreakdown(period?: string) {
  return useQuery({
    queryKey: ["dashboard-breakdown", period],
    queryFn: async (): Promise<BreakdownItem[]> => {
      const params = period ? `?period=${period}` : "";
      const { data } = await apiClient.get<{ period: string; items: BreakdownItem[] }>(
        `/dashboard/breakdown${params}`
      );
      return data.items;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useDashboardEvolution() {
  return useQuery({
    queryKey: ["dashboard-evolution"],
    queryFn: async (): Promise<EvolutionPoint[]> => {
      const { data } = await apiClient.get<{ points: EvolutionPoint[] }>("/dashboard/evolution");
      return data.points;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export interface FullDashboard {
  period: string;
  flujo_mensual: Record<string, unknown> | null;
  categorizacion: Record<string, unknown> | null;
  flujo_periodo: Record<string, unknown> | null;
  cartera: Record<string, unknown> | null;
  tablero_general: Record<string, unknown> | null;
  proyeccion: Record<string, unknown> | null;
  compromisos: Record<string, unknown> | null;
  insights: string[];
}

export function useFullDashboard(period?: string) {
  return useQuery({
    queryKey: ["dashboard-full", period],
    queryFn: async (): Promise<FullDashboard | null> => {
      const params = period ? `?period=${period}` : "";
      try {
        const { data } = await apiClient.get<FullDashboard>(`/dashboard/full${params}`);
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 5,
  });
}
