/* Zapp Cell Style Studio: manual version (no Claude)
   The person reads the design; the studio's rules and builder do the rest. You draw a box round a cell on a
   screenshot, start from a worked example or a blank cell, and adjust it in forms that only offer what the cell
   framework can build. Everything else (engine, preview, zip, report, screens) is the shared studio.
   Loaded before studio.js, which calls: init(api), inspector(cell, box), mockSide(screen), changed(), downloadsReady(ok). */
window.STUDIO_MANUAL = (() => {
  'use strict';
  let A = null, downloadsOk = false;
  const open = new Set(['basics', 'labels', 'header', 'decisions']);   // which form sections are expanded (kept across re-renders)
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
  const setp = (o, p, v) => {
    const ks = p.split('.'); let x = o;
    ks.slice(0, -1).forEach((k, i) => { if (x[k] == null || typeof x[k] !== 'object') x[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; x = x[k]; });
    x[ks[ks.length - 1]] = v;
  };
  const famDefault = () => { for (const c of A.S.cells) for (const [f] of A.fontsIn(c.desc)) return f; return Object.keys(A.S.fonts.uploads)[0] || 'Inter'; };
  const F = (w, s, lh) => ({ family: famDefault(), weight: w, size: s, lineHeight: lh, letterSpacing: 0 });

  /* ---------- starting points ---------- */
  const DEF = {
    image: d => d.plugin === 'cell_2' ? { key: 'image_base', ratio: '16x9', width: 128, radius: 4, border: null, margin: [0, 12, 0, 0], placeholder: '#2A2A2A' }
      : { key: d.plugin === 'cell_3' ? 'thumb_2' : 'image_base', ratio: d.plugin === 'cell_3' ? '2x3' : '16x9', radius: 4, border: null, margin: [0, 0, 8, 0], placeholder: '#2A2A2A' },
    overlay: () => ({ direction: 'vertical', stops: [{ at: 0.5, color: 'rgba(0,0,0,0)' }, { at: 1, color: '#000000' }] }),
    secondaryImage: () => ({ key: 'thumb_1', width: 120, height: 40, align: 'left', margin: [0, 0, 8, 0], fit: 'bottom_left' }),
    badge: d => ({ icon: d.plugin === 'cell_2' && !d.image ? 'chevron-right' : 'play', position: d.plugin === 'cell_2' && !d.image ? 'cell_right' : 'bottom_left', width: 24, height: 24, iconSize: 14,
      color: '#FFFFFF', background: null, shape: 'square', radius: 0, margin: [0, 0, 8, 8] }),
    action: () => ({ action: 'downloads', icon: 'download', size: 44, iconSize: 24, color: '#FFFFFF', margin: [0, 0, 0, 8] }),
    runtime: () => ({ background: 'rgba(0,0,0,0.75)', color: '#FFFFFF', font: F(500, 11, 14), radius: 3, padding: [1, 5, 1, 5], margin: [0, 6, 6, 0] }),
    progress: () => ({ position: 'bottom_of_cell', height: 4, color: '#FFFFFF', track: 'rgba(255,255,255,0.25)', radius: 2, margin: [6, 0, 0, 0] }),
    buttons: () => ({ stacking: 'horizontal', align: 'left', gap: 8, margin: [12, 0, 0, 0], items: [DEF.button()] }),
    button: () => ({ action: 'navigation', label: true, text: 'Play', uppercase: false, icon: true, iconPosition: 'left', width: 'dynamic', background: '#FFFFFF', color: '#000000',
      border: null, radius: 6, padding: [10, 16, 10, 16], font: F(600, 15, 20), iconSize: 18, iconFlavour: 'dark' }),
    label: (i = 0) => ({ role: ['title', 'meta', 'description'][i] || 'label', dataKey: ['title', 'extensions.meta', 'summary'][i] || 'title', sample: ['Title', 'Meta line', 'A short description of the content.'][i] || 'Text',
      font: i ? F(400, 13, 17) : F(600, 15, 20), color: i ? '#B3B3B3' : '#FFFFFF', background: null, padding: [0, 0, 0, 0], radius: 0, align: 'left', lines: i === 2 ? 2 : 1, uppercase: false, margin: [0, 0, 4, 0] }),
  };
  const BLANKS = () => [
    { name: 'Tile', plugin: 'cell_1', purpose: 'Image with text below it.', layout: { type: 'rail', itemWidth: 160, gap: 8, padding: 16 } },
    { name: 'Row', plugin: 'cell_2', purpose: 'Image with text beside it.', layout: { type: 'list', rowGap: 12, padding: 16 } },
    { name: 'Text Block', plugin: 'cell_2', purpose: 'Text only, no image.', noImage: true, layout: { type: 'single', padding: 0 } },
    { name: 'Poster', plugin: 'cell_3', purpose: 'Text over the image.', layout: { type: 'rail', itemWidth: 120, gap: 8, padding: 16 } },
    { name: 'Rail Header', plugin: 'cell_info', purpose: 'Header above a rail or list.', layout: { type: 'single', padding: 0 } },
  ].map(b => {
    const d = { name: b.name, screen: '', purpose: b.purpose, plugin: b.plugin, status: 'as_designed', layout: b.layout, appBackground: '#121212',
      cell: { background: 'rgba(0,0,0,0)', radius: 0, padding: b.plugin === 'cell_info' ? [16, 16, 8, 16] : [0, 0, 0, 0], border: null }, labels: [], decisions: [] };
    if (b.plugin === 'cell_info') d.header = { title: { ...DEF.label(0), font: F(700, 18, 24), sample: 'Continue Watching' }, button: { text: 'View All', icon: null, iconSize: 20, font: F(500, 15, 20), color: '#FFFFFF' } };
    else {
      if (!b.noImage) d.image = DEF.image(d);
      if (b.plugin === 'cell_3') { d.zone = 'bottom'; d.labels = [{ ...DEF.label(0), margin: [0, 8, 8, 8] }]; }
      else d.labels = b.noImage ? [DEF.label(0), DEF.label(2)] : [DEF.label(0), DEF.label(1)];
    }
    return d;
  });
  // a cell must keep the parts its type needs after a type change
  function normalise(d) {
    if (d.plugin === 'cell_info') { if (!d.header) d.header = BLANKS()[4].header; return; }
    if ((d.plugin === 'cell_1' || d.plugin === 'cell_3') && !d.image) d.image = DEF.image(d);
    if (d.plugin === 'cell_3' && !d.zone) d.zone = 'bottom';
    if (!Array.isArray(d.labels) || (!d.labels.length && d.header?.title)) d.labels = d.header?.title ? [clone(d.header.title)] : [DEF.label(0)];
    if (d.plugin !== 'cell_2') { d.action = null; if (d.badge?.position === 'cell_right') d.badge.position = 'bottom_right'; }
  }

  /* ---------- form controls (every input carries the path it edits) ---------- */
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(label ?? v)}</option>`;
  const fieldRow = (label, html, wide) => `<label class="mf${wide ? ' wide' : ''}"><span>${esc(label)}</span>${html}</label>`;
  const C = {
    text: (d, p, l, o = {}) => fieldRow(l, `<input class="inp" data-p="${p}" data-t="text" value="${esc(get(d, p) ?? '')}" ${o.list ? `list="${o.list}"` : ''} placeholder="${esc(o.ph || '')}">`, o.wide),
    area: (d, p, l) => fieldRow(l, `<textarea class="inp" data-p="${p}" data-t="text" rows="2">${esc(get(d, p) ?? '')}</textarea>`, true),
    num: (d, p, l, o = {}) => fieldRow(l, `<input class="inp" type="number" step="${o.step || 'any'}" ${o.min != null ? `min="${o.min}"` : ''} ${o.max != null ? `max="${o.max}"` : ''} data-p="${p}" data-t="num" value="${esc(get(d, p) ?? '')}">`),
    sel: (d, p, l, opts, o = {}) => fieldRow(l, `<select class="inp" data-p="${p}" data-t="${o.t || 'text'}">${opts.map(x => Array.isArray(x) ? opt(x[0], get(d, p) ?? o.def, x[1]) : opt(x, get(d, p) ?? o.def)).join('')}</select>`, o.wide),
    bool: (d, p, l) => `<label class="mf chk"><input type="checkbox" data-p="${p}" data-t="bool" ${get(d, p) ? 'checked' : ''}><span>${esc(l)}</span></label>`,
    color: (d, p, l, o = {}) => {
      const v = get(d, p) ?? '', hex = /^#[0-9a-f]{6}/i.test(v) ? v.slice(0, 7) : '#000000';
      return fieldRow(l, `<span class="colr"><input type="color" value="${hex}" data-swatch="${p}" aria-label="${esc(l)} colour"><input class="inp mono" data-p="${p}" data-t="${o.nullable ? 'color?' : 'text'}" value="${esc(v)}" placeholder="${o.nullable ? 'none' : '#FFFFFF'}"></span>`);
    },
    box: (d, p, l) => {
      const b = Array.isArray(get(d, p)) ? get(d, p) : [0, 0, 0, 0];
      return fieldRow(l, `<span class="boxf" data-box="${p}">${['Top', 'Right', 'Bottom', 'Left'].map((s, i) => `<input class="inp" type="number" step="any" value="${esc(b[i] ?? 0)}" aria-label="${esc(l)} ${s}" title="${s}">`).join('')}</span>`, true);
    },
    font: (d, p, l) => {
      const f = get(d, p) || {};
      return `<div class="mf wide"><span>${esc(l)}</span><div class="fontf">
        <input class="inp" data-p="${p}.family" data-t="text" value="${esc(f.family || '')}" list="mFams" aria-label="${esc(l)} family" placeholder="Family">
        <select class="inp" data-p="${p}.weight" data-t="num" aria-label="${esc(l)} weight">${[100, 200, 300, 400, 500, 600, 700, 800, 900].map(w => opt(w, f.weight || 400, w)).join('')}</select>
        <input class="inp" type="number" step="any" data-p="${p}.size" data-t="num" value="${esc(f.size ?? '')}" aria-label="${esc(l)} size" title="Size">
        <input class="inp" type="number" step="any" data-p="${p}.lineHeight" data-t="num" value="${esc(f.lineHeight ?? '')}" aria-label="${esc(l)} line height" title="Line height">
        <input class="inp" type="number" step="any" data-p="${p}.letterSpacing" data-t="num" value="${esc(f.letterSpacing ?? 0)}" aria-label="${esc(l)} letter spacing" title="Letter spacing">
      </div><small class="hint">Family · weight · size · line height · letter spacing</small></div>`;
    },
  };
  const ROLES = () => A.ICONS.roles;
  const IMG_KEYS = [['image_base', 'image_base (landscape key art)'], ['thumb_1', 'thumb_1 (title logo)'], ['thumb_2', 'thumb_2 (poster)'], ['thumb_3', 'thumb_3 (still)']];
  const CORNERS = [['top_left', 'Top left'], ['top_right', 'Top right'], ['bottom_left', 'Bottom left'], ['bottom_right', 'Bottom right'], ['center', 'Centre']];
  const section = (key, title, body, o = {}) => `<details class="msec" data-sec="${key}" ${open.has(key) ? 'open' : ''}>
    <summary><span>${esc(title)}</span>${o.toggle != null ? `<label class="tg" title="${o.toggle ? 'Turn off' : 'Turn on'}"><input type="checkbox" data-toggle="${key}" ${o.toggle ? 'checked' : ''}><span>${o.toggle ? 'On' : 'Off'}</span></label>` : ''}${o.badge ? `<small class="hint">${esc(o.badge)}</small>` : ''}</summary>
    ${o.toggle === false ? (o.off ? `<p class="hint">${esc(o.off)}</p>` : '') : `<div class="mgrid">${body}</div>`}</details>`;

  /* ---------- the inspector: rule checks, details, every part of the cell, decisions ---------- */
  function checks(c) {
    const d = c.desc, out = [...(c.warnings || [])], noImg = !d.image;
    if (c.error) out.unshift(`This cell didn't build: ${c.error}`);
    if (d.plugin !== 'cell_info' && (d.labels || []).length > 3) out.push('A cell shows at most 3 labels: split the rest into another cell (rule 2).');
    if (noImg && d.runtime) out.push("A cell with no image can't show a runtime pill (rule 4).");
    if (noImg && d.badge && d.badge.position !== 'cell_right') out.push('A cell with no image can only show its badge in the right-hand column (rule 4).');
    if (noImg && d.secondaryImage?.position === 'over_image') out.push("There's no image for the secondary image to sit over.");
    if ((d.buttons?.items || []).length > 3) out.push('A cell has at most 3 buttons (rule 6).');
    const nav = (d.buttons?.items || []).filter(b => b.action === 'navigation' && b.label !== false).map(b => b.text);
    if (new Set(nav).size > 1) out.push('Two navigation buttons with different labels need a second navigation plugin (rule 6).');
    if (d.status === 'as_designed' && (d.decisions || []).some(x => x.type === 'changed')) out.push('There are changes listed, so the result is probably Adapted or Workaround.');
    if (d.status !== 'as_designed' && !(d.decisions || []).some(x => x.type === 'changed')) out.push('Say what changed and why, so the report can explain it.');
    return out;
  }
  function inspector(c, box) {
    const d = c.desc, P = d.plugin, hasImg = !!d.image, nLab = (d.labels || []).length;
    const fams = [...new Set([...A.S.cells.flatMap(x => [...A.fontsIn(x.desc).keys()]), ...Object.keys(A.S.fonts.uploads), 'Inter', 'DM Sans', 'Roboto', 'Poppins', 'Figtree', 'Manrope'])];
    const chk = checks(c);
    const labelCard = (l, i) => `<div class="mcard"><div class="mcard-h"><b>Label ${i + 1}</b><span class="hint">${esc(l.role || '')}</span>
        <span class="acts"><button class="btn ghost small" data-act="lab-up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Move label ${i + 1} up">↑</button><button class="btn ghost small" data-act="lab-down" data-i="${i}" ${i < nLab - 1 ? '' : 'disabled'} aria-label="Move label ${i + 1} down">↓</button><button class="btn ghost small" data-act="lab-rm" data-i="${i}">Remove</button></span></div>
      <div class="mgrid">${C.text(d, `labels.${i}.sample`, 'Sample text', { wide: true })}${C.text(d, `labels.${i}.role`, 'Role')}${C.text(d, `labels.${i}.dataKey`, 'Data key', { list: 'mKeys' })}
        ${C.font(d, `labels.${i}.font`, 'Type')}${C.color(d, `labels.${i}.color`, 'Colour')}${C.color(d, `labels.${i}.background`, 'Background', { nullable: true })}
        ${C.sel(d, `labels.${i}.align`, 'Align', ['left', 'center', 'right'])}${C.num(d, `labels.${i}.lines`, 'Lines', { min: 1, step: 1 })}${C.num(d, `labels.${i}.radius`, 'Corner radius')}${C.bool(d, `labels.${i}.uppercase`, 'Uppercase')}
        ${C.box(d, `labels.${i}.padding`, 'Padding')}${C.box(d, `labels.${i}.margin`, 'Margin')}</div></div>`;
    const btnCard = (b, i) => {
      const n = (d.buttons.items || []).length, wmode = typeof b.width === 'number' ? 'fixed' : (b.width || 'dynamic');
      return `<div class="mcard"><div class="mcard-h"><b>Button ${i + 1}</b><span class="acts"><button class="btn ghost small" data-act="btn-up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Move button ${i + 1} up">↑</button><button class="btn ghost small" data-act="btn-down" data-i="${i}" ${i < n - 1 ? '' : 'disabled'} aria-label="Move button ${i + 1} down">↓</button><button class="btn ghost small" data-act="btn-rm" data-i="${i}">Remove</button></span></div>
        <div class="mgrid">${C.sel(d, `buttons.items.${i}.action`, 'Action', [['navigation', 'Navigation (open / play)'], ['favourites', 'Favourites (my list)'], ['share', 'Share'], ['downloads', 'Downloads'], ['trailer', 'Trailer']])}
          ${C.text(d, `buttons.items.${i}.text`, 'Label (set on the plugin)')}${C.bool(d, `buttons.items.${i}.label`, 'Show label')}${C.bool(d, `buttons.items.${i}.uppercase`, 'Uppercase')}
          ${fieldRow('Icon', `<select class="inp" data-p="buttons.items.${i}.icon" data-t="icon">${opt('none', b.icon ? (b.icon === true ? 'plugin' : b.icon) : 'none', 'No icon')}${opt('plugin', b.icon === true ? 'plugin' : '', "The action's own icon")}${ROLES().map(r => opt(r, b.icon)).join('')}</select>`)}
          ${C.sel(d, `buttons.items.${i}.iconPosition`, 'Icon position', [['left', 'Left'], ['right', 'Right'], ['top', 'Above the label']])}${C.num(d, `buttons.items.${i}.iconSize`, 'Icon size')}
          ${C.sel(d, `buttons.items.${i}.iconFlavour`, 'Icon flavour', [['light', 'Light (for dark buttons)'], ['dark', 'Dark (for light buttons)']])}
          ${fieldRow('Width', `<span class="row" style="gap:6px;flex-wrap:nowrap"><select class="inp" data-p="buttons.items.${i}.width" data-t="width">${opt('fill', wmode, 'Full width')}${opt('dynamic', wmode, 'Fits its label')}${opt('fixed', wmode, 'Fixed')}</select>${wmode === 'fixed' ? `<input class="inp" type="number" data-p="buttons.items.${i}.width" data-t="num" value="${esc(b.width)}" style="width:80px" aria-label="Fixed width">` : ''}</span>`)}
          ${C.color(d, `buttons.items.${i}.background`, 'Background')}${C.color(d, `buttons.items.${i}.color`, 'Text and icon')}${C.num(d, `buttons.items.${i}.radius`, 'Corner radius')}
          ${C.font(d, `buttons.items.${i}.font`, 'Label type')}${C.box(d, `buttons.items.${i}.padding`, 'Padding')}</div></div>`;
    };
    const secPos = d.secondaryImage ? (d.secondaryImage.position === 'over_image' ? 'over' : d.secondaryImage.beforeLabel ? `above_${d.secondaryImage.beforeLabel}` : 'below') : 'below';
    const hb = d.header?.button, hmode = !hb ? 'none' : hb.text ? 'text' : hb.icon ? 'icon' : 'none';

    box.innerHTML = `
      <div class="sec"><div class="row" style="justify-content:space-between"><span class="lab">Cell</span><span class="row" style="gap:6px">
        <button class="btn small" data-act="dup" type="button">Duplicate</button><button class="btn small" data-act="rm" type="button">Remove</button></span></div>
        <div class="row" style="gap:6px"><button class="btn small" data-act="dl" type="button" ${downloadsOk ? '' : 'disabled title="Saving files needs you to be signed in to Claude"'}>Download this cell</button><button class="btn small" data-act="copy" type="button">Copy JSON</button><button class="btn small" data-act="crop" type="button">${c.crop ? 'Change original' : 'Pick original'}</button></div>
        ${chk.length ? `<div class="checks"><span class="lab">Rule checks</span>${chk.map(w => `<div class="warn">${esc(w)}</div>`).join('')}</div>` : '<p class="hint ok">Nothing breaks the rules.</p>'}
      </div>
      <datalist id="mFams">${fams.map(f => `<option value="${esc(f)}">`).join('')}</datalist>
      <datalist id="mKeys"><option value="title"><option value="summary"><option value="extensions.genre"><option value="extensions.meta"><option value="extensions.runtime"><option value="extensions.episode"><option value="extensions.tag"></datalist>
      <div class="sec mforms">
      ${section('basics', 'Basics', `${C.text(d, 'name', 'Name', { wide: true })}
        ${C.sel(d, 'plugin', 'Type', [['cell_1', 'Cell 1 · text below the image'], ['cell_2', 'Cell 2 · text beside the image, or no image'], ['cell_3', 'Cell 3 · text over the image'], ['cell_info', 'Group Info · rail or list header']], { wide: true })}
        ${C.sel(d, 'status', 'Result', Object.entries(A.STATUS))}${C.text(d, 'screen', 'Screen')}
        ${C.area(d, 'purpose', 'What it is')}
        ${C.color(d, 'appBackground', 'Screen colour')}
        ${C.sel(d, 'layout.type', 'Placed in', [['single', 'Single (full width)'], ['rail', 'Rail (horizontal list)'], ['list', 'List (vertical)']], { def: 'single' })}
        ${d.layout?.type === 'rail' ? C.num(d, 'layout.itemWidth', 'Item width') + C.num(d, 'layout.gap', 'Gap') : ''}${d.layout?.type === 'list' ? C.num(d, 'layout.rowGap', 'Row gap') : ''}
        ${C.num(d, 'layout.padding', 'Side inset')}`)}
      ${section('cellbox', 'Cell box', `${C.color(d, 'cell.background', 'Background')}${C.num(d, 'cell.radius', 'Corner radius')}${C.box(d, 'cell.padding', 'Padding')}
        ${P === 'cell_2' ? C.color(d, 'cell.dividerBottom.color', 'Bottom divider colour', { nullable: true }) + C.num(d, 'cell.dividerBottom.thickness', 'Divider thickness') : ''}`)}
      ${P === 'cell_info' ? `
        ${section('header', 'Header title', `${C.text(d, 'header.title.sample', 'Sample title', { wide: true })}${C.text(d, 'header.title.dataKey', 'Data key', { list: 'mKeys' })}
          ${C.font(d, 'header.title.font', 'Type')}${C.color(d, 'header.title.color', 'Colour')}${C.num(d, 'header.title.lines', 'Lines', { min: 1, step: 1 })}${C.bool(d, 'header.title.uppercase', 'Uppercase')}
          <p class="hint wide">Line the title up with the first item of the rail below when the design does (rule 7): set the cell's left padding to the rail's side inset.</p>`)}
        ${section('hbtn', 'Header button', `${fieldRow('Button', `<select class="inp" data-p="header.button" data-t="hmode">${opt('none', hmode, 'None')}${opt('text', hmode, 'Text (e.g. View All)')}${opt('icon', hmode, 'Icon only (e.g. a chevron)')}</select>`)}
          ${hmode === 'text' ? C.text(d, 'header.button.text', 'Text') + C.font(d, 'header.button.font', 'Type') : ''}
          ${hmode === 'icon' ? fieldRow('Icon', `<select class="inp" data-p="header.button.icon" data-t="text">${ROLES().map(r => opt(r, hb.icon)).join('')}</select>`) + C.num(d, 'header.button.iconSize', 'Icon size') : ''}
          ${hmode !== 'none' ? C.color(d, 'header.button.color', 'Colour') : ''}
          <p class="hint wide">A chevron straight after a title is a call to action: build it as an icon-only button on the right (rule 1).</p>`)}`
      : `
        ${section('image', 'Image', `${C.sel(d, 'image.key', 'Feed image', IMG_KEYS, { wide: true })}${C.text(d, 'image.ratio', 'Ratio', { list: 'mRatios', ph: '16x9' })}
          ${P === 'cell_2' ? C.num(d, 'image.width', 'Width') : ''}${C.num(d, 'image.radius', 'Corner radius')}${C.color(d, 'image.placeholder', 'Placeholder')}${C.box(d, 'image.margin', P === 'cell_2' ? 'Margin (right = gap to text)' : 'Margin (bottom = gap to text)')}
          <datalist id="mRatios">${['16x9', '4x3', '1x1', '3x4', '2x3', '9x16'].map(r => `<option value="${r}">`).join('')}</datalist>`,
          { toggle: P === 'cell_2' ? hasImg : null, off: 'Text only. Turn on for a picture beside the text.' })}
        ${hasImg ? section('overlay', 'Gradient over the image', `${C.num(d, 'overlay.stops.0.at', 'Starts at (0 to 1)', { min: 0, max: 1, step: 0.05 })}${C.color(d, 'overlay.stops.0.color', 'Start colour')}${C.color(d, 'overlay.stops.1.color', 'End colour')}
          <p class="hint wide">Drawn as an overlay image in the download (rule 3).</p>`, { toggle: !!d.overlay }) : ''}
        ${P === 'cell_3' ? section('zone', 'Text position', C.sel(d, 'zone', 'Text sits', [['top', 'Top of the image'], ['center', 'Centre'], ['bottom', 'Bottom']])) : ''}
        ${section('labels', `Labels (${nLab} of 3)`, `${(d.labels || []).map(labelCard).join('')}
          <div class="wide row"><button class="btn small" data-act="lab-add" ${nLab >= 3 ? 'disabled' : ''}>Add label</button>${nLab >= 3 ? '<span class="hint">A cell shows at most 3 labels. Put the rest in a second cell placed directly below (rule 0 and 2).</span>' : ''}</div>`)}
        ${section('secondary', 'Secondary image', `${C.sel(d, 'secondaryImage.key', 'Feed image', IMG_KEYS, { wide: true })}${C.num(d, 'secondaryImage.width', 'Width')}${C.num(d, 'secondaryImage.height', 'Height')}
          ${fieldRow('Position', `<select class="inp" data-p="secondaryImage" data-t="secpos">${opt('below', secPos, 'Below the last label')}${[1, 2, 3].slice(0, Math.max(1, nLab)).map(n => opt(`above_${n}`, secPos, `Above label ${n}`)).join('')}${hasImg ? opt('over', secPos, 'Over the image') : ''}</select>`)}
          ${secPos === 'over' ? C.sel(d, 'secondaryImage.corner', 'Corner', CORNERS, { def: 'bottom_left' }) : C.sel(d, 'secondaryImage.align', 'Align', ['left', 'center', 'right'])}
          ${C.box(d, 'secondaryImage.margin', 'Margin')}
          <p class="hint wide">Title logos (a name drawn as artwork) are always this, reading thumb_1 (rule 3).</p>`, { toggle: !!d.secondaryImage })}
        ${section('badge', 'Cell badge', `${fieldRow('Icon', `<select class="inp" data-p="badge.icon" data-t="text">${ROLES().map(r => opt(r, d.badge?.icon)).join('')}</select>`)}
          ${C.sel(d, 'badge.position', 'Position', [...(hasImg ? CORNERS : []), ...(P === 'cell_2' ? [['cell_right', 'Right-hand column']] : [])])}
          ${C.num(d, 'badge.width', 'Width')}${C.num(d, 'badge.height', 'Height')}${C.num(d, 'badge.iconSize', 'Icon size')}${C.color(d, 'badge.color', 'Icon colour')}
          ${C.color(d, 'badge.background', 'Plate behind the icon', { nullable: true })}${C.sel(d, 'badge.shape', 'Plate shape', [['square', 'Square'], ['rounded', 'Rounded'], ['circle', 'Circle']])}${d.badge?.shape === 'rounded' ? C.num(d, 'badge.radius', 'Corner radius') : ''}
          ${C.box(d, 'badge.margin', 'Margin')}<p class="hint wide">A static image the studio draws in the design's shape and puts in the download (rule 4).</p>`, { toggle: !!d.badge })}
        ${P === 'cell_2' ? section('action', 'Action icon (right-hand column)', `${C.sel(d, 'action.action', 'Action', [['downloads', 'Downloads'], ['favourites', 'Favourites']])}
          ${fieldRow('Icon', `<select class="inp" data-p="action.icon" data-t="text">${ROLES().map(r => opt(r, d.action?.icon)).join('')}</select>`)}${C.num(d, 'action.size', 'Tap area')}${C.num(d, 'action.iconSize', 'Icon size')}${C.color(d, 'action.color', 'Colour')}${C.box(d, 'action.margin', 'Margin')}`, { toggle: !!d.action }) : ''}
        ${hasImg ? section('runtime', 'Duration pill', `${C.color(d, 'runtime.background', 'Background')}${C.color(d, 'runtime.color', 'Text')}${C.font(d, 'runtime.font', 'Type')}${C.num(d, 'runtime.radius', 'Corner radius')}${C.box(d, 'runtime.padding', 'Padding')}${C.box(d, 'runtime.margin', 'Margin')}
          <p class="hint wide">Always bottom right of the image (rule 4).</p>`, { toggle: !!d.runtime }) : ''}
        ${section('progress', 'Progress bar', `${C.sel(d, 'progress.position', 'Position', [...(hasImg ? [['on_image', 'On the image']] : []), ['above_label_1', 'Above label 1'], ['below_label_1', 'Below label 1'], ['above_label_2', 'Above label 2'], ['below_label_2', 'Below label 2'], ['bottom_of_cell', 'Bottom of the cell']], { wide: true })}
          ${C.num(d, 'progress.height', 'Height')}${C.num(d, 'progress.radius', 'Corner radius')}${C.color(d, 'progress.color', 'Bar')}${C.color(d, 'progress.track', 'Track')}${C.box(d, 'progress.margin', 'Margin')}
          <p class="hint wide">A label can't share the bar's line: put it on the line above and leave room with a right margin (rule 4).</p>`, { toggle: !!d.progress })}
        ${section('buttons', `Buttons (${(d.buttons?.items || []).length} of 3)`, d.buttons ? `${C.sel(d, 'buttons.stacking', 'Stacking', [['horizontal', 'Side by side'], ['vertical', 'Stacked']])}${C.sel(d, 'buttons.align', 'Align', [['left', 'Left'], ['center', 'Centre']])}
          ${C.num(d, 'buttons.gap', 'Gap')}${fieldRow('After', `<select class="inp" data-p="buttons.afterLabel" data-t="num?">${opt('', d.buttons.afterLabel ?? '', 'The last label')}${(d.labels || []).map((l, i) => opt(i + 1, d.buttons.afterLabel ?? '', `Label ${i + 1}`)).join('')}</select>`)}
          ${C.box(d, 'buttons.margin', 'Margin')}${(d.buttons.items || []).map(btnCard).join('')}
          <div class="wide row"><button class="btn small" data-act="btn-add" ${(d.buttons.items || []).length >= 3 ? 'disabled' : ''}>Add button</button><span class="hint">Labels and icons are set once per action for the whole app (rule 6).</span></div>` : '', { toggle: !!d.buttons })}`}
      ${section('decisions', `What works and what changed (${(d.decisions || []).length})`, `${(d.decisions || []).map((x, i) => `<div class="mcard dec-${esc(x.type)}"><div class="mcard-h">
          <select class="inp" data-p="decisions.${i}.type" data-t="text" style="width:auto">${opt('works', x.type, 'Works')}${opt('changed', x.type, 'Changed')}${opt('alternative', x.type, 'Alternative')}</select>
          <span class="acts"><button class="btn ghost small" data-act="dec-rm" data-i="${i}">Remove</button></span></div>
          <div class="mgrid">${x.type === 'changed' ? C.text(d, `decisions.${i}.item`, 'What changed', { wide: true }) : ''}${C.area(d, `decisions.${i}.text`, 'In a sentence, for the customer')}</div></div>`).join('')}
        <div class="wide row"><button class="btn small" data-act="dec-add">Add a line</button>
          <select class="inp" data-act="dec-preset" style="flex:1;min-width:160px"><option value="">Add a common change from the rules…</option>${(A.K.decisions || []).map((x, i) => `<option value="${i}">${esc(x.item ? `${x.item}: ${x.text}` : `Alternative: ${x.text}`)}</option>`).join('')}</select></div>`)}
      </div>`;
  }

  // one listener for every form in the inspector
  let pending = null;
  const rebuildSoon = (c, rerender) => { clearTimeout(pending); pending = setTimeout(async () => { await A.buildCell(c); rerender ? A.renderAll() : (A.renderStage(), refreshGrid(), A.renderFontPanel(), changed(), refreshChecks(c)); }, 250); };
  const refreshGrid = () => { const sel = A.S.sel; const keep = document.activeElement?.closest('#insp'); if (!keep) A.renderAll(); else { const c = A.S.cells.find(x => x.id === sel); const card = document.querySelector(`#grid .card[data-id="${sel}"] .thumbs div:last-child img`); if (card && c?.snap) card.src = c.snap; } };
  const refreshChecks = c => {
    const host = document.querySelector('#insp .sec'); if (!host) return;
    const old = host.querySelector('.checks, .hint.ok'), chk = checks(c), el = document.createElement('div');
    el.innerHTML = chk.length ? `<div class="checks"><span class="lab">Rule checks</span>${chk.map(w => `<div class="warn">${esc(w)}</div>`).join('')}</div>` : '<p class="hint ok">Nothing breaks the rules.</p>';
    old?.replaceWith(el.firstElementChild);
  };
  function bindInspector() {
    const box = $('insp');
    const cell = () => A.S.cells.find(x => x.id === A.S.sel);
    box.addEventListener('toggle', e => { const s = e.target.closest?.('details[data-sec]'); if (s) s.open ? open.add(s.dataset.sec) : open.delete(s.dataset.sec); }, true);
    box.addEventListener('input', e => { const sw = e.target.dataset.swatch; if (sw) { const t = box.querySelector(`[data-p="${CSS.escape(sw)}"]`); if (t) t.value = e.target.value.toUpperCase(); } });
    box.addEventListener('change', e => {
      const c = cell(); if (!c) return; const d = c.desc, t = e.target;
      if (t.dataset.swatch) { setp(d, t.dataset.swatch, t.value.toUpperCase()); return rebuildSoon(c); }
      if (t.dataset.toggle) {
        const k = t.dataset.toggle;
        if (t.checked) { d[k] = DEF[k](d); open.add(k); if (k === 'image' && d.badge?.position === 'cell_right') {} }
        else { d[k] = null; if (k === 'image') { d.overlay = null; d.runtime = null; if (d.badge && d.badge.position !== 'cell_right') d.badge.position = 'cell_right'; if (d.secondaryImage?.position === 'over_image') { delete d.secondaryImage.position; delete d.secondaryImage.corner; } } }
        return rebuildSoon(c, true);
      }
      if (t.dataset.act === 'dec-preset') {
        const x = A.K.decisions[+t.value]; if (!x) return;
        (d.decisions ||= []).push({ type: x.type, ...(x.item ? { item: x.item } : {}), text: x.text });
        if (x.type === 'changed' && d.status === 'as_designed') d.status = /Split/.test(x.item) ? 'workaround' : 'adapted';
        open.add('decisions'); return rebuildSoon(c, true);
      }
      const box4 = t.closest('[data-box]');
      if (box4) { setp(d, box4.dataset.box, [...box4.querySelectorAll('input')].map(i => +i.value || 0)); return rebuildSoon(c); }
      const p = t.dataset.p; if (!p) return;
      const ty = t.dataset.t, v = t.value;
      let structural = false;
      if (ty === 'num') setp(d, p, v === '' ? null : +v);
      else if (ty === 'num?') setp(d, p, v === '' ? undefined : +v);
      else if (ty === 'bool') { setp(d, p, t.checked); }
      else if (ty === 'color?') setp(d, p, v.trim() || null);
      else if (ty === 'icon') setp(d, p, v === 'none' ? false : v === 'plugin' ? true : v);
      else if (ty === 'width') { setp(d, p, v === 'fixed' ? 240 : v); structural = true; }
      else if (ty === 'hmode') {
        const prev = d.header.button || {}, base = { iconSize: prev.iconSize || 20, font: prev.font || F(500, 15, 20), color: prev.color || '#FFFFFF' };
        d.header.button = v === 'none' ? null : v === 'text' ? { ...base, text: prev.text || 'View All', icon: null } : { ...base, text: null, icon: prev.icon || 'chevron-right' };
        structural = true;
      } else if (ty === 'secpos') {
        const s = d.secondaryImage; delete s.position; delete s.corner; delete s.beforeLabel;
        if (v === 'over') { s.position = 'over_image'; s.corner = 'bottom_left'; } else if (v.startsWith('above_')) s.beforeLabel = +v.slice(6);
        structural = true;
      } else {
        const old = get(d, p); setp(d, p, v);
        if (p === 'name' && old !== v) { for (const s of A.S.screens) for (const it of s.layout || []) if (it.cell === old) it.cell = v; structural = true; }
        if (p === 'plugin') { normalise(d); structural = true; }
        if (p === 'layout.type' || p.endsWith('.type') || p === 'badge.shape' || p.endsWith('.role')) structural = true;
      }
      rebuildSoon(c, structural);
    });
    box.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT') return;
      const c = cell(); if (!c) return; const d = c.desc, i = +b.dataset.i, mv = (arr, a, z) => { if (z < 0 || z >= arr.length) return; [arr[a], arr[z]] = [arr[z], arr[a]]; };
      switch (b.dataset.act) {
        case 'lab-add': (d.labels ||= []).push(DEF.label(d.labels.length)); break;
        case 'lab-rm': d.labels.splice(i, 1); break;
        case 'lab-up': mv(d.labels, i, i - 1); break;
        case 'lab-down': mv(d.labels, i, i + 1); break;
        case 'btn-add': d.buttons.items.push(DEF.button()); break;
        case 'btn-rm': d.buttons.items.splice(i, 1); if (!d.buttons.items.length) d.buttons = null; break;
        case 'btn-up': mv(d.buttons.items, i, i - 1); break;
        case 'btn-down': mv(d.buttons.items, i, i + 1); break;
        case 'dec-add': (d.decisions ||= []).push({ type: 'changed', item: '', text: '' }); open.add('decisions'); A.renderInspector(); return;
        case 'dec-rm': d.decisions.splice(i, 1); A.renderInspector(); changed(); return;
        case 'rm': return removeCell(c);
        case 'dup': return duplicate(c);
        case 'dl': return A.downloadZip([c], `${A.C.slug(d.name)}.zip`);
        case 'copy': return copyJson(c);
        case 'crop': return openDialog({ cell: c });
        default: return;
      }
      rebuildSoon(c, true);
    });
  }
  async function copyJson(c) {
    if (!c.json) return A.toast('This cell has not built yet.');
    const txt = JSON.stringify(c.json);
    try { await navigator.clipboard.writeText(txt); A.toast(`Copied ${c.output}. Paste it into a .json file to import it.`); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = txt; ta.className = 'inp mono'; ta.style.cssText = 'position:fixed;inset:20% 10%;z-index:40;height:50%';
      document.body.append(ta); ta.select(); A.toast('Press Ctrl+C or Cmd+C to copy, then click anywhere.');
      setTimeout(() => document.addEventListener('click', () => ta.remove(), { once: true }), 50);
    }
  }
  function removeCell(c) {
    const S = A.S, at = S.cells.indexOf(c); S.cells.splice(at, 1);
    S.sel = (S.cells[at] || S.cells[at - 1] || {}).id || null; A.renderAll();
    A.toast(`Removed ${c.desc.name}`, { label: 'Undo', run: () => { S.cells.splice(at, 0, c); S.sel = c.id; A.renderAll(); } });
  }
  async function duplicate(c) {
    const d = clone(c.desc); let n = 2; while (A.findCell(`${c.desc.name} ${n}`)) n++; d.name = `${c.desc.name} ${n}`;
    const copy = { ...c, id: A.uid(), desc: d, screens: [...(c.screens || [])] };
    A.S.cells.splice(A.S.cells.indexOf(c) + 1, 0, copy); A.S.sel = copy.id;
    await A.buildCell(copy); A.renderAll(); A.toast(`Added ${d.name}`);
  }

  /* ---------- new cell: pick a screen, draw a box round the cell, choose a starting point ---------- */
  let dlg = null;
  function openDialog({ cell = null } = {}) {
    const S = A.S;
    dlg = { cell, scr: (cell && S.screens.find(s => s.id === cell.screenId)) || S.screens[0] || null, rect: null, tpl: null };
    const tpls = [...BLANKS().map(d => ({ d, group: 'Blank' })), ...(A.K.examples.cells || []).map(d => ({ d, group: 'Worked examples' }))];
    dlg.tpls = tpls;
    $('mDlg').innerHTML = `<div class="dlg-box" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
      <div class="row" style="justify-content:space-between"><h2 id="dlgTitle">${cell ? `Original for ${esc(cell.desc.name)}` : 'New cell'}</h2><button class="btn ghost small" data-dlg="close" aria-label="Close">Close</button></div>
      <div class="dlg-body">
        <div class="dlg-shot">
          ${S.screens.length ? `<div class="row"><label class="hint" for="dlgScr">Screen</label><select class="inp" id="dlgScr" style="width:auto">${S.screens.map(s => opt(s.id, dlg.scr?.id, s.name)).join('')}</select><span class="hint">Drag a box round one example of the cell.</span></div>
            <div class="shot" id="dlgShot"><img id="dlgImg" alt="" draggable="false"><div class="sel" id="dlgSel" hidden></div></div>`
          : '<div class="empty"><b>No screenshots yet</b><span>You can still build a cell, but add screenshots on the Designs tab to compare against the original.</span></div>'}
        </div>
        ${cell ? '' : `<div class="dlg-side">
          <label class="mf"><span>Name</span><input class="inp" id="dlgName" placeholder="e.g. Poster Tile"></label>
          <span class="lab">Start from</span>
          <div class="tpls">${['Blank', 'Worked examples'].map(g => `<span class="hint">${g === 'Blank' ? 'A blank cell of each type' : 'Worked examples from a reviewed build'}</span>` + tpls.map((t, i) => t.group !== g ? '' : `<button class="tpl" data-tpl="${i}" type="button"><b>${esc(t.d.name)}</b><small>${esc(A.TYPE[t.d.plugin])} · ${esc(t.d.purpose || '')}</small></button>`).join('')).join('')}</div>
        </div>`}
      </div>
      <div class="row" style="justify-content:flex-end"><span class="hint" id="dlgMsg"></span><button class="btn" data-dlg="close">Cancel</button><button class="btn primary" data-dlg="ok" id="dlgOk">${cell ? 'Use this area' : 'Add cell'}</button></div></div>`;
    $('mDlg').hidden = false;
    showShot();
    $('dlgScr')?.addEventListener('change', e => { dlg.scr = S.screens.find(s => s.id === e.target.value); dlg.rect = null; showShot(); });
    (cell ? $('dlgOk') : $('dlgName'))?.focus();
  }
  function showShot() {
    const img = $('dlgImg'); if (!img || !dlg.scr) return;
    img.src = dlg.scr.url; $('dlgSel').hidden = true;
    if (dlg.cell?.desc.bbox && dlg.cell.screenId === dlg.scr.id) { dlg.rect = { ...dlg.cell.desc.bbox }; drawSel(); }
  }
  function drawSel() {
    const s = $('dlgSel'), r = dlg.rect; if (!s) return;
    if (!r) { s.hidden = true; return; }
    Object.assign(s.style, { left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' }); s.hidden = false;
  }
  function bindDialog() {
    const host = $('mDlg');
    let start = null;
    host.addEventListener('pointerdown', e => {
      const shot = e.target.closest('#dlgShot'); if (!shot) return;
      const b = $('dlgImg').getBoundingClientRect(); e.preventDefault(); shot.setPointerCapture(e.pointerId);
      start = { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height, b };
    });
    host.addEventListener('pointermove', e => {
      if (!start) return; const { b } = start, cl = v => Math.max(0, Math.min(1, v));
      const x = cl((e.clientX - b.left) / b.width), y = cl((e.clientY - b.top) / b.height);
      dlg.rect = { x: Math.min(x, start.x), y: Math.min(y, start.y), w: Math.abs(x - start.x), h: Math.abs(y - start.y) }; drawSel();
    });
    host.addEventListener('pointerup', () => { start = null; if (dlg?.rect && (dlg.rect.w < 0.01 || dlg.rect.h < 0.005)) { dlg.rect = null; drawSel(); } });
    host.addEventListener('click', e => {
      const t = e.target.closest('[data-tpl]');
      if (t) { dlg.tpl = dlg.tpls[+t.dataset.tpl]; host.querySelectorAll('.tpl').forEach(x => x.setAttribute('aria-pressed', x === t)); const n = $('dlgName'); if (n && !n.value) n.placeholder = dlg.tpl.d.name; return; }
      const a = e.target.closest('[data-dlg]')?.dataset.dlg;
      if (a === 'close' || e.target === host) { host.hidden = true; dlg = null; }
      else if (a === 'ok') finishDialog();
    });
    host.addEventListener('keydown', e => { if (e.key === 'Escape') { host.hidden = true; dlg = null; } });
  }
  async function finishDialog() {
    const S = A.S, scr = dlg.scr, r = dlg.rect;
    if (dlg.cell) {
      const c = dlg.cell; c.screenId = scr?.id || null; c.desc.bbox = r || null; c.crop = r && scr ? A.cropOf(scr, r) : null;
      if (scr && !c.screens.includes(scr.name)) c.screens.push(scr.name);
      $('mDlg').hidden = true; dlg = null; A.renderAll(); return;
    }
    if (!dlg.tpl) { $('dlgMsg').textContent = 'Choose a starting point.'; return; }
    const d = clone(dlg.tpl.d);
    let name = ($('dlgName').value || '').trim() || d.name, n = 2; const baseName = name;
    while (A.findCell(name)) name = `${baseName} ${n++}`;
    d.name = name; d.screen = scr?.name || d.screen || 'Screens'; d.bbox = r || null;
    if (dlg.tpl.group === 'Worked examples') d.decisions = (d.decisions || []).filter(x => x.type === 'works').slice(0, 1);
    normalise(d);
    const c = { id: A.uid(), desc: d, screenId: scr?.id || null, screens: scr ? [scr.name] : [], crop: r && scr ? A.cropOf(scr, r) : null };
    S.cells.push(c); S.sel = c.id;
    if (scr) (scr.layout ||= []).push({ cell: name, component: d.layout?.type === 'rail' ? 'rail' : d.layout?.type === 'list' ? 'list' : 'single', ...(d.layout?.type === 'rail' ? { count: 3 } : d.layout?.type === 'list' ? { count: 2 } : {}) });
    $('mDlg').hidden = true; dlg = null;
    A.show('cells'); open.add('basics'); open.add('labels');
    await A.buildCell(c); A.renderAll(); A.toast(`Added ${name}. Adjust it on the right to match the original.`);
  }

  /* ---------- screens: place cells as components ---------- */
  function mockSide(scr) {
    const L = scr.layout || [], names = A.S.cells.map(c => c.desc.name);
    return `<div class="mside" data-scr="${esc(scr.id)}"><span class="lab">Components, top to bottom</span>
      ${L.length ? `<div class="lay">${L.map((it, i) => `<div class="lrow">
        <span class="hint">${i + 1}</span>
        <select class="inp" data-l="cell" data-i="${i}" aria-label="Cell">${names.includes(it.cell) ? '' : opt(it.cell, it.cell, `${it.cell} (removed)`)}${names.map(n => opt(n, it.cell)).join('')}</select>
        <select class="inp" data-l="component" data-i="${i}" aria-label="Component">${[['single', 'Single'], ['rail', 'Rail'], ['list', 'List'], ['grid', 'Grid']].map(([v, l]) => opt(v, it.component || 'single', l)).join('')}</select>
        ${it.component && it.component !== 'single' ? `<input class="inp" type="number" min="1" max="18" data-l="count" data-i="${i}" value="${esc(it.count || 3)}" aria-label="Items shown" title="Items shown">` : '<span></span>'}
        ${it.component === 'grid' ? `<input class="inp" type="number" min="1" max="6" data-l="columns" data-i="${i}" value="${esc(it.columns || 3)}" aria-label="Columns" title="Columns">` : '<span></span>'}
        <span class="acts"><button class="btn ghost small" data-l="up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button class="btn ghost small" data-l="down" data-i="${i}" ${i < L.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button><button class="btn ghost small" data-l="rm" data-i="${i}" aria-label="Remove">✕</button></span>
      </div>`).join('')}</div>` : '<p class="hint">Nothing placed yet.</p>'}
      ${names.length ? `<div class="row"><button class="btn small" data-l="add">Add a component</button></div>` : '<p class="hint">Build cells first, then place them here.</p>'}
      <p class="hint">Sample text and placeholder artwork. Rails show the number of items you set; the status bar, navigation and tab bars aren't cells.</p></div>`;
  }
  function bindMock() {
    const box = $('mock'), scrOf = el => A.S.screens.find(s => s.id === el.closest('[data-scr]')?.dataset.scr);
    box.addEventListener('change', e => {
      const t = e.target, scr = scrOf(t); if (!scr || !t.dataset.l) return; const it = scr.layout[+t.dataset.i];
      if (t.dataset.l === 'count' || t.dataset.l === 'columns') it[t.dataset.l] = Math.max(1, +t.value || 1);
      else { it[t.dataset.l] = t.value; if (t.dataset.l === 'component' && t.value !== 'single' && !it.count) it.count = 3; }
      A.renderMock(); changed();
    });
    box.addEventListener('click', e => {
      const b = e.target.closest('button[data-l]'); if (!b) return; const scr = scrOf(b); if (!scr) return; const L = scr.layout, i = +b.dataset.i;
      if (b.dataset.l === 'add') { const c = A.S.cells[A.S.cells.length - 1]; L.push({ cell: c.desc.name, component: c.desc.layout?.type === 'rail' ? 'rail' : 'single', ...(c.desc.layout?.type === 'rail' ? { count: 3 } : {}) }); }
      if (b.dataset.l === 'rm') L.splice(i, 1);
      if (b.dataset.l === 'up' && i) [L[i - 1], L[i]] = [L[i], L[i - 1]];
      if (b.dataset.l === 'down' && i < L.length - 1) [L[i + 1], L[i]] = [L[i], L[i + 1]];
      A.renderMock(); changed();
    });
  }

  /* ---------- rules reference (the studio's learnings, readable) ---------- */
  function md(src) {
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
    const out = []; let list = null, table = null;
    const flush = () => { if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; } if (table) { out.push(`<table>${table.join('')}</table>`); table = null; } };
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^\|/.test(l)) { if (/^\|[-| ]+\|$/.test(l)) continue; (table ||= []).push(`<tr>${l.split('|').slice(1, -1).map(c => `<${table.length ? 'td' : 'th'}>${inline(c.trim())}</${table.length ? 'td' : 'th'}>`).join('')}</tr>`); continue; }
      if (/^- /.test(l)) { let t = l.slice(2); while (lines[i + 1] && /^ {2}\S/.test(lines[i + 1])) t += ' ' + lines[++i].trim(); (list ||= []).push(`<li>${inline(t)}</li>`); continue; }
      if (/^\d+\. /.test(l)) { let t = l.replace(/^\d+\. /, ''); while (lines[i + 1] && /^ {3}\S/.test(lines[i + 1])) t += ' ' + lines[++i].trim(); (list ||= []).push(`<li>${inline(t)}</li>`); continue; }
      flush();
      if (/^# /.test(l)) out.push(`<h1>${inline(l.slice(2))}</h1>`);
      else if (/^## /.test(l)) out.push(`<h2>${inline(l.slice(3))}</h2>`);
      else if (l.trim()) { let t = l; while (lines[i + 1] && lines[i + 1].trim() && !/^(#|- |\||\d+\. )/.test(lines[i + 1])) t += ' ' + lines[++i]; out.push(`<p>${inline(t)}</p>`); }
    }
    flush(); return out.join('');
  }

  /* ---------- keeping work: browser autosave, and project files to move it between people ---------- */
  const KEY = 'zapp-cell-studio-manual-v1';
  const blobToDataUrl = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(b); });
  const dataUrlToBlob = u => { const [h, b] = u.split(','), bin = atob(b), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: (h.match(/:(.*?);/) || [])[1] || 'image/png' }); };
  async function serialise({ images = true, crops = true, fonts = true } = {}) {
    const S = A.S;
    return { app: 'zapp-cell-style-studio', version: 1, rules: A.K.version, collection: $('collection').value, icons: S.icons, fontPicks: S.fonts.picks,
      fonts: fonts ? Object.values(S.fonts.uploads).flatMap(u => u.faces.map(f => ({ file: f.file, data: A.b64(f.data) }))) : [],
      screens: await Promise.all(S.screens.map(async s => ({ id: s.id, name: s.name, device: s.device, screenW: s.screenW, layout: s.layout || [], image: images ? (s.dataUrl ||= await blobToDataUrl(s.blob)) : null }))),
      cells: S.cells.map(c => ({ id: c.id, desc: c.desc, screenId: c.screenId, screens: c.screens, crop: crops ? c.crop : null })) };
  }
  let saveT = null, restoring = false;
  function changed() {
    if (restoring || !A) return;
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      for (const o of [{}, { images: false, fonts: false }, { images: false, fonts: false, crops: false }]) {
        try { localStorage.setItem(KEY, JSON.stringify(await serialise(o))); $('saveState').textContent = o.images === false ? 'Saved in this browser (without screenshots: save a project file to keep them)' : 'Saved in this browser'; return; }
        catch (e) { /* too big for browser storage: try smaller */ }
      }
      $('saveState').textContent = "Too big to keep in this browser: save a project file.";
    }, 800);
  }
  async function restore(p, { replace = true } = {}) {
    if (!p || p.app !== 'zapp-cell-style-studio' || !Array.isArray(p.cells)) throw new Error("That isn't a Cell Style Studio project file.");
    const S = A.S; restoring = true;
    try {
      if (replace) { S.cells = []; S.screens = []; S.sel = null; }
      if (p.collection != null) $('collection').value = p.collection;
      if (p.icons) { S.icons = { ...S.icons, ...p.icons }; S.iconsTouched = true; }
      if (Array.isArray(p.fontPicks)) S.fonts.picks = p.fontPicks;
      if (p.fonts?.length) await A.addFontFiles(p.fonts.map(f => new File([dataUrlToBlob('data:font/ttf;base64,' + f.data)], f.file)));
      const ids = {};
      for (const s of p.screens || []) {
        if (!s.image) { S.screens.push({ id: s.id, name: s.name, device: s.device, screenW: s.screenW, layout: s.layout || [], url: '', img: null, w: 393, h: 852, missing: true }); ids[s.id] = s.id; continue; }
        const scr = await A.addScreen({ name: s.name, blob: dataUrlToBlob(s.image), device: s.device, screenW: s.screenW, layout: s.layout || [], id: s.id });
        if (scr) { scr.dataUrl = s.image; ids[s.id] = scr.id; }
      }
      for (const c of p.cells) {
        const cell = { id: c.id || A.uid(), desc: c.desc, screenId: ids[c.screenId] || null, screens: c.screens || [], crop: c.crop || null };
        if (!cell.crop && cell.desc.bbox) { const scr = S.screens.find(s => s.id === cell.screenId && s.img); if (scr) cell.crop = A.cropOf(scr, cell.desc.bbox); }
        S.cells.push(cell); await A.buildCell(cell);
      }
      S.sel = S.cells[0]?.id || null;
      A.renderIconPanel(); A.renderScreens(); A.renderAll();
    } finally { restoring = false; }
  }
  async function saveProject() {
    const name = `${A.C.slug(A.collection())}-project.json`;
    A.save(name, JSON.stringify(await serialise()));
  }

  /* ---------- page set-up for the manual version ---------- */
  async function init(api) {
    A = api; A.K.decisions = A.K.decisions || [];
    document.title = 'Cell Style Studio Manual';
    document.querySelector('.brand').innerHTML = '<span class="mark" aria-hidden="true"><i></i></span>Cell Style Studio <small>Zapp · manual</small><small id="saveState" class="savest"></small>';
    // Designs: screenshots and fonts only; the next step is building cells by hand
    $('figmaUrl')?.closest('.field')?.remove();
    $('analyse').textContent = 'Build cells'; $('analyse').onclick = e => { e.stopImmediatePropagation(); A.show('cells'); if (!A.S.cells.length) openDialog(); };
    $('log').remove();
    $('aiHint').textContent = 'This version works without Claude: you build each cell from the screenshots, guided by the rules.';
    $('scrHint').textContent = 'Add screens, then build their cells.';
    const obs = new MutationObserver(() => { $('analyse').disabled = false; }); obs.observe($('analyse'), { attributes: true, attributeFilter: ['disabled'] }); $('analyse').disabled = false;
    // Cells: a New cell button
    const ph = document.querySelector('#v-cells .ph');
    ph.insertAdjacentHTML('beforeend', '<button class="btn small primary" id="newCell" type="button">New cell</button>');
    $('newCell').onclick = () => openDialog();
    // Rules tab
    document.querySelector('[role=tablist]').insertAdjacentHTML('beforeend', '<button role="tab" id="t-rules" aria-controls="v-rules" aria-selected="false">Rules</button>');
    document.querySelector('main').insertAdjacentHTML('beforeend', `<section class="view" id="v-rules" role="tabpanel" aria-labelledby="t-rules" hidden><div class="panel"><div class="doc rules">${md(A.K.rules)}</div></div></section>`);
    // project files and save state
    document.querySelector('.top .actions').insertAdjacentHTML('afterbegin', `<label class="btn" for="openProject">Open project</label><input type="file" id="openProject" accept=".json,application/json" hidden>
      <button class="btn" id="saveProject" type="button">Save project</button>`);
    $('saveProject').onclick = saveProject;
    $('openProject').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { await restore(JSON.parse(await f.text())); A.toast(`Opened ${f.name}`); changed(); } catch (err) { A.toast(err.message || "That file couldn't be opened."); }
    };
    document.body.insertAdjacentHTML('beforeend', '<div class="dlg" id="mDlg" hidden></div>');
    bindInspector(); bindDialog(); bindMock();
    applyDownloads();
    // pick up where this browser left off
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) { await restore(JSON.parse(saved)); if (A.S.cells.length) A.toast(`Restored ${A.S.cells.length} cell${A.S.cells.length === 1 ? '' : 's'} from this browser`); }
    } catch (e) { console.warn('restore', e); }
    A.renderAll();
  }
  function applyDownloads() {
    if (!A) return;
    const off = !downloadsOk, why = 'Saving files needs you to be signed in to Claude. Use Copy JSON on a cell instead.';
    for (const id of ['dlAll', 'dlReport', 'saveProject']) { const b = $(id); if (b) { b.disabled = off; b.title = off ? why : ''; } }
    if (off && $('saveState')) $('saveState').textContent = 'Signed out: work is kept in this browser; use Copy JSON to take cells out.';
  }
  function downloadsReady(ok) { downloadsOk = ok; applyDownloads(); }

  return { init, inspector, mockSide, changed, downloadsReady };
})();
