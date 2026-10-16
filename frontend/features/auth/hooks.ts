"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  currentUser,
  login,
  logout,
  resendEmailVerification,
  register,
  verifyEmail,
  type LoginInput,
  type Profile,
  type RegisterInput,
} from "@/features/auth/api";

const currentUserKey = ["auth", "current-user"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserKey,
    queryFn: currentUser,
    staleTime: 30_000,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (profile: Profile) => queryClient.setQueryData(currentUserKey, profile),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => register(input),
    onSuccess: (profile: Profile) => queryClient.setQueryData(currentUserKey, profile),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.setQueryData(currentUserKey, null),
  });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => verifyEmail(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: currentUserKey }),
  });
}

export function useResendEmailVerification() {
  return useMutation({ mutationFn: resendEmailVerification });
}
