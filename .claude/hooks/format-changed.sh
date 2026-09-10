#!/usr/bin/env bash
# PostToolUse hook: format the ONE file Claude just wrote/edited.
# - Per-file only. Never runs a test suite.
# - Always exits 0 (a formatter failure must never block Claude).
# - Notifications for "Claude waits for input" are handled by the GLOBAL
#   ~/.claude/settings.json Notification hook — not here.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# --- read the changed file path from the stdin JSON (.tool_input.file_path) ---
STDIN_JSON="$(cat 2>/dev/null || true)"
FILE_PATH="$(
  printf '%s' "$STDIN_JSON" | python3 -c \
    'import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    print(""); sys.exit(0)
print((d.get("tool_input") or {}).get("file_path") or "")' 2>/dev/null
)"

[ -n "$FILE_PATH" ] || exit 0
[ -f "$FILE_PATH" ] || exit 0

# absolute, and relative to the repo root
case "$FILE_PATH" in
  /*) ABS="$FILE_PATH" ;;
  *)  ABS="$REPO_ROOT/$FILE_PATH" ;;
esac
REL="${ABS#"$REPO_ROOT"/}"

# only touch files inside this repo
[ "$REL" != "$ABS" ] || exit 0

# timeout guard (optional)
TIMEOUT=""
command -v timeout >/dev/null 2>&1 && TIMEOUT="timeout 60"

note() { printf 'format-changed: %s\n' "$1" >&2; }

case "$REL" in
  apps/api/*.php)
    # Laravel — Pint, but only if the php-cli container is up
    if docker compose --project-directory "$REPO_ROOT" ps --status running --services 2>/dev/null | grep -qx php-cli; then
      sub="${REL#apps/api/}"
      $TIMEOUT docker compose --project-directory "$REPO_ROOT" exec -T php-cli ./vendor/bin/pint "$sub" \
        || note "pint failed on $sub (ignored)"
    fi
    ;;
  apps/web/*.ts|apps/web/*.vue|apps/web/*.js|apps/web/*.mjs|apps/web/*.json|apps/web/*.css)
    if [ -x "$REPO_ROOT/apps/web/node_modules/.bin/prettier" ]; then
      sub="${REL#apps/web/}"
      ( cd "$REPO_ROOT/apps/web" && $TIMEOUT npx --no-install prettier --write "$sub" ) \
        || note "prettier failed on apps/web/$sub (ignored)"
    fi
    ;;
  services/agent/*.ts|services/agent/*.js|services/agent/*.json)
    if [ -x "$REPO_ROOT/services/agent/node_modules/.bin/prettier" ]; then
      sub="${REL#services/agent/}"
      ( cd "$REPO_ROOT/services/agent" && $TIMEOUT npx --no-install prettier --write "$sub" ) \
        || note "prettier failed on services/agent/$sub (ignored)"
    fi
    ;;
  *)
    ;;
esac

exit 0
