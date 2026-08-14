#!/usr/bin/env bash
# nightly.sh — entropy + cartography + publish. Cron this at ~23:50 local.
#   50 23 * * * /Users/justin/Sites/justin-space/mcp/nightly.sh >> /tmp/fieldnotes-nightly.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"

SITE_REPO="${SITE_REPO:-$(cd .. && pwd)}"
BRAIN_REL="site/brain.json"                       # the map fetches ./brain.json from site/
export BRAIN_JSON="${BRAIN_JSON:-$SITE_REPO/$BRAIN_REL}"

# cron runs with a bare PATH (/usr/bin:/bin): node lives under nvm and claude in
# ~/.local/bin, so neither resolves without this. sort -V is load-bearing — a
# plain sort picks v8.0.0 over v22.x lexically.
NVM_BIN="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1 || true)"
export PATH="$HOME/.local/bin${NVM_BIN:+:$NVM_BIN}:/opt/homebrew/bin:/usr/local/bin:$PATH"

# `claude` resolves its keychain credentials via $USER; without it the -p call
# below returns "Not logged in" and, being wrapped in `|| true`, the cartographer
# silently never runs. cron does not reliably set USER. Verified by bisection:
# USER alone is sufficient, LOGNAME/SHELL/TMPDIR are not.
export USER="${USER:-$(id -un)}"
command -v node >/dev/null || { echo "nightly: node not on PATH (nvm upgrade? re-point PATH above)" >&2; exit 1; }
[ -f "$BRAIN_JSON" ] || { echo "nightly: no ledger at $BRAIN_JSON" >&2; exit 1; }

echo "--- nightly $(date '+%F %T') ---"

# 1. entropy: cool the unpromoted, expire stale suggestions, refresh ages
DECAY="$(node server.mjs decay)"
echo "$DECAY"

# 2. cartography: hand the accretion clusters + ledger to Claude; it may call
#    brain_chart with at most two suggestions (guardrails enforced server-side).
#
#    NOTE: this step does NOT honour $BRAIN_JSON or $SITE_REPO. It writes through
#    the *registered* brain MCP server, which carries its own BRAIN_JSON from
#    `claude mcp add`. In production both point at the same file so it does not
#    matter — but it means you cannot dry-run the nightly against a copy by
#    setting SITE_REPO. Steps 1 and 3 will use the copy; this step will still
#    write to the live ledger. Re-register the server first, or expect the leak.
CHART=skipped
if command -v claude >/dev/null; then
  # was `|| true`, which hid a failing cartographer behind exit 0. Recorded now.
  if claude -p "$(cat chart-prompt.md)" --allowedTools "mcp__brain__brain_state,mcp__brain__brain_chart"; then
    CHART=ok
  else
    CHART=failed
    echo "nightly: chart step failed" >&2
  fi
fi

# 2b. heartbeat: what the site shows to prove the job is still running. Because
# this stamp always changes, step 3 now commits every night even when nothing
# was cooled or charted — that is deliberate, an unchanged ledger is exactly the
# case where you most want proof the job ran rather than silence.
node server.mjs stamp "{\"at\":\"$(date -Iseconds)\",\"decay\":$DECAY,\"chart\":\"$CHART\"}"

# 3. publish: the map re-renders from whatever this commit says is true
cd "$SITE_REPO"
if ! git diff --quiet -- "$BRAIN_REL"; then
  git add "$BRAIN_REL"
  git commit -m "brain: nightly decay + chart $(date +%F)"
  git push
  echo "nightly: published"
else
  echo "nightly: ledger unchanged, nothing to publish"
fi
