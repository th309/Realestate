import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import PgBoss from 'pg-boss';

export type QueueName =
  | 'orchestrator'
  | 'render-audio'
  | 'render-captions'
  | 'render-video'
  | 'render-thumbnail'
  | 'render-pdf'
  | 'publish-youtube'
  | 'publish-tiktok'
  | 'publish-instagram'
  | 'publish-facebook'
  | 'publish-linkedin'
  | 'metrics-pull';

/**
 * Thin wrapper around pg-boss providing NestJS lifecycle integration.
 *
 * Connects via SUPABASE_DB_URL on module init and gracefully stops on destroy.
 * All jobs are stored in the pgboss schema of the configured Postgres database.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private boss!: PgBoss;

  private static readonly QUEUES: QueueName[] = [
    'orchestrator',
    'render-audio',
    'render-captions',
    'render-video',
    'render-thumbnail',
    'render-pdf',
    'publish-youtube',
    'publish-tiktok',
    'publish-instagram',
    'publish-facebook',
    'publish-linkedin',
    'metrics-pull',
  ];

  async onModuleInit(): Promise<void> {
    const connectionString = process.env.SUPABASE_DB_URL;
    if (!connectionString) {
      throw new Error('SUPABASE_DB_URL is required for content-pipeline queue');
    }
    // Local dev and Railway share the same Postgres, so they'd otherwise
    // fight over the same pg-boss queue — local retries get stolen by
    // Railway and vice versa. Segmenting by schema gives each environment
    // its own queue tables. Set PGBOSS_SCHEMA=pgboss_local in .env.local;
    // Railway leaves it unset to keep the prod default.
    const schema = process.env.PGBOSS_SCHEMA ?? 'pgboss';
    this.boss = new PgBoss({
      connectionString,
      schema,
      retryLimit: 0,
      retentionDays: 30,
    });
    this.logger.log(`pg-boss schema=${schema}`);
    this.boss.on('error', (err) => this.logger.error('pg-boss error', err));
    await this.boss.start();

    // pg-boss v10 requires queues to be explicitly created before send() works.
    // Without this, send() silently returns null and the job is dropped.
    for (const queue of QueueService.QUEUES) {
      await this.boss.createQueue(queue);
    }
    this.logger.log(
      `pg-boss queue started with ${QueueService.QUEUES.length} queues registered`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss) await this.boss.stop({ graceful: true });
  }

  async send<T>(
    queue: QueueName,
    data: T,
    opts?: PgBoss.SendOptions,
  ): Promise<string> {
    const jobId = await this.boss.send(queue, data as object, opts ?? {});
    if (!jobId) {
      throw new Error(
        `pg-boss send returned null for queue "${queue}". Queue may not be registered. ` +
          `Check that queue is listed in QueueService.QUEUES.`,
      );
    }
    return jobId;
  }

  async work<T>(
    queue: QueueName,
    handler: (job: PgBoss.Job<T>) => Promise<void>,
    opts?: PgBoss.WorkOptions,
  ): Promise<string> {
    return this.boss.work<T>(queue, opts ?? {}, async (jobs) => {
      for (const job of jobs) await handler(job);
    });
  }

  getBoss(): PgBoss {
    return this.boss;
  }
}
