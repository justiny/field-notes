# Session digest — add this to your GLOBAL ~/.claude/CLAUDE.md

This is the seamless-capture piece: no scraping, no pipelines. The place you
already think (Claude Code / Claude sessions) is the ingest surface. Copy the
block below into `~/.claude/CLAUDE.md` so every session knows the protocol.

---

## Field notes protocol (brain-mcp)

A `brain-mcp` server may be registered. It feeds my public gravity map.

- When a session produces a genuine CLAIM or TENSION — a thing I'd want to
  remember thinking, not a thing we did — offer to `brain_propose` it. One
  line, written plainly. Ask before calling; don't propose silently.
- If I say "note that", "particle that", or "add that to the map", call
  `brain_propose` with source "claude" and today's date. Check `brain_state`
  first to cite refs and avoid duplicates.
- `brain_promote` only when I explicitly approve promoting a specific
  particle. Never promote on your own judgment.
- `brain_remember` only when I say "remember this" about a moment (not an
  idea). Memories are rare. When in doubt, it's a particle.
- Respect refusals from the server (rate limit, activity-log rejection,
  dedupe merge). They are the editorial policy, not errors to route around.
