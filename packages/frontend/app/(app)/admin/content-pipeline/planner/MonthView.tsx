/**
 * Month view — a 6×7 Eastern-Time grid of @dnd-kit droppable day cells. Each
 * cell shows up to a few posts, then a "+N more" button that opens week view
 * anchored on that day so overflowed posts stay reachable (and draggable).
 * Days outside the anchor month are dimmed; today is tinted. (No "use client":
 * only imported by the client planner page.)
 */
import type { PlannerPost } from "../lib/posts-api";
import { DraggablePostCard } from "./DraggablePostCard";
import { DroppableDay } from "./DroppableDay";
import {
  monthGridKeys,
  weekdayShort,
  dayOfMonth,
  sameMonth,
} from "./planner-tz";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_PER_CELL = 3;

export function MonthView({
  anchorKey,
  todayKey,
  postsByDay,
  onReschedule,
  onOpenDay,
}: {
  anchorKey: string;
  todayKey: string;
  postsByDay: Map<string, PlannerPost[]>;
  onReschedule: (post: PlannerPost, iso: string) => void;
  onOpenDay: (dayKey: string) => void;
}) {
  const cells = monthGridKeys(anchorKey);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[56rem]">
        <div className="grid grid-cols-7 gap-2 pb-2">
          {WEEKDAY_HEADERS.map((label) => (
            <div
              key={label}
              className="px-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {cells.map((dayKey) => {
            const inMonth = sameMonth(dayKey, anchorKey);
            const isToday = dayKey === todayKey;
            const posts = postsByDay.get(dayKey) ?? [];
            const overflow = posts.length - MAX_PER_CELL;
            return (
              <DroppableDay
                key={dayKey}
                dayKey={dayKey}
                className={(isOver) =>
                  `flex min-h-[7.5rem] flex-col rounded-lg border p-1.5 transition-colors duration-200 ${
                    isOver
                      ? "border-dashed border-primary bg-primary-container/40"
                      : isToday
                        ? "border-primary/30 bg-primary-container/20"
                        : inMonth
                          ? "border-outline-variant bg-surface-container-low"
                          : "border-outline-variant/50 bg-surface"
                  }`
                }
              >
                <div className="mb-1 flex items-center justify-between px-0.5">
                  <span className="sr-only">{weekdayShort(dayKey)}</span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      isToday
                        ? "font-bold text-primary"
                        : inMonth
                          ? "text-on-surface"
                          : "text-on-surface-variant/60"
                    }`}
                  >
                    {dayOfMonth(dayKey)}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  {posts.slice(0, MAX_PER_CELL).map((post) => (
                    <DraggablePostCard
                      key={post.id}
                      post={post}
                      showHook={false}
                      onReschedule={onReschedule}
                    />
                  ))}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenDay(dayKey)}
                      className="mt-0.5 rounded px-1 text-left text-[10px] font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                    >
                      + {overflow} more
                    </button>
                  )}
                </div>
              </DroppableDay>
            );
          })}
        </div>
      </div>
    </div>
  );
}
