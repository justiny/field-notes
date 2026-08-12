import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propose, promote, decay, remember, chart, accretionClusters, similarity, stampOf } from '../lib/brain.js';

const TODAY = '2026-08-10';
const fresh = () => ({
  themes: [], notes: [], particles: [], memories: [], suggestions: []
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

test('propose enforces the daily rate limit of 6', () => {
  const b = fresh();
  for (let i = 0; i < 6; i++) propose(b, P({ title: `Distinct claim number ${i} about ${'xyz'[i % 3]}${i}` }), TODAY);
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
