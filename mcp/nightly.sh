#!/usr/bin/env bash
# nightly.sh — entropy + cartography + publish. Cron this at ~23:50 local.
#   50 23 * * *  BRAIN_JSON=$HOME/fieldnotes/brain.json $HOME/fieldnotes/mcp/nightly.sh
set -euo pipefail
cd "$(dirname "$0")"
SITE_REPO="${SITE_REPO:-$(cd .. && pwd)}"

# 1. entropy: cool the unpromoted, expire stale suggestions, refresh ages
node server.mjs decay

# 2. cartography: hand the accretion clusters + ledger to Claude; it may call
#    brain_chart with at most two suggestions (guardrails enforced server-side)
if command -v claude >/dev/null; then
  claude -p "$(cat chart-prompt.md)" --allowedTools "mcp__brain__brain_state,mcp__brain__brain_chart" || true
fi

# 3. publish: the map re-renders from whatever this commit says is true
cd "$SITE_REPO"
if ! git diff --quiet -- brain.json; then
  git add brain.json
  git commit -m "brain: nightly decay + chart $(date +%F)"
  git push
fi
