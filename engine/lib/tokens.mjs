// Token bridge: Figma variable exports -> cell_3_mobile style JSON.
// No dependencies, runs in Node and in the browser (the cell preview inlines this file).

/* ---------------- collections ---------------- */

// cols: { [collection]: { [mode]: exportedJson } }
// Collections used: Brand, Mapped, Responsive, "Corner Scale".
function walk(obj, path, out) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$')) continue;
    const p = path ? `${path}/${k}` : k;
    if (v && typeof v === 'object' && '$value' in v) out[p] = v;
    else if (v && typeof v === 'object') walk(v, p, out);
  }
  return out;
}

export function modesOf(cols, collection) {
  return Object.keys(cols[collection] || {});
}

const round = (x, dp) => Math.round(x * 10 ** dp) / 10 ** dp;

function colorOf(value, alphaOverride) {
  const [r, g, b] = value.components.map(c => Math.round(c * 255));
  const a = alphaOverride ?? (value.alpha ?? 1);
  return { r, g, b, a: round(a, 4) };
}

// Returns a flat map of token name -> resolved value for one brand + device combination.
// Colours resolve to {r,g,b,a}; numbers and strings stay as they are.
export function resolveTokens(cols, { brand, device, corners, buttons = 'accent', labels = 'sentence', buttonCorners = 'round' } = {}) {
  const pick = (c, m) => {
    const modes = cols[c] || {};
    const mode = m && modes[m] ? m : Object.keys(modes)[0];
    if (!mode) throw new Error(`Missing collection "${c}" in the token exports.`);
    return { mode, tokens: walk(modes[mode], '', {}) };
  };
  const B = pick('Brand', brand), R = pick('Responsive', device), C = pick('Corner Scale', corners), M = pick('Mapped');
  const out = {};
  const put = (name, tok) => {
    const v = tok.$value;
    out[name] = tok.$type === 'color' ? colorOf(v) : typeof v === 'number' ? round(v, 4) : v;
  };
  for (const [n, t] of Object.entries(B.tokens)) put(n, t);
  for (const [n, t] of Object.entries(R.tokens)) put(n, t);
  for (const [n, t] of Object.entries(C.tokens)) put(n, t);
  // Mapped tokens alias Brand tokens. Re-resolve through the alias so a different Brand mode flows through.
  for (const [n, t] of Object.entries(M.tokens)) {
    const ext = t.$extensions || {};
    const alias = ext['com.figma.aliasData'];
    const comp = ext['com.figma.composedColor'];
    if (comp && comp.colorArg?.type === 'alias') {
      const target = out[comp.colorArg.alias.targetVariableName];
      if (!target) throw new Error(`${n} points at ${comp.colorArg.alias.targetVariableName}, which isn't in the Brand export.`);
      const op = comp.opacityArg?.type === 'number' ? comp.opacityArg.value / 100 : target.a;
      out[n] = { ...target, a: round(op, 4) };
    } else if (alias) {
      const target = out[alias.targetVariableName];
      if (target === undefined) throw new Error(`${n} points at ${alias.targetVariableName}, which isn't in the Brand export.`);
      out[n] = target;
    } else put(n, t);
  }
  applyButtonStyle(out, buttons);
  const lab = LABEL_STYLES[labels] ? labels : 'sentence', cor = CORNER_STYLES[buttonCorners] ? buttonCorners : 'round';
  out['Role/button-radius'] = CORNER_STYLES[cor].token ? out[CORNER_STYLES[cor].token] : 0;
  out.__modes = { brand: B.mode, device: R.mode, corners: C.mode, mapped: M.mode, buttons: BUTTON_STYLES[buttons] ? buttons : 'accent', labels: lab, buttonCorners: cor };
  out.__contrast = applyContrastRules(out, out.__modes.buttons);
  return out;
}

/* ---------------- contrast ---------------- */

