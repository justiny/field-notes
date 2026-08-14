#!/usr/bin/env node
// brain-mcp — MCP stdio server. Register once in Claude Code; propose from any session.
// Maintenance mode: `node server.mjs decay|chart` (used by nightly.sh), no MCP needed.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadBrain, saveBrain, propose, promote, decay, remember, chart, accretionClusters, nameTheme, themesOf } from './lib/brain.js';

const BRAIN = process.env.BRAIN_JSON || new URL('../brain.json', import.meta.url).pathname;
const today = () => new Date().toISOString().slice(0, 10);
const withBrain = fn => { const b = loadBrain(BRAIN); const out = fn(b); saveBrain(BRAIN, b); return out; };
const reply = obj => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

// -- maintenance CLI (cron path, no MCP handshake) --
const cmd = process.argv[2];
if (cmd === 'decay') { console.log(JSON.stringify(withBrain(b => decay(b, today())))); process.exit(0); }
if (cmd === 'chart') { console.log(JSON.stringify({ accretion: accretionClusters(loadBrain(BRAIN)) })); process.exit(0); }
// Heartbeat the map renders. Written through saveBrain so the site never reads a
// half-written ledger, same as every other mutation.
if (cmd === 'stamp') { withBrain(b => { b.lastRun = JSON.parse(process.argv[3]); }); process.exit(0); }

const server = new McpServer({ name: 'brain-mcp', version: '0.1.0' });

server.tool('brain_propose',
  'Propose a particle for the gravity map: a CLAIM or TENSION from today, never an activity log. Max 6/day. The only write a digest is allowed.',
  {
    title: z.string().max(60).describe('SHORT headline, <= 60 chars — this is the label on the map. A claim, not an activity.'),
    claim: z.string().max(280).optional().describe('The full sentence as Justin said it. Shown when the particle is clicked. Use whenever the headline had to drop nuance.'),
    source: z.enum(['github', 'journal', 'claude']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // Not a fixed enum: themes can be minted by brain_name_theme, and a stale
    // enum here would reject them. lib/brain.js validates against the ledger.
    affinity: z.string().nullable().describe('Theme id (see brain_state) only if it clearly belongs; null stays dark (respectable)'),
    energy: z.number().min(0).max(1).describe('0.3 routine · 0.5 interesting · 0.7 kept returning · 0.9 could not stop. Be stingy above 0.7.'),
    refs: z.array(z.string()).optional().describe('Existing note/particle ids this extends')
  },
  async (args) => reply(withBrain(b => propose(b, args, today()))));

server.tool('brain_promote',
  'HUMAN-GATED: only call after Justin explicitly approves in chat. Grants mass: particle becomes an orbiting note.',
  {
    id: z.string(), theme: z.string().describe('Theme id — see brain_state'),
    teaser: z.string().max(120).optional().describe('One-line teaser for the map tooltip')
  },
  async ({ id, theme, teaser }) => reply(withBrain(b => promote(b, id, theme, today(), teaser))));

server.tool('brain_remember',
  'HUMAN-ONLY: record a memory (a moment, not a claim). Orbits the self, never decays. Only when Justin asks to remember something.',
  {
    title: z.string(), date: z.string().describe('YYYY-MM or YYYY-MM-DD'),
    note: z.string().optional(), media: z.string().optional().describe('filename previously dropped into /media/')
  },
  async (m) => reply(withBrain(b => remember(b, m, today()))));

server.tool('brain_chart',
  'Nightly cartographer write: at most TWO far-out suggestions, each citing its triggers. Refused if a dark particle already covers it.',
  {
    suggestions: z.array(z.object({
      title: z.string(), relatedTo: z.array(z.string()).min(1),
      prompt: z.string().describe('Why this region looks unexplored — cite the notes that triggered the inference')
    })).max(2)
  },
  async ({ suggestions }) => reply(withBrain(b => chart(b, suggestions, today()))));

server.tool('brain_name_theme',
  'HUMAN-ONLY: name a new theme from an accretion cluster. Only call after Justin explicitly names it in chat — never infer a theme yourself. Adopts the listed dark particles into it.',
  {
    id: z.string().describe('Short id, 1-3 lowercase alphanumeric chars, e.g. "t"'),
    name: z.string().max(40).describe('Display name, e.g. "Taste"'),
    members: z.array(z.string()).optional().describe('Dark particle ids that argued for this theme (from brain_state accretion)')
  },
  async ({ id, name, members }) => reply(withBrain(b => nameTheme(b, { id, name, members: members || [] }))));

server.tool('brain_state',
  'Read-only: themes, note/particle ids and titles, accretion clusters. Use to cite refs and avoid duplicates before proposing.',
  {},
  async () => {
    const b = loadBrain(BRAIN);
    return reply({
      themes: themesOf(b),
      notes: b.notes.map(n => ({ id: n.id, theme: n.theme, title: n.title })),
      particles: (b.particles || []).map(p => ({ id: p.id, title: p.title, affinity: p.affinity, energy: p.energy })),
      accretion: accretionClusters(b)
    });
  });

await server.connect(new StdioServerTransport());
