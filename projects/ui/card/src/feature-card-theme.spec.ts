import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import StethoscopeIcon from '@hugeicons/core-free-icons/StethoscopeIcon';
import { UiFeatureCard } from './feature-card';
import type { UiFeatureCardColors } from './feature-colors';

/*
 * 0.40.2: the custom colours follow the theme in effect, from the first frame.
 *
 * The owner's case (Dhirumi web, 0.40.1): index.html already says data-theme="maldives" (light), but the
 * production build inlines only the critical :root tokens (Winter Dark) and loads the stylesheet with the
 * [data-theme="maldives"] rules asynchronously. The cards were created before it finished loading, read the
 * dark tokens, and nothing re-read them: no data-theme changed, the stylesheet just arrived.
 *
 * jsdom neither inherits custom properties nor reacts to stylesheets arriving (media, CSSOM), so this page is
 * modelled: `page` decides which tokens the card's host computes, the way the Dhirumi stylesheets would.
 */

const MINT: UiFeatureCardColors = { surface: '#E1F4EF', accent: '#4B8791' };
const LIGHT_WASH = '#e1f4ef';

const TOKENS = {
  light: { '--ui-color-surface': '#ffffff', '--ui-color-text': '#0b2d3a', '--ui-color-text-muted': '#365f6e', colorScheme: 'light' },
  dark: { '--ui-color-surface': '#0b0f12', '--ui-color-text': '#b3cbdc', '--ui-color-text-muted': '#8aa3b5', colorScheme: 'dark' },
} as const;

const page = { sheetLoaded: true, deviceDark: true };

/** The tokens at `el`: the inlined :root tokens until the stylesheet is in; then its theme rules. */
function themeAt(el: Element): 'light' | 'dark' | null {
  if (!el.isConnected) return null; // a detached element computes no custom properties
  if (!page.sheetLoaded) return 'dark'; // critical CSS: :root is Winter Dark
  const name = el.closest('[data-theme]')?.getAttribute('data-theme');
  if (name === 'maldives') return 'light';
  if (name === 'maldives-dark') return 'dark';
  if (el.ownerDocument.documentElement.classList.contains('app-light')) return 'light';
  return page.deviceDark ? 'dark' : 'light'; // the app's stylesheet follows prefers-color-scheme
}

let schemeListeners: Array<() => void> = [];
let cardReads = 0;

beforeEach(() => {
  page.sheetLoaded = true;
  page.deviceDark = true;
  schemeListeners = [];
  cardReads = 0;
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
    if (el.localName !== 'ui-feature-card') return real(el, pseudo);
    cardReads++;
    const t = themeAt(el);
    const v = t ? TOKENS[t] : null;
    return { getPropertyValue: (k: string) => (v ? ((v as Record<string, string>)[k] ?? '') : ''), colorScheme: v?.colorScheme ?? '' } as unknown as CSSStyleDeclaration;
  });
  // The device prefers dark.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      media: q,
      get matches() { return q.includes('dark') && page.deviceDark; },
      addEventListener: (_: string, fn: () => void) => schemeListeners.push(fn),
      removeEventListener: (_: string, fn: () => void) => (schemeListeners = schemeListeners.filter((f) => f !== fn)),
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as { matchMedia?: unknown }).matchMedia;
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('app-light');
  document.head.querySelectorAll('[data-test-sheet]').forEach((n) => n.remove());
});

@Component({
  imports: [UiFeatureCard, HugeiconsIconComponent],
  template: `
    <ui-feature-card id="t" title="Find a doctor" description="Book a visit." size="sm" surface="tinted" trailingArrow [colors]="colors">
      <hugeicons-icon feature-icon [icon]="icon" />
    </ui-feature-card>`,
})
class Host {
  readonly icon = StethoscopeIcon;
  readonly colors = MINT;
}

function setup() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  TestBed.tick();
  f.detectChanges();
  const wash = () => ((f.nativeElement as HTMLElement).querySelector('#t .fc') as HTMLElement).style.getPropertyValue('--fc-wash');
  return { f, wash };
}

/** Let the watchers' microtask run, then render. */
async function settle(f: { detectChanges(): void }) {
  await new Promise((r) => setTimeout(r, 0));
  f.detectChanges();
}

function lateLink(): HTMLLinkElement {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.setAttribute('data-test-sheet', '');
  document.head.append(link);
  return link;
}

describe('ui-feature-card colours follow the active theme', () => {
  it("owner's case: device dark, app light (data-theme set first), the stylesheet loads after the card: the light pair once it has", async () => {
    document.documentElement.setAttribute('data-theme', 'maldives');
    const link = lateLink();
    page.sheetLoaded = false;
    const { f, wash } = setup();
    expect(wash()).not.toBe(LIGHT_WASH); // still on the inlined dark tokens
    page.sheetLoaded = true;
    link.dispatchEvent(new Event('load')); // no attribute changes: only the stylesheet arrived
    await settle(f);
    expect(wash()).toBe(LIGHT_WASH);
  });

  it('a stylesheet added to the page later (a lazily loaded theme) is picked up too', async () => {
    document.documentElement.setAttribute('data-theme', 'maldives');
    page.sheetLoaded = false;
    const { f, wash } = setup();
    page.sheetLoaded = true;
    const style = document.createElement('style');
    style.setAttribute('data-test-sheet', '');
    document.head.append(style);
    await settle(f);
    expect(wash()).toBe(LIGHT_WASH);
  });

  it('card created after the light theme is set and styled: light from the first render (device dark)', () => {
    document.documentElement.setAttribute('data-theme', 'maldives');
    const { wash } = setup();
    expect(wash()).toBe(LIGHT_WASH);
  });

  it('card created before the theme attribute (set after bootstrap): dark first, then light', async () => {
    const { f, wash } = setup();
    expect(wash()).not.toBe(LIGHT_WASH); // no data-theme: the device's dark
    document.documentElement.setAttribute('data-theme', 'maldives');
    await settle(f);
    expect(wash()).toBe(LIGHT_WASH);
    document.documentElement.setAttribute('data-theme', 'maldives-dark');
    await settle(f);
    expect(wash()).not.toBe(LIGHT_WASH);
    document.documentElement.setAttribute('data-theme', 'maldives');
    await settle(f);
    expect(wash()).toBe(LIGHT_WASH);
  });

  it('a theme switched by a class on <html>, applied late after bootstrap', async () => {
    const { f, wash } = setup();
    expect(wash()).not.toBe(LIGHT_WASH);
    document.documentElement.classList.add('app-light');
    await settle(f);
    expect(wash()).toBe(LIGHT_WASH);
  });

  it('the device preference changing (an app stylesheet that follows prefers-color-scheme)', async () => {
    const { f, wash } = setup();
    expect(wash()).not.toBe(LIGHT_WASH);
    page.deviceDark = false;
    schemeListeners.forEach((fn) => fn());
    await settle(f);
    expect(wash()).toBe(LIGHT_WASH);
  });

  it('stops watching when destroyed', async () => {
    const { f } = setup();
    f.destroy();
    const before = cardReads;
    document.documentElement.setAttribute('data-theme', 'maldives');
    lateLink().dispatchEvent(new Event('load'));
    schemeListeners.forEach((fn) => fn());
    await new Promise((r) => setTimeout(r, 0));
    expect(cardReads).toBe(before);
    expect(schemeListeners.length).toBe(0);
  });
});
