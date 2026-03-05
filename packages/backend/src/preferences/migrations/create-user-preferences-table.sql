-- Migration: Create user_preferences table
-- Purpose: Stores user quiz answers and computed archetype for personalized recommendations.
-- Each user has at most one preferences row (enforced by UNIQUE constraint on user_id).
-- RLS ensures users can only read/write their own preferences.

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal TEXT CHECK (goal IN ('first_time_buyer', 'relocating', 'investor_rental', 'investor_flip', 'exploring')),
  priorities TEXT[] DEFAULT '{}',
  budget_min INTEGER,
  budget_max INTEGER,
  location_preferences TEXT[] DEFAULT '{}',
  timeline TEXT CHECK (timeline IN ('under_6_months', '6_to_12_months', '1_to_2_years', 'researching')),
  archetype_id TEXT,
  quiz_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_archetype ON user_preferences(archetype_id);

-- Row Level Security: users can only manage their own preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);
