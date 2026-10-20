"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getProfile,
  getProfileStats,
  updateProfile,
  getFollowStatus,
  followUser,
  unfollowUser,
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

export function useFollowStatus(username: string) {
  return useQuery({
    queryKey: ["users", "follow-status", username.toLowerCase()],
    queryFn: () => getFollowStatus(username),
    enabled: Boolean(username.trim()),
    staleTime: 30_000,
  });
}

export function useFollowUser(username: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => followUser(username),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["users", "follow-status", username.toLowerCase()],
      });
      queryClient.invalidateQueries({
        queryKey: ["users", "stats", username.toLowerCase()],
      });
    },
  });
}

export function useUnfollowUser(username: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unfollowUser(username),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["users", "follow-status", username.toLowerCase()],
      });
      queryClient.invalidateQueries({
        queryKey: ["users", "stats", username.toLowerCase()],
      });
    },
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
