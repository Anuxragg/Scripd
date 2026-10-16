import type { Metadata } from "next";
import { AuthPage } from "@/features/auth/AuthPage";
import { EmailVerificationPending } from "@/features/auth/EmailVerification";

export const metadata: Metadata = {
  title: "Verify your email · Scripd",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PendingVerificationPage() {
  return (
    <AuthPage
      eyebrow="Finish setting up your account"
      title="One quick step, then you’re in."
      description="A confirmed email helps keep Scripd’s reading community connected to real readers."
    >
      <EmailVerificationPending />
    </AuthPage>
  );
}
