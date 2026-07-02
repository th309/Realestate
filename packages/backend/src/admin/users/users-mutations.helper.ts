import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { RedisService } from '../../redis/redis.service';

export async function createAdminUser(
  client: SupabaseClient,
  logger: Logger,
  params: {
    email: string;
    password: string;
    fullName?: string;
    tier?: string;
  },
): Promise<{ id: string; email: string }> {
  // Create auth user via Supabase Admin API
  const { data: authData, error: authError } =
    await client.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: {
        full_name: params.fullName,
      },
    });

  if (authError) {
    logger.error('Failed to create auth user', authError);
    throw new Error(authError.message);
  }

  const userId = authData.user.id;

  // Create user_profiles row
  const { error: profileError } = await client.from('user_profiles').insert({
    id: userId,
    email: params.email,
    full_name: params.fullName || null,
    subscription_tier: params.tier || 'free',
    subscription_status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    logger.error('Failed to create user_profiles row', profileError);
    // Auth user was created but profile failed — clean up
    await client.auth.admin.deleteUser(userId);
    throw new Error(profileError.message);
  }

  logger.log(
    `Admin created user ${userId} (${params.email}) with tier ${params.tier || 'free'}`,
  );

  return { id: userId, email: params.email };
}

export async function applyUserTierUpdate(
  client: SupabaseClient,
  redis: RedisService,
  logger: Logger,
  userId: string,
  tier: string,
): Promise<void> {
  // Must set subscription_status alongside subscription_tier —
  // the entitlements service requires status === 'active' (or null)
  // to recognize a non-free tier. Without this, admin tier changes
  // are silently ignored by the entitlements check.
  const updatePayload: Record<string, unknown> = {
    subscription_tier: tier,
    updated_at: new Date().toISOString(),
  };

  if (tier !== 'free') {
    updatePayload.subscription_status = 'active';
  }

  // Enterprise grace period: give 30 days to set up billing
  if (tier === 'enterprise') {
    const graceExpiry = new Date();
    graceExpiry.setDate(graceExpiry.getDate() + 30);
    updatePayload.enterprise_grace_expires_at = graceExpiry.toISOString();
  }

  // Downgrading FROM enterprise: clear grace period
  if (tier !== 'enterprise') {
    updatePayload.enterprise_grace_expires_at = null;
  }

  // Fetch the old tier before updating (for broadcast payload)
  const { data: oldProfile } = await client
    .from('user_profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  const oldTier = oldProfile?.subscription_tier ?? 'free';

  await client.from('user_profiles').update(updatePayload).eq('id', userId);

  // Invalidate ALL entitlements cache so the user gets fresh access on next request.
  // Cache is keyed by tier, so we must clear both old and new tier entries.
  await redis.deleteByPrefix('entitlements:tier:');

  // Broadcast tier change via Supabase Realtime so the frontend
  // picks it up instantly (useRealtimeTierSync listens on this channel).
  try {
    const channel = client.channel(`user:${userId}:profile`, {
      config: { private: true },
    });
    await channel.send({
      type: 'broadcast',
      event: 'UPDATE',
      payload: {
        record: { subscription_tier: tier },
        old_record: { subscription_tier: oldTier },
      },
    });
    client.removeChannel(channel);
  } catch (err) {
    logger.warn(`Failed to broadcast tier change for ${userId}: ${err}`);
    // Non-fatal — user will see the change on next page load
  }

  logger.log(
    `Updated user ${userId} tier to ${tier} (status: ${tier !== 'free' ? 'active' : 'unchanged'})`,
  );
}
