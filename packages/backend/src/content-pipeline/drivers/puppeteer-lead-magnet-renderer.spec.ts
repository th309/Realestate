import { PuppeteerLeadMagnetRenderer } from './puppeteer-lead-magnet-renderer';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';

describe('PuppeteerLeadMagnetRenderer', () => {
  it('renders a PDF from the market_snapshot template', async () => {
    const renderer = new PuppeteerLeadMagnetRenderer();
    const outputPath = join(tmpdir(), `test-snapshot-${Date.now()}.pdf`);
    const result = await renderer.render({
      magnetKind: 'market_snapshot_pdf',
      templatePath:
        'packages/backend/src/content-pipeline/lead-magnets/templates/market_snapshot.html.ejs',
      dataBundle: {
        geo: {
          geography: 'metro',
          id: '17140',
          canonical_name: 'Cleveland, OH',
        },
        score: { propertyiq_score: 78, grade: 'B', confidence: 'A' },
        home_value: { value: 385000, yoy_pct: 3.2 },
        rent: { value: 1800, yoy_pct: 4.1 },
        demographics: {
          population: 2050000,
          median_income: 62000,
          homeownership_pct: 66,
        },
        economic: { unemployment_rate: 4.1, job_growth_yoy_pct: 1.8 },
      },
      userContext: { userName: 'Test User', email: 'test@example.com' },
      outputPath,
    });

    expect(existsSync(outputPath)).toBe(true);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    await (
      renderer as unknown as { onModuleDestroy(): Promise<void> }
    ).onModuleDestroy();
    unlinkSync(outputPath);
  }, 30_000);
});
