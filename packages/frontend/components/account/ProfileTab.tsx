"use client";

import React, { useState, useRef } from "react";
import { Lock, Camera, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PreferencesSection } from "./PreferencesSection";
import { SecuritySection } from "./SecuritySection";
import type { User } from "@supabase/supabase-js";

// --- Main component -----------------------------------------------------------

interface ProfileTabProps {
  user: User;
}

export function ProfileTab({ user }: ProfileTabProps) {
  return (
    <div className="py-8 space-y-0">
      <PersonalInfoSection user={user} />
      <div className="border-t border-outline-variant my-8" />
      <PreferencesSection user={user} />
      <div className="border-t border-outline-variant my-8" />
      <SecuritySection user={user} />
      <div className="border-t border-outline-variant my-8" />
      <AccountActionsSection />
    </div>
  );
}

// --- Personal Info Section ----------------------------------------------------

function PersonalInfoSection({ user }: { user: User }) {
  const { updateProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(
    user.user_metadata?.display_name || "",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user.user_metadata?.avatar_url || null,
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveName = async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await updateProfile({ display_name: displayName });
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
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">
        Personal Information
      </h3>

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
          className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 group focus:outline-none focus:ring-2 focus:ring-primary/30"
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
            <div className="w-full h-full bg-primary flex items-center justify-center">
              <span className="text-xl font-semibold text-on-primary">
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
        <div className="text-sm text-on-surface-variant">
          Click to upload a new photo
        </div>
      </div>

      {/* Display name */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
            Display Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Your name"
            />
            <button
              type="button"
              onClick={handleSaveName}
              disabled={saving}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {saving ? "Saving..." : saved ? "Saved!" : "Save"}
            </button>
          </div>
        </div>

        {/* Email (read-only) */}
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
      </div>
    </section>
  );
}

// --- Account Actions Section --------------------------------------------------

function AccountActionsSection() {
  const [showWarning, setShowWarning] = useState(false);

  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">
        Account Actions
      </h3>

      <button
        type="button"
        onClick={() => setShowWarning(true)}
        className="px-4 py-2 bg-error text-on-error rounded-lg text-sm font-medium hover:bg-error/90 transition-colors"
      >
        Delete Account
      </button>

      {showWarning && (
        <div className="mt-4 p-4 rounded-lg bg-error/10 border border-error/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <p className="text-sm text-on-surface">
              Contact support at{" "}
              <a
                href="mailto:support@propertyiq.app"
                className="font-medium text-primary hover:underline"
              >
                support@propertyiq.app
              </a>{" "}
              to delete your account and all associated data.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
