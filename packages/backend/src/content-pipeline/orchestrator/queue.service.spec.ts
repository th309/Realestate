import { Client } from 'pg';
import { QueueService } from './queue.service';

/**
 * Integration test — talks to a real Postgres via SUPABASE_DB_URL.
 *
 * Gated behind RUN_QUEUE_INTEGRATION=true for the same reason the happy-path
 * E2E is gated: default `npm test` should not require a live database. To
 * run against staging:
 *
 *   set -a && source .env.local && set +a && \
 *     RUN_QUEUE_INTEGRATION=true npx jest queue.service.spec
 *
 * Uses its own ephemeral schema (pgboss_test_<pid>_<ts>) so a running local
 * backend subscribed to pgboss_local does not race the test for jobs. The
 * schema is dropped in afterAll.
 */
const runIntegration = process.env.RUN_QUEUE_INTEGRATION === 'true';
const describeFn = runIntegration ? describe : describe.skip;

describeFn('QueueService roundtrip', () => {
  let service: QueueService;
  const testSchema = `pgboss_test_${process.pid}_${Date.now()}`;

  beforeAll(async () => {
    process.env.PGBOSS_SCHEMA = testSchema;
    service = new QueueService();
    await service.onModuleInit();
  }, 30_000);

  afterAll(async () => {
    await service.onModuleDestroy();
    const connectionString = process.env.SUPABASE_DB_URL;
    if (connectionString) {
      const client = new Client({ connectionString });
      await client.connect();
      try {
        await client.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
      } finally {
        await client.end();
      }
    }
  }, 15_000);

  it('sends and receives a job', async () => {
    const received: Array<{ n: number }> = [];
    await service.work<{ n: number }>('orchestrator', async (job) => {
      received.push(job.data);
    });
    const jobId = await service.send('orchestrator', { n: 42 });
    expect(jobId).toBeTruthy();
    // pg-boss v10 default pollingIntervalSeconds is 2s; allow two polls
    // plus scheduling slack so the assertion isn't racy.
    await new Promise((r) => setTimeout(r, 5000));
    expect(received).toEqual([{ n: 42 }]);
  }, 15_000);
});
