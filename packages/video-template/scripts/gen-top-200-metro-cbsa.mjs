/**
 * One-shot: reads repo data/economic/census_metro.csv (2023 rows),
 * emits top 200 CBSA codes by total_population for metro hero eligibility.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.resolve(__dirname, "../../../data/economic/census_metro.csv");
const text = fs.readFileSync(csvPath, "utf8");
const rows = [];
for (const line of text.split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue;
  const m = line.match(/^(\d{4}),(\d{5}),/);
  if (!m) continue;
  const year = Number(m[1]);
  const cbsa = m[2];
  const after = line.slice(m[0].length);
  const q1 = after.indexOf('"');
  const q2 = after.indexOf('"', q1 + 1);
  const rest = after.slice(q2 + 2);
  const pop = Number(rest.split(",")[0]);
  if (year !== 2023 || !Number.isFinite(pop)) continue;
  rows.push({ cbsa, pop });
}
rows.sort((a, b) => b.pop - a.pop);
const top = rows.slice(0, 200).map((r) => r.cbsa);
const outPath = path.resolve(
  __dirname,
  "../src/data/metro-population-top-200-cbsa.json",
);
fs.writeFileSync(outPath, `${JSON.stringify(top, null, 2)}\n`);
console.log("wrote", outPath, "count", top.length, "top5", top.slice(0, 5));
