import { useMutation } from "@tanstack/react-query";
import { apiClient } from "./client";

export function useExportXlsx() {
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data } = await apiClient.post<{ download_url: string }>("/exports/xlsx");
      return data.download_url;
    },
  });
}
