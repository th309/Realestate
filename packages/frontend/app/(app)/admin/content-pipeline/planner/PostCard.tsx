/**
 * A single post on the planner. Compact by design so several stack in a day
 * cell: platform glyph + ET time, an optional hook line, and a StatusChip.
 * When `draggable`, it participates in native HTML5 drag-and-drop; the parent
 * reads the post id off the drop and computes the new scheduled_at.
 */
import type { PlannerPost } from "../lib/posts-api";
import {
  StatusChip,
  postStatusToStatusChip,
} from "../components/home/StatusChip";
import { PlatformGlyph } from "./platform-glyph";
import { formatEtTime } from "./planner-tz";

function prettyPostType(postType: string): string {
  return (postType || "post").replace(/_/g, " ");
}

export function PostCard({
  post,
  draggable = false,
  showHook = true,
  onDragStart,
  onDragEnd,
}: {
  post: PlannerPost;
  draggable?: boolean;
  showHook?: boolean;
  onDragStart?: (postId: string) => void;
  onDragEnd?: () => void;
}) {
  const chip = postStatusToStatusChip(post.status);
  const time = post.scheduled_at ? formatEtTime(post.scheduled_at) : null;
  const hook = post.copy?.hook?.trim();

  return (
    <div
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.setData("text/plain", post.id);
              e.dataTransfer.effectAllowed = "move";
              onDragStart?.(post.id);
            }
          : undefined
      }
      onDragEnd={draggable ? () => onDragEnd?.() : undefined}
      className={`rounded-lg border border-outline-variant bg-surface p-2 shadow-sm transition-shadow duration-200 ${
        draggable ? "cursor-grab hover:shadow-md active:cursor-grabbing" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <PlatformGlyph platform={post.platform} />
        {time && (
          <span className="font-mono text-[11px] tabular-nums text-on-surface-variant">
            {time}
          </span>
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
    </div>
  );
}
