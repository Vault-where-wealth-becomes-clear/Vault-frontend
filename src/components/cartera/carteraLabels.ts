import type { InstrumentoTipo } from "@/api/cartera.api";

export const TIPO_LABELS: Record<InstrumentoTipo, string> = {
  accion_local: "Acción local",
  cedear: "CEDEAR",
  bono_ars: "Bono ARS",
  bono_usd: "Bono USD",
  fci_ars: "FCI ARS",
  fci_usd: "FCI USD",
  lecap_boncap: "LECAP/BONCAP",
  on_ars: "ON ARS",
  on_usd: "ON USD",
  efectivo_comitente: "Efectivo",
  otro: "Otro",
};

export const NIVEL_LABELS: Record<1 | 2 | 3, string> = {
  1: "Solo snapshot de tenencias",
  2: "Snapshot + cuenta corriente",
  3: "Snapshot + cuenta corriente + renta financiera",
};
