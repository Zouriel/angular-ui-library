import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { UI_COMPACT_BELOW, UI_CONFIG, applyUiDensity, defaultUiConfig, provideUiConfig } from './config';

/*
 * Density (0.45.0): compact makes things smaller, not tighter. These read tokens.css and the
 * component styles; a real browser checks the cascade, the 600px switch and the touch targets
 * (projects/showcase/audit/density.mjs, npm run audit:density).
 */

const root = join(process.cwd(), 'projects/ui');
const tokens = readFileSync(join(root, 'styles/tokens.css'), 'utf8');
const noComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '');

function decls(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of noComments(body).matchAll(/(--ui-[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
/** The first `:root {` block: the defaults. */
const base = decls(/^:root \{([\s\S]*?)^\}/m.exec(tokens)![1]);
const compact = decls(/^\[data-density="compact"\] \{([\s\S]*?)^\}/m.exec(tokens)?.[1] ?? '');
const auto = decls(/@media \(max-width: 599\.98px\) \{\s*\[data-density="auto"\] \{([\s\S]*?)\}/.exec(tokens)?.[1] ?? '');

/** px of a length token, with rem at 16px. */
const px = (v: string) => (v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const componentFiles = walk(root)
  .filter((f) => (f.endsWith('.ts') && !f.endsWith('.spec.ts') && f.includes('/src/')) || (f.endsWith('.css') && !f.includes('/styles/') && !f.endsWith('leaflet.css')))
  .map((f) => ({ file: relative(root, f), text: noComments(readFileSync(f, 'utf8')) }));

describe('density tokens', () => {
  it('keeps comfortable, the default, exactly as before', () => {
    expect([base['--ui-font-size-sm'], base['--ui-font-size-md'], base['--ui-font-size-lg']]).toEqual(['13px', '15px', '18px']);
    expect([base['--ui-size-sm'], base['--ui-size-md'], base['--ui-size-lg'], base['--ui-size-xl']]).toEqual(['26px', '30px', '38px', '56px']);
    // The heading sizes ui-text always had.
    expect(['h1', 'h2', 'h3', 'h5', 'h6'].map((h) => base[`--ui-font-size-${h}`])).toEqual(['2.5rem', '1.875rem', '1.375rem', '1rem', '0.9rem']);
    expect([base['--ui-font-scale'], base['--ui-density-scale']]).toEqual(['1', '1']);
  });

  it('compact: type one step smaller, headings about 10% smaller', () => {
    expect([compact['--ui-font-size-sm'], compact['--ui-font-size-md'], compact['--ui-font-size-lg']]).toEqual(['12px', '14px', '16px']);
    for (const h of ['h1', 'h2', 'h3', 'h5', 'h6']) {
      const ratio = px(compact[`--ui-font-size-${h}`]) / px(base[`--ui-font-size-${h}`]);
      expect(ratio, h).toBeGreaterThanOrEqual(0.88);
      expect(ratio, h).toBeLessThanOrEqual(0.94);
    }
    // Text a component sizes in px scales one step too (14px -> 13px).
    expect(+compact['--ui-font-scale']).toBeCloseTo(0.93, 5);
  });

  it('compact: controls 4px lower, icons and control marks 10% smaller', () => {
    for (const s of ['md', 'lg']) expect(px(compact[`--ui-size-${s}`]), s).toBe(px(base[`--ui-size-${s}`]) - 4);
    // sm stops at 24px, WCAG 2.5.8's minimum target, since with a mouse there is no 44px touch area.
    expect(compact['--ui-size-sm']).toBe('24px');
    expect(+compact['--ui-density-scale']).toBe(0.9);
    expect(20 * +compact['--ui-density-scale']).toBe(18); // the default 20px icon
  });

  it('compact changes sizes only: spacing, radii, touch targets and the xl action stay', () => {
    const bad = Object.keys(compact).filter((k) => /^--ui-(space-|radius|size-touch|size-xl)/.test(k));
    expect(bad).toEqual([]);
    expect(base['--ui-size-touch']).toBe('44px');
    // Only the size tokens and the two scales.
    expect(Object.keys(compact).every((k) => /^--ui-(font-size-|size-(sm|md|lg)$|font-scale$|density-scale$)/.test(k))).toBe(true);
  });

  it('auto is the compact block below 600px', () => {
    expect(UI_COMPACT_BELOW).toBe(600);
    expect(Object.keys(compact).length).toBeGreaterThan(10);
    expect(auto).toEqual(compact);
  });

  it('draws every icon through the density scale, and the switch, checkbox and radio marks too', () => {
    expect(/hugeicons-icon \{[^}]*zoom: var\(--ui-density-scale\);/.test(noComments(tokens))).toBe(true);
    for (const [file, sel] of [['form/src/switch.ts', '.track'], ['form/src/checkbox.ts', '.box'], ['form/src/radio-group.ts', '.dot']]) {
      const text = componentFiles.find((f) => f.file === file)!.text;
      const block = new RegExp(`\\n\\s*\\${sel} \\{([^}]*)\\}`).exec(text)?.[1] ?? '';
      expect(block, file).toContain('zoom: var(--ui-density-scale)');
    }
  });

  it('sizes component text through tokens: no px font size of 13px or more outside --ui-font-scale', () => {
    const bad: string[] = [];
    for (const { file, text } of componentFiles) {
      // Google's sign-in button is drawn to Google's branding rules (Roboto Medium 14px, 40px high) in every density.
      if (file.startsWith('google-sign-in/')) continue;
      for (const m of text.matchAll(/font-size:\s*([\d.]+)px/g)) if (+m[1] >= 13) bad.push(`${file}: ${m[1]}px`);
    }
    expect(bad).toEqual([]);
  });

  it('never scales text under 11px in compact', () => {
    const scale = +compact['--ui-font-scale'];
    const sizes = componentFiles.flatMap(({ text }) => [...text.matchAll(/calc\(([\d.]+)px \* var\(--ui-font-scale\)\)/g)].map((m) => +m[1]));
    expect(sizes.length).toBeGreaterThan(50);
    expect(Math.min(...sizes) * scale).toBeGreaterThanOrEqual(11);
    expect(px(compact['--ui-font-size-sm'])).toBeGreaterThanOrEqual(11);
  });

  it('keeps typed text at 16px on iOS in compact and auto, so Safari never zooms into a field', () => {
    const ios = /@supports \(-webkit-touch-callout: none\) \{([\s\S]*?)\n\}/.exec(tokens)?.[1] ?? '';
    expect(ios).toMatch(/\[data-density="compact"\] :is\(input:not\([^)]*\), textarea, select\) \{\s*font-size: 16px !important;/);
    expect(ios).toMatch(/@media \(max-width: 599\.98px\) \{\s*\[data-density="auto"\] :is\(input:not\([^)]*\), textarea, select\) \{\s*font-size: 16px !important;/);
    // Checkboxes, radios and sliders are not typed into.
    expect(ios).toContain('[type="checkbox"]');
  });
});

describe('density config', () => {
  afterEach(() => document.documentElement.removeAttribute('data-density'));

  it('defaults to comfortable and leaves <html> alone', () => {
    expect(defaultUiConfig.density).toBe('comfortable');
    TestBed.configureTestingModule({ providers: [provideUiConfig({ glass: true })] });
    TestBed.inject(UI_CONFIG);
    expect(document.documentElement.hasAttribute('data-density')).toBe(false);
  });

  it('writes compact and auto to data-density on <html>', () => {
    TestBed.configureTestingModule({ providers: [provideUiConfig({ density: 'compact' })] });
    expect(TestBed.inject(UI_CONFIG).density).toBe('compact');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideUiConfig({ density: 'auto' })] });
    TestBed.inject(UI_CONFIG);
    expect(document.documentElement.getAttribute('data-density')).toBe('auto');
  });

  it('applyUiDensity switches at runtime and works on a subtree', () => {
    applyUiDensity('compact');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    applyUiDensity('comfortable');
    expect(document.documentElement.hasAttribute('data-density')).toBe(false);
    const island = document.createElement('div');
    applyUiDensity('auto', island);
    expect(island.getAttribute('data-density')).toBe('auto');
  });
});
