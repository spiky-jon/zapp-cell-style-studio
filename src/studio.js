/* Zapp Cell Style Studio
   Designs (screenshots or Figma frames) -> Claude describes each cell style using the bundled rules (knowledge.js)
   -> convert.js turns each description into a build spec -> the cell engine (engine.js, the Zapp cell preview in a
   hidden frame) builds the importable JSON and renders it -> gallery, inspector, zip download, comparison report. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const K = window.KNOWLEDGE, BASES = window.CELL_BASES, C = window.Convert;
  const S = { screens: [], cells: [], sel: null, example: true, busy: false, icons: { library: 'lucide', light: '#FFFFFF', dark: '#121212', why: '' }, iconsTouched: false };
  const ICONS = K.icons;
  let engine = null, sample = null, downloads = null, mcp = null, figmaSession = null;
  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = (msg, action) => {
    const t = $('toast'), b = $('toastBtn'); $('toastMsg').textContent = msg;
    b.hidden = !action; if (action) { b.textContent = action.label; b.onclick = () => { t.classList.remove('on'); action.run(); }; }
    t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), action ? 6000 : 2600);
  };
  const STATUS = { as_designed: 'As designed', adapted: 'Adapted', workaround: 'Workaround' };
  const TYPE = { cell_1: 'Cell 1', cell_2: 'Cell 2', cell_3: 'Cell 3', cell_info: 'Group Info' };
  const collection = () => $('collection').value.trim() || 'Studio';

  /* ---------- engine (hidden frame) ---------- */
  function bootEngine() {
    return new Promise((ok, fail) => {
      const f = $('engine');
      f.addEventListener('load', () => {
        const w = f.contentWindow, t0 = Date.now();
        (function wait() { if (w.CellEngine) ok(w); else if (Date.now() - t0 > 15000) fail(new Error("The cell engine didn't start.")); else setTimeout(wait, 50); })();
      }, { once: true });
      f.srcdoc = window.ENGINE_HTML;
    });
  }
  const loadedFonts = new Set();
  async function ensureFonts(families) {
    const doc = engine.document;
    for (const fam of families || []) {
      if (!fam || loadedFonts.has(fam) || /^(SF|San Francisco|-apple|system)/i.test(fam)) continue;
      loadedFonts.add(fam);
      engine.CellEngine.registerFont(C.famPrefix(fam), fam);
      const l = doc.createElement('link'); l.rel = 'stylesheet';
      l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam).replace(/%20/g, '+')}:wght@300;400;500;600;700;800;900&display=swap`;
      doc.head.append(l);
      await new Promise(r => { l.onload = l.onerror = r; setTimeout(r, 2500); });
      try { await Promise.all([400, 500, 700].map(w => doc.fonts.load(`${w} 16px "${fam}"`))); } catch (e) { /* falls back */ }
    }
  }

  /* ---------- icons: role -> PNG @3x from the chosen library ---------- */
  const iconCache = new Map();
  function iconSvg(role) {
    const lib = ICONS.libraries[S.icons.library] || ICONS.libraries.lucide;
    return lib.icons[role] || ICONS.libraries.lucide.icons[role] || lib.icons['chevron-right'];
  }
  async function iconPng(role, { size = 24, iconSize, color = '#FFFFFF', circle = null } = {}) {
    const key = [S.icons.library, role, size, iconSize, color, circle].join('|');
    if (iconCache.has(key)) return iconCache.get(key);
    const k = 3, px = Math.round(size * k), ip = Math.round((iconSize || size) * k);
    const svg = iconSvg(role).replace('<svg', `<svg width="${ip}" height="${ip}" style="color:${color}"`);
    const img = new Image();
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = () => fail(new Error(`Icon ${role} didn't draw.`)); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d');
    if (circle) { g.fillStyle = circle; g.beginPath(); g.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2); g.fill(); }
    // play glyphs sit a touch right of centre so they look centred in a circle
    const nudge = circle && role === 'play' ? ip * 0.06 : 0;
    g.drawImage(img, (px - ip) / 2 + nudge, (px - ip) / 2, ip, ip);
    const url = c.toDataURL('image/png'); iconCache.set(key, url); return url;
  }
  async function drawAssets(list) {
    const out = [];
    for (const a of list || []) {
      const color = a.kind === 'button' ? (a.flavour === 'flavour_2' ? S.icons.dark : S.icons.light) : a.color;
      try { out.push({ ...a, color, dataUrl: await iconPng(a.role, { size: a.size, iconSize: a.iconSize, color, circle: a.circle }) }); } catch (e) { console.warn(e); }
    }
    return out;
  }

  /* ---------- build one cell: description -> spec -> JSON -> render -> snapshot ---------- */
  async function buildCell(c) {
    c.error = null; c.warnings = [];
    try {
      const scr = S.screens.find(s => s.id === c.screenId);
      const conv = C.toSpec(c.desc, { device: scr?.device || c.desc.device, screenW: scr?.screenW, collection: collection() });
      c.spec = conv.spec; c.base = conv.base; c.warnings = conv.warnings;
      await ensureFonts(conv.fonts);
      const built = engine.CellEngine.buildCell(BASES[conv.base], c.spec);
      c.json = built.json; c.output = built.output; c.overlay = built.overlay;
      c.assets = await drawAssets(conv.assets);
      const r = renderInEngine(c);
      c.size = { w: r.width, h: r.height };
      c.notes = (r.notes || []).filter(n => !/style keys from the full set|Upload the real image|stand-in/i.test(n));
      await new Promise(r => setTimeout(r, 60));
      c.snap = await engine.CellEngine.snapshot({ scale: 2, pad: 12 });
      c.snapRaw = await engine.CellEngine.snapshot({ scale: 2, pad: 0 });
    } catch (e) { c.error = e.message || String(e); console.error(e); }
  }

  function renderOpts(c) {
    const lay = c.spec.layout || {}, A = k => (c.assets || []).find(a => a.kind === k)?.dataUrl || null;
    const actionPng = {};
    for (const a of (c.assets || []).filter(a => a.kind === 'button')) (actionPng[a.asset] ||= {})[a.flavour] = a.dataUrl;
    return { screenW: c.spec.screen, pad: lay.padding || 0, layout: lay.type ? lay : null, appBg: c.spec.appBg, overlay: c.overlay?.dataUrl,
      title: c.spec.sampleTitle || 'Content Title', summary: c.spec.sampleSummary, ext: c.spec.sampleFeed,
      badge: A('badge'), action: A('action'), infoIcon: A('header'), actionPng };
  }
  const renderInEngine = c => engine.CellEngine.render(c.json, renderOpts(c));

  /* ---------- crops ---------- */
  function cropOf(scr, bbox) {
    if (!scr || !bbox) return null;
    const W = scr.w, H = scr.h, pad = 0.01;
    const x = Math.max(0, (bbox.x - pad) * W), y = Math.max(0, (bbox.y - pad) * H);
    const w = Math.min(W - x, (bbox.w + pad * 2) * W), h = Math.min(H - y, (bbox.h + pad * 2) * H);
    if (w < 4 || h < 4) return null;
    const c = document.createElement('canvas'); const k = Math.min(1, 1400 / w); c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(scr.img, x, y, w, h, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.9);
  }

  /* ---------- screens ---------- */
  function addScreen({ name, blob, source = 'upload', meta = '' }) {
    const url = URL.createObjectURL(blob), img = new Image();
    return new Promise(ok => {
      img.onload = () => {
        const device = $('device').value, screenW = Math.max(240, +$('screenW').value || (device === 'tablet' ? 1133 : 393));
        S.screens.push({ id: uid(), name: name.replace(/\.(png|jpe?g|webp)$/i, ''), blob, url, img, w: img.naturalWidth, h: img.naturalHeight, device, screenW, source, meta, state: 'new' });
        renderScreens(); ok();
      };
      img.onerror = () => { toast(`${name} isn't an image the browser can read.`); ok(); };
      img.src = url;
    });
  }
  function renderScreens() {
    $('nScreens').textContent = S.screens.length;
    const box = $('screens');
    if (!S.screens.length) { box.innerHTML = '<div class="empty" style="grid-column:1/-1"><b>No screens yet</b><span>Add screenshots or a Figma link on the left.</span></div>'; }
    else box.innerHTML = S.screens.map(s => `<div class="scr"><div class="thumb"><img src="${s.url}" alt="${esc(s.name)}">${s.state !== 'new' ? `<span class="state">${esc(s.state)}</span>` : ''}</div>
      <div class="meta"><b title="${esc(s.name)}">${esc(s.name)}</b><button class="btn ghost small" data-rm="${s.id}" aria-label="Remove ${esc(s.name)}">Remove</button></div>
      <span class="hint">${s.device === 'tablet' ? 'Tablet' : 'Phone'} · ${s.screenW}pt · ${s.w}×${s.h}px${s.source === 'figma' ? ' · Figma' : ''}</span></div>`).join('');
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { S.screens = S.screens.filter(s => s.id !== b.dataset.rm); renderScreens(); });
    $('analyse').disabled = !S.screens.length || S.busy || !sample;
    $('scrHint').textContent = S.screens.length ? `${S.screens.length} screen${S.screens.length > 1 ? 's' : ''}` : 'Add screens, then find their cells.';
  }
  $('files').addEventListener('change', async e => { for (const f of e.target.files) await addScreen({ name: f.name, blob: f }); e.target.value = ''; });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', async e => { for (const f of e.dataTransfer.files) if (f.type.startsWith('image/')) await addScreen({ name: f.name, blob: f }); });
  $('device').addEventListener('change', () => { $('screenW').value = $('device').value === 'tablet' ? 1133 : 393; });

  /* ---------- Figma ---------- */
  function parseFigma(u) {
    const m = String(u).match(/figma\.com\/(?:design|file)\/([0-9a-zA-Z]{22,128})(?:\/branch\/([0-9a-zA-Z]{22,128}))?[^?]*(?:\?.*node-id=([0-9]+[-:][0-9]+))?/);
    return m ? { fileKey: m[2] || m[1], nodeId: m[3] ? m[3].replace('-', ':') : null } : null;
  }
  const textOf = res => (res?.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const imageOf = res => (res?.content || []).find(b => b.type === 'image' && b.data);
  async function figmaCall(tool, input) { return mcp.callTool('Figma', tool, input); }
  $('figmaAdd').addEventListener('click', async () => {
    const ref = parseFigma($('figmaUrl').value);
    const msg = $('figmaMsg');
    if (!ref) { msg.textContent = 'Paste a figma.com/design link.'; return; }
    if (!mcp) { msg.textContent = "Figma isn't available in this view. Add screenshots instead."; return; }
    if (!ref.nodeId) { msg.textContent = 'Link to a page or section: right-click it in Figma, Copy link to selection.'; return; }
    $('figmaAdd').disabled = true; msg.textContent = 'Reading the file…';
    try {
      if (!figmaSession || figmaSession.fileKey !== ref.fileKey) {
        const s = await figmaCall('create_session', { fileKey: ref.fileKey, description: 'Read app screen frames to turn them into Zapp cell styles' });
        const id = (textOf(s).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0] || (s.payload && (s.payload.sessionId || s.payload.id));
        figmaSession = { fileKey: ref.fileKey, id };
      }
      const sid = figmaSession.id ? { sessionId: figmaSession.id } : {};
      const meta = textOf(await figmaCall('get_metadata', { fileKey: ref.fileKey, nodeId: ref.nodeId, ...sid }));
      // top-level frames under the linked node become screens; a linked frame on its own is one screen
      const frames = [...meta.matchAll(/<frame[^>]*\bid="([^"]+)"[^>]*\bname="([^"]*)"[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/g)]
        .map(m => ({ id: m[1], name: m[2], w: +m[3], h: +m[4] })).filter(f => f.w >= 300 && f.w <= 1600 && f.h >= 400);
      const depthOk = frames.filter(f => f.id !== ref.nodeId);
      const list = (depthOk.length ? depthOk : frames).slice(0, 12);
      if (!list.length) throw new Error('No screen-sized frames found under that link.');
      let n = 0;
      for (const f of list) {
        msg.textContent = `Exporting ${++n} of ${list.length}: ${f.name}`;
        const shot = await figmaCall('get_screenshot', { fileKey: ref.fileKey, nodeId: f.id, maxDimension: Math.round(f.h * 3 > 4000 ? 4000 : f.h * 3), enableBase64Response: true, ...sid });
        const im = imageOf(shot); if (!im) continue;
        const bin = atob(im.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        $('device').value = f.w > 700 ? 'tablet' : 'phone'; $('screenW').value = Math.round(f.w);
        await addScreen({ name: f.name || `Frame ${f.id}`, blob: new Blob([u8], { type: im.mimeType || 'image/png' }), source: 'figma',
          meta: meta.split('\n').filter(l => l.includes(`"${f.id}"`) || l.includes(f.name)).slice(0, 1).join('') });
      }
      msg.textContent = `Added ${n} frame${n === 1 ? '' : 's'}.`;
    } catch (e) { msg.textContent = e?.code === 'server_not_connected' || e?.code === 'not_connected' ? 'Connect Figma on Claude first, then try again.' : (e?.message || 'Figma read failed.'); }
    finally { $('figmaAdd').disabled = false; }
  });

  /* ---------- analysis with Claude ---------- */
  const log = line => { const l = $('log'); l.hidden = false; l.textContent += (l.textContent ? '\n' : '') + line; l.scrollTop = l.scrollHeight; };
  function promptFor(scr, known) {
    return [
      'You convert mobile app screen designs into Zapp cell styles (importable JSON for the Zapp app platform).',
      'Follow the RULES exactly. Answer with JSON only, in the FORMAT, no prose.',
      '', '# RULES', K.rules, '', '# FORMAT', K.schema, '', '# WORKED EXAMPLES (from a reviewed build; match this level of detail)', JSON.stringify(K.examples),
      '', '# THIS SCREEN',
      `The attached image is the "${scr.name}" screen. It is ${scr.w} px wide and ${scr.h} px tall. The screen is ${scr.screenW} points wide (${scr.device}), so 1 point = ${(scr.w / scr.screenW).toFixed(3)} px. Give every size in points.`,
      scr.meta ? `Figma layer data for this frame: ${scr.meta.slice(0, 2000)}` : '',
      known.length ? `Cell styles already described from other screens (do NOT describe these again; list their names in "seen" if they appear here): ${known.map(c => `${c.desc.name} (${c.desc.plugin}): ${c.desc.purpose || ''}`).join(' | ')}` : '',
      'Return the whole response described under "Whole response" in the FORMAT: cells, seen, screen (this screen top to bottom as components, using exact cell names) and icons.',
      S.iconsSet || S.iconsTouched ? `The icon library is already chosen (${S.icons.library}); repeat it in "icons".` : '',
      'Include every distinct content cell style on the screen (headers, tiles, rows, heroes, banners, info blocks, button rows). Skip the status bar, app navigation bar, tab strips and bottom tab bar.',
    ].filter(Boolean).join('\n');
  }
  async function analyse() {
    if (!sample || S.busy || !S.screens.length) return;
    S.busy = true; $('analyse').disabled = true; $('log').textContent = '';
    if (S.example) { S.cells = []; S.example = false; }
    const todo = S.screens.filter(s => s.state !== 'Done');
    for (const scr of todo) {
      scr.state = 'Reading…'; renderScreens(); log(`${scr.name}: reading the screen…`);
      try {
        const res = await sample.json(promptFor(scr, S.cells), { images: [scr.blob], modelTier: 'complex', cache: false });
        const found = Array.isArray(res?.cells) ? res.cells : [];
        for (const d of found) {
          if (!d || !d.name) continue;
          if (S.cells.some(c => c.desc.name.toLowerCase() === d.name.toLowerCase())) continue;
          const c = { id: uid(), desc: d, screenId: scr.id, screens: [scr.name], crop: cropOf(scr, d.bbox) };
          S.cells.push(c);
          log(`  ${d.name}: building (${TYPE[d.plugin] || d.plugin})`);
          await buildCell(c); renderAll();
        }
        if (Array.isArray(res?.screen)) scr.layout = res.screen.filter(x => x && x.cell);
        if (res?.icons?.library && ICONS.libraries[res.icons.library] && !S.iconsTouched && !S.iconsSet) {
          S.icons = { library: res.icons.library, light: C.color(res.icons.light, '#FFFFFF'), dark: C.color(res.icons.dark, '#121212'), why: res.icons.why || '' };
          S.iconsSet = true; renderIconPanel();
          for (const c of S.cells) await buildCell(c);
        }
        for (const n of res?.seen || []) { const c = S.cells.find(x => x.desc.name.toLowerCase() === String(n).toLowerCase()); if (c && !c.screens.includes(scr.name)) c.screens.push(scr.name); }
        scr.state = 'Done'; log(`${scr.name}: ${found.length} new cell style${found.length === 1 ? '' : 's'}.`);
      } catch (e) {
        scr.state = 'Failed';
        log(`${scr.name}: ${e?.code === 'not_granted' ? 'Claude access was declined.' : e?.code === 'rate_limited' ? 'Claude is busy; try again in a minute.' : (e?.message || 'failed')}`);
        if (e?.code === 'not_granted') break;
      }
      renderScreens();
    }
    S.busy = false; renderScreens(); renderAll();
    if (S.cells.length) { S.sel = S.sel || S.cells[0].id; show('cells'); toast(`${S.cells.length} cell styles ready`); }
  }
  $('analyse').addEventListener('click', analyse);

  /* ---------- views ---------- */
  function show(v) {
    for (const t of ['import', 'cells', 'screens', 'compare']) { $('t-' + t).setAttribute('aria-selected', t === v); $('v-' + t).hidden = t !== v; }
    if (v === 'compare') renderDoc();
    if (v === 'screens') renderMock();
    try { localStorage.setItem('css.view', v); } catch (e) {}
  }
  for (const t of ['import', 'cells', 'screens', 'compare']) $('t-' + t).addEventListener('click', () => show(t));
  $('goImport').addEventListener('click', () => show('import'));

  const cellBg = c => c.spec?.appBg || '#121212';
  function renderAll() {
    $('nCells').textContent = S.cells.length;
    $('exampleBanner').hidden = !S.example;
    $('listHint').textContent = S.cells.length ? `${S.cells.length}` : '';
    // list grouped by screen
    const groups = new Map();
    for (const c of S.cells) { const k = c.desc.screen || c.screens?.[0] || 'Cells'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
    $('list').innerHTML = S.cells.length ? [...groups].map(([g, cs]) => `<h3>${esc(g)}</h3>` + cs.map(c => `<button class="item" data-id="${c.id}" aria-current="${c.id === S.sel}">
      <b>${esc(c.desc.name)}</b><span class="dot ${esc(c.desc.status || 'adapted')}" title="${esc(STATUS[c.desc.status] || '')}"></span><small>${esc(TYPE[c.desc.plugin] || c.desc.plugin)}${c.error ? ' · build error' : ''}</small></button>`).join('')).join('')
      : '<div class="empty"><b>No cells yet</b><span>Add designs and find their cells.</span></div>';
    $('list').querySelectorAll('.item').forEach(b => b.onclick = () => { S.sel = b.dataset.id; renderAll(); });
    $('grid').innerHTML = S.cells.map(c => `<button class="card" data-id="${c.id}" aria-current="${c.id === S.sel}">
      <div class="thumbs"><div style="background:var(--chip)">${c.crop ? `<img src="${c.crop}" alt="">` : '<span class="hint">No original</span>'}</div><div style="background:${esc(cellBg(c))}">${c.snap ? `<img src="${c.snap}" alt="">` : ''}</div></div>
      <div class="t"><b>${esc(c.desc.name)}</b><span class="pill ${esc(c.desc.status)}">${esc(STATUS[c.desc.status] || '')}</span></div></button>`).join('');
    $('grid').querySelectorAll('.card').forEach(b => b.onclick = () => { S.sel = b.dataset.id; renderAll(); $('stage').scrollIntoView({ block: 'nearest' }); });
    renderStage(); renderInspector();
  }
  function decisionsHtml(d) {
    const icon = { works: '✓', changed: '!', alternative: '→' };
    return `<ul class="dec">${(d.decisions || []).map(x => `<li class="${esc(x.type)}"><i aria-hidden="true">${icon[x.type] || '·'}</i><span>${x.item ? `<b>${esc(x.item)}.</b> ` : ''}${esc(x.text)}</span></li>`).join('')}</ul>`;
  }
  function renderStage() {
    const c = S.cells.find(x => x.id === S.sel) || S.cells[0];
    if (!c) { $('stage').innerHTML = '<div class="empty"><b>Nothing to show</b><span>Cells appear here once they are built.</span></div>'; return; }
    S.sel = c.id;
    $('stage').innerHTML = `<div class="head"><h1>${esc(c.desc.name)}</h1><span class="pill ${esc(c.desc.status)}">${esc(STATUS[c.desc.status] || '')}</span>
      <span class="chip">${esc(TYPE[c.desc.plugin] || c.desc.plugin)}</span><span class="chip">${esc(c.output || '')}</span></div>
      ${c.desc.purpose ? `<p class="purpose">${esc(c.desc.purpose)}</p>` : ''}
      ${c.error ? `<div class="err">This cell didn't build: ${esc(c.error)}. Edit its description in the panel on the right and apply.</div>` : ''}
      <div class="pair">
        <div class="pane"><span class="lab">Original design</span><div class="frame">${c.crop ? `<img src="${c.crop}" alt="Original design of ${esc(c.desc.name)}">` : '<span class="none">No original for this cell</span>'}</div></div>
        <div class="pane"><span class="lab">Built cell (platform preview)</span><div class="frame" style="background:${esc(cellBg(c))}">${c.snap ? `<img src="${c.snap}" alt="Built ${esc(c.desc.name)}">` : '<span class="none">Building…</span>'}</div></div>
      </div>`;
  }
  function renderInspector() {
    const c = S.cells.find(x => x.id === S.sel);
    const box = $('insp');
    if (!c) { box.innerHTML = '<div class="sec"><span class="hint">Select a cell to see what works, what changed and why.</span></div>'; return; }
    const d = c.desc;
    const labels = d.plugin === 'cell_info' ? (d.header?.title ? [d.header.title] : []) : (d.labels || []);
    box.innerHTML = `
      <div class="sec"><div class="row" style="justify-content:space-between"><span class="lab">Cell</span><span class="row" style="gap:6px"><button class="btn small" id="rmOne" type="button">Remove</button><button class="btn small" id="dlOne" type="button">Download this cell</button></span></div>
        <div class="kv">
          <label for="iName">Name</label><input class="inp" id="iName" value="${esc(d.name)}">
          <label for="iType">Type</label><select class="inp" id="iType">${Object.entries(TYPE).map(([k, v]) => `<option value="${k}" ${k === d.plugin ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <label for="iStatus">Result</label><select class="inp" id="iStatus">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === d.status ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </div>
        ${(c.warnings || []).map(w => `<div class="warn">${esc(w)}</div>`).join('')}
      </div>
      <div class="sec"><span class="lab">What works and what changed</span>${decisionsHtml(d)}</div>
      <div class="sec"><span class="lab">Data keys</span><p class="hint">Which feed field each label and image reads.</p>
        <div class="kv">${labels.map((l, i) => `<label for="dk${i}">${esc(l.role || 'Label ' + (i + 1))}</label><input class="inp mono" id="dk${i}" data-i="${i}" value="${esc(l.dataKey || '')}" list="dkText">`).join('')}
        ${d.image ? `<label for="dkImg">Image</label><input class="inp mono" id="dkImg" value="${esc(d.image.key || '')}" list="dkImgs">` : ''}
        ${d.secondaryImage ? `<label for="dkSec">Secondary</label><input class="inp mono" id="dkSec" value="${esc(d.secondaryImage.key || '')}" list="dkImgs">` : ''}</div>
        <datalist id="dkText"><option value="title"><option value="summary"><option value="extensions.genre"><option value="extensions.runtime"><option value="extensions.meta"></datalist>
        <datalist id="dkImgs"><option value="image_base"><option value="thumb_1"><option value="thumb_2"><option value="thumb_3"></datalist></div>
      ${c.notes?.length ? `<div class="sec"><span class="lab">Preview notes</span>${c.notes.slice(0, 6).map(n => `<p class="hint">${esc(n)}</p>`).join('')}</div>` : ''}
      <div class="sec"><details><summary>Edit the full description</summary>
        <p class="hint" style="margin:8px 0">Everything the cell is built from. Change values and apply to rebuild.</p>
        <textarea class="inp mono" id="iJson" spellcheck="false">${esc(JSON.stringify(d, null, 2))}</textarea>
        <div class="row" style="margin-top:8px"><button class="btn small" id="iApply" type="button">Apply and rebuild</button><span class="hint" id="iMsg"></span></div></details></div>`;
    const rebuild = async () => { await buildCell(c); renderAll(); };
    $('iName').onchange = e => { d.name = e.target.value.trim() || d.name; rebuild(); };
    $('iType').onchange = e => { d.plugin = e.target.value; rebuild(); };
    $('iStatus').onchange = e => { d.status = e.target.value; renderAll(); };
    box.querySelectorAll('[data-i]').forEach(inp => inp.onchange = () => { labels[+inp.dataset.i].dataKey = inp.value.trim() || 'title'; rebuild(); });
    if ($('dkImg')) $('dkImg').onchange = e => { d.image.key = e.target.value.trim() || 'image_base'; rebuild(); };
    if ($('dkSec')) $('dkSec').onchange = e => { d.secondaryImage.key = e.target.value.trim() || 'thumb_1'; rebuild(); };
    $('iApply').onclick = async () => { try { c.desc = JSON.parse($('iJson').value); await rebuild(); toast('Rebuilt'); } catch (e) { $('iMsg').textContent = `That isn't valid JSON: ${e.message}`; } };
    $('dlOne').onclick = () => downloadZip([c], `${C.slug(d.name)}.zip`);
    $('rmOne').onclick = () => {
      const at = S.cells.indexOf(c); S.cells.splice(at, 1);
      S.sel = (S.cells[at] || S.cells[at - 1] || {}).id || null; renderAll();
      toast(`Removed ${d.name}`, { label: 'Undo', run: () => { S.cells.splice(at, 0, c); S.sel = c.id; renderAll(); } });
    };
  }

  /* ---------- icon library ---------- */
  const PREVIEW_ROLES = ['play', 'plus', 'check', 'share-ios', 'download', 'chevron-right', 'heart', 'more-horizontal', 'close'];
  function renderIconPanel() {
    const box = $('iconPanel'), lib = ICONS.libraries[S.icons.library];
    box.innerHTML = `<div class="row" style="justify-content:space-between"><span class="lab">Icons</span><span class="hint">${S.iconsSet && !S.iconsTouched ? 'matched to the designs' : ''}</span></div>
      <select class="inp" id="iconLib" aria-label="Icon library">${Object.entries(ICONS.libraries).map(([k, v]) => `<option value="${k}" ${k === S.icons.library ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
      <div class="strip" aria-hidden="true">${PREVIEW_ROLES.map(r => `<img alt="" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent((lib.icons[r] || '').replace('<svg', `<svg width="20" height="20" style="color:${S.icons.light}"`))}">`).join('')}</div>
      <span class="hint">${esc(lib.style)}${S.icons.why ? ` · ${esc(S.icons.why)}` : ''}</span>
      <div class="cols"><label class="sw"><input type="color" id="icLight" value="${esc(S.icons.light.slice(0, 7))}"> On dark</label><label class="sw"><input type="color" id="icDark" value="${esc(S.icons.dark.slice(0, 7))}"> On light</label></div>`;
    const changed = async () => { S.iconsTouched = true; iconCache.clear(); renderIconPanel(); for (const c of S.cells) await buildCell(c); renderAll(); toast('Icons redrawn'); };
    $('iconLib').onchange = e => { S.icons.library = e.target.value; S.icons.why = ''; changed(); };
    $('icLight').onchange = e => { S.icons.light = e.target.value.toUpperCase(); changed(); };
    $('icDark').onchange = e => { S.icons.dark = e.target.value.toUpperCase(); changed(); };
  }

  /* ---------- screens mock-up ---------- */
  const findCell = name => S.cells.find(c => c.desc.name.toLowerCase() === String(name).toLowerCase());
  function mockBlock(item, W) {
    const c = findCell(item.cell); if (!c || !c.snapRaw || !c.size) return '';
    const lay = c.spec.layout || {}, comp = item.component || lay.type || 'single';
    const pad = num(lay.padding), gap = num(lay.gap ?? lay.rowGap ?? 8), cw = c.size.w, ch = c.size.h;
    const im = (w, h) => `<img src="${c.snapRaw}" alt="" style="width:${w}px;height:${h}px">`;
    if (comp === 'rail') { const n = Math.max(1, Math.min(12, +item.count || 4));
      return `<div class="blk" style="gap:${gap}px;padding-left:${pad}px">${Array.from({ length: n }, () => im(cw, ch)).join('')}</div>`; }
    if (comp === 'list') { const n = Math.max(1, Math.min(12, +item.count || 3));
      return `<div class="blk" style="flex-direction:column;gap:${num(lay.rowGap ?? 0)}px;padding:0 ${pad}px">${Array.from({ length: n }, () => im(cw, ch)).join('')}</div>`; }
    if (comp === 'grid') { const cols = Math.max(1, +item.columns || 3), n = Math.max(cols, Math.min(18, +item.count || cols * 2));
      const g = num(lay.gap ?? 8), w = (W - pad * 2 - g * (cols - 1)) / cols, h = ch * w / cw;
      return `<div class="blk" style="flex-wrap:wrap;gap:${g}px;padding:0 ${pad}px">${Array.from({ length: n }, () => im(w, h)).join('')}</div>`; }
    return `<div class="blk" style="padding-left:${Math.max(0, (W - cw) / 2)}px">${im(cw, ch)}</div>`;
  }
  const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
  function renderMock() {
    const box = $('mock'), done = S.screens.filter(s => (s.layout || []).length);
    if (!done.length) { box.innerHTML = `<div class="empty"><b>No screens to mock up yet</b><span>Find cells from your designs; each screen is rebuilt here from its cells.</span></div>`; return; }
    box.innerHTML = done.map(scr => {
      const W = scr.screenW, tablet = scr.device === 'tablet', disp = tablet ? 560 : 300, k = disp / W, H = scr.h * W / scr.w;
      const first = findCell((scr.layout.find(i => findCell(i.cell)) || {}).cell);
      const bg = first?.spec?.appBg || '#000';
      const missing = scr.layout.filter(i => !findCell(i.cell)).map(i => i.cell);
      return `<section class="mscreen"><h2>${esc(scr.name)} <span class="hint">${tablet ? 'Tablet' : 'Phone'} · ${W}pt</span></h2>
        <div class="mpair">
          <div class="mcol"><span class="lab">Original</span><div class="phone ${tablet ? 'tablet' : ''}"><img src="${scr.url}" alt="Original ${esc(scr.name)}"></div></div>
          <div class="mcol"><span class="lab">Built from cells</span><div class="phone ${tablet ? 'tablet' : ''}" style="height:${Math.round(H * k)}px;background:${esc(bg)}">
            <div class="inner" style="width:${W}px;transform:scale(${k})">${scr.layout.map(i => mockBlock(i, W)).join('')}</div></div></div>
          <div class="mside"><span class="lab">Components, top to bottom</span><ol>${scr.layout.map(i => `<li>${esc(i.cell)} <span class="hint">· ${esc(i.component || 'single')}${i.count ? ` × ${i.count}` : ''}${findCell(i.cell) ? '' : ' · removed'}</span></li>`).join('')}</ol>
            ${missing.length ? `<p class="hint">Not drawn: ${esc(missing.join(', '))} (removed or not built).</p>` : ''}
            <p class="hint">Sample text and placeholder artwork. The status bar, navigation and tab bars aren't cells, so they're left out.</p></div>
        </div></section>`;
    }).join('');
  }

  /* ---------- downloads ---------- */
  const bytes = url => { const b = atob(url.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  async function save(filename, data) {
    if (!downloads) { toast('Downloads work in the published studio.'); return; }
    try { await downloads.save({ filename, data }); toast(`Saved ${filename}`); }
    catch (e) { if (e?.code !== 'declined') toast(e?.message || "That file couldn't be saved."); }
  }
  function readme(c) {
    const d = c.desc, lines = [`${d.name} - ${c.json?.meta?.identifier || d.plugin}`, `${collection()} · built by Zapp Cell Style Studio (rules ${K.version})`, '', d.purpose || '', '',
      `${c.output}: import into the cell builder`, `thumbnails/${c.output.replace('.json', '@2x.png')}: thumbnail for the cell style (500 x 280 @2x)`];
    if (c.overlay) lines.push(`${c.overlay.file}: upload to image_overlay (the gradient over the image)`);
    for (const a of (c.assets || []).filter(a => !a.shared)) lines.push(`assets/${a.file}: upload to ${a.field}`);
    for (const a of (c.assets || []).filter(a => a.shared)) lines.push(`../plugin assets/${a.file}: ${a.field}`);
    if ((c.assets || []).length) lines.push(`Icons: ${ICONS.libraries[S.icons.library]?.name || S.icons.library}`);
    const sec = t => (d.decisions || []).filter(x => x.type === t);
    if (sec('works').length) lines.push('', 'What works:', ...sec('works').map(x => `  - ${x.text}`));
    if (sec('changed').length) lines.push('', 'Changes to fit the cell framework:', ...sec('changed').map(x => `  - ${x.item ? x.item + ': ' : ''}${x.text}`));
    if (sec('alternative').length) lines.push('', 'Suggested approach:', ...sec('alternative').map(x => `  - ${x.text}`));
    if (c.spec?.layout?.type === 'rail') lines.push('', `Component: horizontal list, item width ${c.spec.layout.itemWidth}, gap ${c.spec.layout.gap}.`);
    return lines.join('\n') + '\n';
  }
  async function downloadZip(list, name) {
    if (!window.JSZip) { toast("The zip library didn't load."); return; }
    const ok = list.filter(c => c.json && !c.error);
    if (!ok.length) { toast('No built cells to download yet.'); return; }
    toast('Building the folder…');
    const zip = new JSZip(), pluginAssets = new Map();
    for (const c of ok) {
      const dir = zip.folder(c.desc.name.replace(/[\\/:*?"<>|]+/g, '-'));
      dir.file(c.output, JSON.stringify(c.json));
      dir.file('README.txt', readme(c));
      if (c.overlay) dir.file(c.overlay.file, bytes(c.overlay.dataUrl));
      for (const a of c.assets || []) {
        if (a.shared) { pluginAssets.set(a.file, a); continue; }
        dir.file(`assets/${a.file}`, bytes(a.dataUrl));
      }
      try {
        renderInEngine(c);
        dir.file(`thumbnails/${c.output.replace('.json', '@2x.png')}`, bytes(await engine.CellEngine.snapshot({ thumb: true })));
      } catch (e) { console.warn('thumbnail', e); }
    }
    if (pluginAssets.size) {
      const pa = zip.folder('plugin assets');
      for (const a of pluginAssets.values()) pa.file(a.file, bytes(a.dataUrl));
      pa.file('README.txt', `Action plugin button icons (${ICONS.libraries[S.icons.library]?.name || S.icons.library}). Upload each to its plugin in Zapp:\n\n` +
        [...pluginAssets.values()].map(a => `${a.file}: ${a.field}`).join('\n') + '\n\nFlavour 1 is for dark button backgrounds, flavour 2 for light.\n');
    }
    await save(name, await zip.generateAsync({ type: 'uint8array' }));
  }
  $('dlAll').addEventListener('click', () => downloadZip(S.cells, `${C.slug(collection())}-cells.zip`));

  /* ---------- report (on screen + PDF) ---------- */
  const counts = () => Object.fromEntries(Object.keys(STATUS).map(k => [k, S.cells.filter(c => c.desc.status === k).length]));
  function renderDoc() {
    const n = counts();
    $('doc').innerHTML = `<div style="display:grid;gap:8px"><span class="lab">${esc(collection())} · Cell style report</span><h1>Designs and built cells, side by side</h1>
      <p class="lede">Each cell style found in the designs, built as an importable Zapp cell. For every cell: the original, the built cell as the platform preview draws it, what works, what changed to fit the cell framework and why, and the suggested approach.</p>
      <div class="row"><span class="pill as_designed">${n.as_designed} as designed</span><span class="pill adapted">${n.adapted} adapted</span><span class="pill workaround">${n.workaround} workaround</span></div></div>
      ${S.cells.length ? `<table><tr><th>Cell</th><th>Screen</th><th>Built on</th><th>Result</th><th>Main change</th></tr>${S.cells.map(c => { const ch = (c.desc.decisions || []).find(x => x.type === 'changed');
        return `<tr><td><b>${esc(c.desc.name)}</b></td><td>${esc(c.screens?.join(', ') || c.desc.screen || '')}</td><td>${esc(TYPE[c.desc.plugin] || '')}</td><td><span class="pill ${esc(c.desc.status)}">${esc(STATUS[c.desc.status] || '')}</span></td><td>${esc(ch ? (ch.item || ch.text) : '—')}</td></tr>`; }).join('')}</table>` : '<p class="hint">No cells yet.</p>'}
      ${S.cells.map(c => `<section class="rc"><h2>${esc(c.desc.name)} <span class="pill ${esc(c.desc.status)}">${esc(STATUS[c.desc.status] || '')}</span></h2>
        <span class="hint">${esc(TYPE[c.desc.plugin] || '')} · ${esc(c.output || '')}</span>${c.desc.purpose ? `<p class="purpose">${esc(c.desc.purpose)}</p>` : ''}
        <div class="pair"><div class="pane"><span class="lab">Original design</span><div class="frame">${c.crop ? `<img src="${c.crop}" alt="">` : '<span class="none">No original</span>'}</div></div>
        <div class="pane"><span class="lab">Built cell</span><div class="frame" style="background:${esc(cellBg(c))}">${c.snap ? `<img src="${c.snap}" alt="">` : ''}</div></div></div>
        ${decisionsHtml(c.desc)}</section>`).join('')}`;
  }
  const imgSize = url => new Promise(ok => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = () => ok([1, 1]); i.src = url; });
  async function reportPdf() {
    if (!window.jspdf) { toast("The PDF library didn't load."); return; }
    if (!S.cells.length) { toast('No cells to report yet.'); return; }
    toast('Writing the report…');
    const { jsPDF } = window.jspdf, pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 16, CW = W - M * 2; let y = M;
    const ink = [24, 24, 26], muted = [110, 110, 116], line = [226, 226, 223];
    const stat = { as_designed: [31, 122, 69], adapted: [138, 90, 0], workaround: [57, 70, 166] };
    const text = (s, size, opt = {}) => { pdf.setFont('helvetica', opt.bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(...(opt.color || ink));
      const lines = pdf.splitTextToSize(String(s), opt.w || CW); if (y + lines.length * size * 0.42 > 285) { pdf.addPage(); y = M; } pdf.text(lines, opt.x || M, y); y += lines.length * size * 0.42 + (opt.after ?? 2); };
    const need = h => { if (y + h > 285) { pdf.addPage(); y = M; } };
    text(`${collection()} · Cell style report`, 9, { color: muted, after: 6 });
    text('Designs and built cells, side by side', 22, { bold: true, after: 4 });
    text('Each cell style found in the designs, built as an importable Zapp cell: the original, the built cell as the platform preview draws it, what works, what changed to fit the cell framework and why, and the suggested approach.', 10.5, { color: [70, 70, 76], after: 6 });
    const n = counts(); text(`${S.cells.length} cell styles · ${n.as_designed} as designed · ${n.adapted} adapted · ${n.workaround} workaround`, 10, { bold: true, after: 6 });
    // summary table
    pdf.setDrawColor(...line);
    for (const c of S.cells) {
      need(8); const ch = (c.desc.decisions || []).find(x => x.type === 'changed');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...ink); pdf.text(pdf.splitTextToSize(c.desc.name, 52)[0], M, y);
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...muted); pdf.text(TYPE[c.desc.plugin] || '', M + 55, y);
      pdf.setTextColor(...(stat[c.desc.status] || ink)); pdf.text(STATUS[c.desc.status] || '', M + 80, y);
      pdf.setTextColor(...ink); pdf.text(pdf.splitTextToSize(ch ? (ch.item || ch.text) : '—', CW - 108)[0], M + 108, y);
      y += 3; pdf.line(M, y, W - M, y); y += 4;
    }
    for (const c of S.cells) {
      pdf.addPage(); y = M;
      text(c.desc.name, 17, { bold: true, after: 1 });
      text(`${STATUS[c.desc.status] || ''} · ${TYPE[c.desc.plugin] || ''} · ${c.output || ''}`, 9, { color: stat[c.desc.status] || muted, after: 3 });
      if (c.desc.purpose) text(c.desc.purpose, 10, { color: [70, 70, 76], after: 4 });
      const boxW = (CW - 6) / 2, boxH = 78;
      const place = async (url, x, bg, label) => {
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...muted); pdf.text(label.toUpperCase(), x, y);
        pdf.setFillColor(...bg); pdf.roundedRect(x, y + 2, boxW, boxH, 2, 2, 'F');
        if (url) { const [iw, ih] = await imgSize(url); const k = Math.min((boxW - 6) / iw, (boxH - 6) / ih); const w = iw * k, h = ih * k;
          pdf.addImage(url, url.startsWith('data:image/png') ? 'PNG' : 'JPEG', x + (boxW - w) / 2, y + 2 + (boxH - h) / 2, w, h); }
      };
      const hex = h => { const m = String(h).match(/^#([0-9a-f]{6})/i); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : [30, 30, 32]; };
      await place(c.crop, M, [237, 237, 234], 'Original design');
      await place(c.snap, M + boxW + 6, hex(cellBg(c)), 'Built cell (platform preview)');
      y += boxH + 10;
      const sec = (t, title) => { const xs = (c.desc.decisions || []).filter(x => x.type === t); if (!xs.length) return; text(title, 11, { bold: true, after: 2 });
        xs.forEach(x => text(`•  ${x.item ? x.item + '. ' : ''}${x.text}`, 9.5, { after: 1.6 })); y += 2; };
      sec('works', 'What works'); sec('changed', 'What changed and why'); sec('alternative', 'Suggested approach');
      if (c.spec?.layout?.type === 'rail') text(`Component: horizontal list, item width ${c.spec.layout.itemWidth}pt.`, 8.5, { color: muted });
    }
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) { pdf.setPage(i); pdf.setFontSize(7.5); pdf.setTextColor(...muted); pdf.text(`${collection()} · Zapp Cell Style Studio`, M, 292); pdf.text(`${i} / ${pages}`, W - M, 292, { align: 'right' }); }
    await save(`${C.slug(collection())}-cell-report.pdf`, new Uint8Array(pdf.output('arraybuffer')));
  }
  $('dlReport').addEventListener('click', reportPdf);

  /* ---------- start ---------- */
  (async () => {
    renderScreens();
    try { engine = await bootEngine(); } catch (e) { $('stage').innerHTML = `<div class="err">${esc(e.message)} Reload the page to try again.</div>`; return; }
    // example cells from the rules, so the studio opens showing what it makes
    S.cells = (K.examples.cells || []).map(d => ({ id: uid(), desc: JSON.parse(JSON.stringify(d)), screenId: null, screens: [d.screen], crop: null }));
    for (const c of S.cells) await buildCell(c);
    S.sel = S.cells[0]?.id; renderIconPanel(); renderAll();
    if (window.claude?.use) {
      const [smp, dl, m] = await Promise.all(['sample', 'downloads', 'mcp'].map(n => window.claude.use(n).catch(() => null)));
      sample = smp; downloads = dl; mcp = m;
      if (sample) { const lim = await sample.limits().catch(() => null); if (!lim?.images) { sample = null; $('aiHint').textContent = "Claude can't read images in this view, so cells can't be found from screenshots here."; } }
      else $('aiHint').textContent = 'Finding cells uses Claude, which isn’t available in this view.';
      if (!mcp) $('figmaAdd').disabled = true;
    } else $('aiHint').textContent = 'Open the published studio to find cells with Claude.';
    $('dlAll').disabled = $('dlReport').disabled = false;
    renderScreens();
    try { const v = localStorage.getItem('css.view'); if (['import', 'screens', 'compare'].includes(v)) show(v); } catch (e) {}
  })();
})();
