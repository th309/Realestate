import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly email: EmailService,
  ) {}

  /** Get or lazy-create a unique referral code for this user. */
  async getOrCreateCode(userId: string): Promise<{ code: string; url: string }> {
    const client = this.supabase.getClient();

    const { data: existing } = await client
      .from('referral_codes')
      .select('code')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return { code: existing.code, url: this.buildUrl(existing.code) };
    }

    // Generate an 8-char lowercase alphanumeric code, retry on collision
    let code: string;
    let attempts = 0;
    while (true) {
      if (attempts++ > 5) throw new Error('Failed to generate unique referral code');
      code = randomBytes(6).toString('base64url').slice(0, 8).toLowerCase();

      const { error } = await client
        .from('referral_codes')
        .insert({ user_id: userId, code });

      if (!error) break;
      if (!error.message.includes('unique')) throw error;
    }

    return { code: code!, url: this.buildUrl(code!) };
  }

  /** Stats for the referral dashboard. */
  async getStats(userId: string): Promise<{
    signedUp: number;
    converted: number;
    creditsEarned: number;
  }> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('referral_events')
      .select('state')
      .eq('referrer_id', userId);

    if (error) {
      this.logger.error(`Failed to fetch referral stats: ${error.message}`);
      return { signedUp: 0, converted: 0, creditsEarned: 0 };
    }

    const signedUp = data?.length ?? 0;
    const converted = data?.filter((e) => e.state === 'converted').length ?? 0;

    return { signedUp, converted, creditsEarned: converted };
  }

  /**
   * Called after a new user signs up.
   * Links their account to the referrer via the stored code.
   */
  async applyReferralCode(
    newUserId: string,
    code: string,
  ): Promise<{ applied: boolean }> {
    const client = this.supabase.getClient();

    // Validate code exists
    const { data: codeRow } = await client
      .from('referral_codes')
      .select('user_id')
      .eq('code', code)
      .maybeSingle();

    if (!codeRow) {
      throw new BadRequestException('Invalid referral code');
    }

    // Self-referral guard
    if (codeRow.user_id === newUserId) {
      throw new BadRequestException('You cannot use your own referral code');
    }

    // Idempotency: check if this referred user already has an event
    const { data: existing } = await client
      .from('referral_events')
      .select('id')
      .eq('referred_id', newUserId)
      .maybeSingle();

    if (existing) {
      return { applied: false };
    }

    const { error } = await client.from('referral_events').insert({
      referrer_id: codeRow.user_id,
      referred_id: newUserId,
      code,
      state: 'signed_up',
    });

    if (error) {
      if (error.message.includes('unique') || error.message.includes('conflict')) {
        return { applied: false };
      }
      throw error;
    }

    // Fire-and-forget: notify the referrer
    this.sendSignupNotification(codeRow.user_id).catch((err) =>
      this.logger.warn(`Referrer signup email failed: ${err.message}`),
    );

    return { applied: true };
  }

  /** Notify the referrer that their friend signed up. */
  private async sendSignupNotification(referrerId: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('email')
      .eq('id', referrerId)
      .maybeSingle();

    if (!profile?.email) return;

    await this.email.sendEmail({
      to: profile.email,
      subject: 'Your friend just signed up for PropertyIQ!',
      html: `
        <p>Great news — someone you referred just created a PropertyIQ account.</p>
        <p>When they become a paying Pro subscriber, you'll automatically earn one free month of Pro.</p>
        <p>Keep sharing your link to earn more!</p>
        <p>— The PropertyIQ Team</p>
      `,
      emailType: 'referral_signup_notification',
      userId: referrerId,
    });
  }

  private buildUrl(code: string): string {
    return `https://propertyiq.app/r/${code}`;
  }
}