// WCAG 2 contrast ratio between two {r,g,b} colours (alpha ignored).
export function contrastRatio(a, b) {
  const lum = c => {
    const ch = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// A token that picks its value by contrast: the first option that reaches `min` against `on`
// wins; if none does, the option with the most contrast is used and the check is marked failed.
// `also` lists other backgrounds the same text sits on (e.g. the focused button), reported only.
// 4.5:1 is WCAG AA for normal text; button labels at 16px bold count as normal text.
// `options` can differ per button style ({ accent: [...], neutral: [...] }).
export const CONTRAST_RULES = [
  {
    token: 'Surface/primary-on-surface', label: 'Primary button label',
    on: 'Surface/primary-surface', also: [{ token: 'Surface/primary-surface-2', label: 'focused' }],
    options: ['neutral/100', 'neutral/900'], min: 4.5,
  },
  {
    // CTA tag text. Accent style keeps the design's dark text on the white tag; neutral style puts
    // the tag on the brand accent and picks its text like a button label.
    token: 'Role/on-highlight', label: 'CTA tag text',
    on: 'Role/highlight',
    options: { accent: ['Surface/surface-1', 'neutral/900'], neutral: ['neutral/100', 'neutral/900'] }, min: 4.5,
  },
];

/* ---------------- button style ---------------- */

// Where the brand accent goes. "accent": primary buttons are the accent (the Figma design).
// "neutral": primary buttons are on-surface-1 with base content, and the accent moves to the
// highlight role (progress bar watched portion, CTA tag background).
export const BUTTON_STYLES = {
  accent: { label: 'Accent' },
  neutral: { label: 'Neutral' },
};
// Button label treatment (Figma "Label Style"). Button 1 is the main button, Button 2 the small
// stacked label (icon above). Sizes come from Figma 117:6141.
export const LABEL_STYLES = {
  sentence: { label: 'Sentence', transform: 'default', 1: { asset: 24, gap: 8, padV: 12 }, 2: { asset: 24, gap: 8 } },
  uppercase: { label: 'Uppercase', transform: 'uppercase', 1: { asset: 20, gap: 6, padV: 14 }, 2: { asset: 20, gap: 8 } },
};
// Weights per button type and label style, from the Figma text styles (typography/<weight> tokens).
const BUTTON_TYPES = { 1: { sentence: 'Bold', uppercase: 'Black' }, 2: { sentence: 'Semi Bold', uppercase: 'Bold' } };
// Button corners (Figma "Corner Style"); icon-only buttons stay round in every style.
export const CORNER_STYLES = {
  round: { label: 'Round', token: 'M' },
  pill: { label: 'Pill', token: 'Round' },
  sharp: { label: 'Sharp', token: null },
};

function applyButtonStyle(out, style) {
  const accent = out['Surface/primary-surface'];
  if (style === 'neutral') {
    out['Surface/primary-surface'] = out['Surface/on-surface-1'];
    out['Surface/primary-surface-2'] = out['Surface/on-surface-2'];
    out['Role/highlight'] = accent;
  } else {
    out['Role/highlight'] = out['Surface/on-surface-1'];
  }
}

function applyContrastRules(out, style = 'accent') {
  const report = [];
  for (const rule of CONTRAST_RULES) {
    const bg = out[rule.on];
    const options = Array.isArray(rule.options) ? rule.options : rule.options[style] || rule.options.accent;
    const opts = options.filter(o => out[o]).map(o => ({ token: o, ratio: contrastRatio(out[o], bg) }));
    if (!bg || !opts.length) continue;
    const pick = opts.find(o => o.ratio >= rule.min) || opts.reduce((x, y) => (y.ratio > x.ratio ? y : x));
    out[rule.token] = { ...out[pick.token], a: 1 };
    report.push({
      ...rule, chosen: pick.token, ratio: pick.ratio, pass: pick.ratio >= rule.min,
      switched: pick.token !== options[0], options,
      first: opts[0],
      others: (rule.also || []).filter(x => out[x.token]).map(x => ({ ...x, ratio: contrastRatio(out[pick.token], out[x.token]) })),
    });
  }
  return report;
}

/* ---------------- values -> cell JSON formats ---------------- */

export const rgba = c => `rgba(${c.r},${c.g},${c.b},${c.a.toFixed(2)})`;

const WEIGHT_NAMES = { semibold: 'SemiBold', extrabold: 'ExtraBold', extralight: 'ExtraLight', ultrabold: 'UltraBold' };
const pascal = s => WEIGHT_NAMES[s.replace(/\s+/g, '').toLowerCase()] || s.replace(/\s+/g, '').replace(/^./, c => c.toUpperCase());
// "DM Sans" + "Semibold" -> "DMSans-SemiBold"
export const fontFile = (family, weight) => `${family.replace(/\s+/g, '')}-${pascal(weight)}`;

// "Body 4/Black" -> size group b4, Body Font Family, typography/Black
// "Paragraph 2/Medium" -> p2; "Heading 1/Bold" or "H1/Bold" -> h1 with Header Font Family
export function textStyle(tokens, style) {
  // A literal style for collections that don't use the BASE tokens: { font: "DMSans-Bold", size: 16, lineHeight: 20, letterSpacing: 0, heading?: 2 }
  if (style && typeof style === 'object') {
    return { font: style.font, size: style.size, lineHeight: style.lineHeight ?? Math.round(style.size * 1.25), letterSpacing: style.letterSpacing ?? 0,
      refs: { family: 'literal', weight: 'literal', size: 'literal', lh: 'literal', ls: 'literal' }, heading: style.heading || 0 };
  }
  // "Button 1" follows the brand's label style; "Button 1/Uppercase" names one explicitly.
  const bm = String(style).match(/^Button\s*(\d)\s*(?:\/\s*(Sentence|Uppercase))?$/i);
  if (bm) {
    const kase = (bm[2] || tokens.__modes?.labels || 'sentence').toLowerCase();
    const group = `button ${bm[1]}/${kase}`;
    const weightName = BUTTON_TYPES[bm[1]]?.[kase] || 'Bold';
    const weightKey = Object.keys(tokens).find(k => k.startsWith('typography/') && k.slice(11).replace(/\s+/g, '').toLowerCase() === weightName.replace(/\s+/g, '').toLowerCase());
    const need = { size: `${group}/font size`, lh: `${group}/line height`, ls: `${group}/letter spacing` };
    for (const [what, k] of Object.entries(need)) if (tokens[k] === undefined) throw new Error(`${style}: missing ${k} token (Responsive collection).`);
    if (!weightKey) throw new Error(`No weight token matches "${weightName}".`);
    return {
      font: fontFile(tokens['typography/Body Font Family'], tokens[weightKey]),
      size: tokens[need.size], lineHeight: tokens[need.lh], letterSpacing: round(tokens[need.ls], 2),
      refs: { family: 'typography/Body Font Family', weight: weightKey, ...need },
      button: { type: +bm[1], kase },
    };
  }
  // The weight is optional: "Heading 2" uses typography/Header Font Weight, "Body 2" uses Body Font Weight.
  const m = String(style).match(/^(Body|Paragraph|Heading|Header|H)\s*(\d+)\s*(?:\/\s*(.+))?$/i);
  if (!m) throw new Error(`Text style "${style}" isn't in the form "Body 4/Black" or "Heading 2".`);
  const kind = m[1].toLowerCase();
  const group = (kind === 'body' ? 'b' : kind === 'paragraph' ? 'p' : 'h') + m[2];
  const familyTok = group[0] === 'h' ? 'typography/Header Font Family' : 'typography/Body Font Family';
  const weightName = m[3] || (group[0] === 'h' ? 'Header Font Weight' : 'Body Font Weight');
  const weightKey = Object.keys(tokens).find(k => k.startsWith('typography/') &&
    k.slice(11).replace(/\s+/g, '').toLowerCase() === weightName.replace(/\s+/g, '').toLowerCase());
  if (!weightKey) throw new Error(`No weight token matches "${weightName}" (looked for typography/${weightName}).`);
  const lhKey = Object.keys(tokens).find(k => k.startsWith(`${group}/line height`));
  const need = { size: `${group}/font size`, lh: lhKey, ls: `${group}/letter spacing` };
  for (const [what, k] of Object.entries(need)) if (!k || tokens[k] === undefined) throw new Error(`${style}: missing ${group} ${what} token.`);
  return {
    font: fontFile(tokens[familyTok], tokens[weightKey]),
    size: tokens[need.size], lineHeight: tokens[need.lh], letterSpacing: round(tokens[need.ls], 2),
    refs: { family: familyTok, weight: weightKey, ...need },
    heading: group[0] === 'h' ? Math.min(6, +m[2]) : 0,
  };
}

/* ---------------- building a cell ---------------- */

const globRe = g => new RegExp('^' + g.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');

// spec: { name, text: { prefix: "Body 4/Black" }, bind: { "key or glob*": "Token/name" },
//         header?: { [choice]: { label, output, set: { key: value }, text?, bind? } } }
// base: a full cell export (all 465 style keys). opts.header picks a header choice (default: the first).
// Returns { json, report, output, header }.
// Key names differ between the mobile plugins and the web Cell 3 (cell_3_v2): buttons are
// button1_* rather than mobile_button_1_*, the container is buttons_container_*, switches are named differently.
export function pluginKeys(json) {
  const keys = new Set([...(json.config.styles || []), ...(json.config.assets || [])].map(e => e.key));
  const types = [...(json.config.styles || []), ...(json.config.assets || [])].map(e => e.type);
  // web exports (cell_3_v2, cell_2_v2, the web cell_info) use single web_font_selector font fields
  const web = json.meta?.identifier === 'cell_3_v2' || keys.has('buttons_container_switch') || types.includes('web_font_selector');
  return web
    ? { web, button: i => `button${i}`, buttonOn: 'switch', labelOn: 'enable_label_1', assetOn: 'enable_asset', container: 'buttons_container', containerOn: 'buttons_container_switch' }
    : { web, button: i => `mobile_button_${i}`, buttonOn: 'button_enabled', labelOn: 'label_enabled', assetOn: 'asset_enabled', container: 'mobile_buttons_container', containerOn: 'mobile_buttons_container_buttons_enabled' };
}
export function headerChoices(spec) { return Object.keys(spec.header || {}); }
export function contentChoices(spec) { return Object.keys(spec.content || {}); }
export function buildCell(base, spec, tokens, opts = {}) {
  const choice = spec.header ? (spec.header[opts.header] ? opts.header : headerChoices(spec)[0]) : null;
  const variant = choice ? spec.header[choice] : {};
  // content: { [type]: { label, suffix, set, text?, bind? } } — e.g. movie and show button sets
  const cChoice = spec.content ? (spec.content[opts.content] ? opts.content : contentChoices(spec)[0]) : null;
  const cv = cChoice ? spec.content[cChoice] : {};
  const json = JSON.parse(JSON.stringify(base));
  const entries = [...json.config.styles, ...json.config.assets];
  const byKey = Object.fromEntries(entries.map(e => [e.key, e]));
  const K = pluginKeys(json);
  const report = [];
  const set = (key, value, ref) => {
    if (!byKey[key]) throw new Error(`${spec.name}: "${key}" isn't a key in the base file.`);
    byKey[key].value = value; report.push({ key, ref, value });
  };

  // fixed values (switches, sizes, identifiers) that come from the design rather than a token
  for (const [key, value] of Object.entries(spec.set || {})) set(key, value, 'spec');
  for (const [key, value] of Object.entries(variant.set || {})) set(key, value, `header: ${choice}`);

  // Stack layout: place the zone's elements into its label slots.
  const stackText = {}, stackBind = {};
  let layout = null;
  if (spec.stack) {
    layout = layoutStack(spec.stack, variant.item);
    // Cell 3 zones prefix their labels (bottom_text_label_1); Cell 1 has one group (text_label_1).
    const label = spec.stack.zone ? `${spec.stack.zone}_text_label` : 'text_label';
    layout.labels.forEach((item, i) => {
      const prefix = `${label}_${i + 1}`;
      for (const [suffix, value] of Object.entries(item.props || {})) set(`${prefix}_${suffix}`, value, item.id);
      set(`${prefix}_switch`, true, item.id);
      if (item.text) stackText[prefix] = item.text;
      for (const [suffix, ref] of Object.entries(item.bind || {})) stackBind[`${prefix}_${suffix}`] = ref;
    });
    for (let i = layout.labels.length + 1; i <= layout.slots; i++) set(`${label}_${i}_switch`, false, 'unused slot');
    // Everything not a label anchors to the labels around it.
    const slotOf = id => layout.labels.findIndex(x => x.id === id) + 1;
    layout.order.forEach((item, idx) => {
      if (item.type === 'label') return;
      const after = layout.order.slice(idx + 1).find(x => x.type === 'label');
      const before = [...layout.order.slice(0, idx)].reverse().find(x => x.type === 'label');
      // an element can also pin itself somewhere else (e.g. "over_image") with `position`
      const pos = item.position || (after ? `above_${label}_${slotOf(after.id)}` : before ? `below_${label}_${slotOf(before.id)}` : null);
      if (item.type === 'image') { set('secondary_image_switch', true, item.id); if (pos) set('secondary_image_position', pos, item.id); }
      if (item.type === 'buttons' && pos) set(`${K.container}_position`, pos, item.id);
    });
    if (!layout.order.some(x => x.type === 'image') && byKey.secondary_image_switch) set('secondary_image_switch', false, 'no image in stack');
  }

  for (const [key, value] of Object.entries(cv.set || {})) set(key, value, `content: ${cChoice}`);

  for (const [prefix, style] of Object.entries({ ...(spec.text || {}), ...(variant.text || {}), ...stackText, ...(cv.text || {}) })) {
    const t = textStyle(tokens, style);
    // Runtime pill: Cell 1 and Cell 3 use runtime_font_size / runtime_line_height / runtime_ios_letter_spacing,
    // Cell 2 puts the platform first (ios_runtime_font_size, android_runtime_line_height...).
    if (prefix === 'runtime' && K.web) {
      set('runtime_font_family_font_selector', t.font, style);
      set('runtime_font_size', t.size, t.refs.size); set('runtime_line_height', t.lineHeight, t.refs.lh);
      set('runtime_letter_spacing', t.letterSpacing, t.refs.ls);
      continue;
    }
    if (prefix === 'runtime') {
      ['runtime_font_family_ios_font_selector', 'runtime_font_family_android_font_selector'].forEach(k => byKey[k] && set(k, t.font, style));
      const platFirst = !!byKey.ios_runtime_font_size;
      for (const pl of ['ios', 'android']) {
        const k = what => platFirst ? `${pl}_runtime_${what}` : `runtime_${what}`;
        set(k('font_size'), t.size, t.refs.size);
        set(k('line_height'), t.lineHeight, t.refs.lh);
        set(platFirst ? `${pl}_runtime_letter_spacing` : `runtime_${pl}_letter_spacing`, t.letterSpacing, t.refs.ls);
      }
      continue;
    }
    const isButton = /^(mobile_button_|button)\d$/.test(prefix);
    if (K.web) {
      // Web: one font for every platform, and an HTML tag (headings h1-h6, everything else p)
      set(`${prefix}_font_family`, t.font, style);
      set(`${prefix}_font_size`, t.size, t.refs.size);
      set(`${prefix}_line_height`, t.lineHeight, t.refs.lh);
      set(`${prefix}_letter_spacing`, t.letterSpacing, t.refs.ls);
      if (byKey[`${prefix}_typography`]) set(`${prefix}_typography`, t.heading ? `h${t.heading}` : 'p', style);
    } else {
    // Cell 3 labels use _ios_font_selector, Cell 1 labels _family_ios_font_selector,
    // Cell 2 labels (and all buttons) _ios_font_family.
    const fontKeys = isButton || byKey[`${prefix}_ios_font_family`] ? ['_ios_font_family', '_android_font_family']
      : byKey[`${prefix}_family_ios_font_selector`] ? ['_family_ios_font_selector', '_family_android_font_selector'] : ['_ios_font_selector', '_android_font_selector'];
    fontKeys.forEach(s => set(prefix + s, t.font, style));
    // Cell 2 labels keep a size and line height per platform.
    const plat = byKey[`${prefix}_ios_font_size`] ? ['_ios', '_android'] : [''];
    plat.forEach(pl => {
      set(`${prefix}${pl}_font_size`, t.size, t.refs.size);
      set(`${prefix}${pl}_line_height`, t.lineHeight, t.refs.lh);
    });
    set(`${prefix}_ios_letter_spacing`, t.letterSpacing, t.refs.ls);
    set(`${prefix}_android_letter_spacing`, t.letterSpacing, t.refs.ls);
    }
    // Button labels: treatment, icon size, gap and padding follow the brand's label style
    // a Button text style on a plain label (the tab Button Cell title): just the label style's case
    if (t.button && !isButton && byKey[`${prefix}_text_transform`]) set(`${prefix}_text_transform`, LABEL_STYLES[t.button.kase].transform, `label style: ${t.button.kase}`);
    if (t.button && isButton) {
      const ls = LABEL_STYLES[t.button.kase], dims = ls[t.button.type] || ls[1], why = `label style: ${t.button.kase}`;
      if (byKey[`${prefix}_text_transform`]) set(`${prefix}_text_transform`, ls.transform, why);
      ['asset_width', 'asset_height'].forEach(k => byKey[`${prefix}_${k}`] && set(`${prefix}_${k}`, dims.asset, why));
      const stacked = /^(top|above|bottom|below)$/.test(byKey[`${prefix}_asset_alignment`]?.value);
      const gk = `${prefix}_${stacked ? 'vertical' : 'horizontal'}_gutter`;
      // icon-only buttons (label off): no gap between icon and a label that isn't there
      const labelOff = byKey[`${prefix}_${K.labelOn}`]?.value === false;
      const gap = labelOff ? 0 : dims.gap, gwhy = labelOff ? 'icon-only button: no icon margin' : why;
      if (labelOff) ['vertical_gutter', 'horizontal_gutter'].forEach(g => byKey[`${prefix}_${g}`] && set(`${prefix}_${g}`, 0, gwhy));
      if (byKey[gk]) set(gk, gap, gwhy);
      // web buttons space the icon from the label with the asset's own margin
      else if (K.web && !stacked) set(`${prefix}_asset_margin_${byKey[`${prefix}_asset_alignment`]?.value === 'right' ? 'left' : 'right'}`, gap, gwhy);
      if (dims.padV !== undefined && !stacked) ['padding_top', 'padding_bottom'].forEach(k => byKey[`${prefix}_${k}`] && set(`${prefix}_${k}`, dims.padV, why));
    }
  }

  for (const [pattern, ref] of Object.entries({ ...(spec.bind || {}), ...(variant.bind || {}), ...stackBind, ...(cv.bind || {}) })) {
    const v = typeof ref === 'number' ? ref : tokens[ref] !== undefined ? tokens[ref] : tokenColor(tokens, ref) || undefined;
    if (v === undefined) throw new Error(`${spec.name}: token "${ref}" isn't in the exports (bound to ${pattern}).`);
    const keys = pattern.includes('*') ? Object.keys(byKey).filter(k => globRe(pattern).test(k)) : [pattern];
    if (!keys.length) throw new Error(`${spec.name}: "${pattern}" doesn't match any key.`);
    const out = typeof v === 'object' ? rgba(v) : v;
    keys.forEach(k => set(k, out, ref));
  }

  // Web: font fields the design doesn't set (labels that are off, the runtime pill, button second
  // labels, unused buttons) take the brand fonts too, so nothing is left on the plugin's defaults.
  if (K.web) {
    const styled = new Set(report.filter(r => /_font_family|_font_selector/.test(r.key)).map(r => r.key));
    const fallback = { button: textStyle(tokens, 'Button 1').font, label: textStyle(tokens, 'Body 2').font };
    for (const e of entries) {
      if (e.type !== 'web_font_selector' || styled.has(e.key)) continue;
      set(e.key, /^button\d/.test(e.key) ? fallback.button : fallback.label, 'brand font (field not used by the design)');
    }
  }

  // Elements are aware of each other: anything pinned to the bottom of the image sits above a progress
  // bar on the image, with the same gap to the bar as to the image's side edge (runtime, badges, action).
  const on = k => byKey[k]?.value === true;
  if (on('progress_bar_switch') && (byKey.progress_bar_position?.value || 'on_top_of_image') === 'on_top_of_image') {
    const bar = (+byKey.progress_bar_height?.value || 0) + (+byKey.progress_bar_margin_bottom?.value || 0);
    const pinned = [['runtime', 'bottom_right']];
    for (const b of ['content_badge', 'cell_badge', 'lock_badge', 'action']) if (byKey[`${b}_position`]) pinned.push([b, byKey[`${b}_position`].value]);
    for (const [el, pos] of pinned) {
      if (!on(`${el}_switch`) || !/^bottom/.test(String(pos))) continue;
      const side = /right$/.test(pos) ? 'right' : /left$/.test(pos) ? 'left' : null;
      const mb = `${el}_margin_bottom`, ms = side && `${el}_margin_${side}`;
      if (!byKey[mb] || (side && !byKey[ms])) continue;
      const gap = side ? +byKey[ms].value || 0 : +(spec.set?.[mb] ?? byKey[mb].value) || 0;
      set(mb, gap + bar, `clear of the progress bar: ${gap} gap + ${bar} bar`);
    }
  }

  // Icon-only buttons stay circular whatever the corner style, with even padding round the icon.
  for (let i = 1; i <= 3; i++) {
    const b = K.button(i);
    if (!byKey[`${b}_${K.labelOn}`] || byKey[`${b}_${K.labelOn}`].value !== false || byKey[`${b}_${K.assetOn}`]?.value === false) continue;
    if (byKey[`${b}_corner_radius`] && tokens.Round !== undefined) set(`${b}_corner_radius`, tokens.Round, 'icon only: always round');
    const pv = byKey[`${b}_padding_top`]?.value;
    if (pv !== undefined) ['padding_left', 'padding_right'].forEach(k => byKey[`${b}_${k}`] && set(`${b}_${k}`, pv, 'icon only: even padding'));
  }

  // Buttons: asset flavour follows the label colour, so icons match the text after the contrast check.
  const buttons = [];
  const container = byKey[K.containerOn];
  for (let i = 1; i <= 3; i++) {
    const b = K.button(i);
    if (!byKey[`${b}_${K.buttonOn}`]?.value || (container && !container.value)) continue;
    const action = byKey[`${b}_assign_action`]?.value;
    let flavour = byKey[`${b}_action_asset_flavour`]?.value || null;
    if (opts.actions && byKey[`${b}_action_asset_flavour`] && byKey[`${b}_font_color`]) {
      const f = flavourFor(byKey[`${b}_font_color`].value, tokens, opts.actions);
      if (f) { set(`${b}_action_asset_flavour`, f, 'label colour'); flavour = f; }
    }
    const pl = opts.actions ? pluginFor(opts.actions, action) : null;
    buttons.push({ n: i, action, flavour, iconOn: byKey[`${b}_${K.assetOn}`]?.value !== false, plugin: pl?.plugin || null, assets: pl?.assets || [] });
  }

  const m = tokens.__modes;
  json.meta.exported_on = `built from tokens · ${m.brand} · ${m.device}${m.labels ? ` · ${m.buttons} buttons, ${m.labels} labels, ${m.buttonCorners} corners` : ''}${choice ? ` · header: ${variant.label || choice}` : ''}${cChoice ? ` · content: ${cv.label || cChoice}` : ''}`;
  let output = variant.output || spec.output;
  if (cv.suffix) output = output.replace(/(_cell_\d+_(mobile|v2))?\.json$/, m => `${cv.suffix}${m}`);
  return { json, report, output, header: choice, content: cChoice, dropped: layout ? layout.dropped : [], buttons };
}

// stack: { zone: "bottom", slots: 3, items: [ { id, type: "label"|"image"|"buttons"|"header", priority, props, text, bind } ] }
// A "header" item is replaced by the chosen header's item. When there are more labels than slots,
// the lowest-priority labels are dropped first. Returns { order, labels, dropped, slots }.
export function layoutStack(stack, headerItem) {
  const slots = stack.slots || 3;
  let order = stack.items.flatMap(it => it.type === 'header' ? (headerItem ? [{ ...headerItem, id: headerItem.id || 'header' }] : []) : [it]);
  const dropped = [];
  while (order.filter(x => x.type === 'label').length > slots) {
    const victim = order.filter(x => x.type === 'label').reduce((lo, x) => ((x.priority ?? 0) < (lo.priority ?? 0) ? x : lo));
    dropped.push(victim.id);
    order = order.filter(x => x !== victim);
  }
  return { order, labels: order.filter(x => x.type === 'label'), dropped, slots };
}

/* ---------------- overlay image ---------------- */

// Vertical gradient as raw RGBA pixels. stops: [{ at: 0..1, color: {r,g,b,a} }], held flat outside the first/last stop.
export function overlayPixels(width, height, stops, layers) {
  if (layers) return layeredPixels(width, height, layers);
  const px = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const t = height === 1 ? 0 : y / (height - 1);
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) if (t >= stops[i].at && t <= stops[i + 1].at) { a = stops[i]; b = stops[i + 1]; break; }
    const f = t <= a.at ? 0 : t >= b.at ? 1 : (t - a.at) / (b.at - a.at);
    const mix = k => a.color[k] + (b.color[k] - a.color[k]) * f;
    const row = [Math.round(mix('r')), Math.round(mix('g')), Math.round(mix('b')), Math.round(mix('a') * 255)];
    for (let x = 0; x < width; x++) px.set(row, (y * width + x) * 4);
  }
  return px;
}

// overlay: { ratio, width, file?, stops: [{ at, token }] } for one top-to-bottom gradient, or
// layers: [{ from: [x, y], to: [x, y], stops: [{ at, token }] }, ...] for stacked linear gradients
// at any angle (first is the bottom layer). from/to are fractions of the frame (Figma's gradient
// handles divided by the frame size), so the overlay scales to any output size.
export function overlaySpec(spec, tokens) {
  const o = spec.overlay;
  const [rw, rh] = o.ratio.split('x').map(Number);
  const col = tok => { const c = tokenColor(tokens, tok); if (!c) throw new Error(`${spec.name}: overlay token "${tok}" isn't in the exports.`); return c; };
  const out = { file: o.file || `hero-overlay-${o.ratio}@1x.png`, width: o.width, height: Math.round(o.width * rh / rw) };
  if (o.layers) out.layers = o.layers.map(l => ({ from: l.from || [0.5, 0], to: l.to || [0.5, 1], stops: l.stops.map(s => ({ at: s.at, color: col(s.token) })) }));
  else out.stops = o.stops.map(s => ({ at: s.at, color: col(s.token) }));
  return out;
}

function gradientAt(st, t) {
  let a = st[0], b = st[st.length - 1];
  for (let i = 0; i < st.length - 1; i++) if (t >= st[i].at && t <= st[i + 1].at) { a = st[i]; b = st[i + 1]; break; }
  const f = t <= a.at ? 0 : t >= b.at ? 1 : (t - a.at) / (b.at - a.at);
  return [a.color.r + (b.color.r - a.color.r) * f, a.color.g + (b.color.g - a.color.g) * f, a.color.b + (b.color.b - a.color.b) * f, a.color.a + (b.color.a - a.color.a) * f];
}

// Stacked linear gradients, composited source-over per pixel (as Figma draws fills).
function layeredPixels(width, height, layers) {
  const px = new Uint8ClampedArray(width * height * 4);
  const L = layers.map(l => {
    const x0 = l.from[0] * width, y0 = l.from[1] * height, dx = l.to[0] * width - x0, dy = l.to[1] * height - y0;
    return { x0, y0, dx, dy, len2: dx * dx + dy * dy || 1, stops: l.stops };
  });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (const l of L) {
      const t = ((x + 0.5 - l.x0) * l.dx + (y + 0.5 - l.y0) * l.dy) / l.len2;
      const [sr, sg, sb, sa] = gradientAt(l.stops, t);
      const oa = sa + a * (1 - sa);
      if (oa) { r = (sr * sa + r * a * (1 - sa)) / oa; g = (sg * sa + g * a * (1 - sa)) / oa; b = (sb * sa + b * a * (1 - sa)) / oa; }
      a = oa;
    }
    px.set([Math.round(r), Math.round(g), Math.round(b), Math.round(a * 255)], (y * width + x) * 4);
  }
  return px;
}

