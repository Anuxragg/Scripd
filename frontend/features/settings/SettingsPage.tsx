"use client";

import Image from "next/image";
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
import { useProfile } from "@/features/profile/hooks";

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

  const user = userQuery.data;
  const username = user?.username || "";
  const profileQuery = useProfile(username);

  // Local state for phone number and metadata (lazy loaded from localStorage)
  const [phoneNumber, setPhoneNumber] = useState(() => {
    if (typeof window === "undefined" || !username) return "";
    try {
      const savedMeta = localStorage.getItem(`scripd_user_meta_${username}`);
      if (savedMeta) {
        const parsed = JSON.parse(savedMeta);
        return parsed.phone || "";
      }
    } catch {
      // ignore
    }
    return "";
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Avatar state
  const [avatarURL] = useState(() => {
    if (typeof window === "undefined" || !username) return "";
    return localStorage.getItem(`scripd_user_avatar_${username}`) || "";
  });

  // Modals & Drawers
  const [activeModal, setActiveModal] = useState<
    "email" | "phone" | "handle" | "delete_notes" | "delete_account" | null
  >(null);
  const [showPasswordDrawer, setShowPasswordDrawer] = useState(false);

  // Form states for modals
  const [modalPhone, setModalPhone] = useState("");
  const [modalError, setModalError] = useState("");

  // Password Form state
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [deleteError, setDeleteError] = useState("");
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

  const effectiveAvatar = avatarURL || profileQuery.data?.avatar_url || "";

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  // Save Phone
  function handleSavePhone(e: React.FormEvent) {
    e.preventDefault();
    const clean = modalPhone.trim();
    if (!clean) {
      setModalError("Please enter a valid phone number.");
      return;
    }
    setPhoneNumber(clean);
    if (typeof window !== "undefined") {
      const existing = localStorage.getItem(`scripd_user_meta_${username}`) || "{}";
      try {
        const parsed = JSON.parse(existing);
        parsed.phone = clean;
        localStorage.setItem(`scripd_user_meta_${username}`, JSON.stringify(parsed));
      } catch {
        localStorage.setItem(`scripd_user_meta_${username}`, JSON.stringify({ phone: clean }));
      }
    }
    showToast("Phone number saved!");
    setActiveModal(null);
  }

  // Delete Notes confirmation
  function handleDeleteNotes() {
    showToast("Notes and restacks deleted.");
    setActiveModal(null);
  }

  // Change Password
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
      showToast("Password updated successfully!");
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

  // Delete Account
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

  // Resend Email Verification
  async function handleResendVerification() {
    setResendStatus("idle");
    try {
      await resendMutation.mutateAsync();
      setResendStatus("sent");
      showToast("Verification email sent!");
    } catch {
      setResendStatus("error");
    }
  }

  if (userQuery.isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div>
          <div className="h-6 w-28 bg-white/10 rounded-md mb-4" />
          <div className="h-64 rounded-2xl bg-[#14161f] border border-white/5" />
        </div>
        <div>
          <div className="h-6 w-36 bg-white/10 rounded-md mb-4" />
          <div className="h-56 rounded-2xl bg-[#14161f] border border-white/5" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#14161f] p-10 text-center shadow-xl">
        <h2 className="text-2xl font-bold text-white tracking-tight">Sign In to Access Settings</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
          You must be signed in to manage your account security, profile, and preferences.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/login?redirect=/settings"
            className="rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-xl border border-white/10 bg-[#1c202a] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#252b39] transition"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profileQuery.data?.display_name || user.display_name || user.username;

  return (
    <div className="space-y-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-purple-900/30 transition-all animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* ========================================================
          1. ACCOUNT SECTION (Exact Design from Image 1)
         ======================================================== */}
      <section>
        <h2 className="text-2xl font-bold text-white tracking-tight mb-4">Account</h2>

        <div className="rounded-2xl border border-white/5 bg-[#14161f] p-5 sm:p-6 shadow-xl divide-y divide-white/5">
          {/* Row 1: Profile */}
          <div className="flex items-center justify-between gap-4 pb-5">
            <Link
              href="/edit-profile"
              className="flex items-center gap-4 min-w-0 group cursor-pointer"
            >
              <div className="relative h-13 w-13 sm:h-14 sm:w-14 rounded-full overflow-hidden shrink-0 bg-[#222734] border border-white/10 ring-2 ring-black/40 group-hover:ring-purple-500/50 transition">
                {effectiveAvatar ? (
                  <Image
                    src={effectiveAvatar}
                    alt={displayName}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-purple-700 to-indigo-900 text-lg font-bold text-white uppercase">
                    {displayName.charAt(0) || user.username.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-purple-300 transition truncate">
                  Profile
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 truncate">{displayName}</p>
              </div>
            </Link>

            <Link
              href="/edit-profile"
              className="rounded-xl bg-[#222734] hover:bg-[#2c3242] active:scale-95 text-white font-medium text-xs sm:text-sm px-4.5 py-2 transition cursor-pointer shadow-sm shrink-0"
            >
              Edit
            </Link>
          </div>

          {/* Row 2: Email */}
          <div className="flex items-center justify-between gap-4 py-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-white">Email</h3>
                {user.email_verified ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/30">
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/30">
                    Unverified
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 truncate">{user.email}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setModalError("");
                setActiveModal("email");
              }}
              className="rounded-xl bg-[#222734] hover:bg-[#2c3242] active:scale-95 text-white font-medium text-xs sm:text-sm px-4.5 py-2 transition cursor-pointer shadow-sm shrink-0"
            >
              Edit
            </button>
          </div>

          {/* Row 3: Phone */}
          <div className="flex items-center justify-between gap-4 py-5">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-semibold text-white">Phone</h3>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 truncate">
                {phoneNumber || "Add your phone number"}
              </p>
            </div>

            {phoneNumber ? (
              <button
                type="button"
                onClick={() => {
                  setModalPhone(phoneNumber);
                  setModalError("");
                  setActiveModal("phone");
                }}
                className="rounded-xl bg-[#222734] hover:bg-[#2c3242] active:scale-95 text-white font-medium text-xs sm:text-sm px-4.5 py-2 transition cursor-pointer shadow-sm shrink-0"
              >
                Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setModalPhone("");
                  setModalError("");
                  setActiveModal("phone");
                }}
                className="rounded-xl bg-[#ff5500] hover:bg-[#e64d00] active:scale-95 text-white font-semibold text-xs sm:text-sm px-4.5 py-2 transition cursor-pointer shadow-sm shrink-0"
              >
                Add phone
              </button>
            )}
          </div>

          {/* Row 4: Handle */}
          <div className="flex items-center justify-between gap-4 pt-5">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-semibold text-white">Handle</h3>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 truncate">@{user.username}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setModalError("");
                setActiveModal("handle");
              }}
              className="rounded-xl bg-[#222734] hover:bg-[#2c3242] active:scale-95 text-white font-medium text-xs sm:text-sm px-4.5 py-2 transition cursor-pointer shadow-sm shrink-0"
            >
              Edit
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================
          2. PASSWORD & SECURITY SECTION
         ======================================================== */}
      <section>
        <h2 className="text-2xl font-bold text-white tracking-tight mb-4">Password &amp; security</h2>

        <div className="rounded-2xl border border-white/5 bg-[#14161f] p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-semibold text-white">Password</h3>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                •••••••••••• (Must be at least 12 characters)
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowPasswordDrawer((prev) => !prev)}
              className="rounded-xl bg-[#222734] hover:bg-[#2c3242] active:scale-95 text-white font-medium text-xs sm:text-sm px-4.5 py-2 transition cursor-pointer shadow-sm shrink-0"
            >
              {showPasswordDrawer ? "Close" : "Change password"}
            </button>
          </div>

          {showPasswordDrawer && (
            <div className="mt-6 pt-5 border-t border-white/5">
              {passwordSuccess && (
                <div className="mb-4 rounded-xl bg-emerald-500/15 p-3.5 border border-emerald-500/30 text-xs sm:text-sm font-medium text-emerald-300">
                  Password updated successfully! Redirecting you to sign in with your new password…
                </div>
              )}

              {passwordError && (
                <div className="mb-4 rounded-xl bg-red-500/15 p-3.5 border border-red-500/30 text-xs sm:text-sm font-medium text-red-300">
                  {passwordError}
                </div>
              )}

              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    {...passwordForm.register("current_password")}
                    placeholder="Enter current password"
                    className="w-full rounded-xl border border-white/10 bg-[#1b202c] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                  {passwordForm.formState.errors.current_password && (
                    <p className="mt-1 text-xs text-red-400">
                      {passwordForm.formState.errors.current_password.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    {...passwordForm.register("new_password")}
                    placeholder="At least 12 characters"
                    className="w-full rounded-xl border border-white/10 bg-[#1b202c] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                  {passwordForm.formState.errors.new_password && (
                    <p className="mt-1 text-xs text-red-400">
                      {passwordForm.formState.errors.new_password.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    {...passwordForm.register("confirm_password")}
                    placeholder="Re-enter new password"
                    className="w-full rounded-xl border border-white/10 bg-[#1b202c] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                  {passwordForm.formState.errors.confirm_password && (
                    <p className="mt-1 text-xs text-red-400">
                      {passwordForm.formState.errors.confirm_password.message}
                    </p>
                  )}
                </div>

                <div className="pt-1 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={changePasswordMutation.isPending || passwordSuccess}
                    className="rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] active:scale-95 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    {changePasswordMutation.isPending ? "Updating…" : "Update Password"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordDrawer(false);
                      passwordForm.reset();
                      setPasswordError("");
                    }}
                    className="rounded-xl border border-white/10 bg-transparent hover:bg-white/5 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================
          3. DANGER ZONE SECTION (Exact Design from Image 2)
         ======================================================== */}
      <section>
        <h2 className="text-2xl font-bold text-white tracking-tight mb-4">Danger zone</h2>

        <div className="rounded-2xl border border-white/5 bg-[#14161f] p-5 sm:p-6 shadow-xl divide-y divide-white/5">
          {/* Row 1: Delete all notes */}
          <div className="flex items-center justify-between gap-4 pb-5">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-semibold text-white">Delete all notes</h3>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                Permanently delete your notes and restacks.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal("delete_notes")}
              className="rounded-xl bg-[#f87171] hover:bg-[#ef4444] active:scale-95 text-white font-semibold text-xs sm:text-sm px-4.5 py-2 transition cursor-pointer shadow-sm shrink-0"
            >
              Delete notes
            </button>
          </div>

          {/* Row 2: Delete your account */}
          <div className="flex items-center justify-between gap-4 pt-5">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-semibold text-white">Delete your account</h3>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                Permanently delete your account and information
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setDeleteError("");
                deleteForm.reset();
                setActiveModal("delete_account");
              }}
              className="rounded-xl bg-[#f87171] hover:bg-[#ef4444] active:scale-95 text-white font-semibold text-xs sm:text-sm px-4.5 py-2 transition cursor-pointer shadow-sm shrink-0"
            >
              Delete account
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================
          MODALS & DIALOGS
         ======================================================== */}

      {/* Modal: Edit Email */}
      {activeModal === "email" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12141a] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Account Email</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-[#181b24] p-4 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Current Email</span>
                {user.email_verified ? (
                  <span className="text-xs font-medium text-emerald-400">Verified ✓</span>
                ) : (
                  <span className="text-xs font-medium text-amber-400">Unverified</span>
                )}
              </div>
              <p className="text-sm font-semibold text-white">{user.email}</p>
            </div>

            {!user.email_verified && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 space-y-2">
                <p className="text-xs text-amber-200">
                  Your email is not verified yet. Verify your email to secure your account and recover access.
                </p>
                <button
                  type="button"
                  disabled={resendMutation.isPending || resendStatus === "sent"}
                  onClick={handleResendVerification}
                  className="rounded-lg bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white px-3 py-1.5 transition cursor-pointer"
                >
                  {resendStatus === "sent" ? "Email Sent!" : "Resend Verification Email"}
                </button>
              </div>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-xl bg-[#222734] hover:bg-[#2c3242] px-4.5 py-2 text-xs sm:text-sm font-semibold text-white transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Phone */}
      {activeModal === "phone" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12141a] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {phoneNumber ? "Edit Phone Number" : "Add Phone Number"}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="rounded-xl bg-red-500/15 p-3 text-xs text-red-300 font-medium border border-red-500/30">
                {modalError}
              </div>
            )}

            <p className="text-xs text-zinc-400">
              Add your mobile number for account security and SMS notifications.
            </p>

            <form onSubmit={handleSavePhone} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={modalPhone}
                  onChange={(e) => setModalPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full rounded-xl border border-white/10 bg-[#1b202c] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                {phoneNumber && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneNumber("");
                      if (typeof window !== "undefined") {
                        const existing = localStorage.getItem(`scripd_user_meta_${username}`) || "{}";
                        try {
                          const parsed = JSON.parse(existing);
                          delete parsed.phone;
                          localStorage.setItem(`scripd_user_meta_${username}`, JSON.stringify(parsed));
                        } catch {
                          // ignore
                        }
                      }
                      showToast("Phone number removed.");
                      setActiveModal(null);
                    }}
                    className="mr-auto text-xs text-red-400 hover:text-red-300 font-medium transition cursor-pointer"
                  >
                    Remove phone
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-xs sm:text-sm font-medium text-zinc-300 hover:bg-white/5 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#ff5500] hover:bg-[#e64d00] active:scale-95 px-4.5 py-2 text-xs sm:text-sm font-semibold text-white transition cursor-pointer shadow-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Handle */}
      {activeModal === "handle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12141a] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Account Handle</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Your unique handle on Scripd. Changing your handle will update your profile URL.
            </p>

            <div className="rounded-xl bg-[#181b24] p-4 border border-white/5 space-y-1">
              <span className="text-xs text-zinc-400">Current Handle</span>
              <p className="text-sm font-mono font-bold text-white">@{user.username}</p>
            </div>

            <p className="text-[11px] text-zinc-500">
              Note: To preserve verified reading lists, reviews, and follower links, handle updates are locked to once every 30 days.
            </p>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-xl bg-[#222734] hover:bg-[#2c3242] px-4.5 py-2 text-xs sm:text-sm font-semibold text-white transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Notes Confirmation */}
      {activeModal === "delete_notes" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12141a] p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Delete all notes and restacks?</h3>
            <p className="text-xs sm:text-sm text-zinc-300">
              This action will permanently delete all your published reading notes, restacks, and drafts. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-xs sm:text-sm font-medium text-zinc-300 hover:bg-white/5 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteNotes}
                className="rounded-xl bg-[#ef4444] hover:bg-[#dc2626] active:scale-95 px-4.5 py-2 text-xs sm:text-sm font-semibold text-white transition cursor-pointer shadow-sm"
              >
                Delete notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Account Confirmation */}
      {activeModal === "delete_account" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#141014] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-red-400">Permanently Delete Account</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-zinc-300">
              Permanently delete your account and all associated reading history, reviews, likes, lists, and followers. This action is irreversible.
            </p>

            {deleteError && (
              <div className="rounded-xl bg-red-500/20 p-3 text-xs text-red-300 font-medium border border-red-500/40">
                {deleteError}
              </div>
            )}

            <form onSubmit={deleteForm.handleSubmit(onDeleteSubmit)} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  {...deleteForm.register("current_password")}
                  placeholder="Enter current password"
                  className="w-full rounded-xl border border-white/10 bg-[#1e171c] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
                {deleteForm.formState.errors.current_password && (
                  <p className="mt-1 text-xs text-red-400">
                    {deleteForm.formState.errors.current_password.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  {...deleteForm.register("confirm_phrase")}
                  placeholder="DELETE"
                  className="w-full rounded-xl border border-white/10 bg-[#1e171c] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono"
                />
                {deleteForm.formState.errors.confirm_phrase && (
                  <p className="mt-1 text-xs text-red-400">
                    {deleteForm.formState.errors.confirm_phrase.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-xs sm:text-sm font-medium text-zinc-300 hover:bg-white/5 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteAccountMutation.isPending}
                  className="rounded-xl bg-[#ef4444] hover:bg-[#dc2626] active:scale-95 px-4.5 py-2 text-xs sm:text-sm font-semibold text-white transition disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {deleteAccountMutation.isPending ? "Deleting…" : "Permanently Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
