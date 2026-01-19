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
}
