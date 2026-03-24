-- Populate Stripe product and price IDs for subscription tiers
-- Created: 2026-03-24
-- These IDs were created in Stripe live mode via MCP

-- Pro tier
UPDATE subscription_tiers SET
  stripe_product_id = 'prod_UD2wC2X8UJneCX',
  stripe_price_monthly_id = 'price_1TEcqXB2GUHgF91GyX5HkSSK',
  stripe_price_yearly_id = 'price_1TEcqXB2GUHgF91G96qxn1fV',
  updated_at = NOW()
WHERE slug = 'pro';

-- Enterprise tier
UPDATE subscription_tiers SET
  stripe_product_id = 'prod_UD2w83NkNp3CHl',
  stripe_price_monthly_id = 'price_1TEcqYB2GUHgF91Gslhko6yM',
  stripe_price_yearly_id = 'price_1TEcqZB2GUHgF91GVzJ3a8Gc',
  updated_at = NOW()
WHERE slug = 'enterprise';

-- Verify
SELECT slug, stripe_product_id, stripe_price_monthly_id, stripe_price_yearly_id
FROM subscription_tiers
WHERE slug IN ('pro', 'enterprise');
