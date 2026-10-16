"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import { useLogin, useRegister } from "@/features/auth/hooks";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email").max(254),
  password: z.string().min(1, "Enter your password").max(128),
});

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, "Use 3–30 letters, numbers, or underscores"),
  email: z.email("Enter a valid email address").max(254),
  display_name: z.string().trim().max(80, "Use 80 characters or fewer").optional(),
  password: z
    .string()
    .min(12, "Use at least 12 characters")
    .max(128, "Use 128 characters or fewer"),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

const inputClassName =
  "mt-2 block w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-base text-[var(--ink)] outline-none transition focus:border-[var(--forest)] focus:ring-2 focus:ring-[var(--forest)]/15";

export function LoginForm() {
  const router = useRouter();
  const mutation = useLogin();
  const [submitError, setSubmitError] = useState("");
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setSubmitError("");
    try {
      await mutation.mutateAsync(values);
      router.replace("/");
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof ApiError && error.code === "invalid_credentials"
          ? "That username, email, or password didn’t match."
          : "We couldn’t sign you in. Try again in a moment.",
      );
    }
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <label className="block text-sm font-medium text-[var(--ink)]">
        Username or email
        <input
          aria-describedby={form.formState.errors.identifier ? "login-identifier-error" : undefined}
          aria-invalid={Boolean(form.formState.errors.identifier)}
          autoCapitalize="none"
          autoComplete="username"
          autoCorrect="off"
          className={inputClassName}
          required
          spellCheck={false}
          {...form.register("identifier")}
        />
        <FieldError
          id="login-identifier-error"
          message={form.formState.errors.identifier?.message}
        />
      </label>
      <label className="block text-sm font-medium text-[var(--ink)]">
        Password
        <input
          aria-describedby={form.formState.errors.password ? "login-password-error" : undefined}
          aria-invalid={Boolean(form.formState.errors.password)}
          autoComplete="current-password"
          className={inputClassName}
          required
          type="password"
          {...form.register("password")}
        />
        <FieldError id="login-password-error" message={form.formState.errors.password?.message} />
      </label>
      <SubmitError message={submitError} />
      <button className="auth-submit" type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        New to Scripd?{" "}
        <Link className="text-link" href="/signup">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const mutation = useRegister();
  const [submitError, setSubmitError] = useState("");
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", display_name: "", password: "" },
  });

  async function onSubmit(values: RegisterValues) {
    setSubmitError("");
    try {
      await mutation.mutateAsync(values);
      router.replace("/verify-email/pending");
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof ApiError && error.code === "registration_unavailable"
          ? error.message
          : "We couldn’t create your account. Check your details and try again.",
      );
    }
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <label className="block text-sm font-medium text-[var(--ink)]">
        Username
        <input
          aria-describedby={form.formState.errors.username ? "register-username-error" : undefined}
          aria-invalid={Boolean(form.formState.errors.username)}
          autoCapitalize="none"
          autoComplete="username"
          autoCorrect="off"
          className={inputClassName}
          maxLength={30}
          required
          spellCheck={false}
          {...form.register("username")}
        />
        <FieldError
          id="register-username-error"
          message={form.formState.errors.username?.message}
        />
      </label>
      <label className="block text-sm font-medium text-[var(--ink)]">
        Email
        <input
          aria-describedby={form.formState.errors.email ? "register-email-error" : undefined}
          aria-invalid={Boolean(form.formState.errors.email)}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect="off"
          className={inputClassName}
          required
          spellCheck={false}
          type="email"
          {...form.register("email")}
        />
        <FieldError id="register-email-error" message={form.formState.errors.email?.message} />
      </label>
      <label className="block text-sm font-medium text-[var(--ink)]">
        Name on your profile <span className="font-normal text-[var(--muted)]">(optional)</span>
        <input
          aria-describedby={
            form.formState.errors.display_name ? "register-display-name-error" : undefined
          }
          aria-invalid={Boolean(form.formState.errors.display_name)}
          className={inputClassName}
          maxLength={80}
          {...form.register("display_name")}
        />
        <FieldError
          id="register-display-name-error"
          message={form.formState.errors.display_name?.message}
        />
      </label>
      <label className="block text-sm font-medium text-[var(--ink)]">
        Password
        <input
          aria-describedby={form.formState.errors.password ? "register-password-error" : undefined}
          aria-invalid={Boolean(form.formState.errors.password)}
          autoComplete="new-password"
          className={inputClassName}
          required
          type="password"
          {...form.register("password")}
        />
        <FieldError
          id="register-password-error"
          message={form.formState.errors.password?.message}
        />
      </label>
      <SubmitError message={submitError} />
      <button className="auth-submit" type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link className="text-link" href="/login">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span className="mt-1 block text-xs text-red-700" id={id}>
      {message}
    </span>
  );
}

function SubmitError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      {message}
    </p>
  );
}
