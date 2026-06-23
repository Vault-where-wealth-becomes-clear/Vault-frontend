import type { AuthUser } from "@/store/auth.store";

export const PLAN_LABELS: Record<AuthUser["plan"], string> = {
  free: "Gratis",
  pro: "Pro",
  family: "Familiar",
};
