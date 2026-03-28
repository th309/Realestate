"use client";

import React, { useState, useRef } from "react";
import { Lock, Camera, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface PersonalInfoSectionProps {
  user: SupabaseUser;
}

export function PersonalInfoSection({ user }: PersonalInfoSectionProps) {
  const { updateProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(
    user.user_metadata?.display_name || "",
  );
  const [phone, setPhone] = useState(user.user_metadata?.phone || "");
  const [location, setLocation] = useState(user.user_metadata?.location || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user.user_metadata?.avatar_url || null,
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await updateProfile({
      display_name: displayName,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const { error: profileError } = await updateProfile({
        avatar_url: publicUrl,
      });
      if (profileError) throw profileError;

      setAvatarUrl(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const initials = (user.user_metadata?.display_name || user.email || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <section className="bg-white rounded-xl border border-indigo-200/50 p-6">
      <div className="flex items-center gap-2 mb-4">
        <User className="w-5 h-5 text-[#3949AB]" />
        <h2 className="text-lg font-semibold text-on-surface">
          Personal Information
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error/10 text-error text-sm">
          {error}
        </div>
      )}

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 group focus:outline-none focus:ring-2 focus:ring-[#3949AB]/30"
          disabled={uploading}
        >
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[#3949AB] flex items-center justify-center">
              <span className="text-xl font-semibold text-white">
                {initials}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? (
              <span className="text-white text-xs font-medium">
                Uploading...
              </span>
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarUpload}
        />
        <span className="text-sm text-on-surface-variant">
          Click to upload a new photo
        </span>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Display Name */}
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#3949AB]/30 focus:border-[#3949AB]"
            placeholder="Your name"
          />
        </div>

        {/* Email (locked) */}
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
            Email
          </label>
          <div className="relative">
            <input
              type="email"
              value={user.email || ""}
              disabled
              className="w-full px-3 py-2.5 pr-10 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface/60 cursor-not-allowed"
            />
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
          </div>
        </div>

        {/* Phone (optional) */}
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
            Phone <span className="text-on-surface-variant/50">(optional)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#3949AB]/30 focus:border-[#3949AB]"
            placeholder="(555) 123-4567"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
            Location{" "}
            <span className="text-on-surface-variant/50">(optional)</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#3949AB]/30 focus:border-[#3949AB]"
            placeholder="City, State"
          />
        </div>
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-[#3949AB] text-white rounded-lg text-sm font-medium hover:bg-[#3949AB]/90 transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save"}
      </button>
    </section>
  );
}
