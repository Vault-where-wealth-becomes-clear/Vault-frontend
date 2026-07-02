import { useQuery } from "@tanstack/react-query";

export type CotizacionFuente = "dolarapi" | "argentinadatos" | "cache";

export interface CotizacionMEP {
  compra: number;
  venta: number;
  fechaActualizacion: string;
  fuente: CotizacionFuente;
}

interface MepCacheEntry {
  quote: CotizacionMEP;
  cachedAt: string;
}

const DOLARAPI_URL = "https://dolarapi.com/v1/dolares/bolsa";
const ARGENTINADATOS_URL = "https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa";
const FETCH_TIMEOUT_MS = 5000;
const CACHE_KEY = "vault_mep_cache";
export const MEP_CACHE_TTL_MS = 60 * 60 * 1000;

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} desde ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

interface DolarApiBolsaResponse {
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

interface ArgentinaDatosBolsaResponse {
  compra: number;
  venta: number;
  fecha: string;
}

async function fetchFromDolarApi(): Promise<CotizacionMEP> {
  const json = await fetchJson<DolarApiBolsaResponse>(DOLARAPI_URL);
  return {
    compra: Number(json.compra),
    venta: Number(json.venta),
    fechaActualizacion: json.fechaActualizacion,
    fuente: "dolarapi",
  };
}

async function fetchFromArgentinaDatos(): Promise<CotizacionMEP> {
  const json = await fetchJson<ArgentinaDatosBolsaResponse>(ARGENTINADATOS_URL);
  return {
    compra: Number(json.compra),
    venta: Number(json.venta),
    fechaActualizacion: new Date(json.fecha).toISOString(),
    fuente: "argentinadatos",
  };
}

export function readMepCache(): MepCacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MepCacheEntry;
  } catch {
    return null;
  }
}

function writeMepCache(quote: CotizacionMEP): void {
  const entry: MepCacheEntry = { quote, cachedAt: new Date().toISOString() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
}

export function isMepCacheFresh(entry: MepCacheEntry): boolean {
  return Date.now() - new Date(entry.cachedAt).getTime() < MEP_CACHE_TTL_MS;
}

export async function getCotizacionMEP(): Promise<CotizacionMEP> {
  const cached = readMepCache();
  if (cached && isMepCacheFresh(cached)) {
    return cached.quote;
  }

  try {
    const quote = await fetchFromDolarApi();
    writeMepCache(quote);
    return quote;
  } catch {
    try {
      const quote = await fetchFromArgentinaDatos();
      writeMepCache(quote);
      return quote;
    } catch {
      if (cached) {
        return { ...cached.quote, fuente: "cache" };
      }
      throw new Error("No se pudo obtener el TC MEP y no hay valor en caché.");
    }
  }
}

export function useMepQuote() {
  const cached = readMepCache();
  return useQuery({
    queryKey: ["mep-quote"],
    queryFn: getCotizacionMEP,
    staleTime: MEP_CACHE_TTL_MS,
    initialData: cached?.quote,
    initialDataUpdatedAt: cached ? new Date(cached.cachedAt).getTime() : undefined,
    retry: 1,
  });
}