// Each cell is built with its own device's Responsive mode; tags say where it can be used.
export const specDevice = spec => spec.device || 'Mobile';
// the Responsive mode (type scale) a cell is built with: web cells use Mobile for Web Mobile and
// Web Tablet, and Tablet for Web Desktop and Web Large Desktop
// collections keep separate sets of cells apart (BASE UI is the original set)
export const specCollection = spec => spec.collection || 'BASE UI';
export const specScale = spec => spec.scale || specDevice(spec);
// web cells use SVG assets; mobile cells PNG
export const specFormat = spec => spec.assets || (specDevice(spec) === 'Web' ? 'svg' : 'png');
export const specTags = spec => spec.tags || [specDevice(spec)];

/* ---------------- badge image ---------------- */

// Flattens an SVG path (M L H V C Q Z, absolute or relative) into closed polygons.
function flattenPath(d, scale, open = false) {
  const toks = d.match(/[MLHVCQZmlhvcqz]|-?(?:\d*\.\d+|\d+\.?)(?:e-?\d+)?/g) || [];
  const polys = []; let poly = null, cx = 0, cy = 0, sx = 0, sy = 0, cmd = null, i = 0;
  const num = () => parseFloat(toks[i++]);
  const pt = (x, y) => poly.push([x * scale, y * scale]);
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const ox = rel ? cx : 0, oy = rel ? cy : 0;
    if (C === 'M') { poly = []; polys.push(poly); cx = num() + ox; cy = num() + oy; sx = cx; sy = cy; pt(cx, cy); cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') { cx = num() + ox; cy = num() + oy; pt(cx, cy); }
    else if (C === 'H') { cx = num() + ox; pt(cx, cy); }
    else if (C === 'V') { cy = num() + oy; pt(cx, cy); }
    else if (C === 'C' || C === 'Q') {
      const p = C === 'C' ? [num() + ox, num() + oy, num() + ox, num() + oy, num() + ox, num() + oy] : [num() + ox, num() + oy, num() + ox, num() + oy];
      const x0 = cx, y0 = cy, steps = 24;
      for (let s = 1; s <= steps; s++) {
        const u = s / steps, v = 1 - u;
        const [x, y] = C === 'C'
          ? [v * v * v * x0 + 3 * v * v * u * p[0] + 3 * v * u * u * p[2] + u * u * u * p[4], v * v * v * y0 + 3 * v * v * u * p[1] + 3 * v * u * u * p[3] + u * u * u * p[5]]
          : [v * v * x0 + 2 * v * u * p[0] + u * u * p[2], v * v * y0 + 2 * v * u * p[1] + u * u * p[3]];
        pt(x, y);
      }
      cx = p[p.length - 2]; cy = p[p.length - 1];
    } else if (C === 'Z') { if (open) pt(sx, sy); cx = sx; cy = sy; cmd = null; if (i < toks.length && !/[a-zA-Z]/.test(toks[i])) i++; }
    else i++;
  }
  return polys.filter(p => p.length > (open ? 1 : 2));
}

