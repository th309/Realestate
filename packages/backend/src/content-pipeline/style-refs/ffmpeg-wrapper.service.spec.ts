import { FFmpegWrapperService } from './ffmpeg-wrapper.service';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';

jest.mock('child_process');
jest.mock('fs');

describe('FFmpegWrapperService', () => {
  beforeEach(() => {
    process.env.FFMPEG_BIN = '/usr/bin/ffmpeg';
    (child_process.spawn as unknown as jest.Mock).mockReset();
    (fs.mkdirSync as unknown as jest.Mock).mockReset();
    (fs.readdirSync as unknown as jest.Mock).mockReset();
  });

  it('extractFrames spawns ffmpeg with expected args', async () => {
    const fakeProc: any = new EventEmitter();
    fakeProc.stderr = new EventEmitter();
    (child_process.spawn as unknown as jest.Mock).mockReturnValue(fakeProc);

    (fs.readdirSync as unknown as jest.Mock).mockReturnValue([
      'frame-001.jpg',
      'frame-002.jpg',
    ]);

    const svc = new FFmpegWrapperService();
    const promise = svc.extractFrames('/tmp/v.mp4', 1);
    setTimeout(() => fakeProc.emit('close', 0), 10);
    const frames = await promise;

    expect(frames.length).toBe(2);
    const args = (child_process.spawn as unknown as jest.Mock).mock.calls[0][1];
    expect(args).toContain('-i');
    expect(args).toContain('/tmp/v.mp4');
    expect(args).toContain('-vf');
  });
});

