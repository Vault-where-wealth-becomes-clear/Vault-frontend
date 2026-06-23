import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import { logout } from "@/api/auth.api";
import { PLAN_LABELS } from "@/utils/planLabels";
import vaultLogo from "@/assets/vault-logo.png";

const NAV_ITEMS = [
  { to: "/dashboard", icon: "▤", label: "Tablero" },
  { to: "/upload", icon: "↑", label: "Cargar extracto" },
  { to: "/accounts", icon: "▢", label: "Mis cuentas" },
  { to: "/installments", icon: "≡", label: "Cuotas" },
];

const SETTINGS_ITEMS = [{ to: "/settings", icon: "⚙", label: "Configuración" }];

export function Sidebar() {
  const user = useAuthStore((s) => s.user);

  return (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col border-r border-vault-border bg-vault-s1">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-2">
          <img src={vaultLogo} alt="Vault" className="h-7 w-7 rounded-lg" />
          <span className="font-syne font-bold text-vault-text">Vault</span>
        </div>
      </div>

      <nav className="flex-1 px-3">
        <div className="mb-2 px-3 text-[9px] font-bold uppercase tracking-widest text-vault-muted">
          Principal
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `
              mb-0.5 flex items-center gap-3 rounded-vault border-l-2 px-3 py-2.5 text-sm font-medium
              transition-colors
              ${
                isActive
                  ? "border-vault-accent bg-vault-accent/5 text-vault-accent"
                  : "border-transparent text-vault-muted2 hover:bg-vault-s3 hover:text-vault-text"
              }
            `}
          >
            <span className="w-4 text-center">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <div className="mb-2 mt-6 px-3 text-[9px] font-bold uppercase tracking-widest text-vault-muted">
          Sistema
        </div>
        {SETTINGS_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `
              mb-0.5 flex items-center gap-3 rounded-vault border-l-2 px-3 py-2.5 text-sm font-medium
              transition-colors
              ${
                isActive
                  ? "border-vault-accent bg-vault-accent/5 text-vault-accent"
                  : "border-transparent text-vault-muted2 hover:bg-vault-s3 hover:text-vault-text"
              }
            `}
          >
            <span className="w-4 text-center">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-vault-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-vault-accent to-vault-green text-xs font-bold text-vault-bg">
            {user?.name?.[0] ?? "V"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight text-vault-text">
              {user?.name ?? "Usuario"}
            </p>
            <p className="text-xs text-vault-muted">{PLAN_LABELS[user?.plan ?? "free"]}</p>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="text-vault-muted transition-colors hover:text-vault-red"
          >
            &#x2192;
          </button>
        </div>
      </div>
    </aside>
  );
}
