"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import { useForgotPassword } from "@/features/auth/hooks";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address")
    .email("Please enter a valid email address"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const forgotMutation = useForgotPassword();

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setSubmitError(null);
    try {
      await forgotMutation.mutateAsync({ email: values.email });
      setSubmittedEmail(values.email);
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message || "Failed to send reset email. Please try again.");
        return;
      }
      setSubmitError("We couldn’t send the reset link. Please check your connection and try again.");
    }
  }

  if (submittedEmail) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 shadow-sm">
          <svg
            className="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>

        <h2 className="text-2xl sm:text-[26px] font-bold text-gray-900 tracking-tight mb-2">
          Check your email
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto mb-6">
          If an account exists for <strong className="text-gray-900 font-semibold">{submittedEmail}</strong>, we have sent instructions to reset your password. The link expires in 1 hour.
        </p>

        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-3 text-sm font-bold tracking-wide shadow-md shadow-purple-500/20 transition cursor-pointer text-center"
          >
            Back to Login
          </Link>
          <button
            type="button"
            onClick={() => {
              setSubmittedEmail(null);
              setSubmitError(null);
              form.reset();
            }}
            className="text-xs text-gray-500 hover:text-gray-900 underline underline-offset-2 transition cursor-pointer"
          >
            Didn’t receive it? Try a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-center text-2xl sm:text-[26px] font-bold text-gray-900 tracking-tight mb-1.5">
        Forgot Password
      </h2>
      <p className="text-center text-xs sm:text-sm text-gray-500 mb-6 max-w-xs mx-auto">
        Enter your account email and we’ll send you a link to reset your password.
      </p>

      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div>
          <label className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1.5">
            Email Address
          </label>
          <input
            {...form.register("email")}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 sm:py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {form.formState.errors.email && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        {submitError && (
          <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 font-medium border border-red-200">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={forgotMutation.isPending}
          className="mt-2 w-full rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-3 text-sm font-bold tracking-wide shadow-md shadow-purple-500/20 transition cursor-pointer disabled:opacity-60"
        >
          {forgotMutation.isPending ? "Sending reset link…" : "Send Reset Link"}
        </button>

        <div className="pt-2 text-center">
          <Link
            href="/login"
            className="text-xs text-gray-500 hover:text-purple-600 underline underline-offset-2 transition"
          >
            ← Back to Login
          </Link>
        </div>
      </form>
    </div>
  );
}

