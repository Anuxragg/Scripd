import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { EditProfileForm } from "@/features/profile/EditProfileForm";

export const metadata: Metadata = {
  title: "Edit Profile — Scripd",
  description: "Update your profile details, photo, bio, and social links.",
};

export default function EditProfilePage() {
  return (
    <div className="min-h-screen bg-[#161718] text-[#e0e6ed]">
      <SiteHeader theme="dark" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EditProfileForm />
      </main>
    </div>
  );
}
