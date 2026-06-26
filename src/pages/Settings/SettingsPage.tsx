import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import { logout } from "@/api/auth.api";
import { useDeleteAccount } from "@/api/users.api";
import { extractErrorMessage } from "@/utils/apiError";
import { PLAN_LABELS } from "@/utils/planLabels";
import { ExchangeRateSettings } from "./ExchangeRateSettings";
import { CategoryRulesSettings } from "./CategoryRulesSettings";

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const deleteAccount = useDeleteAccount();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Esto elimina tu cuenta y todos tus datos (cuentas, movimientos, archivos) de forma permanente. No se puede deshacer. Continuar?"
    );
    if (!confirmed) return;

    setError(null);
    try {
      await deleteAccount.mutateAsync();
      await logout();
      navigate("/login");
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="page-title">Configuración</h1>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">Datos de tu cuenta y privacidad.</p>
      </div>

      <div className="card-vault mb-5 max-w-md">
        <h2 className="mb-3 section-label">Tu cuenta</h2>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          Email: <span className="text-vault-text dark:text-[#e6edf3]">{user?.email}</span>
        </p>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          Plan: <span className="text-vault-text dark:text-[#e6edf3]">{PLAN_LABELS[user?.plan ?? "free"]}</span>
        </p>
      </div>

      <ExchangeRateSettings />
      <CategoryRulesSettings />

      <div className="card-vault max-w-md border-vault-red/30">
        <h2 className="mb-2 section-label text-vault-red">Zona de riesgo</h2>
        <p className="mb-3 text-sm text-vault-muted2 dark:text-[#8b949e]">
          Elimina tu cuenta, tus cuentas registradas, movimientos y archivos subidos. Esta acción
          es permanente.
        </p>

        {error && (
          <div className="mb-3 rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
            {error}
          </div>
        )}

        <button
          onClick={handleDelete}
          disabled={deleteAccount.isPending}
          className="btn-ghost border-vault-red/40 text-vault-red hover:border-vault-red"
        >
          {deleteAccount.isPending ? "Eliminando..." : "Eliminar mi cuenta"}
        </button>
      </div>
    </div>
  );
}
