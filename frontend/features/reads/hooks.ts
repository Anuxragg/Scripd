"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createRead,
  deleteRead,
  listReads,
  updateRead,
  type CreateReadInput,
  type ReadFilter,
  type ReadInput,
} from "@/features/reads/api";

export function useReadEntries(filter: ReadFilter, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["reads", filter],
    queryFn: ({ pageParam }) => listReads(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.next_cursor ?? undefined,
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

export function useCreateRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReadInput) => createRead(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reads"] }),
  });
}

export function useUpdateRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryID, input }: { entryID: string; input: ReadInput }) =>
      updateRead(entryID, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reads"] }),
  });
}

export function useDeleteRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reads"] }),
  });
}
