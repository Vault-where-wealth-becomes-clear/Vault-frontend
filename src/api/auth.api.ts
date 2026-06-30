import { apiClient } from "./client";
import { useAuthStore, type AuthUser } from "@/store/auth.store";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string | null;
  id_token?: string | null;
  token_type: string;
}

export interface ChallengeResponse {
  challenge_name: string;
  session: string;
}

export type LoginResult =
  { kind: "tokens"; tokens: TokenResponse } | { kind: "challenge"; challenge: ChallengeResponse };

function isChallenge(data: TokenResponse | ChallengeResponse): data is ChallengeResponse {
  return "challenge_name" in data;
}

interface UserRead {
  id: string;
  email: string;
  name: string | null;
  plan: "free" | "pro" | "family";
  base_currency: "ARS" | "USD";
}

async function fetchMe(accessToken: string): Promise<AuthUser> {
  const { data } = await apiClient.get<UserRead>("/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { id: data.id, email: data.email, name: data.name ?? data.email, plan: data.plan };
}

async function establishSession(tokens: TokenResponse): Promise<void> {
  const user = await fetchMe(tokens.access_token);
  useAuthStore.getState().setSession({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    user,
  });
}

export async function register(email: string, password: string, name: string): Promise<void> {
  await apiClient.post("/auth/register", { email, password, name });
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  await apiClient.post("/auth/confirm", { email, code });
}

export async function resendConfirmationCode(email: string): Promise<void> {
  await apiClient.post("/auth/resend-code", { email });
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const { data } = await apiClient.post<TokenResponse | ChallengeResponse>("/auth/login", {
    email,
    password,
  });

  if (isChallenge(data)) {
    return { kind: "challenge", challenge: data };
  }

  await establishSession(data);
  return { kind: "tokens", tokens: data };
}

export async function submitTotp(email: string, session: string, code: string): Promise<void> {
  const { data } = await apiClient.post<TokenResponse>("/auth/totp", { email, session, code });
  await establishSession(data);
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await apiClient.post("/auth/change-password", {
    old_password: oldPassword,
    new_password: newPassword,
  });
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post("/auth/logout");
  } finally {
    useAuthStore.getState().logout();
  }
}
