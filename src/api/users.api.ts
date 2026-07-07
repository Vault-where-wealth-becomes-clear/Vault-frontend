import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await apiClient.delete("/users/me");
    },
  });
}

export function useDeleteMyData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await apiClient.delete("/users/me/data");
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
