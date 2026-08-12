# Field Notes — build & deploy handoff

A living portfolio for **Justin Young, Director of AI Engineering & Strategy, Southleft**.
It renders one person's thinking as a 3D gravity system: notes orbit theme
masses, unproven ideas fall as particles, old thinking drifts outward and cools,
and a black hole at the center holds the memories and the "about."

This is **not** a "recreate these mockups in React" job. Two of the three pieces
are already real, working code. Your job is to finish, wire, and ship them as one
deployable thing.

## What's in this bundle

```
site/
  index.html      the map — self-contained HTML + three.js (ES module, importmap CDN)
  engine.html     "the engine behind the map" — plain static page explaining the MCP
  brain.json      the single file of truth; the map renders purely from this
mcp/
  README.md         architecture + guardrails (read first)
  AGENT_BRIEF.md    the original build brief for the server (was CLAUDE.md)
  server.mjs        MCP stdio server + maintenance CLI (decay / chart)
  lib/brain.js      all logic, pure & dependency-free — the guardrails live here
  test/brain.test.mjs  the contract — `npm test`
  nightly.sh        cron entry: decay → chart → git commit/push → site rebuilds
  package.json
  chart-prompt.md / digest-prompt.md / session-digest.md   agent prompts
```

## Run it locally

There is no build step and no dev server to install — the map is a static page
that fetches `brain.json` at runtime. Any static file server works:

    cd site && python3 -m http.server 8000    # then open http://localhost:8000

It must be *served*, not opened as a `file://` URL: the `fetch('./brain.json')`
call is subject to CORS and will fail from the filesystem. An internet connection
is required too — three.js comes from an SRI-pinned CDN importmap and the fonts
from Google Fonts.

Live at **https://field-notes.justin-93c.workers.dev** — a Cloudflare Worker
serving `site/` as static assets, deployed from this repo on every push to
`main`. Config lives in `wrangler.jsonc`; there is no build step.

## Fidelity

**High-fidelity, and mostly final code.**
- `site/index.html` and `site/engine.html` are the finished front end — ship them
  as-is (host them; don't rebuild them in a framework). They use CDN three.js via
  an importmap and Google Fonts; no build step. If you move to a bundler later,
  keep the exact visuals, palette, and interactions.
- The `mcp/` server is a settled design. Do **not** redesign it. Finish and wire it
  per `mcp/AGENT_BRIEF.md`.

## The system in one breath

1. **Capture** happens inside Claude Code sessions. Mid-work the human says
   "particle that"; the agent calls `brain_propose`, appending a particle to
   `brain.json` (max 6/day). Agents may only propose — never grant mass.
2. **Decay** runs nightly from cron: energy ×0.92, suggestions expire after 14
   unengaged days, note ages recomputed. Entropy is not a tool; it's not optional.
3. **The cartographer** (nightly) reads the ledger and may chart ≤2 cited
   suggestions into deep space.
4. **Promotion** to a full orbiting note, and **memories**, happen only by human
   approval in chat (`brain_promote` / `brain_remember`).
5. `brain.json` is committed & pushed; the static site redeploys and re-renders.

The map is a pure function of `brain.json`. See `engine.html` and `mcp/README.md`
for the full data→physics mapping.

## Tasks, in order

1. **Front end — host the static site.** Serve `site/` on a static host (Netlify,
   Vercel, Cloudflare Pages, GitHub Pages). `index.html` is the entry. Confirm the
   importmap CDN + fonts load over HTTPS and the map renders. No build step needed.
2. **Wire the source links on `engine.html`.** Three links (MCP README, server.mjs,
   lib/brain.js) currently point to `#`. Point them at the public repo once it
   exists (e.g. `https://github.com/justiny/<repo>/blob/main/mcp/...`).
3. **Server — make it real.** `cd mcp && npm install && npm test` on Node 20+.
   Fix any drift between `lib/brain.js` and the tests; the tests document intent.
4. **Verify the MCP handshake.**
   `npx @modelcontextprotocol/inspector node server.mjs` with `BRAIN_JSON` pointed
   at a **copy** of `brain.json`. Exercise all five tools.
5. **Register locally.**
   `claude mcp add brain -e BRAIN_JSON=$HOME/fieldnotes/brain.json -- node $HOME/fieldnotes/mcp/server.mjs`
6. **Wire the nightly loop.** Make `nightly.sh` executable; add the cron line from
   its header; confirm the git commit/push targets the site repo so a push
   triggers a redeploy.
7. **Add the capture protocol.** Paste `mcp/session-digest.md`'s block into the
   user's global `~/.claude/CLAUDE.md` so sessions offer to particle-ize claims.
8. Rename `mcp/AGENT_BRIEF.md` back to `CLAUDE.md` inside the server repo if you
   want Claude Code to pick it up automatically (it was renamed only to survive
   this bundle).

## Sharp edges (from the server brief — don't relearn these the hard way)

- `saveBrain` writes tmp-then-rename **on purpose** — the site must never read a
  half-written ledger. Keep it atomic.
- Never change `brain.json`'s existing key shapes; additive fields only. The map
  computes positions from `ageMonths` / `energy` / `affinity`. If a field looks
  unused server-side, the map probably uses it — check before pruning.
- Dedupe/accretion similarity is a cheap token overlap, not embeddings, on
  purpose. If you upgrade it, keep thresholds as named constants and keep
  `lib/brain.js` dependency-free.
- The rate limit keys off `proposedOn` (server date), not the particle's claimed
  `date` — a digest back-filling old dates still spends today's six.
- Guardrails live in `lib/brain.js`, server-side — never in prompts.

## Front-end reference (for hosting / minor edits, not a rebuild)

- **Palette:** bg `#121210`, ink `#E8E4DC`, muted `#8B8A80` / `#5C5B52`, bone
  wireframe `#E8E4DC`, live green `#82C566`, redshift/memory orange `#E08A3C`,
  hairlines `#2A2A26` / `#3A3A34`.
- **Type:** Space Grotesk (display/body), IBM Plex Mono (labels/UI), mono at
  9–10px with `.14–.2em` letter-spacing.
- **Deps:** three.js 0.184.0 via importmap + OrbitControls (CDN, SRI-pinned in the
  `<head>`); Google Fonts. Nothing else.
- **Interactions:** drag-orbit / scroll-zoom / click-a-note-to-dive-and-read /
  double-click-home; top-right MENU (links + About dive + timeline rewind + reset
  view); bottom time-scrubber unwinds the year; bottom-right minimap is a travel
  pad (click to glide, drag to fly). The black-hole interior holds memories, a
  rotating tesseract singularity (the "about"), and redshift on the way in.