// Stroked (outline) icons such as lucide: coverage of a round-capped, round-joined line of
// width icon.stroke along each subpath, 4×4 supersampled.
function strokeCoverage(icon, w, h) {
  const k = w / icon.width, half = icon.stroke * k / 2, ss = 4;
  const segs = [];
  for (const p of flattenPath(icon.path, k, true)) for (let i = 0; i < p.length - 1; i++) segs.push([...p[i], ...p[i + 1]]);
  const out = new Float32Array(w * h);
  const dist2 = (x, y, [x1, y1, x2, y2]) => {
    const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l)) : 0;
    const ex = x1 + t * dx - x, ey = y1 + t * dy - y;
    return ex * ex + ey * ey;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const xx = x + (sx + 0.5) / ss, yy = y + (sy + 0.5) / ss;
      if (segs.some(sg => dist2(xx, yy, sg) <= half * half)) c++;
    }
    out[y * w + x] = c / (ss * ss);
  }
  return out;
}

// Icon coverage (0..1) per output pixel, nonzero fill, 4×4 supersampled.
export function rasterIcon(icon, w, h) {
  const out = new Float32Array(w * h);
  if (icon.alpha) { // older raster icons: nearest sample
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      out[y * w + x] = icon.alpha[Math.min(icon.height - 1, Math.floor(y * icon.height / h)) * icon.width + Math.min(icon.width - 1, Math.floor(x * icon.width / w))] / 255;
    return out;
  }
  // several shapes (Figma exports with more than one path): union of their coverage
  if (icon.shapes) {
    const out = new Float32Array(w * h);
    for (const sh of icon.shapes) {
      const c = rasterIcon({ width: icon.width, height: icon.height, ...sh }, w, h);
      for (let k = 0; k < out.length; k++) out[k] = 1 - (1 - out[k]) * (1 - c[k]);
    }
    return out;
  }
  if (icon.stroke) return strokeCoverage(icon, w, h);
  const evenOdd = icon.rule === 'evenodd';
  const polys = flattenPath(icon.path, w / icon.width), ss = 4;
  const edges = [];
  for (const p of polys) for (let k = 0; k < p.length; k++) {
    const [x1, y1] = p[k], [x2, y2] = p[(k + 1) % p.length];
    if (y1 !== y2) edges.push([x1, y1, x2, y2]);
  }
  for (let y = 0; y < h; y++) for (let sy = 0; sy < ss; sy++) {
    const yy = y + (sy + 0.5) / ss;
    const xs = [];
    for (const [x1, y1, x2, y2] of edges) {
      if ((yy >= y1 && yy < y2) || (yy >= y2 && yy < y1)) xs.push([x1 + (yy - y1) * (x2 - x1) / (y2 - y1), y2 > y1 ? 1 : -1]);
    }
    xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let k = 0; k < xs.length - 1; k++) {
      wind += xs[k][1];
      if (evenOdd ? wind % 2 === 0 : !wind) continue;
      const a = xs[k][0], b = xs[k + 1][0];
      for (let x = Math.max(0, Math.floor(a)); x < Math.min(w, Math.ceil(b)); x++)
        for (let sx = 0; sx < ss; sx++) { const xx = x + (sx + 0.5) / ss; if (xx >= a && xx < b) out[y * w + x] += 1 / (ss * ss); }
    }
  }
  return out;
}

