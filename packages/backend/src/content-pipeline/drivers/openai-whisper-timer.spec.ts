import { OpenAIWhisperTimer } from './openai-whisper-timer';

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    createReadStream: jest.fn(() => ({ __mockStream: true })),
  };
});

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({
          text: 'hello world',
          words: [
            { word: 'hello', start: 0.0, end: 0.5 },
            { word: 'world', start: 0.6, end: 1.0 },
          ],
          segments: [{ start: 0, end: 1.0, text: 'hello world' }],
        }),
      },
    },
  })),
}));

describe('OpenAIWhisperTimer', () => {
  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test';
  });

  it('returns word timings and SRT', async () => {
    const timer = new OpenAIWhisperTimer();
    const result = await timer.time('/tmp/audio.mp3');
    expect(result.words).toHaveLength(2);
    expect(result.words[0].word).toBe('hello');
    expect(result.srt).toContain('hello world');
  });

  it('bills per minute (rounded up), not per request', async () => {
    const timer = new OpenAIWhisperTimer();
    const result = await timer.time('/tmp/audio.mp3');
    // mocked segments end at 1000ms → ceil(1/60) = 1 minute → $0.006
    expect(result.cost.units).toBe(1);
    expect(result.cost.unit_type).toBe('minutes');
    expect(result.cost.amount_usd).toBeCloseTo(0.006, 4);
    expect(result.cost.provider).toBe('openai-whisper');
  });
});
