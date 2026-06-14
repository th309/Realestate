// Permanent regression suite for the .claude/hooks/* guards.
//
// WHY THIS FILE EXISTS: guard-bash.js is live, so a Bash command whose TEXT
// contains a real `git push` / `rm -rf /` is intercepted by the guard before it
// runs. That makes it impossible to test hook logic with inline shell. This
// suite keeps every dangerous fixture as STRING DATA inside this file and feeds
// it to the hooks over stdin via execFileSync — so the only shell command you
// ever run is the clean, harmless:
//
//     node .claude/hooks/__tests__/run-tests.js
//
// Exit code 0 = all pass, 1 = a failure (so it can gate CI / a pre-push check).
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const hooksDir = path.join(__dirname, "..");
const projectDir = path.join(__dirname, "..", "..", "..");
const env = { ...process.env, CLAUDE_PROJECT_DIR: projectDir };
const logPath = path.join(projectDir, ".claude", ".touched-files");

function run(hook, payload) {
  try {
    return execFileSync("node", [path.join(hooksDir, hook)], {
      input: JSON.stringify(payload),
      env,
      encoding: "utf8",
    });
  } catch (e) {
    return e.stdout || "";
  }
}
const decision = (out) =>
  out.trim()
    ? JSON.parse(out).hookSpecificOutput.permissionDecision.toUpperCase()
    : "ALLOW";
const context = (out) =>
  out.trim() ? JSON.parse(out).hookSpecificOutput.additionalContext : "";
const reason = (out) => (out.trim() ? JSON.parse(out).reason : "");

