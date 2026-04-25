import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScriptArchetypeService } from '../archetypes/script-archetype.service';

/**
 * Weekly cron that refreshes the script_archetypes catalog by re-running
 * discovery → transcripts → cluster → promote.
 *
 * Skipped at boot when ARCHETYPE_REFRESH_ENABLED !== 'true' so dev /
 * staging don't burn YouTube quota or OpenAI tokens unintentionally.
 */
@Injectable()
export class RefreshArchetypesCron implements OnModuleInit {
  private readonly logger = new Logger(RefreshArchetypesCron.name);

  constructor(private readonly archetypes: ScriptArchetypeService) {}

  onModuleInit(): void {
    this.logger.log(
      `[BOOT] ARCHETYPE_REFRESH_ENABLED=${process.env.ARCHETYPE_REFRESH_ENABLED ?? 'false'}`,
    );
  }

  // Sundays at 03:00 UTC — after the weekly Reels analytics rollup, so
  // the discovery query has the freshest view counts to rank against.
  @Cron('0 3 * * 0')
  async run(): Promise<void> {
    if (process.env.ARCHETYPE_REFRESH_ENABLED !== 'true') {
      this.logger.log(
        '[ARCHETYPE-CRON] disabled — set ARCHETYPE_REFRESH_ENABLED=true to run',
      );
      return;
    }
    try {
      const result = await this.archetypes.refresh();
      this.logger.log(
        `[ARCHETYPE-CRON] complete videos=${result.videosDiscovered} clusters=${result.clustersBuilt} promoted=${result.archetypesPromoted} cost=$${result.totalCostUsd.toFixed(4)}`,
      );
    } catch (err) {
      this.logger.error(
        `[ARCHETYPE-CRON] failed: ${(err as Error).message.slice(0, 200)}`,
      );
    }
  }
}
