"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import {
  useCurrentUser,
  useChangePassword,
  useDeleteAccount,
  useResendEmailVerification,
} from "@/features/auth/hooks";

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z
      .string()
      .min(12, "Password must be at least 12 characters long")
      .max(128, "Password must be 128 characters or fewer"),
    confirm_password: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "New passwords do not match",
    path: ["confirm_password"],
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

const deleteAccountSchema = z.object({
  current_password: z.string().min(1, "Current password is required to delete your account"),
  confirm_phrase: z.string().refine((val) => val === "DELETE", {
    message: 'Type "DELETE" to confirm',
  }),
});

type DeleteAccountValues = z.infer<typeof deleteAccountSchema>;

export function SettingsPage() {
  const router = useRouter();
  const userQuery = useCurrentUser();
  const changePasswordMutation = useChangePassword();
  const deleteAccountMutation = useDeleteAccount();
  const resendMutation = useResendEmailVerification();

  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sent" | "error">("idle");

  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const deleteForm = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: {
      current_password: "",
      confirm_phrase: "",
    },
  });

  async function onPasswordSubmit(values: ChangePasswordValues) {
    setPasswordError("");
    setPasswordSuccess(false);
    try {
      await changePasswordMutation.mutateAsync({
        current_password: values.current_password,
        new_password: values.new_password,
      });
      setPasswordSuccess(true);
      passwordForm.reset();
      // Redirect to login after brief delay
      setTimeout(() => {
        router.replace("/login?notice=password_updated");
      }, 1500);
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_credentials") {
        setPasswordError("The current password you entered is incorrect.");
      } else if (err instanceof ApiError && err.code === "invalid_request") {
        setPasswordError("Password does not meet requirements (must be at least 12 characters).");
      } else {
        setPasswordError("Failed to update password. Please try again.");
      }
    }
  }

  async function onDeleteSubmit(values: DeleteAccountValues) {
    setDeleteError("");
    try {
      await deleteAccountMutation.mutateAsync({
        current_password: values.current_password,
      });
      router.replace("/?notice=account_deleted");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_credentials") {
        setDeleteError("Incorrect password. Account was not deleted.");
      } else {
        setDeleteError("Unable to delete account at this time. Please try again.");
      }
    }
  }

  async function handleResendVerification() {
    setResendStatus("idle");
    try {
      await resendMutation.mutateAsync();
      setResendStatus("sent");
    } catch {
      setResendStatus("error");
    }
  }

  if (userQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-44 rounded-3xl bg-[#e9e6df] animate-pulse" />
        <div className="h-64 rounded-3xl bg-[#e9e6df] animate-pulse" />
      </div>
    );
  }

  if (!userQuery.data) {
    return (
      <div className="rounded-3xl border border-[var(--line)] bg-white p-10 text-center shadow-sm">
        <h2 className="font-serif text-2xl font-bold text-[var(--ink)]">
          Sign In to Access Settings
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
          You must be signed in to manage your account security and credentials.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/login?redirect=/settings"
            className="rounded-full bg-[var(--forest)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-[var(--line)] bg-white px-6 py-2.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--forest)] hover:text-[var(--forest)] transition"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const user = userQuery.data;

  return (
    <div className="space-y-8">
      {/* Profile Overview Card */}
      <section className="rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8 shadow-sm">
        <h2 className="font-serif text-xl font-bold text-[var(--ink)]">Account Overview</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Username
            </span>
            <p className="mt-1 font-medium text-[var(--ink)]">@{user.username}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Display Name
            </span>
            <p className="mt-1 font-medium text-[var(--ink)]">{user.display_name}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Email Address
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-medium text-[var(--ink)]">{user.email}</span>
              {user.email_verified ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                  Unverified
                </span>
              )}
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Member Since
            </span>
            <p className="mt-1 font-medium text-[var(--ink)]">
              {new Date(user.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        {!user.email_verified && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50/70 p-4 border border-amber-200/60">
            <p className="text-sm text-amber-900">
              Your email is unverified. Verify your address to unlock all social features.
            </p>
            <button
              type="button"
              disabled={resendMutation.isPending || resendStatus === "sent"}
              onClick={handleResendVerification}
              className="rounded-full bg-amber-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 transition disabled:opacity-50"
            >
              {resendStatus === "sent"
                ? "Verification Email Sent!"
                : resendMutation.isPending
                  ? "Sending…"
                  : "Resend Verification Email"}
            </button>
          </div>
        )}
      </section>

      {/* Change Password Card */}
      <section className="rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8 shadow-sm">
        <h2 className="font-serif text-xl font-bold text-[var(--ink)]">Change Password</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Update your account password. All active login sessions across devices will be signed out.
        </p>

        {passwordSuccess && (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-4 border border-emerald-200 text-sm font-medium text-emerald-800">
            Password updated successfully! Redirecting you to sign in with your new password…
          </div>
        )}

        {passwordError && (
          <div className="mt-4 rounded-2xl bg-red-50 p-4 border border-red-200 text-sm font-medium text-red-700">
            {passwordError}
          </div>
        )}

        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--ink)]">Current Password</label>
            <input
              type="password"
              autoComplete="current-password"
              {...passwordForm.register("current_password")}
              className="mt-1 block w-full rounded-xl border border-[var(--line)] bg-[#faf8f5] px-4 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--forest)] focus:bg-white focus:ring-2 focus:ring-[var(--forest)]/15"
            />
            {passwordForm.formState.errors.current_password && (
              <p className="mt-1 text-xs text-red-600">
                {passwordForm.formState.errors.current_password.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--ink)]">New Password</label>
            <input
              type="password"
              autoComplete="new-password"
              {...passwordForm.register("new_password")}
              className="mt-1 block w-full rounded-xl border border-[var(--line)] bg-[#faf8f5] px-4 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--forest)] focus:bg-white focus:ring-2 focus:ring-[var(--forest)]/15"
            />
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Minimum 12 characters required.
            </span>
            {passwordForm.formState.errors.new_password && (
              <p className="mt-1 text-xs text-red-600">
                {passwordForm.formState.errors.new_password.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--ink)]">
              Confirm New Password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              {...passwordForm.register("confirm_password")}
              className="mt-1 block w-full rounded-xl border border-[var(--line)] bg-[#faf8f5] px-4 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--forest)] focus:bg-white focus:ring-2 focus:ring-[var(--forest)]/15"
            />
            {passwordForm.formState.errors.confirm_password && (
              <p className="mt-1 text-xs text-red-600">
                {passwordForm.formState.errors.confirm_password.message}
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={changePasswordMutation.isPending || passwordSuccess}
              className="rounded-full bg-[var(--forest)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {changePasswordMutation.isPending ? "Updating Password…" : "Update Password"}
            </button>
          </div>
        </form>
      </section>

      {/* Danger Zone: Delete Account */}
      <section className="rounded-3xl border border-red-200 bg-red-50/40 p-6 sm:p-8 shadow-sm">
        <h2 className="font-serif text-xl font-bold text-red-900">Danger Zone</h2>
        <p className="mt-1 text-sm text-red-700">
          Permanently delete your account and all associated reading history, reviews, likes, lists,
          and followers. This action is irreversible.
        </p>

        {deleteError && (
          <div className="mt-4 rounded-2xl bg-red-100 p-4 border border-red-300 text-sm font-medium text-red-800">
            {deleteError}
          </div>
        )}

        {!showDeleteConfirm ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-full border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-600 hover:text-white transition"
            >
              Delete My Account
            </button>
          </div>
        ) : (
          <form
            onSubmit={deleteForm.handleSubmit(onDeleteSubmit)}
            className="mt-6 space-y-4 rounded-2xl border border-red-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-semibold text-red-900">
              Are you sure? Confirm your password to proceed with permanent deletion.
            </p>

            <div>
              <label className="block text-sm font-medium text-[var(--ink)]">
                Current Password
              </label>
              <input
                type="password"
                {...deleteForm.register("current_password")}
                placeholder="Enter current password"
                className="mt-1 block w-full rounded-xl border border-[var(--line)] bg-[#faf8f5] px-4 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/15"
              />
              {deleteForm.formState.errors.current_password && (
                <p className="mt-1 text-xs text-red-600">
                  {deleteForm.formState.errors.current_password.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--ink)]">
                Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                {...deleteForm.register("confirm_phrase")}
                placeholder="DELETE"
                className="mt-1 block w-full rounded-xl border border-[var(--line)] bg-[#faf8f5] px-4 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/15"
              />
              {deleteForm.formState.errors.confirm_phrase && (
                <p className="mt-1 text-xs text-red-600">
                  {deleteForm.formState.errors.confirm_phrase.message}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={deleteAccountMutation.isPending}
                className="rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleteAccountMutation.isPending
                  ? "Deleting Account…"
                  : "Permanently Delete Account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  deleteForm.reset();
                  setDeleteError("");
                }}
                className="rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[#f4f1ea] transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
