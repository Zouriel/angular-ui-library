import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type * as Leaflet from 'leaflet';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiMap, type UiLatLng, type UiMapInsets } from './map';

/*
 * 0.42.1: a fit owns the camera. When the insets change while a fit animates (the Dhirumi nurse app:
 * the route makes the sheet's peek taller just as it appears) or after it, the fit is worked out
 * again for the new insets instead of a stale inset pan. On the real Leaflet; jsdom has no layout,
 * so the canvas is given a size by hand.
 */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const NURSE: UiLatLng = { lat: 4.1755, lng: 73.5093 };
const PATIENT: UiLatLng = { lat: 4.2105, lng: 73.5402 };
// A short route (about 150m), which fits at zoom 17: the case the nurse app hit.
const SHORT: UiLatLng[] = [{ lat: 4.17682, lng: 73.5121 }, { lat: 4.17708, lng: 73.51244 }, { lat: 4.17785, lng: 73.51146 }];
// Spans that need a smaller zoom once a sheet covers more: tall (north-south) and wide (east-west).
const TALL: UiLatLng[] = [NURSE, { lat: 4.2655, lng: 73.5093 }];
const WIDE: UiLatLng[] = [NURSE, { lat: 4.1755, lng: 73.5593 }];
const W = 390;
const H = 844;

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
  template: `<ui-map [center]="center" [zoom]="15" [insets]="insets()" [style.direction]="dir()" />`,
})
class Host {
  center = NURSE;
  insets = signal<UiMapInsets>({});
  dir = signal<'ltr' | 'rtl'>('ltr');
}

async function setup(init?: (h: Host) => void) {
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
  const insets = async (i: UiMapInsets) => {
    f.componentInstance.insets.set(i);
    await settle();
  };
  return { f, cmp, map, canvas, settle, insets };
}

type Box = { top?: number; bottom?: number; left?: number; right?: number };

/** Every point inside the part `box` leaves visible, less the 24px fit padding (1px slack). */
function expectInside(map: Leaflet.Map, points: UiLatLng[], box: Box) {
  for (const p of points) {
    const s = map.latLngToContainerPoint([p.lat, p.lng]);
    expect(s.x, `x of ${p.lat},${p.lng}`).toBeGreaterThanOrEqual((box.left ?? 0) + 24 - 1);
    expect(s.x, `x of ${p.lat},${p.lng}`).toBeLessThanOrEqual(W - (box.right ?? 0) - 24 + 1);
    expect(s.y, `y of ${p.lat},${p.lng}`).toBeGreaterThanOrEqual((box.top ?? 0) + 24 - 1);
    expect(s.y, `y of ${p.lat},${p.lng}`).toBeLessThanOrEqual(H - (box.bottom ?? 0) - 24 + 1);
  }
}

/** The points' bounds are centred in the part `box` leaves visible (the fit's own centring). */
function expectCentred(map: Leaflet.Map, points: UiLatLng[], box: Box) {
  const pts = points.map((p) => map.latLngToContainerPoint([p.lat, p.lng]));
  const mid = (v: number[]) => (Math.min(...v) + Math.max(...v)) / 2;
  expect(Math.abs(mid(pts.map((p) => p.x)) - ((box.left ?? 0) + W - (box.right ?? 0)) / 2)).toBeLessThan(1.5);
  expect(Math.abs(mid(pts.map((p) => p.y)) - ((box.top ?? 0) + H - (box.bottom ?? 0)) / 2)).toBeLessThan(1.5);
}

