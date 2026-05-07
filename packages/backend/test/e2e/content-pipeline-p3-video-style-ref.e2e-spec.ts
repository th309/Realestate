import { bootstrapE2EContext, E2EContext } from './helpers';

const runVideoRef = process.env.RUN_P3_VIDEO_STYLE_REF_E2E === 'true';
const describeFn = runVideoRef ? describe : describe.skip;

describeFn('E2E: content-pipeline P3 video style reference ingest', () => {
  let ctx: E2EContext;

  beforeAll(async () => {
    ctx = await bootstrapE2EContext();
  }, 60_000);

  afterAll(async () => {
    await ctx.app.close();
  }, 30_000);

  it('ingests video style reference from a YouTube URL', async () => {
    const url = process.env.P3_VIDEO_STYLE_REF_URL;
    if (!url) {
      throw new Error('P3_VIDEO_STYLE_REF_URL env var required');
    }
    const userId = `e2e-style-${Date.now()}`;
    const ref = await ctx.styleReferences.ingestVideoFromUrl(
      userId,
      url,
      'E2E video ref',
    );
    expect(ref.kind).toBe('video');
    expect(ref.preview_strip_url).toMatch(/^supabase:\/\/content-pipeline\//);
    expect(ref.extracted_attributes).toBeTruthy();
  }, 180_000);
});

