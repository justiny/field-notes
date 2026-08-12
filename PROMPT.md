# Initial prompt — paste into Claude Code

Copy everything below the line into a fresh Claude Code session opened in this
folder.

---

You are helping me ship **Field Notes** — my living portfolio. It renders my
thinking as a 3D gravity map, fed by a small MCP server and one file of truth,
`brain.json`. Read `README.md` in this folder first; it has the full picture,
the task order, and the sharp edges. Then read `mcp/README.md` and
`mcp/AGENT_BRIEF.md` before touching the server.

Important framing:
- The front end (`site/index.html`, `site/engine.html`) is **finished**. Host it;
  don't rebuild it in a framework and don't change the visuals.
- The MCP server (`mcp/`) is a **settled design**. Finish and wire it — do not
  redesign it. The guardrails live in `lib/brain.js` and must stay there.
- `brain.json` is the single source of truth; the map is a pure function of it.
  Additive fields only, never reshape existing keys, keep writes atomic.

Do these in order, checking in with me at each numbered step:

1. Stand the static `site/` up on a host I choose (ask me which). Confirm the
   map renders and the CDN/fonts load over HTTPS.
2. Point the three `#` source links in `site/engine.html` at the public repo
   once we've created it.
3. `cd mcp && npm install && npm test` on Node 20+; make the suite green.
4. Verify the MCP handshake with the inspector against a COPY of `brain.json`,
   exercising all five tools.
5. Register the server locally with `claude mcp add`.
6. Wire `nightly.sh` into cron and confirm the commit/push triggers a redeploy.
7. Add the `mcp/session-digest.md` capture block to my global `~/.claude/CLAUDE.md`.

Ask me for anything you need — the GitHub repo name, the host, the absolute path
where `brain.json` should live in production. Don't guess at those.
