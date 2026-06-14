// PreToolUse hook (matcher: Bash): guard dangerous shell commands.
//
// One Node spawn per Bash call. Rules run in order; the FIRST match decides.
// Each rule returns { action: "deny" | "ask", reason } or null (no opinion).
// Edit the RULES array to change behavior — the plumbing below stays as-is.
//
// Detection matches `git <verb>` as a real SUBCOMMAND (git, then git-level
// flags, then the verb) — NOT mere co-occurrence of the words. This avoids
// false positives like `rm -f .../guard-git-push.js` looking like a push.
//
// Sources for these rules (project memory / tasks/lessons.md):
//  - "never push without explicit ask" + commit->push develop->merge to main
//  - force-push / reset --hard / checkout -- discard work (built-in git policy)
//  - "next build clobbers dev .next -> ENOENT 500s; builds must use NEXT_DIST_DIR"
//  - "check untracked files before push" (tracked files import untracked siblings)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const data = JSON.parse(fs.readFileSync(0, "utf8"));
const command = (data.tool_input?.command || "").trim();

// Return the argument string after `git <verb>`, or null if this command does
// not invoke that git subcommand. Robust against false positives:
//  - splits on shell separators (&& || ; |) so only command-position git counts
//  - strips quoted strings so `grep "git push"` / `commit -m "push it"` don't fire
//  - the segment must START with `git` (after env-var assignments), so the verb
//    is a real subcommand, not a word inside another command's arguments
// Remove quoted substrings so search terms / messages / echoed text containing
// dangerous tokens (e.g. echo "rm -rf /") never trip a rule.
function stripQuotes(s) {
  return s.replace(/"[^"]*"/g, " ").replace(/'[^']*'/g, " ");
}

function gitSegments(cmd) {
  return cmd
    .split(/&&|\|\||;|\|/)
    .map((s) =>
      stripQuotes(s)
        .trim()
        .replace(/^(?:\w+=\S+\s+)+/, ""),
    )
    .filter((s) => /^git(\s|$)/.test(s));
}

function gitSubArgs(cmd, verb) {
  for (const seg of gitSegments(cmd)) {
    const m = seg.match(new RegExp(`(?:^|\\s)${verb}\\b(.*)$`));
    if (m) return m[1]; // everything after the verb token
  }
  return null;
}

function gitDir() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return path.join(projectDir, ".git");
}

function currentBranch() {
  try {
    const head = fs.readFileSync(path.join(gitDir(), "HEAD"), "utf8").trim();
    const m = head.match(/ref:\s*refs\/heads\/(.+)$/);
    return m ? m[1] : "(detached HEAD)";
  } catch {
    return "(unknown branch)";
  }
}

function pushTargetBranch(pushArgs) {
  const tokens = pushArgs.split(/\s+/).filter((t) => t && !t.startsWith("-"));
  if (tokens.length >= 2) {
    const refspec = tokens[1];
    return refspec.includes(":") ? refspec.split(":").pop() : refspec;
  }
  return currentBranch();
}

// Untracked source files (for the check-before-push rule). Cheap, push-only.
function untrackedSourceFiles() {
  try {
    const out = execFileSync("git", ["status", "--porcelain"], {
      cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
      encoding: "utf8",
      timeout: 4000,
    });
    return out
      .split("\n")
      .filter((l) => l.startsWith("??"))
      .map((l) => l.slice(3).trim())
      .filter((f) => /^(packages|scripts)\/.*\.(ts|tsx|js|jsx)$/.test(f));
  } catch {
    return [];
  }
}

const isForce = (pushArgs) =>
  /(?:^|\s)(?:-f|--force|--force-with-lease)(?:\s|=|$)/.test(pushArgs);

