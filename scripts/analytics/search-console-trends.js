#!/usr/bin/env node
// Monthly trend report: pulls the classified professional/investor-intent
// query list (search-console-classify.js), tracks month-over-month deltas
// against the prior run's snapshot, and appends a dated section to
// docs/analytics/search-console-content-trends.md — the automated
// counterpart to docs/analytics/funnel-tracking.md's convention.
//
// Usage:
//   node scripts/analytics/search-console-trends.js [--asOf=YYYY-MM-DD]
//
// Requires GOOGLE_APPLICATION_CREDENTIALS pointing at the analytics-mcp
// service-account key (same SA search-console.js uses; already granted GSC
// "User" access on sc-domain:propertyiq.app).

const fs = require("fs");
const path = require("path");
const { getAccessToken, parseFlags } = require("./search-console");
const {
  TOP_N,
  WINDOW_DAYS,
  GSC_LAG_DAYS,
  computeWindow,
  fetchAllQueries,
  classify,
} = require("./search-console-classify");

const HISTORY_LIMIT = 24; // ~2 years of monthly entries.

const REPO_ROOT = path.join(__dirname, "..", "..");
const SNAPSHOT_DIR = path.join(
  REPO_ROOT,
  "docs",
  "analytics",
  "search-console-trends",
  "snapshots",
);
const LOG_PATH = path.join(
  REPO_ROOT,
  "docs",
  "analytics",
  "search-console-content-trends.md",
);

const LOG_HEADER = [
  "# PropertyIQ Search Console — Professional/Investor Query Trends",
  "",
  "Auto-generated monthly by `.github/workflows/monthly-search-console-trends.yml` (runs `scripts/analytics/search-console-trends.js` on the 1st of each month). Each run classifies Search Console queries into a professional/investor-intent bucket (excluding a known bot-generated query cluster, branded queries, and generic geo lookups — see search-console-classify.js for the exact regexes and why), compares the trailing-90-day top 20 against the prior run's snapshot, and appends a new dated entry above this line. Oldest entries are pruned once there are more than 24.",
  "",
  "Do not hand-edit old entries — just let the monthly job append.",
  "",
  "---",
  "",
].join("\n");

function loadLatestSnapshot() {
  if (!fs.existsSync(SNAPSHOT_DIR)) return null;
  const files = fs
    .readdirSync(SNAPSHOT_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length === 0) return null;
  const latest = files[files.length - 1];
  return JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, latest), "utf8"));
}

function computeDeltas(currentTop, previousSnapshot) {
  if (!previousSnapshot) return null;
  const prevMap = new Map(
    previousSnapshot.top.map((r) => [r.query, r.impressions]),
  );
  const currSet = new Set(currentTop.map((r) => r.query));

  const risers = [];
  const newThisRun = [];
  for (const r of currentTop) {
    if (prevMap.has(r.query)) {
      risers.push({
        query: r.query,
        delta: r.impressions - prevMap.get(r.query),
      });
    } else {
      newThisRun.push(r);
    }
  }
  risers.sort((a, b) => b.delta - a.delta);

  const droppedOut = previousSnapshot.top
    .filter((r) => !currSet.has(r.query))
    .map((r) => r.query);

  return { risers, newThisRun, droppedOut };
}

function formatDelta(deltas, query) {
  if (!deltas) return "—";
  const riser = deltas.risers.find((r) => r.query === query);
  if (riser) return riser.delta > 0 ? `+${riser.delta}` : `${riser.delta}`;
  return "new";
}

function renderVerdict(top, deltas) {
  if (!deltas) {
    return "**Verdict: First data point.** Baseline for the professional/investor-intent query trend (trailing 90-day window, 3-day GSC lag pullback). Future runs compare against this entry.";
  }
  const parts = [
    `**Verdict:** ${top.length} professional/investor-intent queries in the top ${TOP_N} this run.`,
  ];
  if (deltas.newThisRun.length > 0) {
    parts.push(
      `${deltas.newThisRun.length} new vs last run (e.g. "${deltas.newThisRun[0].query}").`,
    );
  }
  if (deltas.droppedOut.length > 0) {
    parts.push(`${deltas.droppedOut.length} dropped out of the top ${TOP_N}.`);
  }
  const topRiser = deltas.risers[0];
  if (topRiser && topRiser.delta !== 0) {
    parts.push(
      `Biggest mover: "${topRiser.query}" (${topRiser.delta > 0 ? "+" : ""}${topRiser.delta} impressions).`,
    );
  }
  return parts.join(" ");
}

function renderMarkdownSection({
  asOfIso,
  start,
  end,
  top,
  deltas,
  exclusionCounts,
  totalDistinct,
}) {
  const lines = [
    `## ${asOfIso} — automated run`,
    "",
    renderVerdict(top, deltas),
    "",
  ];
  lines.push(
    `Window: ${start} to ${end} (trailing ${WINDOW_DAYS} days, ${GSC_LAG_DAYS}-day lag pullback). Scanned ${totalDistinct} distinct queries; excluded ${exclusionCounts.bot} bot-pattern, ${exclusionCounts.brand} branded, ${exclusionCounts.geo} generic geo-lookup.`,
  );
  lines.push("");
  lines.push("| Query | Impressions | Δ vs last run | Clicks | Avg position |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const r of top) {
    lines.push(
      `| ${r.query} | ${r.impressions} | ${formatDelta(deltas, r.query)} | ${r.clicks} | ${r.position.toFixed(1)} |`,
    );
  }
  lines.push(
    "",
    "Next comparison should be against this entry.",
    "",
    "---",
    "",
  );
  return lines.join("\n");
}

function appendSection(newSection) {
  const existing = fs.existsSync(LOG_PATH)
    ? fs.readFileSync(LOG_PATH, "utf8")
    : LOG_HEADER;

  const headerEnd = existing.indexOf("\n---\n") + "\n---\n".length;
  const header = existing.slice(0, headerEnd);
  const body = existing.slice(headerEnd).trimStart();

  const oldSections = body.length > 0 ? body.split(/\n(?=## )/) : [];
  const sections = [newSection.trimEnd() + "\n", ...oldSections].slice(
    0,
    HISTORY_LIMIT,
  );

  fs.writeFileSync(LOG_PATH, header + "\n" + sections.join("\n") + "\n");
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const { asOfIso, start, end } = computeWindow(flags.asOf);

  const token = await getAccessToken();
  const rows = await fetchAllQueries(token, start, end);
  const { proQueries, excludedBot, excludedBrand, excludedGeo } =
    classify(rows);

  const top = proQueries.slice(0, TOP_N).map((r) => ({
    query: r.keys[0],
    impressions: r.impressions,
    clicks: r.clicks,
    position: r.position,
  }));

  const previousSnapshot = loadLatestSnapshot();
  const deltas = computeDeltas(top, previousSnapshot);
  const exclusionCounts = {
    bot: excludedBot.length,
    brand: excludedBrand.length,
    geo: excludedGeo.length,
  };

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(SNAPSHOT_DIR, `${asOfIso.slice(0, 7)}.json`),
    JSON.stringify(
      {
        asOf: asOfIso,
        windowStart: start,
        windowEnd: end,
        top,
        totalDistinct: rows.length,
        exclusionCounts,
      },
      null,
      2,
    ),
  );

  appendSection(
    renderMarkdownSection({
      asOfIso,
      start,
      end,
      top,
      deltas,
      exclusionCounts,
      totalDistinct: rows.length,
    }),
  );

  console.log(
    `Wrote snapshot + appended ${asOfIso} section (${top.length} professional/investor queries).`,
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { computeDeltas };
