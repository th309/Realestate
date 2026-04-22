-- Migration: insert_activation_funnel
-- Purpose: Canonical 8-step activation funnel for the admin analytics dashboard.
-- Step 2 uses the new any_of multi-event shape (engine extended in Task 0.6).
-- This becomes the default funnel shown on the Conversion tab FullFunnel widget.

INSERT INTO public.funnel_definitions (id, name, steps, is_default, created_at)
VALUES (
  gen_random_uuid(),
  'Activation Funnel',
  '[
    {"event_category": "pageview",    "event_action": "view",                    "label": "Landed on site"},
    {"any_of": [
      {"event_category": "seo",  "event_action": "conversion_bar_clicked"},
      {"event_category": "hero", "event_action": "cta_click"}
    ], "label": "Clicked primary CTA"},
    {"event_category": "conversion",  "event_action": "signup_start",            "label": "Signup started"},
    {"event_category": "conversion",  "event_action": "signup_complete",         "label": "Signup completed"},
    {"event_category": "onboarding",  "event_action": "persona_selected",        "label": "Persona picked"},
    {"event_category": "onboarding",  "event_action": "spotlight_step_completed","label": "Onboarding step completed"},
    {"event_category": "trial",       "event_action": "pro_feature_used",        "label": "Trial engagement"},
    {"event_category": "trial",       "event_action": "converted",               "label": "Converted to paid"}
  ]'::jsonb,
  true,
  now()
);

-- Demote old defaults so Activation Funnel is the one shown by default.
UPDATE public.funnel_definitions
SET is_default = false
WHERE name IN ('Signup Funnel', 'Conversion Funnel');