// --- THE RULES (edit me) ----------------------------------------------------
const RULES = [
  // 1. Force-push: destructive, never part of the normal flow.
  function forcePush(cmd) {
    const args = gitSubArgs(cmd, "push");
    if (args === null || !isForce(args)) return null;
    return {
      action: "deny",
      reason:
        "Force-push is blocked — it is destructive and not part of the " +
        "commit -> push develop -> merge to main flow. Run it yourself if truly needed.",
    };
  },

  // 2. Any push: confirm. Encodes "never push without an explicit request",
  //    and folds in the "check untracked before push" lesson.
  function anyPush(cmd) {
    const args = gitSubArgs(cmd, "push");
    if (args === null) return null;
    const branch = pushTargetBranch(args);
    const untracked = untrackedSourceFiles();
    const onMain = /^(main|master)$/i.test(branch);
    let reason = onMain
      ? `About to push directly to '${branch}'. Usual flow is merge 'develop' into main, not a direct push. Confirm this is intended.`
      : `About to push to '${branch}'. Project rule: never push without an explicit request. Confirm this push was asked for.`;
    if (untracked.length) {
      reason += ` NOTE: ${untracked.length} untracked source file(s) present (e.g. ${untracked
        .slice(0, 3)
        .join(
          ", ",
        )}). Tracked files may import these — verify before pushing or the remote build can fail (TS2307).`;
    }
    reason +=
      " Also: have you run /pr-check (lint/build/tests/review)? It is your CI gate.";
    return { action: "ask", reason };
  },

  // 3. git reset --hard: discards uncommitted work.
  function resetHard(cmd) {
    const args = gitSubArgs(cmd, "reset");
    if (args !== null && /(?:^|\s)--hard\b/.test(args)) {
      return {
        action: "ask",
        reason:
          "`git reset --hard` discards all uncommitted changes. Confirm this is intended (consider `git stash` first).",
      };
    }
    return null;
  },

  // 4. git checkout/restore/clean that discards working-tree changes.
  function discardCheckout(cmd) {
    const checkout = gitSubArgs(cmd, "checkout");
    const restore = gitSubArgs(cmd, "restore");
    const clean = gitSubArgs(cmd, "clean");
    const discardsViaCheckout =
      checkout !== null && /(?:^|\s)(--\s|--$|\.\s*$|\.\s)/.test(checkout);
    const discardsViaRestore = restore !== null && !/--staged\b/.test(restore);
    const discardsViaClean = clean !== null && /-[a-z]*f/.test(clean);
    if (discardsViaCheckout || discardsViaRestore || discardsViaClean) {
      return {
        action: "ask",
        reason:
          "This discards working-tree changes (git checkout --/restore/clean -f) and cannot be undone. Confirm.",
      };
    }
    return null;
  },

  // 5. `next build` / frontend build without NEXT_DIST_DIR: clobbers the dev
  //    .next dir -> every route 500s. Lesson: builds MUST use .next-verify.
  function unsafeNextBuild(cmd) {
    const c = stripQuotes(cmd);
    const isFrontendBuild =
      /\bnext\s+build\b/.test(c) ||
      /\bnpm\s+run\s+build:frontend\b/.test(c) ||
      /\bnpm\s+run\s+build\b(?!:)/.test(c); // root build runs build:frontend
    if (!isFrontendBuild) return null;
    if (/NEXT_DIST_DIR\s*=/.test(c)) return null; // already safe
    return {
      action: "ask",
      reason:
        "A default `next build` overwrites the running dev server's `.next` dir " +
        "(removes routes-manifest.json) -> every route returns 500. Per lessons, " +
        "set NEXT_DIST_DIR=.next-verify for builds, or kill the dev server first.",
    };
  },

  // 6. Recursive rm targeting a CATASTROPHIC path only (filesystem/drive root,
  //    home, current/parent dir, .git). Specific subpaths — relative OR absolute
  //    like /d/projects/.../.next — are routine cleanup and allowed silently.
  function dangerousRm(cmd) {
    const c = stripQuotes(cmd);
    if (!/\brm\s+(?:-\S*r\S*|--recursive)\b/.test(c)) return null; // not recursive
    const isCatastrophic = (t) =>
      /^\/\*?$/.test(t) || // /  or  /*
      /^[A-Za-z]:[\\/]?$/.test(t) || // C:  C:\  C:/
      /^\/[A-Za-z]\/?$/.test(t) || // /c  /d  (Git-Bash drive mount root)
      t === "~" ||
      t === "~/" ||
      /^\$\{?HOME\}?\/?$/.test(t) || // $HOME  ${HOME}
      t === "." ||
      t === "./" ||
      t === ".." ||
      t === "../" ||
      /(^|\/)\.git\/?$/.test(t); // the .git dir
    const targets = c
      .slice(c.search(/\brm\b/))
      .split(/\s+/)
      .filter((t) => t && !t.startsWith("-") && t !== "rm");
    if (targets.some(isCatastrophic)) {
      return {
        action: "deny",
        reason:
          "`rm -rf` targets a catastrophic path (filesystem/drive root, home, " +
          "current/parent dir, or .git). Blocked. Use a specific subpath or run it yourself.",
      };
    }
    return null;
  },
];
// ---------------------------------------------------------------------------

let verdict = null;
for (const rule of RULES) {
  verdict = rule(command);
  if (verdict) break;
}

if (!verdict) process.exit(0); // no rule matched -> normal permission flow

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: verdict.action, // "deny" | "ask"
      permissionDecisionReason: verdict.reason,
    },
  }),
);
process.exit(0);
