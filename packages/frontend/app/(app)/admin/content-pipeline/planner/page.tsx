"use client";
/**
 * Planner — a week/month calendar of scheduled posts in Eastern Time. Scheduled
 * posts sit on their day; approved posts wait in a tray until dragged onto a
 * day (which schedules them at a best-time slot). Rescheduling drags a post to
 * another day, preserving its time-of-day, and calls the posts status API.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { fetchPosts, reschedulePost, type PlannerPost } from "../lib/posts-api";
import {
  etDayKey,
  etTimeParts,
  etWallClockToUtcIso,
  etTodayKey,
  addDaysToKey,
  addMonthsToKey,
} from "./planner-tz";
import { bestTimeForDay } from "./best-times";
import { PlannerHeader, type PlannerView } from "./PlannerHeader";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { UnscheduledTray } from "./UnscheduledTray";

const SCHEDULED_KEY = ["cp-posts", "scheduled"] as const;
const APPROVED_KEY = ["cp-posts", "approved"] as const;

export default function PlannerPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<PlannerView>("week");
  const [anchorKey, setAnchorKey] = useState<string>(() => etTodayKey());
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const scheduledQuery = useQuery({
    queryKey: SCHEDULED_KEY,
    queryFn: () => fetchPosts({ status: "scheduled", limit: 500 }),
    refetchInterval: 60_000,
  });
  const approvedQuery = useQuery({
    queryKey: APPROVED_KEY,
    queryFn: () => fetchPosts({ status: "approved", limit: 500 }),
  });

  const scheduledPosts = useMemo(
    () => scheduledQuery.data?.posts ?? [],
    [scheduledQuery.data],
  );
  const unscheduledPosts = useMemo(
    () => (approvedQuery.data?.posts ?? []).filter((p) => !p.scheduled_at),
    [approvedQuery.data],
  );

  // Scheduled posts grouped by ET day, each day sorted by time.
  const postsByDay = useMemo(() => {
    const map = new Map<string, PlannerPost[]>();
    for (const post of scheduledPosts) {
      if (!post.scheduled_at) continue;
      const key = etDayKey(post.scheduled_at);
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""),
      );
    }
    return map;
  }, [scheduledPosts]);

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, iso }: { id: string; iso: string }) =>
      reschedulePost(id, iso),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SCHEDULED_KEY });
      qc.invalidateQueries({ queryKey: APPROVED_KEY });
    },
  });

  function handleDropOnDay(dayKey: string, postId: string) {
    const post =
      scheduledPosts.find((p) => p.id === postId) ??
      unscheduledPosts.find((p) => p.id === postId);
    if (!post) return;

    let hour: number;
    let minute: number;
    if (post.scheduled_at) {
      // Reschedule: keep the same time-of-day, change the day.
      ({ hour, minute } = etTimeParts(post.scheduled_at));
    } else {
      // Schedule from the tray: pick a best-time slot for that day.
      const occupied = (postsByDay.get(dayKey) ?? []).map((p) => {
        const t = etTimeParts(p.scheduled_at as string);
        return t.hour * 60 + t.minute;
      });
      ({ hour, minute } = bestTimeForDay(occupied));
    }
    rescheduleMutation.mutate({
      id: postId,
      iso: etWallClockToUtcIso(dayKey, hour, minute),
    });
  }

  const step = (dir: 1 | -1) =>
    setAnchorKey((key) =>
      view === "week" ? addDaysToKey(key, dir * 7) : addMonthsToKey(key, dir),
    );

  const isLoading = scheduledQuery.isLoading || approvedQuery.isLoading;
  const isError = scheduledQuery.isError || approvedQuery.isError;
  const isEmpty =
    !isLoading &&
    !isError &&
    scheduledPosts.length === 0 &&
    unscheduledPosts.length === 0;

  const todayKey = etTodayKey();

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto max-w-6xl space-y-6 p-8">
        <PlannerHeader
          view={view}
          anchorKey={anchorKey}
          onViewChange={setView}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onToday={() => setAnchorKey(etTodayKey())}
        />

        {isError && (
          <div
            role="alert"
            className="rounded-xl border border-error/40 bg-error-container/40 px-5 py-4 text-sm text-on-surface"
          >
            Couldn&apos;t load the planner. Refresh to retry.
          </div>
        )}

        {rescheduleMutation.isError && (
          <div
            role="alert"
            className="rounded-xl border border-error/40 bg-error-container/40 px-5 py-3 text-sm text-on-surface"
          >
            Couldn&apos;t reschedule that post. It stayed where it was — try
            again.
          </div>
        )}

        {isLoading ? (
          <div className="h-96 animate-pulse rounded-xl bg-surface-container-low" />
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <>
            <UnscheduledTray
              posts={unscheduledPosts}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
            />
            {view === "week" ? (
              <WeekView
                anchorKey={anchorKey}
                todayKey={todayKey}
                postsByDay={postsByDay}
                draggingId={draggingId}
                onDropOnDay={handleDropOnDay}
                onDragStart={setDraggingId}
                onDragEnd={() => setDraggingId(null)}
              />
            ) : (
              <MonthView
                anchorKey={anchorKey}
                todayKey={todayKey}
                postsByDay={postsByDay}
                draggingId={draggingId}
                onDropOnDay={handleDropOnDay}
                onDragStart={setDraggingId}
                onDragEnd={() => setDraggingId(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-10 text-center">
      <h2 className="text-lg font-medium text-on-surface">
        Nothing scheduled yet
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">
        Approve posts in the review feed and they&apos;ll show up here, ready to
        drop onto a day.
      </p>
      <Link
        href="/admin/content-pipeline/review"
        className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Go to review feed
      </Link>
    </div>
  );
}
