/**
 * A single post on the planner — pure presentation so it can also render inside
 * the drag overlay. Platform glyph + ET time, an optional hook line, and a
 * StatusChip. When `onReschedule` is provided it also shows a clock button that
 * opens an inline date/time picker — the pointer-free / non-drag path to
 * reschedule (drag is the other path). Pointer events on the controls stop
 * propagation so they never start a drag.
 */
import { useState } from "react";
import type { PlannerPost } from "../lib/posts-api";
import {
  StatusChip,
  postStatusToStatusChip,
} from "../components/home/StatusChip";
import { PlatformGlyph } from "./platform-glyph";
import { PostMediaThumb } from "../components/PostMediaThumb";
import {
  formatEtTime,
  etDayKey,
  etTimeParts,
  etTodayKey,
  etWallClockToUtcIso,
} from "./planner-tz";

function prettyPostType(postType: string): string {
  return (postType || "post").replace(/_/g, " ");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Posting times are half-hour granularity by policy — the picker offers only
 * :00 and :30, matching the auto-scheduler's slot times.
 */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? 0 : 30;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return {
    value: `${pad(hour)}:${pad(minute)}`,
    label: `${h12}:${pad(minute)} ${hour < 12 ? "AM" : "PM"}`,
  };
});

/** Default picker date (ET day key). */
function defaultDateValue(post: PlannerPost): string {
  return post.scheduled_at ? etDayKey(post.scheduled_at) : etTodayKey();
}

/**
 * Default picker time, floored to its containing half-hour so a legacy
 * odd-minute schedule still matches one of the select options.
 */
function defaultTimeValue(post: PlannerPost): string {
  if (!post.scheduled_at) return "09:00";
  const t = etTimeParts(post.scheduled_at);
  return `${pad(t.hour)}:${t.minute < 30 ? "00" : "30"}`;
}

export function PostCard({
  post,
  showHook = true,
  onReschedule,
}: {
  post: PlannerPost;
  showHook?: boolean;
  onReschedule?: (post: PlannerPost, iso: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [dateValue, setDateValue] = useState(() => defaultDateValue(post));
  const [timeValue, setTimeValue] = useState(() => defaultTimeValue(post));

  const chip = postStatusToStatusChip(post.status);
  const time = post.scheduled_at ? formatEtTime(post.scheduled_at) : null;
  const hook = post.copy?.hook?.trim();
  // Stop pointer AND keyboard events from bubbling to the draggable wrapper —
  // otherwise Enter/Space on these nested controls would also reach @dnd-kit's
  // KeyboardSensor and start a drag.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  function submit() {
    const hour = Number(timeValue.slice(0, 2));
    const minute = Number(timeValue.slice(3, 5));
    if (!dateValue || Number.isNaN(hour) || Number.isNaN(minute)) return;
    onReschedule?.(post, etWallClockToUtcIso(dateValue, hour, minute));
    setPicking(false);
  }

  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-2 shadow-sm">
      <PostMediaThumb
        urls={post.mediaUrls}
        className="mb-1.5 h-16 w-full"
        rounded="rounded-md"
      />

      <div className="flex items-center gap-1.5">
        <PlatformGlyph platform={post.platform} />
        {time && (
          <span className="font-mono text-[11px] tabular-nums text-on-surface-variant">
            {time}
          </span>
        )}
        {onReschedule && (
          <button
            type="button"
            onPointerDown={stop}
            onKeyDown={stop}
            onClick={(e) => {
              stop(e);
              // Re-seed from the post on open: the card instance survives
              // reschedules (keyed by post.id) and background refetches, so
              // mount-time state can be stale by the time the picker opens.
              if (!picking) {
                setDateValue(defaultDateValue(post));
                setTimeValue(defaultTimeValue(post));
              }
              setPicking((v) => !v);
            }}
            aria-label="Reschedule this post"
            aria-expanded={picking}
            className="ml-auto rounded p-0.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </button>
        )}
      </div>

      {showHook && hook && (
        <p className="mt-1 line-clamp-2 text-xs font-medium text-on-surface">
          {hook}
        </p>
      )}

      <div className="mt-1.5 flex items-center gap-1.5">
        <StatusChip tone={chip.tone} label={chip.label} />
        <span className="truncate text-[10px] capitalize text-on-surface-variant">
          {prettyPostType(post.post_type)}
        </span>
      </div>

      {picking && onReschedule && (
        <div className="mt-2 space-y-1.5" onPointerDown={stop} onKeyDown={stop}>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            aria-label="New date (ET)"
            className="w-full rounded border border-outline-variant bg-surface px-1.5 py-1 text-[11px] text-on-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
          <div className="flex items-center gap-1.5">
            <select
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              aria-label="New time (ET)"
              className="min-w-0 flex-1 rounded border border-outline-variant bg-surface px-1.5 py-1 text-[11px] text-on-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={submit}
              className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-on-primary transition-colors hover:bg-primary/90"
            >
              Set
            </button>
          </div>
          <p className="text-[10px] text-on-surface-variant">Time in ET</p>
        </div>
      )}
    </div>
  );
}
