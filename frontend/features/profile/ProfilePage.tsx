"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCurrentUser } from "@/features/auth/hooks";
import { useProfile, useProfileStats, useUpdateProfile } from "@/features/profile/hooks";

export function ProfilePage({ username }: { username: string }) {
  const userQuery = useCurrentUser();
  const profileQuery = useProfile(username);
  const statsQuery = useProfileStats(username);
  const updateMutation = useUpdateProfile(username);

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarURL, setAvatarURL] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentUserID = userQuery.data?.id;
  const profile = profileQuery.data;
  const isOwner = Boolean(currentUserID && profile && currentUserID === profile.id);

  function openEditModal() {
    if (!profile) return;
    setDisplayName(profile.display_name || "");
    setBio(profile.bio || "");
    setAvatarURL(profile.avatar_url || "");
    setErrorMessage(null);
    setIsEditing(true);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    try {
      await updateMutation.mutateAsync({
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarURL.trim(),
      });
      setIsEditing(false);
    } catch {
      setErrorMessage("Unable to save profile changes. Please try again.");
    }
  }

  if (profileQuery.isPending) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-4xl animate-pulse space-y-6">
          <div className="h-32 rounded-3xl bg-[#e9e6df]" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-[#e9e6df]" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-white p-8 text-center">
          <h1 className="font-serif text-2xl text-[var(--ink)]">Reader Not Found</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            We couldn’t find a member with the username &ldquo;@{username}&rdquo;.
          </p>
          <Link
            href="/books"
            className="mt-6 inline-flex rounded-full bg-[var(--forest)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Explore books
          </Link>
        </div>
      </main>
    );
  }

  const initial = (profile.display_name || profile.username).charAt(0).toUpperCase();
  const joinedDate = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 pb-20 pt-8 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Navigation Breadcrumb */}
        <Link className="text-sm font-semibold text-[var(--forest)] hover:underline" href="/books">
          ← Back to books
        </Link>

        {/* Profile Header Card */}
        <section className="relative rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-5">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  width={80}
                  height={80}
                  unoptimized
                  className="h-20 w-20 rounded-full border border-[var(--line)] object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--forest-tint)] font-serif text-3xl font-bold text-[var(--forest)]">
                  {initial}
                </div>
              )}

              <div>
                <h1 className="font-serif text-3xl font-bold text-[var(--ink)]">
                  {profile.display_name}
                </h1>
                <p className="text-sm text-[var(--muted)]">@{profile.username}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Joined {joinedDate}</p>
              </div>
            </div>

            {isOwner && (
              <button
                type="button"
                onClick={openEditModal}
                className="self-start sm:self-center rounded-full border border-[var(--line)] bg-white px-5 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--forest)] hover:text-[var(--forest)]"
              >
                Edit profile
              </button>
            )}
          </div>

          {/* Bio */}
          <div className="mt-6 border-t border-[var(--line)] pt-5">
            <p className="text-sm leading-relaxed text-[var(--ink)] whitespace-pre-line">
              {profile.bio || (
                <span className="italic text-[var(--muted)]">
                  No bio provided yet. A quiet reader.
                </span>
              )}
            </p>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-[var(--forest)]">
              {statsQuery.data?.books_read ?? 0}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Books Read
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-[var(--forest)]">
              {statsQuery.data?.currently_reading ?? 0}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Reading
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-[var(--forest)]">
              {statsQuery.data?.want_to_read ?? 0}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Want to Read
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-[var(--forest)]">
              {statsQuery.data?.reviews_count ?? 0}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Reviews
            </p>
          </div>
        </section>

        {/* Edit Profile Modal Dialog */}
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8 shadow-xl">
              <h2 className="font-serif text-2xl font-bold text-[var(--ink)]">Edit Profile</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Update your public persona on Scripd.
              </p>

              {errorMessage && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)]">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={80}
                    className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--forest)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)]">Bio</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                    placeholder="Tell other readers about your favorite genres, writers, or current book goals..."
                    className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white p-3 text-sm text-[var(--ink)] focus:border-[var(--forest)] focus:outline-none resize-none"
                  />
                  <div className="mt-1 text-right text-xs text-[var(--muted)]">
                    {bio.length} / 500
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)]">
                    Avatar URL
                  </label>
                  <input
                    type="url"
                    value={avatarURL}
                    onChange={(e) => setAvatarURL(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--forest)] focus:outline-none"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-[var(--line)]">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={updateMutation.isPending}
                    className="rounded-full border border-[var(--line)] px-5 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="rounded-full bg-[var(--forest)] px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
