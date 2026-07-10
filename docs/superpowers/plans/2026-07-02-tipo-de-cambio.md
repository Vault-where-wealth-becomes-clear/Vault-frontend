# Tipo de Cambio (MEP) Auto-Fetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically fetch and cache the USD/ARS MEP exchange rate from a public API, so the "Cargar extracto" (Upload) screen always has a current TC MEP value pre-loaded and auto-declares it for the period on submit, without the user having to type it in manually — and make sure that once a rate is declared/redeclared, the backend never mixes ARS and USD amounts when computing per-account/per-period totals (each transaction's native currency is ground truth; the other currency is always derived through the MEP rate, never assumed 1:1 or overwritten from the wrong side).

**Architecture:** A new decoupled client-side service (`src/api/mepQuote.api.ts`) calls `dolarapi.com` first, falls back to `argentinadatos.com` on failure, and falls back to a `localStorage`-cached last-known value if both network calls fail. A `useMepQuote()` react-query hook wraps this with 1-hour `staleTime` and `initialData` seeded from the cache, so a fresh cache never triggers a network call, a stale cache is shown immediately while refreshing in the background, and a cold start with no cache/no network surfaces an explicit error without breaking the upload flow. The hook is warmed once at `AppLayout` mount (fires on app open) and consumed again in `UploadPage` (react-query dedupes by `queryKey`, so this is instant). `UploadPage` auto-fills the MEP field from the live quote and, on submit, auto-declares it via the existing `/exchange-rates` backend endpoint (unless a rate is already declared for that period), then proceeds with the upload — eliminating the previous "declaralo en Configuración" manual detour. Two existing ad-hoc duplicate implementations of this same fetch (`DashboardPage.tsx`, `ExchangeRateSettings.tsx`) are refactored to call the same shared function, so there is exactly one place that knows about `dolarapi.com`.

Separately (Tasks 7–8, in `Vault-backend`), this plan fixes two currency-mixing bugs in how totals get computed once a TC MEP is declared, found while investigating where the exchange rate is actually applied:

- `app/services/mep_service.py::recalculate_period` currently runs `amount_usd = amount_ars / mep_rate` for **every** transaction in a period regardless of its native `currency`. For a transaction whose native currency is USD (e.g. a `credit_card_usd` or `broker` account), `amount_ars` is the _derived_ side (computed at ingestion as `amount_usd * mep_rate_at_ingestion_time`) — recalculating `amount_usd` from it re-derives the dollar amount through two MEP conversions, silently drifting the true USD value every time the rate is redeclared. Because Task 4 makes the frontend call `recalculate` far more often (automatically, on almost every upload, instead of only when a user manually visits Settings), this bug would otherwise get triggered far more frequently once this plan ships.
- `app/services/dashboard_service.py::get_month_summary` only adds `cash`/`crypto` account balances to the USD total when the account's own `currency` is already `USD` — ARS-denominated cash/crypto balances are silently dropped from the total instead of being converted through the period's MEP rate.

