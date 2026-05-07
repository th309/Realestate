import { YtDlpWrapperService } from './yt-dlp-wrapper.service';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

describe('YtDlpWrapperService', () => {
  beforeEach(() => {
    process.env.YT_DLP_BIN = '/usr/local/bin/yt-dlp';
    (child_process.spawn as unknown as jest.Mock).mockReset();
  });

  it('rejects URLs outside allowlist', async () => {
    const svc = new YtDlpWrapperService();
    await expect(
      svc.download('https://evil.example.com/video.mp4'),
    ).rejects.toThrow(/allowlist/i);
  });

  it('accepts YouTube URL', async () => {
    const fakeProc: any = new EventEmitter();
    fakeProc.stderr = new EventEmitter();
    (child_process.spawn as unknown as jest.Mock).mockReturnValue(fakeProc);
    const svc = new YtDlpWrapperService();
    const promise = svc.download('https://www.youtube.com/watch?v=abc');
    setTimeout(() => fakeProc.emit('close', 0), 10);
    const res = await promise;
    expect(res.videoPath).toContain('.mp4');
    expect(res.durationSec).toBe(300);
  });
});

