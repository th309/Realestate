// PostToolUse hook (matcher: Edit|Write): record source files touched this
// session into .claude/.touched-files, so the Stop hook (stop-validators.js)
// knows WHAT changed this turn — not just what is currently dirty in git.
// Never blocks; always exits 0.
const fs = require("fs");
const path = require("path");

let data;
try {
  data = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const filePath =
  data.tool_response?.filePath || data.tool_input?.file_path || "";
if (!filePath) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const rel = path.relative(projectDir, filePath).replace(/\\/g, "/");

// Only track real source files in the app packages / scripts.
if (!/^(packages|scripts)\/.*\.(ts|tsx|js|jsx)$/.test(rel)) process.exit(0);
// Ignore tests and generated dirs — they don't need feature validators.
if (/(\.test\.|\.spec\.|\/__tests__\/|\/dist\/|\/\.next)/.test(rel))
  process.exit(0);

try {
  fs.appendFileSync(
    path.join(projectDir, ".claude", ".touched-files"),
    rel + "\n",
  );
} catch {
  // best-effort; never fail the edit
}
process.exit(0);