**Tech Stack:** Frontend: React 18 + TypeScript + Vite + Electron, `@tanstack/react-query` v5, `zustand`, `axios`. No frontend test runner exists in this repo (no vitest/jest configured) — verification gates for each frontend task are `npm run typecheck` (fast, catches type errors) plus manual QA in the running dev server (`npm run dev`) for anything UI-visible, matching how this codebase currently verifies changes. Backend: FastAPI + SQLAlchemy async + Postgres, pytest with a real Postgres test database (`vault_test`) — Tasks 7–8 use real TDD against that database (start it with `docker compose up -d postgres` in `Vault-backend`, then `docker compose exec postgres createdb -U vault vault_test` once if it doesn't exist yet).

## Global Constraints

- No backend changes, no API key, no intermediate server — calls go straight from the Electron/browser client to `dolarapi.com` / `api.argentinadatos.com`, per the spec.
- Primary endpoint: `GET https://dolarapi.com/v1/dolares/bolsa` (single object, MEP/"bolsa" rate).
- Fallback endpoint: `GET https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa`.
- Per-call timeout: 5000ms (`AbortController`), do not hang the UI.
- Cache TTL: 1 hour. Cache key: `vault_mep_cache` in `localStorage` (matches existing `vault_*` naming convention used by `useTheme`, `vault_currency_display`, etc.).
- Normalized return type:
  ```ts
  type CotizacionFuente = "dolarapi" | "argentinadatos" | "cache";
  type CotizacionMEP = {
    compra: number;
    venta: number;
    fechaActualizacion: string; // ISO
    fuente: CotizacionFuente;
  };
  ```
- `fuente: "cache"` is only used when **both** live APIs failed and a stale cached value is being served as last resort (so the UI can show a "desactualizado" indicator). A cache hit that's still within the 1-hour TTL keeps its original `fuente` ("dolarapi" or "argentinadatos") since it isn't stale.
- If both APIs fail and there is no cache at all, the query must surface an explicit error state — never silently break the upload form.
- Service must stay swappable: all provider-specific fetch/parse logic lives in two small private functions (`fetchFromDolarApi`, `fetchFromArgentinaDatos`) behind the single public `getCotizacionMEP()` — no other file should ever call `fetch("https://dolarapi.com/...")` directly after this plan (Tasks 5–6 remove the two remaining direct calls).
- Currency rule for Tasks 7–8 (`Vault-backend`, a separate repo/branch checkout at `../Vault-backend`, also on a `tipo-de-cambio` branch): a `Transaction.currency` (or `Account.currency`) of `ARS` means `amount_ars`/`current_balance` is ground truth and the USD figure must always be _derived_ as `ars_value / mep_rate`; a currency of `USD` means the USD figure is ground truth and the ARS figure must always be _derived_ as `usd_value * mep_rate`. Never derive a value into its own ground-truth field, and never sum raw ARS and raw USD figures together without one of these conversions.

---

### Task 1: Add `formatDateTime` util

**Files:**

- Modify: `src/utils/formatDate.ts`

**Interfaces:**

- Produces: `formatDateTime(isoString: string): string` — used by Task 4 to render `fechaActualizacion`.

- [ ] **Step 1: Add the function**

Append to `src/utils/formatDate.ts`:

```ts
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/formatDate.ts
git commit -m "feat: add formatDateTime util for MEP quote timestamps"
```

---

### Task 2: Create the MEP quote service (`src/api/mepQuote.api.ts`)

**Files:**

- Create: `src/api/mepQuote.api.ts`

**Interfaces:**

- Consumes: nothing from other tasks (this is the foundation).
- Produces:
  - `type CotizacionFuente = "dolarapi" | "argentinadatos" | "cache"`
  - `interface CotizacionMEP { compra: number; venta: number; fechaActualizacion: string; fuente: CotizacionFuente }`
  - `getCotizacionMEP(): Promise<CotizacionMEP>` — consumed by Tasks 5 and 6.
  - `useMepQuote(): UseQueryResult<CotizacionMEP>` (from `@tanstack/react-query`) — consumed by Tasks 3 and 4.
  - `readMepCache(): { quote: CotizacionMEP; cachedAt: string } | null` — exported for the hook's `initialData`.
  - `MEP_CACHE_TTL_MS: number` — exported constant (1 hour in ms).

- [ ] **Step 1: Write the full file**

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, open the app, open devtools console, and run:

```js
await (await import("/src/api/mepQuote.api.ts")).getCotizacionMEP();
```

Expected: resolves to an object like `{ compra: ..., venta: ..., fechaActualizacion: "...", fuente: "dolarapi" }`. Then check Application → Local Storage for a `vault_mep_cache` key containing that value plus a `cachedAt` timestamp.

- [ ] **Step 4: Commit**

```bash
git add src/api/mepQuote.api.ts
git commit -m "feat: add decoupled MEP quote service with fallback and 1h cache"
```

---

### Task 3: Prefetch the quote at app startup

**Files:**

- Modify: `src/components/layout/AppLayout.tsx`

**Interfaces:**

- Consumes: `useMepQuote` from `@/api/mepQuote.api` (Task 2).

- [ ] **Step 1: Warm the query on mount**

Replace the full contents of `src/components/layout/AppLayout.tsx`:

```tsx
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useMepQuote } from "@/api/mepQuote.api";

export function AppLayout() {
  useMepQuote();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check**

Run: `npm run dev`, log in, and confirm in the Network tab that a request to `dolarapi.com/v1/dolares/bolsa` fires once right after the authenticated app shell mounts (not per-page).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AppLayout.tsx
git commit -m "feat: prefetch MEP quote when the app shell mounts"
```

---

### Task 4: Auto-fill and auto-declare MEP on the Upload page

**Files:**

- Modify: `src/pages/Upload/UploadPage.tsx`

**Interfaces:**

- Consumes: `useMepQuote` (Task 2), `formatDateTime` (Task 1), existing `useExchangeRates`/`useSetExchangeRate`/`useRecalculatePeriod` from `src/api/exchangeRates.api.ts`.

- [ ] **Step 1: Update imports**

Replace lines 1–6 of `src/pages/Upload/UploadPage.tsx`:

```tsx
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAccounts, type AccountType } from "@/api/accounts.api";
import { useSubmitUpload, useUploadStatus, useUploads, type UploadStatus } from "@/api/uploads.api";
import type { SkillModule } from "@/components/upload/ModuleSelector";
import { extractErrorMessage } from "@/utils/apiError";
```

with:

```tsx
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAccounts, type AccountType } from "@/api/accounts.api";
import { useSubmitUpload, useUploadStatus, useUploads, type UploadStatus } from "@/api/uploads.api";
import {
  useExchangeRates,
  useRecalculatePeriod,
  useSetExchangeRate,
} from "@/api/exchangeRates.api";
import { useMepQuote } from "@/api/mepQuote.api";
import type { SkillModule } from "@/components/upload/ModuleSelector";
import { extractErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/formatDate";
```

- [ ] **Step 2: Add MEP state and derived values**

Replace:

```tsx
export function UploadPage() {
  const { data: accounts, isLoading: isLoadingAccounts } = useAccounts();
  const { data: uploads } = useUploads();
  const submitUpload = useSubmitUpload();

  const [accountId, setAccountId] = useState("");
  const [periodStart, setPeriodStart] = useState(getMonthStart());
  const [periodEnd, setPeriodEnd] = useState(getMonthEnd());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

  const { data: activeStatus } = useUploadStatus(activeUploadId);
```

with:

```tsx
export function UploadPage() {
  const { data: accounts, isLoading: isLoadingAccounts } = useAccounts();
  const { data: uploads } = useUploads();
  const submitUpload = useSubmitUpload();
  const { data: exchangeRates } = useExchangeRates();
  const setExchangeRate = useSetExchangeRate();
  const recalculatePeriod = useRecalculatePeriod();
  const { data: mepQuote, isLoading: isLoadingMep, isError: isMepError } = useMepQuote();

  const [accountId, setAccountId] = useState("");
  const [periodStart, setPeriodStart] = useState(getMonthStart());
  const [periodEnd, setPeriodEnd] = useState(getMonthEnd());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [mepRateInput, setMepRateInput] = useState("");
  const [mepEditedByUser, setMepEditedByUser] = useState(false);

  const { data: activeStatus } = useUploadStatus(activeUploadId);

  const monthPrefix = periodStart.slice(0, 7);
  const declaredRate = exchangeRates?.find((r) => r.period_month.startsWith(monthPrefix));

  useEffect(() => {
    if (declaredRate || mepEditedByUser || !mepQuote) return;
    setMepRateInput(String(mepQuote.venta));
  }, [declaredRate, mepEditedByUser, mepQuote]);

  useEffect(() => {
    setMepEditedByUser(false);
  }, [monthPrefix]);
```

(`monthPrefix` / `.startsWith` mirrors the same period-matching pattern already used in `DashboardPage.tsx:102-104`.)

- [ ] **Step 3: Auto-declare the rate on submit**

Replace:

```tsx
const handleSubmit = async (event: FormEvent) => {
  event.preventDefault();
  if (!file || !accountId) return;
  setError(null);
  try {
    const uploadId = await submitUpload.mutateAsync({
      accountId,
      periodMonth: periodStart,
      file,
      requestedModules,
    });
    setActiveUploadId(uploadId);
    setFile(null);
  } catch (err) {
    setError(extractErrorMessage(err));
  }
};
```

with:

```tsx
const handleSubmit = async (event: FormEvent) => {
  event.preventDefault();
  if (!file || !accountId) return;
  setError(null);
  try {
    if (!declaredRate) {
      const rateValue = Number(mepRateInput);
      if (rateValue > 0) {
        await setExchangeRate.mutateAsync({ periodMonth: periodStart, mepRate: rateValue });
        await recalculatePeriod.mutateAsync(periodStart);
      }
    }
    const uploadId = await submitUpload.mutateAsync({
      accountId,
      periodMonth: periodStart,
      file,
      requestedModules,
    });
    setActiveUploadId(uploadId);
    setFile(null);
  } catch (err) {
    setError(extractErrorMessage(err));
  }
};
```

- [ ] **Step 4: Render the MEP field**

Insert this new block right before the existing "Archivo" file-input `<div>` (i.e. right after the closing `</div>` of the "Desde"/"Hasta" `grid grid-cols-2 gap-3` block, still inside the `<form>`):

```tsx
<div className="rounded-vault border border-vault-border bg-vault-s2 dark:bg-[#21262d] px-3.5 py-2.5 text-sm">
  {declaredRate ? (
    <div className="flex items-center justify-between">
      <span className="text-vault-muted2 dark:text-[#8b949e]">TC MEP declarado</span>
      <span className="tabular-nums font-medium text-vault-text dark:text-[#e6edf3]">
        ${declaredRate.mep_rate.toFixed(2)}
      </span>
    </div>
  ) : isLoadingMep ? (
    <div className="h-4 w-40 animate-pulse rounded bg-vault-border dark:bg-[#30363d]" />
  ) : isMepError && !mepQuote ? (
    <p className="text-xs text-vault-yellow">
      No se pudo obtener el TC MEP automáticamente. Ingresalo manualmente abajo.
    </p>
  ) : (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
          TC MEP (auto)
          {mepQuote?.fuente === "cache" && (
            <span
              title="Valor desactualizado — no se pudo refrescar"
              className="ml-1.5 text-vault-yellow"
            >
              ⚠ desactualizado
            </span>
          )}
        </label>
        {mepQuote && (
          <span className="text-xs text-vault-muted2 dark:text-[#8b949e]">
            Actualizado: {formatDateTime(mepQuote.fechaActualizacion)}
          </span>
        )}
      </div>
      <input
        type="number"
        step="0.01"
        value={mepRateInput}
        onChange={(e) => {
          setMepRateInput(e.target.value);
          setMepEditedByUser(true);
        }}
        placeholder="1250.00"
        className="input-vault"
      />
    </div>
  )}
</div>
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Manual QA**

Run: `npm run dev`, go to "Cargar extracto":

1. Confirm the MEP field shows a pre-filled numeric value with an "Actualizado: dd/mm/yyyy hh:mm" timestamp within a second or two of the page loading (should already be warm from `AppLayout`'s prefetch — no long spinner).
2. Edit the value manually and confirm it doesn't get overwritten while typing.
3. Change the "Desde" date to a period that already has a declared rate (via Settings) and confirm the field switches to the read-only "TC MEP declarado" view.
4. Turn off network (devtools offline mode) and reload; confirm either a cached value with the "desactualizado" badge shows, or (with `localStorage` cleared too) the explicit "No se pudo obtener..." message shows and the rest of the form still works (file picker, submit still enabled).
5. Submit an upload for a period with no declared rate and confirm (via Settings page or Network tab) that a `POST /exchange-rates` fired automatically before the upload request.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Upload/UploadPage.tsx
git commit -m "feat: auto-fill and auto-declare MEP rate on the upload screen"
```

---

### Task 5: Refactor `DashboardPage.tsx` to use the shared service

**Files:**

- Modify: `src/pages/Dashboard/DashboardPage.tsx`

**Interfaces:**

- Consumes: `getCotizacionMEP` from `@/api/mepQuote.api` (Task 2).

- [ ] **Step 1: Add the import**

Add near the other `@/api/*` imports (after the `exchangeRates.api` import line):

```tsx
import { getCotizacionMEP } from "@/api/mepQuote.api";
```

- [ ] **Step 2: Replace the inline fetch**

Replace:

```tsx
const handleFetchLiveMep = async () => {
  setMepFetching(true);
  setLiveMep(null);
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/mep");
    if (!res.ok) throw new Error("HTTP");
    const json = await res.json();
    const venta = Number(json.venta);
    if (!venta || isNaN(venta)) throw new Error("invalid");
    setLiveMep(venta);
  } catch {
    // silently fail — leave liveMep null
  } finally {
    setMepFetching(false);
  }
};
```

with:

```tsx
const handleFetchLiveMep = async () => {
  setMepFetching(true);
  setLiveMep(null);
  try {
    const quote = await getCotizacionMEP();
    setLiveMep(quote.venta);
  } catch {
    // silently fail — leave liveMep null
  } finally {
    setMepFetching(false);
  }
};
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual QA**

Run: `npm run dev`, go to Dashboard with `currencyDisplay` set to ARS and no rate declared for the current period, click "Obtener TC MEP actual", confirm it still populates and "Guardar y usar" still saves it (same behavior as before, now backed by the shared service with fallback+timeout).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard/DashboardPage.tsx
git commit -m "refactor: dashboard MEP fetch uses shared mepQuote service"
```

---

### Task 6: Refactor `ExchangeRateSettings.tsx` to use the shared service

**Files:**

- Modify: `src/pages/Settings/ExchangeRateSettings.tsx`

**Interfaces:**

- Consumes: `getCotizacionMEP` from `@/api/mepQuote.api` (Task 2).

- [ ] **Step 1: Add the import**

Add after the existing `@/api/exchangeRates.api` import:

```tsx
import { getCotizacionMEP } from "@/api/mepQuote.api";
```

- [ ] **Step 2: Replace the inline fetch**

Replace:

```tsx
const handleAutoFetch = async () => {
  setAutoFetching(true);
  setAutoError(null);
  setAutoResult(null);
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/mep");
    if (!res.ok) throw new Error("HTTP error");
    const json = await res.json();
    const venta = Number(json.venta);
    if (!venta || isNaN(venta)) throw new Error("Valor inválido");
    const fetchedAt = new Date().toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    setAutoResult({ value: venta, fetchedAt });
    setMepRate(String(venta));
  } catch {
    setAutoError("No se pudo obtener el TC MEP. Ingresalo manualmente.");
  } finally {
    setAutoFetching(false);
  }
};
```

with:

```tsx
const handleAutoFetch = async () => {
  setAutoFetching(true);
  setAutoError(null);
  setAutoResult(null);
  try {
    const quote = await getCotizacionMEP();
    const fetchedAt = new Date().toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    setAutoResult({ value: quote.venta, fetchedAt });
    setMepRate(String(quote.venta));
  } catch {
    setAutoError("No se pudo obtener el TC MEP. Ingresalo manualmente.");
  } finally {
    setAutoFetching(false);
  }
};
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual QA**

Run: `npm run dev`, go to Profile → "Tipo de cambio MEP", click "Obtener MEP actual", confirm it still populates the period form the same way as before.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings/ExchangeRateSettings.tsx
git commit -m "refactor: exchange rate settings auto-fetch uses shared mepQuote service"
```

---

### Task 7: Fix `recalculate_period` currency-mixing bug (`Vault-backend`)

**Files (in the `Vault-backend` repo, `tipo-de-cambio` branch):**

- Modify: `app/services/mep_service.py`
- Test: `tests/test_mep_service.py` (create)

**Interfaces:**

- Consumes: `Transaction`, `Upload` models; `CurrencyType` from `app.models.enums`; the `db` async-session pytest fixture from `tests/conftest.py`.
- Produces: `recalculate_period(db, period_month, mep_rate) -> int` keeps its existing signature and return value (rows updated), but is now currency-safe — Task 8 does not depend on this function directly, but both fix the same class of bug.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_mep_service.py`:

```python
import uuid
from datetime import date
from decimal import Decimal

from app.models.account import Account
from app.models.enums import AccountType, CurrencyType
from app.models.transaction import Transaction
from app.models.upload import Upload
from app.models.user import User
from app.services.mep_service import recalculate_period


async def _make_user_account_upload(db, account_currency: CurrencyType) -> tuple:
    user = User(email=f"{uuid.uuid4()}@test.com", cognito_sub=str(uuid.uuid4()))
    db.add(user)
    await db.flush()

    account = Account(
        user_id=user.id,
        name="Test account",
        account_type=(
            AccountType.checking_usd
            if account_currency == CurrencyType.USD
            else AccountType.checking_ars
        ),
        currency=account_currency,
    )
    db.add(account)
    await db.flush()

    upload = Upload(
        user_id=user.id,
        account_id=account.id,
        s3_key_pdf="test.pdf",
        period_month=date(2026, 7, 1),
    )
    db.add(upload)
    await db.flush()

    return user.id, account.id, upload.id


async def test_recalculate_period_does_not_corrupt_usd_native_transactions(db):
    user_id, account_id, upload_id = await _make_user_account_upload(db, CurrencyType.USD)

    txn = Transaction(
        user_id=user_id,
        account_id=account_id,
        upload_id=upload_id,
        date=date(2026, 7, 5),
        description="Compra en dolares",
        currency=CurrencyType.USD,
        amount_usd=Decimal("100.0000"),
        amount_ars=Decimal("100.0000") * Decimal("1000"),  # ingresado con TC viejo (1000)
    )
    db.add(txn)
    await db.flush()

    await recalculate_period(db, date(2026, 7, 1), Decimal("1300"))
    await db.refresh(txn)

    # El monto en USD es el dato real del extracto: no debe cambiar al redeclarar el TC.
    assert txn.amount_usd == Decimal("100.0000")
    # El equivalente en ARS si debe recalcularse con el nuevo TC.
    assert txn.amount_ars == Decimal("130000.00")


async def test_recalculate_period_updates_usd_for_ars_native_transactions(db):
    user_id, account_id, upload_id = await _make_user_account_upload(db, CurrencyType.ARS)

    txn = Transaction(
        user_id=user_id,
        account_id=account_id,
        upload_id=upload_id,
        date=date(2026, 7, 5),
        description="Compra en pesos",
        currency=CurrencyType.ARS,
        amount_ars=Decimal("130000.00"),
        amount_usd=Decimal("100.0000"),  # ingresado con TC viejo (1300)
    )
    db.add(txn)
    await db.flush()

    await recalculate_period(db, date(2026, 7, 1), Decimal("1000"))
    await db.refresh(txn)

    # El monto en ARS es el dato real del extracto: no debe cambiar al redeclarar el TC.
    assert txn.amount_ars == Decimal("130000.00")
    # El equivalente en USD si debe recalcularse con el nuevo TC.
    assert txn.amount_usd == Decimal("130.0000")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `Vault-backend`, with the test Postgres up):

