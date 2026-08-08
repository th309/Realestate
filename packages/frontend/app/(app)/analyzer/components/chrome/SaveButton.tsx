"use client";

import Link from "next/link";
import { Bookmark, Check, Loader2, Lock, RotateCcw } from "lucide-react";
import type { SaveStatus } from "../../lib/use-deal-autosave";

const PILL =
  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed";

interface Props {
  status: SaveStatus;
  /** Whether a saved-deal row already exists. A first-ever save reads
   *  differently ("Save deal") than a re-save of an existing one. */
  hasRow: boolean;
  /**
   * Whether this user's edits can actually be persisted. False for a lapsed
   * or free user: `GET /saved/:id` is deliberately NOT Pro-gated so they can
   * still open trial-era deals, but autosave and the PATCH endpoint are — so
   * the row exists while nothing they type is being written. Defaults true.
   */
  canSave?: boolean;
  onClick: () => void;
}

/**
 * The save affordance AND the save indicator, sitting beside PDF/Share.
 *
 * Saving was previously a side effect of Share or PDF — there was no way to
 * deliberately save a deal, and no visible confirmation that autosave (Task
 * 8) had actually written. The error state is the point: a silent autosave
 * failure loses work, so a failure has to surface on the control the user
 * already watches, not only in a modal they may never open.
 *
 * The same logic drives the `!canSave` branch. "Saved" on a row a non-Pro
 * user is editing is the worst possible lie the control can tell: it is
 * affirmative reassurance, on the exact control they would check, that work
 * being silently dropped is safe.
 */
export function SaveButton({ status, hasRow, canSave = true, onClick }: Props) {
  if (!canSave)
    return (
      <Link
        href="/pricing?from=analyzer_save"
        className={`${PILL} bg-piq-amber-soft text-piq-amber hover:opacity-90`}
      >
        <Lock className="h-4 w-4" aria-hidden />
        {hasRow ? "Upgrade to save edits" : "Upgrade to save"}
      </Link>
    );

  return <SaveStateButton status={status} hasRow={hasRow} onClick={onClick} />;
}

function SaveStateButton({ status, hasRow, onClick }: Omit<Props, "canSave">) {
  const saving = status === "saving";
  const error = status === "error";
  const saved = status === "saved" || hasRow;

  const label = saving
    ? "Saving…"
    : error
      ? "Retry save"
      : saved
        ? "Saved"
        : "Save deal";

  const Icon = saving ? Loader2 : error ? RotateCcw : saved ? Check : Bookmark;

  const tone = saving
    ? "bg-piq-indigo-soft text-piq-indigo"
    : error
      ? "bg-piq-red-soft text-piq-red"
      : saved
        ? "bg-piq-green-soft text-piq-green"
        : "bg-piq-indigo text-piq-on-indigo hover:opacity-90";

  return (
    <button
      type="button"
      onClick={saving ? undefined : onClick}
      disabled={saving}
      aria-live="polite"
      className={`${PILL} ${tone}`}
    >
      <Icon className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} aria-hidden />
      {label}
    </button>
  );
}
