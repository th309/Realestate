/**
 * Week view — seven Eastern-Time day columns as @dnd-kit droppables. Scheduled
 * posts sit in their day's column ordered by time; dropping a post on a column
 * reschedules it there. Today's column is tinted; a column highlights while a
 * post hovers it. (No "use client" — only ever imported by the client planner
 * page, so the directive would be a redundant client-entry marker.)
 */
import type { PlannerPost } from "../lib/posts-api";
import { DraggablePostCard } from "./DraggablePostCard";
import { DroppableDay } from "./DroppableDay";
import { weekKeys, weekdayShort, dayOfMonth } from "./planner-tz";

export function WeekView({
  anchorKey,
  todayKey,
  postsByDay,
  onReschedule,
}: {
  anchorKey: string;
  todayKey: string;
  postsByDay: Map<string, PlannerPost[]>;
  onReschedule: (post: PlannerPost, iso: string) => void;
}) {
  const days = weekKeys(anchorKey);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[56rem] grid-cols-7 gap-2">
        {days.map((dayKey) => {
          const isToday = dayKey === todayKey;
          const posts = postsByDay.get(dayKey) ?? [];
          return (
            <DroppableDay
              key={dayKey}
              dayKey={dayKey}
              className={(isOver) =>
                `flex min-h-[24rem] flex-col rounded-xl border p-2 transition-colors duration-200 ${
                  isOver
                    ? "border-dashed border-primary bg-primary-container/40"
                    : isToday
                      ? "border-primary/30 bg-primary-container/20"
                      : "border-outline-variant bg-surface-container-low"
                }`
              }
            >
              <div className="mb-2 flex items-baseline justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  {weekdayShort(dayKey)}
                </span>
                <span
                  className={`font-mono text-sm tabular-nums ${
                    isToday ? "font-bold text-primary" : "text-on-surface"
                  }`}
                >
                  {dayOfMonth(dayKey)}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {posts.length === 0 ? (
                  <span className="px-1 pt-1 text-[11px] text-on-surface-variant/70">
                    —
                  </span>
                ) : (
                  posts.map((post) => (
                    <DraggablePostCard
                      key={post.id}
                      post={post}
                      onReschedule={onReschedule}
                    />
                  ))
                )}
              </div>
            </DroppableDay>
          );
        })}
      </div>
    </div>
  );
}
