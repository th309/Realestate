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

const ALL_50_STATES = STATE_SLUG_DATA.filter(
  (s) => s.abbrev !== "DC" && s.abbrev !== "PR",
).map((s) => s.abbrev);

// Manual verdicts that beat all heuristics. [] = national.
const OVERRIDES: Record<string, string[]> = {
  // Ranks the best market in every state — belongs on all 50 state pages.
  "q2-2026-best-real-estate-market-by-state": ALL_50_STATES,
  // Buffalo deep-dive; AZ/TX only appear in a vs-Phoenix/Austin contrast table.
  "buffalo-housing-market-2026": ["NY"],
};

const normalizeTag = (tag: string) =>
  tag.toLowerCase().trim().replace(/\s+/g, "-");

const CODE_SET = new Set(STATE_SLUG_DATA.map((s) => s.abbrev));

// Featured markets get their own "### City, ST — ..." heading or a
// "| City, ST | ..." rankings-table row; a market with its own section or
// table entry is covered by the post (SEO: the post belongs on every such
// state's browse page). Passing prose mentions are deliberately ignored.
function statesFromBodyStructure(body: string): Map<string, string> {
  const found = new Map<string, string>(); // abbrev -> evidence
  const structuredLines = body
    .split("\n")
    .filter((line) => /^#{2,4}\s+/.test(line) || /^\s*\|/.test(line));
  for (const line of structuredLines) {
    const kind = line.trimStart().startsWith("|") ? "table" : "heading";
    for (const cm of line.matchAll(/,\s*([A-Z]{2})\b/g)) {
      const code = cm[1];
      if (CODE_SET.has(code) && !found.has(code)) {
        found.set(code, `${kind}:${line.slice(0, 40).trim()}`);
      }
    }
    const lower = line.toLowerCase();
    for (const s of STATE_SLUG_DATA) {
      if (lower.includes(`, ${s.name.toLowerCase()}`) && !found.has(s.abbrev)) {
        found.set(s.abbrev, `${kind}-name:${s.name}`);
      }
    }
  }
  return found;
}

// Longest-first + consumption so "west-virginia" wins over "virginia".
const SLUG_SCAN_ORDER = [...STATE_SLUG_DATA].sort(
  (a, b) => b.slug.length - a.slug.length,
);

function suggest(
  filename: string,
  tags: string[],
  body: string,
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
  for (const [abbrev, evidence] of statesFromBodyStructure(body)) {
    if (!found.has(abbrev)) found.set(abbrev, evidence);
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

// Replace an existing single-line `states: [...]` inside the frontmatter block.
function replaceStatesLine(raw: string, states: string[]): string {
  const close = raw.indexOf("\n---", 3);
  if (close === -1) throw new Error("unterminated frontmatter");
  const head = raw.slice(0, close);
  const line =
    states.length === 0
      ? "states: []"
      : `states: [${states.map((s) => `"${s}"`).join(", ")}]`;
  if (!/^states: .*$/m.test(head)) {
    throw new Error("no single-line states entry to replace");
  }
  return head.replace(/^states: .*$/m, line) + raw.slice(close);
}

const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
let written = 0;
for (const file of files) {
  const fullPath = path.join(BLOG_DIR, file);
  const raw = fs.readFileSync(fullPath, "utf-8");
  const before = matter(raw);
  const tags: string[] = Array.isArray(before.data.tags)
    ? before.data.tags
    : [];
  const { states, evidence } = suggest(file, tags, before.content);

  const existing: string[] | undefined = Array.isArray(before.data.states)
    ? (before.data.states as string[])
    : undefined;
  const unchanged =
    existing !== undefined &&
    JSON.stringify([...existing].sort()) === JSON.stringify(states);
  if (unchanged) {
    console.log(`SAME  ${file.padEnd(64)} [${existing.join(", ")}]`);
    continue;
  }
  console.log(
    `${existing !== undefined ? "CHANGE" : "NEW   "} ${file.padEnd(64)} [${(existing ?? []).join(", ")}] -> [${states.join(", ")}] ${evidence.join("; ") || "none -> national"}`,
  );
  if (!WRITE) continue;

  const updated =
    existing !== undefined
      ? replaceStatesLine(raw, states)
      : insertStatesLine(raw, states);
  const after = matter(updated);
  const { states: _sb, ...beforeRest } = before.data;
  const { states: _sa, ...afterRest } = after.data;
  if (
    JSON.stringify(afterRest) !== JSON.stringify(beforeRest) ||
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
