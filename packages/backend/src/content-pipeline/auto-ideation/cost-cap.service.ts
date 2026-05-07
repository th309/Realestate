import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { DriverCost } from '../drivers/driver-cost.types';

const DEFAULT_DAILY_USD_MAX = 50;
const DEFAULT_FORMAT_CAP = 10;

@Injectable()
export class CostCapService {
  constructor(private readonly supabase: SupabaseService) {}

  async canEnqueue(estimatedUsd: number): Promise<{
    allowed: boolean;
    remainingUsd: number;
    usdSpent: number;
    usdCap: number;
  }> {
    const client = this.supabase.getClient();
    const today = new Date().toISOString().slice(0, 10);
    const envCap = Number(process.env.CONTENT_PIPELINE_DAILY_USD_MAX);
    const cap = Number.isFinite(envCap) ? envCap : DEFAULT_DAILY_USD_MAX;

    const { data, error } = await client
      .from('cost_cap_daily')
      .select('usd_spent, usd_cap')
      .eq('date', today)
      .maybeSingle();
    if (error) throw error;

    const usdSpent = Number(data?.usd_spent ?? 0);
    const usdCap = Number(data?.usd_cap ?? cap);
    const remaining = Math.max(0, usdCap - usdSpent);

    return {
      allowed: estimatedUsd <= remaining,
      remainingUsd: remaining,
      usdSpent,
      usdCap,
    };
  }

  async canEnqueueFormat(
    format: string,
  ): Promise<{ allowed: boolean; count: number; cap: number }> {
    const client = this.supabase.getClient();
    const today = new Date().toISOString().slice(0, 10);
    const envKey = `CONTENT_PIPELINE_FORMAT_DAILY_CAP_${format.toUpperCase()}`;
    const envCap = Number(process.env[envKey]);
    const cap = Number.isFinite(envCap) ? Math.floor(envCap) : DEFAULT_FORMAT_CAP;

    const { data, error } = await client
      .from('format_daily_run_counts')
      .select('run_count')
      .eq('format', format)
      .eq('date', today)
      .maybeSingle();
    if (error) throw error;
    const count = Number(data?.run_count ?? 0);
    return { allowed: count < cap, count, cap };
  }

  async recordSpend(costs: DriverCost[]): Promise<void> {
    const client = this.supabase.getClient();
    const today = new Date().toISOString().slice(0, 10);
    const usd = (costs ?? []).reduce((s, c) => s + Number(c.amount_usd ?? 0), 0);

    const envCap = Number(process.env.CONTENT_PIPELINE_DAILY_USD_MAX);
    const cap = Number.isFinite(envCap) ? envCap : DEFAULT_DAILY_USD_MAX;

    const { data: existing, error: existingError } = await client
      .from('cost_cap_daily')
      .select('usd_spent, usd_cap')
      .eq('date', today)
      .maybeSingle();
    if (existingError) throw existingError;

    const nextSpent = Number(existing?.usd_spent ?? 0) + usd;
    const usdCap = Number(existing?.usd_cap ?? cap);

    const { error } = await client.from('cost_cap_daily').upsert({
      date: today,
      usd_spent: nextSpent,
      usd_cap: usdCap,
      breach_at: nextSpent >= usdCap ? new Date().toISOString() : null,
    });
    if (error) throw error;
  }

  async incrementFormatCount(format: string): Promise<void> {
    const client = this.supabase.getClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error: readErr } = await client
      .from('format_daily_run_counts')
      .select('run_count')
      .eq('format', format)
      .eq('date', today)
      .maybeSingle();
    if (readErr) throw readErr;

    const { error } = await client.from('format_daily_run_counts').upsert({
      format,
      date: today,
      run_count: Number(data?.run_count ?? 0) + 1,
    });
    if (error) throw error;
  }
}

