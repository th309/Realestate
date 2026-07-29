/**
 * mcp_payload asset reader for the generate-script step — extracted from the
 * handler to keep it under the file-size limit. Behavior is unchanged.
 *
 * The retry loop exists because fetch-data writes the payload and transitions in
 * the same breath; the scripting worker can pick its job up before that write is
 * visible to a read on another connection. Backing off to ~1.5s total turns a
 * spurious "asset not found" failure into a short wait.
 */
import { Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';

const mcpPayloadLogger = new Logger('readMcpPayloadWithRetry');

export async function readMcpPayloadWithRetry(
  client: ReturnType<SupabaseService['getClient']>,
  runId: string,
): Promise<{ metadata: any } | null> {
  const delays = [0, 100, 200, 400, 800];
  for (const delay of delays) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const { data, error } = await client
      .from('content_assets')
      .select('metadata')
      .eq('run_id', runId)
      .eq('kind', 'mcp_payload')
      .order('created_at', { ascending: false })
      .limit(1);
    mcpPayloadLogger.log(
      `[PIPE] mcp_payload retry runId=${runId} delayMs=${delay} rows=${data?.length ?? 'null'} err=${error?.message ?? 'none'}`,
    );
    if (data && data.length > 0) return data[0] as { metadata: any };
  }
  mcpPayloadLogger.warn(
    `[PIPE] mcp_payload MISS runId=${runId} after ${delays.length} attempts`,
  );
  return null;
}
