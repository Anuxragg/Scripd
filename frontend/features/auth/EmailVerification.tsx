"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useCurrentUser, useResendEmailVerification, useVerifyEmail } from "@/features/auth/hooks";

export function VerifyEmail({ token: initialToken }: { token: string }) {
  const [token] = useState(initialToken);
  const mutation = useVerifyEmail();

  useEffect(() => {
    if (token && window.location.search) {
      window.history.replaceState({}, "", "/verify-email");
    }
  }, [token]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(token);
  }

  return (
    <section className="space-y-5">
      <p className="eyebrow">Email verification</p>
      {mutation.isSuccess ? (
        <>
          <h1 className="display-title text-4xl">Your email is confirmed.</h1>
          <p className="leading-7 text-[var(--muted)]">
            Your account is ready for public reading activity. Your private library was available
            while you waited.
          </p>
          <Link className="auth-submit inline-block text-center" href="/library">
            Open your library
          </Link>
        </>
      ) : (
        <>
          <h1 className="display-title text-4xl">Confirm your email.</h1>
          <p className="leading-7 text-[var(--muted)]">
            {token
              ? "Use the button below to verify the email address on your Scripd account."
              : "This verification link is missing or incomplete. You can request a fresh link from your account."}
          </p>
          {mutation.isError ? (
            <p className="text-sm text-red-700" role="alert">
              This link is invalid or expired. Request a new verification email and try again.
            </p>
          ) : null}
          <form onSubmit={submit}>
            <button
              className="auth-submit"
              disabled={!token || mutation.isPending || mutation.isSuccess}
              type="submit"
            >
              {mutation.isPending ? "Verifying…" : "Verify email"}
            </button>
          </form>
          <p className="text-sm text-[var(--muted)]">
            <Link className="text-link" href="/verify-email/pending">
              Request a new link
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

export function EmailVerificationPending() {
  const currentUser = useCurrentUser();
  const resend = useResendEmailVerification();
  const profile = currentUser.data;

  function sendAgain() {
    resend.mutate();
  }

  return (
    <section className="space-y-5">
      <p className="eyebrow">One quick step</p>
      <h1 className="display-title text-4xl">Check your inbox.</h1>
      <p className="leading-7 text-[var(--muted)]">
        We sent a verification link to the email on your account. You can keep using your private
        library while you wait; public activity will be available after verification.
      </p>
      {resend.isSuccess ? (
        <p className="text-sm text-[var(--forest)]" role="status">
          If your account still needs verification, look for the latest message in your inbox. You
          can try again later if no link arrives.
        </p>
      ) : null}
      {resend.isError ? (
        <p className="text-sm text-red-700" role="alert">
          We could not send a link right now. Please try again shortly.
        </p>
      ) : null}
      {profile?.email_verified ? (
        <Link className="auth-submit inline-block text-center" href="/library">
          Open your library
        </Link>
      ) : profile ? (
        <button
          className="auth-submit"
          disabled={resend.isPending}
          onClick={sendAgain}
          type="button"
        >
          {resend.isPending ? "Sending…" : "Resend verification email"}
        </button>
      ) : (
        <Link className="auth-submit inline-block text-center" href="/login">
          Sign in to resend
        </Link>
      )}
      <p className="text-sm text-[var(--muted)]">
        <Link className="text-link" href="/library">
          Continue to your private library
        </Link>
      </p>
    </section>
  );
}
