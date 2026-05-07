-- Multiple skyline variants per metro (operator picks in admin wizard).
ALTER TABLE metro_hero_images
  ADD COLUMN IF NOT EXISTS option_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE metro_hero_images DROP CONSTRAINT IF EXISTS metro_hero_images_pkey;

ALTER TABLE metro_hero_images
  ADD PRIMARY KEY (cbsa_code, option_id);
