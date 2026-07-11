import { usePrivacyStore } from "@/store/privacy.store";

/** Ícono mínimo (ojo / ojo tachado) — sin emoji, para el toggle de tapar importes. */
function EyeIcon({ crossedOut }: { crossedOut: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1.5 12s4-7 10.5-7 10.5 7 10.5 7-4 7-10.5 7-10.5-7-10.5-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      {crossedOut && (
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** Toggle minimalista de "tapar importes" — vive en la card de Patrimonio total,
 * pero su efecto (formatCurrency enmascarado) alcanza a toda la app. */
export function PrivacyToggle({ className = "" }: { className?: string }) {
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const toggleHideAmounts = usePrivacyStore((s) => s.toggleHideAmounts);

  return (
    <button
      type="button"
      onClick={toggleHideAmounts}
      title={hideAmounts ? "Mostrar importes" : "Ocultar importes"}
      aria-pressed={hideAmounts}
      className={`flex-shrink-0 rounded-md p-1 text-vault-muted2 transition-colors hover:text-vault-text dark:text-[#99a3b0] dark:hover:text-[#e6eaf0] ${className}`}
    >
      <EyeIcon crossedOut={hideAmounts} />
    </button>
  );
}
