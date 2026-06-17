import { useMutation } from "@tanstack/react-query";
import { apiClient } from "./client";

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await apiClient.delete("/users/me");
    },
  });
}
