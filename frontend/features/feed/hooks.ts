"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getFeed, type FeedPage } from "@/features/feed/api";

export function useFeed(limit = 20) {
  return useInfiniteQuery<FeedPage, Error>({
    queryKey: ["feed", limit],
    queryFn: ({ pageParam }) => getFeed(pageParam as string | undefined, limit),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}
