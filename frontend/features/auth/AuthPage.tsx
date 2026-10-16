import type { ReactNode } from "react";
import Link from "next/link";

export function AuthPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="wordmark" aria-label="Scripd home">
          scripd<span>.</span>
        </Link>
        <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          Back to home
        </Link>
      </div>
      <div className="mx-auto grid max-w-6xl gap-12 py-14 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:py-24">
        <section className="max-w-xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-title mt-5 text-5xl sm:text-6xl">{title}</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--muted)]">{description}</p>
          <div className="mt-10 hidden max-w-md rounded-3xl border border-[var(--line)] bg-white/70 p-6 shadow-sm lg:block">
            <p className="font-serif text-xl leading-8 text-[var(--ink)]">
              A reader’s life, one title at a time.
            </p>
            <p className="mt-3 text-sm text-[var(--muted)]">Keep the good ones close.</p>
          </div>
        </section>
        <section className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[0_20px_60px_-35px_rgba(36,55,41,0.35)] sm:p-9">
          {children}
        </section>
      </div>
    </main>
  );
}
