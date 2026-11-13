/* Zapp Cell Style Studio
   Designs (screenshots or Figma frames) -> Claude describes each cell style using the bundled rules (knowledge.js)
   -> convert.js turns each description into a build spec -> the cell engine (engine.js, the Zapp cell preview in a
   hidden frame) builds the importable JSON and renders it -> gallery, inspector, zip download, comparison report. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const K = window.KNOWLEDGE, BASES = window.CELL_BASES, C = window.Convert;
  const S = { screens: [], cells: [], sel: null, busy: false, icons: { library: 'lucide', light: '#FFFFFF', dark: '#121212', why: '' }, iconsTouched: false,
    fonts: { uploads: {}, picks: [] }, figmaIcons: {} };
  const ICONS = K.icons;
  let engine = null, sample = null, downloads = null, mcp = null, figmaSession = null, imgMax = 1;
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
  /* ---------- fonts: Google Fonts by family, or font files the user uploaded ---------- */
  // S.fonts.uploads[family] = { faces: [{ ps, weight, italic, ext, data, file }] }; status[family] = google | missing | uploaded | system
  const SYSTEM_FONT = /^(SF|San Francisco|-apple|system|Roboto$)/i;
  const fontStatus = {}, fontLinks = new Set();
  const fontsIn = desc => {
    const out = new Map();
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      if (typeof o.family === 'string' && ('weight' in o || 'size' in o)) { if (!out.has(o.family)) out.set(o.family, new Set()); out.get(o.family).add(Math.round((+o.weight || 400) / 100) * 100); }
      for (const v of Object.values(o)) walk(v);
    })(desc);
    return out;
  };
  const googleCss = (fam, weights) => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam).replace(/%20/g, '+')}${weights ? `:wght@${weights.join(';')}` : ''}&display=swap`;
  // loads a stylesheet into a document; resolves true when it loaded, false on an error (Google answers 400 for unknown families or weights)
  const linkCss = (doc, href) => new Promise(ok => {
    const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = href;
    l.onload = () => ok(true); l.onerror = () => { l.remove(); ok(false); }; setTimeout(() => ok(true), 4000); doc.head.append(l);
  });
  async function loadGoogle(fam, weights) {
    const ws = [...weights].sort((a, b) => a - b), key = fam + '|' + ws.join(',');
    if (fontLinks.has(key)) return; fontLinks.add(key);
    let ok = false;
    for (const href of [googleCss(fam, ws), googleCss(fam, null)]) {
      ok = await linkCss(engine.document, href);
      if (ok) { linkCss(document, href); break; }
    }
    fontStatus[fam] = ok ? 'google' : 'missing';
    if (ok) try { await Promise.all(ws.map(w => engine.document.fonts.load(`${w} 16px "${fam}"`))); } catch (e) { /* falls back */ }
  }
  async function ensureFonts(desc) {
    for (const [fam, weights] of fontsIn(desc)) {
      if (S.fonts.uploads[fam]) { fontStatus[fam] = 'uploaded'; continue; }
      if (SYSTEM_FONT.test(fam)) { fontStatus[fam] = 'system'; continue; }
      engine.CellEngine.registerFont(C.famPrefix(fam), fam);
      await loadGoogle(fam, weights);
    }
  }
  // nearest upright face for a weight, so the cell JSON names a font file that exists
  const faceFor = (family, weight) => {
    const u = S.fonts.uploads[family]; if (!u || !u.faces.length) return null;
    const up = u.faces.filter(f => !f.italic), pool = up.length ? up : u.faces;
    return pool.reduce((a, f) => Math.abs(f.weight - weight) < Math.abs(a.weight - weight) ? f : a);
  };
  C.setFontResolver((family, weight) => faceFor(family, weight)?.ps || null);

  // reads family, PostScript name, weight and italic from a TrueType / OpenType file (name and OS/2 tables)
  function parseFont(buf) {
    const v = new DataView(buf), tag = o => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    const sig = v.getUint32(0);
    if (sig !== 0x00010000 && tag(0) !== 'OTTO' && tag(0) !== 'true') throw new Error(tag(0) === 'wOFF' || tag(0) === 'wOF2' ? 'web font (WOFF): apps need the .ttf or .otf file' : "not a TrueType or OpenType font");
    const tables = {}, n = v.getUint16(4);
    for (let i = 0; i < n; i++) { const o = 12 + i * 16; tables[tag(o)] = { off: v.getUint32(o + 8), len: v.getUint32(o + 12) }; }
    const names = {};
    if (tables.name) {
      const b = tables.name.off, count = v.getUint16(b + 2), strings = b + v.getUint16(b + 4);
      for (let i = 0; i < count; i++) {
        const r = b + 6 + i * 12, plat = v.getUint16(r), lang = v.getUint16(r + 4), id = v.getUint16(r + 6), len = v.getUint16(r + 8), off = strings + v.getUint16(r + 10);
        if (![1, 2, 4, 6, 16, 17].includes(id)) continue;
        let s = '';
        if (plat === 3 || plat === 0) { if (plat === 3 && lang !== 0x409 && names[id]) continue; for (let j = 0; j < len; j += 2) s += String.fromCharCode(v.getUint16(off + j)); }
        else if (plat === 1) { if (names[id]) continue; for (let j = 0; j < len; j++) s += String.fromCharCode(v.getUint8(off + j)); }
        else continue;
        if (s) names[id] = s;
      }
    }
    let weight = 400, italic = false;
    if (tables['OS/2']) { const o = tables['OS/2'].off; weight = v.getUint16(o + 4) || 400; italic = !!(v.getUint16(o + 62) & 1); }
    const sub = names[17] || names[2] || '';
    if (/italic|oblique/i.test(sub)) italic = true;
    const family = (names[16] || names[1] || '').trim();
    if (!family) throw new Error('the font has no family name');
    return { family, ps: (names[6] || `${C.famPrefix(family)}-${sub.replace(/\s+/g, '') || 'Regular'}`).trim(), weight: Math.min(1000, Math.max(100, weight)), italic, sub };
  }
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  async function addFontFiles(files) {
    const added = [];
    for (const f of files) {
      if (!/\.(ttf|otf|woff2?)$/i.test(f.name)) { toast(`${f.name} isn't a font file (.ttf or .otf).`); continue; }
      try {
        const buf = await f.arrayBuffer(), info = parseFont(buf), ext = f.name.split('.').pop().toLowerCase();
        const u = (S.fonts.uploads[info.family] ||= { faces: [] });
        if (u.faces.some(x => x.ps === info.ps)) continue;
        const face = { ...info, ext, file: f.name, data: new Uint8Array(buf) };
        u.faces.push(face); u.faces.sort((a, b) => a.weight - b.weight || a.italic - b.italic);
        // an @font-face rule with the file inline, in both documents (the engine's snapshots copy stylesheets, not FontFace objects)
        const css = `@font-face{font-family:"${info.family}";src:url(data:font/${ext === 'otf' ? 'otf' : 'ttf'};base64,${b64(face.data)});font-weight:${info.weight};font-style:${info.italic ? 'italic' : 'normal'};font-display:block}`;
        for (const doc of [document, engine?.document].filter(Boolean)) { const st = doc.createElement('style'); st.dataset.font = info.ps; st.textContent = css; doc.head.append(st); }
        engine?.CellEngine.registerFace(info.ps, info.family, info.weight);
        fontStatus[info.family] = 'uploaded';
        try { await engine?.document.fonts.load(`${info.italic ? 'italic ' : ''}${info.weight} 16px "${info.family}"`); } catch (e) {}
        added.push(`${info.family} ${info.sub || info.weight}`);
      } catch (e) { toast(`${f.name}: ${e.message}.`); }
    }
    renderFontFiles(); renderFontPanel();
    if (added.length) {
      toast(`Added ${added.length} font${added.length > 1 ? 's' : ''}`);
      // cells already using an uploaded family pick up its real file names
      const fams = new Set(Object.keys(S.fonts.uploads));
      for (const c of S.cells) if ([...fontsIn(c.desc).keys()].some(f => fams.has(f))) await buildCell(c);
      renderAll();
    }
  }
  function renderFontFiles() {
    const box = $('fontFiles'), fams = Object.entries(S.fonts.uploads);
    box.innerHTML = fams.map(([fam, u]) => `<div class="ff"><b style="font-family:'${esc(fam)}',var(--f-ui)">${esc(fam)}</b>
      <span class="hint">${u.faces.map(f => `${f.weight}${f.italic ? ' italic' : ''}`).join(', ')}</span><button class="btn ghost small" type="button" data-rmfont="${esc(fam)}">Remove</button></div>`).join('');
    box.querySelectorAll('[data-rmfont]').forEach(b => b.onclick = () => {
      const fam = b.dataset.rmfont;
      for (const f of S.fonts.uploads[fam].faces) for (const doc of [document, engine?.document].filter(Boolean)) doc.querySelectorAll(`style[data-font="${CSS.escape(f.ps)}"]`).forEach(x => x.remove());
      delete S.fonts.uploads[fam]; delete fontStatus[fam]; renderFontFiles(); renderFontPanel();
    });
  }
  $('fontInput').addEventListener('change', async e => { await addFontFiles([...e.target.files]); e.target.value = ''; });

  /* ---------- icons: role -> PNG @3x from the chosen library ---------- */
  const iconCache = new Map();
  function iconSvg(role) {
    const lib = ICONS.libraries[S.icons.library] || ICONS.libraries.lucide;
    return lib.icons[role] || ICONS.libraries.lucide.icons[role] || lib.icons['chevron-right'];
  }
  // plate: a fill behind the icon; radius null = circle, 0 = square, n = rounded corners (points)
  async function iconPng(role, { size = 24, height, iconSize, color = '#FFFFFF', circle = null, plate = null, radius = null } = {}) {
    if (circle && !plate) { plate = circle; radius = null; }
    const key = [S.icons.library, role, size, height, iconSize, color, plate, radius].join('|');
    if (iconCache.has(key)) return iconCache.get(key);
    const fig = S.figmaIcons[role];
    // multi-colour Figma artwork with no plate behind it brings its own shape, so it fills the whole box
    const k = 3, px = Math.round(size * k), py = Math.round((height || size) * k), ip = fig && !fig.mono && !plate ? Math.min(px, py) : Math.round((iconSize || Math.min(size, height || size)) * k);
    let img, iw = ip, ih = ip;
    if (fig) {
      // the design's own icon: fitted into the icon box, recoloured when it's one colour (multi-colour artwork stays as drawn)
      const src = await loadImg(fig.hi || fig.url);
      const s = ip / Math.max(src.width, src.height);
      iw = Math.max(1, Math.round(src.width * s)); ih = Math.max(1, Math.round(src.height * s));
      const t = document.createElement('canvas'); t.width = iw; t.height = ih; const tg = t.getContext('2d');
      tg.imageSmoothingQuality = 'high'; tg.drawImage(src, 0, 0, iw, ih);
      if (fig.mono && color) { tg.globalCompositeOperation = 'source-in'; tg.fillStyle = color; tg.fillRect(0, 0, iw, ih); }
      img = t;
    } else {
      const svg = iconSvg(role).replace('<svg', `<svg width="${ip}" height="${ip}" style="color:${color}"`);
      img = new Image();
      await new Promise((ok, fail) => { img.onload = ok; img.onerror = () => fail(new Error(`Icon ${role} didn't draw.`)); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    }
    const c = document.createElement('canvas'); c.width = px; c.height = py; const g = c.getContext('2d');
    if (plate) {
      g.fillStyle = plate; g.beginPath();
      if (radius == null) g.ellipse(px / 2, py / 2, px / 2, py / 2, 0, 0, Math.PI * 2);
      else g.roundRect(0, 0, px, py, Math.min(radius * k, px / 2, py / 2));
      g.fill();
    }
    // play glyphs sit a touch right of centre so they look centred on a plate
    const nudge = plate && role === 'play' ? ip * 0.06 : 0;
    g.drawImage(img, (px - iw) / 2 + nudge, (py - ih) / 2, iw, ih);
    const url = c.toDataURL('image/png'); iconCache.set(key, url); return url;
  }
  async function drawAssets(list) {
    const out = [];
    for (const a of list || []) {
      const color = a.kind === 'button' ? (a.flavour === 'flavour_2' ? S.icons.dark : S.icons.light) : a.color;
      try { out.push({ ...a, color, dataUrl: await iconPng(a.role, { size: a.size, height: a.height, iconSize: a.iconSize, color, circle: a.circle, plate: a.plate, radius: a.radius }) }); } catch (e) { console.warn(e); }
    }
    return out;
  }

  // the engine draws one cell at a time: anything that renders and then snapshots queues here
  let engineQ = Promise.resolve();
  const withEngine = fn => { const r = engineQ.then(fn, fn); engineQ = r.catch(() => {}); return r; };

  /* ---------- build one cell: description -> spec -> JSON -> render -> snapshot ---------- */
  async function buildCell(c) { return withEngine(() => buildCellNow(c)); }
  async function buildCellNow(c) {
    c.error = null; c.warnings = [];
    try {
      const scr = S.screens.find(s => s.id === c.screenId);
      const conv = C.toSpec(c.desc, { device: scr?.device || c.desc.device, screenW: scr?.screenW, collection: collection() });
      c.spec = conv.spec; c.base = conv.base; c.warnings = conv.warnings; c.labels = conv.labels || [];
      await ensureFonts(c.desc);
      const built = engine.CellEngine.buildCell(BASES[conv.base], c.spec);
      c.json = built.json; c.output = built.output; c.overlay = built.overlay;
      c.assets = await drawAssets(conv.assets);
      const r = renderInEngine(c);
      c.size = { w: r.width, h: r.height };
      c.notes = (r.notes || []).filter(n => !/style keys from the full set|Upload the real image|stand-in/i.test(n));
      await new Promise(r => setTimeout(r, 60));
      c.snap = await engine.CellEngine.snapshot({ scale: 2, pad: 12 });
      c.snapRaw = await engine.CellEngine.snapshot({ scale: 2, pad: 0 });
      c.rev = (c.rev || 0) + 1; c.itemSnaps = new Map();
    } catch (e) { c.error = e.message || String(e); console.error(e); }
  }

  function renderOpts(c) {
    const lay = c.spec.layout || {}, A = k => (c.assets || []).find(a => a.kind === k)?.dataUrl || null;
    const actionPng = {};
    for (const a of (c.assets || []).filter(a => a.kind === 'button')) (actionPng[a.asset] ||= {})[a.flavour] = a.dataUrl;
    return { screenW: c.spec.screen, pad: lay.padding || 0, layout: lay.type ? lay : null, appBg: c.spec.appBg, overlay: c.overlay?.dataUrl,
      title: c.spec.sampleTitle || 'Content Title', summary: c.spec.sampleSummary, ext: c.spec.sampleFeed,
      badge: A('badge'), action: A('action'), infoIcon: A('header'), actionPng,
      actionLabels: Object.fromEntries((c.labels || []).map(l => [l.action, l.text])) };
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
  function addScreen({ name, blob, source = 'upload', meta = '', id, device, screenW, layout }) {
    const url = URL.createObjectURL(blob), img = new Image();
    return new Promise(ok => {
      img.onload = () => {
        device = device || $('device').value; screenW = screenW || Math.max(240, +$('screenW').value || (device === 'tablet' ? 1133 : 393));
        const scr = { id: id || uid(), name: name.replace(/\.(png|jpe?g|webp)$/i, ''), blob, url, img, w: img.naturalWidth, h: img.naturalHeight, device, screenW, source, meta, state: 'new', layout };
        S.screens.push(scr); renderScreens(); ok(scr);
      };
      img.onerror = () => { toast(`${name} isn't an image the browser can read.`); ok(null); };
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
      // screens are the frames directly under the linked page or section (frames inside sections count too), or the linked
      // frame itself; frames nested inside a screen ("Screen View", "List") are not screens
      const screenSized = f => f.w >= 300 && f.w <= 1600 && f.h >= 400;
      const asFrame = el => ({ id: el.getAttribute('id'), name: el.getAttribute('name') || '', w: +el.getAttribute('width') || 0, h: +el.getAttribute('height') || 0 });
      const metaRoot = parseMeta(meta), linked = metaRoot && [...metaRoot.querySelectorAll('*')].find(n => n.getAttribute('id') === ref.nodeId);
      let frames;
      if (linked) {
        const kids = el => [...el.children].flatMap(c => c.tagName.toLowerCase() === 'section' ? kids(c) : [c]);
        frames = linked.tagName.toLowerCase() === 'frame' && screenSized(asFrame(linked)) ? [asFrame(linked)]
          : kids(linked).filter(c => ['frame', 'instance', 'component', 'symbol'].includes(c.tagName.toLowerCase())).map(asFrame).filter(screenSized);
      } else {
        frames = [...meta.matchAll(/<frame[^>]*\bid="([^"]+)"[^>]*\bname="([^"]*)"[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/g)]
          .map(m => ({ id: m[1], name: m[2], w: +m[3], h: +m[4] })).filter(screenSized).filter(f => f.id !== ref.nodeId);
      }
      const list = frames.slice(0, 12);
      if (!list.length) throw new Error('No screen-sized frames found under that link.');
      let n = 0; const added = [];
      for (const f of list) {
        msg.textContent = `Exporting ${++n} of ${list.length}: ${f.name}`;
        const shot = await figmaCall('get_screenshot', { fileKey: ref.fileKey, nodeId: f.id, maxDimension: Math.round(f.h * 3 > 4000 ? 4000 : f.h * 3), enableBase64Response: true, ...sid });
        const im = imageOf(shot); if (!im) continue;
        const bin = atob(im.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        $('device').value = f.w > 700 ? 'tablet' : 'phone'; $('screenW').value = Math.round(f.w);
        const scr = await addScreen({ name: f.name || `Frame ${f.id}`, blob: new Blob([u8], { type: im.mimeType || 'image/png' }), source: 'figma',
          meta: meta.split('\n').filter(l => l.includes(`"${f.id}"`) || l.includes(f.name)).slice(0, 1).join('') });
        if (scr) added.push({ scr, f });
      }
      // the screens' own icons, exported from Figma so cells use them instead of a library
      msg.textContent = 'Exporting the icons the screens use…';
      let viaPlugin = false;
      try { viaPlugin = await figmaIconsViaPlugin(ref.fileKey, sid, added); } catch (e) { console.warn('icons via plugin', e); }
      if (!viaPlugin) for (const { scr, f } of added) { try { await figmaIconsFor(scr, f, meta, ref.fileKey, sid); } catch (e) { console.warn('icons', e); } }
      const ni = Object.keys(S.figmaIcons).length;
      msg.textContent = `Added ${n} frame${n === 1 ? '' : 's'}${ni ? ` and ${ni} icon${ni === 1 ? '' : 's'} from the file` : ''}.`;
      renderIconPanel();
    } catch (e) { msg.textContent = e?.code === 'server_not_connected' || e?.code === 'not_connected' ? 'Connect Figma on Claude first, then try again.' : (e?.message || 'Figma read failed.'); }
    finally { $('figmaAdd').disabled = false; }
  });

  /* ---------- icons from the Figma file ---------- */
  // S.figmaIcons['figma:12:34'] = { ref, name, w, h, url (PNG data URL, transparent), mono (one colour: recoloured to fit) }
  const ICON_NAME = /icon|^ic[_\-\s/]|chevron|arrow|caret|play|pause|plus|add|share|download|heart|bookmark|search|close|cross|check|tick|info|more|dots|kebab|lock|star|cast|back|menu|thumb|rate|like|bell|filter|setting|volume|mute|subtitle|calendar|trailer|list|home|live|profile|user|episode/i;
  const GENERIC = /^(vector|frame|group|union|subtract|intersect|exclude|rectangle|ellipse|shape)\s*\d*$/i;
  const VECTORISH = new Set(['vector', 'boolean-operation', 'star', 'line', 'ellipse', 'polygon', 'rectangle', 'group', 'frame', 'instance']);
  function parseMeta(text) {
    const a = text.indexOf('<'), z = text.lastIndexOf('>'); if (a < 0) return null;
    const doc = new DOMParser().parseFromString(`<root>${text.slice(a, z + 1)}</root>`, 'text/xml');
    return doc.querySelector('parsererror') ? null : doc.documentElement;
  }
  // small, roughly square layers named like icons (or made only of vectors), without text, with their position in the frame
  function iconLayers(frameEl, absolute) {
    const out = [], fx = +frameEl.getAttribute('x') || 0, fy = +frameEl.getAttribute('y') || 0;
    const walk = (el, ox, oy) => {
      for (const ch of el.children) {
        const ax = +ch.getAttribute('x') || 0, ay = +ch.getAttribute('y') || 0;
        const x = absolute ? ax - fx : ox + ax, y = absolute ? ay - fy : oy + ay;
        const w = +ch.getAttribute('width') || 0, h = +ch.getAttribute('height') || 0, name = ch.getAttribute('name') || '', tag = ch.tagName.toLowerCase();
        const small = w >= 8 && h >= 8 && w <= 72 && h <= 72 && w / h <= 2.5 && h / w <= 2.5;
        const onlyVectors = ch.children.length > 0 && [...ch.querySelectorAll('*')].every(n => VECTORISH.has(n.tagName.toLowerCase())) && !!ch.querySelector('vector, boolean-operation');
        if (small && !ch.querySelector('text') && tag !== 'text' && (ICON_NAME.test(name) || onlyVectors || ((tag === 'vector' || tag === 'boolean-operation') && !GENERIC.test(name)))) { out.push({ id: ch.getAttribute('id'), name, x, y, w, h }); continue; }
        walk(ch, x, y);
      }
    };
    walk(frameEl, 0, 0);
    return out;
  }
  const loadImg = url => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error('image')); i.src = url; });
  // Makes an icon image clean: keeps transparency when the export has it; otherwise lifts the glyph off a flat
  // background (icons on photos can't be lifted and are skipped). Reports whether the icon is one colour.
  // key: true for icons cut from the exported screen (lift them off a flat background; on a photo they're skipped).
  // Figma's own render of a layer is used as it is: anything opaque in it (a plate behind the glyph) is the icon.
  function cleanIcon(img, { key = false, sx = 0, sy = 0, sw, sh } = {}) {
    sw = sw ?? (img.naturalWidth || img.width); sh = sh ?? (img.naturalHeight || img.height);
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw)); c.height = Math.max(1, Math.round(sh));
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const im = g.getImageData(0, 0, c.width, c.height), p = im.data, W = c.width, H = c.height, at = (x, y) => (y * W + x) * 4;
    const ring = []; for (let x = 0; x < W; x++) ring.push(at(x, 0), at(x, H - 1)); for (let y = 0; y < H; y++) ring.push(at(0, y), at(W - 1, y));
    const transparent = ring.filter(i => p[i + 3] < 20).length > ring.length * 0.6;
    if (key && !transparent) {
      const bg = [0, 1, 2].map(k => ring.reduce((a, i) => a + p[i + k], 0) / ring.length);
      const dist = i => Math.abs(p[i] - bg[0]) + Math.abs(p[i + 1] - bg[1]) + Math.abs(p[i + 2] - bg[2]);
      if (Math.max(...ring.map(dist)) > 60) return null;          // busy background (a photo): can't lift the icon cleanly
      let far = 0; for (let i = 0; i < p.length; i += 4) far = Math.max(far, dist(i));
      if (far < 60) return null;                                   // nothing there
      const full = Math.min(far, 140);
      for (let i = 0; i < p.length; i += 4) {
        const a = Math.min(1, dist(i) / full);
        for (let k = 0; k < 3; k++) p[i + k] = a > 0.02 ? Math.max(0, Math.min(255, Math.round((p[i + k] - bg[k] * (1 - a)) / a))) : 0;
        p[i + 3] = Math.round(a * 255);
      }
      g.putImageData(im, 0, 0);
    }
    // one colour? compare the solid pixels with their average
    const solid = []; for (let i = 0; i < p.length; i += 4) if (p[i + 3] > 160) solid.push(i);
    if (!solid.length) return null;
    const avg = [0, 1, 2].map(k => solid.reduce((a, i) => a + p[i + k], 0) / solid.length);
    const mono = solid.every(i => Math.abs(p[i] - avg[0]) + Math.abs(p[i + 1] - avg[1]) + Math.abs(p[i + 2] - avg[2]) < 90);
    return { url: c.toDataURL('image/png'), mono, w: W, h: H };
  }
  // Preferred: one read-only script in the file finds every icon instance in the screens, follows it to its component,
  // and exports that component as SVG (vector, any size). Layer data alone can't see inside component instances.
  const ICON_SCRIPT = ids => `const frameIds = ${JSON.stringify(ids)};
const icons = new Map(), specs = {};
const r1 = v => Math.round(v * 10) / 10;
const hex = p => { const c = p.color, h = v => Math.round(v * 255).toString(16).padStart(2, '0'); return '#' + h(c.r) + h(c.g) + h(c.b) + (p.opacity != null && p.opacity < 1 ? h(p.opacity) : ''); };
const paint = ps => { if (!Array.isArray(ps)) return ''; const p = ps.find(x => x.visible !== false); if (!p) return ''; return p.type === 'SOLID' ? hex(p) : p.type === 'IMAGE' ? 'image' : p.type.indexOf('GRADIENT') === 0 ? 'gradient(' + p.gradientStops.map(g => hex({ color: g.color, opacity: g.color.a }) + ' ' + r1(g.position)).join(', ') + ')' : p.type.toLowerCase(); };
const isIcon = n => n.type === 'INSTANCE' && n.width <= 72 && n.height <= 72 && n.width >= 8 && n.height >= 8 && !n.findAllWithCriteria({ types: ['TEXT'] }).length;
// a button or tab layer often wraps the glyph (an icon instance inside a padded box): the glyph is the icon
const innerIcons = n => n.findAllWithCriteria({ types: ['INSTANCE'] }).filter(k => k.visible && isIcon(k));
const glyphOf = n => { const kids = innerIcons(n).filter(k => !innerIcons(k).length); return kids.length === 1 ? kids[0] : null; };
const isStatus = n => /status ?bar/i.test(n.name) && n.height <= 70;
const underStatus = (n, stop) => { for (let p = n; p && p !== stop; p = p.parent) if (isStatus(p)) return true; return false; };
const glyphColour = n => { const v = n.findAll(x => x.visible && ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'ELLIPSE', 'POLYGON'].indexOf(x.type) >= 0 && Array.isArray(x.fills) && x.fills.some(f => f.visible !== false && f.type === 'SOLID'));
  if (!v.length) return ''; const f = v[v.length - 1].fills.find(f => f.visible !== false && f.type === 'SOLID'); return f ? hex(f) : ''; };
const textOf = n => { const fn = n.fontName, lh = n.lineHeight, ls = n.letterSpacing;
  return '"' + n.characters.slice(0, 80).replace(/\\n/g, ' ') + '" ' + (typeof fn === 'symbol' ? 'mixed' : fn.family + ' ' + fn.style) + ' ' + (typeof n.fontSize === 'symbol' ? 'mixed' : n.fontSize) + '/'
    + (typeof lh === 'symbol' || lh.unit === 'AUTO' ? 'auto' : lh.unit === 'PIXELS' ? r1(lh.value) : r1(lh.value) + '%')
    + (typeof ls !== 'symbol' && ls.value ? ' ls=' + r1(ls.value) + (ls.unit === 'PERCENT' ? '%' : '') : '') + ' ' + paint(n.fills)
    + (n.textAlignHorizontal !== 'LEFT' ? ' align=' + n.textAlignHorizontal.toLowerCase() : '')
    + (n.textCase && typeof n.textCase !== 'symbol' && n.textCase !== 'ORIGINAL' ? ' case=' + n.textCase.toLowerCase() : ''); };
for (const fid of frameIds) {
  const frame = await figma.getNodeByIdAsync(fid);
  if (!frame || !('findAllWithCriteria' in frame)) continue;
  // icons: every small instance without text, followed to its component
  for (const inst of frame.findAllWithCriteria({ types: ['INSTANCE'] })) {
    if (!inst.visible || !isIcon(inst) || icons.size >= 40 || glyphOf(inst) || underStatus(inst, frame)) continue;
    const main = await inst.getMainComponentAsync();
    const key = main ? main.id : inst.id;
    if (!icons.has(key)) icons.set(key, { id: key, name: main ? (main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent.name + ' / ' + main.name : main.name) : inst.name, w: Math.round(inst.width), h: Math.round(inst.height), frames: [], node: main || inst });
    const ic = icons.get(key); if (ic.frames.indexOf(fid) < 0) ic.frames.push(fid);
  }
  // layer details: positions in the screen, auto-layout padding and gaps, fills, strokes, radius, text and type
  const fx = frame.absoluteTransform[0][2], fy = frame.absoluteTransform[1][2], lines = [], seenMain = new Map(); let size = 0;
  const walk = async (n, depth) => {
    if (n.visible === false || size > 16000) return;
    if (isStatus(n)) { const l = '  '.repeat(depth) + 'status bar (device: time, signal, battery) ' + r1(n.absoluteTransform[0][2] - fx) + ',' + r1(n.absoluteTransform[1][2] - fy) + ' ' + r1(n.width) + 'x' + r1(n.height); lines.push(l); size += l.length; return; }
    let line = '  '.repeat(depth) + n.type.toLowerCase() + ' "' + n.name + '" ' + r1(n.absoluteTransform[0][2] - fx) + ',' + r1(n.absoluteTransform[1][2] - fy) + ' ' + r1(n.width) + 'x' + r1(n.height);
    if (n.type === 'TEXT') line += ' ' + textOf(n);
    else {
      if ('layoutMode' in n && n.layoutMode !== 'NONE') line += ' auto=' + n.layoutMode.toLowerCase() + ' pad=' + [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft].join(',') + ' gap=' + n.itemSpacing;
      const f = paint(n.fills); if (f) line += ' fill=' + f;
      const st = paint(n.strokes);
      if (st && n.strokeWeight) line += ' stroke=' + st + '/' + (typeof n.strokeWeight === 'symbol' && 'strokeTopWeight' in n ? 'top ' + n.strokeTopWeight + ' right ' + n.strokeRightWeight + ' bottom ' + n.strokeBottomWeight + ' left ' + n.strokeLeftWeight : n.strokeWeight);
      if ('cornerRadius' in n && typeof n.cornerRadius === 'number' && n.cornerRadius) line += ' radius=' + n.cornerRadius;
      if ('opacity' in n && n.opacity < 1) line += ' opacity=' + r1(n.opacity);
    }
    if (n.type === 'INSTANCE') {
      const main = await n.getMainComponentAsync();
      if (main && isIcon(n) && !glyphOf(n)) { const c = glyphColour(n); line += ' icon=figma:' + main.id + (c ? ' colour=' + c : ''); lines.push(line); size += line.length; return; }
      if (main && isIcon(n)) line += ' (wraps the icon below)';
      if (main && seenMain.has(main.id)) {
        const texts = n.findAllWithCriteria({ types: ['TEXT'] }).filter(t => t.visible).map(t => '"' + t.characters.slice(0, 60).replace(/\\n/g, ' ') + '"').join(' ');
        const glyphs = innerIcons(n).filter(k => !innerIcons(k).length), refs = [];
        for (const k of glyphs) { const m = await k.getMainComponentAsync(), c = glyphColour(k); refs.push('figma:' + (m ? m.id : k.id) + (c ? ' ' + c : '')); }
        line += ' (same component as "' + seenMain.get(main.id) + '" above) texts: ' + texts + (refs.length ? ' icons: ' + refs.join(', ') : ''); lines.push(line); size += line.length; return;
      }
      if (main) seenMain.set(main.id, n.name);
    }
    lines.push(line); size += line.length;
    if ('children' in n && depth < 9) for (const ch of n.children) await walk(ch, depth + 1);
  };
  await walk(frame, 0);
  specs[fid] = lines.join('\\n');
}
const out = [];
for (const ic of icons.values()) {
  let svg = null;
  try { svg = await ic.node.exportAsync({ format: 'SVG_STRING' }); } catch (e) { svg = null; }
  if (svg && svg.length < 60000) out.push({ id: ic.id, name: ic.name, w: ic.w, h: ic.h, frames: ic.frames, svg });
}
return { icons: out, specs };`;
  const svgColours = svg => [...new Set([...svg.replace(/<defs>[\s\S]*?<\/defs>/g, '').matchAll(/(?:fill|stroke)(?:=|:\s*)"?(#[0-9a-f]{3,8}|rgba?\([^)]*\)|[a-z]+)/gi)].map(m => m[1].toLowerCase()).filter(c => c !== 'none' && c !== 'transparent' && !c.startsWith('url')))];
  async function figmaIconsViaPlugin(fileKey, sid, added) {
    if (!mcp || !added.length) return false;
    const res = await figmaCall('use_figma', { fileKey, description: 'Read-only: read the layer details of these screens and export the icons they use as SVG, for Zapp cell styles', code: ICON_SCRIPT(added.map(a => a.f.id)), ...sid });
    const txt = textOf(res); let data;
    try { data = JSON.parse(txt); } catch (e) { const a = txt.indexOf('{'), z = txt.lastIndexOf('}'); data = a >= 0 ? JSON.parse(txt.slice(a, z + 1)) : null; }
    const list = Array.isArray(data) ? data : data?.icons;
    if (!Array.isArray(list)) return false;
    for (const { scr, f } of added) if (data?.specs?.[f.id]) scr.figmaSpec = data.specs[f.id];
    for (const ic of list) {
      if (!ic || !ic.svg) continue;
      const ref = `figma:${ic.id}`;
      // a large copy for drawing (an SVG draws at the size its own width and height say)
      const tag = (ic.svg.match(/<svg\b[^>]*>/) || [''])[0], big = tag.replace(/\b(width|height)="([\d.]+)(px)?"/g, (m, k, v) => `${k}="${Math.round(+v * 12)}"`);
      const enc = x => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(x);
      S.figmaIcons[ref] = { ref, key: ic.id, name: ic.name || ref, w: ic.w, h: ic.h, svg: ic.svg, url: enc(ic.svg), hi: enc(ic.svg.replace(tag, big)), mono: svgColours(ic.svg).length <= 1, vector: true };
      for (const { scr, f } of added) if ((ic.frames || []).includes(f.id)) (scr.figmaIcons ||= []).includes(ref) || scr.figmaIcons.push(ref);
    }
    return true;
  }
  async function figmaIconsFor(scr, frame, metaText, fileKey, sid) {
    const root = parseMeta(metaText); if (!root) return;
    const el = [...root.querySelectorAll('*')].find(n => n.getAttribute('id') === frame.id); if (!el) return;
    // positions are relative to the parent in Figma's layer data; fall back to page coordinates if they don't fit the frame
    let layers = iconLayers(el, false);
    const inside = l => l.x >= -2 && l.y >= -2 && l.x + l.w <= frame.w + 2 && l.y + l.h <= frame.h + 2;
    if (layers.length && layers.filter(inside).length < layers.length * 0.8) { const abs = iconLayers(el, true); if (abs.filter(inside).length > layers.filter(inside).length) layers = abs; }
    const seen = new Map(), refs = [];
    for (const l of layers.filter(inside)) {
      const key = GENERIC.test(l.name) ? l.id : `${l.name.toLowerCase()}|${Math.round(l.w)}x${Math.round(l.h)}`;
      if (seen.has(key)) { const r = seen.get(key); if (r && !refs.includes(r)) refs.push(r); continue; }
      const existing = Object.values(S.figmaIcons).find(x => x.key === key);
      if (existing) { seen.set(key, existing.ref); refs.push(existing.ref); continue; }
      if (Object.keys(S.figmaIcons).length >= 40) break;
      seen.set(key, null);
      let got = null;
      // 1. Figma renders the layer on its own (transparent, sharp) when it has a plain id
      if (/^\d+:\d+$/.test(l.id) && mcp) {
        try {
          const shot = await figmaCall('get_screenshot', { fileKey, nodeId: l.id, maxDimension: Math.round(Math.max(l.w, l.h) * 4), contentsOnly: true, enableBase64Response: true, ...sid });
          const im = imageOf(shot);
          if (im) { const img = await loadImg(`data:${im.mimeType || 'image/png'};base64,${im.data}`); if (img.naturalWidth >= l.w * 1.5) got = cleanIcon(img); }
        } catch (e) { /* fall back to the crop */ }
      }
      // 2. otherwise (layers inside components) cut it from the exported screen
      if (!got) { const k = scr.w / frame.w, pad = 1; got = cleanIcon(scr.img, { key: true, sx: (l.x - pad) * k, sy: (l.y - pad) * k, sw: (l.w + pad * 2) * k, sh: (l.h + pad * 2) * k }); }
      if (!got) continue;
      const ref = `figma:${l.id}`;
      S.figmaIcons[ref] = { ref, key, name: l.name || ref, w: Math.round(l.w), h: Math.round(l.h), url: got.url, mono: got.mono, screen: scr.name };
      seen.set(key, ref); refs.push(ref);
    }
    scr.figmaIcons = refs;
  }
  // one image of the screen's Figma icons, numbered, so Claude can see which is which
  async function iconSheet(refs) {
    const list = refs.map(r => S.figmaIcons[r]).filter(Boolean); if (!list.length) return null;
    const cols = Math.min(8, list.length), cell = 120, rows = Math.ceil(list.length / cols);
    const c = document.createElement('canvas'); c.width = cols * cell; c.height = rows * cell; const g = c.getContext('2d');
    g.fillStyle = '#7A7A7A'; g.fillRect(0, 0, c.width, c.height); g.font = '600 15px system-ui, sans-serif'; g.textAlign = 'center';
    for (let i = 0; i < list.length; i++) {
      const x = (i % cols) * cell, y = Math.floor(i / cols) * cell, img = await loadImg(list[i].url), s = 64 / Math.max(img.width, img.height);
      g.drawImage(img, x + (cell - img.width * s) / 2, y + 12 + (64 - img.height * s) / 2, img.width * s, img.height * s);
      g.fillStyle = '#FFFFFF'; g.fillText(String(i + 1), x + cell / 2, y + cell - 16);
    }
    return new Promise(ok => c.toBlob(ok, 'image/png'));
  }

  /* ---------- analysis with Claude ---------- */
  const log = line => { const l = $('log'); l.hidden = false; l.textContent += (l.textContent ? '\n' : '') + line; l.scrollTop = l.scrollHeight; };
  function promptFor(scr, known) {
    return [
      'You convert mobile app screen designs into Zapp cell styles (importable JSON for the Zapp app platform).',
      'Follow the RULES exactly. Answer with JSON only, in the FORMAT, no prose.',
      '', '# RULES', K.rules, '', '# FORMAT', K.schema, '', '# WORKED EXAMPLES (from a reviewed build; match this level of detail)', JSON.stringify(K.examples),
      '', '# THIS SCREEN',
      `The attached image is the "${scr.name}" screen. It is ${scr.w} px wide and ${scr.h} px tall. The screen is ${scr.screenW} points wide (${scr.device}), so 1 point = ${(scr.w / scr.screenW).toFixed(3)} px. Give every size in points.`,
      scr.figmaSpec ? `FIGMA LAYER DETAILS for this screen, from the design file (positions in points from the screen's top left, auto-layout padding as top,right,bottom,left, gaps, fills, strokes, and each text's content, font, size/line height, letter spacing and colour). These are exact: use them for sizes, padding, spacing, colours, fonts and sample text instead of measuring the image. Padding inside a component that wraps a row is the cell's padding; a list with gap=0 has no gap between rows. icon=figma:… marks an icon from the list below.\n${scr.figmaSpec}`
        : scr.meta ? `Figma layer data for this frame: ${scr.meta.slice(0, 2000)}` : '',
      navKnown().length ? `Navigation already described on earlier screens (reuse the same variant name and values when a bar matches): ${navKnown().join(' | ')}` : '',
      known.length ? `Cell styles already described from other screens (do NOT describe these again; list their names in "seen" if they appear here): ${known.map(c => `${c.desc.name} (${c.desc.plugin}): ${c.desc.purpose || ''}`).join(' | ')}` : '',
      'Return the whole response described under "Whole response" in the FORMAT: cells, seen, screen (this screen top to bottom as components, using exact cell names, with the text each item shows in "texts"), spacing (the screen padding, the gap between components and its background), navigation (the status bar, navigation bar and bottom tab bar, as plugins) and icons.',
      S.iconsSet || S.iconsTouched ? `The icon library is already chosen (${S.icons.library}); repeat it in "icons".` : '',
      Object.keys(S.fonts.uploads).length ? `UPLOADED FONTS (the design's own font files; wherever the design's type matches one, use its family name exactly and set "source": "uploaded"): ${Object.entries(S.fonts.uploads).map(([f, u]) => `${f} (weights ${[...new Set(u.faces.filter(x => !x.italic).map(x => x.weight))].join(', ')})`).join('; ')}` : '',
      S.fonts.picks.length ? `Fonts already chosen for earlier screens (use the same family for the same type here, and repeat them in "fonts"): ${S.fonts.picks.map(p => `${p.family} for ${p.seen || 'text'}`).join('; ')}` : '',
      (scr.figmaIcons || []).length ? `ICONS FROM THE FIGMA FILE${scr.sheet ? ' (the second image shows them, numbered in this order)' : ''}: ${scr.figmaIcons.map((r, i) => `${i + 1}. ${r} "${S.figmaIcons[r]?.name}" ${S.figmaIcons[r]?.w}x${S.figmaIcons[r]?.h}${S.figmaIcons[r]?.mono ? '' : ' (multi-colour)'}`).join('; ')}. These are the design's own icons: wherever a cell uses one (badges, action icons, header buttons, button icons), set the icon to its exact ref (e.g. "${scr.figmaIcons[0]}") instead of a role name. Use a role only for an icon that isn't in this list. If a Figma icon already includes its background shape (a filled square or circle behind the glyph), set the badge background to null so it isn't drawn twice.` : '',
      'Work in this order: write the inventory first (every visible element, top to bottom), then fonts, then the cells that build every inventory element, then seen, screen and icons.',
      'Fidelity comes first (RULES section 0): match the screenshot as closely as the rules allow. Never leave out visible text, images or buttons to keep a block in one cell; split it into stacked cells instead.',
      'Include every distinct content cell style on the screen (headers, tiles, rows, heroes, banners, info blocks, button rows). Do not make cells for the status bar, the app navigation bar or the bottom tab bar: describe those in navigation. Skip tab strips.',
    ].filter(Boolean).join('\n');
  }
  async function analyse() {
    if (!sample || S.busy || !S.screens.length) return;
    S.busy = true; $('analyse').disabled = true; $('log').textContent = '';
    const todo = S.screens.filter(s => s.state !== 'Done');
    for (const scr of todo) {
      scr.state = 'Reading…'; renderScreens(); log(`${scr.name}: reading the screen…`);
      try {
        const sheet = (scr.figmaIcons || []).length && (imgMax || 1) > 1 ? await iconSheet(scr.figmaIcons) : null; scr.sheet = !!sheet;
        const res = await sample.json(promptFor(scr, S.cells), { images: sheet ? [scr.blob, sheet] : [scr.blob], modelTier: 'complex', cache: false });
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
        if (res?.spacing && typeof res.spacing === 'object') scr.spacing = res.spacing;
        if (res?.navigation && typeof res.navigation === 'object') scr.navigation = res.navigation;
        if (res?.icons?.library && ICONS.libraries[res.icons.library] && !S.iconsTouched && !S.iconsSet) {
          S.icons = { library: res.icons.library, light: C.color(res.icons.light, '#FFFFFF'), dark: C.color(res.icons.dark, '#121212'), why: res.icons.why || '' };
          S.iconsSet = true; renderIconPanel();
          for (const c of S.cells) await buildCell(c);
        }
        for (const f of Array.isArray(res?.fonts) ? res.fonts : []) {
          if (!f || typeof f.family !== 'string' || S.fonts.picks.some(p => p.family === f.family)) continue;
          S.fonts.picks.push({ family: f.family, seen: String(f.seen || ''), why: String(f.why || ''), source: f.source || 'google',
            alternatives: (Array.isArray(f.alternatives) ? f.alternatives : []).filter(a => typeof a === 'string' && a !== f.family).slice(0, 4) });
        }
        scr.inventory = Array.isArray(res?.inventory) ? res.inventory.filter(i => i && i.element) : [];
        const left = scr.inventory.filter(i => !i.cell);
        for (const i of left) log(`  Left out: ${i.element}${i.reason ? ` (${i.reason})` : ''}`);
        renderFontPanel();
        for (const n of res?.seen || []) { const c = S.cells.find(x => x.desc.name.toLowerCase() === String(n).toLowerCase()); if (c && !c.screens.includes(scr.name)) c.screens.push(scr.name); }
        scr.state = 'Done'; log(`${scr.name}: ${found.length} new cell style${found.length === 1 ? '' : 's'}.`);
      } catch (e) {
        scr.state = 'Failed';
        log(`${scr.name}: ${e?.code === 'not_granted' ? 'Claude access was declined.' : e?.code === 'rate_limited' ? 'Claude is busy; try again in a minute.' : (e?.message || 'failed')}`);
        if (e?.code === 'not_granted') break;
      }
      renderScreens();
    }
    await alignHeaders();
    S.busy = false; renderScreens(); renderAll();
    if (S.cells.length) { S.sel = S.sel || S.cells[0].id; show('cells'); toast(`${S.cells.length} cell styles ready`); }
  }
  $('analyse').addEventListener('click', analyse);

  // Headers usually line up with the first item of the rail, list or grid under them. When a header's title starts a
  // few points off that edge (a measuring slip), move it onto the edge; bigger differences are left as designed.
  const leftPad = d => d.plugin === 'cell_info' && Array.isArray(d.header?.padding) && d.header.padding[3] != null ? num(d.header.padding[3]) : num((d.cell?.padding || [])[3]);
  const insetOf = d => num(d.layout?.padding) + leftPad(d) + (d.plugin === 'cell_info' ? 0 : num((d.image?.margin || [])[3]));
  async function alignHeaders() {
    const want = new Map();
    for (const scr of S.screens) {
      const lay = scr.layout || [];
      for (let i = 0; i < lay.length - 1; i++) {
        const h = findCell(lay[i].cell), r = findCell(lay[i + 1].cell);
        if (!h || !r || h.desc.plugin !== 'cell_info' || r.desc.plugin === 'cell_info' || !['rail', 'list', 'grid'].includes(lay[i + 1].component)) continue;
        if (!want.has(h)) want.set(h, []); want.get(h).push({ inset: insetOf(r.desc), under: r.desc.name });
      }
    }
    for (const [h, list] of want) {
      const counts = new Map(); for (const x of list) counts.set(x.inset, (counts.get(x.inset) || 0) + 1);
      const target = [...counts].sort((a, b) => b[1] - a[1])[0][0], now = insetOf(h.desc), diff = target - now;
      if (!diff || Math.abs(diff) > 8) continue;
      const d = h.desc, pad = target - num(d.layout?.padding);
      if (Array.isArray(d.header?.padding) && d.header.padding[3] != null) d.header.padding[3] = pad;
      else { d.cell = d.cell || {}; const p = Array.isArray(d.cell.padding) ? d.cell.padding : [0, 0, 0, 0]; p[3] = pad; d.cell.padding = p; }
      log(`  Lined up ${d.name} with the first item of ${list[0].under} (${target}pt from the edge, was ${now}pt).`);
      await buildCell(h);
    }
  }

  /* ---------- views ---------- */
  function show(v) {
    for (const b of document.querySelectorAll('[role=tab]')) { const t = b.id.slice(2); b.setAttribute('aria-selected', t === v); $('v-' + t).hidden = t !== v; }
    if (v === 'compare') renderDoc();
    if (v === 'screens') renderMock();
  }
  document.querySelector('[role=tablist]').addEventListener('click', e => { const b = e.target.closest('[role=tab]'); if (b) show(b.id.slice(2)); });

  const cellBg = c => c.spec?.appBg || '#121212';
  function renderAll() {
    $('nCells').textContent = S.cells.length;
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
    renderStage(); renderInspector(); renderFontPanel();
  }
  function decisionsHtml(d) {
    const icon = { works: '✓', changed: '!', alternative: '→' };
    return `<ul class="dec">${(d.decisions || []).map(x => `<li class="${esc(x.type)}"><i aria-hidden="true">${icon[x.type] || '·'}</i><span>${x.item ? `<b>${esc(x.item)}.</b> ` : ''}${esc(x.text)}</span></li>`).join('')}</ul>`;
  }
  function renderStage() {
    const c = S.cells.find(x => x.id === S.sel) || S.cells[0];
    if (!c) { $('stage').innerHTML = '<div class="empty"><b>No cells yet</b><span>Add your designs, then find their cells.</span><button class="btn small" id="goImport" type="button">Add designs</button></div>'; $('goImport').onclick = () => show('import'); return; }
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
    if (!c) { box.innerHTML = `<div class="sec"><span class="hint">Select a cell to see what works, what changed and why.</span></div>`; return; }
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
    const figs = Object.values(S.figmaIcons);
    box.innerHTML = `<div class="row" style="justify-content:space-between"><span class="lab">Icons</span><span class="hint">${figs.length ? `${figs.length} from Figma` : S.iconsSet && !S.iconsTouched ? 'matched to the designs' : ''}</span></div>
      ${figs.length ? `<div class="strip fig" role="list" aria-label="Icons from the Figma file">${figs.map(f => `<img role="listitem" src="${f.url}" alt="${esc(f.name)}" title="${esc(f.name)} · ${f.w}×${f.h}${f.mono ? '' : ' · multi-colour'}">`).join('')}</div>
        <span class="hint">The design's own icons, used wherever the cells need them. For anything the file doesn't have:</span>` : ''}
      <select class="inp" id="iconLib" aria-label="Icon library">${Object.entries(ICONS.libraries).map(([k, v]) => `<option value="${k}" ${k === S.icons.library ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
      <div class="strip" aria-hidden="true">${PREVIEW_ROLES.map(r => `<img alt="" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent((lib.icons[r] || '').replace('<svg', `<svg width="20" height="20" style="color:${S.icons.light}"`))}">`).join('')}</div>
      <span class="hint">${esc(lib.style)}${S.icons.why ? ` · ${esc(S.icons.why)}` : ''}</span>
      <div class="cols"><label class="sw"><input type="color" id="icLight" value="${esc(S.icons.light.slice(0, 7))}"> On dark</label><label class="sw"><input type="color" id="icDark" value="${esc(S.icons.dark.slice(0, 7))}"> On light</label></div>`;
    const changed = async () => { S.iconsTouched = true; iconCache.clear(); renderIconPanel(); for (const c of S.cells) await buildCell(c); renderAll(); toast('Icons redrawn'); };
    $('iconLib').onchange = e => { S.icons.library = e.target.value; S.icons.why = ''; changed(); };
    $('icLight').onchange = e => { S.icons.light = e.target.value.toUpperCase(); changed(); };
    $('icDark').onchange = e => { S.icons.dark = e.target.value.toUpperCase(); changed(); };
  }

  /* ---------- fonts in use ---------- */
  function renderFontPanel() {
    const box = $('fontPanel'); if (!box) return;
    const use = new Map();
    for (const c of S.cells) for (const [f] of fontsIn(c.desc)) use.set(f, (use.get(f) || 0) + 1);
    box.hidden = !use.size; if (!use.size) return;
    const uploads = Object.keys(S.fonts.uploads);
    const NOTE = { missing: 'Not on Google Fonts: pick another or add the file', uploaded: 'Your font file', system: 'System font', google: 'Google Fonts' };
    box.innerHTML = `<div class="row" style="justify-content:space-between"><span class="lab">Fonts</span><label class="hint link" for="fontInput">Add font files</label></div>` +
      [...use].sort((a, b) => b[1] - a[1]).map(([fam, n]) => {
        const pick = S.fonts.picks.find(p => p.family === fam) || {}, st = fontStatus[fam] || 'google';
        const opts = [...new Set([fam, ...(pick.alternatives || []), ...uploads])];
        return `<div class="fr"><div class="fs" style="font-family:'${esc(fam)}',var(--f-ui)">Ag<span>${esc(fam)}</span></div>
          <select class="inp" data-fam="${esc(fam)}" aria-label="Font used instead of ${esc(fam)}">${opts.map(o => `<option ${o === fam ? 'selected' : ''}>${esc(o)}</option>`).join('')}<option value="__other">Another Google font…</option></select>
          <span class="hint${st === 'missing' ? ' bad' : ''}">${esc(NOTE[st])} · ${n} cell${n > 1 ? 's' : ''}${pick.seen ? ` · ${esc(pick.seen)}` : ''}${pick.why ? `. ${esc(pick.why)}` : ''}</span></div>`;
      }).join('');
    box.querySelectorAll('select[data-fam]').forEach(sel => sel.onchange = () => {
      const from = sel.dataset.fam;
      if (sel.value !== '__other') return swapFont(from, sel.value);
      sel.value = from;
      if (sel.nextElementSibling?.classList.contains('other')) return;
      sel.insertAdjacentHTML('afterend', `<div class="row other"><input class="inp" placeholder="Google font name, e.g. Manrope" aria-label="Google font name"><button class="btn small" type="button">Use</button></div>`);
      const row = sel.nextElementSibling, inp = row.querySelector('input'), go = () => { const v = inp.value.trim(); if (v) swapFont(from, v); };
      row.querySelector('button').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); }; inp.focus();
    });
  }
  async function swapFont(from, to) {
    if (!to || to === from) return;
    const touched = [];
    for (const c of S.cells) {
      let hit = false;
      (function walk(o) { if (!o || typeof o !== 'object') return; if (o.family === from && ('weight' in o || 'size' in o)) { o.family = to; hit = true; } for (const v of Object.values(o)) walk(v); })(c.desc);
      if (hit) touched.push(c);
    }
    const p = S.fonts.picks.find(x => x.family === from);
    if (p) { p.alternatives = [...new Set([from, ...p.alternatives.filter(a => a !== to)])].slice(0, 5); p.family = to; }
    else S.fonts.picks.push({ family: to, seen: '', why: '', alternatives: [from] });
    toast(`Switching to ${to}…`);
    for (const c of touched) await buildCell(c);
    renderAll();
    toast(fontStatus[to] === 'missing' ? `${to} isn't on Google Fonts (names are case-sensitive)` : `${touched.length} cell${touched.length === 1 ? '' : 's'} now use ${to}`);
  }

  /* ---------- screens mock-up ---------- */
  const findCell = name => S.cells.find(c => c.desc.name.toLowerCase() === String(name).toLowerCase());
  // how many items a placement shows
  const itemCount = (item, c) => { const comp = item.component || c?.spec?.layout?.type || 'single', cols = Math.max(1, +item.columns || 3);
    return comp === 'rail' ? Math.max(1, Math.min(12, +item.count || 4)) : comp === 'list' ? Math.max(1, Math.min(18, +item.count || 3)) : comp === 'grid' ? Math.max(cols, Math.min(18, +item.count || cols * 2)) : 1; };
  // one item drawn with the text the design shows in that place (texts are keyed by each label's data key)
  async function itemSnap(c, texts) {
    if (!texts || !Object.keys(texts).length || !c.json) return null;
    const key = `${c.rev}|${JSON.stringify(texts)}`; c.itemSnaps ||= new Map();
    if (!c.itemSnaps.has(key)) c.itemSnaps.set(key, withEngine(async () => {
      const o = renderOpts(c), ext = { ...(o.ext || {}) };
      for (const [k, v] of Object.entries(texts)) { if (k === 'title') o.title = String(v); else if (k === 'summary') o.summary = String(v); else ext[k] = String(v); }
      const r = engine.CellEngine.render(c.json, { ...o, ext });
      await new Promise(ok => setTimeout(ok, 30));
      return { url: await engine.CellEngine.snapshot({ scale: 2, pad: 0 }), w: r.width, h: r.height };
    }).catch(() => null));
    return c.itemSnaps.get(key);
  }
  function mockBlock(item, W, imgs) {
    const c = findCell(item.cell); if (!c || !c.snapRaw || !c.size) return { html: '', h: 0 };
    const lay = c.spec.layout || {}, comp = item.component || lay.type || 'single';
    const pad = num(lay.padding), gap = num(lay.gap ?? lay.rowGap ?? 8), n = itemCount(item, c);
    const at = i => (imgs && imgs[i]) || { url: c.snapRaw, w: c.size.w, h: c.size.h };
    const im = (x, w, h) => `<img src="${x.url}" alt="" style="width:${w ?? x.w}px;height:${h ?? x.h}px">`;
    const all = Array.from({ length: n }, (_, i) => at(i));
    // rails make every item as tall as the deepest one, filled with the cell's background (as on device)
    const fill = c.desc?.cell?.background || 'transparent', boxed = (x, w, h, H) => `<div style="flex:none;width:${w ?? x.w}px;height:${H}px;background:${esc(fill)}">${im(x, w, h)}</div>`;
    if (comp === 'rail') { const H = Math.max(...all.map(x => x.h)); return { h: H, html: `<div class="blk" style="gap:${gap}px;padding-left:${pad}px;align-items:flex-start">${all.map(x => boxed(x, null, null, H)).join('')}</div>` }; }
    if (comp === 'list') { const rg = num(lay.rowGap ?? 0);
      return { h: all.reduce((a, x) => a + x.h, 0) + (n - 1) * rg, html: `<div class="blk" style="flex-direction:column;gap:${rg}px;padding:0 ${pad}px">${all.map(x => im(x)).join('')}</div>` }; }
    // grids: each row as tall as its deepest item
    if (comp === 'grid') { const cols = Math.max(1, +item.columns || 3), g = num(lay.gap ?? 8), w = (W - pad * 2 - g * (cols - 1)) / cols, rows = [];
      for (let i = 0; i < n; i += cols) rows.push(all.slice(i, i + cols).map(x => ({ x, h: x.h * w / x.w })));
      const rowH = rows.map(r => Math.max(...r.map(o => o.h)));
      return { h: rowH.reduce((a, b) => a + b, 0) + (rows.length - 1) * g, html: `<div class="blk" style="flex-direction:column;gap:${g}px;padding:0 ${pad}px">${rows.map((r, ri) => `<div style="display:flex;gap:${g}px;align-items:flex-start">${r.map(o => boxed(o.x, w, o.h, rowH[ri])).join('')}</div>`).join('')}</div>` }; }
    return { h: all[0].h, html: `<div class="blk" style="padding-left:${Math.max(0, (W - all[0].w) / 2)}px">${im(all[0])}</div>` };
  }
  // draws straight away with each cell's own sample, then again once the items with the design's text are ready
  let mockToken = 0;
  function renderMock() {
    const t = ++mockToken;
    drawMock(null);
    const jobs = [], pending = navImages().filter(im => !navImgCache.has(imgKey(im)));
    if (pending.length) jobs.push(Promise.all(pending.map(makeNavImg)).then(() => null));
    for (const scr of S.screens) (scr.layout || []).forEach((item, i) => {
      const c = findCell(item.cell), texts = Array.isArray(item.texts) ? item.texts.filter(x => x && typeof x === 'object') : [];
      if (!c || !texts.length) return;
      jobs.push(Promise.all(Array.from({ length: itemCount(item, c) }, (_, j) => itemSnap(c, texts[j % texts.length]))).then(imgs => [scr.id, i, imgs]));
    });
    if (!jobs.length) return;
    Promise.all(jobs).then(res => {
      if (t !== mockToken || $('v-screens').hidden) return;
      const map = new Map(); for (const r of res) { if (!r) continue; const [sid, i, imgs] = r; if (!map.has(sid)) map.set(sid, []); map.get(sid)[i] = imgs; }
      drawMock(map);
    });
  }
  const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
  /* ---------- theme: the values most components and screens share ---------- */
  const ZAPP_NAME = { 'hero-qb': 'Hero', horizontal_list_qb: 'Horizontal List', 'list-qb': 'List', 'grid-qb': 'Grid', 'group-qb': 'Group', 'group-info-qb': 'Group Info' };
  const ZAPP_TYPE = { single: 'hero-qb', rail: 'horizontal_list_qb', list: 'list-qb', grid: 'grid-qb' };
  // what the theme plugin starts with (phone), used when the designs don't give a value
  const ZAPP_DEFAULT = { padding: 20, gutter: 12, marginBottom: 20, screenTop: 25, screenBottom: 50 };
  const fin = v => (v != null && v !== '' && isFinite(+v) ? +v : null);
  const boxAt = (scr, i) => (Array.isArray(scr.spacing?.screenPadding) ? fin(scr.spacing.screenPadding[i]) : null);
  // every component placed on a screen, with the spacing the design gives it
  function placements(scr) {
    const items = scr.layout || [], out = [];
    items.forEach((it, i) => {
      const c = findCell(it.cell); if (!c) return;
      const L = c.spec?.layout || {}, d = c.desc.layout || {}, comp = it.component || L.type || 'single', header = c.desc.plugin === 'cell_info';
      const next = items[i + 1], nc = next && findCell(next.cell);
      // a header sits directly on the rail, list or grid it introduces (they share a Group)
      const heads = !!(header && nc && nc.output && nc.desc.plugin !== 'cell_info' && ['rail', 'list', 'grid'].includes(next.component));
      const prev = items[i - 1], pc = prev && findCell(prev.cell);
      const headed = !header && ['rail', 'list', 'grid'].includes(comp) && !!(pc && pc.desc.plugin === 'cell_info');
      out.push({ i, it, c, comp, header, heads, headed,
        pad: header ? null : fin(comp === 'single' ? d.padding : L.padding ?? d.padding),
        gapH: comp === 'rail' ? fin(L.gap ?? d.gap) : comp === 'grid' ? fin(d.gap) : null,
        gapV: comp === 'list' ? num(fin(L.rowGap ?? d.rowGap), 0) : comp === 'grid' ? fin(d.gap) : null,
        after: heads ? 0 : i === items.length - 1 ? null : fin(it.gapAfter) ?? fin(scr.spacing?.componentGap) });
    });
    return out;
  }
  // the most common value; a tie goes to `prefer` when it is one of the tied values, then to the larger one
  function common(vals, dflt, prefer) {
    const got = vals.filter(v => v != null), n = new Map(); for (const v of got) n.set(v, (n.get(v) || 0) + 1);
    if (!n.size) return { value: dflt, count: 0, of: 0, measured: false };
    const top = Math.max(...n.values()), tied = [...n].filter(([, k]) => k === top).map(([v]) => v);
    const value = tied.includes(prefer) ? prefer : typeof tied[0] === 'number' ? Math.max(...tied) : tied[0];
    return { value, count: top, of: got.length, measured: true };
  }
  const rgbOf = v => { const s = String(v || ''), h = /^#([0-9a-f]{6})/i.exec(s); if (h) { const n = parseInt(h[1], 16); return [n >> 16, n >> 8 & 255, n & 255]; }
    const m = s.match(/[\d.]+/g); return m && m.length >= 3 ? m.slice(0, 3).map(Number) : [0, 0, 0]; };
  const rgbaText = v => { const [r, g, b] = rgbOf(v); return `rgba(${r}, ${g}, ${b}, 1)`; };
  const hexText = v => '#' + rgbOf(v).map(x => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase();
  function themeValues() {
    const scrs = S.screens.filter(s => (s.layout || []).length), P = scrs.flatMap(placements);
    const gutterH = common(P.map(p => p.gapH), ZAPP_DEFAULT.gutter);
    const gutterV = common(P.map(p => p.gapV), ZAPP_DEFAULT.gutter, gutterH.value);
    // screens that open with a hero sit against the navigation bar (0), so the theme takes the most common gap of the others
    const tops = scrs.map(s => boxAt(s, 0)).filter(v => v != null), spaced = tops.filter(v => v > 0);
    const screenTop = { ...common(spaced.length ? spaced : tops, ZAPP_DEFAULT.screenTop), of: tops.length };
    const bgs = scrs.map(s => s.spacing?.background || findCell((s.layout.find(i => findCell(i.cell)) || {}).cell)?.spec?.appBg).filter(Boolean).map(hexText);
    const background = common(bgs, '#000000');
    const [r, g, b] = rgbOf(background.value), dark = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
    return { scrs, P, padding: common(P.map(p => p.pad), ZAPP_DEFAULT.padding), marginBottom: common(P.filter(p => !p.heads).map(p => p.after), ZAPP_DEFAULT.marginBottom),
      gutterH, gutterV, screenTop, screenBottom: common(scrs.map(s => boxAt(s, 2)), ZAPP_DEFAULT.screenBottom),
      screenSide: common(scrs.flatMap(s => [boxAt(s, 1), boxAt(s, 3)]), 0), background, statusTheme: dark ? 'light' : 'dark' };
  }
  // the theme plugin's own fields, ready to type in
  const themeJson = T => ({
    screen_padding_top: T.screenTop.value, screen_padding_bottom: T.screenBottom.value, screen_padding_left: T.screenSide.value, screen_padding_right: T.screenSide.value,
    component_margin_top: 0, component_margin_left: 0, component_margin_right: 0, component_margin_bottom: T.marginBottom.value,
    component_padding_top: 0, component_padding_bottom: 0, component_padding_left: T.padding.value, component_padding_right: T.padding.value,
    component_gutter_vertical: T.gutterV.value, component_gutter_horizontal: T.gutterH.value, component_corner_radius: 0,
    app_background_color: rgbaText(T.background.value), status_background_color: rgbaText(T.background.value), status_theme: `${T.statusTheme}-content` });

  /* ---------- screen outline: the screen as Zapp components, in the layout's own format ---------- */
  // the component settings for one placement; whatever matches the theme is left out so the theme still applies
  function componentStyles(p, T) {
    const { c, comp, it } = p, L = c.spec?.layout || {}, d = c.desc.layout || {}, st = {};
    if (p.pad != null && p.pad !== T.padding.value) Object.assign(st, { component_padding_left: p.pad, component_padding_right: p.pad });
    if (comp === 'rail') {
      if (L.cellsPerView) Object.assign(st, { horizontal_list_scaled_switch: true, horizontal_list_cells_per_view: L.cellsPerView, horizontal_list_next_offset: L.peek });
      else Object.assign(st, { horizontal_list_scaled_switch: false, horizontal_list_cell_width: L.itemWidth });
    }
    if (comp === 'grid') st.component_columns = +it.columns || d.columns || 2;
    if (p.gapH != null && p.gapH !== T.gutterH.value) st.component_gutter_horizontal = p.gapH;
    if (p.gapV != null && p.gapV !== T.gutterV.value) st.component_gutter_vertical = p.gapV;
    // a header left on the theme's margin would open a gap above its list, so it is always set
    if (p.after != null && p.after !== T.marginBottom.value) st.component_margin_bottom = p.after;
    return st;
  }
  const feedName = (item, c) => String((item.texts || [])[0]?.title || c.desc.header?.title?.sample || c.desc.name);
  function screenStyles(scr, T) {
    const st = {}, top = boxAt(scr, 0), bottom = boxAt(scr, 2);
    if (top != null && top !== T.screenTop.value) st.screen_padding_top = top;
    if (bottom != null && bottom !== T.screenBottom.value) st.screen_padding_bottom = bottom;
    return st;
  }
  function screenOutline(scr, T = themeValues()) {
    const P = placements(scr).filter(p => p.c.output), out = [];
    const component = (p, inGroup) => {
      const type = p.header ? 'group-info-qb' : ZAPP_TYPE[p.comp] || 'hero-qb';
      return { component_type: type, name: ZAPP_NAME[type], cell_style: p.c.desc.name,
        styles: { cell_plugin_configuration_id: p.c.output, ...componentStyles(p, T) },
        ...(inGroup ? {} : { data: { source: '', type: '' } }), rules: p.header ? { hide_component_if_data_is_empty: true } : { component_cells_selectable: true } };
    };
    for (let k = 0; k < P.length; k++) {
      const p = P[k];
      if (p.header) {
        // a header and the rail, list or grid under it share one feed: a Group holding Group Info and that component
        const group = { component_type: 'group-qb', name: feedName(p.it, p.c), data: { source: '', type: '' }, rules: { hide_component_if_data_is_empty: true }, ui_components: [component(p, true)] };
        if (p.heads && P[k + 1] && P[k + 1].i === p.i + 1) { group.ui_components.push(component(P[k + 1], true)); k++; }
        out.push(group);
      } else out.push(component(p, false));
    }
    const st = screenStyles(scr, T), M = navModel(), navs = scr.navigation ? screenNavigations(scr, M) : [];
    const hide = M.tabs && scr.navigation && !scr.navigation.tabBar;
    return { name: scr.name, type: 'general_content', ...(hide ? { general: { hide_menu: true } } : {}), ...(Object.keys(st).length ? { styles: st } : {}), ...(navs.length ? { navigations: navs } : {}), ui_components: out };
  }

  /* ---------- screens tab: theme summary, mock-ups, and one component's details at a time ---------- */
  const tag = on => `<span class="tg ${on ? 'ov' : ''}">${on ? 'Override' : 'Theme'}</span>`;
  const usedBy = (m, what) => !m.measured ? 'Not in the designs: Zapp default' : `${m.count} of ${m.of} ${what}`;
  function overridesList(T) {
    const out = [];
    for (const scr of T.scrs) {
      const ss = screenStyles(scr, T);
      if ('screen_padding_top' in ss) out.push(`${scr.name}: screen padding top ${ss.screen_padding_top}${ss.screen_padding_top === 0 ? ' (the first component sits against the navigation bar)' : ''}`);
      if ('screen_padding_bottom' in ss) out.push(`${scr.name}: screen padding bottom ${ss.screen_padding_bottom}`);
      for (const p of placements(scr)) {
        const st = componentStyles(p, T), bits = [];
        if ('component_padding_left' in st) bits.push(`side padding ${st.component_padding_left}`);
        if ('component_gutter_horizontal' in st) bits.push(`gap between cells ${st.component_gutter_horizontal}`);
        if ('component_gutter_vertical' in st) bits.push(`gap between rows ${st.component_gutter_vertical}`);
        if ('component_margin_bottom' in st && !p.heads) bits.push(`space below ${st.component_margin_bottom}`);
        if (bits.length) out.push(`${scr.name}: ${p.c.desc.name} (${ZAPP_NAME[ZAPP_TYPE[p.comp]] || 'Hero'}), ${bits.join(', ')}`);
      }
    }
    return [...new Set(out)];
  }
  function themeHtml(T) {
    const four = (label, vals, note) => `<div class="trow"><span class="tl">${label}</span><span class="tv">${vals.map(([k, v]) => `<span class="tbox"><b>${esc(v)}</b><small>${k}</small></span>`).join('')}</span><span class="hint">${esc(note)}</span></div>`;
    const one = (label, v, note, sw) => `<div class="trow"><span class="tl">${label}</span><span class="tv"><span class="tbox wide">${sw ? `<i style="background:${esc(sw)}"></i>` : ''}<b>${esc(v)}</b></span></span><span class="hint">${esc(note)}</span></div>`;
    const ov = overridesList(T), measured = T.scrs.some(s => s.spacing);
    return `<section class="theme"><div class="row" style="justify-content:space-between"><h2>Suggested theme values</h2><button class="btn small" type="button" data-copy-theme>Copy JSON</button></div>
      <p class="hint">The value most components and screens use, in the order of the Zapp theme plugin. Anything different is set on that component or screen.</p>
      <div class="tgrid">
        ${four('Screen padding', [['Top', T.screenTop.value], ['Bottom', T.screenBottom.value], ['Left', T.screenSide.value], ['Right', T.screenSide.value]], !T.screenTop.measured ? usedBy(T.screenTop) : `Top: ${T.screenTop.count} of ${T.screenTop.of} screens · bottom: ${usedBy(T.screenBottom, 'screens')}`)}
        ${four('Component margin', [['Top', 0], ['Left', 0], ['Right', 0], ['Bottom', T.marginBottom.value]], `Bottom is the space between components: ${usedBy(T.marginBottom, 'components')}`)}
        ${four('Component padding', [['Top', 0], ['Bottom', 0], ['Left', T.padding.value], ['Right', T.padding.value]], `Sides: ${usedBy(T.padding, 'components')}`)}
        ${one('Component gutter vertical', T.gutterV.value, `Between rows: ${usedBy(T.gutterV, 'lists and grids')}`)}
        ${one('Component gutter horizontal', T.gutterH.value, `Between cells: ${usedBy(T.gutterH, 'rails and grids')}`)}
        ${one('Component corner radius', 0, 'Corners are part of each cell style')}
        ${one('App background colour', T.background.value, usedBy(T.background, 'screens'), T.background.value)}
        ${one('Status bar background', T.background.value, 'Matches the app background', T.background.value)}
        ${one('Status theme', T.statusTheme === 'light' ? 'Light' : 'Dark', T.statusTheme === 'light' ? 'Light text on a dark bar' : 'Dark text on a light bar')}
      </div>
      ${ov.length ? `<details class="olist" open><summary>Set on a component or screen instead (${ov.length})</summary><ul class="left">${ov.map(o => `<li>${esc(o)}</li>`).join('')}</ul></details>` : ''}
      ${measured ? '' : '<p class="hint">Screen padding and the space between components are read when cells are found; find cells again on a screen to measure them.</p>'}
    </section>`;
  }
  const compName = p => (p.header ? 'Group Info' : ZAPP_NAME[ZAPP_TYPE[p.comp]] || 'Hero');
  function componentHtml(scr, p, T) {
    const st = componentStyles(p, T), L = p.c.spec?.layout || {}, rows = [], n = itemCount(p.it, p.c);
    const row = (label, value, over) => rows.push(`<div class="srow"><span>${label}</span><b>${esc(value)}</b>${over == null ? '' : tag(over)}</div>`);
    row('Cell style', p.c.desc.name);
    if (p.header) row('Feed', p.heads ? 'Shared with the component below (one Group)' : 'Its own Group');
    else if (p.headed) row('Feed', 'From its Group (shared with the header above)');
    else row('Feed', 'Its own');
    if (p.comp !== 'single' && !p.header) row('Items shown', n);
    if (p.comp === 'rail') row('Cell width', L.cellsPerView ? `Scaled: ${L.cellsPerView} per view, next cell offset ${L.peek}` : `Fixed: ${L.itemWidth}`);
    if (p.comp === 'grid') row('Columns', st.component_columns);
    if (!p.header) row('Side padding', p.pad ?? T.padding.value, 'component_padding_left' in st);
    if (p.gapH != null) row('Gap between cells', p.gapH, 'component_gutter_horizontal' in st);
    if (p.gapV != null) row('Gap between rows', p.gapV, 'component_gutter_vertical' in st);
    if (p.heads) row('Space below', '0, so it sits on its list', T.marginBottom.value !== 0);
    else if (p.i === (scr.layout || []).length - 1) row('Space below', `${T.marginBottom.value} (last on the screen)`, false);
    else row('Space below', p.after ?? T.marginBottom.value, 'component_margin_bottom' in st);
    return `<div class="row" style="justify-content:space-between"><button class="btn small ghost" type="button" data-back="${esc(scr.id)}">← ${esc(scr.name)}</button><span class="hint">Component ${p.i + 1} of ${scr.layout.length}</span></div>
      <h3 class="ctitle">${esc(compName(p))}${p.header ? ' <span class="hint">in a Group</span>' : ''}</h3>
      <div class="srows">${rows.join('')}</div>
      <div class="row"><button class="btn small" type="button" data-open-cell="${esc(p.c.id)}">Open cell style</button></div>
      <p class="hint">Theme: uses the suggested theme value. Override: set this on the component.</p>`;
  }
  function sideHtml(scr, T, M = navModel()) {
    const P = placements(scr), sel = S.pick?.[scr.id], p = P.find(x => x.i === sel);
    if (sel === 'nav' || sel === 'tabs') return navSideHtml(scr, sel, M);
    if (p) return componentHtml(scr, p, T);
    const ss = screenStyles(scr, T), top = boxAt(scr, 0), bottom = boxAt(scr, 2), missing = scr.layout.filter(i => !findCell(i.cell)).map(i => i.cell);
    return `<div class="row" style="justify-content:space-between"><span class="lab">This screen</span><button class="btn small" type="button" data-copy-outline="${esc(scr.id)}">Copy JSON</button></div>
      <div class="srows">
        <div class="srow"><span>Screen padding top</span><b>${top ?? T.screenTop.value}</b>${tag('screen_padding_top' in ss)}</div>
        <div class="srow"><span>Screen padding bottom</span><b>${bottom ?? T.screenBottom.value}</b>${tag('screen_padding_bottom' in ss)}</div>
      </div>
      <span class="lab">Components</span>
      <ol class="clist">${P.map(x => `<li><button type="button" class="cbtn" data-pick="${esc(scr.id)}:${x.i}"><b>${esc(compName(x))}</b> <span class="hint">${esc(x.c.desc.name)}${x.heads ? ' · header of the next' : ''}</span></button></li>`).join('')}</ol>
      ${M.variantOf(scr) || (M.tabs && scr.navigation?.tabBar) ? `<span class="lab">Navigation</span><ol class="clist nolist">${M.variantOf(scr) ? `<li><button type="button" class="cbtn" data-pick="${esc(scr.id)}:nav"><b>Navigation bar</b> <span class="hint">${esc(M.variantOf(scr).name)}</span></button></li>` : ''}${M.tabs && scr.navigation?.tabBar ? `<li><button type="button" class="cbtn" data-pick="${esc(scr.id)}:tabs"><b>Bottom tab bar</b></button></li>` : ''}</ol>` : ''}
      ${M.tabs && scr.navigation && !scr.navigation.tabBar ? '<p class="hint">No tab bar on this screen: turn on "hide menu" for it.</p>' : ''}
      <p class="hint">Tap a component or bar here or in the preview to see its settings.</p>
      ${(scr.inventory || []).some(i => !i.cell) ? `<span class="lab">Left out</span><ul class="left">${scr.inventory.filter(i => !i.cell).map(i => `<li>${esc(i.element)}${i.reason ? ` <span class="hint">· ${esc(i.reason)}</span>` : ''}</li>`).join('')}</ul>` : ''}
      ${missing.length ? `<p class="hint">Not drawn: ${esc(missing.join(', '))} (removed or not built).</p>` : ''}
      <p class="hint">Sample text and placeholder artwork.${scr.navigation ? ' The bars are drawn from their plugin settings; the device status bar is left plain.' : ' The status bar, navigation and tab bars are drawn once cells are found again.'}</p>`;
  }
  function pick(sid, i) {
    S.pick ||= {}; S.pick[sid] = S.pick[sid] === i ? null : i;
    const sec = $('mock').querySelector(`.mscreen[data-scr="${CSS.escape(sid)}"]`), scr = S.screens.find(x => x.id === sid); if (!sec || !scr) return;
    sec.querySelectorAll('.cmp').forEach(el => { const on = el.dataset.pick.split(':').pop() === String(S.pick[sid]); el.classList.toggle('on', on); el.setAttribute('aria-pressed', on); });
    sec.querySelector('.mside').innerHTML = sideHtml(scr, themeValues(), navModel());
  }
  const copy = async (txt, ok) => { try { await navigator.clipboard.writeText(txt); toast(ok); } catch (err) { toast("Couldn't copy here; it's in the cells download too."); } };
  $('mock').addEventListener('click', e => {
    const at = sel => e.target.closest(sel);
    let b;
    if ((b = at('[data-copy-outline]'))) { const scr = S.screens.find(x => x.id === b.dataset.copyOutline); if (scr) copy(JSON.stringify(screenOutline(scr), null, 2), `Copied the ${scr.name} outline`); }
    else if (at('[data-copy-theme]')) copy(JSON.stringify(themeJson(themeValues()), null, 2), 'Copied the theme values');
    else if ((b = at('[data-back]'))) pick(b.dataset.back, S.pick?.[b.dataset.back]);
    else if ((b = at('[data-open-cell]'))) { S.sel = b.dataset.openCell; show('cells'); renderAll(); }
    else if ((b = at('[data-copy-nav]'))) { const M = navModel(), w = b.dataset.copyNav, v = w.startsWith('nav:') && M.variants.find(x => x.name === w.slice(4));
      if (v) copy(JSON.stringify(navJson(v), null, 2), `Copied the ${v.name} navigation bar`); else if (w === 'tabs' && M.tabs) copy(JSON.stringify(tabsJson(M.tabs), null, 2), 'Copied the tab bar'); }
    else if ((b = at('[data-pick]'))) { const k = b.dataset.pick.lastIndexOf(':'), id = b.dataset.pick.slice(k + 1); pick(b.dataset.pick.slice(0, k), /^\d+$/.test(id) ? +id : id); }
  });
  $('mock').addEventListener('keydown', e => { const b = e.target.closest('.cmp'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); b.click(); } });
  function drawMock(itemImgs) {
    const box = $('mock'), done = S.screens.filter(s => (s.layout || []).length);
    if (!done.length) { box.innerHTML = `<div class="empty"><b>No screens to mock up yet</b><span>Find cells from your designs; each screen is rebuilt here from its cells.</span></div>`; return; }
    const T = themeValues(), M = navModel();
    box.innerHTML = themeHtml(T) + navCardHtml(M) + done.map(scr => {
      const W = scr.screenW, tablet = scr.device === 'tablet', disp = tablet ? 560 : 300, k = disp / W, H = scr.h * W / scr.w;
      const bg = scr.spacing?.background || findCell((scr.layout.find(i => findCell(i.cell)) || {}).cell)?.spec?.appBg || '#000';
      // the mock grows when the cells run longer than the screenshot (split cells, sample text)
      const P = new Map(placements(scr).map(p => [p.i, p])), top = boxAt(scr, 0) || 0, bottom = boxAt(scr, 2) || 0, sel = S.pick?.[scr.id];
      const blocks = scr.layout.map((it, i) => ({ ...mockBlock(it, W, itemImgs?.get(scr.id)?.[i]), i, gap: P.get(i)?.after || 0, p: P.get(i) }));
      const NF = navFrame(scr, M), contentH = NF.top + NF.bottom + top + bottom + blocks.reduce((a, b) => a + b.h + (b.html ? b.gap : 0), 0);
      return `<section class="mscreen" data-scr="${esc(scr.id)}"><h2>${esc(scr.name)} <span class="hint">${tablet ? 'Tablet' : 'Phone'} · ${W}pt</span></h2>
        <div class="mpair">
          <div class="mcol"><span class="lab">Original</span><div class="phone ${tablet ? 'tablet' : ''}"><img src="${scr.url}" alt="Original ${esc(scr.name)}"></div></div>
          <div class="mcol"><span class="lab">Built from cells · tap a component</span><div class="phone ${tablet ? 'tablet' : ''}" style="height:${Math.round(Math.max(H, contentH) * k)}px;background:${esc(bg)}">
            <div class="inner" style="width:${W}px;height:${Math.max(H, contentH)}px;transform:scale(${k});padding-top:${NF.top + top}px;box-sizing:border-box">${scr.navigation ? navBarHtml(scr, NF, sel) + tabBarHtml(scr, NF, sel) : ''}${blocks.filter(b => b.html && b.p).map(b => `<div class="cmp${sel === b.i ? ' on' : ''}" role="button" tabindex="0" aria-pressed="${sel === b.i}" aria-label="${esc(compName(b.p))}: ${esc(b.p.c.desc.name)}" data-pick="${esc(scr.id)}:${b.i}" style="margin-bottom:${b.gap}px">${b.html}</div>`).join('')}</div></div></div>
          <div class="mside">${sideHtml(scr, T, M)}</div>
        </div></section>`;
    }).join('');
  }

  /* ---------- navigation: the navigation bar and bottom tab bar plugins ---------- */
  const NAV_ID = 'quick_brick_applicaster_navbar', TABS_ID = 'quick-brick-bottom-tabs';
  const navScreens = () => S.screens.filter(s => s.navigation && (s.layout || []).length);
  // what earlier screens described, so later screens reuse the same variant names and values
  function navKnown() {
    const out = [], seen = new Set();
    for (const s of S.screens) {
      const n = s.navigation; if (!n) continue;
      if (n.navBar && !seen.has('v:' + n.navBar.variant)) { seen.add('v:' + n.navBar.variant); out.push(`navigation bar "${n.navBar.variant}" (${s.name}): ${JSON.stringify(n.navBar)}`); }
      if (n.tabBar && !seen.has('tabs')) { seen.add('tabs'); out.push(`bottom tab bar (${s.name}): ${JSON.stringify(n.tabBar)}`); }
    }
    return out;
  }
  // screens grouped by identical navigation bar settings (each group is one way of setting up the plugin), and the tab bar
  function navModel() {
    const scrs = navScreens(), variants = [], byKey = new Map();
    for (const s of scrs) {
      const d = s.navigation.navBar; if (!d) continue;
      const conv = C.navBar({ ...d, statusBar: s.navigation.statusBar });
      const key = JSON.stringify([conv.styles, conv.assets, conv.images.map(i => [i.field, i.icon]), conv.navItems.map(n => [n.label, n.target, n.image.icon])]);
      if (!byKey.has(key)) {
        let name = String(d.variant || 'Navigation bar'); while (variants.some(v => v.name === name)) name += ' 2';
        const v = { name, desc: d, conv, screens: [], statusBar: s.navigation.statusBar || {} }; byKey.set(key, v); variants.push(v);
      }
      byKey.get(key).screens.push(s);
    }
    const withTabs = scrs.filter(s => s.navigation.tabBar), tabDesc = withTabs.length ? withTabs.reduce((a, s) => ((s.navigation.tabBar.tabs || []).length > (a.tabs || []).length ? s.navigation.tabBar : a), withTabs[0].navigation.tabBar) : null;
    const tabs = tabDesc ? { desc: tabDesc, conv: C.tabBar(tabDesc), screens: withTabs, hidden: scrs.filter(s => !s.navigation.tabBar) } : null;
    if (tabs) {
      const names = d => (d.tabs || []).map(x => x.label).join('|');
      if (withTabs.some(s => names(s.navigation.tabBar) !== names(tabDesc))) tabs.conv.notes.unshift(`The tab bar is the same on every screen, so it uses the tabs drawn on ${withTabs.find(s => s.navigation.tabBar === tabDesc).name}.`);
      if (tabs.hidden.length) tabs.conv.notes.unshift(`${tabs.hidden.map(s => s.name).join(', ')} ${tabs.hidden.length === 1 ? 'has' : 'have'} no tab bar: turn on "hide menu" on ${tabs.hidden.length === 1 ? 'that screen' : 'those screens'}.`);
    }
    return { variants, tabs, variantOf: s => variants.find(v => v.screens.includes(s)) || null };
  }
  // images for the plugins: each button or tab image is its whole box with the glyph at its designed size in the middle
  const navImgCache = new Map();
  const imgKey = im => [im.icon, im.width, im.height, im.iconSize, im.color, im.fill].join('|');
  const navImg = im => (im && im.icon ? navImgCache.get(imgKey(im)) || '' : '');
  async function makeNavImg(im) {
    if (!im || !im.icon) return '';
    const k = imgKey(im); if (navImgCache.has(k)) return navImgCache.get(k);
    let url = '';
    try { url = await iconPng(im.icon, { size: im.width, height: im.height, iconSize: im.fill ? Math.min(im.width, im.height) : im.iconSize, color: im.fill ? (S.figmaIcons[im.icon] ? null : '#FFFFFF') : im.color }); } catch (e) { console.warn('nav image', e); }
    navImgCache.set(k, url); return url;
  }
  function navImages(M = navModel()) {
    const list = [];
    for (const v of M.variants) { list.push(...v.conv.images); for (const n of v.conv.navItems) list.push(n.image); }
    if (M.tabs) for (const t of M.tabs.conv.tabs) list.push(t.icon, t.iconSelected);
    return list.filter(x => x && x.icon);
  }
  const statusH = scr => num(scr.navigation?.statusBar?.height, scr.device === 'tablet' ? 24 : 59);
  const safeBottom = scr => (scr.device === 'tablet' ? 20 : 34);
  // where the content starts below the bars, and how much the tab bar takes at the bottom
  function navFrame(scr, M) {
    const v = M.variantOf(scr), sb = statusH(scr), t = M.tabs && scr.navigation?.tabBar ? M.tabs : null;
    const barH = v ? v.conv.height + num(v.conv.styles.navbar__border_bottom_thickness) : 0, pos = v?.conv.styles.content_position;
    const top = !v ? sb : pos === 'on_top_screen' ? 0 : pos === 'on_bottom_status_bar' ? sb : sb + barH;
    return { v, t, sb, barH, top, bottom: t ? t.conv.height + safeBottom(scr) : 0 };
  }
  const titleFont = st => { const ps = st.navbar_title__ios_font_family || '', fam = (S.fonts.picks.find(p => C.famPrefix(p.family) === ps.split('-')[0]) || {}).family;
    return `font-family:${fam ? `'${fam}', ` : ''}system-ui, sans-serif;font-weight:${/Bold|Black/.test(ps) ? 700 : /Semi|Medium/.test(ps) ? 600 : 400}`; };
  function navBarHtml(scr, F, sel) {
    const v = F.v; if (!v) return '';
    const st = v.conv.styles, as = v.conv.assets, d = v.desc;
    const bg = st.background_type === 'Gradient' ? `linear-gradient(${st.navbar_gradient__top_background_color}, ${st.navbar_gradient__bottom_background_color})` : st.background_color;
    const coverSB = st.background_type === 'Gradient' && st.navbar_gradient__mode === 'on_top_screen';
    const img = (im, w, h) => { const u = navImg(im); return u ? `<img src="${u}" alt="" style="width:${w}px;height:${h}px">` : `<span style="width:${w}px;height:${h}px;display:block"></span>`; };
    const leftImg = v.conv.images.find(i => i.field === 'back_button' || i.field === 'menu_button'), logo = v.conv.images.find(i => i.field === 'app_logo');
    const centre = st.presentation_style === 'logo' ? (logo ? img(logo, as.logo_asset_width, as.logo_asset_height) : '')
      : st.presentation_style === 'title' ? `<span style="color:${st.title_color};font-size:${st.navbar_title__ios_font_size}px;line-height:${st.navbar_title__ios_line_height}px;letter-spacing:${st.navbar_title__ios_letter_spacing}px;${titleFont(st)};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:${st.title_text_transform === 'default' ? 'none' : st.title_text_transform}">${esc(d.title?.sample || scr.name)}</span>` : '';
    const leftW = leftImg ? as.asset_width + st.navbar_h_gutter : 0, rightW = v.conv.navItems.length ? v.conv.navItems.length * as.asset_width + (v.conv.navItems.length - 1) * st.navbar_buttons__horizontal_gutter + st.navbar_h_gutter : 0;
    const side = st.style === 'center' ? Math.max(leftW, rightW) : 0;
    return `<div class="cmp navb${sel === 'nav' ? ' on' : ''}" role="button" tabindex="0" aria-pressed="${sel === 'nav'}" aria-label="Navigation bar: ${esc(v.name)}" data-pick="${esc(scr.id)}:nav"
        style="position:absolute;left:0;right:0;top:0;height:${F.sb + F.barH}px;z-index:3">
      <div style="height:${F.sb}px;background:${coverSB ? 'transparent' : st.status_bar__background_color}"></div>
      ${coverSB ? `<div style="position:absolute;inset:0;background:${bg};z-index:-1"></div>` : ''}
      <div style="position:relative;height:${v.conv.height}px;box-sizing:border-box;padding:${st.navbar_padding_top}px ${st.navbar_padding_right}px ${st.navbar_padding_bottom}px ${st.navbar_padding_left}px;display:flex;align-items:center;${coverSB ? '' : `background:${bg};`}border-bottom:${st.navbar__border_bottom_thickness}px solid ${st.navbar__border_bottom_color}">
        ${leftImg ? `<div style="flex:none;z-index:1">${img(leftImg, as.asset_width, as.asset_height)}</div>` : ''}
        <div style="position:absolute;top:0;bottom:0;left:${st.navbar_padding_left + (st.style === 'center' ? side : leftW)}px;right:${st.navbar_padding_right + (st.style === 'center' ? side : rightW)}px;display:flex;align-items:center;justify-content:${st.style === 'center' ? 'center' : 'flex-start'};overflow:hidden">${centre}</div>
        <div style="margin-left:auto;display:flex;gap:${st.navbar_buttons__horizontal_gutter}px;z-index:1">${v.conv.navItems.map(n => img(n.image, as.asset_width, as.asset_height)).join('')}</div>
      </div></div>`;
  }
  function tabBarHtml(scr, F, sel) {
    const t = F.t; if (!t) return '';
    const st = t.conv.styles, cur = (scr.navigation.tabBar.tabs || []).findIndex(x => x.selected);
    return `<div class="cmp tabb${sel === 'tabs' ? ' on' : ''}" role="button" tabindex="0" aria-pressed="${sel === 'tabs'}" aria-label="Bottom tab bar" data-pick="${esc(scr.id)}:tabs"
        style="position:absolute;left:0;right:0;bottom:0;height:${F.bottom}px;background:${st.bar_background_color};z-index:3;border-top:${st.top_border_width}px solid ${st.top_border_color};box-sizing:border-box">
      <div style="display:flex;height:${C.TAB.height.ios}px;justify-content:center">${t.conv.tabs.map((x, i) => {
        const on = cur >= 0 ? i === cur : x.selected, u = navImg(on ? x.iconSelected : x.icon);
        return `<div style="flex:1;${scr.device === 'tablet' ? 'min-width:80px;max-width:180px;' : ''}display:flex;flex-direction:column;align-items:center;justify-content:center">
          ${u ? `<img src="${u}" alt="" style="width:32px;height:32px">` : '<span style="width:32px;height:32px"></span>'}
          ${st.title_label_toggle ? `<span style="font-size:${st.title_ios_font_size}px;line-height:14px;color:${on ? st.title_active_font_color : st.title_default_font_color};white-space:nowrap">${esc(x.label)}</span>` : ''}</div>`; }).join('')}</div></div>`;
  }
  // a row in a settings list; `set` marks a value that differs from the plugin's own default
  const nrow = (label, value, set) => `<div class="srow"><span>${label}</span><b>${value}</b>${set == null ? '' : `<span class="tg ${set ? 'ov' : ''}">${set ? 'Set' : 'Default'}</span>`}</div>`;
  const swatch = c => `<i class="sw" style="background:${esc(c)}"></i>${esc(String(c).replace(/\s/g, ''))}`;
  const thumbs = list => `<div class="nthumbs">${list.map(([im, label]) => `<figure>${navImg(im) ? `<img src="${navImg(im)}" alt="" style="aspect-ratio:${im.width}/${im.height}">` : '<span></span>'}<figcaption>${esc(label)}</figcaption></figure>`).join('')}</div>`;
  const notesHtml = n => (n.length ? `<ul class="left">${n.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  const POS = { on_bottom_navbar: 'Below the bar', on_bottom_status_bar: 'Below the status bar (under the bar)', on_top_screen: 'Top of the screen (under both bars)' };
  const DISPLAY = { logo: 'Logo', title: 'Screen title', hidden: 'Nothing', 'logo-title': 'Logo, then title' };
  function navBarRows(v) {
    const st = v.conv.styles, as = v.conv.assets, D = C.NAV_DEFAULT;
    return [
      nrow('Height', `${v.conv.height} <span class="hint">(tallest item ${v.conv.height - st.navbar_padding_top - st.navbar_padding_bottom} + padding)</span>`),
      nrow('Logo display', DISPLAY[st.presentation_style], st.presentation_style !== 'logo'),
      nrow('Alignment', st.style === 'center' ? 'Centre' : 'Left', st.style !== 'center'),
      nrow('Content position', POS[st.content_position], st.content_position !== 'on_bottom_navbar'),
      nrow('Background', st.background_type === 'Gradient' ? `${swatch(st.navbar_gradient__top_background_color)} → ${swatch(st.navbar_gradient__bottom_background_color)}` : swatch(st.background_color), true),
      nrow('Status bar', `${st.status_bar__background_color === 'rgba(0, 0, 0, 0)' ? 'Clear' : swatch(st.status_bar__background_color)} · ${st.status_bar__theme === 'light-content' ? 'light text' : 'dark text'}`, true),
      nrow('Padding', [st.navbar_padding_top, st.navbar_padding_right, st.navbar_padding_bottom, st.navbar_padding_left].join(' · '), [st.navbar_padding_top, st.navbar_padding_right, st.navbar_padding_bottom, st.navbar_padding_left].join() !== D.padding.join()),
      nrow('Button image size', `${as.asset_width} × ${as.asset_height}`, as.asset_width !== D.button[0] || as.asset_height !== D.button[1]),
      ...(st.presentation_style === 'logo' ? [nrow('Logo size', `${as.logo_asset_width} × ${as.logo_asset_height}`, as.logo_asset_width !== D.logo[0] || as.logo_asset_height !== D.logo[1])] : []),
      ...(st.presentation_style === 'title' ? [nrow('Title', `${esc(st.navbar_title__ios_font_family)} ${st.navbar_title__ios_font_size}/${st.navbar_title__ios_line_height} · ${swatch(st.title_color)}`, true)] : []),
      ...(st.navbar__border_bottom_thickness ? [nrow('Bottom border', `${st.navbar__border_bottom_thickness} · ${swatch(st.navbar__border_bottom_color)}`, true)] : []),
      ...(v.conv.navItems.length ? [nrow('Right buttons', v.conv.navItems.map(n => `${esc(n.label)} → ${esc(n.target || 'set a screen')}`).join('<br>'), true)] : []),
    ].join('');
  }
  function tabBarRows(t) {
    const st = t.conv.styles;
    return [
      nrow('Height', `${C.TAB.height.ios} (iPhone) · ${C.TAB.height.android} (Android) <span class="hint">fixed</span>`),
      nrow('Tabs', `${t.conv.tabs.length} of ${C.TAB.maxTabs}: ${t.conv.tabs.map(x => esc(x.label)).join(', ')}`),
      nrow('Background', swatch(st.bar_background_color), true),
      nrow('Top border', st.top_border_width ? `${st.top_border_width} · ${swatch(st.top_border_color)}` : 'None', !!st.top_border_width),
      nrow('Labels', st.title_label_toggle ? `${esc(st.title_ios_font_selector)} ${st.title_ios_font_size}` : 'Off', !st.title_label_toggle),
      nrow('Selected colour', swatch(st.title_active_font_color), true),
      nrow('Other tabs colour', swatch(st.title_default_font_color), true),
    ].join('');
  }
  const tabThumbs = t => thumbs(t.conv.tabs.flatMap(x => [[x.icon, x.label], [x.iconSelected, 'selected']]));
  const navVariantThumbs = v => thumbs([...v.conv.images.map(i => [i, { app_logo: 'Logo', back_button: 'Back', menu_button: 'Menu' }[i.field]]), ...v.conv.navItems.map(n => [n.image, n.label])]);
  function navSideHtml(scr, which, M) {
    const back = `<div class="row" style="justify-content:space-between"><button class="btn small ghost" type="button" data-back="${esc(scr.id)}">← ${esc(scr.name)}</button><button class="btn small" type="button" data-copy-nav="${which === 'nav' ? 'nav:' + esc(M.variantOf(scr)?.name || '') : 'tabs'}">Copy JSON</button></div>`;
    if (which === 'nav') {
      const v = M.variantOf(scr); if (!v) return back;
      return `${back}<h3 class="ctitle">Navigation bar <span class="hint">${esc(v.name)}</span></h3>
        <p class="hint">Used on ${esc(v.screens.map(s => s.name).join(', '))}. Set on each of those screens.</p>
        <div class="srows">${navBarRows(v)}</div>${navVariantThumbs(v)}${notesHtml(v.conv.notes)}
        <p class="hint">Default: the plugin's own value. Set: change it on the plugin.</p>`;
    }
    const t = M.tabs; if (!t) return back;
    return `${back}<h3 class="ctitle">Bottom tab bar</h3><p class="hint">One for the whole app.</p>
      <div class="srows">${tabBarRows(t)}</div>${tabThumbs(t)}${notesHtml(t.conv.notes)}`;
  }
  function navCardHtml(M) {
    if (!M.variants.length && !M.tabs) return navScreens().length || !S.screens.some(s => (s.layout || []).length) ? '' : `<section class="theme"><h2>Navigation</h2><p class="hint">The navigation bar and tab bar are read when cells are found; find cells again to set them up.</p></section>`;
    return `<section class="theme"><h2>Navigation</h2>
      <p class="hint">The navigation bar and bottom tab bar are plugins, set up from the design. Tap a bar in a preview for its settings.</p>
      <div class="ngrid">
        ${M.variants.length ? `<div class="ncol"><div class="row" style="justify-content:space-between"><span class="lab">Navigation bar · ${M.variants.length} version${M.variants.length === 1 ? '' : 's'}</span></div>
          ${M.variants.map(v => `<div class="nvar"><div class="row" style="justify-content:space-between"><b>${esc(v.name)}</b><button class="btn small" type="button" data-copy-nav="nav:${esc(v.name)}">Copy JSON</button></div>
            <span class="hint">${esc(v.screens.map(s => s.name).join(', '))} · ${esc(DISPLAY[v.conv.styles.presentation_style])}, ${v.conv.styles.style === 'center' ? 'centred' : 'left'} · ${v.conv.height} tall${v.conv.styles.background_type === 'Gradient' ? ' · gradient, content under the bar' : ''}</span>
            ${navVariantThumbs(v)}</div>`).join('')}</div>` : ''}
        ${M.tabs ? `<div class="ncol"><div class="row" style="justify-content:space-between"><span class="lab">Bottom tab bar</span><button class="btn small" type="button" data-copy-nav="tabs">Copy JSON</button></div>
          <div class="srows">${tabBarRows(M.tabs)}</div>${tabThumbs(M.tabs)}${notesHtml(M.tabs.conv.notes)}</div>` : ''}
      </div></section>`;
  }
  // the plugin settings as they're entered, plus the images and items to add
  const navJson = v => ({ plugin: NAV_ID, variant: v.name, screens: v.screens.map(s => s.name), styles: v.conv.styles, assets: { ...v.conv.assets, ...Object.fromEntries(v.conv.images.map(i => [i.field, i.file])) },
    nav_items: v.conv.navItems.map(n => ({ title: n.label, target_screen: n.target, presentation: n.modal ? 'modal' : 'push', assets: { icon: n.image.file } })), notes: v.conv.notes });
  const tabsJson = t => ({ plugin: TABS_ID, styles: t.conv.styles, nav_items: t.conv.tabs.map(x => ({ title: x.label, target_screen: x.target, presentation: x.modal ? 'modal' : 'push', assets: { icon: x.icon.file, icon_selected: x.iconSelected.file } })),
    hide_menu_on: t.hidden.map(s => s.name), notes: t.conv.notes });
  // for the screen outline: each screen's navigations, as in a Zapp layout
  function screenNavigations(scr, M) {
    const out = [], v = M.variantOf(scr);
    if (v) { const j = navJson(v); out.push({ category: 'nav_bar', navigation_type: NAV_ID, variant: v.name, styles: j.styles, assets: j.assets, nav_items: j.nav_items }); }
    if (M.tabs) out.push({ category: 'menu', navigation_type: TABS_ID });
    return out;
  }
  async function navZip(zip) {
    const M = navModel(); if (!M.variants.length && !M.tabs) return;
    await Promise.all(navImages(M).map(makeNavImg));
    const put = (folder, im) => { const u = navImg(im); if (u) folder.file(im.file, bytes(u)); };
    const nz = zip.folder('navigation'), L = ['Navigation', ''];
    for (const v of M.variants) {
      const f = nz.folder(`navigation_bar/${C.slug(v.name)}`);
      f.file('navigation_bar.json', JSON.stringify(navJson(v), null, 2));
      v.conv.images.forEach(i => put(f, i)); v.conv.navItems.forEach(n => put(f, n.image));
      L.push(`Navigation bar "${v.name}" (navigation_bar/${C.slug(v.name)}/): set on ${v.screens.map(s => s.name).join(', ')}.`,
        ...v.conv.images.map(i => `  - Upload ${i.file} to ${({ app_logo: 'Logo', back_button: 'Back button', menu_button: 'Menu button' })[i.field]}.`),
        ...v.conv.navItems.map(n => `  - Add a nav item "${n.label}" opening ${n.target || 'its screen'}, icon ${n.image.file}.`),
        ...v.conv.notes.map(x => `  - ${x}`), '');
    }
    if (M.tabs) {
      const f = nz.folder('bottom_tab_bar');
      f.file('bottom_tab_bar.json', JSON.stringify(tabsJson(M.tabs), null, 2));
      for (const x of M.tabs.conv.tabs) { put(f, x.icon); put(f, x.iconSelected); }
      L.push('Bottom tab bar (bottom_tab_bar/): add one nav item per tab, in this order:',
        ...M.tabs.conv.tabs.map((x, i) => `  ${i + 1}. ${x.label}: icon ${x.icon.file}, selected icon ${x.iconSelected.file}, opens ${x.target || 'its screen'}.`),
        ...M.tabs.conv.notes.map(x => `  - ${x}`), '');
    }
    L.push('Images are @3x PNGs of each button\'s or tab\'s whole box, with the glyph at its designed size in the middle.', 'The .json files list each plugin field to set, by its key.');
    nz.file('README.txt', L.join('\n') + '\n');
  }

  /* ---------- downloads ---------- */
  const bytes = url => { const b = atob(url.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  async function save(filename, data) {
    if (!downloads) { toast('Downloads work in the published studio.'); return; }
    try { await downloads.save({ filename, data }); toast(`Saved ${filename}`); }
    catch (e) { if (e?.code !== 'declined') toast(e?.message || "That file couldn't be saved."); }
  }
  const iconSource = assets => {
    const fig = assets.some(a => S.figmaIcons[a.role]), lib = assets.some(a => !S.figmaIcons[a.role]), name = ICONS.libraries[S.icons.library]?.name || S.icons.library;
    return fig && lib ? `from the Figma file, others from ${name}` : fig ? 'from the Figma file' : name;
  };
  // the component settings that make the screen match the design (Zapp's horizontal list, list and grid plugins)
  function componentLines(c) {
    const L = c.spec?.layout || {}, d = c.desc.layout || {};
    if (c.desc.plugin === 'cell_info') return ['Group Info inside a Group (as its header): the title shows the group feed\'s title, or set "Title override" on the component',
      ...(c.desc.header?.button ? ['the whole header is tappable and opens the group\'s feed'] : [])];
    if (L.type === 'rail') return [L.cellsPerView ? `Horizontal list, scaled: cells per view ${L.cellsPerView}, next cell offset ${L.peek} (cells about ${L.itemWidth}pt wide on a ${c.spec.screen}pt screen)` : `Horizontal list: scaling off, cell width ${L.itemWidth}`,
      `gutter horizontal ${L.gap}`, `padding left and right ${L.padding}${L.padding === 20 ? ' (the theme default)' : ''}`];
    if (L.type === 'list') return [`List: gutter vertical ${num(L.rowGap)}${num(L.rowGap) === 0 ? ' (set it: the theme default is 12)' : ''}`, `padding left and right ${num(L.padding)}${num(L.padding) === 20 ? ' (the theme default)' : ''}`];
    if (d.type === 'grid') return [`Grid: columns ${d.columns || 2}`, `gutters ${num(d.gap, 12)}`, `padding left and right ${num(d.padding, 20)}`];
    if (num(d.padding) !== 20 && d.padding != null) return [`padding left and right ${num(d.padding)} (the theme default is 20)`];
    return [];
  }
  function readme(c) {
    const d = c.desc, lines = [`${d.name} - ${c.json?.meta?.identifier || d.plugin}`, `${collection()} · built by Zapp Cell Style Studio (rules ${K.version})`, '', d.purpose || '', '',
      `${c.output}: import into the cell builder`, `thumbnails/${c.output.replace('.json', '@2x.png')}: thumbnail for the cell style (500 x 280 @2x)`];
    if (c.overlay) lines.push(`${c.overlay.file}: upload to image_overlay (the gradient over the image)`);
    const figName = a => S.figmaIcons[a.role] ? ` (Figma icon "${S.figmaIcons[a.role].name}")` : '';
    for (const a of (c.assets || []).filter(a => !a.shared)) lines.push(`assets/${a.file}: upload to ${a.field}${figName(a)}`);
    for (const a of (c.assets || []).filter(a => a.shared)) lines.push(`../plugin assets/${a.file}: ${a.field}`);
    for (const l of c.labels || []) lines.push(`Button label: set the ${C.PLUGIN[l.action]?.name || l.action} plugin's label to "${l.text}"`);
    if ((c.assets || []).length) lines.push(`Icons: ${iconSource(c.assets)}`);
    const fn = fontNames([c]); if (fn.length) lines.push(`Fonts: ${fn.map(f => f.ps).join(', ')} (see ../fonts)`);
    const sec = t => (d.decisions || []).filter(x => x.type === t);
    if (sec('works').length) lines.push('', 'What works:', ...sec('works').map(x => `  - ${x.text}`));
    if (sec('changed').length) lines.push('', 'Changes to fit the cell framework:', ...sec('changed').map(x => `  - ${x.item ? x.item + ': ' : ''}${x.text}`));
    if (sec('alternative').length) lines.push('', 'Suggested approach:', ...sec('alternative').map(x => `  - ${x.text}`));
    const cl = componentLines(c); if (cl.length) lines.push('', 'Component settings (on the component that uses this cell style):', ...cl.map(x => `  - ${x}`));
    return lines.join('\n') + '\n';
  }
  // every font face the cells name: { ps, family, weight, face (uploaded file) | null, status }
  function fontNames(list) {
    const out = new Map();
    for (const c of list) for (const [fam, ws] of fontsIn(c.desc)) for (const w of ws) {
      const face = faceFor(fam, w), ps = face ? face.ps : C.psName({ family: fam, weight: w });
      if (!out.has(ps)) out.set(ps, { ps, family: fam, weight: face ? face.weight : w, face, status: face ? 'uploaded' : fontStatus[fam] || 'google' });
    }
    return [...out.values()].sort((a, b) => a.family.localeCompare(b.family) || a.weight - b.weight);
  }
  function fontsReadme(fn) {
    const up = fn.filter(f => f.face), gf = fn.filter(f => !f.face && f.status !== 'system'), sys = fn.filter(f => f.status === 'system');
    const L = ['Fonts these cell styles use', '',
      'Cell styles name each font by its PostScript name (iOS) and font file name (Android). Add each font to the app with',
      'the file named exactly as listed, so the same name works on both.', ''];
    if (up.length) L.push('Your font files (included here, renamed to match):', ...up.map(f => `  ${f.ps}.${f.face.ext}  (${f.family} ${f.weight}${f.face.italic ? ' italic' : ''}, from ${f.face.file})`), '');
    if (gf.length) {
      L.push('Google Fonts (free and open-licensed; download the family, then name each static file as listed):');
      for (const fam of [...new Set(gf.map(f => f.family))]) L.push(`  ${fam}${gf.some(f => f.family === fam && f.status === 'missing') ? ' (not found on Google Fonts: choose another family or supply the file)' : ''}: https://fonts.google.com/specimen/${encodeURIComponent(fam).replace(/%20/g, '+')}`,
        ...gf.filter(f => f.family === fam).map(f => `    ${f.ps}.ttf  (weight ${f.weight})`));
      L.push('');
    }
    if (sys.length) L.push('System fonts (already on the device):', ...sys.map(f => `  ${f.ps}`), '');
    return L.join('\n');
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
        const thumb = await withEngine(async () => { renderInEngine(c); return engine.CellEngine.snapshot({ thumb: true }); });
        dir.file(`thumbnails/${c.output.replace('.json', '@2x.png')}`, bytes(thumb));
      } catch (e) { console.warn('thumbnail', e); }
    }
    // button labels are set once per action plugin: list each, and flag a plugin the designs label two ways
    const labels = new Map();
    for (const c of ok) for (const l of c.labels || []) { if (!labels.has(l.action)) labels.set(l.action, new Map()); labels.get(l.action).set(l.text, [...(labels.get(l.action).get(l.text) || []), c.desc.name]); }
    if (pluginAssets.size || labels.size) {
      const pa = zip.folder('plugin assets');
      for (const a of pluginAssets.values()) pa.file(a.file, bytes(a.dataUrl));
      const L = [];
      if (pluginAssets.size) L.push(`Action plugin button icons (${iconSource([...pluginAssets.values()])}). Upload each to its plugin in Zapp:`, '',
        ...[...pluginAssets.values()].map(a => `${a.file}: ${a.field}${S.figmaIcons[a.role] ? ` (Figma icon "${S.figmaIcons[a.role].name}")` : ''}`), '', 'Flavour 1 is for dark button backgrounds, flavour 2 for light.', '');
      if (labels.size) {
        L.push('Button labels (set once on each action plugin, for the whole app):', '');
        for (const [action, texts] of labels) {
          const name = C.PLUGIN[action]?.name || action;
          if (texts.size === 1) L.push(`${name} plugin › label: "${[...texts.keys()][0]}"`);
          else L.push(`${name} plugin › label: the designs use ${[...texts].map(([t, cs]) => `"${t}" (${cs.join(', ')})`).join(' and ')}; one plugin has one label, so pick one or add a second ${name} plugin.`);
        }
      }
      pa.file('README.txt', L.join('\n') + '\n');
    }
    const laid = S.screens.filter(scr => (scr.layout || []).some(it => ok.some(c => c.desc.name.toLowerCase() === String(it.cell).toLowerCase())));
    if (list === S.cells && laid.length) {
      const sz = zip.folder('screens');
      const T = themeValues();
      for (const scr of laid) sz.file(`${C.slug(scr.name)}.json`, JSON.stringify(screenOutline(scr, T), null, 2));
      sz.file('theme.json', JSON.stringify(themeJson(T), null, 2));
      await navZip(zip);
      sz.file('README.txt', ['Screen outlines', '', 'Each file describes one screen as Zapp components, in the same shape as a Zapp layout (ui_components).', '',
        '- component_type: hero-qb (full-width cells stacked), horizontal_list_qb (rail), list-qb, grid-qb, group-qb (holds a feed shared by its',
        '  Group Info header and the component below it), group-info-qb (the header).',
        '- styles.cell_plugin_configuration_id holds the cell style\'s file name from this download. After importing the cell styles, replace it with',
        '  the id Zapp gives each one.',
        '- data.source is empty: set each component\'s (or group\'s) feed. Group names are the header text from the design.',
        '- theme.json holds the suggested values for the Zapp theme plugin: the spacing and colours most components and screens use.',
        '- navigations lists the screen\'s navigation bar settings and its bottom tab bar (the navigation/ folder has the images and an upload list).',
        '- general.hide_menu: true marks a screen without the tab bar.',
        '- Only settings that differ from theme.json are listed, on the component or (for screen padding) on the screen. A header always sets its',
        '  bottom margin to 0 so it sits on its list.',
        '- Detail screens (show, movie) are opened by the item\'s type: map each type to its screen; the screen then shows the tapped item.', ''].join('\n'));
    }
    const fn = fontNames(ok);
    if (fn.length) {
      const fz = zip.folder('fonts');
      for (const f of fn.filter(x => x.face)) fz.file(`${f.ps}.${f.face.ext}`, f.face.data);
      fz.file('README.txt', fontsReadme(fn));
    }
    await save(name, await zip.generateAsync({ type: 'uint8array' }));
  }
  $('dlAll').addEventListener('click', () => downloadZip(S.cells, `${C.slug(collection())}-cells.zip`));

  /* ---------- report (on screen + PDF) ---------- */
  const counts = () => Object.fromEntries(Object.keys(STATUS).map(k => [k, S.cells.filter(c => c.desc.status === k).length]));
  // "Inter (Google Fonts, closest match to the design's sans) · Acme Sans (supplied)"
  function fontSummary() {
    const fams = [...new Set(fontNames(S.cells).map(f => f.family))];
    return fams.map(f => { const st = S.fonts.uploads[f] ? 'supplied font' : fontStatus[f] === 'system' ? 'system font' : fontStatus[f] === 'missing' ? 'not found on Google Fonts' : 'Google Fonts';
      const p = S.fonts.picks.find(x => x.family === f); return `${f} (${st}${p?.seen ? `, for ${p.seen}` : ''})`; }).join(' · ');
  }
  function renderDoc() {
    const n = counts();
    $('doc').innerHTML = `<div style="display:grid;gap:8px"><span class="lab">${esc(collection())} · Cell style report</span><h1>Designs and built cells, side by side</h1>
      <p class="lede">Each cell style found in the designs, built as an importable Zapp cell. For every cell: the original, the built cell as the platform preview draws it, what works, what changed to fit the cell framework and why, and the suggested approach.</p>
      <div class="row"><span class="pill as_designed">${n.as_designed} as designed</span><span class="pill adapted">${n.adapted} adapted</span><span class="pill workaround">${n.workaround} workaround</span></div>
      ${fontSummary() ? `<p class="hint">Fonts: ${esc(fontSummary())}</p>` : ''}</div>
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
    const n = counts(); text(`${S.cells.length} cell styles · ${n.as_designed} as designed · ${n.adapted} adapted · ${n.workaround} workaround`, 10, { bold: true, after: 3 });
    const fs = fontSummary(); if (fs) text(`Fonts: ${fs}`, 9.5, { color: [70, 70, 76], after: 6 }); else y += 3;
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
      const cl = componentLines(c); if (cl.length) text(`Component: ${cl.join('; ')}.`, 8.5, { color: muted });
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
    renderIconPanel(); renderAll();
    if (window.claude?.use) {
      const [smp, dl, m] = await Promise.all(['sample', 'downloads', 'mcp'].map(n => window.claude.use(n).catch(() => null)));
      sample = smp; downloads = dl; mcp = m;
      if (sample) { const lim = await sample.limits().catch(() => null); imgMax = lim?.images?.maxCount || 1; if (!lim?.images) { sample = null; $('aiHint').textContent = "Claude can't read images in this view, so cells can't be found from screenshots here."; } }
      else $('aiHint').textContent = 'Finding cells uses Claude, which isn’t available in this view.';
      if (!mcp) $('figmaAdd').disabled = true;
    } else $('aiHint').textContent = 'Open the published studio to find cells with Claude.';
    $('dlAll').disabled = $('dlReport').disabled = false;
    renderScreens();
  })();
})();
