import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/*
 * Static checks over every component's styles and the theme files. They catch the mistakes that
 * look fine in one theme on one screen and wrong elsewhere: a token that doesn't exist (the value
 * silently falls back to nothing), text too small to read, colours that only suit one theme, and
 * theme palettes whose text fails WCAG contrast. Layout, rendered contrast and alignment are checked
 * in a real browser by projects/showcase/audit/ui-audit.mjs (npm run audit:ui).
 */

const root = join(process.cwd(), 'projects/ui');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(root);
const sources = files
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts') && f.includes('/src/'))
  .map((f) => ({ file: relative(root, f), text: readFileSync(f, 'utf8') }));
const stylesheets = files.filter((f) => f.endsWith('.css')).map((f) => ({ file: relative(root, f), text: readFileSync(f, 'utf8') }));
const everything = [...sources, ...stylesheets];

/**
 * The CSS of a file: every template string in a component's `styles` (a string or an array, which
 * may hold `[attr]` selectors, so it is scanned string by string rather than up to the first `]`),
 * plus shared style constants (`export const X_STYLES = \`…\``) that components include.
 */
function componentCss(text: string): string {
  const out: string[] = [];
  for (const m of text.matchAll(/styles:\s*([[`])/g)) {
    let i = m.index! + m[0].length - 1;
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      out.push(text.slice(i + 1, end));
      continue;
    }
    // An array: collect its template strings until the bracket that closes it.
    for (i++; i < text.length && text[i] !== ']'; i++) {
      if (text[i] !== '`') continue;
      const end = text.indexOf('`', i + 1);
      out.push(text.slice(i + 1, end));
      i = end;
    }
  }
  for (const m of text.matchAll(/const\s+\w*STYLES\w*\s*=\s*`([\s\S]*?)`/g)) out.push(m[1]);
  return out.join('\n');
}
const css = sources.map((s) => ({ file: s.file, text: componentCss(s.text) })).filter((s) => s.text);
const withoutComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '');

describe('style contract', () => {
  it('only uses --ui-* tokens that something defines', () => {
    const defined = new Set<string>();
    for (const { text } of everything) {
      for (const m of text.matchAll(/(--ui-[\w-]+)\s*:/g)) defined.add(m[1]);
      for (const m of text.matchAll(/setProperty\(\s*'(--ui-[\w-]+)'/g)) defined.add(m[1]);
      for (const m of text.matchAll(/\[style\.(--ui-[\w-]+)\]/g)) defined.add(m[1]);
      for (const m of text.matchAll(/'(--ui-[\w-]+)':/g)) defined.add(m[1]);
    }
    const missing: string[] = [];
    for (const { file, text } of everything) {
      for (const m of withoutComments(text).matchAll(/var\(\s*(--ui-[\w-]+)\s*([,)])/g)) {
        if (m[2] === ',' || m[1].endsWith('-')) continue; // has a fallback, or built dynamically
        if (!defined.has(m[1])) missing.push(`${file}: ${m[1]}`);
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  it('imports icons one file at a time', () => {
    // The package root re-exports ~4,000 icons; one root import made the production build need
    // about 9 GB and the server killed it. Applies to the showcase too, since it ships the same way.
    const showcase = walk(join(process.cwd(), 'projects/showcase/src')).filter((f) => f.endsWith('.ts'));
    const all = [...sources.map((s) => join(root, s.file)), ...showcase];
    const bad = all.filter((f) => /from\s+['"]@hugeicons\/core-free-icons['"]/.test(readFileSync(f, 'utf8'))).map((f) => relative(process.cwd(), f));
    expect(bad).toEqual([]);
  });

  it('never lets a textarea be resized by hand', () => {
    // A drag handle on a text box is a box that was the wrong size; ui-textarea has autosize instead.
    const bad = everything.filter(({ text }) => /resize\s*:\s*(vertical|both|horizontal|block|inline)\b/.test(withoutComments(text))).map((s) => s.file);
    expect(bad).toEqual([]);
  });

  it('never transitions `all`', () => {
    const bad = everything.filter(({ text }) => /transition(-property)?\s*:\s*all\b/.test(withoutComments(text))).map((s) => s.file);
    expect(bad).toEqual([]);
  });

  it('keeps text at 11px or larger', () => {
    const bad: string[] = [];
    for (const { file, text } of css) {
      for (const m of withoutComments(text).matchAll(/font-size:\s*([\d.]+)px/g)) if (+m[1] < 11) bad.push(`${file}: ${m[1]}px`);
      for (const m of withoutComments(text).matchAll(/font:\s*[^;]*?\b([\d.]+)px/g)) if (+m[1] < 11) bad.push(`${file}: font ${m[1]}px`);
    }
    expect(bad).toEqual([]);
  });

  it('uses per-variant hover colours, not a brightness filter', () => {
    const bad = css.filter(({ text }) => /filter:\s*brightness\(/.test(withoutComments(text))).map((s) => s.file);
    expect(bad).toEqual([]);
  });

  it('takes colours from tokens, so every theme can restyle them', () => {
    // Allowed: media chrome that always sits on photos/video, a physical device mock, and fx
    // effects whose colours are documented, overridable inputs.
    const allowed = [/^media\/src\/device-frame\.ts$/, /^fx\//, /^file-viewer\/src\/media-lightbox\.ts$/];
    const bad: string[] = [];
    for (const { file, text } of css) {
      if (allowed.some((r) => r.test(file))) continue;
      for (const m of withoutComments(text).matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d/g)) bad.push(`${file}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });
});

/* ── Theme palettes ───────────────────────────────────────────────────────────────────────────── */

type Rgba = [number, number, number, number];
function parseColor(v: string): Rgba | null {
  v = v.trim();
  const rgba = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/);
  if (rgba) return [+rgba[1], +rgba[2], +rgba[3], rgba[4] === undefined ? 1 : +rgba[4]];
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4, 6), 16), 1];
  return null;
}
const over = (a: Rgba, b: Rgba): Rgba => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).concat(1) as Rgba;
const lum = (c: Rgba) => {
  const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
export function contrast(fg: Rgba, bg: Rgba): number {
  const [x, y] = [lum(over(fg, bg)), lum(bg)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Theme blocks that set their own palette (the Winter pair is covered by styles/contrast-check.mjs). */
function themes(): { name: string; vars: Record<string, string> }[] {
  const out: { name: string; vars: Record<string, string> }[] = [];
  for (const file of ['styles/theme-palettes.css', 'styles/theme-dark-orange.css', 'styles/theme-maldives.css']) {
    const text = withoutComments(readFileSync(join(root, file), 'utf8'));
    for (const m of text.matchAll(/\[data-theme="(\w+)"\]\s*\{([^}]*)\}/g)) {
      const vars = Object.fromEntries([...m[2].matchAll(/(--ui-color-[\w-]+):\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()]));
      if (vars['--ui-color-bg']) out.push({ name: m[1], vars });
    }
  }
  return out;
}

describe('theme palettes', () => {
  const list = themes();

  it('finds every named skin', () => {
    expect(list.map((t) => t.name).sort()).toEqual(
      ['darkOrange', 'darkPink', 'darkPurple', 'darkTeal', 'goldBlack', 'goldRed', 'lightOrange', 'lightPink', 'lightPurple', 'lightPurpleGold', 'lightTeal', 'maldives'].sort(),
    );
  });

  it('meets WCAG AA for text and status colours on every background', () => {
    const fails: string[] = [];
    for (const { name, vars } of list) {
      const c = (k: string) => parseColor(vars[`--ui-color-${k}`] ?? '');
      const grounds = (['bg', 'surface', 'surface-raised'] as const).map((k) => [k, c(k)!] as const);
      const check = (fg: string, need: number) => {
        const color = c(fg);
        if (!color) return fails.push(`${name}: --ui-color-${fg} is missing or unreadable`);
        for (const [g, bg] of grounds) {
          const r = contrast(color, bg);
          if (r < need) fails.push(`${name}: ${fg} on ${g} is ${r.toFixed(2)}:1, needs ${need}:1`);
        }
        return 0;
      };
      check('text', 7);
      check('text-muted', 4.5);
      check('primary', 4.5); // links and primary-coloured text
      check('success', 4.5);
      check('danger', 4.5);
      check('warning', 3); // warning text is paired with an icon; badges use warning-contrast
      const pair = (fg: string, bg: string, fallback?: string) => {
        const f = parseColor(vars[`--ui-color-${fg}`] ?? fallback ?? '');
        const b = c(bg);
        if (f && b && contrast(f, b) < 4.5) fails.push(`${name}: ${fg} on ${bg} is ${contrast(f, b).toFixed(2)}:1`);
      };
      pair('primary-contrast', 'primary');
      pair('secondary-contrast', 'secondary', vars['--ui-color-primary-contrast']); // secondary buttons
      pair('warning-contrast', 'warning', '#1a1d23'); // tokens.css default
      if (vars['--ui-color-accent']) pair('accent-contrast', 'accent', vars['--ui-color-primary-contrast']); // accent buttons
    }
    expect(fails).toEqual([]);
  });

  /*
   * The skeleton once defaulted to surface → surface-raised, which vanished on a card wherever the two
   * are close (the dark palettes) or equal (maldives). Check the resolved colours in every theme.
   */
  it('keeps the skeleton visible on a card and its shimmer visible in every theme', () => {
    const fails: string[] = [];
    for (const file of ['styles/theme-palettes.css', 'styles/theme-dark-orange.css', 'styles/theme-maldives.css']) {
      const text = withoutComments(readFileSync(join(root, file), 'utf8'));
      for (const m of text.matchAll(/\[data-theme="(\w+)"\]\s*\{([^}]*)\}/g)) {
        const v = Object.fromEntries([...m[2].matchAll(/(--ui-[\w-]+):\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()]));
        if (!v['--ui-color-bg']) continue;
        const raised = parseColor(v['--ui-color-surface-raised']);
        // tokens.css default: the raised surface mixed with 10% (base) and 4% (highlight) of the text.
        const text = parseColor(v['--ui-color-text']);
        const mix = (k: number): Rgba | null => (raised && text ? (raised.map((c, i) => (i < 3 ? c * (1 - k) + over(text, raised)[i] * k : 1)) as Rgba) : null);
        const base = v['--ui-skeleton-base'] ? parseColor(v['--ui-skeleton-base']) : mix(0.1);
        const high = v['--ui-skeleton-highlight'] ? parseColor(v['--ui-skeleton-highlight']) : mix(0.04);
        if (!raised || !base || !high) {
          fails.push(`${m[1]}: skeleton colours unreadable`);
          continue;
        }
        if (contrast(base, raised) < 1.1) fails.push(`${m[1]}: skeleton on a card is ${contrast(base, raised).toFixed(2)}:1`);
        if (contrast(base, high) < 1.05) fails.push(`${m[1]}: skeleton shimmer is ${contrast(base, high).toFixed(2)}:1`);
      }
    }
    expect(fails).toEqual([]);
  });

  it('gives a theme icon colour 3:1 on the page and surfaces', () => {
    const fails: string[] = [];
    for (const { name, vars } of list) {
      const icon = parseColor(vars['--ui-color-icon'] ?? '');
      if (!vars['--ui-color-icon']) continue;
      if (!icon) {
        fails.push(`${name}: --ui-color-icon unreadable`);
        continue;
      }
      for (const g of ['bg', 'surface', 'surface-raised']) {
        const r = contrast(icon, parseColor(vars[`--ui-color-${g}`])!);
        if (r < 3) fails.push(`${name}: icon on ${g} is ${r.toFixed(2)}:1`);
      }
    }
    expect(fails).toEqual([]);
  });

  /*
   * Glass panels (drawers, menus, popovers, windows) show the page through them. A drawer's page is
   * also dimmed by the overlay, so thin glass on a light theme turns muddy grey and its text, though
   * technically there, is hard to read. Check text on glass over the page and over the dimmed page.
   */
  it('keeps text readable on glass in every light theme, over the page and over a dimmed page', () => {
    const blocks: Record<string, Record<string, string>> = {};
    for (const file of ['styles/tokens.css', 'styles/theme-palettes.css', 'styles/theme-maldives.css']) {
      const text = withoutComments(readFileSync(join(root, file), 'utf8'));
      for (const m of text.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const decls = Object.fromEntries([...m[2].matchAll(/(--ui-[\w-]+):\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()]));
        for (const sel of m[1].split(',').map((s) => s.trim())) blocks[sel] = { ...blocks[sel], ...decls };
      }
    }
    const base = { ...blocks[':root'], ...blocks['[data-theme]'] };
    const light = ['winterLight', 'lightOrange', 'lightPink', 'lightTeal', 'lightPurple', 'lightPurpleGold', 'maldives'];
    const fails: string[] = [];
    for (const name of light) {
      const vars = { ...base, ...blocks[`[data-theme="${name}"]`] };
      const get = (k: string, depth = 0): Rgba | null => {
        const v = vars[k] ?? '';
        const ref = v.match(/^var\((--ui-[\w-]+)\)$/);
        return ref && depth < 5 ? get(ref[1], depth + 1) : parseColor(v);
      };
      const [bg, glass, overlay] = [get('--ui-color-bg'), get('--ui-glass-bg'), get('--ui-color-overlay')];
      if (!bg || !glass || !overlay) {
        fails.push(`${name}: bg, glass or overlay colour is missing or unreadable`);
        continue;
      }
      for (const [where, ground] of [['page', bg], ['dimmed page', over(overlay, bg)]] as const) {
        const panel = over(glass, ground);
        for (const [fg, need] of [['--ui-color-text', 7], ['--ui-color-text-muted', 4.5]] as const) {
          const r = contrast(get(fg)!, panel);
          if (r < need) fails.push(`${name}: ${fg} on glass over the ${where} is ${r.toFixed(2)}:1, needs ${need}:1`);
        }
      }
    }
    expect(fails).toEqual([]);
  });
});
