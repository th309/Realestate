"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Check,
  Lock,
  AlertTriangle,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

// --- OAuth provider helpers --------------------------------------------------

const PROVIDERS = [
  { id: "google", label: "Google", icon: GoogleIcon },
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

// --- Main component ----------------------------------------------------------

interface AccountSecuritySectionProps {
  user: User;
}

export function AccountSecuritySection({ user }: AccountSecuritySectionProps) {
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const [showPasswordForm, setShowPasswordForm] = useState(
    searchParams?.get("reset") === "true",
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <section className="bg-white rounded-xl border border-indigo-200/50 p-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-[#3949AB]" />
        <h2 className="text-lg font-semibold text-on-surface">
          Account & Security
        </h2>
      </div>

      {/* Change Password */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowPasswordForm(!showPasswordForm)}
          className="flex items-center gap-2 text-sm font-medium text-on-surface hover:text-[#3949AB] transition-colors"
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
      <div className="mb-6">
        <h3 className="text-xs font-medium text-on-surface-variant mb-3">
          Connected Accounts
        </h3>
        <div className="space-y-2">
          {PROVIDERS.map((provider) => {
            const linked = user.identities?.some(
              (id) => id.provider === provider.id,
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
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#3949AB]/10 text-[#3949AB]">
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

      {/* Delete Account */}
      <div className="pt-4 border-t border-outline-variant">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-error">
          Danger Zone
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Delete Account
        </button>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />
      )}
    </section>
  );
}

// --- Password Form -----------------------------------------------------------

function PasswordForm({ onClose }: { onClose: () => void }) {
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    const { error: err } = await updatePassword(newPassword);
    setSaving(false);

    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 max-w-sm">
      {error && (
        <div className="p-3 rounded-lg bg-error/10 text-error text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-[#3949AB]/10 text-[#3949AB] text-sm flex items-center gap-2">
          <Check className="w-4 h-4" /> Password updated!
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
          className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#3949AB]/30 focus:border-[#3949AB]"
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
          className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-[#3949AB]/30 focus:border-[#3949AB]"
          placeholder="Confirm new password"
          required
          minLength={6}
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-[#3949AB] text-white rounded-lg text-sm font-medium hover:bg-[#3949AB]/90 transition-colors disabled:opacity-50"
      >
        {saving ? "Updating..." : "Update Password"}
      </button>
    </form>
  );
}

// --- Delete Account Modal ----------------------------------------------------

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const canDelete = confirmText === "DELETE";

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    // In production this would call a backend endpoint to delete the account
    // For now, direct to support
    window.location.href =
      "mailto:support@propertyiq.app?subject=Account%20Deletion%20Request";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-on-surface">
              Delete Account
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-on-surface/5 transition-colors"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        <p className="text-sm text-on-surface-variant mb-4">
          This action is{" "}
          <strong className="text-red-600">permanent and irreversible</strong>.
          All your data, reports, saved markets, and preferences will be
          permanently deleted.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
            Type <strong>DELETE</strong> to confirm
          </label>
          <input
            ref={inputRef}
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-container-low border border-red-300 rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-red-300"
            placeholder="DELETE"
          />
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete My Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
