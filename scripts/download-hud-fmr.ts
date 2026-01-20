/**
 * Download HUD Fair Market Rent Data
 *
 * Downloads the latest HUD FMR Excel file from HUD User website.
 * HUD publishes FMR data annually, typically in September/October for the next fiscal year.
 *
 * Data source: https://www.huduser.gov/portal/datasets/fmr.html
 *
 * Usage:
 *   npx tsx scripts/download-hud-fmr.ts
 *   npx tsx scripts/download-hud-fmr.ts --fy=2025
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'data/hud');

// HUD FMR URL patterns - they vary slightly by year
const FMR_URL_PATTERNS = [
  'https://www.huduser.gov/portal/datasets/fmr/fmr{FY}/FY{FY_SHORT}_FMRs.xlsx',
  'https://www.huduser.gov/portal/datasets/fmr/fmr{FY}/FY{FY_SHORT}_FMRs_revised.xlsx',
  'https://www.huduser.gov/portal/datasets/fmr/fmr{FY}/fy{FY}_safmrs.xlsx',
];

function getCurrentFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();

  // Federal FY starts October 1
  // FY2025 starts Oct 1, 2024
  // If we're in Oct-Dec, we're in the FY of next calendar year
  if (month >= 9) {
    // October or later
    return year + 1;
  }
  return year;
}

async function downloadFmrFile(fiscalYear: number): Promise<string | null> {
  const fyShort = String(fiscalYear).slice(2);

  console.log(`Attempting to download FY${fiscalYear} FMR data...`);

  for (const pattern of FMR_URL_PATTERNS) {
    const url = pattern
      .replace('{FY}', String(fiscalYear))
      .replace('{FY_SHORT}', fyShort);

    console.log(`  Trying: ${url}`);

    try {
      const response = await fetch(url);

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const filename = `FY${fyShort}_FMRs.xlsx`;
        const filepath = join(OUTPUT_DIR, filename);

        // Ensure directory exists
        if (!existsSync(OUTPUT_DIR)) {
          mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        writeFileSync(filepath, Buffer.from(buffer));
        console.log(`  ✓ Downloaded: ${filename} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
        return filepath;
      } else {
        console.log(`    HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`    Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return null;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         DOWNLOAD HUD FAIR MARKET RENT DATA');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Parse CLI arguments
  const args = process.argv.slice(2);
  let targetFY: number | null = null;

  for (const arg of args) {
    if (arg.startsWith('--fy=')) {
      targetFY = parseInt(arg.split('=')[1], 10);
    }
  }

  const currentFY = getCurrentFiscalYear();

  if (targetFY) {
    console.log(`Target FY: ${targetFY} (specified)`);
  } else {
    console.log(`Current FY: ${currentFY}`);
    targetFY = currentFY;
  }

  // Try current FY first, then previous FY as fallback
  let filepath = await downloadFmrFile(targetFY);

  if (!filepath && targetFY === currentFY) {
    console.log(`\nCurrent FY not available, trying FY${currentFY - 1}...`);
    filepath = await downloadFmrFile(currentFY - 1);
  }

  if (filepath) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                       SUCCESS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Downloaded: ${filepath}`);
    console.log('\nNext step: Run the import script');
    console.log('  npx tsx scripts/import-hud-fmr.ts');
  } else {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                       FAILED');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Could not download HUD FMR data automatically.');
    console.log('\nManual download required:');
    console.log('  1. Visit: https://www.huduser.gov/portal/datasets/fmr.html');
    console.log('  2. Download the latest FMR Excel file');
    console.log(`  3. Save to: ${OUTPUT_DIR}/FY${String(currentFY).slice(2)}_FMRs.xlsx`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
