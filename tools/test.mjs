// Builds every cell in knowledge/examples.json through the converter and the engine's buildCell (Node, no browser).
// node tools/test.mjs [descriptions.json]
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildCell, resolveTokens } from '../engine/lib/tokens.mjs';
const require = createRequire(import.meta.url);
const Convert = require('../src/convert.js');
const root = new URL('..', import.meta.url).pathname;
const cols = Object.fromEntries(readdirSync(root + 'engine/tokens').map(c => [c, Object.fromEntries(readdirSync(`${root}engine/tokens/${c}`).filter(f => f.endsWith('.tokens.json')).map(f => [f.slice(0, -12), JSON.parse(readFileSync(`${root}engine/tokens/${c}/${f}`))]))]));
const actions = JSON.parse(readFileSync(root + 'engine/actions/actions.json'));
const src = JSON.parse(readFileSync(process.argv[2] || root + 'knowledge/examples.json'));
let fail = 0;
for (const d of src.cells) {
  try {
    const { base, spec, warnings } = Convert.toSpec(d, {});
    const baseJson = JSON.parse(readFileSync(`${root}engine/bases/${base}.base.json`));
    const tokens = resolveTokens(cols, { device: 'Mobile' });
    const out = buildCell(baseJson, spec, tokens, { actions });
    const n = [...out.json.config.styles, ...out.json.config.assets].length;
    console.log('ok  ', d.name.padEnd(22), base.padEnd(12), out.output, n, 'fields', warnings.length ? warnings : '');
  } catch (e) { fail++; console.log('FAIL', d.name, e.message); }
}
// navigation bar and tab bar settings (tools/nav-fixture.json)
const nav = JSON.parse(readFileSync(root + 'tools/nav-fixture.json'));
const check = (name, got, expect) => { const bad = Object.entries(expect).filter(([k, v]) => JSON.stringify(got[k]) !== JSON.stringify(v));
  if (bad.length) { fail++; console.log('FAIL', name, bad.map(([k, v]) => `${k}: ${JSON.stringify(got[k])} (expected ${JSON.stringify(v)})`).join('; ')); } else console.log('ok  ', name); };
for (const d of nav.navBars) { const r = Convert.navBar(d); check(`nav bar ${d.variant}`, { ...r.styles, height: r.height, images: r.images.map(i => i.field) }, d.expect); }
{ const r = Convert.tabBar(nav.tabBar); check('tab bar', { ...r.styles, tabs: r.tabs.length }, nav.tabBar.expect); }
process.exit(fail ? 1 : 0);
