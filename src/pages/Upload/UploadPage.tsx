import { useState, type FormEvent } from "react";
import { useAccounts } from "@/api/accounts.api";
import { useSubmitUpload, useUploadStatus, useUploads, type UploadStatus } from "@/api/uploads.api";
import { extractErrorMessage } from "@/utils/apiError";
import { getCurrentPeriod } from "@/utils/formatDate";

const STATUS_LABELS: Record<UploadStatus, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  review: "Necesita revision",
  done: "Completado",
  error: "Error",
};

const STATUS_COLORS: Record<UploadStatus, string> = {
  pending: "text-vault-muted2",
  processing: "text-vault-accent",
  review: "text-vault-yellow",
  done: "text-vault-green",
  error: "text-vault-red",
};

export function UploadPage() {
  const { data: accounts, isLoading: isLoadingAccounts } = useAccounts();
  const { data: uploads } = useUploads();
  const submitUpload = useSubmitUpload();

  const [accountId, setAccountId] = useState("");
  const [periodMonth, setPeriodMonth] = useState(getCurrentPeriod());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

  const { data: activeStatus } = useUploadStatus(activeUploadId);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !accountId) return;
    setError(null);
    try {
      const uploadId = await submitUpload.mutateAsync({ accountId, periodMonth, file });
      setActiveUploadId(uploadId);
      setFile(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="font-syne text-2xl font-bold">Cargar extracto</h1>
        <p className="text-sm text-vault-muted2">
          Subi un PDF o XLSX de tu cuenta para que la IA lo categorice automaticamente.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="card-vault col-span-2">
          {!accounts || accounts.length === 0 ? (
            <p className="text-sm text-vault-muted2">
              {isLoadingAccounts
                ? "Cargando cuentas..."
                : "Primero crea una cuenta en “Mis cuentas” para poder cargar un extracto."}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2">Cuenta</label>
                <select
                  required
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="input-vault"
                >
                  <option value="" disabled>
                    Selecciona una cuenta
                  </option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2">Periodo</label>
                <input
                  type="date"
                  required
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                  className="input-vault"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2">Archivo</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="input-vault"
                />
              </div>

              {error && (
                <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                  {error}
                </div>
              )}

              <button type="submit" disabled={submitUpload.isPending} className="btn-primary mt-1">
                {submitUpload.isPending ? "Subiendo..." : "Subir extracto"}
              </button>
            </form>
          )}

          {activeStatus && (
            <div className="mt-4 rounded-vault border border-vault-border bg-vault-s2 px-3.5 py-2.5 text-sm">
              Estado del ultimo envio:{" "}
              <span className={`font-medium ${STATUS_COLORS[activeStatus.status]}`}>
                {STATUS_LABELS[activeStatus.status]}
              </span>
              {activeStatus.error_message && (
                <p className="mt-1 text-xs text-vault-red">{activeStatus.error_message}</p>
              )}
            </div>
          )}
        </div>

        <div className="card-vault">
          <h2 className="mb-3 font-syne text-sm font-bold">Historial</h2>
          {!uploads || uploads.length === 0 ? (
            <p className="text-sm text-vault-muted2">Todavia no subiste ningun extracto.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {uploads.map((upload) => (
                <li
                  key={upload.id}
                  className="flex items-center justify-between gap-2 rounded-vault border border-vault-border bg-vault-s2 px-3 py-2 text-xs"
                >
                  <span className="text-vault-muted2">{upload.period_month}</span>
                  <span className={`font-medium ${STATUS_COLORS[upload.status]}`}>
                    {STATUS_LABELS[upload.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
