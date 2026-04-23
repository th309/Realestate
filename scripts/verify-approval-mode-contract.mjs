#!/usr/bin/env node
// One-shot: verify content_runs.approval_mode accepts all three operator
// choices (auto | review | draft) and that the row survives round-trip.
// Run: node scripts/verify-approval-mode-contract.mjs
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';

config({ path: 'packages/backend/.env.local' });

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const modes = ['auto', 'review', 'draft'];
const insertedIds = [];
let failed = false;

try {
  for (const mode of modes) {
    const { data, error } = await client
      .from('content_runs')
      .insert({
        format: 'grade_reveal',
        audience: 'mixed',
        market_query: 'Verification Harness, XX',
        approval_mode: mode,
        tts_provider: 'edge',
        tts_voice_id: 'edge-andrew',
        selected_platforms: [],
        idempotency_key: `verify-${mode}-${randomUUID()}`,
        status: 'queued',
        triggered_by: 'verify-approval-mode-contract',
      })
      .select('id, approval_mode')
      .single();

    if (error || !data) {
      console.error(`FAIL mode=${mode}:`, error?.message ?? 'no row returned');
      failed = true;
      continue;
    }
    if (data.approval_mode !== mode) {
      console.error(
        `FAIL mode=${mode}: round-trip mismatch, got ${data.approval_mode}`,
      );
      failed = true;
    } else {
      console.log(`OK   mode=${mode} runId=${data.id}`);
    }
    insertedIds.push(data.id);
  }
} finally {
  if (insertedIds.length) {
    const { error } = await client
      .from('content_runs')
      .delete()
      .in('id', insertedIds);
    if (error) console.error('cleanup error:', error.message);
    else console.log(`cleaned up ${insertedIds.length} rows`);
  }
}

process.exit(failed ? 1 : 0);
