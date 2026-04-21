import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

interface ParsedAttributionCookie {
  runId: string;
  slug: string;
  platform: string;
  firstTouchAt?: string;
}

/**
 * AttributionService
 *
 * Parses the `__piq_attr` cookie that /go/[slug] sets on first touch,
 * then inserts a row into `signup_attributions` linking the new user to
 * the content run/slug/platform that drove the signup.
 *
 * The cookie is opaque JSON with shape:
 *   { runId, slug, platform, firstTouchAt }
 *
 * Malformed or missing cookies are treated as a no-op so that signup
 * never fails because of a broken attribution cookie.
 */
@Injectable()
export class AttributionService {
  private readonly logger = new Logger(AttributionService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async captureFromCookie(
    userId: string,
    cookieValue: string | null | undefined,
    tierAtSignup: string,
  ): Promise<void> {
    if (!cookieValue) return;

    let parsed: ParsedAttributionCookie;
    try {
      parsed = JSON.parse(cookieValue) as ParsedAttributionCookie;
    } catch {
      return;
    }

    if (!parsed || typeof parsed !== 'object') return;
    if (!parsed.runId || !parsed.slug || !parsed.platform) return;

    const client = this.supabase.getClient();
    const { error } = await client.from('signup_attributions').insert({
      user_id: userId,
      attributed_run_id: parsed.runId,
      attributed_slug: parsed.slug,
      attributed_platform: parsed.platform,
      first_touch_at: parsed.firstTouchAt ?? new Date().toISOString(),
      tier_at_signup: tierAtSignup,
    });

    if (error) {
      this.logger.warn(
        `attribution insert failed for user ${userId}: ${error.message}`,
      );
    }
  }
}
