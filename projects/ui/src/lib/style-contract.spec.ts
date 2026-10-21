import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { uiLuminance, uiResolveFeatureColors, type UiRgba } from '../../card/src/feature-colors';

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
    // Also Google's brand colours on the drawn sign-in button, fixed by
    // https://developers.google.com/identity/branding-guidelines whatever the theme.
    const allowed = [/^media\/src\/device-frame\.ts$/, /^fx\//, /^file-viewer\/src\/media-lightbox\.ts$/, /^google-sign-in\/src\/google-button\.ts$/];
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
    for (const m of text.matchAll(/\[data-theme="([\w-]+)"\]\s*\{([^}]*)\}/g)) {
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
      ['darkOrange', 'darkPink', 'darkPurple', 'darkTeal', 'goldBlack', 'goldRed', 'lightOrange', 'lightPink', 'lightPurple', 'lightPurpleGold', 'lightTeal', 'maldives', 'maldives-dark'].sort(),
    );
  });

  it('gives maldives-dark exactly the token set of maldives, as a dark theme', () => {
    const text = withoutComments(readFileSync(join(root, 'styles/theme-maldives.css'), 'utf8'));
    const keys = (name: string) => {
      const m = text.match(new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([^}]*)\\}`));
      return m ? [...m[1].matchAll(/(--ui-[\w-]+):/g)].map((d) => d[1]).sort() : [];
    };
    expect(keys('maldives').length).toBeGreaterThan(40);
    expect(keys('maldives-dark')).toEqual(keys('maldives'));
    const dark = list.find((t) => t.name === 'maldives-dark')!;
    const [bg, ink] = [parseColor(dark.vars['--ui-color-bg'])!, parseColor(dark.vars['--ui-color-ocean-deep'])!];
    // Night canvas, and Ocean Deep (the ink in maldives) turned into a light ink on it.
    expect(contrast(bg, [0, 0, 0, 1])).toBeLessThan(1.5);
    expect(contrast(ink, bg)).toBeGreaterThan(7);
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
      for (const m of text.matchAll(/\[data-theme="([\w-]+)"\]\s*\{([^}]*)\}/g)) {
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

  /*
   * ui-feature-card tints its surface with 3% of the tone (6% put lightOrange's primary at 4.33:1) and its badge with 14% of primary. Keep the
   * words on the tinted surface (eyebrow and action in primary, description in text-muted) at 4.5:1
   * and the badge icon (primary) at 3:1 on its tint, in every theme.
   */
  it('keeps ui-feature-card text and badge icons readable on their tints', () => {
    const fails: string[] = [];
    const mix = (a: Rgba, b: Rgba, k: number): Rgba => [0, 1, 2].map((i) => a[i] * k + b[i] * (1 - k)).concat(1) as Rgba;
    for (const { name, vars } of list) {
      const c = (k: string) => parseColor(vars[`--ui-color-${k}`] ?? '');
      const [surface, primary, muted, accent] = [c('surface'), c('primary'), c('text-muted'), c('accent') ?? c('secondary')];
      if (!surface || !primary || !muted) {
        fails.push(`${name}: colours unreadable`);
        continue;
      }
      const solid = over(primary, surface);
      for (const [tone, t] of [['primary', solid], ['accent', accent ? over(accent, surface) : solid]] as const) {
        const wash = mix(t, surface, 0.03);
        if (contrast(primary, wash) < 4.5 && tone === 'primary') fails.push(`${name}: primary on the ${tone} wash is ${contrast(primary, wash).toFixed(2)}:1`);
        if (contrast(muted, wash) < 4.5) fails.push(`${name}: text-muted on the ${tone} wash is ${contrast(muted, wash).toFixed(2)}:1`);
      }
      const tint = mix(solid, surface, 0.14);
      if (contrast(primary, tint) < 3) fails.push(`${name}: badge icon on its tint is ${contrast(primary, tint).toFixed(2)}:1`);
    }
    expect(fails).toEqual([]);
  });

  /*
   * surface="tinted" (0.38): the card is an 8% wash of its tone over the surface with 4% of the text (5% of the
   * text alone for neutral), with no border.
   * On it the title is text, the description is text-muted deepened 25% towards text, primary-coloured words
   * (eyebrow, action) are primary deepened 25% towards text, and the primary/brand badge is an 18% tint of
   * primary under a primary icon. Checked in every theme, Winter Dark and Winter Light included, with CSS
   * color-mix semantics (premultiplied alpha, as text-muted is translucent in some themes).
   */
  it('keeps the tinted ui-feature-card readable in every theme', () => {
    const blocks: Record<string, Record<string, string>> = {};
    for (const file of ['styles/tokens.css', 'styles/theme-palettes.css', 'styles/theme-dark-orange.css', 'styles/theme-maldives.css']) {
      const text = withoutComments(readFileSync(join(root, file), 'utf8')).replace(/@import url\([^)]*\)[^;]*;/g, '');
      for (const m of text.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const decls = Object.fromEntries([...m[2].matchAll(/(--ui-[\w-]+):\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()]));
        for (const sel of m[1].split(',').map((x) => x.trim())) blocks[sel] = { ...blocks[sel], ...decls };
      }
    }
    const base = { ...blocks[':root'], ...blocks['[data-theme]'] };
    const names = ['winterDark', 'winterLight', ...list.map((t) => t.name)];
    // color-mix(in srgb, a k, b): premultiplied interpolation; the result is composited over `ground`.
    const cmix = (a: Rgba, b: Rgba, k: number): Rgba => {
      const alpha = a[3] * k + b[3] * (1 - k);
      return [0, 1, 2].map((i) => (a[i] * a[3] * k + b[i] * b[3] * (1 - k)) / alpha).concat(alpha) as Rgba;
    };
    const fails: string[] = [];
    expect(names.length).toBe(15);
    for (const name of names) {
      const vars = { ...base, ...blocks[`[data-theme="${name}"]`] };
      const get = (k: string, depth = 0): Rgba | null => {
        const v = vars[k] ?? '';
        const ref = v.match(/^var\((--ui-[\w-]+)\)$/);
        return ref && depth < 5 ? get(ref[1], depth + 1) : parseColor(v);
      };
      const [surface, text, muted, primary, accent] = ['surface', 'text', 'text-muted', 'primary', 'accent'].map((k) => get(`--ui-color-${k}`));
      if (!surface || !text || !muted || !primary || !accent) {
        fails.push(`${name}: colours unreadable`);
        continue;
      }
      const desc = cmix(muted, text, 0.75);
      const ink = cmix(primary, text, 0.75);
      for (const [tone, k, c] of [['primary', 0.08, primary], ['accent', 0.08, accent], ['neutral', 0.05, text]] as const) {
        const ground = tone === 'neutral' ? surface : over(cmix(text, surface, 0.04), surface);
        const wash = over(cmix(c, ground, k), ground);
        const check = (what: string, fg: Rgba, need: number) => {
          const r = contrast(fg, wash);
          if (r < need) fails.push(`${name}/${tone}: ${what} on the tinted wash is ${r.toFixed(2)}:1, needs ${need}:1`);
        };
        check('title (text)', text, 4.5);
        check('description', desc, 4.5);
        if (tone === 'primary') check('eyebrow / action', ink, 4.5);
      }
      const badge = over(cmix(primary, surface, 0.18), surface);
      if (contrast(primary, badge) < 3) fails.push(`${name}: tinted badge icon is ${contrast(primary, badge).toFixed(2)}:1`);
    }
    expect(fails).toEqual([]);
  });

  /*
   * 0.39 badgeTone and colors, in every theme (Winter pair included), with the same block parsing as above:
   * - an accent card with a primary or brand badge (default and tinted surface): the icon (primary) 3:1 on
   *   its 14% / 18% primary tint, and the card's words still 4.5:1 on the accent wash;
   * - the Dhirumi colours (mint #E1F4EF and blue #E5F0FA surfaces, #4B8791 accent): on light themes the
   *   owner's colours as given, on dark themes the derived pair; title and description 4.5:1 on the
   *   surface, icon 3:1 on its badge, arrow 3:1 on the surface (4.5:1 on dark), action words 4.5:1.
   */
  it('keeps badgeTone combinations and custom feature-card colours readable in every theme', () => {
    const blocks: Record<string, Record<string, string>> = {};
    for (const file of ['styles/tokens.css', 'styles/theme-palettes.css', 'styles/theme-dark-orange.css', 'styles/theme-maldives.css']) {
      const text = withoutComments(readFileSync(join(root, file), 'utf8')).replace(/@import url\([^)]*\)[^;]*;/g, '');
      for (const m of text.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const decls = Object.fromEntries([...m[2].matchAll(/(--ui-[\w-]+):\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()]));
        for (const sel of m[1].split(',').map((x) => x.trim())) blocks[sel] = { ...blocks[sel], ...decls };
      }
    }
    const base = { ...blocks[':root'], ...blocks['[data-theme]'] };
    const names = ['winterDark', 'winterLight', ...list.map((t) => t.name)];
    const cmix = (a: Rgba, b: Rgba, k: number): Rgba => {
      const alpha = a[3] * k + b[3] * (1 - k);
      return [0, 1, 2].map((i) => (a[i] * a[3] * k + b[i] * b[3] * (1 - k)) / alpha).concat(alpha) as Rgba;
    };
    const fails: string[] = [];
    const white: Rgba = [255, 255, 255, 1];
    const rgb = (c: Rgba) => [c[0], c[1], c[2]] as const;
    const hex = (h: string) => parseColor(h) as Rgba;
    for (const name of names) {
      const vars = { ...base, ...blocks[`[data-theme="${name}"]`] };
      const get = (k: string, depth = 0): Rgba | null => {
        const v = vars[k] ?? '';
        const ref = v.match(/^var\((--ui-[\w-]+)\)$/);
        return ref && depth < 5 ? get(ref[1], depth + 1) : parseColor(v);
      };
      const [surfaceRaw, text, muted, primary, accent] = ['surface', 'text', 'text-muted', 'primary', 'accent'].map((k) => get(`--ui-color-${k}`));
      if (!surfaceRaw || !text || !muted || !primary || !accent) {
        fails.push(`${name}: colours unreadable`);
        continue;
      }
      const surface = over(surfaceRaw, white);
      // badgeTone primary/brand on an accent card.
      for (const [surf, k] of [['default', 0.14], ['tinted', 0.18]] as const) {
        const badge = over(cmix(primary, surface, k), surface);
        const r = contrast(primary, badge);
        if (r < 3) fails.push(`${name}: primary badge on an accent ${surf} card, icon ${r.toFixed(2)}:1`);
      }
      const ground = over(cmix(text, surface, 0.04), surface);
      const accentWash = over(cmix(accent, ground, 0.08), ground);
      if (contrast(text, accentWash) < 4.5) fails.push(`${name}: title on the accent wash`);
      if (contrast(cmix(muted, text, 0.75), accentWash) < 4.5) fails.push(`${name}: description on the accent wash`);
      // Custom colours.
      const dark = uiLuminance(rgb(surface)) < 0.2;
      const theme = { surface: rgb(surface), text: text as unknown as UiRgba, muted: muted as unknown as UiRgba, dark };
      for (const [label, c] of [['mint', { surface: '#E1F4EF', accent: '#4B8791' }], ['blue', { surface: '#E5F0FA', accent: '#4B8791' }]] as const) {
        const r = uiResolveFeatureColors(c, theme);
        if (!r) {
          fails.push(`${name}/${label}: not resolved`);
          continue;
        }
        if (!dark && (r.surface !== c.surface.toLowerCase() || r.accent !== '#4b8791')) fails.push(`${name}/${label}: a light theme changed the owner's colours (${r.surface}, ${r.accent})`);
        const S = hex(r.surface);
        const need = (what: string, fg: Rgba, bg: Rgba, n: number) => {
          const x = contrast(fg, bg);
          if (x < n) fails.push(`${name}/${label}: ${what} ${x.toFixed(2)}:1, needs ${n}:1`);
        };
        need('title', text, S, 4.5);
        need('description', hex(r.desc), S, 4.5);
        need('icon on its badge', hex(r.accent), hex(r.badge), 3);
        need('arrow', hex(r.accent), S, dark ? 4.5 : 3);
        need('action words', hex(r.ink), S, 4.5);
      }
    }
    expect(names.length).toBe(15);
    expect(fails).toEqual([]);
  });
});

