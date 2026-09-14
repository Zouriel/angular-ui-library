#!/usr/bin/env node
/*
 * WCAG contrast check for the Winter colour system.
 *
 *   node projects/ui/styles/contrast-check.mjs            # table + exit 1 on any failure
 *   node projects/ui/styles/contrast-check.mjs --json     # machine-readable
 *   node projects/ui/styles/contrast-check.mjs --md       # markdown tables (for COLOR-SYSTEM.md)
 *
 * Reads the real values from tokens.css (primitives + the winterDark / winterLight blocks), resolves
 * var() chains, flattens translucent colours onto the surface they sit on, and checks each pair
 * against its WCAG 2.2 threshold: 4.5 body text, 3 large text / non-text UI (1.4.11).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/* ── Parse blocks ─────────────────────────────────────────────────────── */
function blocks(src) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(src))) {
    const selectors = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    const decls = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const k = d.slice(0, i).trim();
      if (k.startsWith('--')) decls[k] = d.slice(i + 1).trim();
    }
    out.push({ selectors, decls });
  }
  return out;
}
const all = blocks(css);
const pick = (pred) => Object.assign({}, ...all.filter((b) => b.selectors.some(pred)).map((b) => b.decls));

const primitives = pick((s) => s === ':root');
const themes = {
  light: { ...primitives, ...pick((s) => s === '[data-theme="winterLight"]') },
  dark: { ...primitives, ...pick((s) => s === '[data-theme="winterDark"]') },
};

