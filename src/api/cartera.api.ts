import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export type InstrumentoTipo =
  | "accion_local"
  | "cedear"
  | "bono_ars"
  | "bono_usd"
  | "fci_ars"
  | "fci_usd"
  | "lecap_boncap"
  | "on_ars"
  | "on_usd"
  | "efectivo_comitente"
  | "otro";

export interface CarteraPosicion {
  instrumento: string;
  tipo: InstrumentoTipo;
  moneda: "ARS" | "USD";
  cantidad: number;
  precio_cierre: number;
  valor_moneda: number;
  valor_base_ars: number;
  pct_cartera: number;
  cpp: number | null;
  resultado_realizado_ars: number | null;
  rendimiento_pct: number | null;
}

export interface DeltaCarteraMes {
  revaluacion_mercado_ars: number;
  compras_netas_ars: number;
  ventas_netas_ars: number;
  rentas_cobradas_ars: number;
}

export interface CarteraEvolucionPoint {
  month: string;
  nivel_detectado: 1 | 2 | 3;
  valor_base_ars: number;
  delta_ars: number | null;
  delta_pct: number | null;
  composicion_por_tipo: Record<string, number>;
}

export interface AccountCartera {
  month: string;
  nivel_detectado: 1 | 2 | 3;
  posiciones: CarteraPosicion[];
  rendimientos_netos_ars: number | null;
  retenciones_ars: number | null;
  delta_cartera_mes: DeltaCarteraMes | null;
  evolucion: CarteraEvolucionPoint[];
  composicion_por_tipo: Record<string, number>;
  alertas: string[];
  insights: string[];
}

/** `period` opcional en formato "YYYY-MM" — ancla la ventana a ese mes o antes. */
export function useAccountCartera(accountId: string | undefined, months = 6, period?: string) {
  return useQuery({
    queryKey: ["account-cartera", accountId, months, period],
    queryFn: async (): Promise<AccountCartera | null> => {
      const params = new URLSearchParams({ months: String(months) });
      if (period) params.set("period", period);
      const { data } = await apiClient.get<AccountCartera | null>(
        `/accounts/${accountId}/cartera?${params.toString()}`
      );
      return data;
    },
    enabled: !!accountId,
    staleTime: 1000 * 60 * 5,
  });
}
