// PostToolUse hook: Auto-format edited files with Prettier
const fs = require('fs');
const { execSync } = require('child_process');

const input = fs.readFileSync(0, 'utf8');
const data = JSON.parse(input);

const filePath = data.tool_input?.file_path || '';

// Only format code files that exist
if (!filePath || !fs.existsSync(filePath)) {
  process.exit(0);
}

// Match file extensions Prettier supports
if (/\.(js|ts|tsx|jsx|json|css|scss|md|html|yaml|yml)$/.test(filePath)) {
  try {
    execSync(`npx prettier --write "${filePath}"`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    });
  } catch {
    // Prettier failure is non-blocking
  }
}

process.exit(0);