// A round badge (size × size pixels): a filled circle with the icon (iconPx wide) centred on it.
export function badgePixels(size, bg, icon, iconColor, iconPx = icon.width) {
  const px = new Uint8ClampedArray(size * size * 4);
  const r = size / 2, ss = 4;
  const iw = Math.round(iconPx), ih = Math.round(iconPx * icon.height / icon.width);
  const cov = rasterIcon(icon, iw, ih);
  const ox = Math.round((size - iw) / 2), oy = Math.round((size - ih) / 2);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let cover = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const dx = x + (sx + 0.5) / ss - r, dy = y + (sy + 0.5) / ss - r;
      if (dx * dx + dy * dy <= r * r) cover++;
    }
    const ca = (cover / (ss * ss)) * bg.a;
    const ix = x - ox, iy = y - oy;
    const ia = ix >= 0 && iy >= 0 && ix < iw && iy < ih ? Math.min(1, cov[iy * iw + ix]) * iconColor.a : 0;
    const a = ia + ca * (1 - ia);
    const mix = k => (a ? (iconColor[k] * ia + bg[k] * ca * (1 - ia)) / a : 0);
    px.set([Math.round(mix('r')), Math.round(mix('g')), Math.round(mix('b')), Math.round(a * 255)], (y * size + x) * 4);
  }
  return px;
}

