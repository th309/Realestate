import { parseFfprobeStreams } from '../video-dimensions';

function ffprobeJson(stream: Record<string, unknown>): string {
  return JSON.stringify({ streams: [stream] });
}

describe('parseFfprobeStreams derives DISPLAY dimensions, not coded ones', () => {
  it('returns coded dimensions when there is no rotation or pixel skew', () => {
    expect(
      parseFfprobeStreams(
        ffprobeJson({ width: 1920, height: 1080, sample_aspect_ratio: '1:1' }),
      ),
    ).toEqual({ width: 1920, height: 1080 });
  });

  it('swaps axes for a quarter-turn rotation in stream side data', () => {
    // What a phone filming in portrait actually writes.
    expect(
      parseFfprobeStreams(
        ffprobeJson({
          width: 1920,
          height: 1080,
          side_data_list: [{ rotation: -90 }],
        }),
      ),
    ).toEqual({ width: 1080, height: 1920 });
  });

  it('swaps axes for a legacy rotate tag', () => {
    expect(
      parseFfprobeStreams(
        ffprobeJson({ width: 1920, height: 1080, tags: { rotate: '90' } }),
      ),
    ).toEqual({ width: 1080, height: 1920 });
  });

  it('leaves axes alone for a half-turn rotation', () => {
    expect(
      parseFfprobeStreams(
        ffprobeJson({
          width: 1920,
          height: 1080,
          side_data_list: [{ rotation: 180 }],
        }),
      ),
    ).toEqual({ width: 1920, height: 1080 });
  });

  it('widens an anamorphic source by its sample aspect ratio', () => {
    expect(
      parseFfprobeStreams(
        ffprobeJson({ width: 720, height: 480, sample_aspect_ratio: '40:33' }),
      ),
    ).toEqual({ width: 720 * (40 / 33), height: 480 });
  });

  it('ignores a degenerate 0:1 sample aspect ratio', () => {
    expect(
      parseFfprobeStreams(
        ffprobeJson({ width: 1280, height: 720, sample_aspect_ratio: '0:1' }),
      ),
    ).toEqual({ width: 1280, height: 720 });
  });
});

describe('parseFfprobeStreams returns null instead of throwing on bad output', () => {
  it('returns null for output that is not JSON', () => {
    expect(parseFfprobeStreams('ffprobe: command not found')).toBeNull();
  });

  it('returns null when no video stream was found', () => {
    expect(parseFfprobeStreams(JSON.stringify({ streams: [] }))).toBeNull();
  });

  it('returns null when the stream reports no usable size', () => {
    expect(
      parseFfprobeStreams(ffprobeJson({ width: 0, height: 0 })),
    ).toBeNull();
    expect(
      parseFfprobeStreams(ffprobeJson({ codec_type: 'video' })),
    ).toBeNull();
  });
});
