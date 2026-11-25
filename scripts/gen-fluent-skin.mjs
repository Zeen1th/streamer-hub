// Generates the hard-coded-color overrides for each extra theme skin (today only Fluent:
// src/styles/fluent-skin.generated.css). Add an entry to SKINS for another one.
//
// Much of the UI uses hard-coded Tailwind classes like bg-[#1a2228] instead of theme tokens, so a token
// swap alone can't recolor it. This scans the source for those classes and emits overrides, scoped to
// :root[data-skin='<skin>'], that move them to the skin's palette.
// Re-run after adding new hard-coded colors:  npm run gen:skin
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

// Overlay/OBS pages have their own themes and never load index.css
const files = walk(path.join(root, 'src')).filter((f) => !/[\/](overlay|obs-chat|chat-overlay|image-overlay|clip-overlay|vote-overlay)/.test(f));

function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
}
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const hslWith = (a) => (hh, ss, ll) => `hsl(${hh.toFixed(0)} ${(ss * 100).toFixed(0)}% ${(ll * 100).toFixed(1)}%${a < 1 ? ` / ${a.toFixed(2)}` : ''})`;

const SKINS = [
  {
    id: 'fluent',
    out: 'src/styles/fluent-skin.generated.css',
    /** Returns an hsl() string for the skin's equivalent, or null to leave the color alone. */
    remap(hex, alpha, util) {
      const rgb = hexToRgb(hex);
      const { h, s, l } = rgbToHsl(rgb);
      const a = alpha ?? rgb.a;
      const hsl = hslWith(a);
      // cool blue-grey surfaces, borders and text -> neutral Windows grey with a hint of cool
      if ((s < 0.45 || l > 0.88) && h >= 170 && h <= 260 && s > 0.015) return hsl(235, clamp(s * 0.4, 0.04, 0.12), l);
      // indigo / violet accents -> the Windows dark-mode accent: a light tint of indigo
      if (s >= 0.45 && h >= 225 && h <= 285 && l >= 0.4 && l <= 0.75) {
        // A solid accent fill also gets dark text, as Windows draws it
        if (util === 'bg' && a >= 0.9) return { color: hsl(230, 0.93, 0.82), text: '#12142b' };
        return hsl(230, 0.93, 0.82);
      }
      return null;
    },
    // Solid dark surfaces become see-through light veils (Mica style), so the backdrop shows through the layers.
    veils: true,
    // WinUI corners: controls and cards 4px, larger panels 8px
    radius: (n) => (n <= 6 ? 4 : n <= 9 ? 8 : n),
  },
];

const PROPS = { bg: 'background-color', text: 'color', border: 'border-color', ring: '--tw-ring-color', outline: 'outline-color', fill: 'fill', stroke: 'stroke' };
const STATES = { hover: ':hover', focus: ':focus', active: ':active', 'focus-visible': ':focus-visible', disabled: ':disabled', 'group-hover': 'GROUP' };
const tokenRe = /(?<![\w-])((?:[a-z-]+:)*)(bg|text|border|ring|outline|fill|stroke)-\[(#[0-9a-fA-F]{3,8})\](?:\/(\d+|\[[\d.]+\]))?/g;
const radiusRe = /(?<![\w:-])rounded-\[(\d+)px\]/g;

const sources = files.map((file) => fs.readFileSync(file, 'utf8'));

for (const skin of SKINS) {
  const SCOPE = `:root[data-skin='${skin.id}']`;
  const rules = new Map();
  const radii = new Set();
  for (const src of sources) {
    for (const m of src.matchAll(tokenRe)) {
      const [token, prefixes, util, hex, alphaRaw] = m;
      const states = prefixes ? prefixes.split(':').filter(Boolean) : [];
      if (states.length > 1 || (states.length === 1 && !(states[0] in STATES))) continue;
      const alpha = alphaRaw ? Number(alphaRaw.replace(/[[\]]/g, '')) / (alphaRaw.startsWith('[') ? 1 : 100) : undefined;
      const mapped = skin.remap(hex, alpha, util);
      if (!mapped) continue;
      const color = typeof mapped === 'string' ? mapped : mapped.color;
      const textOn = typeof mapped === 'string' ? null : mapped.text;
      const sel = `[class~="${token}" i]`;
      let full;
      const state = states[0];
      if (!state) full = `${SCOPE} ${sel}`;
      else if (STATES[state] === 'GROUP') full = `${SCOPE} .group:hover ${sel}`;
      else full = `${SCOPE} ${sel}${STATES[state]}`;
      let decl = `${PROPS[util]}: ${color};${textOn ? ` color: ${textOn};` : ''}`;
      if (skin.veils) {
        // Cards and panels get a white veil; the darkest wells (inputs) get a dark one.
        const base = hexToRgb(hex);
        const lum = rgbToHsl(base).l;
        if (util === 'bg' && alpha === undefined && base.a === 1 && lum < 0.3 && (!state || state === 'hover' || state === 'group-hover')) {
          const boost = state ? 0.04 : 0;
          decl = lum < 0.09
            ? `background-color: rgba(0, 0, 10, ${(0.26 + boost).toFixed(3)});`
            : `background-color: rgba(255, 255, 255, ${(0.035 + ((lum - 0.09) / 0.21) * 0.05 + boost).toFixed(3)});`;
        }
      }
      rules.set(full, decl);
    }
    for (const m of src.matchAll(radiusRe)) {
      const n = Number(m[1]);
      if (n >= 3 && n <= 9) radii.add(n);
    }
  }

  let css = `/* Generated by scripts/gen-fluent-skin.mjs. Do not edit by hand; run \`npm run gen:skin\`. */\n`;
  for (const [sel, decl] of [...rules].sort((a, b) => a[0].localeCompare(b[0]))) css += `${sel} { ${decl} }\n`;
  css += `\n/* ${skin.id} corners */\n`;
  for (const n of [...radii].sort((a, b) => a - b)) {
    const r = skin.radius(n);
    if (r !== n) css += `${SCOPE} [class~="rounded-[${n}px]"] { border-radius: ${r}px; }\n`;
  }

  fs.mkdirSync(path.join(root, 'src/styles'), { recursive: true });
  fs.writeFileSync(path.join(root, skin.out), css);
  console.log(`${skin.id} skin: ${rules.size} color rules, ${radii.size} radius rules from ${files.length} files`);
}
