import { EdgeTTSDriver } from './edge-tts-driver';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

describe('EdgeTTSDriver', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reports configured when EDGE_TTS_PYTHON is set', () => {
    process.env.EDGE_TTS_PYTHON = '/usr/bin/python3';
    expect(new EdgeTTSDriver().isConfigured()).toBe(true);
  });

  it('synthesizes by spawning python edge-tts', async () => {
    process.env.EDGE_TTS_PYTHON = '/usr/bin/python3';
    const fakeProc: any = new EventEmitter();
    fakeProc.stdout = new EventEmitter();
    fakeProc.stderr = new EventEmitter();
    (child_process.spawn as jest.Mock).mockReturnValue(fakeProc);

    const driver = new EdgeTTSDriver();
    const pending = driver.synthesize({
      text: 'hello',
      voiceId: 'en-US-AndrewMultilingualNeural',
      outputPath: '/tmp/t.mp3',
      format: 'mp3',
    });
    setTimeout(() => fakeProc.emit('close', 0), 20);
    const result = await pending;

    expect((child_process.spawn as jest.Mock).mock.calls[0][0]).toBe(
      '/usr/bin/python3',
    );
    expect(result.cost.amount_usd).toBe(0);
    expect(result.cost.provider).toBe('edge-tts');
  });
});
