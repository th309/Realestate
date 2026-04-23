#!/usr/bin/env node
// One-shot: verify the gate-warned escalator logic against live staging.
// Seeds a run at rendering_video with approval_mode='auto', inserts a
// content_run_gates row with result='warned', then re-runs the exact
// query RunOrchestratorService.resolveEffectiveApprovalMode uses and
// replays the decision. Expected: escalator flips effective mode to
// 'review', so next state is ready_for_review (not publishing).
//
// Run: node scripts/verify-warned-escalator.mjs
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';

config({ path: 'packages/backend/.env.local' });

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

// Mirrors pipeline-state.ts:nextStateOnSuccess for rendering_video.
function nextFromRenderingVideo(effectiveMode) {
  return effectiveMode === 'review' ? 'ready_for_review' : 'publishing';
}

// Mirrors RunOrchestratorService.resolveEffectiveApprovalMode.
async function resolveEffective(runId, currentStatus, approvalMode) {
  if (currentStatus !== 'rendering_video') return approvalMode;
  if (approvalMode === 'review') return approvalMode;
  const { data } = await client
    .from('content_run_gates')
    .select('gate')
    .eq('run_id', runId)
    .eq('result', 'warned')
    .limit(1);
  return data && data.length > 0 ? 'review' : approvalMode;
}

let failed = false;
const createdRunIds = [];

async function seedRun(approvalMode) {
  const { data, error } = await client
    .from('content_runs')
    .insert({
      format: 'grade_reveal',
      audience: 'mixed',
      market_query: 'Warned Escalator Harness, XX',
      approval_mode: approvalMode,
      tts_provider: 'edge',
      tts_voice_id: 'edge-andrew',
      selected_platforms: [],
      idempotency_key: `warned-${approvalMode}-${randomUUID()}`,
      status: 'rendering_video',
      triggered_by: 'verify-warned-escalator',
    })
    .select('id')
    .single();
  if (error) throw error;
  createdRunIds.push(data.id);
  return data.id;
}

async function assertCase(label, approvalMode, gateResult, expectedNext) {
  const runId = await seedRun(approvalMode);
  if (gateResult) {
    await client.from('content_run_gates').insert({
      run_id: runId,
      gate: 'brand_voice_linter',
      result: gateResult,
      details: { harness: true },
    });
  }
  const effective = await resolveEffective(runId, 'rendering_video', approvalMode);
  const next = nextFromRenderingVideo(effective);
  const ok = next === expectedNext;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${label}: approval_mode=${approvalMode} gate=${gateResult ?? 'none'} -> effective=${effective} next=${next} (expected ${expectedNext})`,
  );
  if (!ok) failed = true;
}

try {
  await assertCase('auto + warned => escalates to review',      'auto',   'warned', 'ready_for_review');
  await assertCase('draft + warned => escalates to review',     'draft',  'warned', 'ready_for_review');
  await assertCase('review + warned => stays review',           'review', 'warned', 'ready_for_review');
  await assertCase('auto + passed => stays auto',               'auto',   'passed', 'publishing');
  await assertCase('draft + passed => stays draft (publish)',   'draft',  'passed', 'publishing');
  await assertCase('auto + no gates => stays auto',             'auto',   null,     'publishing');
} finally {
  if (createdRunIds.length) {
    await client.from('content_run_gates').delete().in('run_id', createdRunIds);
    await client.from('content_runs').delete().in('id', createdRunIds);
    console.log(`cleaned up ${createdRunIds.length} runs + gates`);
  }
}

process.exit(failed ? 1 : 0);
