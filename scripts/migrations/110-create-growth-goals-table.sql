-- Growth goals configuration table
-- Stores the target user count, deadline, and milestones for the AI marketing insights engine
CREATE TABLE IF NOT EXISTS growth_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL DEFAULT 'primary',
  target_paid_users INTEGER NOT NULL,
  target_date TIMESTAMPTZ NOT NULL,
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure only one active goal at a time
CREATE UNIQUE INDEX idx_growth_goals_active ON growth_goals (is_active) WHERE is_active = true;

-- Seed the initial goal: 2,000 paid users by Feb 2, 2027
INSERT INTO growth_goals (name, target_paid_users, target_date, milestones, is_active)
VALUES (
  'primary',
  2000,
  '2027-02-02T00:00:00Z',
  '[
    {"target": 10, "label": "First 10"},
    {"target": 25, "label": "Early Adopters"},
    {"target": 100, "label": "Product-Market Fit"},
    {"target": 250, "label": "Growth Phase"},
    {"target": 500, "label": "Scale Phase"},
    {"target": 1000, "label": "Halfway"},
    {"target": 2000, "label": "Goal"}
  ]'::jsonb,
  true
);
