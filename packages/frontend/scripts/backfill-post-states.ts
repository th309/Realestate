// Backfill a `states:` frontmatter line into every blog post.
//
// Usage (from packages/frontend):
//   npx tsx scripts/backfill-post-states.ts          # dry run: review table
//   npx tsx scripts/backfill-post-states.ts --write  # insert states: [...] lines
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { STATE_SLUG_DATA } from "../lib/data/state-slug-data";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const WRITE = process.argv.includes("--write");

// slug form ("north-carolina") and display form ("north carolina") → abbrev
const NAME_TO_ABBREV = new Map<string, string>();
for (const s of STATE_SLUG_DATA) {
  NAME_TO_ABBREV.set(s.slug, s.abbrev);
  NAME_TO_ABBREV.set(s.name.toLowerCase(), s.abbrev);
}

// City/metro tags appearing in the corpus without a state tag.
// Filled in during dry-run review.
const CITY_TO_STATE: Record<string, string> = {
  nashville: "TN",
  charlotte: "NC",
};

// Manual verdicts that beat all heuristics. [] = national.
const OVERRIDES: Record<string, string[]> = {
  // National "best states" ranking; the 4 state tags are incidental examples.
  "best-states-real-estate-investing-2026": [],
  // National STR roundup; nashville tag is one example market, not the subject.
  "best-markets-short-term-rental-investing-2026": [],
};

const normalizeTag = (tag: string) =>
  tag.toLowerCase().trim().replace(/\s+/g, "-");

// Longest-first + consumption so "west-virginia" wins over "virginia".
const SLUG_SCAN_ORDER = [...STATE_SLUG_DATA].sort(
  (a, b) => b.slug.length - a.slug.length,
);

function suggest(
  filename: string,
  tags: string[],
): { states: string[]; evidence: string[] } {
  const base = filename.replace(/\.mdx$/, "");
  if (base in OVERRIDES) {
    return { states: OVERRIDES[base], evidence: ["override"] };
  }
  const found = new Map<string, string>(); // abbrev -> evidence
  for (const tag of tags) {
    const abbrev = NAME_TO_ABBREV.get(normalizeTag(tag));
    if (abbrev && !found.has(abbrev)) found.set(abbrev, `state-tag:${tag}`);
  }
  for (const tag of tags) {
    const abbrev = CITY_TO_STATE[normalizeTag(tag)];
    if (abbrev && !found.has(abbrev)) found.set(abbrev, `city-tag:${tag}`);
  }
  let scan = base.toLowerCase();
  for (const s of SLUG_SCAN_ORDER) {
    if (scan.includes(s.slug)) {
      if (!found.has(s.abbrev)) found.set(s.abbrev, `slug:${s.slug}`);
      scan = scan.split(s.slug).join(" ");
    }
  }
  return {
    states: [...found.keys()].sort(),
    evidence: [...found.values()],
  };
}

function insertStatesLine(raw: string, states: string[]): string {
  if (!raw.startsWith("---")) throw new Error("no frontmatter");
  const close = raw.indexOf("\n---", 3);
  if (close === -1) throw new Error("unterminated frontmatter");
  const line =
    states.length === 0
      ? "\nstates: []"
      : `\nstates: [${states.map((s) => `"${s}"`).join(", ")}]`;
  return raw.slice(0, close) + line + raw.slice(close);
}

const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
let written = 0;
for (const file of files) {
  const fullPath = path.join(BLOG_DIR, file);
  const raw = fs.readFileSync(fullPath, "utf-8");
  const before = matter(raw);
  if (before.data.states !== undefined) {
    console.log(
      `SKIP (has states: [${(before.data.states as string[]).join(", ")}])  ${file}`,
    );
    continue;
  }
  const tags: string[] = Array.isArray(before.data.tags)
    ? before.data.tags
    : [];
  const { states, evidence } = suggest(file, tags);
  console.log(
    `${file.padEnd(70)} [${states.join(", ").padEnd(10)}] ${evidence.join("; ") || "none -> national"}`,
  );
  if (!WRITE) continue;

  const updated = insertStatesLine(raw, states);
  const after = matter(updated);
  const beforeKeys = JSON.stringify(before.data);
  const { states: _s, ...afterRest } = after.data;
  if (
    JSON.stringify(afterRest) !== beforeKeys ||
    after.content !== before.content
  ) {
    throw new Error(`frontmatter corruption detected in ${file} — aborting`);
  }
  fs.writeFileSync(fullPath, updated);
  written++;
}
console.log(
  WRITE
    ? `\nWrote states to ${written} files.`
    : "\nDry run only — pass --write to apply.",
);
