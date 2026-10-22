"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useCurrentUser } from "@/features/auth/hooks";
import { useProfile, useUpdateProfile } from "@/features/profile/hooks";
import type { PublicProfile } from "@/features/profile/api";
import { ImageCropModal } from "@/features/profile/ImageCropModal";
import { uploadAvatarToSupabase } from "@/lib/storage/supabase";

interface EditProfileFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  isModal?: boolean;
}

const graphikLabelStyle: React.CSSProperties = {
  fontFamily:
    'GraphikWeb, -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", Meiryo, sans-serif, ColorEmoji',
  fontSize: "16px",
  fontWeight: 500,
  lineHeight: "24px",
  color: "rgb(255, 255, 255)",
};

interface EditProfileFieldsProps extends EditProfileFormProps {
  profile: PublicProfile;
  userEmail?: string;
}

function EditProfileFields({
  profile,
  userEmail,
  onSuccess,
  onCancel,
  isModal = false,
}: EditProfileFieldsProps) {
  const router = useRouter();
  const updateMutation = useUpdateProfile(profile.username);

  const nameParts = (profile.display_name || "").trim().split(/\s+/);
  const [givenName, setGivenName] = useState(() => nameParts[0] || "");
  const [familyName, setFamilyName] = useState(() => nameParts.slice(1).join(" ") || "");
  const [bio, setBio] = useState(() => profile.bio || "");
  const [avatarURL, setAvatarURL] = useState(() => profile.avatar_url || "");

  const [location, setLocation] = useState(() => {
    if (typeof window === "undefined") return "Ind";
    try {
      const savedMeta = localStorage.getItem(`scripd_user_meta_${profile.username}`);
      if (savedMeta) {
        const parsed = JSON.parse(savedMeta);
        return parsed.location || "Ind";
      }
    } catch {
      // ignore
    }
    return "Ind";
  });

  const [website, setWebsite] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const savedMeta = localStorage.getItem(`scripd_user_meta_${profile.username}`);
      if (savedMeta) {
        const parsed = JSON.parse(savedMeta);
        return parsed.website || "";
      }
    } catch {
      // ignore
    }
    return "";
  });

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [rawImageToCrop, setRawImageToCrop] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string" && result) {
        setRawImageToCrop(result);
      }
    };
    reader.onerror = () => {
      setStatusMessage({ type: "error", text: "Failed to load the selected image." });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const displayInitial = (
    givenName ? `${givenName[0]}${familyName ? familyName[0] : ""}` : profile.username.slice(0, 2)
  ).toUpperCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage(null);

    const fullDisplayName = [givenName.trim(), familyName.trim()].filter(Boolean).join(" ");
    let finalAvatarURL = avatarURL.trim();

    try {
      // If user uploaded/cropped a new image, it starts with "data:image..."
      if (finalAvatarURL.startsWith("data:")) {
        setIsUploadingPhoto(true);
        try {
          finalAvatarURL = await uploadAvatarToSupabase(finalAvatarURL, profile.id);
          setAvatarURL(finalAvatarURL);
        } catch (uploadErr) {
          setIsUploadingPhoto(false);
          const errorMsg =
            uploadErr instanceof Error ? uploadErr.message : "Failed to upload avatar to Supabase.";
          setStatusMessage({ type: "error", text: errorMsg });
          return;
        }
        setIsUploadingPhoto(false);
      }

      await updateMutation.mutateAsync({
        display_name: fullDisplayName,
        bio: bio.trim(),
        avatar_url: finalAvatarURL,
      });

      try {
        localStorage.setItem(
          `scripd_user_meta_${profile.username}`,
          JSON.stringify({ location: location.trim(), website: website.trim() }),
        );
      } catch {
        // ignore storage failures
      }

      setStatusMessage({ type: "success", text: "Profile updated successfully!" });

      if (onSuccess) {
        setTimeout(() => onSuccess(), 600);
      } else {
        setTimeout(() => {
          router.push(`/u/${profile.username}`);
        }, 800);
      }
    } catch {
      setIsUploadingPhoto(false);
      setStatusMessage({
        type: "error",
        text: "Unable to save profile changes. Please check your connection and try again.",
      });
    }
  }

  return (
    <div className="w-full">
      {/* Top Header (Screenshot 2) */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            style={{
              fontFamily:
                'GraphikWeb, -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", Meiryo, sans-serif, ColorEmoji',
              fontSize: "24px",
              fontWeight: 700,
              lineHeight: "28px",
              color: "rgb(255, 255, 255)",
            }}
          >
            Edit Profile
          </h1>
        </div>
        {isModal && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#2c2d30] bg-[#161718] text-[#8fa0b5] hover:bg-[#202224] hover:text-white transition text-sm cursor-pointer"
            aria-label="Close dialog"
          >
            ✕
          </button>
        )}
      </div>

      {statusMessage && (
        <div
          className={`mb-6 rounded-xl border p-3.5 text-xs font-medium transition ${
            statusMessage.type === "success"
              ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
              : "border-red-500/30 bg-red-950/40 text-red-300"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Photo Card (Screenshot 2 Design) */}
        <div className="rounded-2xl border border-[#2c2d30] bg-[#161718] p-5 sm:p-6 transition hover:border-[#383a3e]">
          <div className="flex items-center gap-5">
            {/* Avatar Circle */}
            <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#2c2d30] bg-[#161718] text-xl font-bold text-white shadow-inner">
              {avatarURL ? (
                <Image
                  src={avatarURL}
                  alt={givenName || profile.username || "Avatar"}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span>{displayInitial}</span>
              )}
            </div>

            {/* Photo Info & Change Photo Action */}
            <div className="flex-1 flex flex-col gap-1.5">
              <h2 style={graphikLabelStyle}>Profile Photo</h2>
              <p className="text-xs sm:text-sm text-[#8fa0b5] leading-normal">
                Add or replace your profile photo
              </p>

              {/* Native file input with bulletproof htmlFor label */}
              <input
                id="profile-photo-file-input"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
              />

              <div>
                <label
                  htmlFor="profile-photo-file-input"
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#a78bfa] hover:text-[#c4b5fd] transition cursor-pointer select-none"
                >
                  Change Photo
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* BASIC INFORMATION Section Header (Screenshot 2) */}
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#7a8a9e] mb-3">
            Basic Information
          </h2>

          <div className="space-y-4">
            {/* Username Field (Screenshot 1: with pencil icon) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label style={graphikLabelStyle}>Username</label>
                <span title="Username" className="text-xs text-[#7e8e9f] flex items-center gap-1">
                  <svg
                    className="h-3.5 w-3.5 text-[#8fa0b5]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  disabled
                  value={profile.username}
                  className="w-full rounded-xl border border-[#2c2d30] bg-[#161718] px-4 py-3 text-sm text-[#8fa0b5] cursor-not-allowed select-none"
                />
              </div>
            </div>

            {/* Given Name & Family Name (Screenshot 1: Two Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label style={graphikLabelStyle} className="block mb-1.5">
                  Given name
                </label>
                <input
                  type="text"
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  placeholder="Anurag"
                  maxLength={40}
                  className="w-full rounded-xl border border-[#2c2d30] bg-[#161718] px-4 py-3 text-sm text-white placeholder-[#505d6e] focus:border-[#8b5cf6] focus:outline-none transition"
                />
              </div>

              <div>
                <label style={graphikLabelStyle} className="block mb-1.5">
                  Family name
                </label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="Pal"
                  maxLength={40}
                  className="w-full rounded-xl border border-[#2c2d30] bg-[#161718] px-4 py-3 text-sm text-white placeholder-[#505d6e] focus:border-[#8b5cf6] focus:outline-none transition"
                />
              </div>
            </div>

            {/* Email Address (Screenshot 1: Full width) */}
            <div>
              <label style={graphikLabelStyle} className="block mb-1.5">
                Email address
              </label>
              <input
                type="email"
                readOnly
                disabled
                value={userEmail || ""}
                className="w-full rounded-xl border border-[#2c2d30] bg-[#161718] px-4 py-3 text-sm text-[#8fa0b5] cursor-not-allowed select-none"
              />
            </div>

            {/* Location & Website (Screenshot 1: Two Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label style={graphikLabelStyle} className="block mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ind"
                  maxLength={50}
                  className="w-full rounded-xl border border-[#2c2d30] bg-[#161718] px-4 py-3 text-sm text-white placeholder-[#505d6e] focus:border-[#8b5cf6] focus:outline-none transition"
                />
              </div>

              <div>
                <label style={graphikLabelStyle} className="block mb-1.5">
                  Website
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  maxLength={120}
                  className="w-full rounded-xl border border-[#2c2d30] bg-[#161718] px-4 py-3 text-sm text-white placeholder-[#505d6e] focus:border-[#8b5cf6] focus:outline-none transition"
                />
              </div>
            </div>

            {/* Bio (Screenshot 1 content + Screenshot 2 0/500 counter) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label style={graphikLabelStyle}>Bio</label>
                <span className="text-xs text-[#7e8e9f] font-mono">{bio.length} / 500</span>
              </div>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                placeholder="Write a short bio to tell people more about yourself..."
                className="w-full rounded-xl border border-[#2c2d30] bg-[#161718] p-4 text-sm text-white placeholder-[#505d6e] focus:border-[#8b5cf6] focus:outline-none resize-none min-h-[120px] transition"
              />
            </div>
          </div>
        </div>

        {/* Buttons Row */}
        <div className="mt-8 flex items-center justify-end gap-3 pt-5 border-t border-[#2c2d30]">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={updateMutation.isPending}
              className="rounded-xl border border-[#2c2d30] bg-[#161718] px-5 py-2.5 text-sm font-semibold text-[#ccd5df] hover:bg-[#202224] hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
          ) : (
            <Link
              href={`/u/${profile.username}`}
              className="rounded-xl border border-[#2c2d30] bg-[#161718] px-5 py-2.5 text-sm font-semibold text-[#ccd5df] hover:bg-[#202224] hover:text-white transition"
            >
              Cancel
            </Link>
          )}

          <button
            type="submit"
            disabled={updateMutation.isPending || isUploadingPhoto}
            className="rounded-xl bg-[#00e054] px-7 py-2.5 text-sm font-bold text-black hover:bg-[#00c549] transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {isUploadingPhoto
              ? "Uploading photo…"
              : updateMutation.isPending
                ? "Saving changes…"
                : "Save changes"}
          </button>
        </div>
      </form>

      {/* Image Crop Modal */}
      {rawImageToCrop && (
        <ImageCropModal
          imageSrc={rawImageToCrop}
          onCrop={(croppedDataUrl) => {
            setAvatarURL(croppedDataUrl);
            setRawImageToCrop(null);
          }}
          onCancel={() => setRawImageToCrop(null)}
        />
      )}
    </div>
  );
}

export function EditProfileForm(props: EditProfileFormProps) {
  const userQuery = useCurrentUser();
  const currentUsername = userQuery.data?.username;
  const profileQuery = useProfile(currentUsername || "");

  if (userQuery.isPending || profileQuery.isPending) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse space-y-6 p-6">
        <div className="h-8 w-44 rounded-xl bg-[#161718] border border-[#2c2d30]" />
        <div className="h-28 rounded-2xl bg-[#161718] border border-[#2c2d30]" />
        <div className="h-40 rounded-2xl bg-[#161718] border border-[#2c2d30]" />
      </div>
    );
  }

  if (!userQuery.data || !profileQuery.data) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[#2c2d30] bg-[#161718] p-8 text-center text-white">
        <h2 className="text-xl font-bold">Sign In Required</h2>
        <p className="mt-2 text-sm text-[#8fa0b5]">Please sign in to edit your profile.</p>
        <Link
          href="/login?redirect=/edit-profile"
          className="mt-5 inline-block rounded-xl bg-[#00e054] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#00c549] transition"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <EditProfileFields
      key={profileQuery.data.id}
      profile={profileQuery.data}
      userEmail={userQuery.data.email}
      {...props}
    />
  );
}
