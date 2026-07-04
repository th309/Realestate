#!/usr/bin/env node
// One-off query: are new users using the analyzer?
// Defines a "new user" as one whose first-ever event in user_events landed
// within the last 30 days. Cross-references against analyzer activity:
//  - explicit analyzer_* events (analyzer-telemetry.ts)
//  - page_path starting with /analyzer (pageview-tracker.ts)

import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

const now = new Date();
const cutoff30d = new Date(now.getTime() - 30 * 86400000).toISOString();

async function rpcCount(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
  });
  if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`);
  const cr = r.headers.get("content-range") || "";
  const m = cr.match(/\/(\d+|\*)$/);
  return m ? Number(m[1]) : 0;
}

async function fetchAll(path) {
  const all = [];
  let from = 0;
  const page = 1000;
  while (true) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { ...headers, Range: `${from}-${from + page - 1}` },
    });
    if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`);
    const rows = await r.json();
    all.push(...rows);
    if (rows.length < page) break;
    from += page;
  }
  return all;
}

console.log(`Cutoff (last 30d): ${cutoff30d}\n`);

// 1) Distinct users with ANY event in last 30d
const recentEvents = await fetchAll(
  `user_events?select=user_id,created_at,event_action,page_path&created_at=gte.${cutoff30d}&user_id=not.is.null`,
);
const activeUsers = new Set(recentEvents.map((e) => e.user_id));
console.log(`Distinct authenticated users with ANY event (30d): ${activeUsers.size}`);
console.log(`Total events (30d, authed): ${recentEvents.length}\n`);

// 2) Of those, who interacted with the analyzer
const analyzerEvents = recentEvents.filter(
  (e) =>
    (e.event_action || "").startsWith("analyzer_") ||
    (e.page_path || "").startsWith("/analyzer"),
);
const analyzerUsers = new Set(analyzerEvents.map((e) => e.user_id));
console.log(`Distinct authed users who hit the analyzer (30d): ${analyzerUsers.size}`);
console.log(`  via analyzer_* events: ${recentEvents.filter((e) => (e.event_action || "").startsWith("analyzer_")).length}`);
console.log(`  via /analyzer page_path: ${recentEvents.filter((e) => (e.page_path || "").startsWith("/analyzer")).length}\n`);

// 3) Which of those users are "new" — earliest event in user_events is within last 30d
const userIds = [...activeUsers];
const firstSeen = new Map();
for (let i = 0; i < userIds.length; i += 50) {
  const chunk = userIds.slice(i, i + 50);
  const inList = chunk.map((u) => `"${u}"`).join(",");
  const rows = await fetchAll(
    `user_events?select=user_id,created_at&user_id=in.(${inList})&order=created_at.asc&limit=1`,
  );
  // PostgREST returns at most 1 per query — need per-user. Fall back to ascending sort + dedupe.
  // Refetch without limit to get earliest per user.
  const rows2 = await fetchAll(
    `user_events?select=user_id,created_at&user_id=in.(${inList})&order=created_at.asc`,
  );
  for (const r of rows2) {
    if (!firstSeen.has(r.user_id)) firstSeen.set(r.user_id, r.created_at);
  }
}

const newUsers = new Set(
  [...firstSeen.entries()]
    .filter(([, ts]) => ts >= cutoff30d)
    .map(([uid]) => uid),
);
console.log(`Distinct "new" authed users (first event in last 30d): ${newUsers.size}`);

const newUsersUsingAnalyzer = [...analyzerUsers].filter((u) => newUsers.has(u));
console.log(`  of which used the analyzer: ${newUsersUsingAnalyzer.length}`);
if (newUsers.size > 0) {
  const pct = ((newUsersUsingAnalyzer.length / newUsers.size) * 100).toFixed(1);
  console.log(`  conversion rate: ${pct}%`);
}

// 4) Sample of new-user analyzer events
console.log(`\nSample of recent analyzer activity by new users:`);
const newUserSet = new Set(newUsersUsingAnalyzer);
const sample = analyzerEvents
  .filter((e) => newUserSet.has(e.user_id))
  .sort((a, b) => b.created_at.localeCompare(a.created_at))
  .slice(0, 10);
for (const e of sample) {
  console.log(`  ${e.created_at}  user=${e.user_id.slice(0, 8)}…  ${e.event_action || "(pageview)"}  ${e.page_path || ""}`);
}
