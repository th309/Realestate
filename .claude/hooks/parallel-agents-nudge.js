// PostToolUse hook (matcher: Grep|Glob|Bash|Task|Agent): nudge toward parallel
// Explore agents when read-only search/investigation calls pile up SERIALLY in
// the main context instead of being fanned out.
//
// Why this exists: CLAUDE.md §1.5 ("default to parallelism") and saved feedback
// (use-explore-agents-for-search) say to dispatch parallel Explore agents for
// multi-file investigation — but docs-in-context weren't changing in-the-moment
// behavior, so this enforces the *check* at the harness level.
//
// It is a NUDGE, not a block, and deliberately does NOT fire constantly:
//   - Stateful per-session streak counter (keyed by session_id).
//   - Counts only search/investigation tools (Grep, Glob, search-style Bash).
//     Read is intentionally excluded — reading specific files is normal focused
//     work and would make this fire on everything.
//   - Dispatching an Agent/Task RESETS the streak (that's the behavior we want).
//   - A quiet gap (> WINDOW_MS) starts a fresh streak.
//   - Fires ONCE per streak, at THRESHOLD.
// Non-blocking; always exits 0.
const fs = require("fs");
const path = require("path");

const THRESHOLD = 4; // search calls in one streak before nudging
const WINDOW_MS = 10 * 60_000; // a gap longer than this starts a fresh streak

let data;
try {
  data = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const tool = data.tool_name || "";
const session = data.session_id || "default";
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateFile = path.join(projectDir, ".claude", ".parallel-nudge.json");

const isAgent = /^(Agent|Task)$/.test(tool);
function isSearch() {
  if (tool === "Grep" || tool === "Glob") return true;
  if (tool === "Bash") {
    // Count only investigation-style shell commands, not builds/git/installs.
    const cmd = data.tool_input?.command || "";
    return /(^|[\s|;&(])(grep|rg|ripgrep|ag|ack|find)\b/.test(cmd);
  }
  return false;
}

let all = {};
try {
  all = JSON.parse(fs.readFileSync(stateFile, "utf8")) || {};
} catch {
  all = {};
}
const now = Date.now();
let s = all[session];
if (!s || now - (s.ts || 0) > WINDOW_MS) s = { count: 0, fired: false };

// An Agent/Task dispatch is exactly the action we're nudging toward — reset.
if (isAgent) {
  all[session] = { count: 0, fired: false, ts: now };
  try {
    fs.writeFileSync(stateFile, JSON.stringify(all));
  } catch {
    /* best-effort */
  }
  process.exit(0);
}

let nudge = null;
if (isSearch()) {
  s.count += 1;
  if (s.count >= THRESHOLD && !s.fired) {
    s.fired = true;
    nudge =
      `🔀 Parallel-agents check: ${s.count} read-only search/investigation ` +
      `calls this streak with no Agent dispatched. If this is a multi-file ` +
      `investigation (your rule of thumb: 3+ greps or 2+ packages/subsystems), ` +
      `pull up superpowers:dispatching-parallel-agents and decide whether to ` +
      `fan out parallel Explore agents instead of chaining searches in the main ` +
      `context (CLAUDE.md §1.5 + saved feedback). Ignore this if it's a focused ` +
      `single-target lookup.`;
  }
}
s.ts = now;
all[session] = s;
try {
  fs.writeFileSync(stateFile, JSON.stringify(all));
} catch {
  /* best-effort */
}

if (nudge) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: nudge,
      },
    }),
  );
}
process.exit(0);
