"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BookMarqueeColumns } from "@/features/auth/BookMarqueeColumns";

interface AuthLayoutProps {
  children: ReactNode;
  footerText: string;
  footerLinkText: string;
  footerLinkHref: string;
}

export function AuthLayout({
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
}: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen w-full bg-[#0a0b0d] text-white overflow-hidden">
      {/* LEFT / SIDE AREA: 3 Vertical Moving Columns of Book Covers */}
      <div className="hidden lg:block lg:w-[50%] xl:w-[55%] h-screen sticky top-0 overflow-hidden border-r border-white/5">
        <BookMarqueeColumns />
      </div>

      {/* RIGHT / CREDENTIALS AREA */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-12 relative min-h-screen">
        {/* Background ambient glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <div className="h-[450px] w-[450px] rounded-full bg-purple-600/10 blur-[130px]" />
        </div>

        <div className="w-full max-w-md relative z-10 flex flex-col items-center">
          {/* Brand Logo Header (matching screenshot format) */}
          <Link
            href="/"
            className="mb-8 flex items-center gap-2.5 text-white hover:opacity-90 transition group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md shadow-purple-500/20 group-hover:scale-105 transition">
              <svg
                className="h-5 w-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </div>
            <span className="font-extrabold tracking-wider text-xl uppercase font-sans">
              SCRIPD
            </span>
          </Link>

          {/* White Credentials Card */}
          <div className="w-full rounded-3xl bg-white p-7 sm:p-9 shadow-2xl text-gray-900 border border-gray-100">
            {children}
          </div>

          {/* Under Card Link */}
          <p className="mt-6 text-center text-sm text-gray-400">
            {footerText}{" "}
            <Link
              href={footerLinkHref}
              className="font-bold text-white hover:text-purple-300 transition underline underline-offset-4"
            >
              {footerLinkText}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
