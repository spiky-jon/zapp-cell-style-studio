// Cell description (knowledge/schema.md) -> build spec for the engine's buildCell.
// Pure functions, no DOM: the studio runs them in the page, tools/test.mjs runs them in Node.
(function (root) {
  const CLEAR = 'rgba(0,0,0,0)';
  const WEIGHTS = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
  const BASES = { cell_1: 'cell_1', cell_2: 'cell_2', cell_2_text: 'cell_2_text', cell_3: 'cell_3', cell_info: 'cell_info' };
  const IDENT = { cell_1: 'cell_1_mobile', cell_2: 'cell_2_mobile', cell_3: 'cell_3_mobile', cell_info: 'cell_info_mobile' };
  const ACTIONS = { navigation: 'navigation_action', play: 'navigation_action', favourites: 'local_storage_favourites_action', favorites: 'local_storage_favourites_action',
    mylist: 'local_storage_favourites_action', share: 'native_share_action', downloads: 'offline-content-button', download: 'offline-content-button', trailer: 'trailer_action' };

  // action plugin -> name, its first asset (the engine's icon key) and the icon role drawn for it
  const PLUGIN = {
    navigation_action: { name: 'Navigation', asset: 'navigation', role: 'play' },
    local_storage_favourites_action: { name: 'Favourites', asset: 'favorite-default', role: 'plus', active: 'check' },
    native_share_action: { name: 'Share', asset: 'share', role: 'share-ios' },
    'offline-content-button': { name: 'Downloads', asset: 'download-download', role: 'download' },
    trailer_action: { name: 'Trailer', asset: 'trailer', role: 'trailer' },
  };
  const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : d);
  const box = (b, d = [0, 0, 0, 0]) => {
    if (typeof b === 'number') return [b, b, b, b].map(x => num(x));
    if (!Array.isArray(b)) return d.slice();
    if (b.length === 2) return [num(b[0]), num(b[1]), num(b[0]), num(b[1])];
    return [0, 1, 2, 3].map(i => num(b[i], d[i]));
  };
  const color = (c, d = CLEAR) => {
    if (typeof c !== 'string') return d;
    const s = c.trim();
    if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s.slice(1).split('').map(x => x + x).join('').toUpperCase();
    if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) return s.toUpperCase();
    if (/^rgba?\(/i.test(s) || /^transparent$/i.test(s)) return s.replace(/\s+/g, '');
    return d;
  };
  const famPrefix = family => String(family || 'Inter').replace(/[^A-Za-z0-9]/g, '');
  // uploaded fonts carry their own PostScript names; the studio sets a resolver (family, weight) -> name | null
  let fontResolver = null;
  const setFontResolver = fn => { fontResolver = typeof fn === 'function' ? fn : null; };
  const psName = f => (fontResolver && f && f.family && fontResolver(f.family, (f && f.weight) || 400))
    || `${famPrefix(f && f.family)}-${WEIGHTS[Math.round(((f && f.weight) || 400) / 100) * 100] || 'Regular'}`;
  const F = f => ({ font: psName(f), size: num(f && f.size, 14), lineHeight: num(f && f.lineHeight, Math.round(num(f && f.size, 14) * 1.3)), letterSpacing: num(f && f.letterSpacing, 0) });
  const ratioOf = r => {
    const s = String(r || '16x9').replace(/[: /]/g, 'x').toLowerCase();
    const presets = ['16x9', '4x3', '1x1', '3x4', '2x3', '9x16', '3x2'];
    if (presets.includes(s)) return { ratio: s, custom: '' };
    const m = s.match(/^([\d.]+)x([\d.]+)$/);
    return m ? { ratio: 'other', custom: `${m[1]}x${m[2]}` } : { ratio: '16x9', custom: '' };
  };
  const wh = r => { const m = String(r.custom || r.ratio).match(/([\d.]+)x([\d.]+)/); return m ? [+m[1], +m[2]] : [16, 9]; };
  const BOX = (pre, b, kind = 'margin') => { const [t, r, bo, l] = box(b); return { [`${pre}_${kind}_top`]: t, [`${pre}_${kind}_right`]: r, [`${pre}_${kind}_bottom`]: bo, [`${pre}_${kind}_left`]: l }; };
  const pascal = s => String(s).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join('');
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const C3_OFF = Object.fromEntries(['top_text_label_1_switch', 'top_text_label_2_switch', 'top_text_label_3_switch', 'center_text_label_1_switch', 'center_text_label_2_switch',
    'center_text_label_3_switch', 'bottom_text_label_1_switch', 'bottom_text_label_2_switch', 'bottom_text_label_3_switch', 'runtime_switch', 'progress_bar_switch', 'cell_badge_switch',
    'content_badge_switch', 'lock_badge_switch', 'action_switch', 'mobile_buttons_container_buttons_enabled', 'mobile_button_1_button_enabled', 'mobile_button_2_button_enabled', 'mobile_button_3_button_enabled',
    'secondary_image_switch'].map(k => [k, false]));
  const C12_OFF = Object.fromEntries(['cell_badge_switch', 'content_badge_switch', 'lock_badge_switch', 'progress_bar_switch', 'runtime_switch', 'action_switch', 'mobile_buttons_container_buttons_enabled',
    'mobile_button_1_button_enabled', 'mobile_button_2_button_enabled', 'mobile_button_3_button_enabled', 'secondary_image_switch', 'text_label_1_switch', 'text_label_2_switch', 'text_label_3_switch'].map(k => [k, false]));

  // one label as a stack item (props/text/bind relative to its slot prefix)
  function labelItem(l, i, notes) {
    const key = String(l.dataKey || (i === 0 ? 'title' : 'summary')).trim();
    const [dk, ck] = key === 'title' || key === 'summary' ? [key, ''] : ['other', key];
    const pad = box(l.padding), mar = box(l.margin);
    const props = { data_key: dk, custom_data_key: ck, number_of_lines: Math.max(1, Math.round(num(l.lines, 1))),
      text_alignment: ['left', 'center', 'right'].includes(l.align) ? l.align : 'left', text_transform: l.uppercase ? 'uppercase' : 'default',
      margin_top: mar[0], margin_right: mar[1], margin_bottom: mar[2], margin_left: mar[3],
      padding_top: pad[0], padding_right: pad[1], padding_bottom: pad[2], padding_left: pad[3], corner_radius: num(l.radius, 0), date_transform_enable: false };
    if (l.font && l.font.family) notes.fonts.add(l.font.family);
    return { id: l.role || `label${i + 1}`, type: 'label', priority: 10 - i, text: F(l.font), props,
      bind: { '*font_color*': color(l.color, '#FFFFFF'), '*background_color*': color(l.background, CLEAR) } };
  }

  function buttonsSpec(btns, notes) {
    const set = {}, bind = {}, text = {};
    (btns.items || []).slice(0, 3).forEach((b, i) => {
      const p = `mobile_button_${i + 1}`, n = i + 1;
      const action = ACTIONS[String(b.action || 'navigation').toLowerCase().replace(/[^a-z]/g, '')] || 'navigation_action';
      const pad = box(b.padding, [11, 16, 11, 16]);
      const mode = typeof b.width === 'number' ? 'fixed' : b.width === 'dynamic' ? 'dynamic' : 'fill';
      Object.assign(set, {
        [`${p}_button_enabled`]: true, [`${p}_assign_action`]: action, [`${p}_display_mode`]: mode, [`${p}_label_enabled`]: b.label !== false,
        [`${p}_asset_enabled`]: !!b.icon, [`${p}_asset_alignment`]: b.iconPosition === 'right' ? 'right' : b.iconPosition === 'top' ? 'above' : 'left',
        [`${p}_contents_alignment`]: 'center', [`${p}_text_transform`]: b.uppercase === true ? 'uppercase' : 'default',
        [`${p}_padding_top`]: pad[0], [`${p}_padding_right`]: pad[1], [`${p}_padding_bottom`]: pad[2], [`${p}_padding_left`]: pad[3],
        [`${p}_border_size`]: b.border ? num(b.border.width, 1) : 0, [`${p}_asset_width`]: num(b.iconSize, 20), [`${p}_asset_height`]: num(b.iconSize, 20),
        [`${p}_horizontal_gutter`]: num(b.iconGap, 8), [`${p}_vertical_gutter`]: 6, [`${p}_action_asset_flavour`]: b.iconFlavour === 'dark' ? 'flavour_2' : 'flavour_1',
        ...BOX(p, [0, 0, 0, 0]), [`${p}_asset_margin_top`]: 0, [`${p}_asset_margin_right`]: 0, [`${p}_asset_margin_bottom`]: 0, [`${p}_asset_margin_left`]: 0,
      });
      if (mode === 'fixed') set[`${p}_width`] = num(b.width);
      const bg = color(b.background, CLEAR), fg = color(b.color, '#FFFFFF'), bc = b.border ? color(b.border.color, bg) : bg;
      Object.assign(bind, { [`${p}_background_color`]: bg, [`${p}_focused_background_color`]: bg, [`${p}_font_color`]: fg, [`${p}_focused_font_color`]: fg,
        [`${p}_border_color`]: bc, [`${p}_focused_border_color`]: bc, [`${p}_corner_radius`]: num(b.radius, 0) });
      text[p] = F(b.font || { family: 'Inter', weight: 500, size: 15, lineHeight: 20 });
      // the design's label (e.g. "My List"): set once on the action plugin, so record it for the README and the preview
      if (typeof b.text === 'string' && b.text.trim() && b.label !== false) notes.buttonLabels.push({ action, text: b.text.trim() });
      if (b.icon && PLUGIN[action]) notes.buttonIcons.push({ action, role: (typeof b.icon === 'string' && b.icon !== 'true') ? b.icon : PLUGIN[action].role });
      if (b.font && b.font.family) notes.fonts.add(b.font.family);
      void n;
    });
    const m = box(btns.margin);
    Object.assign(set, { mobile_buttons_container_buttons_enabled: true, mobile_buttons_container_stacking: btns.stacking === 'vertical' ? 'vertical' : 'horizontal',
      mobile_buttons_container_align: btns.align === 'center' ? 'center' : 'left', mobile_buttons_container_horizontal_gutter: num(btns.gap, 8), mobile_buttons_container_vertical_gutter: num(btns.gap, 8),
      mobile_buttons_container_margin_top: m[0], mobile_buttons_container_margin_right: m[1], mobile_buttons_container_margin_bottom: m[2], mobile_buttons_container_margin_left: m[3] });
    if (btns.position === 'over_image') set.mobile_buttons_container_over_image_position = btns.overImagePosition || 'bottom_left';
    return { set, bind, text };
  }

  const PROGRESS_POS = { on_image: 'on_top_of_image', on_top_of_image: 'on_top_of_image', bottom_of_cell: 'bottom_of_cell',
    above_label_1: 'above_text_label_1', below_label_1: 'below_text_label_1', above_label_2: 'above_text_label_2', below_label_2: 'below_text_label_2' };

  // Main entry: description -> { base, spec, warnings, fonts }
  function toSpec(d, opts = {}) {
    const notes = { fonts: new Set(), warnings: [], buttonIcons: [], buttonLabels: [] };
    const plugin = IDENT[d.plugin] ? d.plugin : 'cell_2';
    const tablet = opts.device === 'tablet' || d.device === 'tablet';
    const screen = opts.screenW || (tablet ? 1133 : 393);
    const name = (opts.prefix ? opts.prefix + ' ' : '') + (d.name || 'Cell');
    const cell = d.cell || {};
    const set = {}, bind = {}, text = {}, assets = [];
    const labels = (d.labels || []).slice(0, 3);
    if ((d.labels || []).length > 3) notes.warnings.push(`${(d.labels || []).length} labels described; only the first 3 are built.`);
    let base = plugin;
    const spec = { name, collection: opts.collection || 'Studio', device: tablet ? 'Tablet' : 'Mobile', tags: [tablet ? 'Tablet' : 'Mobile'], screen,
      output: `${tablet ? 'tablet_' : ''}cell_style_${pascal(name)}_${IDENT[plugin]}.json`, about: d.purpose || '',
      appBg: color(d.appBackground, '#121212'), annotations: (d.decisions || []).filter(x => x.type !== 'works').map(x => (x.item ? `${x.item}: ` : '') + x.text) };

    // layout -> preview layout
    const lay = d.layout || {};
    if (lay.type === 'rail') {
      // the horizontal list sizes its cells to fit "cells per view" plus a peek of the next cell (its default, scaled mode);
      // a fixed cell width is the other mode. Defaults are the base theme's (padding 20, gutter 12) and the plugin's (2 per view, offset 20).
      const gap = num(lay.gap, 12), pad = num(lay.padding, 20), per = num(lay.cellsPerView, 0), peek = num(lay.peek, 20);
      const itemWidth = per > 0 ? Math.round((screen - pad * 2 - (peek + gap - pad) - gap * (per - 1)) / per) : num(lay.itemWidth, 160);
      spec.layout = { type: 'rail', itemWidth, gap, padding: pad, ...(per > 0 ? { cellsPerView: per, peek } : {}) };
    }
    else if (lay.type === 'list') spec.layout = { type: 'list', rowGap: num(lay.rowGap, 0), padding: num(lay.padding, 0) };
    else spec.layout = { padding: num(lay.padding, 0) };

    if (plugin === 'cell_info') {
      const h = d.header || {}, t = h.title || labels[0] || {}, btn = h.button && (h.button.text || h.button.icon) ? h.button : null;
      const btnText = btn && btn.text ? String(btn.text) : '', btnIcon = btn && btn.icon ? String(btn.icon) : '';
      // the header button only renders when its label has a value, even with the text hidden, so an icon-only button keeps a label
      const pad = Array.isArray(h.padding) ? h.padding : box(cell.padding, [20, 0, 12, 0]);
      const P = v => (v === null || v === undefined ? '' : String(num(v)));
      Object.assign(set, {
        group_info_padding_top: P(pad[0]), group_info_padding_right: P(pad[1]), group_info_padding_bottom: P(pad[2]), group_info_padding_left: P(pad[3]),
        group_info_margin_top: '', group_info_margin_bottom: '', group_info_border_top_thickness: 0, group_info_border_bottom_thickness: 0,
        badge_asset_switch: false, badge_asset: '', button_icon_asset: '',
        button_element_switch: !!btn, button_text_switch: !!btnText, button_text_key: 'other', button_text_custom_data_key: btnText || (btnIcon ? 'View all' : ''),
        button_icon_switch: !!btnIcon, button_icon_width: num(btn && btn.iconSize, 24), button_icon_height: num(btn && btn.iconSize, 24),
        button_element_padding_top: 0, button_element_padding_right: 0, button_element_padding_bottom: 0, button_element_padding_left: 0,
        button_element_margin_left: 12, button_element_border_thickness: 0, button_element_corner_radius: 0, button_element_vertical_position: 'center',
        title_text_switch: true, title_text_data_key: (t.dataKey === 'title' || !t.dataKey) ? 'title' : 'other', title_text_custom_data_key: (t.dataKey && t.dataKey !== 'title') ? t.dataKey : '',
        title_text_number_of_lines: Math.max(1, num(t.lines, 1)), title_text_alignment: t.align || 'left', title_text_transform: t.uppercase ? 'uppercase' : 'default',
        title_text_margin_top: '', title_text_margin_right: '', title_text_margin_bottom: '', title_text_margin_left: '' });
      text.title_text = F(t.font); if (t.font) notes.fonts.add(t.font.family);
      if (btnText) { text.button_text = F(btn.font || t.font); if (btn.font) notes.fonts.add(btn.font.family); }
      if (btnIcon) assets.push({ kind: 'header', role: btnIcon, size: num(btn.iconSize, 24), iconSize: num(btn.iconSize, 24), color: color(btn.color, '#FFFFFF'),
        file: `${slug(name)}-header-icon@3x.png`, field: 'button_icon_asset (header button icon)' });
      Object.assign(bind, { title_text_font_color: color(t.color, '#FFFFFF'), button_text_font_color: color(btn && btn.color, '#FFFFFF'),
        button_element_background_color: CLEAR, button_element_border_color: CLEAR, group_info_background_color: color(cell.background, CLEAR),
        group_info_border_top_color: CLEAR, group_info_border_bottom_color: CLEAR });
      spec.base = 'cell_info.base.json'; spec.set = set; spec.text = text; spec.bind = bind;
      spec.sampleFeed = {}; spec.sampleTitle = t.sample || 'Section title';
      return { base: 'cell_info', spec, warnings: notes.warnings, fonts: [...notes.fonts], assets };
    }

    const img = d.image || null;
    if (plugin === 'cell_2' && !img) base = 'cell_2_text';
    const r = ratioOf(img && img.ratio);
    const cp = box(cell.padding);

    // shared cell box
    Object.assign(set, { cell_padding_top: cp[0], cell_padding_right: cp[1], cell_padding_bottom: cp[2], cell_padding_left: cp[3], ...BOX('cell', [0, 0, 0, 0]),
      cell_border_size: cell.border ? num(cell.border.width, 1) : 0, cell_border_position: 'inside' });
    Object.assign(bind, { cell_corner_radius: num(cell.radius, 0), 'cell_*background_color': color(cell.background, CLEAR), 'cell_*border_color': cell.border ? color(cell.border.color, CLEAR) : CLEAR });
    Object.assign(set, plugin === 'cell_3' ? C3_OFF : C12_OFF);
    if (plugin === 'cell_2') set.text_label_4_switch = false;

    // image
    if (img) {
      const im = box(img.margin);
      Object.assign(set, { image_aspect_ratio: r.ratio, image_aspect_ratio_custom: r.custom, image_key: img.key || 'image_base',
        image_border_size: img.border ? num(img.border.width, 1) : 0, image_margin_top: im[0], image_margin_right: im[1], image_margin_bottom: im[2], image_margin_left: im[3] });
      if (img.border) { set.image_border_position = 'inside'; bind['image_*border_color'] = color(img.border.color, CLEAR); }
      if (plugin === 'cell_3') Object.assign(set, { image_padding_left: 0, image_padding_right: 0 });
      if (plugin === 'cell_2') Object.assign(set, { image_switch: true, image_width: String(num(img.width, 120)) });
      Object.assign(bind, { image_corner_radius: num(img.radius, 0), image_placeholder_color: color(img.placeholder, '#2A2F36') });
    } else if (plugin === 'cell_2') {
      Object.assign(set, { image_switch: false, image_margin_right: 0 });
    } else notes.warnings.push(`${plugin} needs an image; a placeholder image is used.`);

    // overlay gradient over the image
    if (img && d.overlay && Array.isArray(d.overlay.stops) && d.overlay.stops.length > 1) {
      const [rw, rh] = wh(r);
      const stops = d.overlay.stops.map(s => ({ at: Math.max(0, Math.min(1, num(s.at, 0))), token: color(s.color, CLEAR) }));
      const width = Math.round(plugin === 'cell_2' ? num(img.width, 120) * 2 : Math.max(393, num(lay.itemWidth, screen)) * 2);
      spec.overlay = d.overlay.direction === 'horizontal'
        ? { ratio: `${rw}x${rh}`, width, file: `${slug(name)}-overlay.png`, layers: [{ from: [0, 0.5], to: [1, 0.5], stops }] }
        : { ratio: `${rw}x${rh}`, width, file: `${slug(name)}-overlay.png`, stops };
    }

    // dividers (cell_2)
    if (plugin === 'cell_2') {
      for (const side of ['top', 'bottom']) {
        const dv = cell[side === 'top' ? 'dividerTop' : 'dividerBottom'];
        set[`cell_border_${side}_switch`] = !!dv;
        if (dv) {
          const m = box(dv.margin);
          Object.assign(set, { [`cell_border_${side}_thickness`]: num(dv.thickness, 1), [`cell_border_${side}_margin_top`]: m[0], [`cell_border_${side}_margin_right`]: m[1],
            [`cell_border_${side}_margin_bottom`]: m[2], [`cell_border_${side}_margin_left`]: m[3] });
          bind[`cell_border_${side}_color*`] = color(dv.color, CLEAR);
        }
      }
    }

    // secondary image
    const sec = d.secondaryImage;
    if (sec) {
      const m = box(sec.margin);
      Object.assign(set, { secondary_image_switch: true, secondary_image_display_mode: 'fixed', secondary_image_fixed_width: num(sec.width, 80), secondary_image_fixed_height: num(sec.height, 24),
        secondary_image_image_sizing: 'fit', secondary_image_fit_position: sec.fit || (sec.align === 'center' ? 'center' : 'bottom_left'),
        secondary_image_align: ['left', 'center', 'right'].includes(sec.align) ? sec.align : 'left', secondary_image_image_key: sec.key || 'thumb_1',
        secondary_image_margin_top: m[0], secondary_image_margin_right: m[1], secondary_image_margin_bottom: m[2], secondary_image_margin_left: m[3] });
      if (sec.position === 'over_image') Object.assign(set, { secondary_image_position: 'over_image', secondary_image_image_position: sec.corner || 'bottom_left' });
    }

    // runtime pill
    if (d.runtime && img) {
      const rp = box(d.runtime.padding, [1, 4, 1, 4]), rm = box(d.runtime.margin, [0, 10, 10, 0]);
      Object.assign(set, { runtime_switch: true, runtime_margin_right: rm[1], runtime_margin_bottom: rm[2], runtime_padding_top: rp[0], runtime_padding_right: rp[1], runtime_padding_bottom: rp[2], runtime_padding_left: rp[3] });
      text.runtime = F(d.runtime.font); if (d.runtime.font) notes.fonts.add(d.runtime.font.family);
      Object.assign(bind, { runtime_background_color: color(d.runtime.background, 'rgba(0,0,0,0.85)'), runtime_font_color: color(d.runtime.color, '#FFFFFF'), runtime_corner_radius: num(d.runtime.radius, 2) });
    }

    // progress bar
    if (d.progress) {
      const pm = box(d.progress.margin);
      Object.assign(set, { progress_bar_switch: true, progress_bar_hide_unwatched: false, progress_bar_position: PROGRESS_POS[d.progress.position] || 'on_top_of_image',
        progress_bar_height: num(d.progress.height, 4), progress_bar_margin_top: pm[0], progress_bar_margin_right: pm[1], progress_bar_margin_bottom: pm[2], progress_bar_margin_left: pm[3] });
      Object.assign(bind, { progress_bar_progress_bar_color: color(d.progress.color, '#FFFFFF'), progress_bar_total_bar_color: color(d.progress.track, 'rgba(255,255,255,0.25)'),
        progress_bar_progress_bar_corner_radius: num(d.progress.radius, 0), progress_bar_total_bar_corner_radius: num(d.progress.radius, 0) });
    }

    // cell badge: an icon on the image or in Cell 2's right-hand column (chevron, play button)
    const bd = d.badge;
    if (bd && bd.icon) {
      // a static image the studio draws: any width and height, an optional plate behind the icon (circle, square or rounded)
      const m = box(bd.margin), w = num(bd.width, num(bd.size, 24)), h = num(bd.height, num(bd.size, 24));
      const plate = bd.background ? color(bd.background, null) : bd.circle ? color(bd.circle, null) : null;
      const shape = bd.shape || (bd.circle ? 'circle' : num(bd.radius, 0) > 0 ? 'rounded' : 'square');
      const pos = bd.position === 'cell_right' && plugin !== 'cell_2' ? 'bottom_right' : (bd.position || (plugin === 'cell_2' ? 'cell_right' : 'center'));
      Object.assign(set, { cell_badge_switch: true, cell_badge_position: pos, cell_badge_width: w, cell_badge_height: h,
        cell_badge_margin_top: m[0], cell_badge_margin_right: m[1], cell_badge_margin_bottom: m[2], cell_badge_margin_left: m[3] });
      assets.push({ kind: 'badge', role: bd.icon, size: w, height: h, iconSize: num(bd.iconSize, plate ? Math.round(Math.min(w, h) * 0.5) : Math.min(w, h)), color: color(bd.color, '#FFFFFF'),
        plate, shape: plate ? shape : null, radius: shape === 'circle' ? null : shape === 'square' ? 0 : num(bd.radius, 4), file: `${slug(name)}-badge@3x.png`,
        field: plugin === 'cell_2' ? 'cell_badge (and selected_cell_badge)' : 'cell_badge_default (and cell_badge_selected)' });
    }
    // action icon (e.g. download in an episode row)
    const ac = d.action;
    if (ac && ac.action) {
      const id = ACTIONS[String(ac.action).toLowerCase().replace(/[^a-z]/g, '')] || 'offline-content-button';
      const m = box(ac.margin), sz = num(ac.size, 44);
      Object.assign(set, { action_switch: true, action_identifier: id, action_position: plugin === 'cell_2' ? 'cell_right' : (ac.position || 'top_right'),
        action_width: sz, action_height: sz, action_margin_top: m[0], action_margin_right: m[1], action_margin_bottom: m[2], action_margin_left: m[3] });
      assets.push({ kind: 'action', role: ac.icon || (PLUGIN[id] || {}).role || 'download', size: sz, iconSize: num(ac.iconSize, Math.round(sz * 0.55)), color: color(ac.color, '#FFFFFF'),
        file: `${slug(name)}-action@3x.png`, field: `unselected_action_icon (and selected_action_icon) · ${(PLUGIN[id] || {}).name || 'action'} plugin` });
    }

    // buttons
    if (d.buttons && (d.buttons.items || []).length) {
      const b = buttonsSpec(d.buttons, notes);
      Object.assign(set, b.set); Object.assign(bind, b.bind); Object.assign(text, b.text);
      if ((d.buttons.items || []).length > 3) notes.warnings.push('More than 3 buttons described; only the first 3 are built.');
    }

    // labels: one stack in the cell's text zone, with the secondary image and buttons anchored around them
    const items = labels.map((l, i) => labelItem(l, i, notes));
    // the secondary image is a stack item either way; over the picture it pins itself there (otherwise the builder turns it off)
    if (sec && sec.position === 'over_image') items.push({ id: 'secondary', type: 'image', position: 'over_image' });
    else if (sec) {
      const at = Math.max(0, Math.min(items.length, (num(sec.beforeLabel, 1) || 1) - 1));
      items.splice(sec.beforeLabel ? at : items.length, 0, { id: 'secondary', type: 'image' });
    }
    if (d.buttons && (d.buttons.items || []).length) {
      const btnItem = { id: 'buttons', type: 'buttons', ...(d.buttons.position === 'over_image' ? { position: 'over_image' } : {}) };
      let pos = items.length;
      if (d.buttons.afterLabel) { let seen = 0; for (let i = 0; i < items.length; i++) if (items[i].type === 'label' && ++seen === num(d.buttons.afterLabel)) { pos = i + 1; break; } }
      items.splice(pos, 0, btnItem);
    }
    if (items.length) {
      const zone = plugin === 'cell_3' ? (['top', 'center', 'bottom'].includes(d.zone) ? d.zone : 'bottom') : '';
      spec.stack = { zone, slots: 3, items };
    }

    spec.base = `${base}.base.json`; spec.set = set; spec.text = text; spec.bind = bind;
    spec.sampleFeed = Object.fromEntries(labels.filter(l => l.dataKey && !['title', 'summary'].includes(l.dataKey) && l.sample).map(l => [l.dataKey, String(l.sample)]));
    spec.sampleTitle = (labels.find(l => (l.dataKey || '') === 'title') || {}).sample;
    spec.sampleSummary = (labels.find(l => (l.dataKey || '') === 'summary') || {}).sample;
    // plugin button assets: one per action plugin, in both flavours (flavour 1 for dark backgrounds, flavour 2 for light)
    const seenPlugins = new Set();
    for (const bi of notes.buttonIcons) {
      if (seenPlugins.has(bi.action)) continue; seenPlugins.add(bi.action);
      const pl = PLUGIN[bi.action];
      for (const fl of [1, 2]) assets.push({ kind: 'button', plugin: pl.name, asset: pl.asset, flavour: `flavour_${fl}`, role: bi.role, size: 24, iconSize: 24,
        file: `${slug(pl.name)}-button-flavor-${fl}@3x.png`, field: `${pl.name} plugin › Mobile button asset - flavor ${fl}`, shared: true });
    }
    return { base, spec, warnings: notes.warnings, fonts: [...notes.fonts], assets, labels: notes.buttonLabels };
  }

  const api = { toSpec, psName, setFontResolver, famPrefix, color, box, slug, pascal, PLUGIN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Convert = api;
})(typeof window !== 'undefined' ? window : globalThis);
