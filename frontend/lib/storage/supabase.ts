/**
 * Supabase Storage client for uploading user avatars and images.
 * Uses standard fetch against the Supabase Storage REST API for zero overhead.
 */

export async function uploadAvatarToSupabase(
  dataUrlOrBlob: string | Blob,
  userId: string,
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const supabaseAnonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim();
  const bucketName = (process.env.NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET || "avatars").trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase credentials missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local.",
    );
  }

  let blob: Blob;
  if (typeof dataUrlOrBlob === "string") {
    const res = await fetch(dataUrlOrBlob);
    blob = await res.blob();
  } else {
    blob = dataUrlOrBlob;
  }

  // Store per user with timestamp to bust cache cleanly
  const filename = `${userId}/avatar_${Date.now()}.jpg`;
  const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${bucketName}/${filename}`;

  const response = await fetch(uploadEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
      "Content-Type": blob.type || "image/jpeg",
      "x-upsert": "true",
    },
    body: blob,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      message = parsed.message || parsed.error || errorBody;
    } catch {
      // ignore json parse error
    }
    throw new Error(`Supabase Storage upload failed: ${message}`);
  }

  // Public URL format for Supabase Storage buckets
  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filename}`;
}
