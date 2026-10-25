import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as Leaflet from 'leaflet';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UI_MAP_LEAFLET, UI_MAP_ROUTE_FADE_MS, UiMap, uiMapRouteDrawMs, uiMapRouteEase, uiMapRouteLength, uiMapRoutePartial,
  type UiLatLng, type UiMapRoute,
} from './map';

/*
 * 0.46.2: a route draws in from its start to its end when it appears or its points change. The
 * frames and the clock are driven by hand: requestAnimationFrame queues callbacks that `frame(ms)`
 * runs after moving performance.now() on. Leaflet is imported first, so it keeps the real frames.
 */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const ROAD: [number, number][] = [[4.1755, 73.5093], [4.19, 73.525], [4.2105, 73.5402]];
const OTHER: UiLatLng[] = [{ lat: 4.1755, lng: 73.5093 }, { lat: 4.2, lng: 73.53 }];
const css = () => readFileSync(join(process.cwd(), 'projects/ui/map/src/map.css'), 'utf8');

let reduce = false;
let clock = 1000;
let queue: FrameRequestCallback[] = [];
const originalMatch = window.matchMedia;
const originalRaf = globalThis.requestAnimationFrame;
const originalCancel = globalThis.cancelAnimationFrame;

beforeAll(async () => {
  await import('leaflet');
});
beforeEach(() => {
  reduce = false;
  clock = 1000;
  queue = [];
  window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => queue.push(cb)) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});
afterEach(() => {
  window.matchMedia = originalMatch;
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCancel;
  vi.restoreAllMocks();
});

/** Moves the clock on by `ms` and runs the frames asked for until then. */
function frame(ms: number) {
  clock += ms;
  const run = queue;
  queue = [];
  for (const cb of run) cb(clock);
}

@Component({
  imports: [UiMap],
  template: `<ui-map [center]="{ lat: 4.19, lng: 73.525 }" [zoom]="13" [routes]="routes()" />`,
})
class Host {
  routes = signal<UiMapRoute[]>([]);
}

async function setup(routes: UiMapRoute[] = []) {
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
  f.componentInstance.routes.set(routes);
  f.detectChanges();
  const root = f.nativeElement as HTMLElement;
  const canvas = root.querySelector('.ui-map-canvas') as HTMLElement;
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 390 });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 844 });
  TestBed.inject(ApplicationRef).tick();
  const cmp = f.debugElement.query(By.directive(UiMap)).componentInstance as UiMap;
  const priv = cmp as unknown as { map: Leaflet.Map | null; routeLayers: Map<string, { casing: Leaflet.Polyline; line: Leaflet.Polyline }>; routeFrame: number | null };
  for (let i = 0; i < 100 && !priv.map; i++) await new Promise((r) => setTimeout(r, 10));
  expect(priv.map).toBeTruthy();
  const set = async (r: UiMapRoute[]) => {
    f.componentInstance.routes.set(r);
    f.detectChanges();
    await f.whenStable();
  };
  /** The drawn length of route `id`'s line and casing, in metres. */
  const drawn = (id = 'r') => {
    const l = priv.routeLayers.get(id)!;
    const ll = (p: Leaflet.Polyline) => (p.getLatLngs() as Leaflet.LatLng[]).map((x) => ({ lat: x.lat, lng: x.lng }));
    return { line: uiMapRouteLength(ll(l.line)), casing: uiMapRouteLength(ll(l.casing)), points: ll(l.line) };
  };
  const host = root.querySelector('ui-map') as HTMLElement;
  /** Whether the draw-in has asked for another frame (Angular queues its own frames too, so not the queue's length). */
  const pending = () => priv.routeFrame !== null;
  return { f, set, drawn, host, pending };
}

const TOTAL = uiMapRouteLength(ROAD);

