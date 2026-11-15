"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/features/auth/hooks";
import {
  getProfile,
  getProfileStats,
  updateProfile,
  addFavoriteBook,
  removeFavoriteBook,
  getFollowStatus,
  followUser,
  unfollowUser,
  type PublicProfile,
  type UpdateProfileInput,
  type AddFavoriteBookInput,
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
  const userQuery = useCurrentUser();
  const viewer = userQuery.data?.username?.toLowerCase() ?? "anonymous";
  return useQuery({
    queryKey: ["users", "follow-status", viewer, username.toLowerCase()],
    queryFn: () => getFollowStatus(username),
    enabled: Boolean(username.trim()),
    staleTime: 5_000,
  });
}

export function useFollowUser(username: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => followUser(username),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["users", "follow-status"],
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
        queryKey: ["users", "follow-status"],
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
    onSuccess: (updatedProfile) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "current-user"] });
      if (username) {
        queryClient.invalidateQueries({
          queryKey: ["users", "profile", username.toLowerCase()],
        });
      }
      if (updatedProfile?.username) {
        queryClient.setQueryData(
          ["users", "profile", updatedProfile.username.toLowerCase()],
          updatedProfile,
        );
      }
    },
  });
}

export function useAddFavoriteBook(username: string) {
  const queryClient = useQueryClient();
  const profileKey = ["users", "profile", username.toLowerCase()] as const;
  return useMutation({
    mutationFn: (input: AddFavoriteBookInput) => addFavoriteBook(input),
    onSuccess: async (favorite) => {
      queryClient.setQueryData<PublicProfile>(profileKey, (current) => {
        if (!current) return current;
        const favoriteBooks = current.favorite_books.filter(
          (book) => book.open_library_key !== favorite.open_library_key,
        );
        return {
          ...current,
          favorite_books: [...favoriteBooks, favorite].sort((a, b) => a.position - b.position),
        };
      });
      await queryClient.invalidateQueries({ queryKey: profileKey });
    },
  });
}

export function useRemoveFavoriteBook(username: string) {
  const queryClient = useQueryClient();
  const profileKey = ["users", "profile", username.toLowerCase()] as const;
  return useMutation({
    mutationFn: (openLibraryKey: string) => removeFavoriteBook(openLibraryKey),
    onSuccess: async (_result, openLibraryKey) => {
      queryClient.setQueryData<PublicProfile>(profileKey, (current) => {
        if (!current) return current;
        const remainingFavorites = current.favorite_books.filter(
          (book) => book.open_library_key !== openLibraryKey,
        );
        return { ...current, favorite_books: remainingFavorites };
      });
      await queryClient.invalidateQueries({ queryKey: profileKey });
    },
  });
}
