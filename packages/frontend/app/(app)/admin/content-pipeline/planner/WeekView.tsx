"use client";
/**
 * Week view — seven Eastern-Time day columns. Scheduled posts sit in their
 * day's column ordered by time; each column is a native drop target that
 * reschedules a dropped post onto that day. Today's column is tinted.
 */
import { useState } from "react";
import type { PlannerPost } from "../lib/posts-api";
import { PostCard } from "./PostCard";
import { weekKeys, weekdayShort, dayOfMonth } from "./planner-tz";

export function WeekView({
  anchorKey,
  todayKey,
  postsByDay,
  draggingId,
  onDropOnDay,
  onDragStart,
  onDragEnd,
}: {
  anchorKey: string;
  todayKey: string;
  postsByDay: Map<string, PlannerPost[]>;
  draggingId: string | null;
  onDropOnDay: (dayKey: string, postId: string) => void;
  onDragStart: (postId: string) => void;
  onDragEnd: () => void;
}) {
  const [overKey, setOverKey] = useState<string | null>(null);
  const days = weekKeys(anchorKey);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[56rem] grid-cols-7 gap-2">
        {days.map((dayKey) => {
          const isToday = dayKey === todayKey;
          const isOver = overKey === dayKey && draggingId !== null;
          const posts = postsByDay.get(dayKey) ?? [];
          return (
            <div
              key={dayKey}
              onDragOver={(e) => {
                if (draggingId) {
                  e.preventDefault();
                  setOverKey(dayKey);
                }
              }}
              onDragLeave={() => setOverKey((k) => (k === dayKey ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                setOverKey(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) onDropOnDay(dayKey, id);
              }}
              className={`flex min-h-[24rem] flex-col rounded-xl border p-2 transition-colors duration-200 ${
                isOver
                  ? "border-primary border-dashed bg-primary-container/40"
                  : isToday
                    ? "border-primary/30 bg-primary-container/20"
                    : "border-outline-variant bg-surface-container-low"
              }`}
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
                    {isOver ? "Drop to schedule" : "—"}
                  </span>
                ) : (
                  posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      draggable
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
