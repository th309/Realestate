/**
 * CLI Entry Point for Geographic Data Loader
 */

import type { LoadResult } from './types';
import { buildCompleteHierarchy } from './db-client';
import {
  loadNational,
  loadStates,
  loadMetros,
  loadCities,
  loadCounties,
  loadZipCodes
} from './loaders';

/**
 * Main CLI function
 */
export async function main(): Promise<void> {
  console.log('Starting Ordered Geographic Data Load');
  console.log('========================================\n');

  const results: LoadResult[] = [];

  // Step 1: National
  const nationalResult = await loadNational();
  results.push(nationalResult);
  if (!nationalResult.success) {
    console.error('Failed to load national. Stopping.');
    return;
  }

  // Step 2: States
  const statesResult = await loadStates();
  results.push(statesResult);
  if (!statesResult.success) {
    console.error('Failed to load states. Stopping.');
    return;
  }

  // Step 3: Metros
  const metrosResult = await loadMetros();
  results.push(metrosResult);
  if (!metrosResult.success) {
    console.error('Warning: Failed to load metros. Continuing...');
  }

  // Step 4: Cities
  const citiesResult = await loadCities();
  results.push(citiesResult);
  if (!citiesResult.success) {
    console.error('Warning: Failed to load cities. Continuing...');
  }

  // Step 5: Counties
  const countiesResult = await loadCounties();
  results.push(countiesResult);
  if (!countiesResult.success) {
    console.error('Warning: Failed to load counties. Continuing...');
  }

  // Step 6: Zip Codes
  const zipResult = await loadZipCodes();
  results.push(zipResult);
  if (!zipResult.success) {
    console.error('Warning: Failed to load zip codes.');
  }

  // Print summary
  printSummary(results);

  // Final hierarchy build
  await buildCompleteHierarchy();
}

/**
 * Print load summary
 */
function printSummary(results: LoadResult[]): void {
  console.log('\n========================================');
  console.log('LOAD SUMMARY');
  console.log('========================================');

  let totalLoaded = 0;
  let totalRelationships = 0;

  results.forEach(result => {
    const icon = result.success ? 'OK' : 'FAIL';
    console.log(
      `${icon} ${result.level.padEnd(12)}: ` +
      `${result.recordsLoaded.toString().padStart(6)} records, ` +
      `${result.relationshipsCreated.toString().padStart(6)} relationships`
    );
    totalLoaded += result.recordsLoaded;
    totalRelationships += result.relationshipsCreated;
  });

  console.log('----------------------------------------');
  console.log(
    `TOTAL: ${totalLoaded.toString().padStart(6)} records, ` +
    `${totalRelationships.toString().padStart(6)} relationships`
  );
  console.log('========================================\n');
}
