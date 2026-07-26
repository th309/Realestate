// Dev-only: render one sample PNG per new template skeleton to the scratchpad so
// the new looks can be eyeballed. Not part of the build/suite. Run:
//   npx ts-node --transpile-only scripts/sample-post-images.ts <outDir>
import 'reflect-metadata';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { PuppeteerPostImageRenderer } from '../src/content-pipeline/post-images/post-image-renderer';
import { buildSinglePostHtml } from '../src/content-pipeline/post-images/post-image-templates';
import type { PostImageContent } from '../src/content-pipeline/post-images/post-image.types';

const OUT = process.argv[2] || '.';
const asOf = 'May 31, 2026';

const samples: Array<{ file: string; content: PostImageContent }> = [
  {
    file: 'sample-dark-rows.png',
    content: {
      family: 'dark',
      template: 'single_post',
      variant: 'daily_card_rows',
      category: 'Ranking',
      eyebrow: 'FRIDAY',
      headline: "What's your market's score?",
      rows: [
        { name: 'Austin, TX', score: '2', momentum: 'VERY WEAK', tone: 'neg' },
        { name: 'Dallas, TX', score: '5', momentum: 'VERY WEAK', tone: 'neg' },
        {
          name: 'Abilene, TX',
          score: '94',
          momentum: 'VERY STRONG',
          tone: 'pos',
        },
        {
          name: 'Cape Coral, FL',
          score: '61',
          momentum: 'FIRMING',
          tone: 'pos',
        },
      ],
      cta: 'Drop your metro in the comments below',
      asOf,
    },
  },
  {
    file: 'sample-cream-ranking.png',
    content: {
      family: 'cream',
      template: 'single_post',
      variant: 'editorial_ranking',
      category: 'Ranking',
      eyebrow: 'This Week',
      headline: 'Five metros gaining momentum',
      rows: [
        {
          name: 'Abilene, TX',
          score: '94',
          momentum: 'VERY STRONG',
          tone: 'pos',
        },
        { name: 'Rochester, NY', score: '88', momentum: 'STRONG', tone: 'pos' },
        { name: 'Syracuse, NY', score: '81', momentum: 'STRONG', tone: 'pos' },
        { name: 'Hartford, CT', score: '74', momentum: 'RISING', tone: 'pos' },
        { name: 'Peoria, IL', score: '69', momentum: 'FIRMING', tone: 'pos' },
      ],
      subhead:
        'Momentum measures where a market is heading now, not its price.',
      asOf,
    },
  },
  {
    file: 'sample-dark-versus.png',
    content: {
      family: 'dark',
      template: 'single_post',
      variant: 'daily_card_versus',
      category: 'Contrast',
      eyebrow: 'THURSDAY',
      headline: 'Two Texas Metros',
      rows: [
        {
          name: 'Abilene, TX',
          score: '94',
          momentum: 'VERY STRONG',
          tone: 'pos',
        },
        { name: 'Austin, TX', score: '2', momentum: 'VERY WEAK', tone: 'neg' },
      ],
      subhead: 'Same state. Same economy. Different demand signals.',
      asOf,
    },
  },
  {
    file: 'sample-cream-versus.png',
    content: {
      family: 'cream',
      template: 'single_post',
      variant: 'editorial_versus',
      category: 'Contrast',
      eyebrow: 'Head to Head',
      headline: 'Nashville versus Naples',
      rows: [
        { name: 'Nashville, TN', score: '72', momentum: 'RISING', tone: 'pos' },
        { name: 'Naples, FL', score: '38', momentum: 'WEAK', tone: 'warn' },
      ],
      subhead: 'One is firming, one is cooling — the scores tell you which.',
      asOf,
    },
  },
  {
    file: 'sample-white-quote.png',
    content: {
      family: 'white',
      template: 'single_post',
      variant: 'quote_highlight',
      category: 'Insight',
      headline:
        "The best markets aren't the hottest ones, they're the ones just starting to turn.",
      emphasis: 'just starting to turn',
      attribution: 'PropertyIQ market intelligence',
      asOf,
    },
  },
];

async function main() {
  const renderer = new PuppeteerPostImageRenderer();
  for (const s of samples) {
    const png = await renderer.renderFitted(
      (scale) => buildSinglePostHtml(s.content, scale),
      1080,
      1350,
    );
    writeFileSync(join(OUT, s.file), png);

    console.log(`wrote ${s.file} (${png.length} bytes)`);
  }
  await renderer.onModuleDestroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
