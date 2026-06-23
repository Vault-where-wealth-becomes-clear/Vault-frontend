import axios, { type AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/auth.store";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = useAuthStore.getState().refreshTokenValue;
  if (!refreshToken) throw new Error("No hay refresh token disponible");

  const { data } = await axios.post<{ access_token: string }>(`${BASE_URL}/auth/refresh`, {
    refresh_token: refreshToken,
  });
  useAuthStore.getState().setAccessToken(data.access_token);
  return data.access_token;
}

export function refreshSessionFromStorage(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

interface RetryableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retry && useAuthStore.getState().refreshTokenValue) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const token = await refreshPromise;
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return apiClient(original);
      } catch {
        useAuthStore.getState().logout();
      }
    } else if (status === 401) {
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  }
);
