import type { Metadata } from "next";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password — Scripd",
  description: "Reset your Scripd password using your email address.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      footerText="Remembered your password?"
      footerLinkText="Log In"
      footerLinkHref="/login"
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}

