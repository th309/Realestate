import { Test } from '@nestjs/testing';
import { TimeCaptionsHandler } from './time-captions.handler';
import { CAPTION_TIMER } from '../../drivers/caption-timer.interface';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
}));

describe('TimeCaptionsHandler', () => {
  let handler: TimeCaptionsHandler;
  let timer: { time: jest.Mock };
  let supabase: { getClient: jest.Mock };
  let orchestrator: {
    handleStepSuccess: jest.Mock;
    handleStepFailure: jest.Mock;
  };
  let storageDownload: jest.Mock;
  let inserts: unknown[][];

  beforeEach(async () => {
    inserts = [];
    storageDownload = jest.fn().mockResolvedValue({
      data: {
        arrayBuffer: async () => new ArrayBuffer(8),
      },
      error: null,
    });
    const fromTable = jest.fn((table: string) => {
      if (table === 'content_assets') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          in: jest.fn().mockResolvedValue({ data: null, error: null }),
          delete: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              storage_url: 'supabase://content-pipeline/runs/r1/audio.mp3',
            },
            error: null,
          }),
          insert: jest.fn().mockImplementation((rows) => {
            inserts.push(rows);
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      if (table === 'content_run_events') {
        return { insert: jest.fn().mockResolvedValue({ data: null, error: null }) };
      }
      throw new Error(`unexpected table ${table}`);
    });
    supabase = {
      getClient: jest.fn().mockReturnValue({
        from: fromTable,
        storage: {
          from: jest.fn().mockReturnValue({ download: storageDownload }),
        },
      }),
    };
    timer = {
      time: jest.fn().mockResolvedValue({
        words: [{ startMs: 0, endMs: 500, word: 'hello' }],
        segments: [{ startMs: 0, endMs: 500, text: 'hello' }],
        srt: '1\n00:00:00,000 --> 00:00:00,500\nhello\n',
        cost: {
          provider: 'openai-whisper',
          amount_usd: 0.006,
          units: 1,
          unit_type: 'minutes',
        },
      }),
    };
    orchestrator = {
      handleStepSuccess: jest.fn().mockResolvedValue(undefined),
      handleStepFailure: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TimeCaptionsHandler,
        { provide: CAPTION_TIMER, useValue: timer },
        { provide: SupabaseService, useValue: supabase },
        { provide: RunOrchestratorService, useValue: orchestrator },
      ],
    }).compile();
    handler = moduleRef.get(TimeCaptionsHandler);
  });

  it('downloads audio, calls timer, persists captions, advances pipeline', async () => {
    await handler.handle('r1');
    expect(timer.time).toHaveBeenCalledTimes(1);
    expect(orchestrator.handleStepSuccess).toHaveBeenCalledWith('r1');
    expect(orchestrator.handleStepFailure).not.toHaveBeenCalled();

    // Two-row insert: captions_timings + captions_srt
    const allInsertedRows = inserts.flat() as Array<{ kind: string }>;
    expect(allInsertedRows).toHaveLength(2);
    expect(allInsertedRows.map((r) => r.kind).sort()).toEqual([
      'captions_srt',
      'captions_timings',
    ]);
  });

  it('routes failure through orchestrator on timer error', async () => {
    timer.time.mockRejectedValueOnce(new Error('whisper api 500'));
    await handler.handle('r1');
    expect(orchestrator.handleStepFailure).toHaveBeenCalledWith(
      'r1',
      expect.stringContaining('timing_captions: whisper api 500'),
    );
    expect(orchestrator.handleStepSuccess).not.toHaveBeenCalled();
  });
});
