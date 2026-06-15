// Stop hook: enforce CLAUDE.md §1.6 ("dispatch background validation agents
// after implementing"). Reads the list of source files touched this turn
// (written by record-touched-files.js) and, for the ones still genuinely dirty
// in the working tree, blocks the stop once with instructions to dispatch the
// relevant validators.
//
// The touched-files log is shared with parallel subagents and can accumulate
// entries for files that were committed (by another agent or this turn) or
// never really changed. So every logged file is cross-checked against a single
// `git status` pass — clean/committed files are dropped, preventing false
// validator dispatches.
//
// Loop-safety: if the stop is itself a continuation from this hook
// (stop_hook_active), exit immediately. The log is cleared after each fire.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

let data = {};
try {
  data = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

// Already continuing because of this hook -> let the stop proceed.
if (data.stop_hook_active) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const logPath = path.join(projectDir, ".claude", ".touched-files");

let logged = [];
try {
  logged = [
    ...new Set(
      fs
        .readFileSync(logPath, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  ];
} catch {
  process.exit(0); // nothing recorded -> nothing to validate
}
if (!logged.length) process.exit(0);

// One `git status` pass -> which paths are actually dirty, and which are NEW
// (untracked/added). Used to drop clean entries and to power the surface tripwire.
function gitStatus() {
  const dirty = new Set();
  const added = new Set();
  try {
    const out = execFileSync(
      "git",
      ["status", "--porcelain", "--untracked-files=all"],
      { cwd: projectDir, encoding: "utf8", timeout: 4000 },
    );
    for (const line of out.split("\n")) {
      if (!line.trim()) continue;
      const code = line.slice(0, 2);
      const p = (
        line.includes(" -> ") ? line.split(" -> ").pop() : line.slice(3)
      ).trim();
      dirty.add(p);
      if (/[?A]/.test(code)) added.add(p);
    }
  } catch {
    /* not a git repo / git unavailable -> empty sets */
  }
  return { dirty, added };
}
const { dirty, added } = gitStatus();

// Clear the log now (fires once per batch regardless of outcome).
try {
  fs.writeFileSync(logPath, "");
} catch {
  /* best-effort */
}

// Only files genuinely modified in the working tree count. Drops clean/committed
// entries (e.g. recorded by a parallel subagent, or already committed this turn).
const files = logged.filter((f) => dirty.has(f));
if (!files.length) process.exit(0);

// Map changed paths -> the validators from CLAUDE.md §1.6 trigger table.
const agents = new Set(["code-reviewer"]); // always review changed code
const joined = files.join("\n");
if (/packages\/backend\/.*\.controller\.ts$/m.test(joined))
  agents.add("dto-validation-auditor");
if (/(auth|payment|stripe|billing|secret|webhook|entitlement)/i.test(joined))
  agents.add("security-reviewer");
if (/packages\/frontend\/.*(lib\/data|fetcher|\/hooks\/|use[A-Z])/.test(joined))
  agents.add("data-layer-reviewer");

// Beta-coverage tripwire: a NEW route/page/controller surface file means the
// beta-testing surface map may be stale -> nudge to sync.
const isSurface = (f) =>
  /\/app\/.*\b(page|route|layout)\.(tsx?|jsx?)$/.test(f) ||
  /\.controller\.ts$/.test(f);
const newSurfaces = files.filter((f) => isSurface(f) && added.has(f));

const fileList = files.slice(0, 6).join(", ") + (files.length > 6 ? ", …" : "");
let reason =
  `This turn modified source files (${files.length}): ${fileList}. ` +
  `Per CLAUDE.md §1.6, dispatch these validation agents in the BACKGROUND ` +
  `before finishing (Agent tool, run_in_background: true): ${[...agents].join(", ")}. ` +
  `Surface only CRITICAL/WARNING findings; do not report "all passed".`;
if (newSurfaces.length) {
  reason +=
    ` Also: new surface file(s) added (${newSurfaces.slice(0, 3).join(", ")}) — ` +
    `beta coverage may be stale; consider running /sync-beta-test-coverage.`;
}

process.stdout.write(JSON.stringify({ decision: "block", reason }));
process.exit(0);
