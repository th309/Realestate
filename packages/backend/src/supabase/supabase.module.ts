import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fetch as undiciFetch, Agent } from 'undici';

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

// Create a custom agent with connection handling for Railway
const agent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
  connect: {
    timeout: 30_000,
  },
});

// Custom fetch wrapper using undici
const customFetch = (url: string | URL | Request, init?: RequestInit) => {
  return undiciFetch(url as any, {
    ...init,
    dispatcher: agent,
  } as any);
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SUPABASE_CLIENT,
      useFactory: (configService: ConfigService): SupabaseClient => {
        const supabaseUrl = configService.get<string>('SUPABASE_URL');
        const supabaseKey = configService.get<string>('SUPABASE_SERVICE_KEY');

        console.log('=== Supabase Configuration ===');
        console.log('SUPABASE_URL:', supabaseUrl);
        console.log('SUPABASE_SERVICE_KEY:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'NOT SET');

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
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}