BEGIN;

ALTER TABLE subscription_tiers
  ADD COLUMN IF NOT EXISTS pricing_card_items JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Seed with current pricing card bullets
UPDATE subscription_tiers SET pricing_card_items = '[
  "Interactive market maps",
  "National & state-level data",
  "Historical trends & charts",
  "Preview reports"
]'::jsonb WHERE slug = 'free';

UPDATE subscription_tiers SET pricing_card_items = '[
  "Everything in Free, plus:",
  "Metro, county, and ZIP code data",
  "PropertyIQ composite scores",
  "AI market analysis",
  "Unlimited AI reports",
  "CSV data export",
  "ChatGPT & Claude integration"
]'::jsonb WHERE slug = 'pro';

UPDATE subscription_tiers SET pricing_card_items = '[
  "Everything in Pro, plus:",
  "Embeddable objects",
  "Widgets",
  "Team & brokerage features",
  "Priority support"
]'::jsonb WHERE slug = 'enterprise';

COMMIT;
