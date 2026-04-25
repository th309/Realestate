import { OpenAITTSDriver } from './openai-tts-driver';

const speechCreate = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      audio: { speech: { create: speechCreate } },
    })),
  };
});

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
}));

describe('OpenAITTSDriver', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test-key';
    speechCreate.mockReset();
  });

  it('isConfigured reflects OPENAI_API_KEY presence', () => {
    expect(new OpenAITTSDriver().isConfigured()).toBe(true);
    delete process.env.OPENAI_API_KEY;
    expect(new OpenAITTSDriver().isConfigured()).toBe(false);
  });

  it('synthesize calls tts-1-hd, writes the buffer, returns cost in USD per char', async () => {
    speechCreate.mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(12345),
    });

    const driver = new OpenAITTSDriver();
    const result = await driver.synthesize({
      text: 'hello world this is a test',
      voiceId: 'alloy',
      outputPath: '/tmp/out.mp3',
      format: 'mp3',
    });

    expect(speechCreate).toHaveBeenCalledTimes(1);
    const callArg = speechCreate.mock.calls[0][0];
    expect(callArg.model).toBe('tts-1-hd');
    expect(callArg.voice).toBe('alloy');
    expect(callArg.response_format).toBe('mp3');
    expect(callArg.input).toBe('hello world this is a test');

    expect(result.cost.provider).toBe('openai-tts');
    expect(result.cost.units).toBe(26);
    expect(result.cost.unit_type).toBe('chars');
    // 26 chars * $0.030/1k = $0.00078
    expect(result.cost.amount_usd).toBeCloseTo(0.00078, 5);
  });

  it('forwards wav format when requested', async () => {
    speechCreate.mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(100),
    });

    const driver = new OpenAITTSDriver();
    await driver.synthesize({
      text: 'wav test',
      voiceId: 'nova',
      outputPath: '/tmp/out.wav',
      format: 'wav',
    });

    expect(speechCreate.mock.calls[0][0].response_format).toBe('wav');
  });

  it('throws synth error when API key is missing at synthesize time', async () => {
    delete process.env.OPENAI_API_KEY;
    const driver = new OpenAITTSDriver();
    await expect(
      driver.synthesize({
        text: 'x',
        voiceId: 'alloy',
        outputPath: '/tmp/x.mp3',
        format: 'mp3',
      }),
    ).rejects.toThrow(/OPENAI_API_KEY is required/);
  });
});
