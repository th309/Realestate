// UserPromptSubmit hook: inject the current git branch into context.
//
// Serves the verify-branch-before-commit lesson: parallel git ops (web/CLI)
// can fast-forward and switch the working tree silently. Re-stating the branch
// on every prompt means Claude never acts on a stale branch assumption.
// Reads .git/HEAD directly (no git spawn) to stay cheap.
const fs = require("fs");
const path = require("path");

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let branch = "(unknown)";
try {
  const head = fs
    .readFileSync(path.join(projectDir, ".git", "HEAD"), "utf8")
    .trim();
  const m = head.match(/ref:\s*refs\/heads\/(.+)$/);
  branch = m ? m[1] : `(detached at ${head.slice(0, 8)})`;
} catch {
  process.exit(0); // not a git repo / no HEAD — nothing to inject
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: `Current git branch: ${branch} (project default: develop). Verify this before any commit or push.`,
    },
  }),
);
process.exit(0);
