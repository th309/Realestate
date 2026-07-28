import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  TTSDriver,
  TTSSynthesisRequest,
  TTSSynthesisResult,
} from '../../drivers/tts-driver.interface';
import { synthesizeNarration } from './synthesize-narration-segmented';
import {
  assembleNarration,
  isFfmpegAvailable,
} from './assemble-narration-audio';
import { probeAudioDurationMs } from './audio-duration-probe';
import {
  recordTtsFallback,
  synthesizeWithFallback,
} from './synthesize-audio-chain';

jest.mock('./assemble-narration-audio');
jest.mock('./audio-duration-probe');
jest.mock('./synthesize-audio-chain', () => ({
  ...jest.requireActual<Record<string, unknown>>('./synthesize-audio-chain'),
  synthesizeWithFallback: jest.fn(),
  recordTtsFallback: jest.fn(),
}));

const mockAssemble = assembleNarration as jest.Mock;
const mockFfmpegAvailable = isFfmpegAvailable as jest.Mock;
const mockProbe = probeAudioDurationMs as jest.Mock;
const mockFallback = synthesizeWithFallback as jest.Mock;
const mockRecordFallback = recordTtsFallback as jest.Mock;

const OUTPUT = '/tmp/audio-run-1.mp3';
const CLIP_MS = 1000;

// Three sentences, comfortably past the short-script threshold.
const SCRIPT =
  'Phoenix home values climbed nine percent over the last year. ' +
  'Inventory is still tight across the whole metro area. ' +
  'Buyers are moving fast across the entire spring market.';

class FakeDriver implements TTSDriver {
  readonly requests: TTSSynthesisRequest[] = [];
  constructor(
    readonly provider: 'edge' | 'elevenlabs' | 'openai',
    private readonly behavior: {
      failAtCall?: number;
      wordTimingsFor?: (
        index: number,
      ) => { word: string; startMs: number; endMs: number }[] | undefined;
    } = {},
  ) {}
  isConfigured(): boolean {
    return true;
  }
  synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const index = this.requests.length;
    this.requests.push(req);
    if (this.behavior.failAtCall === index) {
      // Not a transient signature, so synthesizeWithRetry gives up at once.
      return Promise.reject(new Error('driver rejected the request'));
    }
    return Promise.resolve({
      durationMs: 120,
      bitrate: 96000,
      cost: {
        provider: this.provider,
        amount_usd: 0.01,
        units: req.text.length,
        unit_type: 'chars',
      },
      wordTimings: this.behavior.wordTimingsFor?.(index) ?? [
        { word: `w${index}`, startMs: 0, endMs: 500 },
      ],
    });
  }
}

const run = (chain: TTSDriver[]) =>
  synthesizeNarration(
    {} as SupabaseClient,
    new Logger('test'),
    'run-1',
    chain,
    'en-US-AndrewMultilingualNeural',
    SCRIPT,
    OUTPUT,
  );

