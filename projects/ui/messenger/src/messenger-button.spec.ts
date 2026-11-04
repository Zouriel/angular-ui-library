import { createHash } from 'node:crypto';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UI_MESSENGER_BRANDS, type UiMessengerApp } from './messenger-brand';
import { UiMessengerButton } from './messenger-button';

/*
 * Logo and colour checks. The SHA-256 of each logo's path data (its `d` strings joined by "\n") was
 * computed from the brands' own files: WhatsApp's Digital_Glyph_White_RGB_2026.svg (whatsappbrand.com
 * logo pack), Viber's "Viber Icon White.svg" (Rakuten-Viber-Logos-2026.zip, viber.com brand center)
 * and Telegram's Logo.svg (telegram.org/press). A changed character fails here. Flutter's
 * UiMessengerBrand carries the same paths and checks the same hashes.
 */
const OFFICIAL_SHA256: Record<UiMessengerApp, string> = {
  whatsapp: '2d1c9c343235e7beb344789d50e32e9ed15fdb2ffafa7439dc96a0af3b1df065',
  viber: '5864810e3bb6ab89919ba229a7bd68199235c50a8539c9210587108b98fcdb31',
  telegram: '7941487ada4671ccc4ac47e7ff4ca18689f2e52044c0a640b492871c3ae72b71',
};
const APPS: UiMessengerApp[] = ['whatsapp', 'viber', 'telegram'];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = ([r, g, b]: number[]) => {
  const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** `c` under a white veil at `alpha`. */
const veil = (c: number[], alpha: number) => c.map((v) => v * (1 - alpha) + 255 * alpha);

/** The compiled component styles as selector -> declarations. */
const rules = (() => {
  const css = ((UiMessengerButton as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n');
  const map = new Map<string, string>();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].replace(/\[_nghost-[^\]]*\]/g, ':host').replace(/\[_ngcontent-[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    map.set(sel, (map.get(sel) ?? '') + m[2].replace(/\s+/g, ' ').trim());
  }
  return { map, css };
})();
const rule = (sel: string) => rules.map.get(sel) ?? '';

@Component({
  imports: [UiMessengerButton],
  template: `
    @for (a of apps; track a) {
      <ui-messenger-button [class]="a" [app]="a" [label]="label()" [compact]="compact()" [ticked]="ticked()" [tickLabel]="tickLabel()"
        [ariaLabel]="ariaLabel()" [disabled]="disabled()" (pressed)="presses.set([...presses(), a])" />
    }`,
})
class Host {
  apps = APPS;
  label = signal<string | undefined>(undefined);
  compact = signal<boolean | 'auto'>(false);
  ticked = signal(false);
  tickLabel = signal<string | undefined>(undefined);
  ariaLabel = signal<string | undefined>(undefined);
  disabled = signal(false);
  presses = signal<UiMessengerApp[]>([]);
}

function make() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const btn = (a: UiMessengerApp) => el.querySelector(`ui-messenger-button.${a} button`) as HTMLButtonElement;
  return { f, h: f.componentInstance, btn };
}

describe('ui-messenger-button', () => {
  it('carries each brand’s official logo, unaltered (hash of the published path data)', () => {
    for (const a of APPS) {
      const joined = UI_MESSENGER_BRANDS[a].logo.paths.map((p) => p.d).join('\n');
      expect(createHash('sha256').update(joined).digest('hex'), a).toBe(OFFICIAL_SHA256[a]);
    }
    expect(UI_MESSENGER_BRANDS.viber.logo.paths.map((p) => !!p.evenOdd)).toEqual([false, false, false, true]);
    expect(UI_MESSENGER_BRANDS.telegram.logo.disc).toEqual({ cx: 500, cy: 500, r: 500, top: '#2AABEE', bottom: '#229ED9', y2: 0.992583404 });
  });

  it('draws the logo in white (Telegram: on its gradient disc), never in the label colour', () => {
    const { btn } = make();
    for (const a of APPS) {
      const svg = btn(a).querySelector('svg.logo')!;
      const b = UI_MESSENGER_BRANDS[a];
      expect(svg.getAttribute('viewBox')).toBe(`0 0 ${b.logo.width} ${b.logo.height}`);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      const paths = [...svg.querySelectorAll('path')];
      expect(paths.map((p) => p.getAttribute('d'))).toEqual(b.logo.paths.map((p) => p.d));
      expect(paths.every((p) => p.getAttribute('fill') === '#FFFFFF')).toBe(true);
    }
    const tg = btn('telegram').querySelector('svg.logo')!;
    const circle = tg.querySelector('circle')!;
    const grad = tg.querySelector('linearGradient')!;
    expect(circle.getAttribute('fill')).toBe(`url(#${grad.id})`);
    expect([...grad.querySelectorAll('stop')].map((s) => s.getAttribute('stop-color'))).toEqual(['#2AABEE', '#229ED9']);
    expect(btn('whatsapp').querySelector('circle')).toBeNull();
  });

  it('fills with the brand colour and writes the label in its ink', () => {
    const { btn } = make();
    expect(UI_MESSENGER_BRANDS.whatsapp.fill).toEqual(['#25D366', '#25D366']);
    expect(UI_MESSENGER_BRANDS.viber.fill).toEqual(['#7360F2', '#7360F2']);
    expect(UI_MESSENGER_BRANDS.telegram.fill).toEqual(['#2AABEE', '#229ED9']);
    for (const a of APPS) {
      const s = btn(a).style;
      expect(s.getPropertyValue('--m-top')).toBe(UI_MESSENGER_BRANDS[a].fill[0]);
      expect(s.getPropertyValue('--m-bottom')).toBe(UI_MESSENGER_BRANDS[a].fill[1]);
      expect(s.getPropertyValue('--m-ink')).toBe(UI_MESSENGER_BRANDS[a].ink);
    }
    expect(rule('.ui-mbtn')).toMatch(/background: linear-gradient\(var\(--m-top\) calc\(50% - var\(--m-logo\) \/ 2\), var\(--m-bottom\) calc\(50% \+ var\(--m-logo\) \/ 2\)\)/);
    // The gradient band is the logo's box: Telegram's disc (as tall as the logo) meets the same blue at every height.
    expect(APPS.map((a) => UI_MESSENGER_BRANDS[a].logoSize)).toEqual([22, 22, 28]);
    for (const a of APPS) expect(btn(a).style.getPropertyValue('--m-logo')).toBe(`${UI_MESSENGER_BRANDS[a].logoSize}px`);
    const disc = UI_MESSENGER_BRANDS.telegram.logo.disc!;
    expect(disc.r * 2).toBe(UI_MESSENGER_BRANDS.telegram.logo.width);
    expect([disc.top, disc.bottom]).toEqual([...UI_MESSENGER_BRANDS.telegram.fill]);
    expect(rule('.ui-mbtn')).toMatch(/color: var\(--m-ink\)/);
  });

  it('keeps the label at WCAG AA (4.5:1) on every part of the fill, at rest, hovered and pressed', () => {
    const found: Record<string, number> = {};
    for (const a of APPS) {
      const b = UI_MESSENGER_BRANDS[a];
      for (const stop of b.fill) {
        for (const [state, alpha] of [['rest', 0], ['hover', 0.1], ['pressed', 0.18]] as const) {
          const r = ratio(rgb(b.ink), veil(rgb(stop), alpha));
          found[`${a} ${stop} ${state}`] = Math.round(r * 100) / 100;
          expect(r, `${a} on ${stop} (${state})`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
    // The figures in messenger-brand.ts.
    expect(found['whatsapp #25D366 rest']).toBe(7.46);
    expect(found['viber #7360F2 rest']).toBe(4.68);
    expect(found['telegram #2AABEE rest']).toBe(6.53);
    expect(found['telegram #229ED9 rest']).toBe(5.57);
    // White words would fail on every brand: the reason the ink is dark.
    for (const a of APPS) expect(ratio([255, 255, 255], rgb(UI_MESSENGER_BRANDS[a].fill[0])), a).toBeLessThan(4.5);
    // The veils are white (raising contrast), as the figures above assume.
    expect(rule(':host')).toMatch(/--ui-messenger-veil: #FFFFFF/);
    expect(rule('.ui-mbtn:hover:not(:disabled)::after')).toMatch(/opacity: 0.1/);
    expect(rule('.ui-mbtn:active:not(:disabled)::after')).toMatch(/opacity: 0.18/);
  });

  it('is 44px tall, with an 8px gap and 12px padding, the same for every app', () => {
    const base = rule('.ui-mbtn');
    expect(base).toMatch(/height: var\(--ui-size-touch\)/);
    expect(base).toMatch(/min-width: var\(--ui-size-touch\)/);
    expect(base).toMatch(/align-items: center/);
    expect(base).toMatch(/justify-content: center/);
    expect(base).toMatch(/gap: var\(--ui-space-2\)/);
    expect(base).toMatch(/padding: 0 var\(--ui-space-3\)/);
    expect(base).toMatch(/border-radius: var\(--ui-radius\)/);
    expect(rule('.logo')).toMatch(/width: var\(--m-logo\); height: var\(--m-logo\)/);
    expect(rule('.ui-mbtn:focus-visible')).toMatch(/box-shadow: var\(--ui-focus-ring\)/);
    // No app-specific geometry: only colours differ.
    expect([...rules.map.keys()].some((k) => k.includes('data-app'))).toBe(false);
  });

  it('names itself: the label (default the app), or ariaLabel, plus the tick label when ticked', () => {
    const { f, h, btn } = make();
    expect(btn('whatsapp').getAttribute('aria-label')).toBe('WhatsApp');
    expect(btn('viber').textContent!.trim()).toBe('Viber');
    expect(btn('telegram').textContent!.trim()).toBe('Telegram');
    h.ariaLabel.set('Send to Aisha on WhatsApp');
    h.ticked.set(true);
    f.detectChanges();
    expect(btn('whatsapp').getAttribute('aria-label')).toBe('Send to Aisha on WhatsApp, Opened');
    h.tickLabel.set('Opened in WhatsApp · 3:14 pm');
    f.detectChanges();
    expect(btn('whatsapp').getAttribute('aria-label')).toBe('Send to Aisha on WhatsApp, Opened in WhatsApp · 3:14 pm');
    // The host carries no name of its own (it would double up).
    expect(btn('whatsapp').parentElement!.getAttribute('aria-label')).toBeNull();
  });

  it('puts the tick badge in the same corner on every app, decorative, and the button still works', () => {
    const { f, h, btn } = make();
    for (const a of APPS) expect(btn(a).querySelector('.tick')).toBeNull();
    h.ticked.set(true);
    f.detectChanges();
    for (const a of APPS) {
      const tick = btn(a).querySelector('.tick')!;
      expect(tick.getAttribute('aria-hidden')).toBe('true');
      expect(tick.querySelector('hugeicons-icon')).not.toBeNull();
      expect(tick.textContent!.trim()).toBe('');
      btn(a).click();
    }
    expect(h.presses()).toEqual(APPS);
    const t = rule('.tick');
    expect(t).toMatch(/top: -6px; inset-inline-end: -6px/);
    expect(t).toMatch(/width: 18px; height: 18px/);
    expect(t).toMatch(/background: var\(--ui-color-success\)/);
    expect(t).toMatch(/color: var\(--ui-color-success-contrast\)/);
    expect(t).toMatch(/pointer-events: none/);
  });

  it('does nothing when disabled', () => {
    const { f, h, btn } = make();
    h.disabled.set(true);
    f.detectChanges();
    for (const a of APPS) {
      expect(btn(a).disabled).toBe(true);
      btn(a).click();
    }
    expect(h.presses()).toEqual([]);
  });

  it('compact draws the logo alone; auto does so below 120px wide (a container query on the expanded host)', () => {
    const { f, h, btn } = make();
    h.compact.set(true);
    f.detectChanges();
    expect(btn('viber').classList).toContain('icon-only');
    expect(btn('viber').getAttribute('aria-label')).toBe('Viber');
    expect(rule('.ui-mbtn.icon-only .label')).toMatch(/display: none/);
    h.compact.set('auto');
    f.detectChanges();
    expect(btn('viber').classList).toContain('auto');
    expect(btn('viber').classList).not.toContain('icon-only');
    expect(rules.css).toMatch(/@container \(max-width: 119.98px\)/);
    expect(rule('.expand:host')).toMatch(/container-type: inline-size/);
  });

  it('uses its custom label', () => {
    const { f, h, btn } = make();
    h.label.set('Send');
    f.detectChanges();
    expect(btn('telegram').querySelector('.label')!.textContent!.trim()).toBe('Send');
    expect(btn('telegram').getAttribute('aria-label')).toBe('Send');
  });
});
