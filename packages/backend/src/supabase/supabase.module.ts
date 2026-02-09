import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fetch as undiciFetch, Agent } from 'undici';
import { SupabaseService, SUPABASE_CLIENT } from './supabase.service';

// Create a custom agent with connection handling for Railway
const agent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
  connect: {
    timeout: 30_000,
    // Force IPv4 to avoid DNS resolution issues on Railway
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: 2000,
  },
});

// Custom fetch wrapper using undici
const customFetch = (url: string | URL | Request, init?: RequestInit) => {
  return undiciFetch(
    url as any,
    {
      ...init,
      dispatcher: agent,
    } as any,
  );
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SUPABASE_CLIENT,
      useFactory: (configService: ConfigService): SupabaseClient => {
        const supabaseUrl =
          configService.get<string>('SUPABASE_URL') ||
          configService.get<string>('NEXT_PUBLIC_SUPABASE_URL');
        const supabaseKey =
          configService.get<string>('SUPABASE_SERVICE_KEY') ||
          configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

        // Log configuration status without exposing sensitive data
        if (process.env.NODE_ENV !== 'production') {
          console.log('=== Supabase Configuration ===');
          console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET');
          console.log('SUPABASE_SERVICE_KEY:', supabaseKey ? 'SET' : 'NOT SET');
        }

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Missing Supabase configuration');
        }

        return createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
          global: {
            fetch: customFetch as unknown as typeof fetch,
          },
        });
      },
      inject: [ConfigService],
    },
    SupabaseService,
  ],
  exports: [SUPABASE_CLIENT, SupabaseService],
})
export class SupabaseModule {}
