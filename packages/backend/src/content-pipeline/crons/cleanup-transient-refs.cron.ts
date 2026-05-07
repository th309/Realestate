import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';

const BUCKET = 'content-pipeline';
const PREFIX = 'style-references';
const KEEP_MS = 24 * 3600 * 1000;

function extractEpochMsFromName(name: string): number | null {
  // Our preview naming convention: `${Date.now()}-preview.jpg`
  const match = name.match(/^(\d{10,})-/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

@Injectable()
export class CleanupTransientRefsCron {
  private readonly logger = new Logger(CleanupTransientRefsCron.name);
  constructor(private readonly supabase: SupabaseService) {}

  @Cron('0 */6 * * *')
  async run(): Promise<void> {
    const client = this.supabase.getClient();
    const cutoff = Date.now() - KEEP_MS;

    // Storage list is not recursive. Our paths are:
    //   style-references/<userId>/<epoch>-preview.jpg
    // so we list user folders, then list files inside each.
    const { data: userFolders, error: listErr } = await client.storage
      .from(BUCKET)
      .list(PREFIX, { limit: 1000 });
    if (listErr) {
      this.logger.warn(`list failed: ${listErr.message}`);
      return;
    }

    const folders = (userFolders ?? [])
      .map((f) => f.name)
      .filter((n) => n && !n.includes('.')); // heuristically treat as folder

    let deleted = 0;

    for (const userFolder of folders) {
      const folderPrefix = `${PREFIX}/${userFolder}`;
      const { data: files, error } = await client.storage
        .from(BUCKET)
        .list(folderPrefix, { limit: 1000 });
      if (error) continue;

      const removePaths: string[] = [];
      for (const f of files ?? []) {
        if (!f?.name) continue;
        const epoch = extractEpochMsFromName(f.name);
        if (epoch != null && epoch < cutoff) {
          removePaths.push(`${folderPrefix}/${f.name}`);
        }
      }

      if (removePaths.length > 0) {
        const { error: rmErr } = await client.storage
          .from(BUCKET)
          .remove(removePaths);
        if (!rmErr) deleted += removePaths.length;
      }
    }

    if (deleted > 0) {
      this.logger.log(`cleaned up ${deleted} transient style-reference files`);
    }
  }
}

