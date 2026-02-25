// PreToolUse hook: Block edits to lock files and generated files
const fs = require("fs");

const input = fs.readFileSync(0, "utf8");
const data = JSON.parse(input);

const filePath = data.tool_input?.file_path || "";
const normalized = filePath.replace(/\\/g, "/");
const fileName = normalized.split("/").pop();

const blockedFiles = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
];

if (blockedFiles.includes(fileName)) {
  process.stderr.write(
    `BLOCKED: "${fileName}" is a generated lock file and must not be edited directly. ` +
      "Run npm install/update to modify dependencies instead.",
  );
  process.exit(2);
}

// Block generated files
if (/metro-slug-data\.ts$/.test(normalized)) {
  process.stderr.write(
    'BLOCKED: "metro-slug-data.ts" is a generated file. Modify the generation script instead.',
  );
  process.exit(2);
}

process.exit(0);
