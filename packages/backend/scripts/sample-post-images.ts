// Dev-only: render one sample PNG per new template skeleton to a directory, using
// REAL top-mover data from the production DB (the exact fetchTopMovers query the
// feed uses + the production toRow/shortMarketName mapping) so the samples double
// as a data-path proof — never invented numbers on real metros. Not part of the
// build/suite. Run:
//   npx ts-node --transpile-only scripts/sample-post-images.ts <outDir>
import 'reflect-metadata';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { fetchTopMovers } from '../src/content-pipeline/data/score-mover-context.queries';
import type { ScoreMoverItem } from '../src/content-pipeline/data/score-mover-context.queries';
import {
  formatAsOfDate,
  scoreMomentumLabel,
} from '../src/content-pipeline/feed/feed-helpers';
import { toRow } from '../src/content-pipeline/post-images/post-image-names';
import { PuppeteerPostImageRenderer } from '../src/content-pipeline/post-images/post-image-renderer';
import { buildSinglePostHtml } from '../src/content-pipeline/post-images/post-image-templates';
import type {
  PostImageContent,
  PostImageRow,
} from '../src/content-pipeline/post-images/post-image.types';

const OUT = process.argv[2];
if (!OUT) {
  console.error(
    'usage: sample-post-images.ts <outDir> (no default — fail loud)',
  );
  process.exit(1);
}

config();
// Alternate env-var NAMES the same client reads in supabase.module.ts (not a
// default secret VALUE); main() throws if neither is set.
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

/** ScoreMoverItem → the grounding market shape toRow consumes (as buildGrounding does). */
function moverRow(m: ScoreMoverItem): PostImageRow {
  return toRow({
    name: m.canonical_name,
    state: null,
    score: m.current_score,
    scoreLabel: scoreMomentumLabel(m.current_score),
    scoreDelta: m.delta,
  });
}

async function main() {
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing in .env');
  }
  const client = createClient(url, key);
  const movers = await fetchTopMovers(client, 'metro', 90, 5);

  console.log(
    `window ${movers.window?.latestDate}; up=${movers.up.length} down=${movers.down.length}`,
  );
  if (movers.up.length < 3 || movers.down.length < 1) {
    throw new Error('not enough real movers to render the samples');
  }
  const asOf = formatAsOfDate(movers.window?.latestDate);
  const up = movers.up.map(moverRow);
  const down = movers.down.map(moverRow);

  const samples: Array<{ file: string; content: PostImageContent }> = [
    {
      file: 'sample-dark-rows.png',
      content: {
        family: 'dark',
        template: 'single_post',
        variant: 'daily_card_rows',
        category: 'Ranking',
        eyebrow: 'THIS WEEK',
        headline: "What's your market's score?",
        rows: up.slice(0, 5),
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
        headline: 'Metros gaining the most momentum',
        rows: up.slice(0, 5),
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
        headline: 'Biggest movers, both directions',
        rows: [up[0], down[0]],
        subhead: 'Same data. Different demand signals.',
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
        headline: 'One firming, one cooling',
        rows: [up[1], down[1] ?? down[0]],
        subhead: 'The scores tell you which way each is heading.',
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

  const renderer = new PuppeteerPostImageRenderer();
  try {
    for (const sample of samples) {
      const png = await renderer.renderFitted(
        (scale) => buildSinglePostHtml(sample.content, scale),
        1080,
        1350,
      );
      writeFileSync(join(OUT, sample.file), png);

      console.log(`wrote ${sample.file} (${png.length} bytes)`);
    }
  } finally {
    await renderer.onModuleDestroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