// spec.badge (cell badge) or spec.action (action button icon):
//   { file, size (pt), scale (pixel density), bg?: token (none = transparent), icon, iconSize (pt), iconColor: token }
export function badgeSpec(spec, tokens, icons, which = 'badge') {
  const b = spec[which];
  if (!b) return null;
  // a ready-made image (e.g. a Lucide icon rendered @3x) instead of a generated one
  if (b.src) return { file: b.file, src: b.src, static: true, pt: b.size, field: b.field };
  const icon = icons[b.icon];
  if (!icon) throw new Error(`${spec.name}: icon "${b.icon}" isn't in cells/icons.`);
  for (const t of [b.bg, b.iconColor, b.stroke?.token].filter(Boolean)) if (!tokenColor(tokens, t)) throw new Error(`${spec.name}: ${which} token "${t}" isn't in the exports.`);
  const scale = b.scale || 1;
  const bg = b.bg ? tokenColor(tokens, b.bg) : { r: 0, g: 0, b: 0, a: 0 };
  // pill badges (a label such as LIVE): width x height with rounded ends, the icon (outlined text) centred
  if (b.shape === 'pill') {
    const radius = typeof b.radius === 'string' ? tokens[b.radius] : (b.radius ?? b.height / 2);
    return { file: b.file, shape: 'pill', w: b.width * scale, h: b.height * scale, ptW: b.width, ptH: b.height, radius: radius * scale, scale, bg, icon, iconColor: tokens[b.iconColor], iconPx: (b.iconSize || icon.width) * scale, field: b.field };
  }
  // stroke: { token, width } drawn inside the circle (web SVG only)
  const stroke = b.stroke ? { color: tokenColor(tokens, b.stroke.token), width: b.stroke.width || 1 } : null;
  return { file: b.file, size: b.size * scale, pt: b.size, scale, bg, icon, iconColor: tokenColor(tokens, b.iconColor), iconPx: (b.iconSize || icon.width) * scale, stroke, field: b.field };
}

