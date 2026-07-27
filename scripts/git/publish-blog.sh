#!/usr/bin/env bash
#
# publish-blog.sh — One-command blog publishing: takes new/changed/deleted MDX in
# packages/frontend/content/blog from the local develop working tree to the live
# site, WITHOUT shipping whatever code happens to be sitting on develop.
#
# WHY THIS EXISTS:
#   The blog is filesystem-as-CMS: production serves a baked build, so a post goes
#   live only via commit -> push main -> Railway rebuild. A full release:main is the
#   wrong vehicle for content because it merges ALL of develop. This script commits
#   content ONLY, directly onto main via a temporary worktree (your working tree
#   never switches branches), then back-merges so develop never drifts behind main.
#
# USAGE:
#   npm run blog:publish                    # validate, commit, push main, verify live
#   npm run blog:publish -- --dry-run       # validate + print the plan; mutate nothing
#   npm run blog:publish -- --no-verify-live  # skip polling the live site
#
# Running WITHOUT --dry-run is explicit consent to push origin/main.
# develop is NEVER pushed (your other WIP commits stay local).
set -euo pipefail

BLOG_DIR="packages/frontend/content/blog"
LIVE_BASE="https://www.propertyiq.app/blog"
DRY_RUN=0
VERIFY_LIVE=1

for arg in "$@"; do
  case "$arg" in
    --dry-run)        DRY_RUN=1 ;;
    --no-verify-live) VERIFY_LIVE=0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

