import { buildLongFormRenderPlan } from './long-form-render-plan';

describe('buildLongFormRenderPlan', () => {
  it('builds contiguous segments from five chapters and captions', () => {
    const chapterBodies = [
      'One hook line for the open.',
      'Two context lines with demographics here.',
      'Three fundamentals score and trends text.',
      'Four investor angle and opportunity text.',
      'Five close plus call to action here.',
    ];
    const fullText = chapterBodies.join(' ');
    const sceneBreakdown = chapterBodies.map((text, i) => ({
      sceneKey: `chapter_${i + 1}`,
      text,
    }));

    const words = fullText.split(/\s+/).filter(Boolean);
    let ms = 0;
    const captionWords = words.map((word) => {
      const startMs = ms;
      ms += 400;
      return { startMs, endMs: ms - 50, word };
    });

    const plan = buildLongFormRenderPlan({
      fullText,
      sceneBreakdown,
      captionWords,
    });
    expect(plan).not.toBeNull();
    expect(plan!.durationInFrames).toBeGreaterThan(120);
    expect(plan!.segments).toHaveLength(7);
    expect(plan!.segments[0].kind).toBe('intro');
    expect(plan!.segments[1].kind).toBe('stats');
    expect(plan!.segments[5].kind).toBe('outro');
    const sorted = [...plan!.segments].sort((a, b) => a.fromFrame - b.fromFrame);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].fromFrame).toBeGreaterThanOrEqual(sorted[i - 1].fromFrame);
    }
  });

  it('returns null when fewer than five chapters', () => {
    expect(
      buildLongFormRenderPlan({
        fullText: 'a b c',
        sceneBreakdown: [{ sceneKey: 'chapter_1', text: 'a' }],
        captionWords: [{ startMs: 0, endMs: 100, word: 'a' }],
      }),
    ).toBeNull();
  });
});
