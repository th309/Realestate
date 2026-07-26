// Local-only worker for the infographic lane.
//
// NotebookLM infographics are generated through the `nlm` CLI, which uses a
// local Google login. Production cannot run it, so the backend only ever queues
// `infographic` runs (status `queued`) and this script — run on Troy's machine —
// claims them and carries them the rest of the way:
//
//   claim -> nlm infographic create -> poll studio status -> nlm download
//         -> upload PNG to storage -> create draft post -> mark run done
//
// Run:
//   npx ts-node --transpile-only scripts/infographic-worker.ts
//   npx ts-node --transpile-only scripts/infographic-worker.ts --dry-run
//
// --dry-run prints the focus prompt each claimable run would use and exits
// without calling `nlm`, touching storage, or mutating any row.
import 'reflect-metadata';
import { config } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildInfographicFocusPrompt } from '../src/content-pipeline/infographics/infographic-focus-prompt';
import {
  resolveClaimableRun,
  type ClaimableRun,
  type QueuedRunRow,
} from './infographic-worker/resolve-claimable-run';
import { generateInfographicPng } from './infographic-worker/notebooklm-cli';
import { deliverInfographicPost } from './infographic-worker/deliver-infographic-post';

config({ path: ['.env.local', '.env'] });

const DRY_RUN = process.argv.includes('--dry-run');
const MAX_RUNS_PER_PASS = 25;

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

function focusFor(run: ClaimableRun): string {
  return buildInfographicFocusPrompt({
    topic: run.topic,
    task: run.task,
    style: run.style,
  });
}

/**
 * Compare-and-swap: only the worker that moves the row out of `queued` owns it.
 * Returns false when another worker got there first.
 */
async function claim(client: SupabaseClient, runId: string): Promise<boolean> {
  const { data } = await client
    .from('content_runs')
    .update({
      status: 'generating_infographic',
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .eq('status', 'queued')
    .select('id')
    .maybeSingle();
  return Boolean(data);
}

async function markFailed(
  client: SupabaseClient,
  runId: string,
  message: string,
): Promise<void> {
  await client
    .from('content_runs')
    .update({
      status: 'failed',
      status_reason: `infographic: ${message}`.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);
  await client.from('content_run_events').insert({
    run_id: runId,
    event_type: 'infographic_failed',
    payload: { error: message.slice(0, 1000) },
  });
}

async function processRun(
  client: SupabaseClient,
  run: ClaimableRun,
): Promise<void> {
  const workDir = join(tmpdir(), `infographic-${run.id}`);
  mkdirSync(workDir, { recursive: true });
  try {
    const png = await generateInfographicPng({
      notebookId: run.notebookId,
      cliStyle: run.style.cliStyle,
      focus: focusFor(run),
      workDir,
      onProgress: (m) => console.log(`  ${m}`),
    });
    const postId = await deliverInfographicPost(client, run, png);
    await client
      .from('content_runs')
      .update({
        status: 'infographic_ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id);
    await client.from('content_run_events').insert({
      run_id: run.id,
      event_type: 'infographic_ready',
      payload: {
        topic_slug: run.topic.slug,
        task_number: run.task.number,
        style_id: run.style.id,
        post_id: postId,
        bytes: png.length,
      },
    });
    console.log(`  post ${postId} created (pending review)`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing in .env');
  }
  const client = createClient(url, key);

  const { data: rows, error } = await client
    .from('content_runs')
    .select('id, format_options')
    .eq('format', 'infographic')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(MAX_RUNS_PER_PASS);
  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.log('no queued infographic runs');
    return;
  }
  console.log(
    `${rows.length} queued infographic run(s)${DRY_RUN ? ' (dry run)' : ''}`,
  );

  for (const row of rows) {
    let run: ClaimableRun;
    try {
      run = resolveClaimableRun(row as QueuedRunRow);
    } catch (e) {
      console.error(`run ${row.id}: ${(e as Error).message}`);
      if (!DRY_RUN) await markFailed(client, row.id, (e as Error).message);
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `\n--- run ${run.id} | ${run.topic.slug} task ${run.task.number} | style ${run.style.id} ---`,
      );
      console.log(focusFor(run));
      continue;
    }

    if (!(await claim(client, run.id))) {
      console.log(`run ${run.id} already claimed elsewhere — skipping`);
      continue;
    }

    console.log(`run ${run.id}: ${run.topic.slug} task ${run.task.number}`);
    try {
      await processRun(client, run);
    } catch (e) {
      console.error(`  FAILED: ${(e as Error).message}`);
      await markFailed(client, run.id, (e as Error).message);
    }
  }
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
