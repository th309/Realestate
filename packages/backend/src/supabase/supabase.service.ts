import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase.module';

@Injectable()
export class SupabaseService {
    constructor(
        @Inject(SUPABASE_CLIENT) private readonly supabaseClient: SupabaseClient,
    ) { }

    getClient(): SupabaseClient {
        return this.supabaseClient;
    }
}
