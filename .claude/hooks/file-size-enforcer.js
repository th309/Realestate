// PostToolUse hook: Warn when edited file exceeds CLAUDE.md line limits
const fs = require("fs");

const input = fs.readFileSync(0, "utf8");
const data = JSON.parse(input);

const filePath = data.tool_input?.file_path || "";

if (!filePath || !fs.existsSync(filePath)) {
  process.exit(0);
}

// Only check code files
if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) {
  process.exit(0);
}

const content = fs.readFileSync(filePath, "utf8");
const lineCount = content.split("\n").length;

// Determine file type and limits per CLAUDE.md Section 1.3
const normalized = filePath.replace(/\\/g, "/");
let target, hardLimit, fileType;

if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(normalized)) {
  target = 400;
  hardLimit = 500;
  fileType = "Test file";
} else if (/\.(tsx|jsx)$/.test(normalized)) {
  target = 300;
  hardLimit = 400;
  fileType = "React component";
} else {
  target = 200;
  hardLimit = 300;
  fileType = "Logic file";
}

if (lineCount > hardLimit) {
  const fileName = normalized.split("/").pop();
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `WARNING: ${fileType} "${fileName}" is ${lineCount} lines (hard limit: ${hardLimit}). Per CLAUDE.md Section 1.3, this file MUST be split. Analyze logical components and propose a refactor plan.`,
      },
    }),
  );
} else if (lineCount > target) {
  const fileName = normalized.split("/").pop();
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `Note: ${fileType} "${fileName}" is ${lineCount} lines (target: ${target}, hard limit: ${hardLimit}). Consider splitting if adding more code.`,
      },
    }),
  );
}

process.exit(0);
