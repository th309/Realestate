/**
 * One-off debug script: hits RentCast directly with the same key + address
 * variants to see what status/body comes back for each endpoint. Use to
 * isolate failures BEFORE editing app code.
 *
 * Run: node scripts/debug-rentcast.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const envPath = path.join(process.cwd(), 'packages/backend/.env');
const envText = fs.readFileSync(envPath, 'utf8');
const keyLine = envText
  .split('\n')
  .find((l) => l.startsWith('RENTCAST_API_KEY='));
if (!keyLine) {
  console.error('FATAL: RENTCAST_API_KEY not in packages/backend/.env');
  process.exit(1);
}
const key = keyLine.slice('RENTCAST_API_KEY='.length).trim().replace(/^"|"$/g, '');
console.log(`Using key length=${key.length}`);

const BASE = 'https://api.rentcast.io/v1';
const ENDPOINTS = ['properties', 'avm/value', 'avm/rent/long-term'];

// Variants of the same address, to see if format matters
const ADDRESSES = [
  '123 s market st, frederick, md',           // exactly what user typed
  '123 S Market St, Frederick, MD',           // title case
  '123 S Market St, Frederick, MD 21701',     // with ZIP
  '123 S Market St, Frederick, MD, 21701',    // ZIP after comma
];

async function tryOne(endpoint, address) {
  const url = `${BASE}/${endpoint}?address=${encodeURIComponent(address)}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { 'X-Api-Key': key } });
    const text = await res.text();
    const dur = Date.now() - t0;
    console.log(
      `[${endpoint}] "${address}" → ${res.status} ${res.statusText} (${dur}ms, ${text.length}b)`
    );
    // Show error body or short success preview
    if (!res.ok) console.log(`  body: ${text.slice(0, 300)}`);
    else console.log(`  preview: ${text.slice(0, 200)}…`);
  } catch (err) {
    console.log(`[${endpoint}] "${address}" → ERR ${err.message}`);
  }
}

for (const addr of ADDRESSES) {
  console.log(`\n=== Address: "${addr}" ===`);
  for (const ep of ENDPOINTS) {
    await tryOne(ep, addr);
  }
}
