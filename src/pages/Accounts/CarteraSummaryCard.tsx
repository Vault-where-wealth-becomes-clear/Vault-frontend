import { Link } from "react-router-dom";
import { useAccountCartera } from "@/api/cartera.api";
import { formatCurrency } from "@/utils/formatCurrency";
import { CarteraComposicion } from "@/components/cartera/CarteraComposicion";

/** Tarjeta compacta para "Mis cuentas" — solo "¿cómo está ahora?". El detalle completo
 * (posiciones, evolución, alertas) vive en la página Cuenta comitente. */
export function CarteraSummaryCard({ accountId }: { accountId: string }) {
  const { data: cartera, isLoading } = useAccountCartera(accountId, 1);

  if (isLoading) {
    return <p className="text-xs text-vault-muted2 dark:text-[#99a3b0]">Cargando...</p>;
  }

  if (!cartera) {
    return (
      <p className="text-xs text-vault-muted2 dark:text-[#99a3b0]">
        Todavía no subiste ningún archivo para esta cuenta comitente. Subí un snapshot de
        tenencias del broker para empezar a ver tu cartera acá.
      </p>
    );
  }

  const total = cartera.posiciones.reduce((sum, p) => sum + p.valor_base_ars, 0);

  return (
    <div className="rounded-vault border border-vault-border bg-vault-s2 px-3.5 py-3 dark:border-[#68727f] dark:bg-[#505862]">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex-shrink-0 rounded-full border border-vault-accent/40 dark:border-[#5b7bc4]/40 bg-vault-accent/10 px-2 py-0.5 text-[10px] font-semibold text-vault-accent dark:text-[#93c5fd]">
          Nivel {cartera.nivel_detectado}
        </span>
        <span className="tabular-nums text-sm font-medium text-vault-text dark:text-[#e6eaf0]">
          {formatCurrency(total, "ARS")}
        </span>
      </div>
      <CarteraComposicion posiciones={cartera.posiciones} nivelDetectado={cartera.nivel_detectado} />
      <Link
        to={`/cartera?account=${accountId}`}
        className="mt-2 inline-block text-xs text-vault-accent dark:text-[#93c5fd] hover:underline"
      >
        Ver cuenta comitente completa →
      </Link>
    </div>
  );
}
