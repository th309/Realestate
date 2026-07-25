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

/** Default `datetime-local` value (ET wall-clock) for the picker. */
function defaultLocalValue(post: PlannerPost): string {
  if (post.scheduled_at) {
    const t = etTimeParts(post.scheduled_at);
    return `${etDayKey(post.scheduled_at)}T${pad(t.hour)}:${pad(t.minute)}`;
  }
  return `${etTodayKey()}T09:00`;
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
  const [value, setValue] = useState(() => defaultLocalValue(post));

  const chip = postStatusToStatusChip(post.status);
  const time = post.scheduled_at ? formatEtTime(post.scheduled_at) : null;
  const hook = post.copy?.hook?.trim();
  // Stop pointer AND keyboard events from bubbling to the draggable wrapper —
  // otherwise Enter/Space on these nested controls would also reach @dnd-kit's
  // KeyboardSensor and start a drag.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  function submit() {
    const dayKey = value.slice(0, 10);
    const hour = Number(value.slice(11, 13));
    const minute = Number(value.slice(14, 16));
    if (!dayKey || Number.isNaN(hour) || Number.isNaN(minute)) return;
    onReschedule?.(post, etWallClockToUtcIso(dayKey, hour, minute));
    setPicking(false);
  }

  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-2 shadow-sm">
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
        <div className="mt-2" onPointerDown={stop} onKeyDown={stop}>
          <div className="flex items-center gap-1.5">
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="New date and time (ET)"
              className="min-w-0 flex-1 rounded border border-outline-variant bg-surface px-1.5 py-1 text-[11px] text-on-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
            <button
              type="button"
              onClick={submit}
              className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-on-primary transition-colors hover:bg-primary/90"
            >
              Set
            </button>
          </div>
          <p className="mt-1 text-[10px] text-on-surface-variant">Time in ET</p>
        </div>
      )}
    </div>
  );
}
