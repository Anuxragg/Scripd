"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getProfile,
  getProfileStats,
  updateProfile,
  type UpdateProfileInput,
} from "@/features/profile/api";

export function useProfile(username: string) {
  return useQuery({
    queryKey: ["users", "profile", username.toLowerCase()],
    queryFn: () => getProfile(username),
    enabled: Boolean(username.trim()),
    staleTime: 60_000,
  });
}

export function useProfileStats(username: string) {
  return useQuery({
    queryKey: ["users", "stats", username.toLowerCase()],
    queryFn: () => getProfileStats(username),
    enabled: Boolean(username.trim()),
    staleTime: 60_000,
  });
}

export function useUpdateProfile(username?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "currentUser"] });
      if (username) {
        queryClient.invalidateQueries({
          queryKey: ["users", "profile", username.toLowerCase()],
        });
      }
    },
  });
}