say() { echo ""; echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

# Parallel Claude sessions share this repo; index.lock contention is transient.
retry_git() {
  local attempt
  for attempt in 1 2 3 4; do
    if "$@"; then return 0; fi
    sleep 1
  done
  "$@"
}

# --- Guards -------------------------------------------------------------------
BRANCH="$(git branch --show-current)"
[ "$BRANCH" = "develop" ] || die "Must run from develop (currently on '$BRANCH')."

say "Fetching origin..."
git fetch origin --quiet

git merge-base --is-ancestor origin/develop develop \
  || die "Local develop is behind origin/develop. Run: git pull --ff-only"

# --- Collect top-level MDX changes (drafts/ never publishes) ------------------
ADDED=() MODIFIED=() DELETED=() SKIPPED_FUTURE=()
while IFS= read -r line; do
  [ -n "$line" ] || continue
  status="${line:0:2}"
  file="${line:3}"
  file="${file#\"}"; file="${file%\"}"           # porcelain may quote paths
  case "$file" in
    "$BLOG_DIR"/*/*) continue ;;                 # subdirs (drafts/) excluded
    "$BLOG_DIR"/*.mdx) ;;
    *) continue ;;
  esac
  case "$status" in
    "??") ADDED+=("$file") ;;
    *D*)  DELETED+=("$file") ;;
    *M*|*A*) MODIFIED+=("$file") ;;
  esac
done < <(git status --porcelain -- "$BLOG_DIR")

if [ "${#ADDED[@]}" -eq 0 ] && [ "${#MODIFIED[@]}" -eq 0 ] && [ "${#DELETED[@]}" -eq 0 ]; then
  say "Nothing to publish: no changed .mdx at the top level of $BLOG_DIR."
  exit 0
fi

# --- Validate added/modified posts --------------------------------------------
TODAY="$(date +%F)"
PUBLISH=()   # files that will actually be committed
frontmatter() { awk '/^---[[:space:]]*$/{c++; next} c==1{print} c>=2{exit}' "$1"; }

for file in ${ADDED[@]+"${ADDED[@]}"} ${MODIFIED[@]+"${MODIFIED[@]}"}; do
  fm="$(frontmatter "$file")"
  echo "$fm" | grep -q '^title:' || die "$file: frontmatter is missing 'title:'."
  post_date="$(echo "$fm" | sed -n 's/^date:[[:space:]]*"\{0,1\}\([0-9][0-9-]*\)"\{0,1\}.*/\1/p' | head -1)"
  [ -n "$post_date" ] || die "$file: frontmatter is missing a parseable 'date:' (expected YYYY-MM-DD)."

  # getAllPosts() hides future-dated posts; publishing one would silently no-op.
  if [[ "$post_date" > "$TODAY" ]]; then
    SKIPPED_FUTURE+=("$file (dated $post_date)")
    continue
  fi

  # Retired coverage-count claims are a hard fail (see CLAUDE.md §9: use COVERAGE_COPY).
  if match="$(grep -nE '400\+[[:space:]]+(markets|metros)|(3,150|34,000|33,000|925)[^.]{0,40}(markets|metros|counties|ZIP|zip)' "$file" | head -3)"; then
    die "$file contains retired coverage claims — source counts from COVERAGE_COPY instead:
$match"
  fi
  PUBLISH+=("$file")
done
PUBLISH+=(${DELETED[@]+"${DELETED[@]}"})

# --- Report the plan ----------------------------------------------------------
say "Publish plan:"
for f in ${PUBLISH[@]+"${PUBLISH[@]}"}; do echo "   publish: $f"; done
for f in ${SKIPPED_FUTURE[@]+"${SKIPPED_FUTURE[@]}"}; do echo "   SKIPPED (future-dated, will not render): $f"; done
[ "${#PUBLISH[@]}" -gt 0 ] || die "All candidate posts were skipped; nothing publishable."

slugs_of() { for f in "$@"; do basename "$f" .mdx; done; }
NEW_SLUGS=($(slugs_of ${ADDED[@]+"${ADDED[@]}"}))
ALL_SLUGS=($(slugs_of ${PUBLISH[@]+"${PUBLISH[@]}"}))

if [ "$DRY_RUN" -eq 1 ]; then
  say "Dry run: no commits, no push. Re-run without --dry-run to publish."
  exit 0
fi

# --- Commit on develop (atomic pathspec; never sweeps parallel WIP) -----------
say "Committing content to develop..."
retry_git git add -- "${PUBLISH[@]}"
retry_git git commit -m "content(blog): publish ${ALL_SLUGS[*]}" -- "${PUBLISH[@]}"

# --- Publish onto main via a temporary worktree -------------------------------
# Local main ahead of origin/main usually means a release is STAGED (release:main
# without --push). Publishing now would push that whole release along with the blog.
git merge-base --is-ancestor main origin/main 2>/dev/null \
  || die "Local main has commits origin/main lacks (a staged, unpushed release?).
Push or discard that release first, then re-run. Blog commit on develop is kept."

say "Publishing to main via temporary worktree..."
git branch -f main origin/main 2>/dev/null || true   # forward-only; ancestry verified above
WT="$(mktemp -d)"
trap 'git worktree remove --force "$WT" 2>/dev/null || true' EXIT
git worktree add --quiet "$WT" main

# Mirror develop's tracked blog tree exactly (rm first so deletions propagate).
rm -rf "${WT:?}/$BLOG_DIR"
git -C "$WT" checkout --quiet develop -- "$BLOG_DIR"
git -C "$WT" add -A -- "$BLOG_DIR"
if git -C "$WT" diff --cached --quiet; then
  die "main already has this content; nothing to publish (develop commit kept)."
fi
git -C "$WT" commit --quiet -m "content(blog): publish ${ALL_SLUGS[*]}"

say "Pushing main to origin (Railway will rebuild)..."
git -C "$WT" push origin main

# --- Back-merge so develop contains main's publish commit ---------------------
say "Back-merging main into develop..."
retry_git git merge --no-edit --quiet main

BEHIND="$(git rev-list --count develop..origin/main)"
[ "$BEHIND" = "0" ] || die "develop is $BEHIND commits behind origin/main after back-merge. Inspect manually."
DEV_SUBTREE="$(git rev-parse "develop:$BLOG_DIR")"
MAIN_SUBTREE="$(git rev-parse "main:$BLOG_DIR")"
[ "$DEV_SUBTREE" = "$MAIN_SUBTREE" ] || die "content/blog differs between develop and main after publish. Inspect manually."

say "Published to main. develop kept local (unpushed WIP stays yours):"
echo "   main:    $(git --no-pager log --oneline -1 main)"
echo "   develop: $(git --no-pager log --oneline -1 develop)"

# --- Verify the real artifact at the destination ------------------------------
if [ "$VERIFY_LIVE" -eq 0 ]; then
  say "Skipping live verification (--no-verify-live)."
elif [ "${#NEW_SLUGS[@]}" -eq 0 ]; then
  say "No new slugs to poll (edits/deletes only). Changes appear when Railway finishes deploying (~3-5 min)."
else
  say "Waiting for Railway deploy — polling new posts (up to 10 min)..."
  DEADLINE=$(( $(date +%s) + 600 ))
  for slug in "${NEW_SLUGS[@]}"; do
    url="$LIVE_BASE/$slug"
    while :; do
      code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo 000)"
      if [ "$code" = "200" ]; then echo "   LIVE: $url"; break; fi
      [ "$(date +%s)" -lt "$DEADLINE" ] || die "Timed out waiting for $url (last status $code). Check the Railway deploy."
      sleep 20
    done
  done
  say "All new posts are live."
fi
