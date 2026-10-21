import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as Leaflet from 'leaflet';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiMap, uiMapAccuracyPx, uiMapTileUrl, UI_MAP_ACCURACY_MAX, UI_MAP_ACCURACY_MIN, type UiLatLng, type UiMapInsets, type UiMapUserLocation } from './map';

/*
 * 0.40.0: tiles that follow the theme, the "my location" button and the "you are here" dot, on the
 * real Leaflet. jsdom has no layout, so the map's canvas is given a size by hand.
 */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const C: UiLatLng = { lat: 4.1755, lng: 73.5093 };
const LIGHT = 'https://tiles.example/light/{z}/{x}/{y}{r}.png?key=KEY';
const DARK = 'https://tiles.example/dark/{z}/{x}/{y}{r}.png?key=KEY';
const css = () => readFileSync(join(process.cwd(), 'projects/ui/map/src/map.css'), 'utf8');

let reduce = false;
const original = window.matchMedia;
beforeEach(() => {
  reduce = true;
  window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = original;
  document.documentElement.removeAttribute('data-theme');
});

@Component({
  imports: [UiMap],
  template: `<ui-map [center]="center" [zoom]="zoom()" [tileUrl]="light" [tileUrlDark]="dark()" [tileSize]="tileSize()" [zoomOffset]="zoomOffset()"
    [locateControl]="locateControl()" [locating]="locating()" [locateOff]="off()" [userLocation]="user()" [insets]="insets()"
    [style.direction]="dir()" [style.background-color]="bg()" (locate)="locates = locates + 1" />`,
})
class Host {
  center = C;
  zoom = signal(15);
  light = LIGHT;
  dark = signal<string | null>(DARK);
  tileSize = signal(256);
  zoomOffset = signal(0);
  locateControl = signal(true);
  locating = signal(false);
  off = signal(false);
  user = signal<UiMapUserLocation | null>(null);
  insets = signal<UiMapInsets>({});
  dir = signal<'ltr' | 'rtl'>('ltr');
  /** jsdom has no theme CSS: the map reads "dark" from its own background, as on a real dark theme. */
  bg = signal('rgb(255, 255, 255)');
  locates = 0;
}

async function setup(init?: (h: Host) => void) {
  const f = TestBed.createComponent(Host);
  init?.(f.componentInstance);
  f.detectChanges();
  const root = f.nativeElement as HTMLElement;
  const canvas = root.querySelector('.ui-map-canvas') as HTMLElement;
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 800 });
  TestBed.inject(ApplicationRef).tick();
  const cmp = f.debugElement.query(By.directive(UiMap)).componentInstance as UiMap;
  const priv = cmp as unknown as { map: Leaflet.Map | null; tiles: (Leaflet.TileLayer & { _url: string }) | null; L: typeof Leaflet };
  for (let i = 0; i < 100 && !priv.map; i++) await new Promise((r) => setTimeout(r, 10));
  expect(priv.map).toBeTruthy();
  const settle = async () => {
    f.detectChanges();
    await f.whenStable();
    TestBed.tick();
  };
  const host = root.querySelector('ui-map') as HTMLElement;
  /** Flip the page theme: the map re-checks when any data-theme changes. */
  const theme = async (dark: boolean) => {
    f.componentInstance.bg.set(dark ? 'rgb(16, 20, 26)' : 'rgb(255, 255, 255)');
    f.detectChanges();
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    await new Promise((r) => setTimeout(r, 0)); // MutationObserver
    await settle();
  };
  return { f, cmp, priv, host, root, settle, theme };
}

