// packages/backend/src/content-pipeline/scheduling/weekly-schedule-plan.types.ts
//
// The operator-editable weekly posting plan: which weekdays and ET times each
// post type is allowed to go out on. Stored per brand (see
// weekly-schedule-plan.service.ts), NOT hardcoded — DEFAULT_WEEKLY_SCHEDULE_PLAN
// below is only the seed a brand starts from and can be edited away entirely.

/** One allowed posting window: a weekday plus an ET wall-clock time. */
export interface PlanSlot {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** ET hour, 0-23. */
  hour: number;
  /** ET minute, 0-59. */
  minute: number;
}

/** The slots one post type is allowed to occupy. */
export interface PostTypeSlotRule {
  postType: string;
  slots: PlanSlot[];
}

/**
 * A brand's whole auto-scheduling plan. `enabled` is the kill switch: false
 * means approved posts stay approved-and-unscheduled for manual placement, with
 * no code change needed to get there.
 */
export interface WeeklySchedulePlan {
  enabled: boolean;
  /** Per-type preferred windows — step 1 of the ladder. */
  rules: PostTypeSlotRule[];
  /**
   * Windows any post type may use once its own slots are full — step 2 of the
   * ladder. Mirrors the planner's BEST_TIME_SLOTS_ET grid so auto-placed and
   * hand-dragged posts sit on the same times.
   */
  fallbackSlots: PlanSlot[];
  /** Hard cap on posts sharing one ET calendar day, across all types. */
  maxPerDay: number;
  /** Minimum spacing between two posts on the same ET day. */
  minGapMinutes: number;
  /** A slot must be at least this far out, so approval never insta-publishes. */
  minLeadMinutes: number;
  /** How many weeks ahead the ladder may roll before giving up. */
  horizonWeeks: number;
}

/**
 * Post types that must never be auto-scheduled. `video_script` posts are
 * creative SUGGESTIONS that become video runs — they render no image and the
 * publisher fails them on sight (platform 'youtube'). The planner excludes them
 * the same way (`isSchedulable` in planner/page.tsx); scheduling one would
 * manufacture a guaranteed publish failure.
 */
export const NON_SCHEDULABLE_POST_TYPES: ReadonlySet<string> = new Set([
  'video_script',
]);

/** Preferred posting windows, matching the planner's BEST_TIME_SLOTS_ET. */
const BEST_TIME_HHMM: ReadonlyArray<[number, number]> = [
  [9, 0],
  [12, 0],
  [17, 0],
  [19, 30],
];

/** The best-time grid across Monday–Friday, in chronological order. */
function weekdayBestTimeGrid(): PlanSlot[] {
  const slots: PlanSlot[] = [];
  for (let weekday = 1; weekday <= 5; weekday++) {
    for (const [hour, minute] of BEST_TIME_HHMM) {
      slots.push({ weekday, hour, minute });
    }
  }
  return slots;
}

/**
 * The plan a brand is seeded with, so auto-scheduling works the moment it is
 * switched on. Weekday mornings for LinkedIn (B2B reach), midday for carousels,
 * late afternoon plus a Saturday morning for Facebook. Operators edit this
 * freely through the admin endpoints; nothing here is load-bearing.
 */
export const DEFAULT_WEEKLY_SCHEDULE_PLAN: WeeklySchedulePlan = {
  enabled: true,
  rules: [
    {
      postType: 'linkedin_post',
      slots: [
        { weekday: 1, hour: 9, minute: 0 },
        { weekday: 3, hour: 9, minute: 0 },
        { weekday: 5, hour: 9, minute: 0 },
      ],
    },
    {
      postType: 'carousel_copy',
      slots: [
        { weekday: 2, hour: 12, minute: 0 },
        { weekday: 4, hour: 12, minute: 0 },
      ],
    },
    {
      postType: 'facebook_post',
      slots: [
        { weekday: 2, hour: 17, minute: 0 },
        { weekday: 4, hour: 17, minute: 0 },
        { weekday: 6, hour: 9, minute: 0 },
      ],
    },
  ],
  fallbackSlots: weekdayBestTimeGrid(),
  maxPerDay: 3,
  minGapMinutes: 45,
  minLeadMinutes: 15,
  horizonWeeks: 8,
};
