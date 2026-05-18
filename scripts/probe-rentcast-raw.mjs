/**
 * Call RentCast directly (bypassing our backend transform) and dump the
 * full raw response for each of the 3 endpoints we use:
 *   - GET /v1/properties
 *   - GET /v1/avm/value
 *   - GET /v1/avm/rent/long-term
 *
 * Use to audit what fields RentCast actually returns vs. what our service
 * keeps in `RentcastService` transforms.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

function readEnv(file, key) {
  const text = fs.readFileSync(file, "utf8");
  const line = text.split("\n").find((l) => l.startsWith(`${key}=`));
  return line?.slice(`${key}=`.length).trim().replace(/^"|"$/g, "");
}

const backendEnv = path.join(repoRoot, "packages/backend/.env");
const API_KEY = readEnv(backendEnv, "RENTCAST_API_KEY");
const HEADER =
  readEnv(backendEnv, "RENTCAST_API_KEY_HEADER") || "X-Api-Key";

if (!API_KEY) {
  console.error("RENTCAST_API_KEY missing from packages/backend/.env");
  process.exit(1);
}

const ADDRESS = process.argv[2] || "123 S Market St, Frederick, MD 21701";
const endpoints = ["properties", "avm/value", "avm/rent/long-term"];

const out = {};
for (const ep of endpoints) {
  const url = `https://api.rentcast.io/v1/${ep}?address=${encodeURIComponent(ADDRESS)}`;
  const res = await fetch(url, { headers: { [HEADER]: API_KEY } });
  const body = res.ok
    ? await res.json()
    : { __error: `${res.status} ${res.statusText}`, body: await res.text() };
  out[ep] = body;
}
console.log(JSON.stringify(out, null, 2));
