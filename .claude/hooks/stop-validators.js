// Stop hook: enforce CLAUDE.md §1.6 ("dispatch background validation agents
// after implementing"). Reads the list of source files touched this turn
// (written by record-touched-files.js), and if any were changed, blocks the
// stop once with instructions to dispatch the relevant validators.
//
// Loop-safety: if the stop is itself a continuation from this hook
// (stop_hook_active), exit immediately. The touched-files log is cleared after
// firing, so it nudges once per batch of edits, not repeatedly.
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

let files = [];
try {
  files = [
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

// Beta-coverage tripwire: if any NEW route/page/controller surface file was
// added this turn, the beta-testing surface map may be stale -> nudge to sync.
// "New" = untracked/added in git, so routine edits to existing surfaces don't fire.
function newlyAddedFiles() {
  try {
    return new Set(
      execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
        cwd: projectDir,
        encoding: "utf8",
        timeout: 4000,
      })
        .split("\n")
        .filter((l) => /^(\?\?|A)/.test(l))
        .map((l) => l.slice(3).trim()),
    );
  } catch {
    return new Set();
  }
}
const isSurface = (f) =>
  /\/app\/.*\b(page|route|layout)\.(tsx?|jsx?)$/.test(f) ||
  /\.controller\.ts$/.test(f);
const added = newlyAddedFiles();
const newSurfaces = files.filter((f) => isSurface(f) && added.has(f));

// Clear the log so this fires once per batch of edits.
try {
  fs.writeFileSync(logPath, "");
} catch {
  /* best-effort */
}

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
