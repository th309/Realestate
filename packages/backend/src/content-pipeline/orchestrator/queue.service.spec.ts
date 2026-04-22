import { QueueService } from './queue.service';

/**
 * Integration test. Requires a local Postgres instance reachable via
 * SUPABASE_DB_URL (defaults to the Supabase local dev URL if unset).
 *
 * If no database is available this test will fail during onModuleInit,
 * which is expected in CI environments without Postgres.
 */
describe('QueueService roundtrip', () => {
  let service: QueueService;

  beforeAll(async () => {
    process.env.SUPABASE_DB_URL =
      process.env.SUPABASE_DB_URL ??
      'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
    service = new QueueService();
    await service.onModuleInit();
  });

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  it('sends and receives a job', async () => {
    const received: Array<{ n: number }> = [];
    await service.work<{ n: number }>('orchestrator', async (job) => {
      received.push(job.data);
    });
    const jobId = await service.send('orchestrator', { n: 42 });
    expect(jobId).toBeTruthy();
    await new Promise((r) => setTimeout(r, 2000));
    expect(received).toEqual([{ n: 42 }]);
  });
});
