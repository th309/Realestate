-- Content pipeline: per-brand weekly auto-scheduling plan.
--
-- The planner UI and the publish cron both existed, but nothing ever assigned a
-- schedule: an approved post sat unscheduled until an operator dragged it onto a
-- day by hand. This table holds the operator-editable plan the auto-scheduler
-- reads — which weekdays and Eastern-time windows each post type may go out on,
-- plus the pacing limits and the per-brand kill switch.
--
-- One row per brand, created lazily the first time an operator edits the plan.
-- A brand with no row uses DEFAULT_WEEKLY_SCHEDULE_PLAN from
-- packages/backend/src/content-pipeline/scheduling/weekly-schedule-plan.types.ts,
-- which is the single source of truth for the seed — deliberately NOT duplicated
-- into SQL, so the two can never drift.
--
-- `rules` is [{ postType, slots: [{ weekday, hour, minute }] }] and
-- `fallback_slots` is [{ weekday, hour, minute }]; both are validated by
-- UpdateWeeklySchedulePlanDto before they are ever written.
--
-- RLS: admin/service-role only, matching the sibling content-pipeline tables in
-- 20260725171557. Idempotent: IF NOT EXISTS + DROP POLICY IF EXISTS throughout.

CREATE TABLE IF NOT EXISTS content_schedule_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  -- The kill switch: false returns the brand to manual placement, no deploy.
  enabled BOOLEAN NOT NULL DEFAULT true,
  rules JSONB NOT NULL DEFAULT '[]',
  fallback_slots JSONB NOT NULL DEFAULT '[]',
  -- Bounds mirror UpdateWeeklySchedulePlanDto so a direct SQL edit cannot put a
  -- value into the slot math that the API would have rejected.
  max_per_day INT NOT NULL DEFAULT 3
    CHECK (max_per_day BETWEEN 1 AND 24),
  min_gap_minutes INT NOT NULL DEFAULT 45
    CHECK (min_gap_minutes BETWEEN 0 AND 720),
  min_lead_minutes INT NOT NULL DEFAULT 15
    CHECK (min_lead_minutes BETWEEN 0 AND 10080),
  horizon_weeks INT NOT NULL DEFAULT 8
    CHECK (horizon_weeks BETWEEN 1 AND 52),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One plan per brand: the service upserts on brand_id, so two concurrent cold
-- starts must not be able to split a brand's plan across two rows.
CREATE UNIQUE INDEX IF NOT EXISTS content_schedule_plans_brand_id_key
  ON content_schedule_plans (brand_id);

ALTER TABLE content_schedule_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON content_schedule_plans;
CREATE POLICY service_role_all ON content_schedule_plans FOR ALL USING (true);
GRANT ALL ON content_schedule_plans TO service_role;
GRANT ALL ON content_schedule_plans TO authenticated;