describe('ui-map tiles that follow the theme', () => {
  it('picks the dark tiles only on a dark theme that has them', () => {
    expect(uiMapTileUrl(LIGHT, DARK, false)).toBe(LIGHT);
    expect(uiMapTileUrl(LIGHT, DARK, true)).toBe(DARK);
    expect(uiMapTileUrl(LIGHT, null, true)).toBe(LIGHT);
    expect(uiMapTileUrl(LIGHT, '', true)).toBe(LIGHT);
  });

  it('swaps to tileUrlDark live on a dark theme, undimmed, in the same tile layer; and back', async () => {
    const { priv, host, theme } = await setup();
    const layer = priv.tiles!;
    expect(layer._url).toBe(LIGHT);
    await theme(true);
    expect(priv.tiles).toBe(layer); // swapped in place: no new layer, no map rebuild
    expect(layer._url).toBe(DARK);
    expect([host.hasAttribute('data-dark'), host.hasAttribute('data-dark-tiles')]).toEqual([true, true]);
    await theme(false);
    expect(layer._url).toBe(LIGHT);
    expect(host.hasAttribute('data-dark-tiles')).toBe(false);
  });

  it('without tileUrlDark, a dark theme dims the light tiles as before', async () => {
    const { priv, host, theme } = await setup((h) => h.dark.set(null));
    await theme(true);
    expect(priv.tiles!._url).toBe(LIGHT);
    expect([host.hasAttribute('data-dark'), host.hasAttribute('data-dark-tiles')]).toEqual([true, false]);
    // The dimming filter skips dark tiles.
    expect(css()).toMatch(/\.ui-map\[data-dark\]:not\(\[data-dark-tiles\]\) \.leaflet-tile-pane \{ filter:/);
    expect(css()).not.toMatch(/\.ui-map\[data-dark\] \.leaflet-tile-pane/);
  });

  it('fills {r} with @2x on a high-density screen and nothing otherwise', async () => {
    const { priv } = await setup();
    const L = priv.L as unknown as { Browser: { retina: boolean } };
    const was = L.Browser.retina;
    try {
      L.Browser.retina = false;
      expect(priv.tiles!.getTileUrl(Object.assign(new (priv.L.Point)(1, 2), { z: 15 }) as Leaflet.Coords)).toBe('https://tiles.example/light/15/1/2.png?key=KEY');
      L.Browser.retina = true;
      expect(priv.tiles!.getTileUrl(Object.assign(new (priv.L.Point)(1, 2), { z: 15 }) as Leaflet.Coords)).toBe('https://tiles.example/light/15/1/2@2x.png?key=KEY');
    } finally {
      L.Browser.retina = was;
    }
  });

  it('takes 512 px tiles with a zoom offset (MapTiler raster), in a new layer', async () => {
    const { f, priv, settle } = await setup();
    const first = priv.tiles;
    f.componentInstance.tileSize.set(512);
    f.componentInstance.zoomOffset.set(-1);
    await settle();
    expect(priv.tiles).not.toBe(first);
    expect([priv.tiles!.options.tileSize, priv.tiles!.options.zoomOffset]).toEqual([512, -1]);
    expect(priv.tiles!.getTileUrl(Object.assign(new (priv.L.Point)(1, 2), { z: 15 }) as Leaflet.Coords)).toContain('/14/1/2');
  });
});

describe('ui-map "my location" button', () => {
  const button = (root: HTMLElement) => root.querySelector('.ui-map-locate') as HTMLButtonElement | null;

  it('is there only with locateControl, named from the strings, and emits locate', async () => {
    const { f, root, settle } = await setup((h) => h.locateControl.set(false));
    expect(button(root)).toBeNull();
    f.componentInstance.locateControl.set(true);
    await settle();
    const b = button(root)!;
    expect([b.type, b.getAttribute('aria-label'), b.hasAttribute('data-state')]).toEqual(['button', 'Show my location', false]);
    expect(b.querySelector('hugeicons-icon')).toBeTruthy();
    b.click();
    expect(f.componentInstance.locates).toBe(1);
  });

  it('while locating: a spinner, aria-busy, and presses do nothing', async () => {
    const { f, root, settle } = await setup((h) => h.locating.set(true));
    const b = button(root)!;
    expect([b.getAttribute('data-state'), b.getAttribute('aria-busy')]).toEqual(['locating', 'true']);
    expect(b.querySelector('.ui-map-locate-spin')).toBeTruthy();
    expect(b.querySelector('hugeicons-icon')).toBeNull();
    b.click();
    expect(f.componentInstance.locates).toBe(0);
    f.componentInstance.locating.set(false);
    await settle();
    expect(button(root)).toBe(b); // the same button, so focus stays on it
    expect(b.hasAttribute('aria-busy')).toBe(false);
  });

  it('location off: struck-through icon, "Location is off" as description and tooltip, still pressable to ask again', async () => {
    const { f, root, settle } = await setup((h) => h.off.set(true));
    const b = button(root)!;
    expect([b.getAttribute('data-state'), b.getAttribute('aria-description'), b.getAttribute('aria-label')]).toEqual(['off', 'Location is off', 'Show my location']);
    b.dispatchEvent(new Event('mouseenter'));
    await settle();
    expect(document.querySelector('.ui-tooltip')?.textContent).toBe('Location is off');
    b.dispatchEvent(new Event('mouseleave'));
    b.click();
    expect(f.componentInstance.locates).toBe(1);
    f.componentInstance.off.set(false);
    await settle();
    b.dispatchEvent(new Event('mouseenter'));
    await settle();
    expect(document.querySelector('.ui-tooltip')).toBeNull(); // no tooltip when it isn't off
    expect(b.hasAttribute('aria-description')).toBe(false);
  });

  it('sits at the bottom-end of the visible part, following the insets (above a bottom sheet), at the end in RTL too', async () => {
    const { f, host, settle } = await setup((h) => h.insets.set({ bottom: 300, end: 10 }));
    expect([host.style.getPropertyValue('--ui-map-inset-bottom'), host.style.getPropertyValue('--ui-map-inset-end')]).toEqual(['300px', '10px']);
    f.componentInstance.insets.set({ bottom: 420, end: 10 }); // the sheet rose
    f.componentInstance.dir.set('rtl');
    await settle();
    expect([host.style.getPropertyValue('--ui-map-inset-bottom'), host.style.getPropertyValue('--ui-map-inset-end')]).toEqual(['420px', '10px']);
    const rule = /\.ui-map \.ui-map-locate \{([^}]*)\}/.exec(css())![1];
    expect(rule).toMatch(/bottom: calc\(var\(--ui-map-inset-bottom, 0px\) \+ var\(--ui-space-8\)\)/);
    expect(rule).toMatch(/inset-inline-end: calc\(var\(--ui-map-inset-end, 0px\) \+ var\(--ui-space-3\)\)/);
    expect(rule).toMatch(/border-radius: 50%/);
    expect(rule).toMatch(/transition: bottom var\(--ui-motion-base\)/);
  });

  // 0.40.1: the Dhirumi apps' tap-target check found the 44px circle was also the whole hit area.
  it('on coarse pointers: a 44px circle (38px with a mouse) and a 48px hit area centred on it; the zoom buttons too', () => {
    const coarse = coarseRules();
    expect(coarse['.ui-map .ui-map-locate']).toMatchObject({ width: 'var(--ui-size-touch)', height: 'var(--ui-size-touch)' });
    expect(/\.ui-map \.ui-map-locate \{[^}]*width: var\(--ui-size-lg\)/.test(css())).toBe(true);
    // As specific as the base rule's :first-child / :last-child, or that rule wins and keeps them small.
    for (const sel of ['.ui-map .leaflet-bar a', '.ui-map .leaflet-bar a:first-child', '.ui-map .leaflet-bar a:last-child'])
      expect(coarse[sel], sel).toMatchObject({ position: 'relative', width: 'var(--ui-size-touch)', height: 'var(--ui-size-touch)' });
    for (const sel of ['.ui-map .ui-map-locate::before', '.ui-map .leaflet-bar a::before']) {
      const r = coarse[sel];
      expect(r, sel).toBeTruthy();
      expect(r.content, sel).toBe("''");
      expect(r.position, sel).toBe('absolute');
      expect(parseFloat(r.width!), sel).toBeGreaterThanOrEqual(48);
      expect(parseFloat(r.height!), sel).toBeGreaterThanOrEqual(48);
      // Centred on the visible control, so the circle and the buttons stay where they were.
      expect([r.left, r.top, r.transform], sel).toEqual(['50%', '50%', 'translate(-50%, -50%)']);
    }
    // Nothing grows the hit area with a mouse: the ::before rules are touch-only.
    expect(css().replace(/@media \(pointer: coarse\) \{[\s\S]*?\n\}/g, '')).not.toMatch(/(ui-map-locate|leaflet-bar a)::before/);
  });
});

