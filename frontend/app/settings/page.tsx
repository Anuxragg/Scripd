import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SettingsPage } from "@/features/settings/SettingsPage";

export const metadata: Metadata = {
  title: "Settings — Scripd",
  description: "Manage your account, profile, security, and preferences on Scripd.",
};

export default function Page() {
  return (
    <div className="min-h-screen bg-[#0a0c10] text-white selection:bg-[#9333ea]/30 selection:text-white pb-32">
      <SiteHeader theme="dark" />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 pt-8 sm:pt-12">
        <SettingsPage />
      </main>
    </div>
  );
}
