// lib/brain.js — pure logic, no I/O beyond load/save. Everything testable.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';

// Themes come from the ledger, not from a const here: the accretion loop lets a
// human name a new one, and a hardcoded copy would silently diverge from
// brain.json the moment that happened.
export const themesOf = brain =>
  Object.fromEntries((brain.themes || []).map(t => [t.id, t.name]));
const RATE_LIMIT = 6;            // proposals per calendar day
const TITLE_MAX = 60;            // the map label — short enough to read at a glance;
                                 // the full sentence lives in `claim`, shown on click
const DECAY = 0.92;              // nightly energy multiplier
const COLD = 0.05;               // below this a particle renders near-invisible (never deleted)
const DEDUPE_SIM = 0.7;          // token-overlap threshold for merge
const SUGGESTION_TTL_DAYS = 14;  // unengaged cartographer suggestions expire
const ACTIVITY_RE = /^(worked on|working on|continued|fixed|updated|refactored|met (about|with)|attended|reviewed|merged|shipped)\b/i;

export function loadBrain(path) { return JSON.parse(readFileSync(path, 'utf8')); }
export function saveBrain(path, brain) {
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(brain, null, 2) + '\n');
  renameSync(tmp, path); // atomic: the site never sees a half-written ledger
}

const tokens = s => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 2));
export function similarity(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let hit = 0; for (const w of ta) if (tb.has(w)) hit++;
  return hit / Math.min(ta.size, tb.size);
}

const monthsBetween = (fromYm, today) => {
  const [fy, fm] = fromYm.slice(0, 7).split('-').map(Number);
  const [ty, tm] = today.slice(0, 7).split('-').map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
};
const STAMP_MO = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
export const stampOf = ym => STAMP_MO[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(2, 4);

// ---- propose: the ONLY write a digest agent is allowed ----
export function propose(brain, p, today) {
  if (!p.title || p.title.length > TITLE_MAX) throw new Error(`title required, <= ${TITLE_MAX} chars — put the full sentence in \`claim\``);
  if (p.claim && p.claim.length > 280) throw new Error('claim <= 280 chars');
  if (!['github', 'journal', 'claude'].includes(p.source)) throw new Error('source must be github|journal|claude');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) throw new Error('date must be YYYY-MM-DD');
  if (p.affinity != null && !themesOf(brain)[p.affinity]) throw new Error('affinity must be a theme id or null');
  if (ACTIVITY_RE.test(p.title.trim())) throw new Error('rejected: activity log, no claim in it (see digest-prompt.md)');
  const todays = (brain.particles || []).filter(x => x.proposedOn === today);
  if (todays.length >= RATE_LIMIT) throw new Error(`rate limit: ${RATE_LIMIT} proposals per day; today is spent`);
  // dedupe: strong overlap with an existing particle -> merge, not append
  for (const x of brain.particles || []) {
    if (similarity(x.title, p.title) >= DEDUPE_SIM) {
      x.energy = Math.min(1, (x.energy || 0) + (p.energy || 0.3) * 0.5);
      x.refs = [...new Set([...(x.refs || []), ...(p.refs || [])])];
      return { merged: x.id, particle: x };
    }
  }
  // Sequence off ids already claimed for THIS date, not off today's count — a
  // back-filled date (an expected use) would otherwise reissue an existing id.
  // Notes are checked too: promote() carries a particle's id across, so a freed
  // slot in `particles` is not actually free.
  const prefix = `p-${p.date.slice(5).replace('-', '')}`;
  const taken = new Set([...(brain.particles || []), ...(brain.notes || [])].map(x => x.id));
  let seq = 1;
  while (taken.has(`${prefix}-${seq}`)) seq++;
  const particle = {
    id: `${prefix}-${seq}`,
    date: p.date, proposedOn: today, source: p.source, title: p.title.trim(),
    affinity: p.affinity ?? null, energy: Math.max(0, Math.min(1, p.energy ?? 0.3)),
    ...(p.claim ? { claim: p.claim.trim() } : {}),
    ...(p.refs?.length ? { refs: p.refs } : {})
  };
  brain.particles = brain.particles || [];
  brain.particles.push(particle);
  return { created: particle.id, particle };
}

// ---- promote: human-gated. Mass is granted here and only here ----
export function promote(brain, id, theme, today, teaser) {
  const themes = themesOf(brain);
  if (!themes[theme]) throw new Error('unknown theme: ' + theme);
  const i = (brain.particles || []).findIndex(x => x.id === id);
  if (i < 0) throw new Error('no particle ' + id);
  const p = brain.particles.splice(i, 1)[0];
  const ym = today.slice(0, 7);
  const note = {
    id: p.id, theme, cat: themes[theme].split(' ')[0].toUpperCase(),
    title: p.title, date: ym, stamp: stampOf(ym), ageMonths: 0,
    // a promoted particle's claim becomes the note's teaser unless one is given —
    // the long form is already written, no reason to make the human retype it
    teaser: teaser || p.claim || '', promotedFrom: p.source, sourceDate: p.date, draft: true
  };
  brain.notes.push(note);
  return { promoted: note };
}

