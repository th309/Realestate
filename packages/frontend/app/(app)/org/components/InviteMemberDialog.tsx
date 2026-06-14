"use client";

import React, { useState, useCallback } from "react";
import { Mail, X, AlertCircle } from "lucide-react";

interface SeatInfo {
  used: number;
  total: number;
}

interface InviteMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (
    email: string,
    role: string,
    firstName?: string,
    lastName?: string,
  ) => Promise<void>;
  seatInfo: SeatInfo;
}

/**
 * M3 dialog for inviting new members to the organization.
 * Validates email, lets the user choose a role, and warns near seat capacity.
 */
export function InviteMemberDialog({
  isOpen,
  onClose,
  onInvite,
  seatInfo,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atCapacity = seatInfo.used >= seatInfo.total;
  const nearCapacity =
    seatInfo.total > 0 && seatInfo.used / seatInfo.total >= 0.8;

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValidEmail || atCapacity) return;
      setSubmitting(true);
      setError(null);
      try {
        await onInvite(
          email,
          role,
          firstName.trim() || undefined,
          lastName.trim() || undefined,
        );
        setEmail("");
        setFirstName("");
        setLastName("");
        setRole("member");
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send invitation",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [email, role, isValidEmail, atCapacity, onInvite, onClose],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />

      {/* Dialog */}
      <div className="relative bg-surface rounded-[28px] shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium text-on-surface">Invite Member</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email input */}
          <div>
            <label
              htmlFor="invite-email"
              className="block text-sm font-medium text-on-surface mb-1.5"
            >
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full rounded-xl border border-outline-variant bg-surface pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={submitting}
                autoFocus
              />
            </div>
          </div>

          {/* Name fields */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label
                htmlFor="invite-first-name"
                className="block text-sm font-medium text-on-surface mb-1.5"
              >
                First name
              </label>
              <input
                id="invite-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={submitting}
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="invite-last-name"
                className="block text-sm font-medium text-on-surface mb-1.5"
              >
                Last name
              </label>
              <input
                id="invite-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Role selection */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">
              Role
            </label>
            <div className="flex gap-3">
              {(["member", "admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                    role === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container"
                  }`}
                  disabled={submitting}
                >
                  {r === "admin" ? "Admin" : "Member"}
                </button>
              ))}
            </div>
            <p className="text-xs text-on-surface-variant mt-1.5">
              {role === "admin"
                ? "Admins can manage members, billing, and settings."
                : "Members can access shared org resources."}
            </p>
          </div>

          {/* Seat capacity warnings */}
          {atCapacity && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 dark:bg-red-950/20">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <div className="text-sm text-red-700 dark:text-red-400">
                <p className="font-medium">All seats are in use</p>
                <p className="mt-0.5">
                  Add more seats in Billing before inviting new members.
                </p>
              </div>
            </div>
          )}
          {!atCapacity && nearCapacity && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {seatInfo.used} of {seatInfo.total} seats used — nearing
                capacity.
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValidEmail || atCapacity || submitting}
              className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
