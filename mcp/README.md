# brain-mcp — the ingest surface for the Field Notes gravity map

One MCP server, one file of truth (`brain.json`), zero scraping pipelines.
The place the thinking already happens — Claude Code / Claude sessions — IS
the capture surface. Agents can only **propose**; mass is earned, never
granted by the machine.

## The seamless-capture model (answers "what are the sources?")

There are no sources to scrape. Capture happens at the point of thought:

1. **In-session** (the main path): `brain-mcp` is registered in Claude Code.
   Mid-work you say "note that" — Claude calls `brain_propose` with the claim.
   The protocol block in `session-digest.md` (added to your global CLAUDE.md)
   also has Claude *offer* to particle-ize a genuine claim when one surfaces.
   Cost to you: saying yes.
2. **Nightly backstop** (cron, `nightly.sh`): decay runs, the cartographer
   (`chart-prompt.md`) reads the ledger and may chart up to two suggestions,
   and `brain.json` is committed + pushed — the static site rebuilds.
3. **Human-gated mass**: promotion happens in chat — "promote p-0810-2 to
   workflows" — and Claude calls `brain_promote`. Same for `brain_remember`.

Optional later: a git post-commit digest for days worked outside Claude. Not
required for v1; the session path covers most real thinking.

## Package layout

    server.mjs          MCP stdio server + maintenance CLI (decay/chart)
    lib/brain.js        all logic, pure & dependency-free (the guardrails live here)
    test/brain.test.mjs the contract — `npm test`
    nightly.sh          cron entry: decay → chart → git commit/push
    chart-prompt.md     the cartographer's nightly instructions
    digest-prompt.md    what makes a particle (claims, never activity)
    session-digest.md   block to paste into ~/.claude/CLAUDE.md
    CLAUDE.md           handoff brief for Claude Code

## Tools

| tool | who may call | writes |
| --- | --- | --- |
| `brain_propose` | any digest/session agent | appends a particle (max 6/day) |
| `brain_promote` | human approval only | particle → orbiting note, theme mass +1 |
| `brain_remember` | human only | a memory: whole, undecaying, orbits the self |
| `brain_chart` | nightly cartographer | ≤ 2 cited suggestions in deep space |
| `brain_name_theme` | human only | mints a theme from an accretion cluster, adopts its dark particles |
| `brain_state` | anyone (read-only) | nothing — ids/titles for refs + dedupe |

`decay` is not a tool — entropy is not optional. It runs from cron:
`node server.mjs decay` (energy ×0.92 nightly, suggestions expire unengaged
after 14 days, note ages recomputed so orbits stay honest).

## Guardrails (thermodynamic, not bureaucratic — enforced in lib/brain.js)

- **Rate**: 6 proposals per day. Scarcity forces editorial judgment upstream.
- **Substance**: titles that are pure activity ("worked on X") are rejected.
- **Dedupe**: strong title overlap → merge (energy adds, refs union), not append.
- **Quarantine**: uncertain `affinity` stays `null`. Agents may not invent themes.
- **Accretion**: ≥ 3 mutually-similar dark particles → the server reports a
  cluster; a human names the new theme (`brain_name_theme`) or rejects it.
  Themes are read from `brain.json`, never hardcoded, so a newly named one is
  usable immediately.
- **Provenance**: every particle keeps `source` + `date` forever.
- **Atomicity**: brain.json writes are tmp-then-rename; the site never sees a
  half-written ledger.

## Physics mapping (what the map renders from this)

| data | rendering |
| --- | --- |
| particle, affinity ≠ null | green dot falling near its well |
| particle, affinity = null | gray dot drifting in the deep field |
| energy | opacity — cooling toward the dark |
| promote | note in orbit at radius 0, dashed tether until the essay exists |
| note count per theme | glyph crystallization + spoke thickness |
| ageMonths | orbit radius (11 units/month) + tether brightness |
| suggestion | dashed "?" body in deep space, expires in 14 days |

## Setup (once)

    cd mcp && npm install && npm test
    claude mcp add brain -e BRAIN_JSON=$HOME/fieldnotes/brain.json -- node $HOME/fieldnotes/mcp/server.mjs
    # paste session-digest.md's block into ~/.claude/CLAUDE.md
    chmod +x nightly.sh
    crontab -e   # 50 23 * * *  BRAIN_JSON=... SITE_REPO=... .../mcp/nightly.sh

## A day in the life

1. You work. Twice, mid-session, a claim crystallizes; you say "particle that."
2. 23:50 — decay cools everything unpromoted; the cartographer reads the
   ledger and charts one suggestion (or honestly none); brain.json is
   committed; the site rebuilds.
3. Next morning you wander the map, see two new green dots falling toward
   Workflows, and promote one in chat. The rest cools. Nothing is deleted.
