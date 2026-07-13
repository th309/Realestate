#!/usr/bin/env node
// packages/frontend/scripts/verify-faq-jsonld.mjs
//
// Fetches a locally running page and asserts it has a FAQPage JSON-LD block
// with at least the expected number of questions, each with a name and
// answer text. Usage:
//   node scripts/verify-faq-jsonld.mjs /about 5
//   node scripts/verify-faq-jsonld.mjs /about 5 http://localhost:3000

const [, , path, minCountArg, baseUrl = "http://localhost:3000"] = process.argv;

if (!path || !minCountArg) {
  console.error(
    "Usage: node scripts/verify-faq-jsonld.mjs <path> <minCount> [baseUrl]",
  );
  process.exit(1);
}

const minCount = Number(minCountArg);
const url = `${baseUrl}${path}`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`FAIL: ${url} responded ${res.status}`);
  process.exit(1);
}
const html = await res.text();

const scriptMatches = [
  ...html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  ),
];

if (scriptMatches.length === 0) {
  console.error(`FAIL: no JSON-LD <script> tags found on ${url}`);
  process.exit(1);
}

let faqPage = null;
for (const [, raw] of scriptMatches) {
  const parsed = JSON.parse(raw);
  const candidates = Array.isArray(parsed["@graph"])
    ? parsed["@graph"]
    : [parsed];
  const found = candidates.find((entry) => entry["@type"] === "FAQPage");
  if (found) {
    faqPage = found;
    break;
  }
}

if (!faqPage) {
  console.error(`FAIL: no FAQPage entity found in JSON-LD on ${url}`);
  process.exit(1);
}

const count = faqPage.mainEntity?.length ?? 0;
if (count < minCount) {
  console.error(
    `FAIL: ${url} has ${count} FAQ questions, expected >= ${minCount}`,
  );
  process.exit(1);
}

for (const q of faqPage.mainEntity) {
  if (!q.name || !q.acceptedAnswer?.text) {
    console.error(
      `FAIL: malformed question entry on ${url}: ${JSON.stringify(q)}`,
    );
    process.exit(1);
  }
}

console.log(`PASS: ${url} has ${count} valid FAQPage questions`);
