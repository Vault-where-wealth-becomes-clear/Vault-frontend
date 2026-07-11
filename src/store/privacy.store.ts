import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrivacyState {
  hideAmounts: boolean;
  toggleHideAmounts: () => void;
}

/**
 * Estado global de "tapar importes" — vive acá (no en cada página) para que
 * formatCurrency pueda consultarlo imperativamente vía getState() y enmascarar
 * cualquier monto en cualquier pantalla, sin tener que pasar props por cada
 * componente que muestra plata.
 */
export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set) => ({
      hideAmounts: false,
      toggleHideAmounts: () => set((s) => ({ hideAmounts: !s.hideAmounts })),
    }),
    { name: "vault-privacy" }
  )
);