describe('synthesizeNarration synthesizes one clip per segment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFfmpegAvailable.mockResolvedValue(true);
    mockAssemble.mockResolvedValue(undefined);
    // Every clip is CLIP_MS; the assembled file is the clips plus the gaps,
    // so the offset correction is a no-op and offsets stay exact.
    mockProbe.mockImplementation((path: string) =>
      Promise.resolve(path === OUTPUT ? 3 * CLIP_MS + 700 : CLIP_MS),
    );
  });

  it('sends each segment to the driver as its own request', async () => {
    const driver = new FakeDriver('edge');
    await run([driver]);

    expect(driver.requests.map((r) => r.text)).toEqual([
      'Phoenix home values climbed nine percent over the last year.',
      'Inventory is still tight across the whole metro area.',
      'Buyers are moving fast across the entire spring market.',
    ]);
    expect(new Set(driver.requests.map((r) => r.outputPath)).size).toBe(3);
    expect(driver.requests.every((r) => r.outputPath !== OUTPUT)).toBe(true);
  });

  it('assembles the clips into the single output path with the planned gaps', async () => {
    await run([new FakeDriver('edge')]);

    const [paths, gaps, output] = mockAssemble.mock.calls[0] as [
      string[],
      number[],
      string,
    ];
    expect(paths).toHaveLength(3);
    expect(gaps).toEqual([350, 350, 0]);
    expect(output).toBe(OUTPUT);
  });

  it('reports the segment plan and that loudness normalization ran', async () => {
    const { segmentPlan, loudnorm } = await run([new FakeDriver('edge')]);

    expect(loudnorm).toBe(true);
    expect(segmentPlan?.segments).toHaveLength(3);
    expect(segmentPlan?.offsetsMs).toEqual([0, 1350, 2700]);
  });

  it('sums per-segment cost into one charge', async () => {
    const { result } = await run([new FakeDriver('edge')]);

    expect(result.cost.amount_usd).toBeCloseTo(0.03, 6);
    expect(result.cost.units).toBe(SCRIPT.length - 2); // two inter-clip spaces
    expect(result.cost.provider).toBe('edge');
  });

  it('shifts each segment word timing onto the assembled timeline', async () => {
    const driver = new FakeDriver('edge', {
      wordTimingsFor: (index) => [
        { word: `seg${index}`, startMs: 100, endMs: 900 },
      ],
    });
    const { result } = await run([driver]);

    expect(result.wordTimings).toEqual([
      { word: 'seg0', startMs: 100, endMs: 900 },
      { word: 'seg1', startMs: 1450, endMs: 2250 },
      { word: 'seg2', startMs: 2800, endMs: 3600 },
    ]);
  });

  it('drops word timings entirely when any segment is missing them', async () => {
    const driver = new FakeDriver('edge', {
      wordTimingsFor: (index) =>
        index === 1 ? [] : [{ word: 'w', startMs: 0, endMs: 10 }],
    });
    const { result } = await run([driver]);

    expect(result.wordTimings).toBeUndefined();
  });
});

describe('synthesizeNarration restarts the whole narration on the next driver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFfmpegAvailable.mockResolvedValue(true);
    mockAssemble.mockResolvedValue(undefined);
    mockProbe.mockImplementation((path: string) =>
      Promise.resolve(path === OUTPUT ? 3 * CLIP_MS + 700 : CLIP_MS),
    );
  });

  it('never mixes two providers inside one narration', async () => {
    const failing = new FakeDriver('edge', { failAtCall: 1 });
    const backup = new FakeDriver('openai');

    const { driver } = await run([failing, backup]);

    expect(driver).toBe(backup);
    // The primary stopped mid-narration; the backup spoke every segment.
    expect(failing.requests).toHaveLength(2);
    expect(backup.requests).toHaveLength(3);
    expect(mockRecordFallback).toHaveBeenCalledTimes(1);
  });

  it('overrides the voice when falling through to the OpenAI catalog', async () => {
    const failing = new FakeDriver('edge', { failAtCall: 0 });
    const backup = new FakeDriver('openai');

    await run([failing, backup]);

    expect(failing.requests[0].voiceId).toBe('en-US-AndrewMultilingualNeural');
    expect(backup.requests.every((r) => r.voiceId === 'alloy')).toBe(true);
  });

  it('throws when the last driver in the chain also fails', async () => {
    await expect(
      run([new FakeDriver('edge', { failAtCall: 0 })]),
    ).rejects.toThrow('driver rejected the request');
    expect(mockAssemble).not.toHaveBeenCalled();
  });
});

describe('synthesizeNarration falls back to single-blob synthesis without ffmpeg', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFfmpegAvailable.mockResolvedValue(false);
  });

  it('synthesizes the script as one request and reports no normalization', async () => {
    const driver = new FakeDriver('edge');
    mockFallback.mockResolvedValue({
      driver,
      result: { durationMs: 900, bitrate: 96000, cost: {} },
    });

    const { segmentPlan, loudnorm } = await run([driver]);

    expect(mockFallback).toHaveBeenCalledTimes(1);
    const fallbackArgs = mockFallback.mock.calls[0] as unknown[];
    expect(fallbackArgs[5]).toBe(SCRIPT);
    expect(fallbackArgs[6]).toBe(OUTPUT);
    expect(mockAssemble).not.toHaveBeenCalled();
    expect(segmentPlan).toBeNull();
    expect(loudnorm).toBe(false);
  });
});
