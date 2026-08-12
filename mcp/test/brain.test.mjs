import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propose, promote, decay, remember, chart, accretionClusters, nameTheme, similarity, stampOf } from '../lib/brain.js';

const TODAY = '2026-08-10';
// Themes are read from the ledger now, so the fixture carries the real five —
// an empty `themes` would correctly reject every affinity in these tests.
const fresh = () => ({
  themes: [
    { id: 'o', name: 'Orchestration' }, { id: 'x', name: 'Context engineering' },
    { id: 'w', name: 'Workflows' }, { id: 'e', name: 'Evals' },
    { id: 'q', name: 'Experimentation' }
  ],
  notes: [], particles: [], memories: [], suggestions: []
});
const P = (over = {}) => ({ title: 'The dispatcher stayed dumb. Quality went up.', source: 'claude', date: TODAY, affinity: 'o', energy: 0.6, ...over });

test('propose creates a particle with sequential id', () => {
  const b = fresh();
  const r = propose(b, P(), TODAY);
  assert.equal(r.created, 'p-0810-1');
  assert.equal(b.particles.length, 1);
  assert.equal(b.particles[0].affinity, 'o');
});

test('propose rejects activity logs', () => {
  const b = fresh();
  assert.throws(() => propose(b, P({ title: 'Worked on the handoff pipeline' }), TODAY), /activity log/);
  assert.throws(() => propose(b, P({ title: 'Fixed 3 bugs in the dispatcher' }), TODAY), /activity log/);
});

// The six titles must share almost no tokens, or dedupe merges them and the
// rate limit is never reached. `tokens()` drops words of <= 2 chars, so
// "claim 1 / claim 2"-style fixtures all collapse to the same token set.
const SIX_DISTINCT = [
  'Dispatchers hoard work when you make them clever',
  'Compaction is lying to your future self',
  'Evals turn taste into assertions',
  'Scope is a gift you give a subagent',
  'Entropy belongs on a schedule not a whim',
  'Fan-out often hides an unmade decision',
];

test('propose enforces the daily rate limit of 6', () => {
  const b = fresh();
  for (const title of SIX_DISTINCT) propose(b, P({ title }), TODAY);
  assert.equal(b.particles.length, 6, 'six distinct claims must not merge');
  assert.throws(() => propose(b, P({ title: 'A seventh, one too many' }), TODAY), /rate limit/);
});

test('propose merges near-duplicates instead of appending', () => {
  const b = fresh();
  propose(b, P(), TODAY);
  const r = propose(b, P({ title: 'Dispatcher stayed dumb; quality went up again', energy: 0.8, refs: ['s2'] }), TODAY);
  assert.ok(r.merged);
  assert.equal(b.particles.length, 1);
  assert.ok(b.particles[0].energy > 0.6);
  assert.deepEqual(b.particles[0].refs, ['s2']);
});

test('propose validates affinity against real themes', () => {
  assert.throws(() => propose(fresh(), P({ affinity: 'zz' }), TODAY), /affinity/);
});

test('promote moves a particle into notes with zero age and draft flag', () => {
  const b = fresh();
  propose(b, P(), TODAY);
  const r = promote(b, 'p-0810-1', 'o', TODAY, 'A teaser');
  assert.equal(b.particles.length, 0);
  assert.equal(b.notes.length, 1);
  assert.equal(r.promoted.ageMonths, 0);
  assert.equal(r.promoted.draft, true);
  assert.equal(r.promoted.stamp, 'AUG 26');
});

test('decay cools particles and recomputes note ages', () => {
  const b = fresh();
  b.particles.push({ id: 'p1', title: 't', energy: 0.5 });
  b.notes.push({ id: 'n1', date: '2026-05', ageMonths: 0 });
  decay(b, TODAY);
  assert.equal(b.particles[0].energy, 0.46);
  assert.equal(b.notes[0].ageMonths, 3);
});

test('decay expires unengaged suggestions after 14 days, keeps engaged', () => {
  const b = fresh();
  b.suggestions.push({ id: 'g1', inferred: '2026-07-01', title: 'old' });
  b.suggestions.push({ id: 'g2', inferred: '2026-08-05', title: 'recent' });
  b.suggestions.push({ id: 'g3', inferred: '2026-06-01', title: 'kept', engaged: true });
  decay(b, TODAY);
  const ids = b.suggestions.map(s => s.id);
  assert.ok(!ids.includes('g1'));
  assert.ok(ids.includes('g2'));
  assert.ok(ids.includes('g3'));
});

test('remember appends a whole memory, never a particle', () => {
  const b = fresh();
  remember(b, { title: 'The porch conversation', date: '2026-06-14', note: 'x' }, TODAY);
  assert.equal(b.memories.length, 1);
  assert.equal(b.memories[0].ageMonths, 2);
  assert.equal(b.particles.length, 0);
});

