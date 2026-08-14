# particle-backlog.md — mined from real history, waiting on the daily six

Claims found by reading commit bodies across the repos, each traceable to a
specific commit. Nothing here is invented; the work is only in noticing what a
commit was actually arguing and writing it as a claim.

The rate limit is six proposals per calendar day and it keys off `proposedOn`,
not the particle's date, so a backfilled claim still spends today's allowance.
That is deliberate. This file is the queue that makes the limit survivable
rather than a reason to route around it.

**Working it:** take the top few, call `brain_propose` with the date given here,
delete the lines you used. Re-mine when it runs dry — `git log --format='%n===%cs|%s%n%b' --no-merges`
piped through an awk filter for long bodies is how this list was built.

---

## Queued

**2026-08-13 · monday-morning** — `feat(shell-v3): delete the old composition — 341 in, 1552 out`
- title: `Deletion is honest only when the capability moved`
- claim: Five components went, but the affordances they carried were rebuilt somewhere smaller first, and the tests moved to follow their subjects rather than being deleted with them. A deletion that drops capability is a feature cut wearing a refactor's clothes.

**2026-08-13 · monday-morning** — `feat(roadmap): cooling and the weekly prune pass`
- title: `A spec whose premise was false should say so`
- claim: R1 assumed a per-item timestamp that only existed on a matched spec, which would have made cooling blind to exactly the milestones most likely to need it. The spec was corrected in place rather than quietly worked around.

**2026-08-13 · monday-morning** — `feat(roadmap): the seeded draft says how much of itself it guessed`
- title: `Starting empty is an outcome, and should be tested as one`
- claim: A repo with nothing worth reading says so and invents no milestones. Most tools treat the empty case as a failure to be papered over, which is how you get confident output built from nothing.

**2026-08-13 · primer** — `Diagnose why nothing matched`
- title: `A true error that misplaces the blame is still a failure`
- claim: "No excerpt matches 'What should I plan for my first class?'" was accurate and useless — a teacher who has just loaded her curriculum being told her curriculum does not cover it, with no way to tell whether the import failed, imported unreadably, or genuinely lacks the answer.

**2026-08-08 · elite-running-lab** — `Add a WebGPU reaction-diffusion experiment`
- title: `Wrapping lets a pattern feed on its own reflection`
- claim: The grid clamps at the edges rather than wrapping. Wrapping tiles more prettily and produces a lie about what the rule does, because the pattern ends up consuming its own mirror image. (refs: x2)

**2026-08-07 · elite-running-lab** — `Deploy as an Access-gated Worker with static assets`
- title: `The gating requirement chose the platform, not the docs`
- claim: Pages only exposes an Access policy on preview deployments, and the whole point was a gated production site — so Workers Static Assets was the only option that could do the job. The constraint nobody lists in the comparison table is the one that decides.

**2026-08-12 · elite-running-lab** — `Publish the lab`
- title: `A gated link is the same as not shipping it`
- claim: Access protection was deliberate until the lab got linked from the map. An Access-gated URL is useless to a visitor, so the real choice was publish or do not link — there was no third option where it stayed both private and reachable.

**2026-08-05 · heatloop-v2** — `chore: remove dead code identified in v2 sweep`
- title: `Dead code is only dead when two methods agree it is`
- claim: Sixteen unreferenced symbols and two files went, each confirmed by knip and by a per-symbol grep across the whole workspace. One tool's confidence about reachability is a guess; two independent ones disagreeing is the interesting case.

**2026-08-04 · heatloop-v2** — `fix(web): history tab change keeps the current list`
- title: `Stale data beats a skeleton that tears the page down`
- claim: Every tab click forced a loading phase, collapsing the tiles and rows into a skeleton until the refetch returned. The old list stays valid until the new read lands, and keeping it on screen is both faster to read and more honest about what changed.

**2026-05-17 · heatloop** — `fix(web): hide completed assignments from Live Task badge`
- title: `A type valid on another endpoint type-checks a lie here`
- claim: The shared Task type declares completed_at, which is real on sponsor endpoints and never sent on looper ones. The filter read it, type-checked cleanly, and was always false. A type that is true somewhere else buys you nothing here.