/* ── See-through glass over a map (ui-bottom-sheet / ui-floating-panel `glass`, 0.41.2) ─────────── */

describe('see-through glass', () => {
  const files = ['styles/tokens.css', 'styles/theme-palettes.css', 'styles/theme-dark-orange.css', 'styles/theme-maldives.css'];
  const blocks: Record<string, Record<string, string>> = {};
  /** Per selector, the properties set in a block that names only that selector. */
  const own: Record<string, Set<string>> = {};
  for (const file of files) {
    const text = withoutComments(readFileSync(join(root, file), 'utf8')).replace(/@import url\([^)]*\)[^;]*;/g, '');
    for (const m of text.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const decls = Object.fromEntries([...m[2].matchAll(/(--ui-[\w-]+):\s*([^;]+);/g)].map((d) => [d[1], d[2].replace(/\s+/g, ' ').trim()]));
      const sels = m[1].split(',').map((x) => x.trim());
      for (const sel of sels) blocks[sel] = { ...blocks[sel], ...decls };
      for (const sel of sels) for (const k of Object.keys(decls)) (own[sel] ??= new Set()).add(k);
    }
  }
  const base = { ...blocks[':root'], ...blocks['[data-theme]'] };
  const names = ['dark', 'light', 'lightOrange', 'lightPink', 'lightTeal', 'lightPurple', 'lightPurpleGold',
    'darkPink', 'darkTeal', 'darkPurple', 'goldBlack', 'goldRed', 'darkOrange', 'maldives', 'maldives-dark'];
  const resolve = (name: string) => {
    const vars = { ...base, ...blocks[`[data-theme="${name}"]`] };
    const raw = (k: string, depth = 0): string => {
      const v = vars[k] ?? '';
      const ref = v.match(/^var\((--ui-[\w-]+)\)$/);
      return ref && depth < 5 ? raw(ref[1], depth + 1) : v;
    };
    return { raw, color: (k: string) => parseColor(raw(k)), num: (k: string) => Number(raw(k)) };
  };

  it('derives the tint and the backdrop filter from the theme, with the maths this spec models', () => {
    // The model below is only as good as these two definitions: change them together.
    expect(base['--ui-glass-sheet-bg']).toBe('color-mix(in srgb, var(--ui-color-surface) calc(var(--ui-glass-sheet-tint) * 100%), transparent)');
    expect(base['--ui-glass-sheet-filter']).toBe(
      'blur(var(--ui-glass-sheet-blur)) contrast(calc((var(--ui-glass-sheet-ceiling) - var(--ui-glass-sheet-floor)) / (var(--ui-glass-sheet-ceiling) + var(--ui-glass-sheet-floor)))) brightness(calc(var(--ui-glass-sheet-ceiling) + var(--ui-glass-sheet-floor)))',
    );
    // contrast(c) then brightness(b): v -> ((v - 0.5) * c + 0.5) * b. Black lands on the floor, white on the ceiling.
    for (const [floor, ceiling] of [[0, 0.43], [0.7, 1], [0.87, 1]]) {
      const c = (ceiling - floor) / (ceiling + floor);
      const b = ceiling + floor;
      expect(((0 - 0.5) * c + 0.5) * b).toBeCloseTo(floor, 9);
      expect(((1 - 0.5) * c + 0.5) * b).toBeCloseTo(ceiling, 9);
    }
  });

  it('sets the backdrop range in every theme’s own block, so a theme island never inherits the page’s', () => {
    const missing: string[] = [];
    for (const name of names) {
      const keys = new Set([...(own[`[data-theme="${name}"]`] ?? [])]);
      for (const k of ['--ui-glass-sheet-floor', '--ui-glass-sheet-ceiling']) if (!keys.has(k)) missing.push(`${name}: ${k}`);
    }
    expect(missing).toEqual([]);
  });

  it('is see-through: a translucent tint over a backdrop that still shows through', () => {
    const fails: string[] = [];
    for (const name of names) {
      const t = resolve(name);
      const [tint, floor, ceiling, blur] = [t.num('--ui-glass-sheet-tint'), t.num('--ui-glass-sheet-floor'), t.num('--ui-glass-sheet-ceiling'), t.raw('--ui-glass-sheet-blur')];
      if (!(tint > 0 && tint < 1)) fails.push(`${name}: tint ${tint} is not translucent`);
      if (!(ceiling > floor && floor >= 0 && ceiling <= 1)) fails.push(`${name}: backdrop range ${floor}-${ceiling} shows nothing`);
      if (!/^\d+px$/.test(blur) || parseFloat(blur) < 8) fails.push(`${name}: blur ${blur}`);
    }
    expect(fails).toEqual([]);
  });

  it('keeps text, muted text, primary and status colours AA over pure white and pure black in every theme', () => {
    const fails: string[] = [];
    for (const name of names) {
      const t = resolve(name);
      const surface = t.color('--ui-color-surface');
      const [tint, floor, ceiling] = [t.num('--ui-glass-sheet-tint'), t.num('--ui-glass-sheet-floor'), t.num('--ui-glass-sheet-ceiling')];
      if (!surface || surface[3] !== 1) {
        fails.push(`${name}: surface unreadable or translucent`);
        continue;
      }
      const glass: Rgba = [surface[0], surface[1], surface[2], tint];
      // A filtered channel always lies in [floor, ceiling], and luminance rises with every channel, so
      // the darkest and lightest possible panels are the ones over pure black and pure white.
      for (const [where, v] of [['black', floor], ['white', ceiling]] as const) {
        const g = v * 255;
        const panel = over(glass, [g, g, g, 1]);
        for (const [fg, need] of [['text', 4.5], ['text-muted', 4.5], ['primary', 4.5], ['success', 4.5], ['danger', 4.5], ['warning', 3], ['icon', 3]] as const) {
          const c = t.color(`--ui-color-${fg}`);
          if (!c) {
            if (fg !== 'icon' && fg !== 'warning') fails.push(`${name}: --ui-color-${fg} unreadable`);
            continue;
          }
          const r = contrast(c, panel);
          if (r < need) fails.push(`${name}: ${fg} on glass over ${where} is ${r.toFixed(2)}:1, needs ${need}:1`);
        }
      }
    }
    expect(fails).toEqual([]);
  });

  it('keeps fields solid inside: inputs, selects and textareas paint the opaque surface', () => {
    for (const f of ['form/src/input.ts', 'form/src/select.ts', 'form/src/textarea.ts']) {
      expect(componentCss(readFileSync(join(root, f), 'utf8'))).toMatch(/background:\s*var\(--ui-color-surface\)/);
    }
    for (const name of names) expect(resolve(name).color('--ui-color-surface')?.[3]).toBe(1);
  });

  for (const [file, sel, solid] of [
    ['dialog/src/bottom-sheet.ts', ':host(.glass) .sheet', 'var(--ui-color-surface)'],
    ['layout/src/floating-panel.ts', ':host(.glass)', 'var(--ui-color-surface-raised)'],
  ] as const) {
    it(`${file}: glass blurs and tints, and falls back to solid without backdrop-filter or under reduced transparency`, () => {
      const text = withoutComments(componentCss(readFileSync(join(root, file), 'utf8')));
      const rule = (scope: string) => {
        const at = text.indexOf(scope);
        expect(at, scope).toBeGreaterThanOrEqual(0);
        const inner = text.slice(at);
        const m = inner.match(new RegExp(sel.replace(/[().]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
        expect(m, `${scope} ${sel}`).toBeTruthy();
        return m![1];
      };
      const glass = rule(sel + ' {');
      expect(glass).toMatch(/background:\s*var\(--ui-glass-sheet-bg\)/);
      expect(glass).toMatch(/(^|[\s;])backdrop-filter:\s*var\(--ui-glass-sheet-filter\)/);
      expect(glass).toMatch(/-webkit-backdrop-filter:\s*var\(--ui-glass-sheet-filter\)/);
      const unsupported = rule('@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))');
      expect(unsupported).toContain(`background: ${solid}`);
      const reduced = rule('@media (prefers-reduced-transparency: reduce), (prefers-contrast: more)');
      expect(reduced).toContain(`background: ${solid}`);
      expect(reduced).toMatch(/(^|[\s;])backdrop-filter:\s*none/);
    });
  }
});
