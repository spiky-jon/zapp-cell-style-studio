// Brand colour scales in OKLCH.
//
// NEUTRAL: from one hex, the darkest step (900).
//
// Lightness, in OKLCH: each step sits a fixed fraction of the way from the input's lightness
// up to the lightest neutral (L 97.91%, #F8F8F8). The fractions come from the BASE ramp,
// so #121212 reproduces it exactly.
// Hue: kept from the input.
// Chroma: starts at the input's chroma and tapers toward the light end (to 30% at 100),
// so a tinted neutral stays tinted on surfaces without turning text colours pastel.

export const STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
export const FRACTIONS = { 100: 1, 200: 0.8007, 300: 0.5912, 400: 0.2613, 500: 0.1891, 600: 0.1239, 700: 0.077, 800: 0.0392, 900: 0 };
export const LIGHTEST_L = 0.97913;
export const CHROMA_AT_LIGHTEST = 0.3;

const toLin = c => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toSrgb = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToOklch(hex) {
  const h = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`"${hex}" isn't a 6-digit hex colour.`);
  const [r, g, b] = [0, 2, 4].map(i => toLin(parseInt(h.slice(i, i + 2), 16)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

export function oklchToLinear({ l, c, h }) {
  const A = c * Math.cos((h * Math.PI) / 180), B = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const M = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const S = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}
export const inGamut = rgb => rgb.every(v => v >= -1e-4 && v <= 1 + 1e-4);

// Lowers chroma (keeping lightness and hue) until the colour fits in sRGB.
export function oklchToHex(col) {
  let c = col.c;
  if (!inGamut(oklchToLinear({ ...col, c }))) {
    let lo = 0, hi = c;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; inGamut(oklchToLinear({ ...col, c: mid })) ? (lo = mid) : (hi = mid); }
    c = lo;
  }
  return '#' + oklchToLinear({ ...col, c }).map(v => Math.round(toSrgb(Math.min(1, Math.max(0, v)))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function neutralScale(darkestHex) {
  const base = hexToOklch(darkestHex);
  const warnings = [];
  if (base.l > 0.3) warnings.push(`This colour is fairly light (L ${(base.l * 100).toFixed(1)}%). BASE starts at 18%, so the dark surface steps will come out lighter than usual.`);
  const scale = {};
  for (const step of STEPS) {
    const t = FRACTIONS[step];
    const l = base.l + t * (LIGHTEST_L - base.l);
    const c = base.c * (1 - (1 - CHROMA_AT_LIGHTEST) * t);
    scale[step] = { hex: step === 900 ? darkestHex.toUpperCase().replace(/^([^#])/, '#$1') : oklchToHex({ l, c, h: base.h }), l, c, h: base.h };
  }
  return { scale, warnings };
}

/* ---------------- accent / colour ramps ---------------- */
// From one hex, the 500 step. Above 500 each step closes a fixed share of the gap to white;
// below 500 each step is a fixed fraction of the 500 lightness. Chroma follows a curve relative to
// the 500 chroma, never beyond the sRGB edge (times `edge`). Hue can drift per step.
//
// "accent" is fitted to your BASE accent ramp (#804BFB reproduces it exactly): lighter darks,
// richer tints, and the hue drifting up to ~11° at the light end.
// "system" is fitted to the eight system ramps (orange to pink), within an invisible ΔE of 0.5:
// constant hue, deeper darks, and dark-side chroma held just inside the gamut edge.
export const RAMP_STYLES = {
  accent: {
    label: 'Accent curve (your purple)',
    up: { 100: 0.9135, 200: 0.7797, 300: 0.5698, 400: 0.3072 },
    down: { 600: 0.8674, 700: 0.7407, 800: 0.613, 900: 0.4827 },
    chroma: { 100: 0.0842, 200: 0.2162, 300: 0.4288, 400: 0.7027, 600: 0.9153, 700: 0.8099, 800: 0.6919, 900: 0.555 },
    hue: { 100: 10.76, 200: 9.37, 300: 7.3, 400: 4.27, 600: -0.42, 700: -1.18, 800: -2.66, 900: -4.43 },
    edge: 1,
  },
  system: {
    label: 'System curve (orange to pink)',
    up: { 100: 0.8644, 200: 0.6777, 300: 0.4694, 400: 0.2353 },
    down: { 600: 0.8407, 700: 0.6805, 800: 0.5202, 900: 0.3607 },
    chroma: { 100: 0.1195, 200: 0.2801, 300: 0.517, 400: 0.775, 600: 0.95, 700: 0.88, 800: 0.78, 900: 0.65 },
    hue: {},
    edge: 0.97,
  },
};

export function maxChroma(l, h) {
  let lo = 0, hi = 0.5;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; inGamut(oklchToLinear({ l, c: mid, h })) ? (lo = mid) : (hi = mid); }
  return lo;
}

export function colorScale(hex500, style = 'accent') {
  const st = RAMP_STYLES[style] || RAMP_STYLES.accent;
  const base = hexToOklch(hex500);
  const warnings = [];
  if (base.c < 0.03) warnings.push('This colour is close to grey, so the scale will be nearly neutral.');
  if (base.l < 0.45 || base.l > 0.8) warnings.push(`At L ${(base.l * 100).toFixed(1)}% this sits ${base.l < 0.45 ? 'darker' : 'lighter'} than a typical 500 (your ramps sit between 57% and 75%), so the ${base.l < 0.45 ? 'dark' : 'light'} steps will bunch up.`);
  const scale = {};
  for (const step of STEPS) {
    if (step === 500) { scale[500] = { hex: hex500.toUpperCase().replace(/^([^#])/, '#$1'), ...base }; continue; }
    const l = step < 500 ? base.l + st.up[step] * (1 - base.l) : base.l * st.down[step];
    const h = (base.h + (st.hue[step] || 0) + 360) % 360;
    const c = Math.min(base.c * st.chroma[step], st.edge * maxChroma(l, h));
    scale[step] = { hex: oklchToHex({ l, c, h }), l, c, h };
  }
  return { scale, warnings };
}