/* ---------------- action plugin button assets ---------------- */

// A literal colour in a spec (collections that don't use the BASE tokens): "#rrggbb", "#rrggbbaa", "rgba(...)", "transparent".
export function literalColor(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (/^transparent$/i.test(s)) return { r: 0, g: 0, b: 0, a: 0 };
  const h = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (h) return { r: parseInt(h[1].slice(0, 2), 16), g: parseInt(h[1].slice(2, 4), 16), b: parseInt(h[1].slice(4, 6), 16), a: h[2] ? Math.round(parseInt(h[2], 16) / 2.55) / 100 : 1 };
  return /^rgba?\(/.test(s) ? parseRgba(s) : null;
}
// A token by name; "X-25%" falls back to X at 25% opacity when the export doesn't have it yet.
export function tokenColor(tokens, name) {
  if (tokens[name]) return tokens[name];
  const lit = literalColor(name);
  if (lit) return lit;
  const m = String(name).match(/^(.*)-(\d+)%$/);
  if (m && tokens[m[1]]) return { ...tokens[m[1]], a: Number(m[2]) / 100 };
  return null;
}

const lum = c => { const ch = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b); };
export const parseRgba = s => { const m = String(s).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };

// The flavour whose asset colour is closest to the button's label colour: a light label
// (on a dark button) gets flavour 1, a dark label (on a light button) gets flavour 2.
export function flavourFor(labelColor, tokens, manifest) {
  const c = typeof labelColor === 'string' ? parseRgba(labelColor) : labelColor;
  if (!c) return null;
  let best = null;
  for (const [id, f] of Object.entries(manifest.flavours)) {
    const fc = tokenColor(tokens, f.token); if (!fc) continue;
    const d = Math.abs(lum(c) - lum(fc));
    if (!best || d < best.d) best = { id, d };
  }
  return best && best.id;
}

// mobile action identifiers (navigation_action) or the web Cell 3 names (play, favorite, trailer)
export const pluginFor = (manifest, action) => manifest.plugins.find(p => p.action === action || (p.web && p.web === action)) || null;

