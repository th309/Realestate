import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { join, dirname, resolve } from 'path';
import { tmpdir } from 'os';
import { writeFileSync, readFileSync } from 'fs';
import { SupabaseService } from '../../../supabase/supabase.service';

/**
 * RenderThumbnailHandler — side-channel thumbnail render.
 *
 * Triggered fire-and-forget from RenderVideoHandler after the master video
 * finishes. Spawns the @propertyiq/video-template render-thumbnail-cli to
 * capture a single PNG frame from the registered Remotion composition,
 * uploads it to Supabase Storage at runs/<id>/thumbnail.png, and inserts a
 * `thumbnail` content_assets row.
 *
 * On failure, writes a `thumbnail_render_failed` content_run_event but does
 * NOT call orchestrator.handleStepFailure — thumbnail is not in the run
 * state machine. Publishers fall back to the platform's default thumbnail
 * when no `thumbnail` asset exists. Task 2.17 adds the operator override
 * (frame regen + manual upload) on top of this base flow.
 */
@Injectable()
export class RenderThumbnailHandler {
  private readonly logger = new Logger(RenderThumbnailHandler.name);
  private readonly cliPath: string;
  private readonly timeoutMs: number;

  constructor(private readonly supabase: SupabaseService) {
    this.cliPath =
      require.resolve('@propertyiq/video-template/dist/cli/render-thumbnail-cli.js');
    this.timeoutMs = parseInt(
      process.env.STEP_TIMEOUT_RENDER_THUMBNAIL_MS ?? '120000',
      10,
    );
  }

  async handle(runId: string, frame?: number): Promise<void> {
    this.logger.log(
      `[PIPE] render-thumbnail.handle START run=${runId} frame=${frame ?? 'default'}`,
    );
    const client = this.supabase.getClient();
    try {
      const { data: run } = await client
        .from('content_runs')
        .select('format, resolved_geo')
        .eq('id', runId)
        .single();
      if (!run) throw new Error('run not found');

      const { data: payload } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'mcp_payload')
        .single();
      if (!payload) throw new Error('mcp_payload asset not found');

      const propsFile = join(tmpdir(), `thumb-props-${runId}.json`);
      writeFileSync(
        propsFile,
        JSON.stringify({
          format: run.format,
          resolvedMarket: run.resolved_geo,
          dataBundle: payload.metadata,
          ctaUrl: '',
        }),
      );
      const outputPath = join(tmpdir(), `thumb-${runId}.png`);

      await this.spawnCli(run.format as string, propsFile, outputPath, frame);

      const storagePath = `runs/${runId}/thumbnail.png`;
      const { error: uploadErr } = await client.storage
        .from('content-pipeline')
        .upload(storagePath, readFileSync(outputPath), {
          contentType: 'image/png',
          upsert: true,
        });
      if (uploadErr) throw uploadErr;

      const storageUrl = `supabase://content-pipeline/${storagePath}`;
      // Idempotent: clear any prior thumbnail row so .single() reads remain
      // valid after a regenerate. Operator overrides (Task 2.17) use a
      // separate variant='override' row that this delete preserves.
      await client
        .from('content_assets')
        .delete()
        .eq('run_id', runId)
        .eq('kind', 'thumbnail')
        .is('variant', null);
      await client.from('content_assets').insert({
        run_id: runId,
        kind: 'thumbnail',
        storage_url: storageUrl,
        metadata: {
          frame: frame ?? 210,
          format: run.format,
        },
      });

      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'render_thumbnail_done',
        payload: {
          format: run.format,
          frame: frame ?? 210,
          storage_url: storageUrl,
        },
      });

      this.logger.log(
        `[PIPE] render-thumbnail.handle SUCCESS run=${runId} url=${storageUrl}`,
      );
    } catch (err) {
      const message = (err as Error).message ?? 'unknown';
      this.logger.error(
        `[PIPE] render-thumbnail FAILED run=${runId}: ${message.slice(0, 200)}`,
      );
      // Side-channel: log the failure for ops/cron alerting but do NOT
      // transition the run state. Publishers will fall back to platform
      // defaults when no thumbnail asset exists.
      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'thumbnail_render_failed',
        payload: { message },
      });
    }
  }

  private async spawnCli(
    format: string,
    propsFile: string,
    outputPath: string,
    frame: number | undefined,
  ): Promise<void> {
    const cliDir = dirname(this.cliPath);
    const pkgRoot = resolve(cliDir, '..', '..');
    const args = [
      this.cliPath,
      '--format',
      format,
      '--props-json',
      propsFile,
      '--output',
      outputPath,
    ];
    if (frame !== undefined) {
      args.push('--frame', String(frame));
    }

    return new Promise<void>((resolveProm, rejectProm) => {
      const proc = spawn('node', args, { cwd: pkgRoot });
      let stderrBuf = '';
      proc.stderr.on('data', (d) => {
        stderrBuf += d.toString();
      });
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        rejectProm(
          new Error(`thumbnail render timeout after ${this.timeoutMs}ms`),
        );
      }, this.timeoutMs);
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolveProm();
        else
          rejectProm(
            new Error(
              `thumbnail render exited ${code}: ${stderrBuf.slice(0, 500) || 'no stderr'}`,
            ),
          );
      });
      proc.on('error', (err) => {
        clearTimeout(timer);
        rejectProm(err);
      });
    });
  }
}
