// SessionStart hook: inject tasks/lessons.md into context automatically.
//
// CLAUDE.md §2.2 ("Read tasks/lessons.md at session start") is an instruction
// Claude must remember to follow. This hook makes it structural: the hard-won
// rules are injected every time a session starts, resumes, or compacts, so they
// are never silently skipped.
const fs = require("fs");
const path = require("path");

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const lessonsPath = path.join(projectDir, "tasks", "lessons.md");

let lessons = "";
try {
  lessons = fs.readFileSync(lessonsPath, "utf8").trim();
} catch {
  // No lessons file yet — nothing to inject. Exit clean so the session
  // start is never blocked by this hook.
  process.exit(0);
}

if (!lessons) process.exit(0);

const additionalContext =
  "The following hard-won lessons are from tasks/lessons.md (CLAUDE.md §2.2 " +
  "requires reading these at session start). Treat them as binding project rules:\n\n" +
  lessons;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext,
    },
  }),
);

process.exit(0);
