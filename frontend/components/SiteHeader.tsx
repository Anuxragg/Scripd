"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useCurrentUser, useLogout } from "@/features/auth/hooks";
import { useProfile } from "@/features/profile/hooks";

export function SiteHeader({ theme = "light" }: { theme?: "dark" | "light" }) {
  const userQuery = useCurrentUser();
  const logoutMutation = useLogout();
  const router = useRouter();
  const profile = userQuery.data;
  const userProfileQuery = useProfile(profile?.username ?? "");
  const [localAvatar, setLocalAvatar] = useState("");

  // Sync avatar with local storage events so uploaded photos update immediately across tabs/header
  if (typeof window !== "undefined" && !localAvatar && profile?.username) {
    const cached = localStorage.getItem(`scripd_user_avatar_${profile.username}`);
    if (cached) setLocalAvatar(cached);
  }

  const avatarUrl = userProfileQuery.data?.avatar_url || localAvatar || "";

  const [searchOpen, setSearchOpen] = useState(false);
  const [navSearch, setNavSearch] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  function handleSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = navSearch.trim();
    if (query) {
      router.push(`/books?q=${encodeURIComponent(query)}`);
      setSearchOpen(false);
    }
  }

  if (theme === "dark") {
    const displayName = profile?.display_name || profile?.username || "ANUXRAG";

    return (
      <header className="sticky top-0 z-50 w-full border-b border-[#2c3440] bg-[#14181c]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          {/* Letterboxd-style 3-circle logo + Scripd Wordmark */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-white transition hover:opacity-90"
            aria-label="Scripd home"
          >
            <div className="flex -space-x-1.5 items-center" aria-hidden="true">
              <span className="h-4 w-4 rounded-full bg-[#ff8000] ring-1 ring-[#14181c]" />
              <span className="h-4 w-4 rounded-full bg-[#00e054] ring-1 ring-[#14181c]" />
              <span className="h-4 w-4 rounded-full bg-[#40bcf4] ring-1 ring-[#14181c]" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white font-sans">Scripd</span>
          </Link>

          {/* Nav Items */}
          <nav
            aria-label="Main navigation"
            className="flex items-center gap-2 sm:gap-4 text-xs font-bold uppercase tracking-wider"
          >
            {profile ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 rounded px-2 py-1 text-[#9ab] hover:text-white transition"
                  aria-expanded={userMenuOpen}
                >
                  <span className="relative flex h-6 w-6 shrink-0 overflow-hidden rounded-full border border-[#2c3440] bg-[#1e242c]">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={displayName}
                        width={24}
                        height={24}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-[#242c34] text-[9px] font-bold text-[#9ab]">
                        {displayName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="hidden sm:inline font-bold tracking-wider">
                    {displayName.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-[#678]">▼</span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-[#2c3440] bg-[#1b2228] py-2 text-xs font-medium normal-case shadow-2xl z-50">
                    <div className="flex items-center gap-2.5 border-b border-[#2c3440] px-4 py-2 text-[#678] text-[11px]">
                      <span className="relative flex h-7 w-7 shrink-0 overflow-hidden rounded-full border border-[#2c3440] bg-[#1e242c]">
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={displayName}
                            width={28}
                            height={28}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center bg-[#242c34] text-[10px] font-bold text-[#9ab]">
                            {displayName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1 truncate">
                        <div className="font-semibold text-white truncate">{displayName}</div>
                        <div className="text-[10px] text-[#89a] truncate">@{profile.username}</div>
                      </div>
                    </div>
                    <Link
                      href="/feed"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-[#9ab] hover:bg-[#242c34] hover:text-white"
                    >
                      Activity Feed
                    </Link>
                    <Link
                      href={`/u/${profile.username}`}
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-[#9ab] hover:bg-[#242c34] hover:text-white"
                    >
                      Public Profile
                    </Link>
                    <Link
                      href="/edit-profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-[#9ab] hover:bg-[#242c34] hover:text-white"
                    >
                      Edit Profile
                    </Link>
                    <Link
                      href="/library"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-[#9ab] hover:bg-[#242c34] hover:text-white"
                    >
                      My Library &amp; Diary
                    </Link>
                    <Link
                      href="/books"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-[#9ab] hover:bg-[#242c34] hover:text-white"
                    >
                      Book Catalog
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-[#9ab] hover:bg-[#242c34] hover:text-white"
                    >
                      Account Settings
                    </Link>
                    <button
                      type="button"
                      disabled={logoutMutation.isPending}
                      onClick={() => {
                        setUserMenuOpen(false);
                        logoutMutation.mutate();
                      }}
                      className="w-full text-left px-4 py-2 text-[#ff8000] hover:bg-[#242c34]"
                    >
                      {logoutMutation.isPending ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link href="/login" className="text-[#9ab] hover:text-white transition">
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="hidden sm:inline text-[#9ab] hover:text-white transition"
                >
                  Create account
                </Link>
              </div>
            )}

            {/* Activity Lightning Icon */}
            <Link
              href="/feed"
              className="text-[#9ab] hover:text-[#00e054] transition text-sm px-1"
              title="Activity Feed"
            >
              ⚡
            </Link>

            {/* Navigation Links */}
            <Link
              href="/books"
              className="hidden md:inline text-[#9ab] hover:text-white transition"
            >
              Books
            </Link>
            <Link
              href="/library"
              className="hidden md:inline text-[#9ab] hover:text-white transition"
            >
              Lists
            </Link>
            <Link
              href="/books"
              className="hidden lg:inline text-[#9ab] hover:text-white transition"
            >
              Members
            </Link>
            <Link
              href="/library"
              className="hidden lg:inline text-[#9ab] hover:text-white transition"
            >
              Journal
            </Link>

            {/* Search Toggle Icon */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSearchOpen(!searchOpen)}
                className="text-[#9ab] hover:text-white transition p-1 text-sm"
                aria-label="Search catalog"
              >
                🔍
              </button>

              {searchOpen && (
                <form
                  onSubmit={handleSearchSubmit}
                  className="absolute right-0 top-10 w-72 rounded border border-[#2c3440] bg-[#1b2228] p-2 shadow-2xl z-50"
                >
                  <div className="flex items-center">
                    <input
                      type="search"
                      autoFocus
                      placeholder="Search books, authors..."
                      value={navSearch}
                      onChange={(e) => setNavSearch(e.target.value)}
                      className="w-full bg-[#14181c] border border-[#2c3440] rounded px-3 py-1.5 text-xs text-white placeholder:text-[#678] focus:border-[#40bcf4] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="ml-2 rounded bg-[#00c030] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#00e054]"
                    >
                      Go
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Green + LOG Button */}
            <Link
              href="/books"
              className="inline-flex items-center gap-1 rounded bg-[#00c030] hover:bg-[#00e054] px-3 py-1.5 text-[11px] font-bold text-white transition shadow-sm"
            >
              <span>+ LOG</span>
              <span className="text-[8px] opacity-80">▼</span>
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  // Default Light Header
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <Link href="/" className="wordmark" aria-label="Scripd home">
        scripd<span>.</span>
      </Link>
      <nav aria-label="Main navigation" className="flex items-center gap-3 text-sm">
        <Link
          className="hidden rounded-full px-3 py-2 font-medium text-[var(--muted)] hover:text-[var(--ink)] sm:inline-flex"
          href="/books"
        >
          Discover
        </Link>
        {profile ? (
          <>
            <Link
              className="rounded-full px-3 py-2 font-medium text-[var(--muted)] hover:text-[var(--ink)]"
              href="/feed"
            >
              Feed
            </Link>
            <Link
              className="rounded-full px-3 py-2 font-medium text-[var(--muted)] hover:text-[var(--ink)]"
              href={`/u/${profile.username}`}
            >
              Profile
            </Link>
            <Link
              className="rounded-full px-3 py-2 font-medium text-[var(--muted)] hover:text-[var(--ink)]"
              href="/library"
            >
              Library
            </Link>
            <span className="hidden sm:inline-flex items-center gap-2 text-[var(--muted)]">
              <span className="relative flex h-5 w-5 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={profile.username}
                    width={20}
                    height={20}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[#40bcf4] text-[9px] font-bold text-white">
                    {profile.username.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
              <span>Reading as @{profile.username}</span>
            </span>
            <button
              className="rounded-full border border-[var(--line)] px-4 py-2 font-medium hover:bg-white disabled:opacity-60"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
              type="button"
            >
              {logoutMutation.isPending ? "Signing out…" : "Sign out"}
            </button>
            {logoutMutation.isError ? (
              <span className="sr-only" role="alert">
                Could not sign out. Try again.
              </span>
            ) : null}
          </>
        ) : (
          <>
            <Link
              className="rounded-full px-4 py-2 font-medium text-[var(--muted)] hover:text-[var(--ink)]"
              href="/login"
            >
              Sign in
            </Link>
            <Link
              className="rounded-full bg-[var(--forest)] px-4 py-2 font-medium text-white hover:bg-[var(--forest-dark)]"
              href="/signup"
            >
              Join Scripd
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