// Every asset × flavour as { name, flavour, file, color, icon, plugin }.
export function actionAssets(manifest, tokens, icons, only) {
  const out = [];
  for (const pl of manifest.plugins) for (const name of pl.assets) {
    if (only && !only.includes(name)) continue;
    const icon = icons[name];
    if (!icon) throw new Error(`Action asset "${name}" has no geometry in actions/icons.`);
    for (const [id, f] of Object.entries(manifest.flavours)) {
      const tok = manifest.inactive.includes(name) ? f.inactive : f.token;
      const color = tokenColor(tokens, tok);
      if (!color) throw new Error(`Action asset token "${tok}" isn't in the exports.`);
      out.push({ name, flavour: id, flavourLabel: f.label, token: tok, color, icon, plugin: pl.plugin, action: pl.action,
        file: `${name}-${f.file}@${manifest.scale}x.png`, size: manifest.size * manifest.scale });
    }
  }
  return out;
}

// Transparent square with the icon filling it (the Figma frames are drawn edge to edge).
export const assetPixels = a => badgePixels(a.size, { r: 0, g: 0, b: 0, a: 0 }, a.icon, a.color, a.size);

/* ---------------- SVG assets (web) ---------------- */

const hex2 = v => Math.round(v).toString(16).padStart(2, '0');
const hexOf = c => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
const num = v => +(+v).toFixed(3);

// The overlay as an SVG the same shape as the image (o.width x o.height, from the ratio), so it
// scales with the image. Layers keep their angle because the shape never changes.
export function overlaySvg(o) {
  const W = o.width, H = o.svgHeight || o.height;
  const layers = o.layers || [{ from: [0.5, 0], to: [0.5, 1], stops: o.stops }];
  const defs = layers.map((l, i) => `<linearGradient id="g${i}" gradientUnits="userSpaceOnUse" x1="${num(l.from[0] * W)}" y1="${num(l.from[1] * H)}" x2="${num(l.to[0] * W)}" y2="${num(l.to[1] * H)}">`
    + l.stops.map(st => `<stop offset="${num(st.at)}" stop-color="${hexOf(st.color)}"${st.color.a < 1 ? ` stop-opacity="${num(st.color.a)}"` : ''}/>`).join('') + '</linearGradient>').join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${num(W)}" height="${num(H)}" viewBox="0 0 ${num(W)} ${num(H)}" preserveAspectRatio="none"><defs>${defs}</defs>`
    + layers.map((_, i) => `<rect width="${num(W)}" height="${num(H)}" fill="url(#g${i})"/>`).join('') + '</svg>';
}

// An icon's geometry as SVG, in the given colour, size x size (the Figma frames are drawn edge to edge).
export function iconSvg(icon, color, size = icon.width) {
  const fill = `${hexOf(color)}"${color.a < 1 ? ` fill-opacity="${num(color.a)}"` : ''}`;
  const strokeC = `${hexOf(color)}"${color.a < 1 ? ` stroke-opacity="${num(color.a)}"` : ''}`;
  const shape = sh => sh.stroke
    ? `<path d="${sh.path}" fill="none" stroke="${strokeC} stroke-width="${sh.stroke}" stroke-linecap="${(sh.cap || 'round').toLowerCase()}" stroke-linejoin="${(sh.join || 'round').toLowerCase()}"/>`
    : `<path d="${sh.path}" fill="${fill}${sh.rule === 'evenodd' ? ' fill-rule="evenodd" clip-rule="evenodd"' : ''}/>`;
  const body = icon.shapes ? icon.shapes.map(shape).join('') : shape(icon);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${num(size * icon.height / icon.width)}" viewBox="0 0 ${icon.width} ${icon.height}">${body}</svg>`;
}

// action assets as SVG files for web: <asset>-<flavour>.svg at the plugin's point size
export const actionSvgFile = (a, manifest) => ({ file: a.file.replace(/@\d+x\.png$/, '.svg'), svg: iconSvg(a.icon, a.color, manifest.size) });

// A round badge as SVG (web): a circle in the badge colour with the icon centred on it, at its point size.
export function badgeSvg(bs) {
  const size = bs.pt, ip = bs.iconPx / (bs.scale || 1), k = ip / bs.icon.width, ih = bs.icon.height * k;
  const fillOf = c => `fill="${hexOf(c)}"${c.a < 1 ? ` fill-opacity="${num(c.a)}"` : ''}`;
  const inner = iconSvg(bs.icon, bs.iconColor).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + (bs.bg.a ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" ${fillOf(bs.bg)}/>` : '')
    + (bs.stroke && bs.stroke.color.a ? `<circle cx="${size / 2}" cy="${size / 2}" r="${num(size / 2 - bs.stroke.width / 2)}" fill="none" stroke="${hexOf(bs.stroke.color)}"${bs.stroke.color.a < 1 ? ` stroke-opacity="${num(bs.stroke.color.a)}"` : ''} stroke-width="${num(bs.stroke.width)}"/>` : '')
    + `<g transform="translate(${num((size - ip) / 2)} ${num((size - ih) / 2)}) scale(${num(k)})">${inner}</g></svg>`;
}

// A rounded rectangle (w x h px, corner radius r) with the icon centred on it, 4x4 supersampled.
export function pillPixels(bs) {
  const { w, h, bg, icon, iconColor } = bs, r = Math.min(bs.radius, h / 2, w / 2), ss = 4;
  const px = new Uint8ClampedArray(w * h * 4);
  const iw = Math.round(bs.iconPx), ih = Math.round(bs.iconPx * icon.height / icon.width);
  const cov = rasterIcon(icon, iw, ih);
  const ox = Math.round((w - iw) / 2), oy = Math.round((h - ih) / 2);
  const inside = (x, y) => {
    const cx = Math.max(r, Math.min(w - r, x)), cy = Math.max(r, Math.min(h - r, y));
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) if (inside(x + (sx + 0.5) / ss, y + (sy + 0.5) / ss)) c++;
    const ca = (c / (ss * ss)) * bg.a, ix = x - ox, iy = y - oy;
    const ia = ix >= 0 && iy >= 0 && ix < iw && iy < ih ? Math.min(1, cov[iy * iw + ix]) * iconColor.a : 0;
    const a = ia + ca * (1 - ia), mix = k => (a ? (iconColor[k] * ia + bg[k] * ca * (1 - ia)) / a : 0);
    px.set([Math.round(mix('r')), Math.round(mix('g')), Math.round(mix('b')), Math.round(a * 255)], (y * w + x) * 4);
  }
  return px;
}
