import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import { logout } from "@/api/auth.api";
import { useDeleteAccount } from "@/api/users.api";
import { extractErrorMessage } from "@/utils/apiError";
import { PLAN_LABELS } from "@/utils/planLabels";
import { useTheme } from "@/hooks/useTheme";
import { ExchangeRateSettings } from "@/pages/Settings/ExchangeRateSettings";
import { CategoryRulesSettings } from "@/pages/Settings/CategoryRulesSettings";

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const deleteAccount = useDeleteAccount();
  const { theme, toggleTheme } = useTheme();

  // Contraseña
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Reglas de categorización
  const [rulesOpen, setRulesOpen] = useState(false);

  // Zona de riesgo
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await deleteAccount.mutateAsync();
      await logout();
      navigate("/login");
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="page-title">Mi perfil</h1>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          Tu cuenta, preferencias y datos personales.
        </p>
      </div>

      {/* MI CUENTA */}
      <div className="card-vault mb-5 max-w-md">
        <h2 className="mb-3 section-label">Mi cuenta</h2>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
            Email:{" "}
            <span className="text-vault-text dark:text-[#e6edf3]">{user?.email}</span>
          </p>
          <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
            Plan:{" "}
            <span className="text-vault-text dark:text-[#e6edf3]">
              {PLAN_LABELS[user?.plan ?? "free"]}
            </span>
          </p>

          {/* Contraseña */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-vault-muted2 dark:text-[#8b949e]">
                Contraseña:{" "}
                <span className="text-vault-text dark:text-[#e6edf3]">
                  {showPassword ? "No disponible — usá cambiar contraseña" : "••••••••"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="ml-2 flex-shrink-0 text-xs text-vault-muted2 transition-colors hover:text-vault-text dark:text-[#8b949e]"
                title={showPassword ? "Ocultar" : "Mostrar"}
              >
                {showPassword ? "○" : "●"}
              </button>
            </div>

            {!changingPassword ? (
              <button
                type="button"
                onClick={() => setChangingPassword(true)}
                className="mt-2 text-xs text-vault-accent transition-colors hover:underline"
              >
                Cambiar contraseña
              </button>
            ) : (
              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-vault-border p-3 dark:border-[#30363d]">
                <input
                  type="password"
                  placeholder="Contraseña actual"
                  className="input-vault"
                  autoComplete="current-password"
                />
                <input
                  type="password"
                  placeholder="Nueva contraseña"
                  className="input-vault"
                  autoComplete="new-password"
                />
                <input
                  type="password"
                  placeholder="Confirmar nueva contraseña"
                  className="input-vault"
                  autoComplete="new-password"
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled
                    className="btn-primary cursor-not-allowed opacity-40"
                  >
                    Guardar
                  </button>
                  <span className="rounded-full bg-vault-s2 px-2.5 py-0.5 text-[10px] font-medium text-vault-muted2 dark:bg-[#21262d] dark:text-[#8b949e]">
                    Próximamente
                  </span>
                  <button
                    type="button"
                    onClick={() => setChangingPassword(false)}
                    className="ml-auto text-xs text-vault-muted2 transition-colors hover:text-vault-text dark:text-[#8b949e]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TIPO DE CAMBIO MEP */}
      <ExchangeRateSettings />

      {/* REGLAS DE CATEGORIZACIÓN — acordeón */}
      <div className="card-vault mb-5 max-w-md overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setRulesOpen((v) => !v)}
          className={`flex w-full cursor-pointer items-center justify-between px-4 py-4 transition-colors hover:bg-vault-s2 dark:hover:bg-[#21262d] ${
            rulesOpen ? "border-b border-vault-border dark:border-[#30363d]" : ""
          }`}
        >
          <h2 className="section-label">Reglas de categorización</h2>
          <span
            className="inline-block text-sm text-vault-muted2 transition-transform duration-200 dark:text-[#8b949e]"
            style={{ transform: rulesOpen ? "rotate(90deg)" : "none" }}
          >
            ›
          </span>
        </button>
        {rulesOpen && (
          <div className="px-4 pb-4 pt-3">
            <CategoryRulesSettings />
          </div>
        )}
      </div>

      {/* APARIENCIA */}
      <div className="card-vault mb-5 max-w-md">
        <h2 className="mb-3 section-label">Apariencia</h2>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center gap-2.5 rounded-lg border border-vault-border bg-[#f1f5f9] px-3.5 py-2.5 text-sm font-medium text-vault-muted2 transition-colors hover:text-vault-text dark:border-[#30363d] dark:bg-[#21262d] dark:text-[#8b949e] dark:hover:text-[#e6edf3]"
        >
          <span>{theme === "dark" ? "☀" : "☽"}</span>
          {theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        </button>
      </div>

      {/* ZONA DE RIESGO */}
      <div
        className="card-vault max-w-md border-2 border-vault-red/40 bg-vault-red/5 dark:bg-vault-red/10"
        style={{ marginTop: "32px" }}
      >
        <h2 className="mb-2 section-label text-vault-red">
          ⚠ Zona de riesgo
        </h2>
        <p className="mb-3 text-sm text-vault-muted2 dark:text-[#8b949e]">
          Esta acción elimina permanentemente tu cuenta, todas tus cuentas financieras, movimientos
          históricos y archivos subidos. No existe forma de recuperar estos datos.
        </p>

        {deleteError && (
          <div className="mb-3 rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
            {deleteError}
          </div>
        )}

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="btn-ghost border-vault-red/40 text-vault-red hover:border-vault-red hover:bg-vault-red/10"
          >
            Eliminar mi cuenta
          </button>
        ) : (
          <div className="rounded-vault border border-vault-red/20 bg-vault-red/5 px-3.5 py-3">
            <p className="mb-3 text-xs text-vault-text dark:text-[#e6edf3]">
              Esto elimina tu cuenta y todos tus datos de forma permanente. No se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded border border-vault-border py-1.5 text-xs text-vault-muted2 transition-colors hover:text-vault-text dark:border-[#30363d] dark:text-[#8b949e]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteAccount.isPending}
                className="flex-1 rounded border border-vault-red/30 bg-vault-red/10 py-1.5 text-xs text-vault-red transition-colors hover:bg-vault-red/20"
              >
                {deleteAccount.isPending ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CERRAR SESIÓN */}
      <div className="mt-5 max-w-md">
        <button
          type="button"
          onClick={handleLogout}
          className="btn-ghost flex w-full items-center justify-center gap-2"
        >
          <span>→</span>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
