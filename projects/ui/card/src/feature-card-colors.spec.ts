import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import StethoscopeIcon from '@hugeicons/core-free-icons/StethoscopeIcon';
import { UiFeatureCard, type UiFeatureTone } from './feature-card';
import {
  uiContrast, uiMix, uiParseColor, uiParseColorAlpha, uiResolveFeatureColors, uiToHex, type UiFeatureCardColors, type UiFeatureColorTheme,
} from './feature-colors';

/* 0.39.0: badgeTone, enter / enterDelay, hover and focus motion, and custom colors. */

const MINT: UiFeatureCardColors = { surface: '#E1F4EF', accent: '#4B8791' };
const BLUE: UiFeatureCardColors = { surface: '#E5F0FA', accent: '#4B8791' };
const LIGHT = '--ui-color-surface: #ffffff; --ui-color-text: #0b2d3a; --ui-color-text-muted: #365f6e';
const DARK = '--ui-color-surface: #0f2a35; --ui-color-text: #e6f1f5; --ui-color-text-muted: rgba(230, 241, 245, 0.7)';

@Component({
  imports: [UiFeatureCard, HugeiconsIconComponent],
  template: `
    <ui-feature-card id="c" title="Nurse at home" description="A nurse comes to you." size="sm" surface="tinted" trailingArrow
      [tone]="tone()" [badgeTone]="badgeTone()" [colors]="colors()" [enter]="enter()" [enterDelay]="delay()" [attr.style]="vars()">
      <hugeicons-icon feature-icon [icon]="icon" />
    </ui-feature-card>`,
})
class Host {
  readonly icon = StethoscopeIcon;
  tone = signal<UiFeatureTone>('accent');
  badgeTone = signal<UiFeatureTone | undefined>(undefined);
  colors = signal<UiFeatureCardColors | null>(null);
  enter = signal(false);
  delay = signal(0);
  vars = signal(LIGHT);
}

function setup(init?: (h: Host) => void) {
  const f = TestBed.createComponent(Host);
  init?.(f.componentInstance);
  f.detectChanges();
  TestBed.tick();
  f.detectChanges();
  const fc = () => (f.nativeElement as HTMLElement).querySelector('#c .fc') as HTMLElement;
  return { f, h: f.componentInstance, fc };
}

const css = () => readFileSync(join(process.cwd(), 'projects/ui/card/src/feature-card.ts'), 'utf8');

afterEach(() => vi.restoreAllMocks());

