// PostToolUse hook: Auto-lint edited files with ESLint --fix
const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const input = fs.readFileSync(0, "utf8");
const data = JSON.parse(input);

const filePath = data.tool_input?.file_path || "";

if (!filePath || !fs.existsSync(filePath)) {
  process.exit(0);
}

// Only lint TypeScript/JavaScript files
if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) {
  process.exit(0);
}

// Determine which package the file belongs to for correct eslint config
const normalized = filePath.replace(/\\/g, "/");
let cwd;
if (normalized.includes("packages/backend")) {
  cwd = path.resolve(filePath.split("packages")[0], "packages/backend");
} else if (
  normalized.includes("packages/frontend") ||
  normalized.includes("packages/web")
) {
  cwd = path.resolve(filePath.split("packages")[0], "packages/frontend");
} else {
  // Root-level file, skip
  process.exit(0);
}

try {
  execSync(`npx eslint --fix "${filePath}"`, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 20000,
  });
} catch {
  // ESLint failure is non-blocking — Claude will see issues in subsequent reads
}

process.exit(0);