describe('ui-map route draw-in (0.46.2)', () => {
  it('the maths: length-aware duration, ease-out, the partial route by length', () => {
    expect(uiMapRouteDrawMs(1000)).toBe(450);
    expect(uiMapRouteDrawMs(4000)).toBe(750);
    expect(uiMapRouteDrawMs(100_000)).toBe(900); // a long drive never drags
    expect(uiMapRouteDrawMs(50)).toBe(250); // a street-length one is quick
    expect(uiMapRouteDrawMs(300)).toBeLessThan(uiMapRouteDrawMs(5000));
    expect([uiMapRouteEase(0), uiMapRouteEase(0.5), uiMapRouteEase(1), uiMapRouteEase(2)]).toEqual([0, 0.875, 1, 1]);
    const none = uiMapRoutePartial(ROAD, 0);
    expect(none).toEqual([{ lat: 4.1755, lng: 73.5093 }, { lat: 4.1755, lng: 73.5093 }]);
    const half = uiMapRoutePartial(ROAD, 0.5);
    expect(uiMapRouteLength(half) / TOTAL).toBeCloseTo(0.5, 3);
    expect(half[0]).toEqual({ lat: 4.1755, lng: 73.5093 });
    expect(uiMapRoutePartial(ROAD, 1)).toEqual(ROAD.map(([lat, lng]) => ({ lat, lng })));
  });

  it('grows along the path, casing and line together: partial mid-way, whole at the end, then stops asking for frames', async () => {
    const { drawn, pending } = await setup([{ id: 'r', points: ROAD }]);
    const ms = uiMapRouteDrawMs(TOTAL);
    expect(ms).toBeGreaterThanOrEqual(600);
    expect(ms).toBeLessThanOrEqual(900);
    expect(drawn().line).toBeLessThan(1); // starts as a dot at the start
    expect(pending()).toBe(true);
    expect(drawn().points[0]).toEqual({ lat: 4.1755, lng: 73.5093 });
    frame(ms / 4);
    const quarter = drawn();
    expect(quarter.line / TOTAL).toBeCloseTo(uiMapRouteEase(0.25), 2);
    expect(quarter.casing).toBeCloseTo(quarter.line, 6);
    frame(ms / 4);
    const half = drawn().line / TOTAL;
    expect(half).toBeGreaterThan(quarter.line / TOTAL);
    expect(half).toBeCloseTo(0.875, 2); // ease-out: most of it by half time
    expect(half).toBeLessThan(0.99);
    frame(ms / 2 + 1);
    expect(drawn().points).toEqual(ROAD.map(([lat, lng]) => ({ lat, lng })));
    expect(drawn().casing).toBeCloseTo(TOTAL, 6);
    expect(pending()).toBe(false);
  });

  it('the same points again (new objects, same id) do not replay; new points do', async () => {
    const { set, drawn, pending } = await setup([{ id: 'r', points: ROAD, label: 'Route' }]);
    frame(2000);
    expect(drawn().line).toBeCloseTo(TOTAL, 6);
    await set([{ id: 'r', points: ROAD.map(([a, b]) => [a, b] as [number, number]), label: 'Route, 5 km', tone: 'success' }]);
    expect(drawn().line).toBeCloseTo(TOTAL, 6);
    expect(pending()).toBe(false);
    // Mid-draw, the same points don't restart it either.
    await set([{ id: 'r', points: OTHER }]);
    expect(drawn().line).toBeLessThan(1);
    frame(100);
    const before = drawn().line;
    await set([{ id: 'r', points: [...OTHER] }]);
    expect(drawn().line).toBeCloseTo(before, 6);
    frame(2000);
    expect(drawn().line).toBeCloseTo(uiMapRouteLength(OTHER), 6);
  });

  it('reduced motion: drawn whole at once, no frames', async () => {
    reduce = true;
    const { set, drawn, pending } = await setup([{ id: 'r', points: ROAD }]);
    expect(drawn().line).toBeCloseTo(TOTAL, 6);
    await set([{ id: 'r', points: OTHER }]);
    expect(drawn().line).toBeCloseTo(uiMapRouteLength(OTHER), 6);
    expect(pending()).toBe(false);
  });

  it('animate: false draws that route at once, the others still draw in', async () => {
    const { drawn } = await setup([{ id: 'r', points: ROAD, animate: false }, { id: 'o', points: OTHER }]);
    expect(drawn('r').line).toBeCloseTo(TOTAL, 6);
    expect(drawn('o').line).toBeLessThan(1);
  });

  it('a removed route fades out over 150 ms, then its lines go; at once under reduced motion', async () => {
    const { set, host } = await setup([{ id: 'r', points: ROAD, label: 'Route' }]);
    frame(2000);
    await set([]);
    const leaving = host.querySelectorAll('path.ui-map-route-leaving');
    expect(leaving).toHaveLength(2); // casing and line
    expect(host.querySelector('path.ui-map-route-line')!.getAttribute('aria-label')).toBeNull();
    await new Promise((r) => setTimeout(r, UI_MAP_ROUTE_FADE_MS + 50));
    expect(host.querySelectorAll('path.ui-map-route-line, path.ui-map-route-casing')).toHaveLength(0);
    expect(css()).toMatch(/\.ui-map \.ui-map-route-leaving \{ animation: ui-map-route-out 150ms/);
  });

  it('reduced motion removes a route at once', async () => {
    reduce = true;
    const { set, host } = await setup([{ id: 'r', points: ROAD }]);
    await set([]);
    expect(host.querySelectorAll('path.ui-map-route-line, path.ui-map-route-casing')).toHaveLength(0);
  });

  it('a route put back while it fades draws again, with no stale lines left', async () => {
    const { set, host, drawn } = await setup([{ id: 'r', points: ROAD }]);
    frame(2000);
    await set([]);
    await set([{ id: 'r', points: ROAD }]);
    expect(host.querySelectorAll('path.ui-map-route-line')).toHaveLength(1);
    expect(host.querySelectorAll('path.ui-map-route-leaving')).toHaveLength(0);
    expect(drawn().line).toBeLessThan(1); // it appeared again: it draws in again
  });
});
