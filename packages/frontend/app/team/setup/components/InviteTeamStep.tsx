"use client";

import { useState } from "react";
import {
  Mail,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { inviteOrgMember } from "@/lib/data";

const BASE_SEATS = 10;

interface InviteTeamStepProps {
  orgSlug: string;
  onNext: () => void;
  onBack: () => void;
}

interface EmailEntry {
  email: string;
  status: "pending" | "sending" | "sent" | "error";
  error?: string;
}

export function InviteTeamStep({
  orgSlug,
  onNext,
  onBack,
}: InviteTeamStepProps) {
  const [emails, setEmails] = useState<EmailEntry[]>([
    { email: "", status: "pending" },
  ]);
  const [sending, setSending] = useState(false);

  const seatsUsed = 1; // Owner
  const inviteCount = emails.filter((e) => e.email.trim()).length;
  const totalUsed = seatsUsed + inviteCount;
  const atCapacity = totalUsed >= BASE_SEATS;

  function addEmail() {
    if (atCapacity) return;
    setEmails((prev) => [...prev, { email: "", status: "pending" }]);
  }

  function removeEmail(index: number) {
    setEmails((prev) => prev.filter((_, i) => i !== index));
  }

  function updateEmail(index: number, value: string) {
    setEmails((prev) =>
      prev.map((e, i) =>
        i === index ? { ...e, email: value, status: "pending" as const } : e,
      ),
    );
  }

  async function handleSendInvites() {
    const valid = emails.filter((e) => e.email.trim() && e.status !== "sent");
    if (valid.length === 0) {
      onNext();
      return;
    }

    setSending(true);

    const updated = [...emails];
    for (let i = 0; i < updated.length; i++) {
      const entry = updated[i];
      if (!entry.email.trim() || entry.status === "sent") continue;

      updated[i] = { ...entry, status: "sending" };
      setEmails([...updated]);

      try {
        await inviteOrgMember(orgSlug, entry.email.trim(), "member");
        updated[i] = { ...entry, status: "sent" };
      } catch (err: unknown) {
        updated[i] = {
          ...entry,
          status: "error",
          error: err instanceof Error ? err.message : "Failed to send invite",
        };
      }
      setEmails([...updated]);
    }

    setSending(false);
    setTimeout(onNext, 1500);
  }

  const seatPercentage = Math.min((totalUsed / BASE_SEATS) * 100, 100);
  const barColor =
    seatPercentage > 95
      ? "bg-red-500"
      : seatPercentage >= 80
        ? "bg-amber-500"
        : "bg-green-500";

  return (
    <div className="bg-surface-container-low rounded-2xl p-8 shadow-sm">
      <div className="text-center mb-6">
        <Mail className="h-10 w-10 text-primary mx-auto mb-3" />
        <h1 className="text-xl font-medium text-on-surface">
          Invite Your Team
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Your plan includes {BASE_SEATS} seats. Add teammates now or do it
          later.
        </p>
      </div>

      {/* Seat usage bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-on-surface-variant mb-1">
          <span>
            {totalUsed} of {BASE_SEATS} seats used
          </span>
          <span>{BASE_SEATS - totalUsed} remaining</span>
        </div>
        <div className="h-2 w-full rounded-full bg-surface-container">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${seatPercentage}%` }}
          />
        </div>
      </div>

      {/* Email inputs */}
      <div className="space-y-3 mb-4">
        {emails.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="email"
              value={entry.email}
              onChange={(e) => updateEmail(i, e.target.value)}
              placeholder="teammate@company.com"
              disabled={sending || entry.status === "sent"}
              className="flex-1 px-3 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            {entry.status === "sent" && (
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            )}
            {entry.status === "sending" && (
              <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
            )}
            {entry.status === "error" && (
              <span title={entry.error}>
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              </span>
            )}
            {entry.status === "pending" && emails.length > 1 && (
              <button
                onClick={() => removeEmail(i)}
                className="p-1 text-on-surface-variant hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!atCapacity && (
        <button
          onClick={addEmail}
          disabled={sending}
          className="text-sm text-primary font-medium inline-flex items-center gap-1 hover:opacity-80 mb-6"
        >
          <Plus className="w-4 h-4" /> Add another
        </button>
      )}

      {atCapacity && (
        <p className="text-xs text-amber-600 mb-6">
          All seats filled — you can purchase additional seats in Billing.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/30">
        <button
          onClick={onBack}
          disabled={sending}
          className="text-sm text-on-surface-variant hover:text-on-surface inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex gap-3">
          <button
            onClick={onNext}
            disabled={sending}
            className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface"
          >
            Skip
          </button>
          <button
            onClick={handleSendInvites}
            disabled={sending || inviteCount === 0}
            className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
          >
            {sending && <Loader2 className="w-4 h-4 animate-spin" />}
            Send Invites
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
