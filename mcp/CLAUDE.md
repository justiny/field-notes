# CLAUDE.md — handoff brief for building brain-mcp

You are finishing a small, real MCP server. The design is settled; do not
redesign it. Read `README.md` (architecture + guardrails), `lib/brain.js`
(all logic, pure functions), `server.mjs` (MCP wiring + maintenance CLI),
`test/brain.test.mjs` (the contract).

## Ground truth
- `../brain.json` is the single file of truth. The map (`Field Notes
  v3.dc.html`) renders purely from it. Never change its existing key shapes;
  additive fields only.
- Agents PROPOSE; only the human grants mass (promote/remember). Guardrails
  live server-side in `lib/brain.js` — keep them there, not in prompts.

## Tasks, in order
1. `npm install && npm test` — make the suite green against real Node 20+.
   Fix any drift between lib and tests; the tests document intent.
2. Verify MCP handshake: `npx @modelcontextprotocol/inspector node server.mjs`
   with `BRAIN_JSON` pointed at a COPY of brain.json. Exercise all five tools.
3. Register locally: `claude mcp add brain -e BRAIN_JSON=$HOME/fieldnotes/brain.json -- node $HOME/fieldnotes/mcp/server.mjs`
4. Wire the nightly: make `nightly.sh` executable, add the cron line from its
   header, confirm the git commit/push path against the site repo.
5. Add the session-digest block (`session-digest.md`) to the user's global
   `~/.claude/CLAUDE.md`.

## Sharp edges
- `saveBrain` writes tmp-then-rename on purpose (the site must never read a
  half-written ledger). Keep it atomic.
- The dedupe/accretion similarity is deliberately a cheap token overlap, not
  embeddings. If you upgrade it, keep the thresholds as named constants and
  keep `lib/brain.js` dependency-free.
- The rate limit keys off `proposedOn` (server date), not the particle's
  claimed `date` — a digest back-filling old dates still spends today's six.
- The map computes positions from `ageMonths`/`energy`/`affinity`. If a field
  seems unused by the server, the map probably uses it — check before pruning.
