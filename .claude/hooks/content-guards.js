// PostToolUse hook (matcher: Edit|Write): scan the just-written file for
// CLAUDE.md violations. Non-blocking — surfaces findings back to Claude via
// additionalContext so they get fixed, without undoing the edit.
//
// One Node spawn covers three checks (add more to CHECKS):
//   A. Hardcoded secret/config fallback   — §1.2 "No Defaults" + lesson #2
//   B. service_role/secret key in client  — §1.2 "never expose service_role"
//   C. Migration safety (GRANT + backdate) — MEMORY: GRANT-or-500, skipped migrations
const fs = require("fs");
const path = require("path");

let data;
try {
  data = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const filePath =
  data.tool_response?.filePath || data.tool_input?.file_path || "";
if (!filePath) process.exit(0);
const rel = path.relative(projectDir, filePath).replace(/\\/g, "/");

let content = "";
try {
  content = fs.readFileSync(filePath, "utf8");
} catch {
  content = data.tool_input?.content || data.tool_input?.new_string || "";
}
if (!content) process.exit(0);

const lines = content.split("\n");
const isSource = /^(packages|scripts)\/.*\.(ts|tsx|js|jsx)$/.test(rel);
const isTest = /(\.test\.|\.spec\.|\/__tests__\/)/.test(rel);

// --- CHECKS -----------------------------------------------------------------
const CHECKS = [
  // A. Hardcoded fallback for a secret/config value. Targets secret-ish env
  //    names and any config.get(...) || 'literal' (lesson #2: FRONTEND_URL).
  function secretFallback() {
    if (!isSource || isTest) return null;
    const envRe =
      /process\.env\.\w*(?:KEY|SECRET|TOKEN|URL|PASSWORD|DSN|API|WEBHOOK)\w*\s*\|\|/i;
    const getRe = /\.get\(\s*['"][^'"]+['"]\s*\)\s*\|\|\s*['"`]/;
    const hits = [];
    lines.forEach((l, i) => {
      if (l.trim().startsWith("//") || l.trim().startsWith("*")) return;
      if (envRe.test(l) || getRe.test(l))
        hits.push(`L${i + 1}: ${l.trim().slice(0, 80)}`);
    });
    if (!hits.length) return null;
    return (
      "⚠️ CLAUDE.md §1.2 (No Defaults): hardcoded fallback for a secret/config " +
      "value — the app MUST throw if it is missing, not silently use a default:\n  " +
      hits.join("\n  ")
    );
  },

  // B. service_role / secret key referenced in a Client Component.
  function secretInClient() {
    if (!/^packages\/frontend\//.test(rel)) return null;
    const isClient = /^\s*['"]use client['"]/m.test(content);
    if (!isClient) return null;
    if (
      !/(service_role|sb_secret_|SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY)/.test(
        content,
      )
    )
      return null;
    return (
      "🚨 CRITICAL — CLAUDE.md §1.2: a 'use client' component references a " +
      "service_role / secret key. This ships the key to the browser. Move this " +
      "to a Server Component / API route and use the publishable key on the client."
    );
  },

  // C. Migration safety: GRANT after CREATE TABLE, and non-backdated timestamp.
  function migrationSafety() {
    if (!/\/migrations\/.*\.sql$/.test(rel)) return null;
    const msgs = [];
    if (/CREATE\s+TABLE/i.test(content) && !/\bGRANT\b/i.test(content)) {
      msgs.push(
        "CREATE TABLE without GRANT — add `GRANT ALL ON <table> TO service_role;` " +
          "and `TO authenticated;` or sb_secret_ keys get permission-denied (MEMORY).",
      );
    }
    const fileTs = (path.basename(rel).match(/^(\d{8})/) || [])[1];
    if (fileTs) {
      const now = new Date();
      const today =
        `${now.getFullYear()}` +
        `${String(now.getMonth() + 1).padStart(2, "0")}` +
        `${String(now.getDate()).padStart(2, "0")}`;
      if (fileTs < today) {
        msgs.push(
          `migration timestamp ${fileTs} is backdated (today is ${today}). ` +
            "Supabase silently SKIPS out-of-order migrations — use a current timestamp (MEMORY).",
        );
      }
    }
    return msgs.length ? "⚠️ Migration safety:\n  " + msgs.join("\n  ") : null;
  },

  // D. Data-layer compliance (from the data-layer-check skill): frontend data
  //    fetching MUST go through @/lib/data — never direct fetch(API_URL) or the
  //    deprecated @/lib/api/client. The data layer itself is exempt.
  function dataLayerCompliance() {
    if (!/^packages\/frontend\/.*\.(ts|tsx)$/.test(rel)) return null;
    if (/\/lib\/data\//.test(rel) || isTest) return null;
    const hits = [];
    lines.forEach((l, i) => {
      if (l.trim().startsWith("//")) return;
      if (
        (/\bfetch\(/.test(l) && /API_URL/.test(l)) ||
        /from\s+['"]@\/lib\/api\/client/.test(l)
      )
        hits.push(`L${i + 1}: ${l.trim().slice(0, 80)}`);
    });
    if (!hits.length) return null;
    return (
      "⚠️ data-layer-check: frontend data fetching must go through @/lib/data, " +
      "not direct fetch(`${API_URL}…`) / @/lib/api/client (deprecated):\n  " +
      hits.join("\n  ") +
      "\n  → add a fetcher to lib/data/fetchers/ and export from lib/data/index.ts."
    );
  },

  // E. gen-swagger nudge: a controller with route handlers but zero
  //    @ApiOperation decorators is undocumented — suggest the skill.
  function swaggerNudge() {
    if (!/^packages\/backend\/.*\.controller\.ts$/.test(rel)) return null;
    if (!/@(Get|Post|Put|Patch|Delete)\(/.test(content)) return null;
    if (/@ApiOperation\b/.test(content)) return null;
    return (
      "ℹ️ gen-swagger: this controller has route handlers but no @ApiOperation " +
      "decorators. Consider running /gen-swagger to keep API docs in sync."
    );
  },
];
// ---------------------------------------------------------------------------

const findings = CHECKS.map((c) => c()).filter(Boolean);
if (!findings.length) process.exit(0);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: findings.join("\n\n"),
    },
  }),
);
process.exit(0);
