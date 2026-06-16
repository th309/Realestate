#!/usr/bin/env bash
#
# release-to-main.sh — Codifies the develop -> main release with a MANDATORY
# back-merge, so develop can never silently fall behind main again.
#
# WHY THIS EXISTS:
#   Merging develop into main with --no-ff creates a merge commit that lives
#   ONLY on main. Without an immediate back-merge into develop, develop's branch
#   pointer falls one commit behind main on every release. Done by hand, that
#   back-merge is easy to forget; over many releases develop drifts "N commits
#   behind" main even though every line of code is identical. This script makes
#   the back-merge impossible to skip and verifies the two branches end on an
#   identical tree.
#
# USAGE:
#   bash scripts/git/release-to-main.sh "restore monthly-17th cadence"
#       Merge develop into main, then back-merge main into develop — LOCALLY.
#       Prints the push command. Does NOT push (your push, your call).
#
#   bash scripts/git/release-to-main.sh "restore monthly-17th cadence" --push
#       Same, then pushes BOTH main and develop to origin.
#
#   bash scripts/git/release-to-main.sh --sync-only [--push]
#       Skip the merge; just fast-forward develop up to origin/main. Use when the
#       develop->main merge already happened elsewhere (GitHub UI, another machine).
#
set -euo pipefail

DESC=""
DO_PUSH=0
SYNC_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --push)      DO_PUSH=1 ;;
    --sync-only) SYNC_ONLY=1 ;;
    --*)         echo "Unknown flag: $arg" >&2; exit 2 ;;
    *)           DESC="$arg" ;;
  esac
done

say() { echo ""; echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

# --- Guard: no uncommitted changes to TRACKED files (untracked files are fine) ---
if ! git diff --quiet || ! git diff --cached --quiet; then
  die "Uncommitted changes to tracked files. Commit or stash before releasing."
fi

say "Fetching origin..."
git fetch origin --quiet

# --- Guard: local develop must not be BEHIND origin/develop ---
if ! git merge-base --is-ancestor origin/develop develop; then
  die "Local develop is behind origin/develop. Run: git checkout develop && git pull --ff-only"
fi

if [ "$SYNC_ONLY" -eq 1 ]; then
  MAIN_REF="origin/main"
  PUSH_REFS="develop"
  say "Sync-only: fast-forwarding develop up to origin/main..."
  git checkout develop --quiet
  if ! git merge --ff-only origin/main; then
    die "develop cannot fast-forward to origin/main (develop has commits main lacks). Run a full release instead: drop --sync-only and pass a description."
  fi
  # Keep the local main pointer tidy, but only ever move it FORWARD.
  if git merge-base --is-ancestor main origin/main 2>/dev/null; then
    git branch -f main origin/main >/dev/null 2>&1 || true
  fi
else
  MAIN_REF="main"
  PUSH_REFS="main develop"
  [ -n "$DESC" ] || die "Provide a merge description, e.g.: bash scripts/git/release-to-main.sh \"what changed\""

  say "Bringing local main up to date with origin/main..."
  git checkout main --quiet
  git merge --ff-only origin/main --quiet || die "Local main has diverged from origin/main. Reconcile manually before releasing."

  say "Merging develop into main (--no-ff)..."
  git merge --no-ff develop -m "Merge develop into main: ${DESC}"

  say "Back-merging main into develop (fast-forward)..."
  git checkout develop --quiet
  git merge --ff-only main --quiet || die "Back-merge was not a fast-forward (unexpected graph state). Inspect manually."
fi

# --- Verify: develop and main now point at IDENTICAL trees (fail loud on drift) ---
DEV_TREE="$(git rev-parse 'develop^{tree}')"
MAIN_TREE="$(git rev-parse "${MAIN_REF}^{tree}")"
[ "$DEV_TREE" = "$MAIN_TREE" ] || die "develop and ${MAIN_REF} trees differ after sync (${DEV_TREE:0:12} vs ${MAIN_TREE:0:12}). Inspect manually."

say "In sync: develop and ${MAIN_REF} share tree ${DEV_TREE:0:12}."
echo "  develop: $(git --no-pager log --oneline -1 develop)"
echo "  ${MAIN_REF}: $(git --no-pager log --oneline -1 "${MAIN_REF}")"

if [ "$DO_PUSH" -eq 1 ]; then
  say "Pushing ${PUSH_REFS} to origin..."
  git push origin ${PUSH_REFS}
  say "Done. Published and in sync."
else
  echo ""
  echo "Local merges complete. Nothing pushed yet. To publish, run:"
  echo "    git push origin ${PUSH_REFS}"
fi
