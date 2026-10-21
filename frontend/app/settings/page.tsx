import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SettingsPage } from "@/features/settings/SettingsPage";

export const metadata: Metadata = {
  title: "Account Settings — Scripd",
  description: "Manage your password, security, and account preferences on Scripd.",
};

export default function Page() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteHeader theme="light" />
      <main className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <header className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-[var(--ink)]">Account Settings</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage your account credentials, security settings, and personal data.
          </p>
        </header>
        <SettingsPage />
      </main>
    </div>
  );
}
