"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCurrentUser, useLogout } from "@/features/auth/hooks";
import { useFeed } from "@/features/feed/hooks";
import { useProfile } from "@/features/profile/hooks";

interface NotificationItem {
  id: string;
  type: "like" | "follow" | "comment" | "activity";
  user: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  content: string;
  targetUrl: string;
  createdAt: string;
}

function formatTimeAgo(dateString: string): string {
  try {
    const diff = Math.max(0, Date.now() - new Date(dateString).getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "Recently";
  }
}

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
  const [browseMenuOpen, setBrowseMenuOpen] = useState(false);
  const browseMenuRef = useRef<HTMLDivElement>(null);

  const feedQuery = useFeed(10);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState<"all" | "updates" | "activity">("all");
  const [readIds, setReadIds] = useState<string[]>([]);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Derive real notifications from actual feed activity
  const feedItems =
    profile && feedQuery.data ? feedQuery.data.pages.flatMap((page) => page.items) : [];

  const activityNotifications: NotificationItem[] = feedItems.map((item) => {
    let actionText = `logged "${item.book.title}"`;
    if (item.status === "read") {
      actionText = item.rating
        ? `read and rated "${item.book.title}" ${item.rating}★`
        : `finished reading "${item.book.title}"`;
    } else if (item.status === "reading") {
      actionText = `started reading "${item.book.title}"`;
    } else if (item.status === "want_to_read") {
      actionText = `wants to read "${item.book.title}"`;
    }

    return {
      id: item.id,
      type: "activity",
      user: {
        username: item.user.username,
        display_name: item.user.display_name,
        avatar_url: item.user.avatar_url,
      },
      content: actionText,
      targetUrl: `/books/${item.book.id}`,
      createdAt: formatTimeAgo(item.created_at),
    };
  });

  // Real notifications list (empty when no user interactions/follows exist)
  const allNotifications = activityNotifications;
  const filteredNotifications = allNotifications.filter((n) => {
    if (notificationTab === "updates")
      return n.type === "like" || n.type === "follow" || n.type === "comment";
    if (notificationTab === "activity") return n.type === "activity";
    return true;
  });

  const unreadCount = allNotifications.filter((n) => !readIds.includes(n.id)).length;

  function markAllAsRead() {
    setReadIds(allNotifications.map((n) => n.id));
  }

  function markAsRead(id: string) {
    if (!readIds.includes(id)) {
      setReadIds((prev) => [...prev, id]);
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (browseMenuRef.current && !browseMenuRef.current.contains(event.target as Node)) {
        setBrowseMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
            className="flex items-center gap-6 sm:gap-8 uppercase tracking-wider"
          >
            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-5 sm:gap-7">
              <Link href="/books" className="navbar-option text-white hover:text-white/80">
                Books
              </Link>
              <Link href="/library" className="navbar-option text-white hover:text-white/80">
                Lists
              </Link>
              <Link
                href="/books"
                className="hidden lg:inline navbar-option text-white hover:text-white/80"
              >
                Members
              </Link>
            </div>

            {/* Right Action Icons & Profile with increased spacing */}
            <div className="flex items-center gap-4 sm:gap-8">
              {/* Bento Grid Categories & Collections Button */}
              <div className="relative" ref={browseMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setBrowseMenuOpen((prev) => !prev);
                    setSearchOpen(false);
                    setUserMenuOpen(false);
                  }}
                  className={`flex items-center justify-center p-1 transition ${
                    browseMenuOpen ? "text-[#40bcf4]" : "text-white hover:text-white/80"
                  }`}
                  aria-label="Browse categories and filters"
                  title="Browse categories"
                >
                  <svg
                    className="h-5 w-5 sm:h-5.25 sm:w-5.25"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.9}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" />
                    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" />
                    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" />
                    <rect x="14" y="14" width="6.5" height="6.5" rx="1.5" />
                  </svg>
                </button>

                {browseMenuOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-11 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[#222734] bg-[#0c0e14]/98 backdrop-blur-2xl p-2.5 sm:p-3 shadow-2xl shadow-black/80 z-50">
                    <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                      <Link
                        href="/books?q=category"
                        onClick={() => setBrowseMenuOpen(false)}
                        className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#232836] bg-[#13161f] py-4.5 px-2 text-center transition-colors duration-200 hover:border-white/20 hover:bg-[#181c26]"
                      >
                        <svg
                          className="h-6 w-6 text-[#cad3e2] transition-colors duration-200 group-hover:text-white"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path d="M12 3.5L7.5 11h9L12 3.5z" strokeLinejoin="round" />
                          <rect x="4" y="14" width="6.5" height="6.5" rx="1.5" />
                          <rect x="13.5" y="14" width="6.5" height="6.5" rx="1.5" />
                        </svg>
                        <span className="normal-case tracking-normal text-xs font-semibold text-[#e1e7f0] transition-colors duration-200 group-hover:text-white">
                          Category
                        </span>
                      </Link>

                      <Link
                        href="/books?q=language"
                        onClick={() => setBrowseMenuOpen(false)}
                        className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#232836] bg-[#13161f] py-4.5 px-2 text-center transition-colors duration-200 hover:border-white/20 hover:bg-[#181c26]"
                      >
                        <svg
                          className="h-6 w-6 text-[#cad3e2] transition-colors duration-200 group-hover:text-white"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 5h12M9 3v2m1 14l3.5-9 3.5 9m-6-3h5M4 17C6.5 16 8.5 14 10 11.5M13 19c-2-2-3.5-4.5-4.5-7.5"
                          />
                        </svg>
                        <span className="normal-case tracking-normal text-xs font-semibold text-[#e1e7f0] transition-colors duration-200 group-hover:text-white">
                          Language
                        </span>
                      </Link>

                      <Link
                        href="/books?q=country"
                        onClick={() => setBrowseMenuOpen(false)}
                        className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#232836] bg-[#13161f] py-4.5 px-2 text-center transition-colors duration-200 hover:border-white/20 hover:bg-[#181c26]"
                      >
                        <svg
                          className="h-6 w-6 text-[#cad3e2] transition-colors duration-200 group-hover:text-white"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M3.6 9h16.8M3.6 15h16.8" />
                          <path d="M12 3a14.5 14.5 0 0 0 0 18M12 3a14.5 14.5 0 0 1 0 18" />
                        </svg>
                        <span className="normal-case tracking-normal text-xs font-semibold text-[#e1e7f0] transition-colors duration-200 group-hover:text-white">
                          Country
                        </span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Notification Bell Dropdown */}
              <div className="relative" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen((prev) => !prev);
                    setBrowseMenuOpen(false);
                    setSearchOpen(false);
                    setUserMenuOpen(false);
                  }}
                  className={`relative flex items-center justify-center p-1 transition ${
                    notificationsOpen ? "text-[#40bcf4]" : "text-white hover:text-white/80"
                  }`}
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <svg
                    className="h-5 w-5 sm:h-5.25 sm:w-5.25"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.9}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-[#00e054] ring-2 ring-[#050505]" />
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-10 w-85 sm:w-95 max-w-[calc(100vw-2rem)] rounded-2xl border border-[#262c36] bg-[#12141a]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-4 pb-2.5">
                      <h3 className="text-base font-bold text-white tracking-tight">
                        Notifications
                      </h3>
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        title="Mark all as read"
                        className="text-[#778] hover:text-[#40bcf4] transition p-1"
                      >
                        <svg
                          className="h-4.5 w-4.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Tabs: All | Updates | Activity */}
                    <div className="grid grid-cols-3 border-b border-[#222834] text-center text-[13px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setNotificationTab("all")}
                        className={`pb-3 pt-1 transition relative ${
                          notificationTab === "all"
                            ? "text-white after:absolute after:bottom-0 after:left-4 after:right-4 after:h-0.5 after:bg-white"
                            : "text-[rgb(119,119,119)] hover:text-white"
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotificationTab("updates")}
                        className={`pb-3 pt-1 transition relative ${
                          notificationTab === "updates"
                            ? "text-white after:absolute after:bottom-0 after:left-4 after:right-4 after:h-0.5 after:bg-white"
                            : "text-[rgb(119,119,119)] hover:text-white"
                        }`}
                      >
                        Updates
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotificationTab("activity")}
                        className={`pb-3 pt-1 transition relative ${
                          notificationTab === "activity"
                            ? "text-white after:absolute after:bottom-0 after:left-4 after:right-4 after:h-0.5 after:bg-white"
                            : "text-[rgb(119,119,119)] hover:text-white"
                        }`}
                      >
                        Activity
                      </button>
                    </div>

                    {/* Content Area */}
                    <div className="min-h-65 flex flex-col justify-center overflow-y-auto scrollbar-thin">
                      {filteredNotifications.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center py-12 px-6 text-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1b2028] text-[#678] mb-4">
                            <svg
                              className="h-8 w-8"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.8}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                              />
                            </svg>
                          </div>
                          <p className="notification-empty-title">No notifications here</p>
                          <p className="notification-empty-subtext mt-0.5">
                            Check back later for new updates.
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-[#1e2430] py-1">
                          {filteredNotifications.map((n) => {
                            const isRead = readIds.includes(n.id);
                            return (
                              <Link
                                key={n.id}
                                href={n.targetUrl}
                                onClick={() => {
                                  markAsRead(n.id);
                                  setNotificationsOpen(false);
                                }}
                                className={`flex items-start gap-3 px-5 py-3.5 transition hover:bg-[#171c24] group ${
                                  !isRead ? "bg-[#171c24]/50" : ""
                                }`}
                              >
                                <div className="relative shrink-0">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#202734] border border-[#2d3646] overflow-hidden text-xs font-bold text-white">
                                    {n.user.avatar_url ? (
                                      <Image
                                        src={n.user.avatar_url}
                                        alt={n.user.display_name}
                                        width={36}
                                        height={36}
                                        unoptimized
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      n.user.display_name.slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#12141a] text-[10px] border border-[#262c36]">
                                    {n.type === "like" && "❤️"}
                                    {n.type === "follow" && "👤"}
                                    {n.type === "comment" && "💬"}
                                    {n.type === "activity" && "📖"}
                                  </span>
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-[#cad3e0] leading-snug">
                                    <strong className="text-white font-semibold hover:underline">
                                      {n.user.display_name}
                                    </strong>{" "}
                                    {n.content}
                                  </p>
                                  <span className="text-xs text-[#678] mt-1 block">
                                    {n.createdAt}
                                  </span>
                                </div>

                                {!isRead && (
                                  <span className="h-2 w-2 rounded-full bg-[#00e054] shrink-0 mt-1.5" />
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Search Toggle Icon */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(!searchOpen);
                    setBrowseMenuOpen(false);
                    setUserMenuOpen(false);
                  }}
                  className={`flex items-center justify-center p-1 transition ${
                    searchOpen ? "text-[#40bcf4]" : "text-white hover:text-white/80"
                  }`}
                  aria-label="Search catalog"
                >
                  <svg
                    className="h-5 w-5 sm:h-5.25 sm:w-5.25"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.9}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="7.5" />
                    <line x1="21" y1="21" x2="16.5" y2="16.5" />
                  </svg>
                </button>

                {searchOpen && (
                  <form
                    onSubmit={handleSearchSubmit}
                    className="absolute left-1/2 -translate-x-1/2 top-10 w-72 max-w-[calc(100vw-2rem)] rounded border border-[#2c3440] bg-[#1b2228] p-2 shadow-2xl z-50"
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

              {/* Profile Dropdown or Sign In on the Far Right */}
              {profile ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(!userMenuOpen);
                      setBrowseMenuOpen(false);
                      setSearchOpen(false);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1 text-left transition-colors focus:outline-none w-[145px] ${
                      userMenuOpen
                        ? "bg-[#5b6c7d] rounded-t-md border-t border-x border-[#4d5c6b] border-b border-black/15 z-50 relative"
                        : "rounded-md hover:bg-white/5 border border-transparent"
                    }`}
                    aria-expanded={userMenuOpen}
                    aria-label="User account menu"
                  >
                    <span className="relative flex h-7 w-7 sm:h-7.25 sm:w-7.25 shrink-0 overflow-hidden rounded-full ring-1 ring-[#2c3440] group-hover:ring-[#40bcf4]/60 bg-[#1e242c]">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt={displayName}
                          width={30}
                          height={30}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-[#242c34] text-[10px] font-bold text-[#9ab]">
                          {displayName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="navbar-option text-white truncate">{profile.username}</span>
                      <svg
                        className={`h-3 w-3 text-white shrink-0 transition-transform duration-200 ${
                          userMenuOpen ? "rotate-180" : ""
                        }`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute top-full left-0 w-[145px] rounded-b-md bg-[#5b6c7d] pb-1 text-xs shadow-2xl z-50 overflow-hidden border-b border-x border-[#4d5c6b] normal-case tracking-normal">
                      <div className="flex flex-col">
                        {[
                          { label: "Home", href: "/feed" },
                          { label: "Profile", href: `/u/${profile.username}` },
                          { label: "Books", href: "/books" },
                          { label: "Diary", href: "/library" },
                          { label: "Reviews", href: `/u/${profile.username}` },
                          { label: "Likes", href: `/u/${profile.username}` },
                          { label: "Network", href: "/feed" },
                        ].map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            onClick={() => setUserMenuOpen(false)}
                            className="px-3 py-1 text-[15px] font-normal text-[#1c2733] hover:text-white hover:bg-black/15 transition block"
                          >
                            {item.label}
                          </Link>
                        ))}

                        <div className="border-t border-black/15 my-0.5" />

                        {[
                          { label: "Settings", href: "/settings" },
                          {
                            label: logoutMutation.isPending ? "Signing Out…" : "Sign Out",
                            onClick: () => logoutMutation.mutate(),
                            disabled: logoutMutation.isPending,
                          },
                        ].map((item) =>
                          item.href ? (
                            <Link
                              key={item.label}
                              href={item.href}
                              onClick={() => setUserMenuOpen(false)}
                              className="px-3 py-1 text-[15px] font-normal text-[#1c2733] hover:text-white hover:bg-black/15 transition block"
                            >
                              {item.label}
                            </Link>
                          ) : (
                            <button
                              key={item.label}
                              type="button"
                              disabled={item.disabled}
                              onClick={() => {
                                setUserMenuOpen(false);
                                item.onClick?.();
                              }}
                              className="px-3 py-1 text-[15px] font-normal text-[#1c2733] hover:text-white hover:bg-black/15 transition block w-full text-left cursor-pointer"
                            >
                              {item.label}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 sm:gap-4">
                  <Link href="/login" className="navbar-option text-white hover:text-white/80">
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="hidden sm:inline navbar-option text-white hover:text-white/80"
                  >
                    Create account
                  </Link>
                </div>
              )}
            </div>
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
          className="hidden rounded-full px-3 py-2 font-medium text-(--muted) hover:text-(--ink) sm:inline-flex"
          href="/books"
        >
          Discover
        </Link>
        {profile ? (
          <>
            <Link
              className="rounded-full px-3 py-2 font-medium text-(--muted) hover:text-(--ink)"
              href="/feed"
            >
              Feed
            </Link>
            <Link
              className="rounded-full px-3 py-2 font-medium text-(--muted) hover:text-(--ink)"
              href={`/u/${profile.username}`}
            >
              Profile
            </Link>
            <Link
              className="rounded-full px-3 py-2 font-medium text-(--muted) hover:text-(--ink)"
              href="/library"
            >
              Library
            </Link>
            <span className="hidden sm:inline-flex items-center gap-2 text-(--muted)">
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
              className="rounded-full border border-(--line) px-4 py-2 font-medium hover:bg-white disabled:opacity-60"
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
              className="rounded-full px-4 py-2 font-medium text-(--muted) hover:text-(--ink)"
              href="/login"
            >
              Sign in
            </Link>
            <Link
              className="rounded-full bg-(--forest) px-4 py-2 font-medium text-white hover:bg-(--forest-dark)"
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