/** The declarations inside every `@media (pointer: coarse)` block of map.css, by selector. */
type Decls = Partial<Record<'content' | 'position' | 'width' | 'height' | 'left' | 'top' | 'transform', string>>;
function coarseRules(): Record<string, Decls> {
  const out: Record<string, Decls> = {};
  const text = css();
  for (const m of text.matchAll(/@media \(pointer: coarse\) \{/g)) {
    let depth = 1;
    let i = m.index! + m[0].length;
    const start = i;
    for (; depth && i < text.length; i++) depth += text[i] === '{' ? 1 : text[i] === '}' ? -1 : 0;
    for (const r of text.slice(start, i - 1).matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const decls = Object.fromEntries(r[2].split(';').map((d) => d.split(/:(.*)/s).map((x) => x.trim())).filter((d) => d[0]).map((d) => [d[0], d[1]]));
      for (const sel of r[1].split(',').map((x) => x.replace(/\/\*[\s\S]*?\*\//g, '').trim())) out[sel] = { ...out[sel], ...decls };
    }
  }
  return out;
}

// 0.40.1: in Dhivehi the English credits were laid out right to left, with the © signs misplaced.
describe('ui-map attribution', () => {
  it('is an LTR isolate in an RTL map, in the mirrored (bottom-left) corner', async () => {
    const { root } = await setup((h) => h.dir.set('rtl'));
    const attr = root.querySelector('.leaflet-control-attribution') as HTMLElement;
    expect(attr.textContent).toContain('OpenStreetMap');
    expect(attr.getAttribute('dir')).toBe('ltr');
    expect(attr.parentElement!.classList.contains('leaflet-left')).toBe(true);
    expect(attr.parentElement!.classList.contains('leaflet-bottom')).toBe(true);
    const rule = /\.ui-map \.leaflet-control-attribution \{([^}]*)\}/.exec(css())![1];
    expect(rule).toMatch(/direction: ltr;/);
    expect(rule).toMatch(/unicode-bidi: isolate;/);
  });

  it('is LTR in an LTR map too, at the bottom right', async () => {
    const { root } = await setup();
    const attr = root.querySelector('.leaflet-control-attribution') as HTMLElement;
    expect(attr.getAttribute('dir')).toBe('ltr');
    expect(attr.parentElement!.classList.contains('leaflet-right')).toBe(true);
  });
});

describe('ui-map "you are here" dot', () => {
  it('sizes the accuracy halo in metres at the zoom, clamped', () => {
    // 50 m at the equator, zoom 16: 2.39 m/px, so 100 m across is 42 px.
    expect(uiMapAccuracyPx(50, 0, 16)).toBe(42);
    expect(uiMapAccuracyPx(50, 0, 17)).toBe(84);
    expect(uiMapAccuracyPx(1, 0, 10)).toBe(UI_MAP_ACCURACY_MIN);
    expect(uiMapAccuracyPx(5000, 0, 18)).toBe(UI_MAP_ACCURACY_MAX);
    expect(uiMapAccuracyPx(undefined, 0, 18)).toBe(0);
    expect(uiMapAccuracyPx(0, 0, 18)).toBe(0);
  });

  it('draws a ringed dot over a halo in its own pane above the tiles and pulse, below markers and the pin, named "Your location"', async () => {
    const { f, priv, host, settle } = await setup((h) => h.user.set({ ...C, accuracy: 40 }));
    const map = priv.map!;
    const el = host.querySelector('.ui-map-user') as HTMLElement;
    expect(el).toBeTruthy();
    expect(map.getPane('uiMapUser')!.contains(el)).toBe(true);
    const z = (n: string) => Number(map.getPane(n)!.style.zIndex || getComputedStyle(map.getPane(n)!).zIndex);
    expect(z('uiMapUser')).toBeGreaterThan(z('uiMapPulse'));
    expect(z('uiMapUser')).toBeGreaterThan(z('tilePane'));
    expect(z('uiMapUser')).toBeLessThan(z('markerPane'));
    expect([el.getAttribute('role'), el.getAttribute('aria-label')]).toEqual(['img', 'Your location']);
    expect(el.querySelector('.ui-map-user-dot')).toBeTruthy();
    const halo = () => el.querySelector('.ui-map-user-halo') as HTMLElement | null;
    expect(halo()!.style.width).toBe(`${uiMapAccuracyPx(40, C.lat, 15)}px`);
    // Zooming in grows the halo with the map.
    map.setZoom(17, { animate: false });
    const now = host.querySelector('.ui-map-user .ui-map-user-halo') as HTMLElement;
    expect(now.style.width).toBe(`${uiMapAccuracyPx(40, C.lat, 17)}px`);
    expect(css()).toMatch(/\.ui-map \.ui-map-user-dot \{[^}]*border: 3px solid var\(--ui-color-location-ring\)/);
    expect(css()).toMatch(/--ui-map-user-tone: var\(--ui-color-location\)/);
    // No accuracy: no halo. Null: no dot.
    f.componentInstance.user.set({ ...C });
    await settle();
    expect(host.querySelector('.ui-map-user .ui-map-user-halo')).toBeNull();
    f.componentInstance.user.set(null);
    await settle();
    expect(host.querySelector('.ui-map-user')).toBeNull();
  });

  it('flyTo puts a point in the middle of the visible part (between the insets)', async () => {
    const { cmp, priv } = await setup((h) => h.insets.set({ bottom: 400 }));
    const there = { lat: 4.19, lng: 73.53 };
    cmp.flyTo(there, 16);
    const p = priv.map!.latLngToContainerPoint([there.lat, there.lng]);
    expect(priv.map!.getZoom()).toBe(16);
    expect(p.x).toBeCloseTo(200, 0);
    expect(p.y).toBeCloseTo(200, 0);
  });
});
