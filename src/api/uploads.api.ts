import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import type { SkillModule } from "@/components/upload/ModuleSelector";

export type UploadStatus = "pending" | "processing" | "review" | "done" | "error";

export interface Upload {
  id: string;
  account_id: string;
  period_month: string;
  status: UploadStatus;
  detected_bank: string | null;
  error_message: string | null;
  requested_modules: SkillModule[];
  pending_mep: boolean;
  uploaded_at: string;
  processed_at: string | null;
}

export interface UploadStatusResponse {
  upload_id: string;
  status: UploadStatus;
  error_message: string | null;
  processed_at: string | null;
  review_count: number | null;
  pending_mep: boolean;
}

interface PresignResponse {
  upload_id: string;
  presigned_url: string;
  s3_key: string;
}

export function useUploads() {
  return useQuery({
    queryKey: ["uploads"],
    queryFn: async (): Promise<Upload[]> => {
      const { data } = await apiClient.get<Upload[]>("/uploads");
      return data;
    },
  });
}

export function useUploadStatus(uploadId: string | null) {
  return useQuery({
    queryKey: ["upload-status", uploadId],
    enabled: !!uploadId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 4000 : false;
    },
    queryFn: async (): Promise<UploadStatusResponse> => {
      const { data } = await apiClient.get<UploadStatusResponse>(`/uploads/${uploadId}/status`);
      return data;
    },
  });
}

interface SubmitUploadParams {
  accountId: string;
  periodMonth: string;
  file: File;
  requestedModules: SkillModule[];
}

export function useSubmitUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      accountId,
      periodMonth,
      file,
      requestedModules,
    }: SubmitUploadParams): Promise<string> => {
      const { data: presign } = await apiClient.post<PresignResponse>("/uploads/presign", {
        account_id: accountId,
        period_month: periodMonth,
        filename: file.name,
        requested_modules: requestedModules,
      });

      await axios.put(presign.presigned_url, file, {
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      await apiClient.post("/uploads", {
        upload_id: presign.upload_id,
        s3_key: presign.s3_key,
      });

      return presign.upload_id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
    },
  });
}
