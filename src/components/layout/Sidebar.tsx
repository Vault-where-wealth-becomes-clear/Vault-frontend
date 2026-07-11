import { useState, useMemo, useEffect, useRef } from "react";
import { NavLink, Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import { logout } from "@/api/auth.api";
import { useAccounts } from "@/api/accounts.api";
import { useUploads } from "@/api/uploads.api";
import { PLAN_LABELS } from "@/utils/planLabels";
import { formatPeriod } from "@/utils/formatDate";
import { useTheme } from "@/hooks/useTheme";
import vaultLogo from "@/assets/vault-logo.png";

const navLinkClass = (isActive: boolean) =>
  `mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-normal transition-colors ${
    isActive
      ? "bg-[#e3ecfc] text-[#1e3a8a] dark:bg-[#24365f] dark:text-[#93c5fd]"
      : "text-vault-muted2 dark:text-[#b9c2cc] hover:bg-[#e9edf3] hover:text-vault-text dark:hover:bg-[#505862] dark:hover:text-[#e6eaf0]"
  }`;

const menuItemClass =
  "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] text-vault-muted2 dark:text-[#b9c2cc] hover:bg-[#e9edf3] hover:text-vault-text dark:hover:bg-[#505862] transition-colors";

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const { data: accounts } = useAccounts();
  const { data: uploads } = useUploads();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [monthsOpen, setMonthsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const footerRef = useRef<HTMLDivElement>(null);

  const groupedEntities = useMemo(() => {
    const seen = new Set<string>();
    const keys: string[] = [];
    (accounts ?? []).forEach((account) => {
      const key = account.institution || "Sin entidad";
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    });
    return keys;
  }, [accounts]);

  // Meses con al menos un extracto procesado, más reciente primero — para el
  // desplegable de "Mes a mes" en el sidebar.
  const monthsWithData = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    (uploads ?? [])
      .filter((u) => u.status === "done")
      .sort((a, b) => b.period_month.localeCompare(a.period_month))
      .forEach((u) => {
        const m = u.period_month.slice(0, 7);
        if (!seen.has(m)) {
          seen.add(m);
          ordered.push(m);
        }
      });
    return ordered;
  }, [uploads]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  return (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col border-r border-vault-border bg-vault-s2 dark:bg-[#505862] dark:border-[#68727f]">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-2">
          <img src={vaultLogo} alt="Vault" className="h-7 w-7 rounded-lg" />
          <span className="font-semibold text-vault-text dark:text-[#e6eaf0]">Vault</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <div className="section-label mb-2 px-3 dark:text-[#7a8390]">Principal</div>

        <NavLink to="/dashboard" className={({ isActive }) => navLinkClass(isActive)}>
          <span className="w-4 text-center">▤</span>
          Tablero
        </NavLink>

        {/* Mes a mes con desplegable de períodos */}
        <div className="mb-0.5">
          <div className="flex items-center">
            <NavLink
              to="/monthly"
              className={({ isActive }) =>
                `flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-normal transition-colors ${
                  isActive
                    ? "bg-[#e3ecfc] text-[#1e3a8a] dark:bg-[#24365f] dark:text-[#93c5fd]"
                    : "text-vault-muted2 dark:text-[#b9c2cc] hover:bg-[#e9edf3] hover:text-vault-text dark:hover:bg-[#505862] dark:hover:text-[#e6eaf0]"
                }`
              }
            >
              <span className="w-4 text-center">◫</span>
              Mes a mes
            </NavLink>
            <button
              type="button"
              onClick={() => setMonthsOpen((o) => !o)}
              className="ml-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-base text-vault-muted2 dark:text-[#99a3b0] transition-colors hover:bg-[#e9edf3] hover:text-vault-text"
              aria-label={monthsOpen ? "Colapsar meses" : "Expandir meses"}
            >
              <span
                className="inline-block leading-none transition-transform duration-200"
                style={{ transform: monthsOpen ? "rotate(90deg)" : "rotate(0deg)" }}
              >
                ›
              </span>
            </button>
          </div>

          {monthsOpen && (
            <div className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-vault-border dark:border-[#68727f] pl-2">
              {monthsWithData.length === 0 ? (
                <p className="px-2 py-1.5 text-[12px] text-vault-muted2 dark:text-[#99a3b0]">
                  Sin extractos aún
                </p>
              ) : (
                monthsWithData.map((month) => (
                  <Link
                    key={month}
                    to={`/monthly?period=${month}`}
                    onClick={() => setSelectedMonth(month)}
                    className={`truncate rounded-md px-2 py-1.5 text-[12px] capitalize transition-colors ${
                      selectedMonth === month
                        ? "bg-[#e3ecfc] text-vault-accent dark:bg-[#24365f] dark:text-[#93c5fd]"
                        : "text-vault-muted2 dark:text-[#b9c2cc] hover:bg-[#e9edf3] hover:text-vault-text dark:hover:bg-[#505862] dark:hover:text-[#e6eaf0]"
                    }`}
                  >
                    {formatPeriod(month)}
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        <NavLink to="/cartera" className={({ isActive }) => navLinkClass(isActive)}>
          <span className="w-4 text-center">◆</span>
          Cuenta comitente
        </NavLink>

        {/* Mis cuentas con desplegable */}
        <div className="mb-0.5">
          <div className="flex items-center">
            <NavLink
              to="/accounts"
              end
              className={({ isActive }) =>
                `flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-normal transition-colors ${
                  isActive
                    ? "bg-[#e3ecfc] text-[#1e3a8a] dark:bg-[#24365f] dark:text-[#93c5fd]"
                    : "text-vault-muted2 dark:text-[#b9c2cc] hover:bg-[#e9edf3] hover:text-vault-text dark:hover:bg-[#505862] dark:hover:text-[#e6eaf0]"
                }`
              }
            >
              <span className="w-4 text-center">⊞</span>
              Mis cuentas
            </NavLink>
            <button
              type="button"
              onClick={() => setAccountsOpen((o) => !o)}
              className="ml-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-base text-vault-muted2 dark:text-[#99a3b0] transition-colors hover:bg-[#e9edf3] hover:text-vault-text"
              aria-label={accountsOpen ? "Colapsar cuentas" : "Expandir cuentas"}
            >
              <span
                className="inline-block leading-none transition-transform duration-200"
                style={{ transform: accountsOpen ? "rotate(90deg)" : "rotate(0deg)" }}
              >
                ›
              </span>
            </button>
          </div>

          {accountsOpen && (
            <div className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-vault-border dark:border-[#68727f] pl-2">
              {groupedEntities.map((entity) => (
                <Link
                  key={entity}
                  to={`/accounts?entity=${encodeURIComponent(entity)}`}
                  onClick={() => setSelectedEntity(entity)}
                  className={`truncate rounded-md px-2 py-1.5 text-[12px] transition-colors ${
                    selectedEntity === entity
                      ? "bg-[#e3ecfc] text-vault-accent dark:bg-[#24365f] dark:text-[#93c5fd]"
                      : "text-vault-muted2 dark:text-[#b9c2cc] hover:bg-[#e9edf3] hover:text-vault-text dark:hover:bg-[#505862] dark:hover:text-[#e6eaf0]"
                  }`}
                >
                  {entity}
                </Link>
              ))}
              <Link
                to="/accounts?new=true"
                className="rounded-md px-2 py-1.5 text-[12px] text-vault-accent dark:text-[#93c5fd] transition-colors hover:bg-[#e3ecfc] dark:hover:bg-[#24365f]"
              >
                ＋ Nueva entidad
              </Link>
            </div>
          )}
        </div>

        <NavLink to="/installments" className={({ isActive }) => navLinkClass(isActive)}>
          <span className="w-4 text-center">◷</span>
          Historial de gastos
        </NavLink>

        <NavLink to="/upload" className={({ isActive }) => navLinkClass(isActive)}>
          <span className="w-4 text-center">↑</span>
          Subir extracto
        </NavLink>
      </nav>

      {/* Footer con menú desplegable */}
      <div
        ref={footerRef}
        className="relative border-t border-vault-border dark:border-[#68727f] p-4"
      >
        {/* Menú hacia arriba */}
        {userMenuOpen && (
          <div
            className="absolute left-0 right-0 z-50 overflow-hidden rounded-[10px] border border-vault-border bg-white p-1.5 dark:bg-[#474e58] dark:border-[#68727f]"
            style={{
              bottom: "100%",
              marginBottom: "4px",
              boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
            }}
          >
            {/* Header no clickeable */}
            <div className="border-b border-vault-border px-2.5 pb-2 pt-1.5 dark:border-[#68727f]">
              <p className="text-[11px] text-vault-muted2 dark:text-[#99a3b0]">
                {user?.name ?? "Usuario"}
              </p>
            </div>

            <div className="mt-1.5 flex flex-col gap-0.5">
              <Link to="/profile" className={menuItemClass} onClick={() => setUserMenuOpen(false)}>
                <span className="w-4 text-center text-[13px]">○</span>
                Mi perfil
              </Link>
              <Link to="/settings" className={menuItemClass} onClick={() => setUserMenuOpen(false)}>
                <span className="w-4 text-center text-[13px]">⚙</span>
                Configuración
              </Link>

              <div className="my-1 border-t border-vault-border dark:border-[#68727f]" />

              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setUserMenuOpen(false);
                }}
                className={menuItemClass}
              >
                <span className="w-4 text-center text-[13px]">{theme === "dark" ? "☀" : "☽"}</span>
                {theme === "dark" ? "Modo claro" : "Modo oscuro"}
              </button>

              <div className="my-1 border-t border-vault-border dark:border-[#68727f]" />

              <button
                type="button"
                onClick={() => {
                  logout();
                  setUserMenuOpen(false);
                }}
                className={`${menuItemClass} hover:text-vault-red`}
              >
                <span className="w-4 text-center text-[13px]">→</span>
                Cerrar sesión
              </button>
            </div>
          </div>
        )}

        {/* Fila del avatar */}
        <button
          type="button"
          onClick={() => setUserMenuOpen((o) => !o)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-1 py-0.5 transition-colors hover:bg-[#e9edf3] dark:hover:bg-[#505862]"
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#e3ecfc] text-xs font-bold text-[#1e3a8a] dark:bg-[#24365f] dark:text-[#93c5fd]">
            {user?.name?.[0] ?? "V"}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium leading-tight text-vault-text dark:text-[#e6eaf0]">
              {user?.name ?? "Usuario"}
            </p>
            <p className="text-xs text-vault-muted2 dark:text-[#99a3b0]">
              {PLAN_LABELS[user?.plan ?? "free"]}
            </p>
          </div>
          <span
            className="flex-shrink-0 text-xs text-vault-muted2 transition-transform duration-200 dark:text-[#99a3b0]"
            style={{ transform: userMenuOpen ? "rotate(180deg)" : "none" }}
          >
            ⌄
          </span>
        </button>
      </div>
    </aside>
  );
}
