"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateList } from "@/features/lists/hooks";

interface CreateListModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateListModal({ open, onClose }: CreateListModalProps) {
  const router = useRouter();
  const createMutation = useCreateList();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [listType, setListType] = useState<"unordered" | "ordered">("unordered");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setError(null);
    try {
      const created = await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        is_private: isPrivate,
      });
      onClose();
      router.push(`/lists/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create collection");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-lg border border-white/10 bg-[#12151c] p-6 shadow-2xl space-y-5"
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
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl p-1 transition rounded-md hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Collection Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
              <span>Collection Name</span>
              <span className="text-zinc-500 font-normal">{title.length}/50</span>
            </div>
            <input
              type="text"
              required
              maxLength={50}
              placeholder="Enter a name for your collection"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0e1117] px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none transition"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
              <span>Description</span>
              <span className="text-zinc-500 font-normal">{description.length}/150</span>
            </div>
            <textarea
              rows={3}
              maxLength={150}
              placeholder="Add a description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                  onClick={() => setIsPrivate(true)}
                  style={{
                    fontFamily: "Inter, Inter, sans-serif, Inter, sans-serif",
                    fontSize: "12px",
                    fontWeight: 500,
                    lineHeight: "16px",
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-md transition flex items-center justify-center gap-1.5 ${
                    isPrivate
                      ? "bg-[#242936] text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5"
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
                  onClick={() => setIsPrivate(false)}
                  style={{
                    fontFamily: "Inter, Inter, sans-serif, Inter, sans-serif",
                    fontSize: "12px",
                    fontWeight: 500,
                    lineHeight: "16px",
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-md transition flex items-center justify-center gap-1.5 ${
                    !isPrivate
                      ? "bg-[#242936] text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5"
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
                {isPrivate ? "Only you can see this collection" : "Anyone can view this collection"}
              </p>
            </div>

            {/* List Type */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-300">List Type</span>
              <div className="rounded-lg bg-[#0e1117] p-1 border border-white/10 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setListType("unordered")}
                  style={{
                    fontFamily: "Inter, Inter, sans-serif, Inter, sans-serif",
                    fontSize: "12px",
                    fontWeight: 500,
                    lineHeight: "16px",
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-md transition flex items-center justify-center gap-1.5 ${
                    listType === "unordered"
                      ? "bg-[#242936] text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5"
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
                  onClick={() => setListType("ordered")}
                  style={{
                    fontFamily: "Inter, Inter, sans-serif, Inter, sans-serif",
                    fontSize: "12px",
                    fontWeight: 500,
                    lineHeight: "16px",
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-md transition flex items-center justify-center gap-1.5 ${
                    listType === "ordered"
                      ? "bg-[#242936] text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5"
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
                {listType === "unordered"
                  ? "Items are in a simple list"
                  : "Items are ranked in order"}
              </p>
            </div>
          </div>

          {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={!title.trim() || createMutation.isPending}
              className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 text-sm transition shadow-lg shadow-purple-900/30 cursor-pointer"
            >
              {createMutation.isPending ? "Creating Collection…" : "Create Collection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
