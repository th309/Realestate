import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { SupabaseService } from '../../src/supabase/supabase.service';
import { ContentPipelineService } from '../../src/content-pipeline/content-pipeline.service';
import { FetchDataHandler } from '../../src/content-pipeline/orchestrator/job-handlers/fetch-data.handler';
import { GenerateScriptHandler } from '../../src/content-pipeline/orchestrator/job-handlers/generate-script.handler';
import { VerifyDataHandler } from '../../src/content-pipeline/orchestrator/job-handlers/verify-data.handler';
import { LintVoiceHandler } from '../../src/content-pipeline/orchestrator/job-handlers/lint-voice.handler';
import { SynthesizeAudioHandler } from '../../src/content-pipeline/orchestrator/job-handlers/synthesize-audio.handler';
import { RenderVideoHandler } from '../../src/content-pipeline/orchestrator/job-handlers/render-video.handler';
import { PublishHandler } from '../../src/content-pipeline/orchestrator/job-handlers/publish.handler';
import { RunOrchestratorService } from '../../src/content-pipeline/orchestrator/run-orchestrator.service';

/**
 * Bootstrap the full backend DI graph in standalone mode. We use
 * `createApplicationContext` rather than `createNestApplication` so the
 * HTTP server and its guards stay out of the way — E2E exercises services
 * directly against the real Supabase/Anthropic/pg-boss dependencies.
 *
 * Minting a JWT for `AdminGuard` on every run would be extra ceremony
 * without adding coverage the smoke test + unit tests don't already have;
 * Phase 2 is the right place to add HTTP-layer guard tests when the admin
 * session flow stabilizes.
 */
export async function bootstrapE2EContext(): Promise<E2EContext> {
  // Prevent HandlersBootstrapService from subscribing pg-boss workers
  // in this process — the happy-path spec drives handlers synchronously
  // and would otherwise race its own workers on each handleStepSuccess
  // enqueue. Set before module init so the flag is observed.
  process.env.DISABLE_CONTENT_PIPELINE_WORKERS = 'true';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  return {
    app,
    supabase: app.get(SupabaseService),
    pipeline: app.get(ContentPipelineService),
    orchestrator: app.get(RunOrchestratorService),
    fetchDataHandler: app.get(FetchDataHandler),
    generateScriptHandler: app.get(GenerateScriptHandler),
    verifyDataHandler: app.get(VerifyDataHandler),
    lintVoiceHandler: app.get(LintVoiceHandler),
    synthesizeAudioHandler: app.get(SynthesizeAudioHandler),
    renderVideoHandler: app.get(RenderVideoHandler),
    publishHandler: app.get(PublishHandler),
  };
}

export interface E2EContext {
  app: INestApplicationContext;
  supabase: SupabaseService;
  pipeline: ContentPipelineService;
  orchestrator: RunOrchestratorService;
  fetchDataHandler: FetchDataHandler;
  generateScriptHandler: GenerateScriptHandler;
  verifyDataHandler: VerifyDataHandler;
  lintVoiceHandler: LintVoiceHandler;
  synthesizeAudioHandler: SynthesizeAudioHandler;
  renderVideoHandler: RenderVideoHandler;
  publishHandler: PublishHandler;
}

/**
 * Delete a single run plus its dependent rows. Storage artifacts under
 * `runs/<id>/` are kept: they're tiny (~100KB), inspecting them when a
 * gate fix regresses is useful, and content_assets rows already encode
 * their URLs if we need to GC later.
 */
export async function cleanupRun(
  ctx: E2EContext,
  runId: string,
): Promise<void> {
  const client = ctx.supabase.getClient();
  await Promise.all([
    client.from('content_run_events').delete().eq('run_id', runId),
    client.from('content_run_gates').delete().eq('run_id', runId),
    client.from('content_assets').delete().eq('run_id', runId),
    client.from('platform_posts').delete().eq('run_id', runId),
  ]);
  await client.from('content_runs').delete().eq('id', runId);
}

/**
 * Seed a content_run directly at an arbitrary state so gate tests can
 * exercise just the verifier/linter without burning 30 seconds on
 * scripting. The insert bypasses idempotency and validation; only tests
 * should call this.
 */
export async function seedRun(
  ctx: E2EContext,
  overrides: {
    status: string;
    format?: string;
    marketQuery?: string;
    approvalMode?: 'auto' | 'review' | 'draft';
    idempotencyKey: string;
  },
): Promise<string> {
  const client = ctx.supabase.getClient();
  const { data: template } = await client
    .from('format_templates')
    .select('*')
    .eq('format', overrides.format ?? 'grade_reveal')
    .single();
  if (!template) throw new Error(`format ${overrides.format} not seeded`);

  const { data: inserted, error } = await client
    .from('content_runs')
    .insert({
      format: overrides.format ?? 'grade_reveal',
      audience: template.audience,
      market_query: overrides.marketQuery ?? 'Cleveland, OH',
      approval_mode: overrides.approvalMode ?? 'auto',
      tts_provider: template.default_tts_provider,
      tts_voice_id: template.default_tts_voice_id,
      selected_platforms: [],
      idempotency_key: overrides.idempotencyKey,
      status: overrides.status,
      triggered_by: 'e2e_test',
    })
    .select('id')
    .single();
  if (error || !inserted) throw error ?? new Error('seed failed');
  return inserted.id;
}

/**
 * Insert a content_assets row. Test helper only. Mirrors the production
 * convention where non-file assets (mcp_payload, script, script_raw)
 * use `storage_url: 'inline'` and keep the payload in `metadata`.
 */
export async function seedAsset(
  ctx: E2EContext,
  runId: string,
  kind: 'mcp_payload' | 'script' | 'script_raw' | 'audio' | 'video_master',
  metadata: Record<string, unknown>,
  storageUrl = 'inline',
): Promise<void> {
  const client = ctx.supabase.getClient();
  const { error } = await client.from('content_assets').insert({
    run_id: runId,
    kind,
    storage_url: storageUrl,
    metadata,
  });
  if (error) throw error;
}
