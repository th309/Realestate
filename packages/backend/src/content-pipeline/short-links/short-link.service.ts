import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { Platform } from '../types';

export interface CreateShortLinkArgs {
  runId: string;
  format: string;
  platform: Platform;
  targetUrl: string;
}

export interface ShortLink {
  id: string;
  slug: string;
  run_id: string;
  format: string;
  platform: Platform;
  target_url: string;
  click_count: number;
}

@Injectable()
export class ShortLinkService {
  constructor(private readonly supabase: SupabaseService) {}

  generateSlug(): string {
    return randomBytes(6).toString('base64url').slice(0, 8);
  }

  async create(args: CreateShortLinkArgs): Promise<ShortLink> {
    const client = this.supabase.getClient();
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = this.generateSlug();
      const { data, error } = await client
        .from('short_links')
        .insert({
          slug,
          run_id: args.runId,
          format: args.format,
          platform: args.platform,
          target_url: args.targetUrl,
        })
        .select()
        .single();
      if (!error) return data as ShortLink;
      if ((error as any).code !== '23505') throw error;
    }
    throw new Error('could not generate unique slug after 5 attempts');
  }

  async resolve(slug: string): Promise<ShortLink | null> {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('short_links')
      .select('*')
      .eq('slug', slug)
      .single();
    if (!data) return null;
    await client
      .from('short_links')
      .update({ click_count: data.click_count + 1 })
      .eq('slug', slug);
    return data as ShortLink;
  }
}
