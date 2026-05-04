import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

@Injectable()
export class SupabaseService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabaseClient: SupabaseClient,
  ) {}

  getClient(): SupabaseClient {
    return this.supabaseClient;
  }

  /**
   * Convenience passthrough to `supabaseClient.from(table)`. Lets services
   * call `this.supabase.from('mytable').select(...)` without going through
   * `getClient()` first. Forwards to the same client; identical semantics.
   */
  from(table: string): ReturnType<SupabaseClient['from']> {
    return this.supabaseClient.from(table);
  }
}
