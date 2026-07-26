// packages/backend/scripts/infographic-worker/notebooklm-cli.ts
//
// Thin adapter over the `nlm` CLI (notebooklm-mcp-cli). Local-only: it depends
// on Troy's Google login, which production does not have.
import { execFileSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;
const PNG_MAGIC = '89504e470d0a1a0a';

/** `nlm` prints progress glyphs the Windows console cannot encode without this. */
function runNlm(args: string[]): string {
  return execFileSync('nlm', args, {
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    maxBuffer: 32 * 1024 * 1024,
  });
}

function parseJsonOutput(raw: string): Record<string, unknown> {
  // `--json` can still emit a banner line before the payload.
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `nlm returned no JSON payload (${raw.trim().slice(0, 200)})`,
    );
  }
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createArtifact(
  notebookId: string,
  cliStyle: string,
  focus: string,
): string {
  const payload = parseJsonOutput(
    runNlm([
      'infographic',
      'create',
      notebookId,
      '--style',
      cliStyle,
      '--orientation',
      'portrait',
      '--focus',
      focus,
      '-y',
      '--json',
    ]),
  );
  const artifactId =
    (payload.id as string | undefined) ??
    (payload.artifact_id as string | undefined);
  if (!artifactId) {
    throw new Error('nlm infographic create returned no artifact id');
  }
  return artifactId;
}

/**
 * Poll until the artifact leaves the generating state. `nlm studio status`
 * reports "unknown" while a job is still running; it flips to "completed".
 */
async function waitForArtifact(
  notebookId: string,
  artifactId: string,
): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const payload = parseJsonOutput(
      runNlm(['studio', 'status', notebookId, '--json']),
    );
    const artifacts = (payload.artifacts ?? []) as Array<
      Record<string, unknown>
    >;
    const mine = artifacts.find(
      (a) => a.id === artifactId || a.artifact_id === artifactId,
    );
    const status = String(mine?.status ?? 'unknown').toLowerCase();
    if (status === 'completed') return;
    if (status === 'failed' || status === 'error') {
      throw new Error(`NotebookLM reported artifact status ${status}`);
    }
  }
  throw new Error(
    `artifact ${artifactId} did not complete within ${POLL_TIMEOUT_MS / 60000} minutes`,
  );
}

/**
 * Download the PNG twice and byte-compare. A failed download can leave stale or
 * truncated bytes behind, so identical non-empty PNG bytes across two attempts
 * is the only accepted outcome — publishing stale bytes is worse than failing.
 */
function downloadArtifact(
  notebookId: string,
  artifactId: string,
  workDir: string,
): Buffer {
  const attempt = (fileName: string): Buffer => {
    const path = join(workDir, fileName);
    runNlm([
      'download',
      'infographic',
      notebookId,
      '--id',
      artifactId,
      '-o',
      path,
    ]);
    if (!existsSync(path)) throw new Error(`nlm wrote no file at ${path}`);
    const bytes = readFileSync(path);
    if (bytes.length === 0) throw new Error('downloaded file was empty');
    if (bytes.subarray(0, 8).toString('hex') !== PNG_MAGIC) {
      throw new Error('downloaded file is not a PNG');
    }
    return bytes;
  };

  const first = attempt('attempt-1.png');
  const second = attempt('attempt-2.png');
  if (!first.equals(second)) {
    throw new Error(
      `download was unstable (${first.length} vs ${second.length} bytes) — refusing to use possibly stale bytes`,
    );
  }
  return first;
}

/** Generate one infographic end to end and return its PNG bytes. */
export async function generateInfographicPng(input: {
  notebookId: string;
  cliStyle: string;
  focus: string;
  workDir: string;
  onProgress?: (message: string) => void;
}): Promise<Buffer> {
  const artifactId = createArtifact(
    input.notebookId,
    input.cliStyle,
    input.focus,
  );
  input.onProgress?.(`artifact ${artifactId} created; polling`);
  await waitForArtifact(input.notebookId, artifactId);
  const png = downloadArtifact(input.notebookId, artifactId, input.workDir);
  input.onProgress?.(`downloaded ${png.length} bytes`);
  return png;
}
