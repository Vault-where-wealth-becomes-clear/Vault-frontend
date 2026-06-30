import { useState, type FormEvent } from "react";
import {
  useCategoryRules,
  useCreateCategoryRule,
  useDeleteCategoryRule,
} from "@/api/categoryRules.api";
import { STANDARD_CATEGORIES } from "@/api/transactions.api";
import { extractErrorMessage } from "@/utils/apiError";

export function CategoryRulesSettings() {
  const { data: rules, isLoading } = useCategoryRules();
  const createRule = useCreateCategoryRule();
  const deleteRule = useDeleteCategoryRule();

  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!keyword.trim() || !category) {
      setError("Completá la palabra clave y la categoría.");
      return;
    }
    setError(null);
    try {
      await createRule.mutateAsync({ keyword: keyword.trim(), category });
      setKeyword("");
      setCategory("");
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="card-vault mb-5 max-w-md">
      <h2 className="mb-1 section-label">Reglas de categorización</h2>
      <p className="mb-3 text-xs text-vault-muted2 dark:text-[#8b949e]">
        Cuando una descripción contiene esta palabra clave, se asigna la categoría automáticamente
        en la próxima carga.
      </p>

      <form onSubmit={handleSubmit} className="mb-4 flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
            Palabra clave
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="COTO"
            className="input-vault"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
            Categoría
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-vault"
          >
            <option value="" disabled>
              Elegí categoría
            </option>
            {STANDARD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={createRule.isPending} className="btn-primary">
          Agregar
        </button>
      </form>

      {error && (
        <div className="mb-3 rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">Cargando...</p>
      ) : !rules || rules.length === 0 ? (
        <p className="text-sm text-vault-muted2 dark:text-[#8b949e]">Todavía no creaste reglas.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between text-xs">
              <span className="text-vault-text dark:text-[#e6edf3]">
                "{rule.keyword}" → {rule.category}
              </span>
              <button
                onClick={() => deleteRule.mutate(rule.id)}
                className="text-vault-muted dark:text-[#8b949e] transition-colors hover:text-vault-red"
              >
                &#10005;
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
