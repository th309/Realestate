import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CredentialCrypto } from './drivers/credential-crypto';

export interface ActiveCredential {
  refreshToken: string;
  accountLabel: string | null;
  connectedAt: Date;
}

@Injectable()
export class PlatformCredentialsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly crypto: CredentialCrypto,
  ) {}

  async getActive(platform: string): Promise<ActiveCredential | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('platform_credentials')
      .select('refresh_token_enc, account_label, connected_at')
      .eq('platform', platform)
      .is('disconnected_at', null)
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      refreshToken: this.crypto.decrypt(data.refresh_token_enc as string),
      accountLabel: (data.account_label as string | null) ?? null,
      connectedAt: new Date(data.connected_at as string),
    };
  }

  async upsertActive(
    platform: string,
    accountLabel: string,
    refreshToken: string,
  ): Promise<void> {
    const client = this.supabase.getClient();
    const enc = this.crypto.encrypt(refreshToken);

    const { data: existing } = await client
      .from('platform_credentials')
      .select('id')
      .eq('platform', platform)
      .is('disconnected_at', null)
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await client
        .from('platform_credentials')
        .update({
          refresh_token_enc: enc,
          account_label: accountLabel,
          updated_at: new Date().toISOString(),
        })
        .eq('platform', platform)
        .is('disconnected_at', null)
        .select()
        .maybeSingle();
      if (error) throw error;
    } else {
      const { error } = await client
        .from('platform_credentials')
        .insert({
          platform,
          account_label: accountLabel,
          refresh_token_enc: enc,
          disconnected_at: null,
        })
        .select()
        .single();
      if (error) throw error;
    }
  }

  async disconnect(platform: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('platform_credentials')
      .update({
        disconnected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('platform', platform)
      .is('disconnected_at', null)
      .select()
      .maybeSingle();
    if (error) throw error;
  }
}
