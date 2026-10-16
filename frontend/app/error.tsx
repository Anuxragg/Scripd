"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-20">
      <h1 className="text-4xl font-semibold">Something went wrong</h1>
      <p className="mt-4 text-[var(--muted)]">Please try again.</p>
      <button
        className="mt-6 w-fit rounded-md bg-[var(--accent)] px-4 py-2 text-white"
        onClick={() => reset()}
        type="button"
      >
        Try again
      </button>
    </main>
  );
}