let pass = 0;
const fails = [];
function ok(label, cond) {
  if (cond) pass++;
  else fails.push(label);
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}`);
}

const tmpDirs = [
  "packages/backend/__ht__",
  "packages/frontend/__ht__",
  "packages/frontend/app/__ht__",
  "packages/frontend/lib/data/__ht__",
];
const wipe = () => {
  tmpDirs.forEach((d) =>
    fs.rmSync(path.join(projectDir, d), { recursive: true, force: true }),
  );
  fs.rmSync(logPath, { force: true });
};

try {
  // ---- guard-bash (PreToolUse Bash) ----
  const gb = (cmd) =>
    decision(run("guard-bash.js", { tool_input: { command: cmd } }));
  [
    [
      "FP rm of guard filename",
      "rm -f .claude/hooks/guard-git-push.js",
      "ALLOW",
    ],
    ["FP grep quoted push", 'grep -rn "git push" docs/', "ALLOW"],
    ["FP commit msg push", 'git commit -m "ready to push"', "ALLOW"],
    ["FP echo rm -rf /", 'echo "rm -rf /"', "ALLOW"],
    ["push develop", "git push origin develop", "ASK"],
    ["force push", "git push -f origin develop", "DENY"],
    ["git -c flag then push", "git -c core.x=1 push origin develop", "ASK"],
    ["compound force push", "cd packages/frontend && git push --force", "DENY"],
    ["reset --hard", "git reset --hard HEAD~1", "ASK"],
    ["checkout -- file", "git checkout -- src/x.ts", "ASK"],
    ["restore --staged (safe)", "git restore --staged src/x.ts", "ALLOW"],
    ["unsafe frontend build", "npm run build:frontend", "ASK"],
    [
      "safe build (NEXT_DIST_DIR)",
      "NEXT_DIST_DIR=.next-verify npm run build:frontend",
      "ALLOW",
    ],
    ["rm -rf .next (relative)", "rm -rf .next", "ALLOW"],
    [
      "rm -rf abs project path",
      "rm -rf /d/projects/rei-platform/.next",
      "ALLOW",
    ],
    ["rm -rf / (root)", "rm -rf /", "DENY"],
    ["rm -rf /d (drive root)", "rm -rf /d", "DENY"],
    ["rm -rf ~ (home)", "rm -rf ~", "DENY"],
    ["rm -rf .git", "rm -rf .git", "DENY"],
    ["rm -rf . (cwd)", "rm -rf .", "DENY"],
    ["npm test", "npm test", "ALLOW"],
  ].forEach(([l, c, e]) => ok(`guard-bash: ${l}`, gb(c) === e));

  // ---- content-guards (PostToolUse Edit|Write) ----
  const cg = (rel, content) => {
    const abs = path.join(projectDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    return context(
      run("content-guards.js", { tool_input: { file_path: abs } }),
    );
  };
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  })();
  const cgCases = [
    [
      "secret fallback (config.get)",
      "packages/backend/__ht__/a.ts",
      "const u = this.config.get('FRONTEND_URL') || 'https://x.app';",
      "No Defaults",
    ],
    [
      "secret fallback (env)",
      "packages/backend/__ht__/b.ts",
      "const k = process.env.STRIPE_SECRET_KEY || 'sk';",
      "No Defaults",
    ],
    [
      "clean PORT default ok",
      "packages/backend/__ht__/c.ts",
      "const n = process.env.PORT || 3001;",
      "",
    ],
    [
      "service_role in client",
      "packages/frontend/__ht__/d.tsx",
      "'use client'\nconst s = process.env.SUPABASE_SERVICE_ROLE_KEY;",
      "CRITICAL",
    ],
    [
      "service_role server ok",
      "packages/frontend/__ht__/e.tsx",
      "const s = process.env.SERVICE_ROLE_KEY;",
      "",
    ],
    [
      "test file excluded",
      "packages/backend/__ht__/f.test.ts",
      "const k = process.env.API_KEY || 'x';",
      "",
    ],
    [
      "migration no GRANT + backdated",
      "packages/backend/__ht__/migrations/20200101_x.sql",
      "CREATE TABLE foo (id int);",
      "GRANT",
    ],
    [
      "migration good",
      `packages/backend/__ht__/migrations/${today}_y.sql`,
      "CREATE TABLE foo (id int);\nGRANT ALL ON foo TO service_role;",
      "",
    ],
    [
      "data-layer direct fetch",
      "packages/frontend/app/__ht__/x.tsx",
      "const r = await fetch(`${API_URL}/api/x`);",
      "data-layer-check",
    ],
    [
      "data-layer client import",
      "packages/frontend/__ht__/y.tsx",
      'import { foo } from "@/lib/api/client";',
      "data-layer-check",
    ],
    [
      "data-layer lib/data exempt",
      "packages/frontend/lib/data/__ht__/z.ts",
      "const r = await fetch(`${API_URL}/api/x`);",
      "",
    ],
    [
      "swagger undocumented",
      "packages/backend/__ht__/m.controller.ts",
      "@Controller('m')\nclass M { @Get() l() {} }",
      "gen-swagger",
    ],
    [
      "swagger documented",
      "packages/backend/__ht__/n.controller.ts",
      "@Controller('n')\nclass N { @ApiOperation({}) @Get() l() {} }",
      "",
    ],
  ];
  for (const [l, rel, content, sub] of cgCases) {
    const ctx = cg(rel, content);
    ok(`content-guards: ${l}`, sub ? ctx.includes(sub) : ctx === "");
  }

  // ---- record-touched-files (PostToolUse) ----
  const record = (rel) =>
    run("record-touched-files.js", {
      tool_input: { file_path: path.join(projectDir, rel) },
    });
  fs.rmSync(logPath, { force: true });
  record("packages/backend/src/x.controller.ts");
  record("packages/backend/src/y.test.ts"); // ignored (test)
  record("README.md"); // ignored (not source)
  const logged = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
  ok("record: source logged", logged.includes("x.controller.ts"));
  ok("record: test excluded", !/y\.test\.ts/.test(logged));
  ok("record: doc excluded", !/README/.test(logged));

  // ---- stop-validators (Stop) ----
  fs.writeFileSync(
    logPath,
    "packages/backend/src/billing/billing.controller.ts\npackages/frontend/lib/data/fetchers/f.ts\n",
  );
  const r1 = reason(run("stop-validators.js", { stop_hook_active: false }));
  ok("stop: code-reviewer", r1.includes("code-reviewer"));
  ok(
    "stop: dto-validation (controller)",
    r1.includes("dto-validation-auditor"),
  );
  ok("stop: security (billing)", r1.includes("security-reviewer"));
  ok("stop: data-layer (lib/data)", r1.includes("data-layer-reviewer"));
  ok("stop: log cleared after fire", fs.readFileSync(logPath, "utf8") === "");

  fs.writeFileSync(logPath, "packages/backend/src/x.controller.ts\n");
  ok(
    "stop: loop guard allows (stop_hook_active)",
    run("stop-validators.js", { stop_hook_active: true }).trim() === "",
  );

  const surf = "packages/frontend/app/__ht__/page.tsx";
  fs.mkdirSync(path.join(projectDir, path.dirname(surf)), { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, surf),
    "export default function P(){return null}",
  );
  fs.writeFileSync(logPath, surf + "\n");
  ok(
    "stop: new-surface tripwire",
    reason(run("stop-validators.js", { stop_hook_active: false })).includes(
      "sync-beta-test-coverage",
    ),
  );

  // ---- context injectors (smoke) ----
  ok(
    "inject-branch: emits branch",
    context(run("inject-branch.js", {})).toLowerCase().includes("branch"),
  );
  ok(
    "inject-lessons: emits lessons",
    context(run("inject-lessons.js", {})).length > 0,
  );
} finally {
  wipe();
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log("FAILURES:\n  " + fails.join("\n  "));
  process.exit(1);
}