test('chart refuses more than two suggestions and duplicate coverage', () => {
  const b = fresh();
  assert.throws(() => chart(b, [{}, {}, {}], TODAY), /at most TWO/);
  b.particles.push({ id: 'p1', title: 'Agent ethnography field notes', affinity: null, energy: 0.5 });
  assert.throws(() => chart(b, [{ title: 'Agent ethnography notes from the field', relatedTo: ['o'], prompt: 'x' }], TODAY), /already exists/);
  chart(b, [{ title: 'Compaction as memoir', relatedTo: ['x'], prompt: 'cites k, n5' }], TODAY);
  assert.equal(b.suggestions.length, 1);
});

test('propose does not reissue an id when back-filling an older date', () => {
  const b = fresh();
  // two claims already carry the 08-09 prefix, one of them promoted into notes
  propose(b, P({ title: 'The dispatcher stayed dumb. Quality went up.', date: '2026-08-09' }), TODAY);
  propose(b, P({ title: 'Compaction discards deliberation, keeps decisions', date: '2026-08-09' }), TODAY);
  promote(b, 'p-0809-1', 'o', TODAY, '');
  assert.equal(b.notes[0].id, 'p-0809-1', 'promote carries the id into notes');

  const r = propose(b, P({ title: 'Turbines spin down slower than anyone budgets for', date: '2026-08-09' }), TODAY);
  const ids = [...b.particles, ...b.notes].map(x => x.id);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate ids across particles and notes');
  assert.equal(r.created, 'p-0809-3', 'skips both the live and the promoted id');
});

test('suggestions get their full 14 days across a month boundary', () => {
  const b = fresh();
  b.suggestions.push({ id: 'g-endmonth', inferred: '2026-07-31', title: 'charted on the 31st' });
  decay(b, '2026-08-01');
  assert.deepEqual(b.suggestions.map(s => s.id), ['g-endmonth'], 'one day old, must survive');
  decay(b, '2026-08-14');
  assert.equal(b.suggestions.length, 1, 'day 14 is still within TTL');
  decay(b, '2026-08-15');
  assert.equal(b.suggestions.length, 0, 'day 15 expires');
});

test('nameTheme mints a theme and adopts its dark particles', () => {
  const b = fresh();
  b.particles.push(
    { id: 'd1', title: 'Taste is the rubric behind the rubrics', affinity: null, energy: 0.5 },
    { id: 'd2', title: 'Nobody said latency, everybody said taste', affinity: null, energy: 0.4 },
    { id: 'claimed', title: 'Already spoken for', affinity: 'o', energy: 0.5 }
  );
  const r = nameTheme(b, { id: 't', name: 'Taste', members: ['d1', 'd2'] });
  assert.deepEqual(r.adopted, ['d1', 'd2']);
  assert.equal(b.particles.find(p => p.id === 'd1').affinity, 't');
  assert.ok(b.themes.some(t => t.id === 't' && t.name === 'Taste'));

  // the new theme is immediately usable — the whole point of dropping the const
  propose(b, P({ title: 'A fresh claim that belongs to the new theme', affinity: 't' }), TODAY);
  assert.equal(b.particles.at(-1).affinity, 't');

  assert.throws(() => nameTheme(b, { id: 't', name: 'Other' }), /already exists/);
  assert.throws(() => nameTheme(b, { id: 'z', name: 'taste' }), /already called/);
  assert.throws(() => nameTheme(b, { id: 'TOOLONG', name: 'x' }), /theme id must be/);
  assert.throws(() => nameTheme(b, { id: 'y', name: 'Y', members: ['claimed'] }), /already belongs/);
  assert.throws(() => nameTheme(b, { id: 'y', name: 'Y', members: ['nope'] }), /no particle/);
});

test('accretion finds >=3 mutually-similar dark particles', () => {
  const b = fresh();
  b.particles.push(
    { id: 'd1', title: 'Sound design for agent state changes', affinity: null, energy: 0.4 },
    { id: 'd2', title: 'Agent state changes should have sound', affinity: null, energy: 0.3 },
    { id: 'd3', title: 'Sound as ambient agent state display', affinity: null, energy: 0.5 },
    { id: 'd4', title: 'Unrelated thought about gardening', affinity: null, energy: 0.4 }
  );
  const clusters = accretionClusters(b);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].members.length, 3);
});

test('similarity + stamp helpers', () => {
  assert.ok(similarity('the dispatcher stayed dumb', 'dispatcher stayed dumb again') > 0.7);
  assert.equal(stampOf('2025-12'), 'DEC 25');
});
