"use client";

import { useQuery } from "@tanstack/react-query";
import { getBook, searchBooks } from "@/features/books/api";

export function useBookSearch(query: string, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ["books", "search", query, page],
    queryFn: () => searchBooks(query, page),
    enabled: enabled && query.length >= 2,
    staleTime: 60_000,
    retry: 1,
  });
}

import type { Book } from "@/features/books/api";

export function useBook(bookID: string, initialData?: Book | null) {
  return useQuery({
    queryKey: ["books", "detail", bookID],
    queryFn: () => getBook(bookID),
    enabled: Boolean(bookID),
    initialData: initialData ?? undefined,
    staleTime: 5 * 60_000,
  });
}
