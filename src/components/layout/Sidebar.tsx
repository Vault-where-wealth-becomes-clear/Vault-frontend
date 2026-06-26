import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import { logout } from "@/api/auth.api";
import { useAccounts } from "@/api/accounts.api";
import { PLAN_LABELS } from "@/utils/planLabels";
import { useTheme } from "@/hooks/useTheme";
import vaultLogo from "@/assets/vault-logo.png";

const SETTINGS_ITEMS = [{ to: "/settings", icon: "⚙", label: "Configuración" }];

const navLinkClass = (isActive: boolean) =>
  `mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-normal transition-colors ${
    isActive
      ? "bg-[#eff6ff] text-[#1e3a8a] dark:bg-[#1d2d50] dark:text-[#93c5fd]"
      : "text-vault-muted2 dark:text-[#c9d1d9] hover:bg-[#f1f5f9] hover:text-vault-text dark:hover:bg-[#21262d] dark:hover:text-[#e6edf3]"
  }`;

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const { data: accounts } = useAccounts();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col border-r border-vault-border bg-white dark:bg-[#161b22] dark:border-[#30363d]">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-2">
          <img src={vaultLogo} alt="Vault" className="h-7 w-7 rounded-lg" />
          <span className="font-semibold text-vault-text dark:text-[#e6edf3]">Vault</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <div className="section-label mb-2 px-3 dark:text-[#6e7681]">Principal</div>

        <NavLink to="/dashboard" className={({ isActive }) => navLinkClass(isActive)}>
          <span className="w-4 text-center">▤</span>
          Tablero
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
                    ? "bg-[#eff6ff] text-[#1e3a8a] dark:bg-[#1d2d50] dark:text-[#93c5fd]"
                    : "text-vault-muted2 dark:text-[#c9d1d9] hover:bg-[#f1f5f9] hover:text-vault-text dark:hover:bg-[#21262d] dark:hover:text-[#e6edf3]"
                }`
              }
            >
              <span className="w-4 text-center">⊞</span>
              Mis cuentas
            </NavLink>
            <button
              type="button"
              onClick={() => setAccountsOpen((o) => !o)}
              className="ml-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-base text-vault-muted2 dark:text-[#8b949e] transition-colors hover:bg-[#f1f5f9] hover:text-vault-text"
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
            <div className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-vault-border dark:border-[#30363d] pl-2">
              {accounts?.map((account) => (
                <Link
                  key={account.id}
                  to={`/accounts?selected=${account.id}`}
                  className="truncate rounded-md px-2 py-1.5 text-[12px] text-vault-muted2 dark:text-[#c9d1d9] transition-colors hover:bg-[#f1f5f9] hover:text-vault-text dark:hover:bg-[#21262d] dark:hover:text-[#e6edf3]"
                >
                  {account.name}
                </Link>
              ))}
              <Link
                to="/accounts?new=true"
                className="rounded-md px-2 py-1.5 text-[12px] text-vault-accent transition-colors hover:bg-[#eff6ff] dark:hover:bg-[#1d2d50]"
              >
                ＋ Nueva cuenta
              </Link>
            </div>
          )}
        </div>

        <NavLink to="/installments" className={({ isActive }) => navLinkClass(isActive)}>
          <span className="w-4 text-center">◷</span>
          Historial de gastos
        </NavLink>

        <div className="section-label mb-2 mt-6 px-3 dark:text-[#6e7681]">Sistema</div>
        {SETTINGS_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => navLinkClass(isActive)}>
            <span className="w-4 text-center">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-vault-border dark:border-[#30363d] p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eff6ff] text-xs font-bold text-[#1e3a8a] dark:bg-[#1d2d50] dark:text-[#93c5fd]">
            {user?.name?.[0] ?? "V"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight text-vault-text dark:text-[#e6edf3]">
              {user?.name ?? "Usuario"}
            </p>
            <p className="text-xs text-vault-muted2 dark:text-[#8b949e]">{PLAN_LABELS[user?.plan ?? "free"]}</p>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="text-vault-muted dark:text-[#8b949e] transition-colors hover:text-vault-red"
          >
            &#x2192;
          </button>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-vault-border bg-[#f1f5f9] px-3 py-2 text-xs font-medium text-vault-muted2 dark:text-[#8b949e] transition-colors hover:text-vault-text dark:bg-[#21262d] dark:border-[#30363d] dark:hover:text-[#e6edf3]"
        >
          {theme === "dark" ? "☀ Claro" : "☽ Oscuro"}
        </button>
      </div>
    </aside>
  );
}
