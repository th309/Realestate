import { createInfographicRun } from './create-infographic-run';
import type { CreateRunDto } from '../dto/create-run.dto';

function buildClient() {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from: jest.fn((table: string) => {
      if (table !== 'content_runs')
        throw new Error(`unexpected table ${table}`);
      return {
        insert: (row: Record<string, unknown>) => {
          inserted.push(row);
          return {
            select: () => ({
              single: async () => ({
                data: { id: 'run-1', status: row.status },
                error: null,
              }),
            }),
          };
        },
      };
    }),
  };
  return { client, inserted };
}

const VALID_DTO = {
  format: 'infographic',
  idempotencyKey: 'e6d1a0e0-0000-4000-8000-000000000001',
  infographicParams: {
    topic_slug: 'mcp-for-agents',
    task_number: 1,
    style_id: 'flat-editorial',
  },
} as unknown as CreateRunDto;

describe('createInfographicRun parks the run for the local worker', () => {
  it('inserts at status queued and never enqueues an orchestrator job', async () => {
    const { client, inserted } = buildClient();
    const result = await createInfographicRun(client as never, VALID_DTO);

    expect(result).toEqual({
      id: 'run-1',
      idempotencyKey: VALID_DTO.idempotencyKey,
      status: 'queued',
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0].status).toBe('queued');
    // Only content_runs is touched — no queue table, no transition write.
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith('content_runs');
  });

  it('stores the resolved params under format-options infographic', async () => {
    const { client, inserted } = buildClient();
    await createInfographicRun(client as never, VALID_DTO);
    expect(inserted[0].format_options).toEqual({
      infographic: {
        topic_slug: 'mcp-for-agents',
        task_number: 1,
        style_id: 'flat-editorial',
      },
    });
  });

  it('derives a readable market query from the topic and task', async () => {
    const { client, inserted } = buildClient();
    await createInfographicRun(client as never, VALID_DTO);
    expect(inserted[0].market_query).toBe(
      'mcp-for-agents - Find your farm area',
    );
    expect(String(inserted[0].market_query)).not.toContain('_');
  });
});

describe('createInfographicRun refuses ungeneratable requests', () => {
  async function expectRejection(
    params: unknown,
    expectedMessage: string | RegExp,
  ) {
    const { client, inserted } = buildClient();
    await expect(
      createInfographicRun(
        client as never,
        {
          ...VALID_DTO,
          infographicParams: params,
        } as unknown as CreateRunDto,
      ),
    ).rejects.toThrow(expectedMessage);
    expect(inserted).toHaveLength(0);
  }

  it('rejects a missing params object', async () => {
    await expectRejection(undefined, /require infographicParams/);
  });

  it('rejects an unknown topic slug', async () => {
    await expectRejection(
      { topic_slug: 'nope', task_number: 1, style_id: 'flat-editorial' },
      /unknown topic slug nope/,
    );
  });

  it('rejects an unvetted topic', async () => {
    await expectRejection(
      { topic_slug: 'how-to-map', task_number: 1, style_id: 'flat-editorial' },
      /not vetted/,
    );
  });

  it('rejects a task number the topic does not have', async () => {
    await expectRejection(
      {
        topic_slug: 'mcp-for-agents',
        task_number: 42,
        style_id: 'flat-editorial',
      },
      /has no task number 42/,
    );
  });

  it('rejects an unknown style id', async () => {
    await expectRejection(
      {
        topic_slug: 'mcp-for-agents',
        task_number: 1,
        style_id: 'steampunk',
      },
      /unknown style id steampunk/,
    );
  });
});
