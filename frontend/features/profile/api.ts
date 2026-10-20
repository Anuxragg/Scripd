import { z } from "zod";
import { apiRequest } from "@/lib/api/client";

export const publicProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string(),
  bio: z.string(),
  avatar_url: z.string(),
  created_at: z.string(),
});

export const profileStatsSchema = z.object({
  books_read: z.number().int(),
  currently_reading: z.number().int(),
  want_to_read: z.number().int(),
  reviews_count: z.number().int(),
});

const profileResponseSchema = z.object({
  data: publicProfileSchema,
});

const statsResponseSchema = z.object({
  data: profileStatsSchema,
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type ProfileStats = z.infer<typeof profileStatsSchema>;

export type UpdateProfileInput = {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
};

export async function getProfile(username: string): Promise<PublicProfile> {
  const response = await apiRequest(`/api/v1/users/${username}`, profileResponseSchema);
  return response.data;
}

export async function getProfileStats(username: string): Promise<ProfileStats> {
  const response = await apiRequest(`/api/v1/users/${username}/stats`, statsResponseSchema);
  return response.data;
}

export async function updateProfile(input: UpdateProfileInput): Promise<PublicProfile> {
  const response = await apiRequest("/api/v1/users/me", profileResponseSchema, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.data;
}
