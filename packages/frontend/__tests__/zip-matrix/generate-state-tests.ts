/**
 * Generate State Test Files
 *
 * Run with: npx tsx __tests__/zip-matrix/generate-state-tests.ts
 */

import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { US_STATES } from './metrics';

const TEMPLATE_PATH = join(__dirname, 'state-tests', '_template.ts');
const OUTPUT_DIR = join(__dirname, 'state-tests');

// Read template
const template = readFileSync(TEMPLATE_PATH, 'utf-8');

// Generate test file for each state
for (const state of US_STATES) {
  const content = template.replace(/STATE_CODE/g, state);
  const filePath = join(OUTPUT_DIR, `${state}.test.ts`);
  writeFileSync(filePath, content);
  console.log(`Generated ${state}.test.ts`);
}

console.log(`\nGenerated ${US_STATES.length} state test files`);
