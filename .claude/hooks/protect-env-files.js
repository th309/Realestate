// PreToolUse hook: Block edits to .env files
// Production/staging env vars must be set in Railway dashboard, not in code.
const fs = require('fs');

const input = fs.readFileSync(0, 'utf8');
const data = JSON.parse(input);

const filePath = data.tool_input?.file_path || '';

if (/[/\\]\.env($|\.)/.test(filePath) || filePath === '.env') {
  process.stderr.write(
    'BLOCKED: .env files must not be edited by Claude. ' +
    'Production/staging variables must be updated in the Railway dashboard. ' +
    'See CLAUDE.md Section 4.3.'
  );
  process.exit(2);
}

process.exit(0);
