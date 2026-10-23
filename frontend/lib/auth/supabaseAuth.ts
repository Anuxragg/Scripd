/**
 * Supabase Auth API helpers using standard native fetch.
 * Provides live Email OTP sending and verification without extra dependencies.
 */

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const anonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim();

  if (!url || !anonKey) {
    throw new Error(
      "Supabase credentials not configured. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local.",
    );
  }

  return { url, anonKey };
}

/**
 * Sends a 6-digit OTP code to the provided email address via Supabase Auth.
 */
export async function sendSupabaseOtp(email: string): Promise<void> {
  const { url, anonKey } = getSupabaseConfig();

  const response = await fetch(`${url}/auth/v1/otp`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      create_user: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = "Failed to send verification code.";
    try {
      const parsed = JSON.parse(errorBody);
      message = parsed.msg || parsed.message || parsed.error_description || parsed.error || message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }
}

export interface VerifyOtpResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
  };
}

/**
 * Verifies the 6-digit OTP code with Supabase Auth and returns the authenticated session.
 */
export async function verifySupabaseOtp(
  email: string,
  token: string,
  preferredType: "email" | "signup" = "email",
): Promise<VerifyOtpResult> {
  const { url, anonKey } = getSupabaseConfig();
  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim().replace(/\s/g, "");

  const typesToTry: ("email" | "signup")[] =
    preferredType === "signup" ? ["signup", "email"] : ["email", "signup"];

  let lastError = "Invalid or expired verification code.";

  for (const type of typesToTry) {
    const response = await fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        email: cleanEmail,
        token: cleanToken,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
      };
    }

    const errorBody = await response.text();
    console.error(`[Supabase verify error (type="${type}")]:`, response.status, errorBody);
    try {
      const parsed = JSON.parse(errorBody);
      lastError =
        parsed.msg || parsed.message || parsed.error_description || parsed.error || lastError;
    } catch {
      // ignore parse error
    }
  }

  throw new Error(lastError);
}
