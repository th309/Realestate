#!/usr/bin/env bash
#
# beta-test-change-tracker.sh
# Git post-commit hook that tracks changes relevant to beta testing.
# Categorizes modified files and appends to .claude/beta-test/change-log.md
#
# Install: git config core.hooksPath scripts/hooks
#   OR:    cp scripts/hooks/beta-test-change-tracker.sh .git/hooks/post-commit && chmod +x .git/hooks/post-commit

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
LOG_FILE="${REPO_ROOT}/.claude/beta-test/change-log.md"
COMMIT_HASH="$(git rev-parse --short HEAD)"
COMMIT_MSG="$(git log -1 --pretty=%s)"
COMMIT_DATE="$(git log -1 --pretty=%ci | cut -d' ' -f1)"

# Ensure directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Get changed files in this commit
CHANGED_FILES="$(git diff-tree --no-commit-id --name-only -r HEAD)"

# Categorization functions
has_changes_in() {
  echo "$CHANGED_FILES" | grep -q "$1" 2>/dev/null
}

count_changes_in() {
  echo "$CHANGED_FILES" | grep -c "$1" 2>/dev/null || echo "0"
}

# Build entry
ENTRY="### ${COMMIT_DATE} — \`${COMMIT_HASH}\` ${COMMIT_MSG}\n"
HAS_RELEVANT=false

# Routes / Pages
if has_changes_in "packages/frontend/app.*page\.tsx"; then
  NEW_PAGES=$(echo "$CHANGED_FILES" | grep "packages/frontend/app.*page\.tsx" || true)
  ENTRY+="- **Routes:** $(count_changes_in 'page\.tsx') page(s) changed\n"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    ENTRY+="  - \`${f}\`\n"
  done <<< "$NEW_PAGES"
  HAS_RELEVANT=true
fi

# API Endpoints (controllers)
if has_changes_in "packages/backend/src.*controller\.ts"; then
  ENTRY+="- **API Endpoints:** $(count_changes_in 'controller\.ts') controller(s) changed\n"
  echo "$CHANGED_FILES" | grep "controller\.ts" | while IFS= read -r f; do
    ENTRY+="  - \`${f}\`\n"
  done
  HAS_RELEVANT=true
fi

# Data Layer (fetchers, hooks, registry)
if has_changes_in "packages/frontend/lib/data"; then
  ENTRY+="- **Data Layer:** $(count_changes_in 'packages/frontend/lib/data') file(s) changed\n"
  HAS_RELEVANT=true
fi

# Metric Resolution / Fallbacks
if has_changes_in "metric-resolution"; then
  ENTRY+="- **Metric Resolution:** Fallback chains, source fetching, or geo inheritance changed\n"
  echo "$CHANGED_FILES" | grep "metric-resolution" | while IFS= read -r f; do
    ENTRY+="  - \`${f}\`\n"
  done
  HAS_RELEVANT=true
fi

# Entitlements / Gating
if has_changes_in "entitlements"; then
  ENTRY+="- **Entitlements/Gating:** $(count_changes_in 'entitlements') file(s) changed\n"
  HAS_RELEVANT=true
fi

# Scoring
if has_changes_in "scoring"; then
  ENTRY+="- **Scoring:** $(count_changes_in 'scoring') file(s) changed\n"
  HAS_RELEVANT=true
fi

# Admin pages
if has_changes_in "packages/frontend/app/admin"; then
  ENTRY+="- **Admin Pages:** $(count_changes_in 'app/admin') file(s) changed\n"
  HAS_RELEVANT=true
fi

# Backend services
if has_changes_in "packages/backend/src.*service\.ts"; then
  ENTRY+="- **Backend Services:** $(count_changes_in 'service\.ts') service(s) changed\n"
  HAS_RELEVANT=true
fi

# Auth / Middleware
if has_changes_in "middleware\.ts\|auth"; then
  ENTRY+="- **Auth/Middleware:** Authentication or route protection changed\n"
  HAS_RELEVANT=true
fi

# Pipelines / Scripts
if has_changes_in "scripts/"; then
  ENTRY+="- **Data Pipelines:** $(count_changes_in 'scripts/') script(s) changed\n"
  HAS_RELEVANT=true
fi

# Config changes (metrics, registry)
if has_changes_in "config/metrics\|registry"; then
  ENTRY+="- **Metric Config:** Registry or metric configuration changed\n"
  HAS_RELEVANT=true
fi

# UI Components (non-page)
if has_changes_in "packages/frontend/components"; then
  ENTRY+="- **UI Components:** $(count_changes_in 'packages/frontend/components') component(s) changed\n"
  HAS_RELEVANT=true
fi

# Only write if relevant changes found
if [ "$HAS_RELEVANT" = true ]; then
  ENTRY+="\n"

  # Create file with header if it doesn't exist
  if [ ! -f "$LOG_FILE" ]; then
    cat > "$LOG_FILE" << 'HEADER'
# Beta Test Change Log

Auto-populated by git post-commit hook. Read by `beta-testing-propertyiq` skill Phase 0
and `sync-beta-test-coverage` skill.

Each entry shows what changed and which testing areas are affected.

---

HEADER
  fi

  # Prepend new entry (after header)
  TEMP_FILE=$(mktemp)
  # Keep first 8 lines (header), insert new entry, then rest
  head -n 8 "$LOG_FILE" > "$TEMP_FILE"
  echo -e "$ENTRY" >> "$TEMP_FILE"
  tail -n +9 "$LOG_FILE" >> "$TEMP_FILE"
  mv "$TEMP_FILE" "$LOG_FILE"
fi

exit 0
