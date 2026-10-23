"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import { useLogin, useRegister } from "@/features/auth/hooks";
import { sendSupabaseOtp, verifySupabaseOtp } from "@/lib/auth/supabaseAuth";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Please enter your username or email"),
  password: z.string().min(1, "Please enter your password"),
});

type LoginValues = z.infer<typeof loginSchema>;

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, "Use 3–30 letters, numbers, or underscores"),
  email: z.string().email("Enter a valid email address").max(254),
  password: z
    .string()
    .min(12, "Use at least 12 characters")
    .max(128, "Use 128 characters or fewer"),
});

type RegisterValues = z.infer<typeof registerSchema>;

/**
 * 6-box OTP input with auto-advance, backspace navigation, and paste support.
 */
function OtpInput({
  value,
  onChange,
  onComplete,
}: {
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  function handleChange(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const rawVal = e.target.value.replace(/\D/g, "");
    if (!rawVal) {
      const updated = value.slice(0, idx) + " " + value.slice(idx + 1);
      onChange(updated.trimEnd());
      return;
    }

    const digit = rawVal[rawVal.length - 1];
    const valChars = value.padEnd(6, " ").split("");
    valChars[idx] = digit;
    const updated = valChars.join("").trimEnd();
    onChange(updated);

    if (idx < 5 && digit) {
      inputsRef.current[idx + 1]?.focus();
    }
    if (updated.replace(/\s/g, "").length === 6 && onComplete) {
      onComplete(updated.replace(/\s/g, ""));
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && (!value[idx] || value[idx] === " ") && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    onChange(pasted);
    const nextIdx = Math.min(pasted.length, 5);
    inputsRef.current[nextIdx]?.focus();
    if (pasted.length === 6 && onComplete) {
      onComplete(pasted);
    }
  }

  return (
    <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 my-3">
      {[0, 1, 2, 3, 4, 5].map((idx) => {
        const char = value[idx] && value[idx] !== " " ? value[idx] : "";
        return (
          <input
            key={idx}
            ref={(el) => {
              inputsRef.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={char}
            onChange={(e) => handleChange(idx, e)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            className="h-12 w-11 sm:h-14 sm:w-12 rounded-xl border border-gray-200 bg-gray-50/70 text-center text-xl font-bold text-gray-900 outline-none transition focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-600/20 shadow-sm"
          />
        );
      })}
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setSubmitError("");
    try {
      await loginMutation.mutateAsync({
        identifier: values.identifier.trim(),
        password: values.password,
      });
      window.location.href = "/";
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "invalid_credentials") {
          setSubmitError("That username or password didn’t match.");
          return;
        }
        setSubmitError(error.message);
        return;
      }
      setSubmitError("We couldn’t sign you in. Try again in a moment.");
    }
  }

  return (
    <div className="w-full">
      <h2 className="text-center text-2xl sm:text-[26px] font-bold text-gray-900 tracking-tight mb-6">
        Login
      </h2>

      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div>
          <label className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1.5">
            Username or Email
          </label>
          <input
            {...form.register("identifier")}
            type="text"
            autoComplete="username"
            placeholder="Enter your username or email"
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 sm:py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {form.formState.errors.identifier && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {form.formState.errors.identifier.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              {...form.register("password")}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
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
                  strokeLinecap="round"
                  strokeLinejoin="round"
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
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {form.formState.errors.password.message}
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
          disabled={loginMutation.isPending}
          className="mt-2 w-full rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-3 text-sm font-bold tracking-wide shadow-md shadow-purple-500/20 transition cursor-pointer disabled:opacity-60"
        >
          {loginMutation.isPending ? "Logging in…" : "Login"}
        </button>

        <div className="pt-2 text-center">
          <a
            href="#forgot-password"
            onClick={(e) => {
              e.preventDefault();
              alert("Password reset instructions will be sent to your registered email.");
            }}
            className="text-xs text-gray-500 hover:text-gray-900 underline underline-offset-2 transition"
          >
            Forgot Password?
          </a>
        </div>
      </form>
    </div>
  );
}

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) return { score: 0, label: "", color: "bg-gray-200" };
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score: 1, label: "Too weak", color: "bg-red-500" };
  if (score === 2) return { score: 2, label: "Fair", color: "bg-amber-500" };
  if (score === 3) return { score: 3, label: "Good", color: "bg-blue-500" };
  return { score: 4, label: "Strong", color: "bg-emerald-500" };
}

export function RegisterForm() {
  const router = useRouter();
  const registerMutation = useRegister();

  // Multi-step: 1 = Choose Username, 2 = Fill Details & Password, 3 = OTP Verification
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form Fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const isVerifyingRef = useRef(false);

  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (step !== 3 || countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  function handleCheckUsername(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername) {
      setSubmitError("Please choose a username.");
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      setSubmitError("Username must be 3–30 characters (letters, numbers, or underscores).");
      return;
    }

    setUsername(cleanUsername);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep(2);
    }, 400);
  }

  async function handleGetOtp(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setSubmitError("Please enter a valid email address.");
      return;
    }
    if (password.length < 12) {
      setSubmitError("Password must be at least 12 characters long.");
      return;
    }

    isVerifyingRef.current = false;
    setIsLoading(true);
    try {
      await sendSupabaseOtp(cleanEmail);
      setIsLoading(false);
      setStep(3);
      setCountdown(60);
      setOtp("");
    } catch (err) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : "Failed to send verification code.";
      setSubmitError(msg);
    }
  }

  async function handleVerifyOtpAndRegister(codeToVerify?: string) {
    if (isVerifyingRef.current) return;

    const code = (codeToVerify || otp).replace(/\s/g, "");
    setSubmitError("");

    if (code.length < 6) {
      setSubmitError("Please enter the full 6-digit verification code.");
      return;
    }

    isVerifyingRef.current = true;
    setIsLoading(true);
    try {
      await verifySupabaseOtp(email.trim(), code);

      // Register account in Scripd database
      const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      try {
        await registerMutation.mutateAsync({
          username: username.trim().toLowerCase(),
          email: email.trim(),
          display_name: displayName || undefined,
          password: password,
        });
      } catch (backendErr) {
        isVerifyingRef.current = false;
        setIsLoading(false);
        const msg =
          backendErr instanceof ApiError
            ? backendErr.message
            : backendErr instanceof Error
              ? backendErr.message
              : "Failed to create account in database.";
        setSubmitError(msg);
        return;
      }

      setIsLoading(false);
      window.location.href = "/";
    } catch (err) {
      isVerifyingRef.current = false;
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : "Invalid or expired verification code.";
      setSubmitError(msg);
    }
  }

  return (
    <div className="w-full">
      <h2 className="text-center text-2xl sm:text-[26px] font-bold text-gray-900 tracking-tight mb-5">
        Sign Up
      </h2>

      {/* STEP 1: SELECT USERNAME (Screenshot 1) */}
      {step === 1 && (
        <form className="space-y-4" onSubmit={handleCheckUsername} noValidate>
          <div>
            <label className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1.5">
              Select Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              maxLength={30}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 sm:py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Username cannot be changed for 30 days.
            </p>
          </div>

          {submitError && (
            <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 font-medium border border-red-200">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-3 w-full rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-3 text-sm font-bold tracking-wide shadow-md shadow-purple-500/20 transition cursor-pointer disabled:opacity-60"
          >
            {isLoading ? "Checking…" : "Check"}
          </button>
        </form>
      )}

      {/* STEP 2: USERNAME (READONLY) + EMAIL + FIRST/LAST NAME + PASSWORD (Screenshot 2) */}
      {step === 2 && (
        <form className="space-y-3.5" onSubmit={handleGetOtp} noValidate>
          {/* Readonly Username */}
          <div>
            <label className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              readOnly
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700 font-medium outline-none cursor-default select-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
              autoComplete="email"
              required
            />
          </div>

          {/* First Name & Last Name (2 Columns) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name"
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name"
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
              />
            </div>
          </div>

          {/* Password with Eye Toggle & Strength Meter */}
          <div>
            <label className="block text-xs sm:text-[13px] font-semibold text-gray-800 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 pr-11 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
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
                    strokeLinecap="round"
                    strokeLinejoin="round"
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
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {/* Password Strength Indicator Bars */}
            {password && (
              <div className="mt-2">
                <div className="flex gap-1.5 items-center">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        level <= strength.score ? strength.color : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[11px] font-medium text-gray-500">{strength.label}</p>
              </div>
            )}
          </div>

          {submitError && (
            <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 font-medium border border-red-200">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-3 w-full rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-3 text-sm font-bold tracking-wide shadow-md shadow-purple-500/20 transition cursor-pointer disabled:opacity-60"
          >
            {isLoading ? "Sending code…" : "Get OTP"}
          </button>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setSubmitError("");
              }}
              className="text-xs text-gray-500 hover:text-gray-900 underline font-medium cursor-pointer"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: OTP VERIFICATION */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Enter the 6-digit verification code sent to{" "}
              <strong className="text-gray-800">{email}</strong>
              <button
                type="button"
                onClick={() => {
                  isVerifyingRef.current = false;
                  setStep(2);
                  setSubmitError("");
                }}
                className="text-xs text-purple-600 hover:text-purple-700 font-semibold underline ml-1.5 cursor-pointer"
              >
                Change
              </button>
            </p>
          </div>

          <div>
            <OtpInput
              value={otp}
              onChange={setOtp}
              onComplete={(code) => handleVerifyOtpAndRegister(code)}
            />
          </div>

          {submitError && (
            <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 font-medium border border-red-200 text-center">
              {submitError}
            </div>
          )}

          <button
            type="button"
            onClick={() => handleVerifyOtpAndRegister()}
            disabled={isLoading || otp.replace(/\s/g, "").length < 6}
            className="w-full rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-3 text-sm font-bold tracking-wide shadow-md shadow-purple-500/20 transition cursor-pointer disabled:opacity-60"
          >
            {isLoading ? "Verifying…" : "Complete Registration"}
          </button>

          <div className="pt-2 text-center text-xs text-gray-500">
            {countdown > 0 ? (
              <span>
                Resend code in <strong className="text-gray-700">{countdown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => handleGetOtp(e)}
                className="font-semibold text-purple-600 hover:text-purple-700 underline underline-offset-2 cursor-pointer"
              >
                Didn’t receive the code? Resend
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
