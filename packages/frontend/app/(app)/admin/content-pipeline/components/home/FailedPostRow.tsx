"use client";
/**
 * One failed post, laid out for triage: what it was, when it was meant to go
 * out, how many attempts it burned, and what the platform said. The error text
 * is shown verbatim — it comes from the platform's own API, and paraphrasing it
 * would cost the operator the one string they can act on.
 *
 * Both actions are supported transitions on an already-failed post: retrying
 * reschedules it (failed -> scheduled) so the publisher picks it up again, and
 * skipping retires it (failed -> skipped).
 */
import { useState } from "react";
import type { PlannerPost } from "../../lib/posts-api";
import { PlatformGlyph } from "../../planner/platform-glyph";
import {
  formatEtDateTime,
  etDayKey,
  etTimeParts,
  etTodayKey,
  etWallClockToUtcIso,
} from "../../planner/planner-tz";

const PLATFORM_NAMES: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Seed for the picker: the slot it failed on, else this morning. */
function defaultLocalValue(post: PlannerPost): string {
  if (post.scheduled_at) {
    const t = etTimeParts(post.scheduled_at);
    return `${etDayKey(post.scheduled_at)}T${pad(t.hour)}:${pad(t.minute)}`;
  }
  return `${etTodayKey()}T09:00`;
}

export function FailedPostRow({
  post,
  maxAttempts,
  onRetryNow,
  onRetryAt,
  onSkip,
  busy = false,
}: {
  post: PlannerPost;
  /** Attempt budget the publisher spends before giving up. */
  maxAttempts: number;
  onRetryNow: () => void;
  onRetryAt: (iso: string) => void;
  onSkip: () => void;
  busy?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const [value, setValue] = useState(() => defaultLocalValue(post));

  const platform = PLATFORM_NAMES[post.platform] ?? post.platform;
  const hook = post.copy?.hook?.trim();
  const slot = post.scheduled_at
    ? `${formatEtDateTime(post.scheduled_at)} ET`
    : "No time set";
  const spent = post.attempts ?? 0;
  const exhausted = spent >= maxAttempts;

  function submitPicked() {
    const dayKey = value.slice(0, 10);
    const hour = Number(value.slice(11, 13));
    const minute = Number(value.slice(14, 16));
    if (!dayKey || Number.isNaN(hour) || Number.isNaN(minute)) return;
    onRetryAt(etWallClockToUtcIso(dayKey, hour, minute));
    setPicking(false);
  }

  return (
    <li className="rounded-xl border border-outline-variant bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-on-surface-variant">
        <PlatformGlyph platform={post.platform} />
        <span className="font-medium text-on-surface">{platform}</span>
        <span aria-hidden>·</span>
        <span className="font-mono tabular-nums">{slot}</span>
        <span aria-hidden>·</span>
        <span>
          {/* Leaving 'failed' resets the counter backend-side, so a retried post
              starts its budget over and `spent` should stay within it. The
              exhausted branch still avoids quoting the ceiling, so a stale or
              un-reset counter reads as a fact rather than as "4 of 3". */}
          {exhausted
            ? `Gave up after ${spent} attempt${spent === 1 ? "" : "s"}`
            : `Failed on attempt ${spent} of ${maxAttempts}`}
        </span>
      </div>

      {hook && (
        <p className="mt-2 line-clamp-2 text-sm font-medium text-on-surface">
          {hook}
        </p>
      )}

      <p
        className="mt-2 line-clamp-2 text-xs leading-relaxed text-on-surface-variant"
        title={post.error ?? undefined}
      >
        {post.error?.trim()
          ? post.error
          : "The publisher recorded no reason for this failure."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRetryNow}
          disabled={busy}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Try again now
        </button>
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          aria-expanded={picking}
          className="rounded-full border border-outline-variant px-4 py-1.5 text-xs font-semibold text-on-surface transition-colors duration-200 hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Pick a time
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="rounded-full px-4 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-high disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Skip
        </button>
      </div>

      {picking && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="New date and time (ET)"
            className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-xs text-on-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
          <button
            type="button"
            onClick={submitPicked}
            disabled={busy}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90 disabled:opacity-50"
          >
            Reschedule
          </button>
        </div>
      )}
    </li>
  );
}
