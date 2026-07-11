import { useState } from "react";
import { useDeleteMyData } from "@/api/users.api";
import { ExchangeRateSettings } from "@/pages/Settings/ExchangeRateSettings";

export function SettingsPage() {
  const [notifPatrimonio, setNotifPatrimonio] = useState(false);
  const [notifRecordatorio, setNotifRecordatorio] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteData = useDeleteMyData();

  const handleDeleteData = async () => {
    await deleteData.mutateAsync();
    setConfirmDelete(false);
  };

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="page-title">Configuración</h1>
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">
          Preferencias generales de la aplicación.
        </p>
      </div>

      {/* IDIOMA */}
      <div className="card-vault mb-5 max-w-md">
        <h2 className="mb-3 section-label">Idioma</h2>
        <div className="flex gap-2">
          <select className="input-vault flex-1" disabled>
            <option>Español (Argentina)</option>
            <option>Español</option>
            <option>English</option>
          </select>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="btn-primary shrink-0 cursor-not-allowed opacity-40"
          >
            Guardar
          </button>
        </div>
        <p className="mt-2 text-xs text-vault-muted2 dark:text-[#8b949e]">
          El idioma afecta los formatos de fecha y moneda.
        </p>
      </div>

      {/* MONEDA BASE */}
      <div className="card-vault mb-5 max-w-md">
        <h2 className="mb-3 section-label">Moneda base</h2>
        <div className="flex gap-2">
          <select className="input-vault flex-1" disabled>
            <option>USD — Dólar estadounidense</option>
            <option>ARS — Peso argentino</option>
          </select>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="btn-primary shrink-0 cursor-not-allowed opacity-40"
          >
            Guardar
          </button>
        </div>
        <p className="mt-2 text-xs text-vault-muted2 dark:text-[#8b949e]">
          Todos los totales del tablero se mostrarán en esta moneda.
        </p>
      </div>

      {/* TIPO DE CAMBIO MEP */}
      <ExchangeRateSettings />

      {/* NOTIFICACIONES */}
      <div className="card-vault mb-5 max-w-md">
        <h2 className="mb-3 section-label">Notificaciones</h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-vault-text dark:text-[#e6edf3]">
                  Alertas de patrimonio
                </p>
                <span className="rounded-full bg-vault-s2 px-2 py-0.5 text-[10px] font-medium text-vault-muted2 dark:bg-[#21262d] dark:text-[#8b949e]">
                  Próximamente
                </span>
              </div>
              <p className="mt-0.5 text-xs text-vault-muted2 dark:text-[#8b949e]">
                Cuando tu patrimonio cae más del 10%
              </p>
            </div>
            <button
              type="button"
              disabled
              onClick={() => setNotifPatrimonio((v) => !v)}
              className={`relative mt-0.5 h-5 w-9 flex-shrink-0 cursor-not-allowed rounded-full transition-colors opacity-40 ${
                notifPatrimonio ? "bg-vault-accent" : "bg-vault-border2 dark:bg-[#484f58]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  notifPatrimonio ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-vault-text dark:text-[#e6edf3]">
                  Recordatorio mensual
                </p>
                <span className="rounded-full bg-vault-s2 px-2 py-0.5 text-[10px] font-medium text-vault-muted2 dark:bg-[#21262d] dark:text-[#8b949e]">
                  Próximamente
                </span>
              </div>
              <p className="mt-0.5 text-xs text-vault-muted2 dark:text-[#8b949e]">
                Para subir tu extracto del mes
              </p>
            </div>
            <button
              type="button"
              disabled
              onClick={() => setNotifRecordatorio((v) => !v)}
              className={`relative mt-0.5 h-5 w-9 flex-shrink-0 cursor-not-allowed rounded-full transition-colors opacity-40 ${
                notifRecordatorio ? "bg-vault-accent" : "bg-vault-border2 dark:bg-[#484f58]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  notifRecordatorio ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* PRIVACIDAD Y DATOS */}
      <div className="card-vault mb-5 max-w-md">
        <h2 className="mb-3 section-label">Privacidad y datos</h2>
        <p className="mb-3 text-sm text-vault-muted2 dark:text-[#8b949e]">
          Vault no comparte ni vende tus datos. Los PDFs se eliminan del servidor una vez
          procesados.
        </p>
        <a href="#" className="text-sm text-vault-accent transition-colors hover:underline">
          Ver política de privacidad
        </a>
      </div>

      {/* ZONA PELIGROSA */}
      <div className="card-vault max-w-md border-vault-red/30">
        <h2 className="mb-3 section-label text-vault-red">Zona peligrosa</h2>
        <p className="mb-4 text-sm text-vault-muted2 dark:text-[#8b949e]">
          Elimina todos tus uploads, transacciones y snapshots financieros. Tus cuentas y
          configuración se conservan.
        </p>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-vault border border-vault-red/40 bg-vault-red/10 px-3.5 py-2 text-sm font-medium text-vault-red hover:bg-vault-red/20"
          >
            Borrar todos mis datos financieros
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-vault-red">
              ¿Estás seguro? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDeleteData}
                disabled={deleteData.isPending}
                className="rounded-vault bg-vault-red px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {deleteData.isPending ? "Borrando..." : "Sí, borrar todo"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-vault border border-vault-border px-3.5 py-2 text-sm text-vault-muted2 hover:text-vault-text dark:text-[#8b949e]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
