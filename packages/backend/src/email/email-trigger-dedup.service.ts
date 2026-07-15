import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

/**
 * Dedup ledger for behavioral-trigger emails, backed by `email_triggers`
 * (FK'd to auth.users). A failed markFired() write means hasFired() keeps
 * returning false, so the same user gets re-emailed on every future cron
 * run until they age out of the eligibility window — callers must not
 * swallow markFired's error silently.
 */
@Injectable()
export class EmailTriggerDedupService {
  private readonly logger = new Logger(EmailTriggerDedupService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async hasFired(userId: string, triggerName: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('email_triggers')
      .select('id')
      .eq('user_id', userId)
      .eq('trigger_name', triggerName)
      .maybeSingle();
    if (error) {
      // Fail open (treat as not-fired) so a transient read error doesn't
      // block a legitimate send, but log it — a persistently failing read
      // would otherwise look identical to "never fired" and mask itself.
      this.logger.error(
        `hasFired failed for user ${userId} / ${triggerName}: ${error.message}`,
      );
    }
    return !!data;
  }

  async markFired(userId: string, triggerName: string): Promise<void> {
    const { error } = await this.supabase
      .from('email_triggers')
      .insert({ user_id: userId, trigger_name: triggerName, metadata: {} });
    if (error) {
      this.logger.error(
        `markFired failed for user ${userId} / ${triggerName}: ${error.message}`,
      );
    }
  }
}
