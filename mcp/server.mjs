#!/usr/bin/env node
// brain-mcp — MCP stdio server. Register once in Claude Code; propose from any session.
// Maintenance mode: `node server.mjs decay|chart` (used by nightly.sh), no MCP needed.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadBrain, saveBrain, propose, promote, decay, remember, chart, accretionClusters, THEMES } from './lib/brain.js';

const BRAIN = process.env.BRAIN_JSON || new URL('../brain.json', import.meta.url).pathname;
const today = () => new Date().toISOString().slice(0, 10);
const withBrain = fn => { const b = loadBrain(BRAIN); const out = fn(b); saveBrain(BRAIN, b); return out; };
const reply = obj => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

// -- maintenance CLI (cron path, no MCP handshake) --
const cmd = process.argv[2];
if (cmd === 'decay') { console.log(JSON.stringify(withBrain(b => decay(b, today())))); process.exit(0); }
if (cmd === 'chart') { console.log(JSON.stringify({ accretion: accretionClusters(loadBrain(BRAIN)) })); process.exit(0); }

const server = new McpServer({ name: 'brain-mcp', version: '0.1.0' });

server.tool('brain_propose',
  'Propose a particle for the gravity map: a CLAIM or TENSION from today, never an activity log. Max 6/day. The only write a digest is allowed.',
  {
    title: z.string().max(90).describe('One line, written plainly. A claim, not an activity.'),
    source: z.enum(['github', 'journal', 'claude']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    affinity: z.enum(['o', 'x', 'w', 'e', 'q']).nullable().describe('Theme id only if it clearly belongs; null stays dark (respectable)'),
    energy: z.number().min(0).max(1).describe('0.3 routine · 0.5 interesting · 0.7 kept returning · 0.9 could not stop. Be stingy above 0.7.'),
    refs: z.array(z.string()).optional().describe('Existing note/particle ids this extends')
  },
  async (args) => reply(withBrain(b => propose(b, args, today()))));

server.tool('brain_promote',
  'HUMAN-GATED: only call after Justin explicitly approves in chat. Grants mass: particle becomes an orbiting note.',
  {
    id: z.string(), theme: z.enum(['o', 'x', 'w', 'e', 'q']),
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

server.tool('brain_state',
  'Read-only: themes, note/particle ids and titles, accretion clusters. Use to cite refs and avoid duplicates before proposing.',
  {},
  async () => {
    const b = loadBrain(BRAIN);
    return reply({
      themes: THEMES,
      notes: b.notes.map(n => ({ id: n.id, theme: n.theme, title: n.title })),
      particles: (b.particles || []).map(p => ({ id: p.id, title: p.title, affinity: p.affinity, energy: p.energy })),
      accretion: accretionClusters(b)
    });
  });

await server.connect(new StdioServerTransport());