describe('ui-map fitPoints and changing insets (0.42.1)', () => {
  it('insets change right after a fit (it still owns the camera): fitted again, not panned', async () => {
    const { cmp, map, insets } = await setup((h) => h.insets.set({ top: 100, bottom: 200 }));
    cmp.fitPoints(SHORT);
    expect(map.getZoom()).toBe(17);
    await insets({ top: 100, bottom: 420 }); // the peek grew
    expectInside(map, SHORT, { top: 100, bottom: 420 });
    expectCentred(map, SHORT, { top: 100, bottom: 420 });
    await insets({ top: 40, bottom: 160 });
    cmp.fitPoints(TALL);
    const zoom = map.getZoom();
    await insets({ top: 40, bottom: 420 });
    expectInside(map, TALL, { top: 40, bottom: 420 });
    expectCentred(map, TALL, { top: 40, bottom: 420 });
    expect(map.getZoom()).toBe(zoom - 1); // it needed a wider view: a pan could not have done it
    expect(Number.isInteger(map.getZoom())).toBe(true);
  });

  it('insets that grow step by step while the fit holds (a sheet animating its height)', async () => {
    const { cmp, map, insets } = await setup((h) => h.insets.set({ bottom: 160 }));
    cmp.fitPoints(TALL);
    for (let i = 1; i <= 20; i++) await insets({ bottom: 160 + 12 * i });
    expectInside(map, TALL, { bottom: 400 });
    expectCentred(map, TALL, { bottom: 400 });
  });

  it('mid-fit: Leaflet still zooming when the insets change, the fit runs again once it lands', async () => {
    reduce = false;
    const { cmp, map, insets } = await setup((h) => h.insets.set({ top: 100, bottom: 200 }));
    // jsdom has no CSS transitions, so Leaflet never animates here: hold it mid-zoom by hand, as
    // in a browser, where a setView during a zoom animation is dropped.
    const views: number[] = [];
    const setView = map.setView.bind(map);
    const z = map as unknown as { _animatingZoom: boolean };
    map.setView = ((c: Leaflet.LatLngExpression, zoom: number, o?: Leaflet.ZoomPanOptions) => {
      views.push(zoom);
      if (z._animatingZoom) return map; // what Leaflet's _tryAnimatedZoom does
      return setView(c, zoom, { ...o, animate: false });
    }) as typeof map.setView;
    cmp.fitPoints(SHORT);
    z._animatingZoom = true;
    await insets({ top: 100, bottom: 420 });
    z._animatingZoom = false;
    map.fire('zoomend');
    map.fire('moveend');
    expectInside(map, SHORT, { top: 100, bottom: 420 });
    expectCentred(map, SHORT, { top: 100, bottom: 420 });
    expect(views.length).toBeGreaterThanOrEqual(2);
  });

  it('RTL: an end inset changing after a fit is on the left', async () => {
    const { cmp, map, insets } = await setup((h) => h.dir.set('rtl'));
    cmp.fitPoints(WIDE);
    await insets({ end: 150 });
    expectInside(map, WIDE, { left: 150 });
    expectCentred(map, WIDE, { left: 150 });
  });

  it('once something else moves the map (flyTo, a drag), insets pan as before', async () => {
    const { cmp, map, canvas, insets } = await setup();
    cmp.fitPoints([NURSE, PATIENT]);
    cmp.flyTo(PATIENT, 16); // the app takes the camera back
    await insets({ bottom: 400 });
    expect(map.getZoom()).toBe(16);
    const p = map.latLngToContainerPoint([PATIENT.lat, PATIENT.lng]);
    expect(p.x).toBeCloseTo(W / 2, 0);
    expect(p.y).toBeCloseTo((H - 400) / 2, 0);

    cmp.fitPoints([NURSE, PATIENT]);
    map.fire('dragstart'); // the person pans
    const before = map.latLngToContainerPoint([NURSE.lat, NURSE.lng]);
    const zoom = map.getZoom();
    await insets({ bottom: 200 });
    const after = map.latLngToContainerPoint([NURSE.lat, NURSE.lng]);
    expect(map.getZoom()).toBe(zoom);
    expect(after.y - before.y).toBeCloseTo(100, 0); // the middle of the visible part moved down 100px
    expect(after.x).toBeCloseTo(before.x, 0);
    // A wheel on the map lets go too (held, this change would zoom out: see the first test).
    await insets({ top: 40, bottom: 160 });
    cmp.fitPoints(TALL);
    canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
    const z2 = map.getZoom();
    await insets({ top: 40, bottom: 420 });
    expect(map.getZoom()).toBe(z2);
  });
});
