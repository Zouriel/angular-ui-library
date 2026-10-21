import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as Leaflet from 'leaflet';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  UI_MAP_LEAFLET, UiMap, uiMapFitView, uiMapPoint, uiMapRouteWidth, UI_MAP_FIT_MAX_ZOOM,
  type UiLatLng, type UiMapInsets, type UiMapMarker, type UiMapRoute,
} from './map';

/*
 * 0.42.0: route lines, fitPoints and the map's polish (zoom controls, label chips), on the real
 * Leaflet. jsdom has no layout (the canvas is given a size by hand) and no SVGSVGElement.createSVGRect,
 * so Leaflet thinks it has no SVG and would draw no lines: the loader tells it it has.
 */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const NURSE: UiLatLng = { lat: 4.1755, lng: 73.5093 };
const PATIENT: UiLatLng = { lat: 4.2105, lng: 73.5402 };
const ROAD: [number, number][] = [[4.1755, 73.5093], [4.19, 73.525], [4.2105, 73.5402]];
const W = 390;
const H = 844;
const css = () => readFileSync(join(process.cwd(), 'projects/ui/map/src/map.css'), 'utf8');

let reduce = true;
const original = window.matchMedia;
beforeEach(() => {
  reduce = true;
  window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = original;
});

@Component({
  imports: [UiMap],
  template: `<ui-map [center]="center" [zoom]="13" [routes]="routes()" [markers]="markers()" [insets]="insets()" [pin]="pin()" [pinDraggable]="false"
    [userLocation]="user()" [style.direction]="dir()" />`,
})
class Host {
  center = NURSE;
  routes = signal<UiMapRoute[]>([{ id: 'r', points: ROAD, label: 'Route, 5.1 km' }]);
  markers = signal<UiMapMarker[]>([{ id: 'p', ...PATIENT, label: 'Lily Magu, Hiyaa Tower 4, Hulhumale' }]);
  insets = signal<UiMapInsets>({});
  pin = signal<UiLatLng | null>(PATIENT);
  user = signal<UiLatLng | null>(NURSE);
  dir = signal<'ltr' | 'rtl'>('ltr');
}

async function setup(init?: (h: Host) => void) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: UI_MAP_LEAFLET,
        useValue: async () => {
          const mod = (await import('leaflet')) as unknown as { default?: typeof Leaflet } & typeof Leaflet;
          ((mod.default ?? mod).Browser as { svg: boolean }).svg = true;
          return mod;
        },
      },
    ],
  });
  const f = TestBed.createComponent(Host);
  init?.(f.componentInstance);
  f.detectChanges();
  const root = f.nativeElement as HTMLElement;
  const canvas = root.querySelector('.ui-map-canvas') as HTMLElement;
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: W });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: H });
  TestBed.inject(ApplicationRef).tick();
  const cmp = f.debugElement.query(By.directive(UiMap)).componentInstance as UiMap;
  const priv = cmp as unknown as { map: Leaflet.Map | null };
  for (let i = 0; i < 100 && !priv.map; i++) await new Promise((r) => setTimeout(r, 10));
  const map = priv.map!;
  expect(map).toBeTruthy();
  const settle = async () => {
    f.detectChanges();
    await f.whenStable();
    TestBed.tick();
  };
  const host = root.querySelector('ui-map') as HTMLElement;
  const lines = () => [...host.querySelectorAll<SVGPathElement>('path.ui-map-route-line')];
  const casings = () => [...host.querySelectorAll<SVGPathElement>('path.ui-map-route-casing')];
  return { f, cmp, map, host, settle, lines, casings };
}

