#!/usr/bin/env ts-node
/**
 * Formula Discovery - Interactive Runner
 * 
 * Simple interface to run formula discovery analysis.
 * 
 * Usage:
 *   npx ts-node scripts/formula-discovery/run-analysis.ts
 * 
 * Or with options:
 *   npx ts-node scripts/formula-discovery/run-analysis.ts --all
 *   npx ts-node scripts/formula-discovery/run-analysis.ts --geo=county --horizon=5
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// MENU SYSTEM
// ============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

async function showMenu(): Promise<void> {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           PROPERTYIQ FORMULA DISCOVERY SYSTEM                        ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                      ║');
  console.log('║  This tool analyzes RAW market data to discover optimal formulas    ║');
  console.log('║  for PropertyIQ scores. It does NOT use existing scores.            ║');
  console.log('║                                                                      ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log('║  SELECT AN OPTION:                                                   ║');
  console.log('║                                                                      ║');
  console.log('║    1. Quick Analysis    - Single geo/horizon (fastest)              ║');
  console.log('║    2. Full Analysis     - All geos, all horizons (comprehensive)    ║');
  console.log('║    3. Compare Formulas  - Do we need 3 or 9 formulas?               ║');
  console.log('║    4. Custom Analysis   - Choose your parameters                    ║');
  console.log('║    5. Exit                                                          ║');
  console.log('║                                                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
}

async function quickAnalysis(): Promise<void> {
  console.log('\n  Running quick analysis (Metro, 3-year price appreciation)...\n');
  
  // Import and run the main discovery
  const { spawn } = await import('child_process');
  const child = spawn('npx', ['ts-node', 'scripts/formula-discovery/discover-optimal-formulas.ts', '--geo=metro', '--horizon=3', '--outcome=price'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true
  });

  return new Promise(resolve => {
    child.on('close', () => resolve());
  });
}

async function fullAnalysis(): Promise<void> {
  console.log('\n  Running FULL analysis (all combinations)...');
  console.log('  This may take 10-20 minutes.\n');
  
  const { spawn } = await import('child_process');
  const child = spawn('npx', ['ts-node', 'scripts/formula-discovery/discover-optimal-formulas.ts', '--all'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true
  });

  return new Promise(resolve => {
    child.on('close', () => resolve());
  });
}

async function compareFormulas(): Promise<void> {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    FORMULA COMPARISON ANALYSIS                        ║');
  console.log('║                                                                       ║');
  console.log('║  Question: Do we need 3 formulas or 9?                               ║');
  console.log('║                                                                       ║');
  console.log('║  - 3 formulas = One per score type (HomeReady, InvestorEdge, MH)     ║');
  console.log('║  - 9 formulas = One per score type × geography level                 ║');
  console.log('║                                                                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  console.log('  Analyzing each geography level separately to compare...\n');

  // Run analysis for each geo
  const { spawn } = await import('child_process');
  
  for (const geo of ['metro', 'county', 'zip']) {
    console.log(`\n  ═══════════════════════════════════════════════════════════`);
    console.log(`  Analyzing ${geo.toUpperCase()} level...`);
    console.log(`  ═══════════════════════════════════════════════════════════\n`);

    await new Promise<void>(resolve => {
      const child = spawn('npx', ['ts-node', 'scripts/formula-discovery/discover-optimal-formulas.ts', `--geo=${geo}`, '--horizon=3', '--outcome=price'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: true
      });
      child.on('close', () => resolve());
    });
  }

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  COMPARISON COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('\n  Review the results above. Key questions to answer:');
  console.log('\n  1. Are the TOP METRICS similar across geo levels?');
  console.log('     → If YES: Use 3 formulas (same metrics, possibly different weights)');
  console.log('     → If NO: Use 9 formulas (different metrics per geo)');
  console.log('\n  2. Are the SPREADS similar?');
  console.log('     → If all geos have similar spread: 3 formulas is fine');
  console.log('     → If one geo has much better/worse spread: investigate why');
  console.log('\n  3. Statistical significance?');
  console.log('     → If p-values vary widely: some formulas may not be reliable');
  console.log('');
}

async function customAnalysis(): Promise<void> {
  console.log('\n  CUSTOM ANALYSIS OPTIONS\n');

  const geoChoice = await ask('  Geography level (1=metro, 2=county, 3=zip): ');
  const geo = geoChoice === '2' ? 'county' : geoChoice === '3' ? 'zip' : 'metro';

  const horizonChoice = await ask('  Time horizon (1=1yr, 2=3yr, 3=5yr, 4=10yr): ');
  const horizon = horizonChoice === '1' ? '1' : horizonChoice === '3' ? '5' : horizonChoice === '4' ? '10' : '3';

  const outcomeChoice = await ask('  Outcome type (1=price appreciation, 2=rent growth, 3=total return): ');
  const outcome = outcomeChoice === '2' ? 'rent' : outcomeChoice === '3' ? 'total' : 'price';

  console.log(`\n  Running analysis: ${geo} | ${horizon}-year | ${outcome}...\n`);

  const { spawn } = await import('child_process');
  const child = spawn('npx', [
    'ts-node', 
    'scripts/formula-discovery/discover-optimal-formulas.ts', 
    `--geo=${geo}`, 
    `--horizon=${horizon}`, 
    `--outcome=${outcome}`
  ], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true
  });

  return new Promise(resolve => {
    child.on('close', () => resolve());
  });
}

async function main(): Promise<void> {
  // Check for command-line args
  const args = process.argv.slice(2);
  
  if (args.includes('--all')) {
    await fullAnalysis();
    process.exit(0);
  }

  if (args.some(a => a.startsWith('--geo='))) {
    // Direct invocation with args, pass through to main script
    const { spawn } = await import('child_process');
    const child = spawn('npx', ['ts-node', 'scripts/formula-discovery/discover-optimal-formulas.ts', ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true
    });
    child.on('close', () => process.exit(0));
    return;
  }

  // Interactive mode
  let running = true;

  while (running) {
    await showMenu();
    const choice = await ask('  Enter choice (1-5): ');

    switch (choice.trim()) {
      case '1':
        await quickAnalysis();
        break;
      case '2':
        await fullAnalysis();
        break;
      case '3':
        await compareFormulas();
        break;
      case '4':
        await customAnalysis();
        break;
      case '5':
        running = false;
        break;
      default:
        console.log('\n  Invalid choice. Please enter 1-5.');
    }

    if (running && choice !== '5') {
      await ask('\n  Press Enter to continue...');
    }
  }

  console.log('\n  Goodbye!\n');
  rl.close();
  process.exit(0);
}

main().catch(console.error);
