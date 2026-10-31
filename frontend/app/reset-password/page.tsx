import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password — Scripd",
  description: "Set a new password for your Scripd account.",
};

function ResetPasswordFallback() {
  return (
    <div className="w-full text-center py-10">
      <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      <p className="mt-4 text-xs text-gray-500">Loading reset form…</p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      footerText="Remembered your password?"
      footerLinkText="Log In"
      footerLinkHref="/login"
    >
      <Suspense fallback={<ResetPasswordFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}

