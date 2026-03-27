// PreToolUse hook: Warn when editing .env files.
// If a key is updated locally, it may also need to be updated in Railway
// (production/staging). This hook reminds Claude to check, not blocks the edit.
const fs = require("fs");

const input = fs.readFileSync(0, "utf8");
const data = JSON.parse(input);

const filePath = data.tool_input?.file_path || "";

if (/[/\\]\.env($|\.)/.test(filePath) || filePath === ".env") {
  process.stderr.write(
    "REMINDER: You are editing a .env file. Local .env changes only affect " +
      "local development. If this variable also needs to be updated in " +
      "production/staging, remind the user to update it in the Railway dashboard.",
  );
}

process.exit(0);