describe('ui-feature-card badgeTone', () => {
  it('is the card tone when left out (no attribute, unchanged look), and its own tone when set', () => {
    const { f, h, fc } = setup();
    expect(fc().getAttribute('data-badge-tone')).toBeNull();
    h.badgeTone.set('primary');
    f.detectChanges();
    expect([fc().getAttribute('data-tone'), fc().getAttribute('data-badge-tone')]).toEqual(['accent', 'primary']);
  });

  it('sets the badge tint and icon from the badge tone, over the card tone (18% primary on a tinted card)', () => {
    const s = css();
    expect(s).toMatch(/\.fc\[data-surface\]:is\(\[data-badge-tone="primary"\], \[data-badge-tone="brand"\]\) \{\s*--fc-badge-bg: color-mix\(in srgb, var\(--ui-color-primary\) 14%, var\(--ui-color-surface\)\);\s*--fc-badge-fg: var\(--ui-color-primary\);/);
    expect(s).toMatch(/\.fc\[data-surface="tinted"\]:is\(\[data-badge-tone="primary"\], \[data-badge-tone="brand"\]\) \{\s*--fc-badge-bg: color-mix\(in srgb, var\(--ui-color-primary\) 18%/);
    expect(s).toMatch(/\.fc\[data-surface\]\[data-badge-tone="accent"\] \{ --fc-badge-bg: var\(--ui-color-accent\); --fc-badge-fg: var\(--ui-color-accent-contrast\); \}/);
    // Every badge-tone rule outranks the tone rules: three attribute/class parts (the tinted primary rule has three),
    // and it comes after them. (0.39 first shipped .fc[data-badge-tone="accent"], which lost to the tinted primary rule.)
    const rules = [...s.matchAll(/^\s*(\.fc[^{]*data-badge-tone[^{]*)\{[^}]*--fc-badge-bg:/gm)];
    expect(rules.length).toBe(4);
    for (const m of rules) {
      for (const sel of m[1].split(/,(?![^(]*\))/)) {
        const head = sel.trim().split(' ')[0].replace(/:is\(([^)]*)\)/, (_, inner: string) => inner.split(',')[0].trim());
        expect((head.match(/\.|\[/g) ?? []).length, sel).toBeGreaterThanOrEqual(3);
      }
    }
    expect(s.indexOf('[data-badge-tone="accent"] {')).toBeGreaterThan(s.indexOf('.fc[data-surface="tinted"]:is([data-tone="primary"], [data-tone="brand"]) {'));
  });
});

describe('ui-feature-card enter and motion', () => {
  it('plays the entrance once, after its delay; a theme change or re-render keeps the same element (no replay)', () => {
    const { f, h, fc } = setup((x) => {
      x.enter.set(true);
      x.delay.set(120);
    });
    const el = fc();
    expect(el.classList).toContain('enter');
    expect(el.style.getPropertyValue('--fc-enter-delay')).toBe('120ms');
    h.vars.set(DARK);
    document.documentElement.setAttribute('data-theme', 'maldives-dark');
    h.tone.set('primary');
    f.detectChanges();
    expect(fc()).toBe(el);
    document.documentElement.removeAttribute('data-theme');
    const s = css();
    expect(s).toMatch(/\.fc\.enter \{ animation: ui-fc-enter var\(--ui-motion-slow\) var\(--ui-ease-decelerate\) backwards; animation-delay: var\(--fc-enter-delay, 0ms\); \}/);
    expect(s).toMatch(/@keyframes ui-fc-enter \{ from \{ opacity: 0; transform: translateY\(8px\); \} \}/);
  });

  it('off by default', () => {
    const { fc } = setup();
    expect(fc().classList).not.toContain('enter');
  });

  it('lifts the badge icon and nudges the arrow on hover, focus and press; none of it under reduced motion', () => {
    const s = css();
    expect(s).toMatch(/\.fc\.interactive:not\(\.disabled\):is\(:hover, :active, :has\(\.hit:focus-visible\)\) \.badge ::ng-deep > \* \{ transform: translateY\(-2px\) scale\(1\.08\); \}/);
    expect(s).toMatch(/\.fc\.interactive:not\(\.disabled\):is\(:active, :has\(\.hit:focus-visible\)\) \.arrow \{ transform: translateX\(3px\); \}/);
    const reduced = s.slice(s.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.fc\.enter \{ animation: none; \}/);
    expect(reduced).toMatch(/\.badge ::ng-deep > \* \{ transform: none; \}/);
    expect(reduced).toMatch(/:has\(\.hit:focus-visible\)\) \.arrow \{ transform: none; \}/);
  });
});

describe('ui-feature-card colors', () => {
  it("draws the app's surface and accent (badge 14% over the surface), keeps the theme's text", () => {
    const { fc } = setup((x) => x.colors.set(MINT));
    const el = fc();
    expect(el.hasAttribute('data-colors')).toBe(true);
    const v = (k: string) => el.style.getPropertyValue(k);
    expect(v('--fc-wash')).toBe('#e1f4ef');
    expect(v('--fc-accent')).toBe('#4b8791');
    expect(v('--fc-badge-fg')).toBe('#4b8791');
    expect(v('--fc-badge-bg')).toBe(uiToHex(uiMix(uiParseColor('#4B8791')!, uiParseColor('#E1F4EF')!, 0.14)));
    // The action words are deepened to 4.5:1; the description too; the title is the theme text (not set).
    expect(uiContrast(uiParseColor(v('--fc-ink'))!, uiParseColor('#E1F4EF')!)).toBeGreaterThanOrEqual(4.5);
    expect(uiContrast(uiParseColor(v('--fc-desc'))!, uiParseColor('#E1F4EF')!)).toBeGreaterThanOrEqual(4.5);
    const s = css();
    expect(s).toMatch(/\.fc\[data-colors\], \.fc\[data-colors\]\[data-tone="brand"\] \{ background: var\(--fc-wash\); border-color: transparent; \}/);
    expect(s).toMatch(/\.fc\[data-colors\]\.interactive:not\(\.disabled\):hover, \.fc\[data-colors\]\.interactive:has\(\.hit:focus-visible\) \{ border-color: var\(--fc-accent\); \}/);
    expect(s).not.toMatch(/\.title \{[^}]*--fc-accent/);
  });

  it('derives the dark pair when the theme turns dark', async () => {
    const { f, h, fc } = setup((x) => x.colors.set(MINT));
    h.vars.set(DARK);
    f.detectChanges();
    document.documentElement.setAttribute('data-theme', 'x-dark');
    await new Promise((r) => setTimeout(r, 0)); // MutationObserver
    f.detectChanges();
    document.documentElement.removeAttribute('data-theme');
    const v = (k: string) => fc().style.getPropertyValue(k);
    const surface = uiParseColor('#0f2a35')!;
    expect(v('--fc-wash')).toBe(uiToHex(uiMix(uiParseColor('#4B8791')!, surface, 0.18)));
    const accent = uiParseColor(v('--fc-accent'))!;
    expect(uiContrast(accent, uiParseColor(v('--fc-wash'))!)).toBeGreaterThanOrEqual(4.5);
    expect(uiContrast(accent, uiParseColor(v('--fc-badge-bg'))!)).toBeGreaterThanOrEqual(3);
  });

  it('invalid colours fall back to the tone, with a dev-mode warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { fc } = setup((x) => x.colors.set({ surface: 'mint', accent: '#4B8791' }));
    expect(fc().hasAttribute('data-colors')).toBe(false);
    expect(fc().style.getPropertyValue('--fc-wash')).toBe('');
    expect(warn).toHaveBeenCalled();
  });
});

describe('feature card colour sums', () => {
  const light: UiFeatureColorTheme = { surface: [255, 255, 255], text: [11, 45, 58, 1], muted: [54, 95, 110, 1], dark: false };

  it('reads hex and rgb colours, and refuses anything else', () => {
    expect(uiParseColor('#E1F4EF')).toEqual([225, 244, 239]);
    expect(uiParseColor('#abc')).toEqual([170, 187, 204]);
    expect(uiParseColor('rgb(75, 135, 145)')).toEqual([75, 135, 145]);
    expect(uiParseColor('rgba(75 135 145 / 0.5)')).toEqual([75, 135, 145]);
    expect(uiParseColorAlpha('rgba(75, 135, 145, 0.5)')).toEqual([75, 135, 145, 0.5]);
    expect(uiParseColorAlpha('#4b879180')![3]).toBeCloseTo(0.5, 2);
    for (const bad of ['mint', '#12', '#gggggg', 'rgb(300, 0, 0)', '', 'hsl(0 0% 0%)']) expect(uiParseColor(bad)).toBeNull();
  });

  it("keeps the owner's colours on a light theme: the icon is 3:1 on its badge on mint and on blue", () => {
    for (const c of [MINT, BLUE]) {
      const r = uiResolveFeatureColors(c, light)!;
      expect(r.surface).toBe(c.surface.toLowerCase());
      expect(r.accent).toBe('#4b8791');
      expect(uiContrast(uiParseColor(r.accent)!, uiParseColor(r.badge)!)).toBeGreaterThanOrEqual(3);
      expect(uiContrast(uiParseColor(r.accent)!, uiParseColor(r.surface)!)).toBeGreaterThanOrEqual(3);
    }
  });

  it('uses the given dark pair as is when it reads well, and refuses an invalid one', () => {
    const dark: UiFeatureColorTheme = { surface: [15, 42, 53], text: [230, 241, 245, 1], muted: [230, 241, 245, 0.7], dark: true };
    const r = uiResolveFeatureColors({ ...MINT, surfaceDark: '#173a3f', accentDark: '#9fd3d9' }, dark)!;
    expect([r.surface, r.accent]).toEqual(['#173a3f', '#9fd3d9']);
    expect(uiResolveFeatureColors({ ...MINT, accentDark: 'teal' }, dark)).toBeNull();
  });

  it('moves a too-faint accent until the icon reads 3:1', () => {
    const r = uiResolveFeatureColors({ surface: '#ffffff', accent: '#e0e0e0' }, light)!;
    expect(uiContrast(uiParseColor(r.accent)!, uiParseColor(r.badge)!)).toBeGreaterThanOrEqual(3);
    expect(uiContrast(uiParseColor(r.ink)!, uiParseColor(r.surface)!)).toBeGreaterThanOrEqual(4.5);
  });
});
