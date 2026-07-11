export type SkillModule =
  | "flujo_mensual"
  | "categorizacion_gasto"
  | "flujo_periodo"
  | "cuenta_comitente"
  | "tablero_general"
  | "proyeccion_patrimonial"
  | "compromisos_futuros";

interface ModuleDefinition {
  id: SkillModule;
  label: string;
  desc: string;
  required?: boolean;
  dependsOn?: SkillModule[];
}

export const MODULES: ModuleDefinition[] = [
  {
    id: "flujo_mensual",
    label: "Flujo mensual",
    desc: "Libro diario, reconciliación y resultado del período",
    required: true,
  },
  {
    id: "categorizacion_gasto",
    label: "Categorización de gasto",
    desc: "Gasto neto por categoría e ingresos por recurrencia",
    dependsOn: ["flujo_mensual"],
  },
  {
    id: "cuenta_comitente",
    label: "Cartera de inversiones",
    desc: "Posiciones, valuación y P&L por instrumento (solo si subís extracto de broker)",
  },
  {
    id: "tablero_general",
    label: "Tablero general",
    desc: "Activos líquidos en 3 capas — requiere flujo mensual",
    dependsOn: ["flujo_mensual"],
  },
  {
    id: "proyeccion_patrimonial",
    label: "Proyección a 3 meses",
    desc: "Requiere al menos 3 meses de tablero general",
    dependsOn: ["tablero_general"],
  },
  {
    id: "compromisos_futuros",
    label: "Cuotas pendientes",
    desc: "Solo aplica si hay tarjetas de crédito con cuotas",
  },
];

interface ModuleSelectorProps {
  selected: SkillModule[];
  onChange: (selected: SkillModule[]) => void;
}

export function ModuleSelector({ selected, onChange }: ModuleSelectorProps) {
  const toggle = (moduleId: SkillModule) => {
    if (moduleId === "flujo_mensual") return;
    if (selected.includes(moduleId)) {
      onChange(selected.filter((m) => m !== moduleId));
      return;
    }

    const dependsOn = MODULES.find((m) => m.id === moduleId)?.dependsOn ?? [];
    const missingDeps = dependsOn.filter((dep) => !selected.includes(dep));
    onChange([...selected, ...missingDeps, moduleId]);
  };

  const inlineNoticeFor = (moduleId: SkillModule): string | null => {
    if (!selected.includes(moduleId)) return null;
    const dependsOn = MODULES.find((m) => m.id === moduleId)?.dependsOn ?? [];
    const autoIncluded = dependsOn.filter(
      (dep) => dep !== "flujo_mensual" && selected.includes(dep)
    );
    if (autoIncluded.length === 0) return null;
    const labels = autoIncluded.map((dep) => MODULES.find((m) => m.id === dep)?.label).join(", ");
    return `Esto también va a calcular ${labels}, que no habías seleccionado, porque lo necesita.`;
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="mb-0.5 block text-xs font-medium text-vault-muted2 dark:text-[#99a3b0]">
        Qué querés analizar
      </label>
      {MODULES.map((module) => {
        const isChecked = selected.includes(module.id) || module.required === true;
        const notice = inlineNoticeFor(module.id);

        return (
          <div key={module.id}>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-vault border border-vault-border bg-vault-s2 dark:bg-[#505862] px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={isChecked}
                disabled={module.required}
                onChange={() => toggle(module.id)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">{module.label}</span>
                <span className="block text-xs text-vault-muted2 dark:text-[#99a3b0]">
                  {module.desc}
                </span>
              </span>
            </label>
            {notice && <p className="mt-1 px-3 text-xs text-vault-accent dark:text-[#93c5fd]">{notice}</p>}
          </div>
        );
      })}
    </div>
  );
}
