/**
 * Staging shelf for approved posts that have no scheduled_at yet. Drag a card
 * onto a day in the calendar to schedule it — the parent picks a best-time slot
 * for that day. Hidden when there's nothing waiting to schedule.
 */
import type { PlannerPost } from "../lib/posts-api";
import { PostCard } from "./PostCard";

export function UnscheduledTray({
  posts,
  onDragStart,
  onDragEnd,
}: {
  posts: PlannerPost[];
  onDragStart: (postId: string) => void;
  onDragEnd: () => void;
}) {
  if (posts.length === 0) return null;

  return (
    <section
      aria-labelledby="unscheduled-tray-heading"
      className="rounded-xl border border-outline-variant bg-surface-container-low p-4"
    >
      <div className="mb-2 flex items-baseline gap-3">
        <h2
          id="unscheduled-tray-heading"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
        >
          Ready to schedule
        </h2>
        <span className="text-sm text-on-surface-variant">
          Drag a post onto a day to schedule it at a best-time slot.
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {posts.map((post) => (
          <div key={post.id} className="w-[180px]">
            <PostCard
              post={post}
              draggable
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
