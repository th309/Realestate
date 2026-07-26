// packages/backend/src/content-pipeline/drivers/ranking-script-to-variant.ts
import { ScriptVariant } from './script-generator.interface';
import { RankingScript } from '../ranking/ranking-script.schema';

// Words→seconds at ~140 wpm narration pace, 0.5s granularity.
const wordsToSec = (text: string): number =>
  Math.max(
    1,
    Math.round((text.split(/\s+/).filter(Boolean).length / 2.33) * 2) / 2,
  );

/**
 * Flatten a RankingScript into a generic ScriptVariant envelope.
 * Variants A/B map to the two hook openers; body, outro, cta are shared.
 */
export function rankingToVariant(
  script: RankingScript,
  variantId: 'A' | 'B',
): ScriptVariant {
  const hookIndex = variantId === 'A' ? 0 : 1;
  const hook = script.hooks[hookIndex] ?? script.hooks[0];

  const body = script.rows.map((r) => r.vo).join(' ');
  const fullText = [
    hook.intro_vo,
    body,
    script.outro_vo,
    script.outro_cta,
  ].join(' ');

  const sceneBreakdown = [
    {
      sceneKey: 'hook',
      text: hook.intro_vo,
      durationHintSec: wordsToSec(hook.intro_vo),
    },
    ...script.rows.map((r) => ({
      sceneKey: `rank-${r.rank}`,
      text: r.vo,
      durationHintSec: wordsToSec(r.vo),
    })),
    {
      sceneKey: 'outro',
      text: `${script.outro_vo} ${script.outro_cta}`,
      durationHintSec:
        wordsToSec(script.outro_vo) + wordsToSec(script.outro_cta),
    },
  ];

  return {
    variantId,
    hook: hook.intro_vo,
    body,
    cta: script.outro_cta,
    fullText,
    sceneBreakdown,
  };
}
