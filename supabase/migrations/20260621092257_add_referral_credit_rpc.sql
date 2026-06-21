-- Atomic increment for referral_credit_months_remaining.
-- Called by ReferralCreditService when crediting free-tier referrers.

CREATE OR REPLACE FUNCTION increment_referral_credit(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_profiles
  SET referral_credit_months_remaining = referral_credit_months_remaining + 1
  WHERE id = target_user_id;
END;
$$;

-- Only the service role (backend) should call this
REVOKE ALL ON FUNCTION increment_referral_credit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_referral_credit(uuid) TO service_role;