describe('ui-map routes', () => {
  it('draws a route as a casing and a line, round-capped, in its own pane under the dot, markers and pin', async () => {
    const { map, lines, casings } = await setup();
    expect(lines().length).toBe(1);
    expect(casings().length).toBe(1);
    const [line, casing] = [lines()[0], casings()[0]];
    for (const p of [line, casing]) {
      expect(p.getAttribute('stroke-linecap')).toBe('round');
      expect(p.getAttribute('stroke-linejoin')).toBe('round');
      expect(p.getAttribute('d')).toMatch(/^M[\d.-]+ [\d.-]+L/); // a real path through the points
    }
    // The casing is painted first (under the line) and wider than it.
    expect(casing.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(Number(casing.getAttribute('stroke-width'))).toBeGreaterThan(Number(line.getAttribute('stroke-width')));
    const pane = map.getPane('uiMapRoute')!;
    expect(pane.contains(line)).toBe(true);
    const z = (name: string) => Number(map.getPane(name)!.style.zIndex || getComputedStyle(map.getPane(name)!).zIndex);
    expect(z('uiMapRoute')).toBeGreaterThan(z('tilePane'));
    for (const above of ['uiMapPulse', 'uiMapUser', 'markerPane']) expect(z('uiMapRoute')).toBeLessThan(z(above));
    expect(pane.style.pointerEvents).toBe('none');
  });

  it('has one name for screen readers, from the app; the casing is hidden', async () => {
    const { f, settle, lines, casings } = await setup();
    expect([lines()[0].getAttribute('role'), lines()[0].getAttribute('aria-label')]).toEqual(['img', 'Route, 5.1 km']);
    expect(casings()[0].getAttribute('aria-hidden')).toBe('true');
    f.componentInstance.routes.set([{ id: 'r', points: ROAD }]);
    await settle();
    expect(lines()[0].getAttribute('aria-label')).toBeNull();
    expect(lines()[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('updates in place: new points move the same line, a new tone recolours it, without a new map', async () => {
    const { f, map, cmp, settle, lines } = await setup();
    const before = lines()[0];
    const d = before.getAttribute('d');
    f.componentInstance.routes.set([{ id: 'r', points: [NURSE, { lat: 4.2, lng: 73.53 }], tone: 'success', label: 'Route, 4 km' }]);
    await settle();
    expect(lines()[0]).toBe(before); // the same element
    expect(lines()[0].getAttribute('d')).not.toBe(d);
    expect(lines()[0].getAttribute('data-tone')).toBe('success');
    expect(lines()[0].getAttribute('aria-label')).toBe('Route, 4 km');
    expect((cmp as unknown as { map: Leaflet.Map }).map).toBe(map);
  });

  it('an empty list removes the lines; a new list adds them back; routes with fewer than two points are skipped', async () => {
    const { f, settle, lines, casings } = await setup();
    f.componentInstance.routes.set([]);
    await settle();
    expect([lines().length, casings().length]).toEqual([0, 0]);
    f.componentInstance.routes.set([
      { id: 'a', points: ROAD },
      { id: 'b', points: [PATIENT], tone: 'muted' },
      { id: 'c', points: [[4.18, 73.51], [4.181, 73.512]], tone: 'muted' },
    ]);
    await settle();
    expect(lines().map((l) => l.getAttribute('data-route'))).toEqual(['a', 'c']);
  });

  it('takes its colours from the theme route tokens, which beat Leaflet’s stroke attribute', () => {
    const c = css();
    expect(c).toMatch(/\.ui-map-route-casing \{[^}]*stroke: var\(--ui-map-route-casing\)/);
    expect(c).toMatch(/\.ui-map-route-line \{[^}]*stroke: var\(--ui-map-route-primary\)/);
    for (const tone of ['muted', 'success', 'warning', 'danger']) {
      expect(c).toMatch(new RegExp(`\\.ui-map-route-line\\[data-tone="${tone}"\\] \\{ stroke: var\\(--ui-map-route-${tone}\\); \\}`));
    }
  });

  it('is 5px over a 9px casing close in, thinner zoomed out, and follows the zoom', async () => {
    expect(uiMapRouteWidth(16)).toEqual({ line: 5, casing: 9 });
    expect(uiMapRouteWidth(14)).toEqual({ line: 5, casing: 9 });
    expect(uiMapRouteWidth(8).line).toBeCloseTo(3, 9);
    expect(uiMapRouteWidth(8).casing).toBeCloseTo(5.4, 9);
    expect(uiMapRouteWidth(12).line).toBeCloseTo(4, 9);
    const { map, lines } = await setup();
    expect(Number(lines()[0].getAttribute('stroke-width'))).toBeCloseTo(uiMapRouteWidth(13).line, 6);
    map.setZoom(16, { animate: false });
    expect(Number(lines()[0].getAttribute('stroke-width'))).toBe(5);
  });

  it('stays the right way round in RTL (the map itself is laid out LTR)', async () => {
    const { map, lines } = await setup((h) => h.dir.set('rtl'));
    const d = lines()[0].getAttribute('d')!;
    const first = d.match(/^M([\d.-]+) ([\d.-]+)/)!.slice(1).map(Number);
    const p = map.latLngToLayerPoint([ROAD[0][0], ROAD[0][1]]);
    expect(first[0]).toBeCloseTo(p.x, 0);
    expect(first[1]).toBeCloseTo(p.y, 0);
    // East is still to the right: the patient (east of the nurse) is drawn to the right.
    const last = map.latLngToLayerPoint([ROAD[2][0], ROAD[2][1]]);
    expect(last.x).toBeGreaterThan(p.x);
  });
});

describe('ui-map fitPoints', () => {
  it('fits the bounds in the free part, at a whole zoom, centred there (the maths)', () => {
    const area = { top: 100, bottom: 300, left: 24, right: 24 };
    const v = uiMapFitView([NURSE, PATIENT], { width: W, height: H }, area)!;
    expect(Number.isInteger(v.zoom)).toBe(true);
    // At this zoom the points fit in 342 x 444 px; one zoom closer they would not.
    const span = (z: number) => {
      const s = 256 * 2 ** z;
      const x = (lng: number) => ((lng + 180) / 360) * s;
      const y = (lat: number) => (0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI)) * s;
      return { w: x(PATIENT.lng) - x(NURSE.lng), h: y(NURSE.lat) - y(PATIENT.lat) };
    };
    expect(span(v.zoom).w).toBeLessThanOrEqual(W - 48);
    expect(span(v.zoom).h).toBeLessThanOrEqual(H - 400);
    expect(Math.max(span(v.zoom + 1).w / (W - 48), span(v.zoom + 1).h / (H - 400))).toBeGreaterThan(1);
    expect(uiMapFitView([], { width: W, height: H }, area)).toBeNull();
    const one = uiMapFitView([NURSE], { width: W, height: H }, { top: 0, bottom: 0, left: 0, right: 0 })!;
    expect([one.lat, one.lng, one.zoom]).toEqual([expect.closeTo(NURSE.lat, 9), expect.closeTo(NURSE.lng, 9), UI_MAP_FIT_MAX_ZOOM]);
    const tuple = uiMapFitView([[1, 2]], { width: W, height: H }, { top: 0, bottom: 0, left: 0, right: 0 }, 12)!;
    expect([tuple.lat, tuple.lng, tuple.zoom]).toEqual([expect.closeTo(1, 9), expect.closeTo(2, 9), 12]);
    expect(uiMapPoint([4, 73])).toEqual({ lat: 4, lng: 73 });
  });

  it('puts every point inside the part the insets leave visible, plus the padding', async () => {
    const { cmp, map } = await setup((h) => h.insets.set({ top: 120, bottom: 360 }));
    cmp.fitPoints([NURSE, PATIENT, ...ROAD]);
    const pts = [NURSE, PATIENT, ...ROAD.map(uiMapPoint)].map((p) => map.latLngToContainerPoint([p.lat, p.lng]));
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(24 - 1);
      expect(p.x).toBeLessThanOrEqual(W - 24 + 1);
      expect(p.y).toBeGreaterThanOrEqual(120 + 24 - 1);
      expect(p.y).toBeLessThanOrEqual(H - 360 - 24 + 1);
    }
    // Centred in that part, at a whole zoom no closer than 17.
    const ys = pts.map((p) => p.y);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo((120 + 24 + H - 360 - 24) / 2, -1);
    expect(Number.isInteger(map.getZoom())).toBe(true);
    expect(map.getZoom()).toBeLessThanOrEqual(17);
  });

  it('takes its own padding and maxZoom, and the start inset on the right in RTL', async () => {
    const { cmp, map } = await setup((h) => {
      h.insets.set({ start: 100 });
      h.dir.set('rtl');
    });
    cmp.fitPoints([NURSE, PATIENT], { padding: { top: 10, bottom: 10, left: 10, right: 10 }, maxZoom: 12 });
    expect(map.getZoom()).toBeLessThanOrEqual(12);
    for (const p of [NURSE, PATIENT].map((q) => map.latLngToContainerPoint([q.lat, q.lng]))) {
      expect(p.x).toBeGreaterThanOrEqual(10 - 1);
      expect(p.x).toBeLessThanOrEqual(W - 100 - 10 + 1); // the start inset is on the right in RTL
    }
  });

  it('one point: centred in the visible part at maxZoom (17 by default)', async () => {
    const { cmp, map } = await setup((h) => h.insets.set({ bottom: 400 }));
    cmp.fitPoints([PATIENT]);
    expect(map.getZoom()).toBe(17);
    const p = map.latLngToContainerPoint([PATIENT.lat, PATIENT.lng]);
    expect(p.x).toBeCloseTo(W / 2, 0);
    expect(p.y).toBeCloseTo((H - 400) / 2, 0);
    cmp.fitPoints([NURSE], { maxZoom: 15 });
    expect(map.getZoom()).toBe(15);
  });

  it('animates unless reduced motion or animate: false', async () => {
    reduce = false;
    const { cmp, map } = await setup();
    const calls: unknown[] = [];
    const setView = map.setView.bind(map);
    map.setView = ((c: Leaflet.LatLngExpression, z: number, o?: Leaflet.ZoomPanOptions) => {
      calls.push(o?.animate);
      return setView(c, z, { ...o, animate: false });
    }) as typeof map.setView;
    cmp.fitPoints([NURSE, PATIENT]);
    cmp.fitPoints([NURSE, PATIENT], { animate: false });
    reduce = true;
    cmp.fitPoints([NURSE, PATIENT]);
    expect(calls).toEqual([true, false, false]);
  });
});

describe('ui-map polish (0.42.0)', () => {
  it('zoom controls: the locate button’s surface, border and lift, 38px (44px on touch) with a 48px hit area', () => {
    const c = css();
    const rule = c.match(/\.ui-map \.leaflet-bar a, \.ui-map \.leaflet-bar a:first-child, \.ui-map \.leaflet-bar a:last-child \{([^}]*)\}/)![1];
    const locate = c.match(/\.ui-map \.ui-map-locate \{([^}]*)\}/)![1];
    const prop = (block: string, p: string) => block.match(new RegExp(`(?:^|[\\s;])${p}:\\s*([^;]+);`))?.[1].trim();
    for (const p of ['background', 'box-shadow', 'box-sizing']) expect(prop(rule, p)).toBe(prop(locate, p)); // the same 38px box, border included
    expect(prop(rule, 'border')).toBe(prop(locate, 'border'));
    expect(prop(rule, 'width')).toBe(prop(locate, 'width'));
    expect(prop(rule, 'background')).toBe('var(--ui-color-surface-raised)'); // opaque, not a see-through outline
    expect(c).toMatch(/@media \(pointer: coarse\) \{\s*\.ui-map \.leaflet-bar a, [^{]*\{[^}]*width: var\(--ui-size-touch\)/);
    expect(c).toMatch(/\.ui-map \.leaflet-bar a::before \{[^}]*width: 48px; height: 48px/);
  });

  it('label chips size to their text up to min(320px, the map less 32px) and wrap to two lines before the ellipsis', async () => {
    const c = css();
    const label = c.match(/\.ui-map \.ui-map-label \{([^}]*)\}/)![1];
    expect(label).toMatch(/max-width: var\(--ui-map-label-max, 320px\)/);
    expect(label).toMatch(/width: max-content/);
    expect(label).toMatch(/white-space: normal/);
    expect(label).toMatch(/-webkit-line-clamp: 2/);
    expect(c).not.toMatch(/\.ui-map-marker \{[^}]*white-space: nowrap/); // the 248px single line it was
    const { host } = await setup();
    expect(host.style.getPropertyValue('--ui-map-label-max')).toBe('320px'); // 390 wide: 320 < 358
    const label40 = host.querySelector('.ui-map-label')!;
    expect(label40.textContent).toBe('Lily Magu, Hiyaa Tower 4, Hulhumale');
  });

  it('a narrow map caps the label at its width less 32px', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const canvas = (f.nativeElement as HTMLElement).querySelector('.ui-map-canvas') as HTMLElement;
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 300 });
    TestBed.inject(ApplicationRef).tick();
    const priv = f.debugElement.query(By.directive(UiMap)).componentInstance as unknown as { map: Leaflet.Map | null };
    for (let i = 0; i < 100 && !priv.map; i++) await new Promise((r) => setTimeout(r, 10));
    const host = (f.nativeElement as HTMLElement).querySelector('ui-map') as HTMLElement;
    expect(host.style.getPropertyValue('--ui-map-label-max')).toBe('268px');
  });
});
