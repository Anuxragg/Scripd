"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import { useResetPassword } from "@/features/auth/hooks";

const resetPasswordSchema = z
  .object({
    new_password: z
      .string()
      .min(12, "Password must be at least 12 characters long")
      .max(128, "Password must be 128 characters or fewer"),
    confirm_password: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) return { score: 0, label: "", color: "bg-gray-200" };
  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  switch (score) {
    case 1:
      return { score: 1, label: "Weak", color: "bg-red-500" };
    case 2:
      return { score: 2, label: "Fair", color: "bg-amber-500" };
    case 3:
      return { score: 3, label: "Good", color: "bg-emerald-500" };
    case 4:
      return { score: 4, label: "Strong", color: "bg-emerald-600" };
    default:
      return { score: 0, label: "", color: "bg-gray-200" };
  }
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const resetMutation = useResetPassword();

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { new_password: "", confirm_password: "" },
  });

  const strength = getPasswordStrength(newPasswordValue);

  if (!token) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-sm">
          <svg
            className="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">Invalid Reset Link</h2>
        <p className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto mb-6">
          This password reset link is missing a token or is invalid. Please request a new link.
        </p>

        <Link
          href="/forgot-password"
          className="inline-block w-full rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-3 text-sm font-bold tracking-wide shadow-md shadow-purple-500/20 transition cursor-pointer text-center"
        >
          Request New Link
        </Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm">
          <svg
            className="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">Password Reset!</h2>
        <p className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto mb-6">
          Your password has been successfully updated. Redirecting you to sign in with your new
          password…
        </p>

        <Link
          href="/login"
          className="inline-block w-full rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-3 text-sm font-bold tracking-wide shadow-md shadow-purple-500/20 transition cursor-pointer text-center"
        >
          Continue to Login
        </Link>
      </div>
    );
  }

  async function onSubmit(values: ResetPasswordValues) {
    setSubmitError(null);
    try {
      await resetMutation.mutateAsync({
        token,
        new_password: values.new_password,
      });
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 1800);
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message || "Failed to reset password. The link may have expired.");
        return;
      }
      setSubmitError(
        "We couldn’t reset your password. Please check your connection and try again.",
      );
    }
  }

  return (
    <div className="w-full">
      <h2 className="text-center text-2xl sm:text-[26px] font-bold text-gray-900 tracking-tight mb-1.5">
        Set New Password
      </h2>
      <p className="text-center text-xs sm:text-sm text-gray-500 mb-6 max-w-xs mx-auto">
        Please enter and confirm your new password below.
      </p>

      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div>
          <label className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1.5">
            New Password
          </label>
          <div className="relative">
            <input
              {...form.register("new_password", {
                onChange: (e) => setNewPasswordValue(e.target.value),
              })}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 12 characters"
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 sm:py-3 pr-11 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg
                  className="h-4.5 w-4.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                <svg
                  className="h-4.5 w-4.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {newPasswordValue && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-500 font-medium">Strength:</span>
                <span className="font-semibold text-gray-700">{strength.label}</span>
              </div>
              <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-gray-100">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-full flex-1 transition-all ${
                      step <= strength.score ? strength.color : "bg-transparent"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {form.formState.errors.new_password && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {form.formState.errors.new_password.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1.5">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              {...form.register("confirm_password")}
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 sm:py-3 pr-11 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? (
                <svg
                  className="h-4.5 w-4.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                <svg
                  className="h-4.5 w-4.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {form.formState.errors.confirm_password && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {form.formState.errors.confirm_password.message}
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
          disabled={resetMutation.isPending}
          className="mt-2 w-full rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-3 text-sm font-bold tracking-wide shadow-md shadow-purple-500/20 transition cursor-pointer disabled:opacity-60"
        >
          {resetMutation.isPending ? "Updating password…" : "Reset Password"}
        </button>

        <div className="pt-2 text-center">
          <Link
            href="/forgot-password"
            className="text-xs text-gray-500 hover:text-purple-600 underline underline-offset-2 transition"
          >
            Need a new link? Request reset again
          </Link>
        </div>
      </form>
    </div>
  );
}
