import { TTSDriverFactory } from './tts-driver.factory';
import { EdgeTTSDriver } from './edge-tts-driver';
import { AzureSpeechDriver } from './azure-speech-driver';
import { OpenAITTSDriver } from './openai-tts-driver';

function stubDriver<P extends 'edge' | 'azure' | 'openai'>(
  provider: P,
  configured: boolean,
): { provider: P; isConfigured: jest.Mock } {
  return {
    provider,
    isConfigured: jest.fn().mockReturnValue(configured),
  };
}

describe('TTSDriverFactory', () => {
  let azure: ReturnType<typeof stubDriver<'azure'>>;
  let edge: ReturnType<typeof stubDriver<'edge'>>;
  let openai: ReturnType<typeof stubDriver<'openai'>>;
  let factory: TTSDriverFactory;

  beforeEach(() => {
    azure = stubDriver('azure', true);
    edge = stubDriver('edge', true);
    openai = stubDriver('openai', true);
    delete process.env.TTS_PREFER;
    factory = new TTSDriverFactory(
      edge as unknown as EdgeTTSDriver,
      azure as unknown as AzureSpeechDriver,
      openai as unknown as OpenAITTSDriver,
    );
  });

  it("driverChain('edge') returns [azure, edge, openai] — paid OpenAI is last resort", () => {
    const chain = factory.driverChain('edge');
    expect(chain.map((d) => d.provider)).toEqual(['azure', 'edge', 'openai']);
  });

  it('driverChain respects TTS_PREFER=edge by skipping Azure', () => {
    process.env.TTS_PREFER = 'edge';
    const chain = factory.driverChain('edge');
    expect(chain.map((d) => d.provider)).toEqual(['edge', 'openai']);
  });

  it("driverChain('openai') returns [openai] only — explicit paid choice has no fallback", () => {
    const chain = factory.driverChain('openai');
    expect(chain.map((d) => d.provider)).toEqual(['openai']);
  });

  it("driverChain('elevenlabs') throws — driver ships in P3", () => {
    expect(() => factory.driverChain('elevenlabs')).toThrow(/P3/);
  });

  it("forProvider('edge') returns Azure when configured (top of chain)", () => {
    expect(factory.forProvider('edge')).toBe(azure);
  });

  it("forProvider('edge') falls through to Edge when Azure unconfigured", () => {
    azure.isConfigured.mockReturnValue(false);
    expect(factory.forProvider('edge')).toBe(edge);
  });

  it("forProvider('edge') falls through to OpenAI when only OpenAI configured", () => {
    azure.isConfigured.mockReturnValue(false);
    edge.isConfigured.mockReturnValue(false);
    expect(factory.forProvider('edge')).toBe(openai);
  });

  it('forProvider throws when no driver in the chain is configured', () => {
    azure.isConfigured.mockReturnValue(false);
    edge.isConfigured.mockReturnValue(false);
    openai.isConfigured.mockReturnValue(false);
    expect(() => factory.forProvider('edge')).toThrow(
      /No TTS driver configured/,
    );
  });
});
