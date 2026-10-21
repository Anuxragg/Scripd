import { z } from "zod";
import { ApiError, apiRequest } from "@/lib/api/client";

export const profileSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  display_name: z.string(),
  email_verified: z.boolean(),
  created_at: z.string(),
});

const profileResponseSchema = z.object({
  data: profileSchema,
  meta: z.unknown().optional(),
});

const logoutResponseSchema = z.object({
  data: z.object({ logged_out: z.boolean() }),
  meta: z.record(z.string(), z.unknown()),
});

const verificationResponseSchema = z.object({
  data: z.object({ email_verified: z.boolean() }),
  meta: z.record(z.string(), z.unknown()),
});

const resendVerificationResponseSchema = z.object({
  data: z.object({ accepted: z.boolean() }),
  meta: z.record(z.string(), z.unknown()),
});

const changePasswordResponseSchema = z.object({
  data: z.object({ status: z.string() }),
  meta: z.record(z.string(), z.unknown()),
});

const deleteAccountResponseSchema = z.object({
  data: z.object({ status: z.string() }),
  meta: z.record(z.string(), z.unknown()),
});

export type Profile = z.infer<typeof profileSchema>;

export type RegisterInput = {
  username: string;
  email: string;
  display_name?: string;
  password: string;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export type ChangePasswordInput = {
  current_password: string;
  new_password: string;
};

export type DeleteAccountInput = {
  current_password: string;
};

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function register(input: RegisterInput): Promise<Profile> {
  return apiRequest("/api/v1/auth/register", profileResponseSchema, jsonRequest(input)).then(
    (response) => response.data,
  );
}

export function login(input: LoginInput): Promise<Profile> {
  return apiRequest("/api/v1/auth/login", profileResponseSchema, jsonRequest(input)).then(
    (response) => response.data,
  );
}

export function refreshSession(): Promise<Profile> {
  return apiRequest("/api/v1/auth/refresh", profileResponseSchema, { method: "POST" }).then(
    (response) => response.data,
  );
}

export function logout(): Promise<void> {
  return apiRequest("/api/v1/auth/logout", logoutResponseSchema, { method: "POST" }).then(
    () => undefined,
  );
}

export function verifyEmail(token: string): Promise<void> {
  return apiRequest(
    "/api/v1/auth/email/verify",
    verificationResponseSchema,
    jsonRequest({ token }),
  ).then(() => undefined);
}

export function resendEmailVerification(): Promise<void> {
  return apiRequest(
    "/api/v1/auth/email/verification/resend",
    resendVerificationResponseSchema,
    jsonRequest({}),
  ).then(() => undefined);
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return apiRequest(
    "/api/v1/auth/change-password",
    changePasswordResponseSchema,
    jsonRequest(input),
  ).then(() => undefined);
}

export function deleteAccount(input: DeleteAccountInput): Promise<void> {
  return apiRequest(
    "/api/v1/auth/delete-account",
    deleteAccountResponseSchema,
    jsonRequest(input),
  ).then(() => undefined);
}

export async function currentUser(): Promise<Profile | null> {
  try {
    return await fetchCurrentUser();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
  }

  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("scripd-session-refresh", async () => {
      try {
        return await fetchCurrentUser();
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error;
        }
      }
      return refreshOrNull();
    });
  }

  return refreshOrNull();
}

async function fetchCurrentUser(): Promise<Profile> {
  const response = await apiRequest("/api/v1/auth/me", profileResponseSchema);
  return response.data;
}

async function refreshOrNull(): Promise<Profile | null> {
  try {
    return await refreshSession();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}
