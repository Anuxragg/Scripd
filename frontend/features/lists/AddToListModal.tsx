"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/features/auth/hooks";
import {
  useAddBookToList,
  useBookLists,
  useCreateList,
  useMyLists,
  useRemoveBookFromList,
} from "@/features/lists/hooks";

interface AddToListModalProps {
  bookID: string;
  bookTitle: string;
  open: boolean;
  onClose: () => void;
}

type TabType = "public" | "private";

export function AddToListModal({ bookID, bookTitle, open, onClose }: AddToListModalProps) {
  if (!open) return null;

  return <AddToListDialog bookID={bookID} bookTitle={bookTitle} onClose={onClose} />;
}

function AddToListDialog({
  bookID,
  bookTitle,
  onClose,
}: {
  bookID: string;
  bookTitle: string;
  onClose: () => void;
}) {
  const userQuery = useCurrentUser();
  const user = userQuery.data;

  const myListsQuery = useMyLists(Boolean(user));
  const bookListsQuery = useBookLists(bookID, Boolean(user));

  const addMutation = useAddBookToList();
  const removeMutation = useRemoveBookFromList();
  const createMutation = useCreateList();

  const [mode, setMode] = useState<"select" | "create">("select");
  const [activeTab, setActiveTab] = useState<TabType>("public");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOverrides, setSelectedOverrides] = useState<Record<string, boolean>>({});

  // "Create New Collection" form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsPrivate, setNewIsPrivate] = useState(true);
  const [newListType, setNewListType] = useState<"unordered" | "ordered">("unordered");
  const [createError, setCreateError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mode === "create") {
          setMode("select");
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, onClose]);

  const initialSet = useMemo(() => new Set(bookListsQuery.data ?? []), [bookListsQuery.data]);

  const isListSelected = (listID: string): boolean => {
    if (listID in selectedOverrides) {
      return selectedOverrides[listID];
    }
    return initialSet.has(listID);
  };

  // Filter lists by tab and search query
  const filteredLists = useMemo(() => {
    const lists = myListsQuery.data ?? [];
    return lists.filter((list) => {
      const matchesTab = activeTab === "public" ? !list.is_private : list.is_private;
      if (!matchesTab) return false;
      if (!searchQuery.trim()) return true;
      return list.title.toLowerCase().includes(searchQuery.trim().toLowerCase());
    });
  }, [myListsQuery.data, activeTab, searchQuery]);

  function handleToggleList(listID: string) {
    setSelectedOverrides((prev) => ({
      ...prev,
      [listID]: !isListSelected(listID),
    }));
  }

  async function handleCreateCollection(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;

    setCreateError(null);
    try {
      const created = await createMutation.mutateAsync({
        title: trimmedTitle,
        description: newDescription.trim() || undefined,
        is_private: newIsPrivate,
      });

      // Automatically add book to newly created collection
      await addMutation.mutateAsync({
        listID: created.id,
        input: { book_id: bookID, title: bookTitle },
      });

      setSelectedOverrides((prev) => ({
        ...prev,
        [created.id]: true,
      }));

      // Switch active tab to match the created list's privacy
      setActiveTab(newIsPrivate ? "private" : "public");
      setNewTitle("");
      setNewDescription("");
      setMode("select");
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create collection");
    }
  }

  async function handleSave() {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const allLists = myListsQuery.data ?? [];
      const toAdd: string[] = [];
      const toRemove: string[] = [];

      for (const list of allLists) {
        const initiallyIn = initialSet.has(list.id);
        const currentlySelected = isListSelected(list.id);
        if (currentlySelected && !initiallyIn) {
          toAdd.push(list.id);
        } else if (!currentlySelected && initiallyIn) {
          toRemove.push(list.id);
        }
      }

      await Promise.all([
        ...toAdd.map((listID) =>
          addMutation.mutateAsync({
            listID,
            input: { book_id: bookID, title: bookTitle },
          }),
        ),
        ...toRemove.map((listID) =>
          removeMutation.mutateAsync({
            listID,
            bookID,
          }),
        ),
      ]);

      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to update lists");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {mode === "create" ? (
        /* CREATE NEW COLLECTION VIEW */
        <div
          className="w-full max-w-[480px] rounded-lg border border-white/10 bg-[#12151c] p-6 shadow-2xl space-y-5 text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-1">
            <h3
              style={{
                fontFamily: "Inter, Inter, sans-serif, Inter, sans-serif",
                fontSize: "20px",
                fontWeight: 600,
                lineHeight: "28px",
                color: "rgb(255, 255, 255)",
              }}
              className="tracking-tight"
            >
              Create New Collection
            </h3>
            <button
              type="button"
              onClick={() => setMode("select")}
              className="text-zinc-400 hover:text-white text-xl p-1 transition rounded-md hover:bg-white/10 cursor-pointer"
              aria-label="Back to lists"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleCreateCollection} className="space-y-4">
            {/* Collection Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                <span>Collection Name</span>
                <span className="text-zinc-500 font-normal">{newTitle.length}/50</span>
              </div>
              <input
                type="text"
                required
                maxLength={50}
                placeholder="Enter a name for your collection"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-white/10 bg-[#0e1117] px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none transition"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                <span>Description</span>
                <span className="text-zinc-500 font-normal">{newDescription.length}/150</span>
              </div>
              <textarea
                rows={3}
                maxLength={150}
                placeholder="Add a description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0e1117] px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none resize-none transition"
              />
            </div>

            {/* Visibility and List Type Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Visibility */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-zinc-300">Visibility</span>
                <div className="rounded-lg bg-[#0e1117] p-1 border border-white/10 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setNewIsPrivate(true)}
                    style={{
                      fontFamily: "Inter, Inter, sans-serif, Inter, sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      lineHeight: "16px",
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-md transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      newIsPrivate
                        ? "bg-[#242936] text-white shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Private</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewIsPrivate(false)}
                    style={{
                      fontFamily: "Inter, Inter, sans-serif, Inter, sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      lineHeight: "16px",
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-md transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      !newIsPrivate
                        ? "bg-[#242936] text-white shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    <span>Public</span>
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  {newIsPrivate
                    ? "Only you can see this watchlist"
                    : "Anyone can view this collection"}
                </p>
              </div>

              {/* List Type */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-zinc-300">List Type</span>
                <div className="rounded-lg bg-[#0e1117] p-1 border border-white/10 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setNewListType("unordered")}
                    style={{
                      fontFamily: "Inter, Inter, sans-serif, Inter, sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      lineHeight: "16px",
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-md transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      newListType === "unordered"
                        ? "bg-[#242936] text-white shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    <span>Unordered</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewListType("ordered")}
                    style={{
                      fontFamily: "Inter, Inter, sans-serif, Inter, sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      lineHeight: "16px",
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-md transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      newListType === "ordered"
                        ? "bg-[#242936] text-white shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="10" y1="6" x2="21" y2="6" />
                      <line x1="10" y1="12" x2="21" y2="12" />
                      <line x1="10" y1="18" x2="21" y2="18" />
                      <path d="M4 6h1v4" />
                      <path d="M4 10h2" />
                    </svg>
                    <span>Ordered</span>
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  {newListType === "unordered"
                    ? "Items are in a simple list"
                    : "Items are ranked in order"}
                </p>
              </div>
            </div>

            {createError && <p className="text-xs text-rose-400 font-medium">{createError}</p>}

            <div className="pt-2">
              <button
                type="submit"
                disabled={!newTitle.trim() || createMutation.isPending}
                className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 text-sm transition shadow-lg shadow-purple-900/30 cursor-pointer"
              >
                {createMutation.isPending ? "Creating Collection…" : "Create Collection"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* SELECT LISTS VIEW */
        <div
          className="w-full max-w-[480px] overflow-hidden rounded-lg bg-[#12151c] text-white shadow-2xl border border-white/10 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <h3
              style={{
                fontFamily: "Inter, Inter, sans-serif, Inter, sans-serif",
                fontSize: "20px",
                fontWeight: 600,
                lineHeight: "28px",
                color: "rgb(255, 255, 255)",
              }}
              className="tracking-tight truncate pr-4"
            >
              Add ‘{bookTitle}’ to lists
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-white text-2xl font-light leading-none p-1 transition cursor-pointer shrink-0"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {!user ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm text-zinc-400">
                Sign in to save books to your personal collections.
              </p>
              <Link
                href="/login"
                className="inline-block rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-2 text-xs transition shadow-lg shadow-purple-900/30"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <>
              {/* Tab Switcher: Public / Private */}
              <div className="px-6 pb-3">
                <div className="w-full rounded-lg bg-[#0e1117] p-1 border border-white/10 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("public")}
                    style={{
                      fontFamily: "Inter, Inter, sans-serif, Inter, sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      lineHeight: "16px",
                    }}
                    className={`flex-1 py-1.5 text-center rounded-md transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTab === "public"
                        ? "bg-[#242936] text-white shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    <span>Public</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("private")}
                    style={{
                      fontFamily: "Inter, Inter, sans-serif, Inter, sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      lineHeight: "16px",
                    }}
                    className={`flex-1 py-1.5 text-center rounded-md transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTab === "private"
                        ? "bg-[#242936] text-white shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Private</span>
                  </button>
                </div>
              </div>

              {/* Sub-bar: + New list... and Type to search */}
              <div className="border-t border-b border-white/10 bg-[#10131b] px-6 py-2.5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode("create");
                    setNewIsPrivate(activeTab === "private");
                    setCreateError(null);
                  }}
                  className="text-xs sm:text-sm text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer transition shrink-0"
                >
                  <span>+ New list...</span>
                </button>

                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="Type to search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#090b0f] border border-white/10 rounded-md px-2.5 py-1 text-xs text-white placeholder-zinc-500 pr-7 outline-none focus:border-purple-500 transition-all w-32 sm:w-40 focus:w-48"
                  />
                  <svg
                    className="w-3.5 h-3.5 text-zinc-500 absolute right-2 pointer-events-none"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
              </div>

              {/* List items area */}
              <div className="min-h-[140px] max-h-[240px] overflow-y-auto px-6 py-2">
                {myListsQuery.isLoading || bookListsQuery.isLoading ? (
                  <div className="space-y-2 py-4">
                    <div className="h-9 w-full bg-white/5 rounded-lg animate-pulse" />
                    <div className="h-9 w-full bg-white/5 rounded-lg animate-pulse" />
                  </div>
                ) : filteredLists.length === 0 ? (
                  <div className="flex items-center justify-center min-h-[120px] text-sm text-zinc-500 font-normal">
                    {searchQuery.trim()
                      ? `No lists match “${searchQuery}”.`
                      : activeTab === "public"
                        ? "You have no public lists."
                        : "You have no private lists."}
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {filteredLists.map((list) => {
                      const isChecked = isListSelected(list.id);

                      return (
                        <div
                          key={list.id}
                          onClick={() => handleToggleList(list.id)}
                          className="group flex items-center justify-between py-2.5 px-3 -mx-3 rounded-lg hover:bg-white/5 transition cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-3">
                            <div
                              className={`w-4 h-4 rounded border transition flex items-center justify-center shrink-0 ${
                                isChecked
                                  ? "border-purple-500 bg-purple-600 text-white shadow-sm shadow-purple-900/30"
                                  : "border-white/20 bg-[#090b0f] group-hover:border-white/40"
                              }`}
                            >
                              {isChecked && (
                                <svg
                                  className="w-3 h-3 text-white"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={3.5}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                            <span className="text-xs sm:text-sm font-medium text-zinc-200 group-hover:text-white truncate">
                              {list.title}
                            </span>
                          </div>
                          <span className="text-xs text-zinc-500 shrink-0">
                            {list.item_count} {list.item_count === 1 ? "book" : "books"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Footer */}
              <div className="bg-[#0e1117] px-6 py-3.5 flex items-center justify-between border-t border-white/10">
                <div className="min-w-0 pr-2">
                  {submitError && (
                    <p className="text-xs text-rose-400 font-medium truncate">{submitError}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="rounded-full bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold text-sm px-7 py-2 shadow-lg shadow-purple-900/30 transition disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {isSubmitting ? "Saving…" : "Add"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
