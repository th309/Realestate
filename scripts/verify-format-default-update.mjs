#!/usr/bin/env node
// One-shot: verify format_templates.default_approval_mode is updateable
// via the service role client (the same path the new PATCH endpoint uses)
// and that the round-trip returns the updated value.
// Run: node scripts/verify-format-default-update.mjs
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: 'packages/backend/.env.local' });

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const format = 'grade_reveal';

// Read the original value so we can restore it.
const { data: before, error: readErr } = await client
  .from('format_templates')
  .select('default_approval_mode')
  .eq('format', format)
  .single();

if (readErr || !before) {
  console.error('could not read baseline:', readErr?.message);
  process.exit(1);
}
const original = before.default_approval_mode;
console.log(`baseline ${format}.default_approval_mode = ${original}`);

let failed = false;
try {
  for (const candidate of ['auto', 'draft', 'review']) {
    const { data, error } = await client
      .from('format_templates')
      .update({ default_approval_mode: candidate })
      .eq('format', format)
      .select('default_approval_mode')
      .single();
    if (error || !data) {
      console.error(`FAIL update to ${candidate}:`, error?.message);
      failed = true;
      continue;
    }
    if (data.default_approval_mode !== candidate) {
      console.error(
        `FAIL roundtrip: expected ${candidate} got ${data.default_approval_mode}`,
      );
      failed = true;
    } else {
      console.log(`OK   updated to ${candidate}`);
    }
  }
} finally {
  // Always restore, even if a mid-run assertion failed.
  const { error: restoreErr } = await client
    .from('format_templates')
    .update({ default_approval_mode: original })
    .eq('format', format);
  if (restoreErr) console.error('restore error:', restoreErr.message);
  else console.log(`restored ${format}.default_approval_mode = ${original}`);
}

process.exit(failed ? 1 : 0);