// ---- decay: entropy, run nightly after the digest ----
export function decay(brain, today) {
  let cooled = 0, expired = 0;
  for (const p of brain.particles || []) {
    p.energy = Math.round(p.energy * DECAY * 1000) / 1000;
    if (p.energy < COLD) cooled++;
  }
  brain.suggestions = (brain.suggestions || []).filter(s => {
    const keep = s.engaged || daysBetween(s.inferred, today) <= SUGGESTION_TTL_DAYS;
    if (!keep) expired++;
    return keep;
  });
  // recompute note ages so the map's orbits stay honest
  for (const n of brain.notes || []) n.ageMonths = monthsBetween(n.date, today);
  for (const m of brain.memories || []) m.ageMonths = monthsBetween(m.date, today);
  return { cooled, expired };
}
// Real elapsed days. The previous form was `months*30 + (days % 30)`, which made
// anything charted late in a month expire almost at once: a suggestion inferred
// on the 31st already scored 30 days on the 1st.
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// ---- remember: human-only. Memories are already whole ----
export function remember(brain, m, today) {
  if (!m.title || !m.date) throw new Error('memory needs title and date');
  const ym = m.date.slice(0, 7);
  const memory = {
    id: 'm' + ((brain.memories || []).length + 1), title: m.title, date: ym,
    stamp: stampOf(ym), ageMonths: monthsBetween(ym, today),
    ...(m.note ? { note: m.note } : {}), ...(m.media ? { media: m.media } : {})
  };
  brain.memories = brain.memories || [];
  brain.memories.push(memory);
  return { remembered: memory.id };
}

// ---- accretion: >=3 dark particles more like each other than any theme -> a theme wants to be born ----
export function accretionClusters(brain) {
  const dark = (brain.particles || []).filter(p => !p.affinity && p.energy >= 0.05);
  const clusters = [];
  const used = new Set();
  for (const seed of dark) {
    if (used.has(seed.id)) continue;
    const kin = dark.filter(p => p !== seed && !used.has(p.id) && similarity(seed.title, p.title) >= 0.4);
    if (kin.length >= 2) {
      const members = [seed, ...kin];
      members.forEach(m => used.add(m.id));
      clusters.push({ members: members.map(m => m.id), titles: members.map(m => m.title) });
    }
  }
  return clusters; // the server EMITS these; a human names or rejects the theme
}

// ---- nameTheme: human-gated. The closing move of the accretion loop ----
// accretionClusters() could report a cluster forever with no way to act on it.
// This mints the theme and adopts the particles that argued for it.
export function nameTheme(brain, { id, name, members = [] }) {
  if (!/^[a-z0-9]{1,3}$/.test(id || '')) throw new Error('theme id must be 1-3 lowercase alphanumeric chars');
  if (!name || name.length > 40) throw new Error('theme name required, <= 40 chars');
  brain.themes = brain.themes || [];
  if (brain.themes.some(t => t.id === id)) throw new Error('theme already exists: ' + id);
  if (brain.themes.some(t => t.name.toLowerCase() === name.toLowerCase())) throw new Error('a theme is already called that: ' + name);

  const adopted = [];
  for (const pid of members) {
    const p = (brain.particles || []).find(x => x.id === pid);
    if (!p) throw new Error('no particle ' + pid);
    if (p.affinity) throw new Error(`${pid} already belongs to ${p.affinity}; only dark particles can seed a theme`);
    adopted.push(p);
  }
  brain.themes.push({ id, name });   // the map derives the glyph from note count
  adopted.forEach(p => { p.affinity = id; });
  return { theme: { id, name }, adopted: adopted.map(p => p.id) };
}

// ---- chart: validates + writes cartographer suggestions (the thinking happens in the LLM) ----
export function chart(brain, suggestions, today) {
  if (suggestions.length > 2) throw new Error('the cartographer may infer at most TWO suggestions per night');
  for (const s of suggestions) {
    if (!s.title || !s.relatedTo?.length || !s.prompt) throw new Error('suggestion needs title, relatedTo, prompt (cite your triggers)');
    for (const p of brain.particles || []) {
      if (!p.affinity && similarity(p.title, s.title) >= DEDUPE_SIM) throw new Error(`"${s.title}" already exists as dark particle ${p.id}`);
    }
  }
  brain.suggestions = (brain.suggestions || []).filter(s => s.engaged);
  suggestions.forEach((s, i) => brain.suggestions.push({ id: 'g' + Date.now().toString(36) + i, inferred: today, ...s }));
  return { charted: suggestions.length };
}
