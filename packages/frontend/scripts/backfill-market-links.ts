// Link the first reference of each geo in every blog post body to its
// /markets/ page: metros ("Cleveland, OH" / "Cleveland, Ohio") to
// /markets/[slug], and each frontmatter-subject state's first bare name
// mention to /markets/state/[slug]. Slugs come from the canonical data files —
// never constructed — so no dead links can be emitted.
//
// Usage (from packages/frontend):
//   npx tsx scripts/backfill-market-links.ts          # dry run: report table
//   npx tsx scripts/backfill-market-links.ts --write  # apply edits
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { STATE_SLUG_DATA } from "../lib/data/state-slug-data";
import METRO_DATA from "../lib/data/metro-slug-data.json";

interface MetroEntry {
  cbsaCode: string;
  slug: string;
  name: string;
  shortName: string;
  state: string;
}

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const WRITE = process.argv.includes("--write");

const ABBREV_TO_NAME = new Map(STATE_SLUG_DATA.map((s) => [s.abbrev, s.name]));
const ABBREV_TO_STATE_SLUG = new Map(
  STATE_SLUG_DATA.map((s) => [s.abbrev, s.slug]),
);

// "Cleveland, OH" and "Cleveland, Ohio" -> metro entry. Ambiguous keys dropped.
const METRO_BY_REF = new Map<string, MetroEntry | null>();
for (const entry of METRO_DATA as MetroEntry[]) {
  const keys = [entry.shortName];
  const [city, st] = entry.shortName.split(", ");
  const full = st ? ABBREV_TO_NAME.get(st) : undefined;
  if (city && full) keys.push(`${city}, ${full}`);
  for (const key of keys) {
    METRO_BY_REF.set(key, METRO_BY_REF.has(key) ? null : entry);
  }
}

const STATE_NAME_ALT = STATE_SLUG_DATA.map((s) => s.name)
  .sort((a, b) => b.length - a.length)
  .join("|");
// "City, OH" or "City, Ohio" — city part starts uppercase, may contain ./'/-
const GEO_REF_RE = new RegExp(
  `([A-Z][A-Za-z.'\\u2019-]*(?: [A-Z][A-Za-z.'\\u2019-]*)*), ((?:[A-Z]{2})(?![A-Za-z])|(?:${STATE_NAME_ALT})\\b)`,
  "g",
);

function normalizeRef(city: string, stOrName: string): string {
  return `${city}, ${stOrName}`;
}

// Lines we must never edit: headings, imports/exports, JSX blocks, code fences.
function classifyLines(lines: string[]): boolean[] {
  const editable: boolean[] = [];
  let inCode = false;
  let inJsx = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("```")) {
      inCode = !inCode;
      editable.push(false);
      continue;
    }
    if (!inJsx && t.startsWith("<")) inJsx = true;
    const jsxNow = inJsx;
    if (inJsx && (t.endsWith("/>") || t.endsWith(">"))) inJsx = false;
    editable.push(
      !inCode &&
        !jsxNow &&
        !t.startsWith("#") &&
        !t.startsWith("import ") &&
        !t.startsWith("export "),
    );
  }
  return editable;
}

function alreadyInLink(line: string, index: number, length: number): boolean {
  if (line[index - 1] === "[") return true;
  const rest = line.slice(index + length);
  if (rest.startsWith("](")) return true;
  // inside link text like [Best of Cleveland, OH here](...)
  const before = line.slice(0, index);
  const openBracket = before.lastIndexOf("[");
  if (openBracket !== -1 && !before.slice(openBracket).includes("]")) {
    const close = rest.indexOf("]");
    if (close !== -1 && rest.slice(close).startsWith("](")) return true;
  }
  return false;
}

function stripMarketLinks(body: string): string {
  return body
    .replace(/\[([^\]]+)\]\(\/markets\/state\/[a-z0-9-]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\(\/markets\/[a-z0-9-]+\)/g, "$1");
}

const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
let totalMetroLinks = 0;
let totalStateLinks = 0;
let filesChanged = 0;

for (const file of files) {
  const fullPath = path.join(BLOG_DIR, file);
  const raw = fs.readFileSync(fullPath, "utf-8");
  const close = raw.indexOf("\n---", 3);
  if (close === -1) throw new Error(`no frontmatter close in ${file}`);
  const headEnd = close + "\n---".length;
  const head = raw.slice(0, headEnd);
  const body = raw.slice(headEnd);
  const { data } = matter(raw);

  const lines = body.split("\n");
  const editable = classifyLines(lines);

  const linkedSlugs = new Set<string>();
  for (const m of body.matchAll(/\]\(\/markets\/([a-z0-9-]+)\)/g)) {
    linkedSlugs.add(m[1]);
  }
  const added: string[] = [];

  // Pass 1: link first "City, ST" / "City, FullState" reference per metro.
  for (let i = 0; i < lines.length; i++) {
    if (!editable[i]) continue;
    let line = lines[i];
    let searchFrom = 0;
    for (;;) {
      GEO_REF_RE.lastIndex = searchFrom;
      const m = GEO_REF_RE.exec(line);
      if (!m) break;
      const [refText, city, stOrName] = m;
      const entry = METRO_BY_REF.get(normalizeRef(city, stOrName));
      if (
        entry &&
        !linkedSlugs.has(entry.slug) &&
        !alreadyInLink(line, m.index, refText.length)
      ) {
        const link = `[${refText}](/markets/${entry.slug})`;
        line =
          line.slice(0, m.index) + link + line.slice(m.index + refText.length);
        linkedSlugs.add(entry.slug);
        added.push(entry.slug);
        searchFrom = m.index + link.length;
      } else {
        searchFrom = m.index + refText.length;
      }
    }
    lines[i] = line;
  }
  totalMetroLinks += added.length;

  // Pass 2: link first bare full-state-name mention for each subject state.
  const states: string[] = Array.isArray(data.states) ? data.states : [];
  let stateAdded = 0;
  for (const abbrev of states) {
    const name = ABBREV_TO_NAME.get(abbrev);
    const slug = ABBREV_TO_STATE_SLUG.get(abbrev);
    if (!name || !slug) continue;
    if (lines.some((l) => l.includes(`/markets/state/${slug})`))) continue;
    const nameRe = new RegExp(`\\b${name}\\b`);
    for (let i = 0; i < lines.length; i++) {
      if (!editable[i]) continue;
      const m = nameRe.exec(lines[i]);
      if (!m) continue;
      // skip "City, Ohio" refs (metro territory) and existing link text
      if (lines[i].slice(0, m.index).endsWith(", ")) continue;
      if (alreadyInLink(lines[i], m.index, name.length)) continue;
      lines[i] =
        lines[i].slice(0, m.index) +
        `[${name}](/markets/state/${slug})` +
        lines[i].slice(m.index + name.length);
      stateAdded++;
      break;
    }
  }
  totalStateLinks += stateAdded;

  const newBody = lines.join("\n");
  if (newBody === body) continue;
  filesChanged++;
  console.log(
    `${file.padEnd(66)} +${added.length} metro, +${stateAdded} state${added.length ? `  [${added.join(", ")}]` : ""}`,
  );

  if (stripMarketLinks(newBody) !== stripMarketLinks(body)) {
    throw new Error(`content corruption detected in ${file} — aborting`);
  }
  if (WRITE) fs.writeFileSync(fullPath, head + newBody);
}

console.log(
  `\n${filesChanged} files, +${totalMetroLinks} metro links, +${totalStateLinks} state links. ${WRITE ? "Written." : "Dry run only — pass --write to apply."}`,
);
