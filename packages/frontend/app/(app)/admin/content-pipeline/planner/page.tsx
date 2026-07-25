"use client";
/**
 * Planner — a week/month calendar of scheduled posts in Eastern Time. Scheduled
 * posts sit on their day; approved posts wait in a tray until dragged (or
 * clock-picked) onto a day. Drag-and-drop runs on @dnd-kit (pointer + keyboard
 * sensors, drag overlay); every post also has an inline reschedule control so
 * there's a pointer-free path. Rescheduling preserves time-of-day on day moves
 * and uses a best-time slot when scheduling from the tray.
 */
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { fetchPosts, type PlannerPost } from "../lib/posts-api";
import {
  useReschedulePost,
  POSTS_SCHEDULED_KEY,
  POSTS_APPROVED_KEY,
} from "../lib/use-post-mutations";
import { useToast } from "../lib/toast";
import {
  etDayKey,
  etTimeParts,
  etWallClockToUtcIso,
  etTodayKey,
  addDaysToKey,
  addMonthsToKey,
  weekKeys,
  monthGridKeys,
} from "./planner-tz";
import { bestTimeForDay } from "./best-times";
import { PlannerHeader, type PlannerView } from "./PlannerHeader";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { UnscheduledTray } from "./UnscheduledTray";
import { PostCard } from "./PostCard";

export default function PlannerPage() {
  const toast = useToast();
  const [view, setView] = useState<PlannerView>("week");
  const [anchorKey, setAnchorKey] = useState<string>(() => etTodayKey());
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  // Visible calendar window → sent to the server (harmlessly ignored until the
  // range filter lands) and used as the scheduled query key so nav refetches.
  const rangeKeys =
    view === "week" ? weekKeys(anchorKey) : monthGridKeys(anchorKey);
  const rangeStart = rangeKeys[0];
  const rangeEnd = rangeKeys[rangeKeys.length - 1];
  const scheduledFrom = etWallClockToUtcIso(rangeStart, 0, 0);
  const scheduledTo = etWallClockToUtcIso(addDaysToKey(rangeEnd, 1), 0, 0);

  const scheduledQuery = useQuery({
    queryKey: [...POSTS_SCHEDULED_KEY, rangeStart, rangeEnd],
    queryFn: () =>
      fetchPosts({
        status: "scheduled",
        limit: 500,
        scheduledFrom,
        scheduledTo,
        orderBy: "scheduled_at",
      }),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });
  const approvedQuery = useQuery({
    queryKey: POSTS_APPROVED_KEY,
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

  const rescheduleMutation = useReschedulePost();

  const reschedule = useCallback(
    (post: PlannerPost, iso: string) =>
      rescheduleMutation.mutate({ id: post.id, iso }),
    [rescheduleMutation],
  );

  // Place a post on a day: keep its time-of-day when it already has one, else
  // pick a best-time slot. A full day yields no slot → tell the operator.
  const dropOnDay = useCallback(
    (dayKey: string, post: PlannerPost) => {
      let hour: number;
      let minute: number;
      if (post.scheduled_at) {
        ({ hour, minute } = etTimeParts(post.scheduled_at));
      } else {
        const occupied = (postsByDay.get(dayKey) ?? []).map((p) => {
          const t = etTimeParts(p.scheduled_at as string);
          return t.hour * 60 + t.minute;
        });
        const slot = bestTimeForDay(occupied);
        if (!slot) {
          toast.error(
            "That day is full — pick a time manually or another day.",
          );
          return;
        }
        ({ hour, minute } = slot);
      }
      reschedule(post, etWallClockToUtcIso(dayKey, hour, minute));
    },
    [postsByDay, reschedule, toast],
  );

  const findPost = useCallback(
    (id: string) =>
      scheduledPosts.find((p) => p.id === id) ??
      unscheduledPosts.find((p) => p.id === id),
    [scheduledPosts, unscheduledPosts],
  );

  const handleDragStart = useCallback(
    (e: DragStartEvent) => setActiveId(String(e.active.id)),
    [],
  );
  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      if (!e.over) return;
      const post = findPost(String(e.active.id));
      if (post) dropOnDay(String(e.over.id), post);
    },
    [findPost, dropOnDay],
  );

  const openDayInWeek = useCallback((dayKey: string) => {
    setView("week");
    setAnchorKey(dayKey);
  }, []);

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
  const activePost = activeId ? findPost(activeId) : undefined;

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

        {isLoading ? (
          <div className="h-96 animate-pulse rounded-xl bg-surface-container-low" />
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="space-y-6">
              <UnscheduledTray
                posts={unscheduledPosts}
                onReschedule={reschedule}
              />
              {view === "week" ? (
                <WeekView
                  anchorKey={anchorKey}
                  todayKey={todayKey}
                  postsByDay={postsByDay}
                  onReschedule={reschedule}
                />
              ) : (
                <MonthView
                  anchorKey={anchorKey}
                  todayKey={todayKey}
                  postsByDay={postsByDay}
                  onReschedule={reschedule}
                  onOpenDay={openDayInWeek}
                />
              )}
            </div>

            <DragOverlay>
              {activePost && (
                <div className="w-[200px] rotate-1">
                  <PostCard post={activePost} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
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
