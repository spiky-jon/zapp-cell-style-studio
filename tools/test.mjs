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
// space inside cell edges, corrected from the Figma layer (tools/inset-fixture.json)
for (const k of JSON.parse(readFileSync(root + 'tools/inset-fixture.json')).cases) {
  const d = JSON.parse(JSON.stringify(k.cell)), msg = Convert.fixInsets(d, k.layer), l = (d.labels || [])[0] || {};
  check(`spacing: ${k.name}`, { padding: d.cell && d.cell.padding, labelMargin: l.margin, lineHeight: l.font && l.font.lineHeight, headerPadding: d.header && d.header.padding, changed: !!msg,
    dividerMargin: d.cell && d.cell.dividerBottom && d.cell.dividerBottom.margin, dividerTopMargin: d.cell && d.cell.dividerTop && d.cell.dividerTop.margin }, k.expect);
}
// image ratios: measured sizes snap to common ratios
for (const [inp, want] of [['166x93', '16x9'], ['353x353', '1x1'], ['166x249', '2x3'], ['390x167', '21x9'], ['16x9', '16x9'], ['43x60', '43x60'], ['300x240', '5x4']]) {
  const r = Convert.ratioOf(inp); check(`ratio ${inp}`, { ratio: r.custom || r.ratio }, { ratio: want });
}
// page dots (Ch4 hero carousel)
{ const r = Convert.indicatorStyles({ width: 9, height: 9, gap: 11, color: '#787878', activeColor: '#8DFF77', align: 'center', position: 'below', margin: [27, 0, 0, 0] });
  check('page dots', r, { mobile_horizontal_indicator_toggle: true, mobile_horizontal_indicator_width: 9, mobile_horizontal_indicator_corner_radius: 4.5, mobile_horizontal_indicator_horizontal_gutter: 11,
    mobile_horizontal_indicator_color_active: 'rgba(141, 255, 119, 1)', mobile_horizontal_indicator_margin_top: 27, mobile_horizontal_indicator_margin_bottom: 0 }); }
// focused colours: a button's Touch state reaches the cell JSON
{ const d = JSON.parse(JSON.stringify(src.cells.find(c => c.buttons) || null));
  if (d) { d.buttons.items[0].background = '#8DFF77'; d.buttons.items[0].focused = { background: '#55CD3E' };
    const { base, spec } = Convert.toSpec(d, {}); const out = buildCell(JSON.parse(readFileSync(`${root}engine/bases/${base}.base.json`)), spec, resolveTokens(cols, { device: 'Mobile' }), { actions });
    const v = k => [...out.json.config.styles, ...out.json.config.assets].find(x => x.key === k)?.value;
    check('button focused colour', { bg: v('mobile_button_1_background_color'), focused: v('mobile_button_1_focused_background_color') }, { bg: 'rgba(141,255,119,1.00)', focused: 'rgba(85,205,62,1.00)' }); } }
process.exit(fail ? 1 : 0);
