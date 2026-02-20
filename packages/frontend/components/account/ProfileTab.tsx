'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Lock, Upload, Camera, ChevronDown, ChevronUp, Check, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

// --- OAuth provider helpers ---------------------------------------------------

const PROVIDERS = [
  { id: 'google', label: 'Google', icon: GoogleIcon },
  { id: 'apple', label: 'Apple', icon: AppleIcon },
  { id: 'github', label: 'GitHub', icon: GithubIcon },
] as const;

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21.5c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

// --- Main component -----------------------------------------------------------

interface ProfileTabProps {
  user: User;
}

export function ProfileTab({ user }: ProfileTabProps) {
  return (
    <div className="py-8 space-y-0">
      <PersonalInfoSection user={user} />
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
    user.user_metadata?.display_name || ''
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user.user_metadata?.avatar_url || null
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
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const { error: profileError } = await updateProfile({ avatar_url: publicUrl });
      if (profileError) throw profileError;

      setAvatarUrl(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const initials =
    (user.user_metadata?.display_name || user.email || '?').charAt(0).toUpperCase();

  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">Personal Information</h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error/10 text-error text-sm">{error}</div>
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
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary flex items-center justify-center">
              <span className="text-xl font-semibold text-on-primary">{initials}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? (
              <span className="text-white text-xs font-medium">Uploading...</span>
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
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
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
              value={user.email || ''}
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

// --- Security Section ---------------------------------------------------------

function SecuritySection({ user }: { user: User }) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">Security</h3>

      {/* Change Password */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowPasswordForm(!showPasswordForm)}
          className="flex items-center gap-2 text-sm font-medium text-on-surface hover:text-primary transition-colors"
        >
          {showPasswordForm ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          Change Password
        </button>

        {showPasswordForm && (
          <PasswordForm onClose={() => setShowPasswordForm(false)} />
        )}
      </div>

      {/* Connected Accounts */}
      <div>
        <h4 className="text-xs font-medium text-on-surface-variant mb-3">
          Connected Accounts
        </h4>
        <div className="space-y-2">
          {PROVIDERS.map((provider) => {
            const linked = user.identities?.some(
              (id) => id.provider === provider.id
            );
            const Icon = provider.icon;

            return (
              <div
                key={provider.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-on-surface-variant" />
                  <span className="text-sm font-medium text-on-surface">
                    {provider.label}
                  </span>
                </div>
                {linked ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    <Check className="w-3 h-3" />
                    Connected
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-on-surface/5 text-on-surface-variant">
                    Not connected
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PasswordForm({ onClose }: { onClose: () => void }) {
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    const { error: err } = await updatePassword(newPassword);
    setSaving(false);

    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 max-w-sm">
      {error && (
        <div className="p-3 rounded-lg bg-error/10 text-error text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-primary/10 text-primary text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          Password updated!
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
          New Password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          placeholder="New password"
          required
          minLength={6}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
          Confirm Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          placeholder="Confirm new password"
          required
          minLength={6}
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  );
}

// --- Account Actions Section --------------------------------------------------

function AccountActionsSection() {
  const [showWarning, setShowWarning] = useState(false);

  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">Account Actions</h3>

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
              Contact support at{' '}
              <a
                href="mailto:support@propertyiq.com"
                className="font-medium text-primary hover:underline"
              >
                support@propertyiq.com
              </a>{' '}
              to delete your account and all associated data.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
