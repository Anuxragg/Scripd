import type { Metadata } from "next";
import { AuthPage } from "@/features/auth/AuthPage";
import { VerifyEmail } from "@/features/auth/EmailVerification";

export const metadata: Metadata = {
  title: "Verify your email · Scripd",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <AuthPage
      eyebrow="Finish setting up your account"
      title="Your reading life starts here."
      description="Confirm your email to make your reviews and social activity part of the Scripd community."
    >
      <VerifyEmail token={token} />
    </AuthPage>
  );
}
