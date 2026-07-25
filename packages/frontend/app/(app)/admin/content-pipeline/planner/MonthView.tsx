"use client";
/**
 * Month view — a 6×7 Eastern-Time grid. Each day cell is a drop target and
 * shows up to a few posts, then "+N more". Days outside the anchor month are
 * dimmed; today is tinted.
 */
import { useState } from "react";
import type { PlannerPost } from "../lib/posts-api";
import { PostCard } from "./PostCard";
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
            const isOver = overKey === dayKey && draggingId !== null;
            const posts = postsByDay.get(dayKey) ?? [];
            const overflow = posts.length - MAX_PER_CELL;
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
                className={`flex min-h-[7.5rem] flex-col rounded-lg border p-1.5 transition-colors duration-200 ${
                  isOver
                    ? "border-primary border-dashed bg-primary-container/40"
                    : isToday
                      ? "border-primary/30 bg-primary-container/20"
                      : inMonth
                        ? "border-outline-variant bg-surface-container-low"
                        : "border-outline-variant/50 bg-surface"
                }`}
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
                    <PostCard
                      key={post.id}
                      post={post}
                      draggable
                      showHook={false}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                  {overflow > 0 && (
                    <span className="px-1 text-[10px] text-on-surface-variant">
                      + {overflow} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
