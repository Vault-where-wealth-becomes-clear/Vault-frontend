import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface CategoryRule {
  id: string;
  keyword: string;
  category: string;
  source: "user" | "ai";
  times_applied: number;
}

export function useCategoryRules() {
  return useQuery({
    queryKey: ["category-rules"],
    queryFn: async (): Promise<CategoryRule[]> => {
      const { data } = await apiClient.get<CategoryRule[]>("/category-rules");
      return data;
    },
  });
}

interface CreateCategoryRuleParams {
  keyword: string;
  category: string;
}

export function useCreateCategoryRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ keyword, category }: CreateCategoryRuleParams): Promise<CategoryRule> => {
      const { data } = await apiClient.post<CategoryRule>("/category-rules", { keyword, category });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-rules"] });
    },
  });
}

export function useDeleteCategoryRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string): Promise<void> => {
      await apiClient.delete(`/category-rules/${ruleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-rules"] });
    },
  });
}
