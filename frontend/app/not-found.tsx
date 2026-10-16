import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-20">
      <h1 className="text-4xl font-semibold">Page not found</h1>
      <Link className="mt-6 text-[var(--accent)] underline" href="/">
        Return home
      </Link>
    </main>
  );
}