/* ── Colour maths ─────────────────────────────────────────────────────── */
function parseColor(v) {
  v = v.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  }
  throw new Error(`Unparseable colour: ${v}`);
}
const hex = ({ r, g, b }) => '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});
const lum = ({ r, g, b }) => {
  const c = (x) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function resolve(theme, name, depth = 0) {
  if (depth > 20) throw new Error(`var() loop at ${name}`);
  const raw = theme[name];
  if (raw == null) throw new Error(`Token ${name} is not defined for this theme`);
  const m = raw.match(/^var\((--[\w-]+)\)$/);
  return m ? resolve(theme, m[1], depth + 1) : raw;
}
/** A token (or literal) as an opaque colour, flattened onto `base` when translucent. */
function color(theme, ref, base) {
  const raw = ref.startsWith('--') ? resolve(theme, ref) : ref;
  const c = parseColor(raw);
  return c.a < 1 ? over(c, base ?? color(theme, '--ui-color-bg')) : c;
}
/** First and last stop of a two-stop linear-gradient token. */
function gradientStops(theme, ref) {
  return [...resolve(theme, ref).matchAll(/#[0-9a-f]{3,8}/gi)].map((m) => parseColor(m[0]));
}

/* ── Pairs ────────────────────────────────────────────────────────────── */
const TEXT = 4.5;
const UI = 3;
const surfaces = ['--ui-color-bg', '--ui-color-surface', '--ui-color-surface-raised', '--ui-color-surface-subtle'];
const short = (t) => t.replace('--ui-color-', '').replace('--ui-', '');

function checks(theme) {
  const rows = [];
  const add = (group, fg, bg, min, label) => {
    const r = ratio(fg.c, bg.c);
    rows.push({ group, pair: label ?? `${fg.n} on ${bg.n}`, fg: hex(fg.c), bg: hex(bg.c), ratio: +r.toFixed(2), min, pass: r >= min });
  };
  const T = (n, base) => ({ n: short(n), c: color(theme, n, base && color(theme, base)) });

  for (const s of surfaces) {
    for (const t of ['--ui-color-text', '--ui-color-text-secondary', '--ui-color-text-muted']) add('Text', T(t), T(s), TEXT);
  }
  add('Text', T('--ui-color-text'), T('--ui-color-surface-hover'), TEXT);
  add('Text', T('--ui-color-text-muted'), T('--ui-color-surface-hover'), TEXT);
  add('Text', T('--ui-color-text-inverse'), T('--ui-color-text'), TEXT);
  // Selected rows / menu items: the translucent selection tint flattened on a raised surface.
  add('Text', T('--ui-color-text'), T('--ui-color-selected', '--ui-color-surface-raised'), TEXT, 'text on selected (raised)');
  add('Text', T('--ui-color-text-muted'), T('--ui-color-selected', '--ui-color-surface-raised'), TEXT, 'text-muted on selected (raised)');
  // Strongest tint components mix in themselves (selected + hover list item: primary at 26%).
  const raised = color(theme, '--ui-color-surface-raised');
  const p = color(theme, '--ui-color-primary');
  const tint26 = { n: 'primary 26% tint (raised)', c: over({ ...p, a: 0.26 }, raised) };
  add('Text', T('--ui-color-text'), tint26, TEXT);
  add('Text', T('--ui-color-text-secondary'), tint26, TEXT);

  for (const [fill, on] of [
    ['--ui-color-primary', '--ui-color-primary-contrast'],
    ['--ui-color-primary-hover', '--ui-color-primary-contrast'],
    ['--ui-color-primary-active', '--ui-color-primary-contrast'],
    ['--ui-color-secondary', '--ui-color-secondary-contrast'],
    ['--ui-color-secondary-hover', '--ui-color-secondary-contrast'],
    ['--ui-color-danger', '--ui-color-danger-contrast'],
    ['--ui-color-danger-hover', '--ui-color-danger-contrast'],
    ['--ui-color-success', '--ui-color-success-contrast'],
    ['--ui-color-warning', '--ui-color-warning-contrast'],
    ['--ui-color-info', '--ui-color-info-contrast'],
    ['--ui-color-accent', '--ui-color-accent-contrast'],
  ]) add('Button & badge labels', T(on), T(fill), TEXT);
  const [g0, g1] = gradientStops(theme, '--ui-gradient-brand');
  const brandText = color(theme, '--ui-color-primary-contrast');
  add('Button & badge labels', { n: 'primary-contrast', c: brandText }, { n: 'gradient-brand start', c: g0 }, TEXT);
  add('Button & badge labels', { n: 'primary-contrast', c: brandText }, { n: 'gradient-brand end', c: g1 }, TEXT);

  for (const s of ['--ui-color-bg', '--ui-color-surface', '--ui-color-surface-raised']) {
    add('Links & status text', T('--ui-color-primary'), T(s), TEXT);
    add('Links & status text', T('--ui-color-primary-hover'), T(s), TEXT);
    for (const st of ['--ui-color-danger', '--ui-color-success', '--ui-color-warning', '--ui-color-info', '--ui-color-accent-strong'])
      add('Links & status text', T(st), T(s), TEXT);
  }

  for (const s of ['--ui-color-bg', '--ui-color-surface', '--ui-color-surface-raised']) {
    add('Controls & focus (non-text)', T('--ui-control-border'), T(s), UI);
    add('Controls & focus (non-text)', T('--ui-color-border-focus'), T(s), UI);
    add('Controls & focus (non-text)', T('--ui-color-primary'), T(s), UI, `checked / selected indicator on ${short(s)}`);
    add('Controls & focus (non-text)', T('--ui-color-danger'), T(s), UI, `error border on ${short(s)}`);
    add('Controls & focus (non-text)', T('--ui-switch-track'), T(s), UI);
  }
  add('Controls & focus (non-text)', T('--ui-switch-thumb'), T('--ui-switch-track'), UI);
  add('Controls & focus (non-text)', T('--ui-switch-thumb-checked'), T('--ui-switch-track-checked'), UI);
  add('Controls & focus (non-text)', T('--ui-color-primary'), T('--ui-color-track'), UI, 'progress / slider fill on track');
  // The thumb is identifiable if either its fill or its 1px ring separates it from what is behind.
  for (const behind of ['--ui-color-primary', '--ui-color-track']) {
    const bg = T(behind);
    const [a, b] = [T('--ui-slider-thumb'), T('--ui-slider-thumb-border')];
    const best = ratio(a.c, bg.c) >= ratio(b.c, bg.c) ? a : b;
    add('Controls & focus (non-text)', best, bg, UI, `slider thumb (${best.n}) on ${behind === '--ui-color-track' ? 'track' : 'fill'}`);
  }

  // Informational only: disabled text is exempt from 1.4.3; decorative borders are exempt from 1.4.11.
  const info = [];
  const note = (fg, bg, label) => info.push({ pair: label ?? `${fg.n} on ${bg.n}`, fg: hex(fg.c), bg: hex(bg.c), ratio: +ratio(fg.c, bg.c).toFixed(2) });
  note(T('--ui-color-text-disabled'), T('--ui-color-bg'));
  note(T('--ui-color-text-disabled'), T('--ui-color-surface-raised'));
  note(T('--ui-color-border'), T('--ui-color-bg'));
  note(T('--ui-color-border-subtle'), T('--ui-color-surface-raised'));
  note(T('--ui-color-surface-raised'), T('--ui-color-bg'), 'surface-raised vs bg');
  note(T('--ui-skeleton-base'), T('--ui-color-surface-raised'), 'skeleton on raised card');
  return { rows, info };
}

const results = Object.fromEntries(Object.entries(themes).map(([k, t]) => [k, checks(t)]));
const failures = Object.entries(results).flatMap(([k, r]) => r.rows.filter((x) => !x.pass).map((x) => ({ theme: k, ...x })));

const arg = process.argv[2];
if (arg === '--json') {
  console.log(JSON.stringify(results, null, 2));
} else if (arg === '--md') {
  for (const [k, r] of Object.entries(results)) {
    console.log(`\n#### ${k === 'light' ? 'Light (winterLight)' : 'Dark (winterDark)'}\n`);
    let group = '';
    for (const x of r.rows) {
      if (x.group !== group) {
        group = x.group;
        console.log(`\n**${group}**\n\n| Pair | Foreground | Background | Ratio | Needs | Result |\n|---|---|---|---:|---:|---|`);
      }
      console.log(`| ${x.pair} | \`${x.fg}\` | \`${x.bg}\` | ${x.ratio.toFixed(2)} | ${x.min} | ${x.pass ? 'Pass' : 'FAIL'} |`);
    }
    console.log(`\n**Informational (exempt)**\n\n| Pair | Foreground | Background | Ratio |\n|---|---|---|---:|`);
    for (const x of r.info) console.log(`| ${x.pair} | \`${x.fg}\` | \`${x.bg}\` | ${x.ratio.toFixed(2)} |`);
  }
} else {
  for (const [k, r] of Object.entries(results)) {
    const min = Math.min(...r.rows.map((x) => x.ratio));
    console.log(`\n== ${k}: ${r.rows.filter((x) => x.pass).length}/${r.rows.length} pass (lowest ${min.toFixed(2)})`);
    for (const x of r.rows) console.log(`${x.pass ? '  ok ' : ' FAIL'} ${x.ratio.toFixed(2).padStart(6)} / ${x.min}  ${x.pair}  (${x.fg} on ${x.bg})`);
    console.log('  -- informational');
    for (const x of r.info) console.log(`       ${x.ratio.toFixed(2).padStart(6)}      ${x.pair}  (${x.fg} on ${x.bg})`);
  }
}
if (failures.length) {
  if (arg !== '--json') console.error(`\n${failures.length} failing pair(s).`);
  process.exit(1);
}