```bash
source .venv/bin/activate && python -m pytest tests/test_mep_service.py -v
```

Expected: `test_recalculate_period_does_not_corrupt_usd_native_transactions` FAILS. Today's single UPDATE (`amount_usd = amount_ars / mep_rate`, no currency filter) runs against this row too: it overwrites `amount_usd` to `100000.00 / 1300 = 76.9231`, corrupting the real USD ground-truth value of `100.0000`, and it never touches `amount_ars` at all, leaving it at the stale `100000.00` instead of the expected recalculated `130000.00`. Both assertions fail.
`test_recalculate_period_updates_usd_for_ars_native_transactions` PASSES even against the current code (an ARS-native row happens to be handled correctly by today's single UPDATE) — that's expected; it's a regression guard for the fix in Step 3, not a repro of this bug.

- [ ] **Step 3: Fix `recalculate_period`**

Replace the full contents of `app/services/mep_service.py`:

```python
from datetime import date
from decimal import Decimal

from sqlalchemy import extract, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import CurrencyType
from app.models.transaction import Transaction
from app.models.upload import Upload


async def recalculate_period(db: AsyncSession, period_month: date, mep_rate: Decimal) -> int:
    """Recalcula el lado derivado de amount_ars/amount_usd usando el TC MEP dado.

    La moneda nativa de cada transaccion (Transaction.currency) es el dato real
    del extracto y nunca se sobreescribe; solo se recalcula el lado convertido,
    para no mezclar pesos y dolares al redeclarar el TC de un periodo.

    Solo afecta el periodo indicado, nunca recalcula retroactivamente otros periodos.
    """
    upload_ids = await db.scalars(
        select(Upload.id).where(
            extract("year", Upload.period_month) == period_month.year,
            extract("month", Upload.period_month) == period_month.month,
        )
    )
    upload_ids = list(upload_ids)
    if not upload_ids:
        return 0

    ars_result = await db.execute(
        update(Transaction)
        .where(
            Transaction.upload_id.in_(upload_ids),
            Transaction.currency == CurrencyType.ARS,
        )
        .values(amount_usd=Transaction.amount_ars / mep_rate)
    )
    usd_result = await db.execute(
        update(Transaction)
        .where(
            Transaction.upload_id.in_(upload_ids),
            Transaction.currency == CurrencyType.USD,
        )
        .values(amount_ars=Transaction.amount_usd * mep_rate)
    )
    return (ars_result.rowcount or 0) + (usd_result.rowcount or 0)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
python -m pytest tests/test_mep_service.py -v
```

Expected: both tests PASS.

- [ ] **Step 5: Run the full backend test suite to check for regressions**

Run:

```bash
python -m pytest -v
```

Expected: all tests pass (no regressions in `test_health.py` or `tests/test_lambda`).

- [ ] **Step 6: Commit**

```bash
git add app/services/mep_service.py tests/test_mep_service.py
git commit -m "fix: recalculate_period no longer mixes ARS and USD ground-truth amounts"
```

---

### Task 8: Convert ARS cash/crypto balances into the dashboard USD total (`Vault-backend`)

**Files (in the `Vault-backend` repo, `tipo-de-cambio` branch):**

- Modify: `app/services/dashboard_service.py`
- Test: `tests/test_dashboard_service.py` (create)

**Interfaces:**

- Consumes: `Account`, `ExchangeRate` models; `AccountType`, `CurrencyType` from `app.models.enums`; the `db` fixture.
- Produces: `get_month_summary(db, user_id, period_month) -> MonthSummary` keeps its existing signature/fields (`total_usd`, `savings`, `by_category`).

- [ ] **Step 1: Write the failing tests**

Create `tests/test_dashboard_service.py`:

```python
import uuid
from datetime import date
from decimal import Decimal

from app.models.account import Account
from app.models.enums import AccountType, CurrencyType
from app.models.exchange_rate import ExchangeRate
from app.models.user import User
from app.services.dashboard_service import get_month_summary


async def _make_user(db) -> uuid.UUID:
    user = User(email=f"{uuid.uuid4()}@test.com", cognito_sub=str(uuid.uuid4()))
    db.add(user)
    await db.flush()
    return user.id


async def test_ars_cash_balance_is_converted_via_mep_rate(db):
    user_id = await _make_user(db)
    db.add(
        Account(
            user_id=user_id,
            name="Efectivo pesos",
            account_type=AccountType.cash,
            currency=CurrencyType.ARS,
            current_balance=Decimal("130000.00"),
        )
    )
    db.add(ExchangeRate(period_month=date(2026, 7, 1), mep_rate=Decimal("1300")))
    await db.flush()

    summary = await get_month_summary(db, user_id, date(2026, 7, 1))

    assert summary.total_usd == Decimal("100")


async def test_ars_cash_balance_is_skipped_without_a_declared_rate(db):
    user_id = await _make_user(db)
    db.add(
        Account(
            user_id=user_id,
            name="Efectivo pesos",
            account_type=AccountType.cash,
            currency=CurrencyType.ARS,
            current_balance=Decimal("130000.00"),
        )
    )
    await db.flush()

    # Sin TC declarado para el periodo no se puede convertir de forma segura:
    # el saldo se omite (no se mezcla 1 ARS == 1 USD) en vez de asumir un TC 1:1.
    summary = await get_month_summary(db, user_id, date(2026, 7, 1))

    assert summary.total_usd == Decimal("0")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
python -m pytest tests/test_dashboard_service.py -v
```

Expected: `test_ars_cash_balance_is_converted_via_mep_rate` FAILS with `total_usd == Decimal("0")` (today's `cash_rows` query filters `Account.currency == CurrencyType.USD`, so the ARS row above is never added).

- [ ] **Step 3: Fix `get_month_summary`**

In `app/services/dashboard_service.py`, add the import:

```python
from app.models.exchange_rate import ExchangeRate
```

Then replace this block (the `cash_rows` section, currently the last part of the function before `return`):

```python
    # Incluir saldo de cuentas que no generan transacciones (efectivo y cripto en USD)
    cash_rows = await db.execute(
        select(Account.current_balance, Account.currency).where(
            Account.user_id == user_id,
            Account.is_active.is_(True),
            Account.account_type.in_([AccountType.cash, AccountType.crypto]),
            Account.currency == CurrencyType.USD,
        )
    )
    for balance, _ in cash_rows:
        total_usd += balance or Decimal("0")

    return MonthSummary(total_usd=total_usd, savings=savings, by_category=by_category)
```

with:

```python
    # Incluir saldo de cuentas que no generan transacciones (efectivo y cripto),
    # convirtiendo las que estan en ARS via el TC MEP del periodo en vez de
    # mezclarlas sin convertir o excluirlas.
    mep_rate = await db.scalar(
        select(ExchangeRate.mep_rate).where(
            extract("year", ExchangeRate.period_month) == period_month.year,
            extract("month", ExchangeRate.period_month) == period_month.month,
        )
    )
    cash_rows = await db.execute(
        select(Account.current_balance, Account.currency).where(
            Account.user_id == user_id,
            Account.is_active.is_(True),
            Account.account_type.in_([AccountType.cash, AccountType.crypto]),
        )
    )
    for balance, currency in cash_rows:
        balance = balance or Decimal("0")
        if currency == CurrencyType.USD:
            total_usd += balance
        elif mep_rate:
            total_usd += balance / mep_rate
        # Si es ARS y no hay TC declarado para el periodo, se omite: no se puede
        # convertir de forma segura, y sumarlo sin convertir mezclaria las monedas.

    return MonthSummary(total_usd=total_usd, savings=savings, by_category=by_category)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
python -m pytest tests/test_dashboard_service.py -v
```

Expected: both tests PASS.

- [ ] **Step 5: Run the full backend test suite to check for regressions**

Run:

```bash
python -m pytest -v
```

Expected: all tests pass, including `tests/test_mep_service.py` from Task 7.

- [ ] **Step 6: Commit**

```bash
git add app/services/dashboard_service.py tests/test_dashboard_service.py
git commit -m "fix: convert ARS cash/crypto balances via MEP rate instead of excluding them"
```

---

### Task 9: Full verification pass (both repos)

**Files:** none (verification only)

- [ ] **Step 1: Frontend — full typecheck + lint + build**

Run (in `Vault-frontend`):

```bash
npm run typecheck && npm run lint && npm run build
```

Expected: all three pass with no errors.

- [ ] **Step 2: Frontend — grep for any remaining direct calls to the public APIs**

Run:

```bash
grep -rn "dolarapi.com\|argentinadatos.com" src/ --include="*.tsx" --include="*.ts" | grep -v "src/api/mepQuote.api.ts"
```

Expected: no output (confirms `mepQuote.api.ts` is now the single place that knows about these providers).

- [ ] **Step 3: Backend — full test suite + ruff**

Run (in `Vault-backend`, test Postgres up):

```bash
source .venv/bin/activate && python -m pytest -v && ruff check app tests worker
```

Expected: all tests pass, no lint errors.

- [ ] **Step 4: End-to-end manual QA in the running app**

Run `npm run dev` (or `npm run dist:mac`/`dist:win` if testing the packaged Electron app) in `Vault-frontend`, pointed at a locally running backend (`Vault-backend`), and walk through:

1. Fresh app open (clear `localStorage` first) → open "Cargar extracto" → MEP field goes from skeleton to a live value within ~5s.
2. Quit and reopen the app within an hour → MEP field shows the same value instantly, with zero network requests to `dolarapi.com` (check Network tab).
3. Wait past the 1-hour mark (or manually edit the `cachedAt` timestamp in `localStorage` to be >1h old) → reopen → value shows immediately from cache, then a background request refreshes it silently.
4. Full offline test (devtools offline + cleared `localStorage`) → MEP field shows the explicit error message, rest of the upload form still works, submit still succeeds without an MEP-related crash.
5. Upload an extracto for a fresh period → confirm no "Falta declarar el TC MEP" warning appears afterward (since it was auto-declared before the upload request fired).
6. Create one ARS account and one USD account, upload extractos for both in the same period, then redeclare/change the TC MEP for that period (e.g. re-upload another extracto, which re-triggers `recalculate`) → confirm in the Review/Accounts view that the USD account's transaction amounts in USD terms stay exactly what the original extracto said (they must not drift each time the rate changes), while the ARS account's USD-equivalent totals do update with the new rate.

- [ ] **Step 5: Commit (only if Step 4 QA uncovered fixes)**

If any fixes were needed during manual QA, commit them individually with descriptive messages before considering the plan complete.
