// packages/backend/src/content-pipeline/scheduling/next-slot-resolver.ts
//
// The pure core of the auto-scheduler: given a post type, the brand's weekly
// plan, the posts already on the calendar, and the current instant, pick the
// slot the post should go in.
//
// Pure and deterministic on purpose — `now` is an argument, never read from the
// clock in here, and nothing touches the database. All the ladder logic and
// every hard rule (no double-booking, per-day cap, DST correctness) is
// unit-testable without a Nest context. See next-slot-resolver.spec.ts.

import {
  addDaysToKey,
  etDayKey,
  etMinutesOfDay,
  etWallClockExists,
  etWallClockToUtcIso,
  startOfWeekKey,
} from './eastern-time';
import type {
  PlanSlot,
  WeeklySchedulePlan,
} from './weekly-schedule-plan.types';
import { NON_SCHEDULABLE_POST_TYPES } from './weekly-schedule-plan.types';

/** Which rung of the ladder produced the slot (surfaced for logging/UI). */
export type SlotSource = 'type_slot' | 'fallback_slot';

export interface ResolvedSlot {
  /** UTC instant to store in posts.scheduled_at. */
  scheduledAtIso: string;
  /** ET calendar day the slot lands on. */
  dayKey: string;
  hour: number;
  minute: number;
  source: SlotSource;
  /** 0 = the current week, 1 = next week, and so on. */
  weekOffset: number;
}

export interface ResolveNextSlotInput {
  postType: string;
  plan: WeeklySchedulePlan;
  /**
   * scheduled_at of every post already on the calendar for this brand, as UTC
   * ISO strings. Order does not matter.
   */
  occupiedIso: string[];
  /** The current instant. Passed in so the resolver stays deterministic. */
  now: Date;
}

/** Existing posts collapsed to ET day -> minutes-of-day, for collision checks. */
type DayOccupancy = Map<string, number[]>;

function buildOccupancy(occupiedIso: string[]): DayOccupancy {
  const byDay: DayOccupancy = new Map();
  for (const iso of occupiedIso) {
    const instant = new Date(iso);
    if (Number.isNaN(instant.getTime())) continue;
    const key = etDayKey(instant);
    const mins = byDay.get(key);
    if (mins) mins.push(etMinutesOfDay(instant));
    else byDay.set(key, [etMinutesOfDay(instant)]);
  }
  return byDay;
}

/** Plan slots in chronological order within a Sunday-start week. */
function chronological(slots: PlanSlot[]): PlanSlot[] {
  return [...slots].sort(
    (a, b) => a.weekday - b.weekday || a.hour - b.hour || a.minute - b.minute,
  );
}

/**
 * First slot in `slots` that is free during the week starting `weekStartKey`,
 * or null when every one of them is taken, capped out, past, or unreal.
 */
function firstFreeSlot(
  slots: PlanSlot[],
  weekStartKey: string,
  occupancy: DayOccupancy,
  plan: WeeklySchedulePlan,
  earliestMs: number,
): Omit<ResolvedSlot, 'source' | 'weekOffset'> | null {
  for (const slot of chronological(slots)) {
    const dayKey = addDaysToKey(weekStartKey, slot.weekday);

    // A wall clock inside the spring-forward gap has no real instant. Skip it
    // rather than let it resolve to a different clock time than the plan says.
    if (!etWallClockExists(dayKey, slot.hour, slot.minute)) continue;

    const scheduledAtIso = etWallClockToUtcIso(dayKey, slot.hour, slot.minute);
    if (new Date(scheduledAtIso).getTime() < earliestMs) continue;

    const taken = occupancy.get(dayKey) ?? [];
    if (taken.length >= plan.maxPerDay) continue;

    // Two rules, kept deliberately separate: an EXACT duplicate is always a
    // collision regardless of minGapMinutes (0 is a legitimate "no minimum
    // spacing" configuration and must not also disable duplicate detection —
    // `Math.abs(t - minutes) < 0` is never true, so folding these into one
    // check would silently allow two posts at the identical instant).
    // minGapMinutes is then an ADDITIONAL spacing rule on top of that.
    const minutes = slot.hour * 60 + slot.minute;
    const collides = taken.some(
      (t) => t === minutes || Math.abs(t - minutes) < plan.minGapMinutes,
    );
    if (collides) continue;

    return { scheduledAtIso, dayKey, hour: slot.hour, minute: slot.minute };
  }
  return null;
}

/**
 * Walk the ladder Troy specified and return the slot to use:
 *
 *   1. the post type's own slots in the current week,
 *   2. else the next open fallback (best-time) slot in the current week,
 *   3. else roll into the following week and repeat, up to plan.horizonWeeks.
 *
 * Returns null only when the whole horizon is exhausted — the caller must
 * surface that rather than schedule on top of an occupied slot.
 */
export function resolveNextSlot(
  input: ResolveNextSlotInput,
): ResolvedSlot | null {
  const { plan, postType, occupiedIso, now } = input;

  // Defense in depth: PostAutoSchedulerService already refuses these before
  // calling in, but this is the one place every call path funnels through, so
  // a future caller that skips that check fails loudly here instead of
  // quietly scheduling a post type that can never publish.
  if (NON_SCHEDULABLE_POST_TYPES.has(postType)) {
    throw new Error(
      `resolveNextSlot called for a non-schedulable post type: ${postType}`,
    );
  }

  const occupancy = buildOccupancy(occupiedIso);
  const earliestMs = now.getTime() + plan.minLeadMinutes * 60_000;
  const typeSlots =
    plan.rules.find((rule) => rule.postType === postType)?.slots ?? [];

  // The week containing `now` — but slots earlier than `earliestMs` are skipped
  // inside firstFreeSlot, so the current week only ever contributes future days.
  const currentWeekStart = startOfWeekKey(etDayKey(now));

  for (let weekOffset = 0; weekOffset < plan.horizonWeeks; weekOffset++) {
    const weekStartKey = addDaysToKey(currentWeekStart, weekOffset * 7);

    const ownSlot = firstFreeSlot(
      typeSlots,
      weekStartKey,
      occupancy,
      plan,
      earliestMs,
    );
    if (ownSlot) return { ...ownSlot, source: 'type_slot', weekOffset };

    const fallback = firstFreeSlot(
      plan.fallbackSlots,
      weekStartKey,
      occupancy,
      plan,
      earliestMs,
    );
    if (fallback) return { ...fallback, source: 'fallback_slot', weekOffset };
  }

  return null;
}
