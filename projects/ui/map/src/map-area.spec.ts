import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type * as Leaflet from 'leaflet';
import { beforeEach, describe, expect, it } from 'vitest';
import { UI_STRINGS, defaultUiStrings } from '@zouriel/ui';
import {
  UiMap, uiMapAreaBounds, uiMapAreaStep, uiMapFormatRadius, uiMapMetersPerPx, uiMapNiceRadius, type UiMapArea,
} from './map';

/* 0.44.0: the search area, its radius handle and fitArea. */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const C = { lat: 4.1755, lng: 73.5093 };

beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});

@Component({
  imports: [UiMap],
  template: `<ui-map [center]="center" [zoom]="13" [area]="area()" [areaLabel]="label()" [preview]="preview()" [style.direction]="dir()"
    (areaChanging)="changing.push($event)" (areaChange)="changed.push($event)" />`,
})
class Host {
  center = C;
  area = signal<UiMapArea | null>({ ...C, radiusMeters: 2000, editable: true, minMeters: 500, maxMeters: 20000 });
  label = signal<string | null>(null);
  preview = signal(false);
  dir = signal<'ltr' | 'rtl'>('ltr');
  changing: number[] = [];
  changed: number[] = [];
}

async function setup(init?: (h: Host) => void) {
  const f = TestBed.createComponent(Host);
  init?.(f.componentInstance);
  f.detectChanges();
  const root = f.nativeElement as HTMLElement;
  const canvas = root.querySelector('.ui-map-canvas') as HTMLElement;
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 390 });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 600 });
  // Leaflet reads the pointer through the canvas's scale (rect / offset size).
  Object.defineProperty(canvas, 'offsetWidth', { configurable: true, value: 390 });
  Object.defineProperty(canvas, 'offsetHeight', { configurable: true, value: 600 });
  canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 600, width: 390, height: 600, toJSON: () => ({}) });
  TestBed.inject(ApplicationRef).tick();
  const cmp = f.debugElement.query(By.directive(UiMap)).componentInstance as UiMap;
  const priv = cmp as unknown as {
    map: Leaflet.Map | null;
    areaLine: Leaflet.CircleMarker | null;
    areaCasing: Leaflet.CircleMarker | null;
    areaHandle: Leaflet.Marker | null;
  };
  for (let i = 0; i < 100 && !priv.map; i++) await new Promise((r) => setTimeout(r, 10));
  expect(priv.map).toBeTruthy();
  const settle = async () => {
    f.detectChanges();
    await f.whenStable();
    TestBed.tick();
  };
  const handle = () => priv.areaHandle?.getElement() ?? null;
  return { f, h: f.componentInstance, root, canvas, cmp, priv, map: priv.map!, settle, handle };
}

function pointer(el: Element, type: string, x: number, y: number, id = 7): PointerEvent {
  const e = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0 });
  el.dispatchEvent(e);
  return e;
}

function key(el: Element, k: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
}

describe('map area helpers (0.44.0)', () => {
  it('metres per px is Web Mercator at the latitude and halves per zoom level', () => {
    expect(uiMapMetersPerPx(0, 0)).toBeCloseTo(156543.03, 1);
    expect(uiMapMetersPerPx(4.1755, 14)).toBeCloseTo(uiMapMetersPerPx(4.1755, 13) / 2, 9);
    expect(uiMapMetersPerPx(60, 10)).toBeCloseTo(uiMapMetersPerPx(0, 10) / 2, 6);
  });

  it('rounds a radius to 10 m, 100 m or 1 km by its size', () => {
    expect(uiMapNiceRadius(804)).toBe(800);
    expect(uiMapNiceRadius(1549)).toBe(1500);
    expect(uiMapNiceRadius(20437)).toBe(20000);
  });

  it('formats a radius in metres or kilometres, from the strings', () => {
    expect(uiMapFormatRadius(800)).toBe('800 m');
    expect(uiMapFormatRadius(1500)).toBe('1.5 km');
    expect(uiMapFormatRadius(2000)).toBe('2 km');
    expect(uiMapFormatRadius(20000)).toBe('20 km');
    expect(uiMapFormatRadius(9960)).toBe('10 km');
    expect(uiMapFormatRadius(1500, { mapRadiusMeters: '{n} މ', mapRadiusKilometers: '{n} ކމ' })).toBe('1.5 ކމ');
  });

  it('a keyboard step is about 10%, at least one unit, within min and max', () => {
    expect(uiMapAreaStep(2000, 1, 500, 20000)).toBe(2200);
    expect(uiMapAreaStep(2000, -1, 500, 20000)).toBe(1800);
    expect(uiMapAreaStep(500, 1, 200, 20000)).toBe(550);
    expect(uiMapAreaStep(19500, 1, 500, 20000)).toBe(20000);
    expect(uiMapAreaStep(520, -1, 500, 20000)).toBe(500);
    // Small radii still move.
    expect(uiMapAreaStep(10, 1, 0, 100)).toBe(20);
  });

  it('the bounds are the circle\'s north, south, east and west points', () => {
    const [n, s, e, w] = uiMapAreaBounds({ ...C, radiusMeters: 1000 });
    expect((n.lat - C.lat) * 111195).toBeCloseTo(1000, 0);
    expect((C.lat - s.lat) * 111195).toBeCloseTo(1000, 0);
    expect((e.lng - C.lng) * 111195 * Math.cos((C.lat * Math.PI) / 180)).toBeCloseTo(1000, 0);
    expect(w.lng).toBeCloseTo(2 * C.lng - e.lng, 9);
  });
});

describe('ui-map area (0.44.0)', () => {
  it('draws a circle in true metres that scales with the zoom, in its own pane under the routes, taking no pointer', async () => {
    const { map, priv, root } = await setup();
    expect(priv.areaLine!.getRadius()).toBeCloseTo(2000 / uiMapMetersPerPx(C.lat, 13), 6);
    expect(priv.areaCasing!.getRadius()).toBeCloseTo(2000 / uiMapMetersPerPx(C.lat, 13), 6);
    map.setZoom(14, { animate: false });
    expect(priv.areaLine!.getRadius()).toBeCloseTo(2000 / uiMapMetersPerPx(C.lat, 14), 6);
    expect(priv.areaLine!.getRadius()).toBeCloseTo(2 * (2000 / uiMapMetersPerPx(C.lat, 13)), 6);
    const pane = map.getPane('uiMapArea')!;
    expect(pane.contains(priv.areaLine!.getElement()!)).toBe(true);
    expect(Number(pane.style.zIndex)).toBeLessThan(420);
    expect(Number(pane.style.zIndex)).toBeGreaterThan(400);
    expect(pane.style.pointerEvents).toBe('none');
    expect(priv.areaLine!.getElement()!.getAttribute('data-tone')).toBe('primary');
    expect(priv.areaLine!.getElement()!.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelectorAll('.ui-map-area-line').length).toBe(1);
  });

  it('puts the handle on the east edge (west in RTL) with the radius chip, as a named slider', async () => {
    const { map, handle, priv } = await setup();
    const c = map.latLngToContainerPoint([C.lat, C.lng]);
    const px = priv.areaLine!.getRadius();
    const at = map.latLngToContainerPoint(priv.areaHandle!.getLatLng());
    expect(at.x - c.x).toBeCloseTo(px, 0);
    expect(at.y - c.y).toBeCloseTo(0, 0);
    const el = handle()!;
    expect(el.getAttribute('role')).toBe('slider');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('aria-label')).toBe('Search area');
    expect(el.getAttribute('aria-valuenow')).toBe('2000');
    expect(el.getAttribute('aria-valuemin')).toBe('500');
    expect(el.getAttribute('aria-valuemax')).toBe('20000');
    expect(el.getAttribute('aria-valuetext')).toBe('2 km');
    expect(el.querySelector('.ui-map-area-chip')!.textContent).toBe('2 km');

    const rtl = await setup((h) => h.dir.set('rtl'));
    const c2 = rtl.map.latLngToContainerPoint([C.lat, C.lng]);
    const at2 = rtl.map.latLngToContainerPoint(rtl.priv.areaHandle!.getLatLng());
    expect(at2.x - c2.x).toBeCloseTo(-rtl.priv.areaLine!.getRadius(), 0);
  });

  it('dragging the handle changes the radius, clamps it, emits while dragging and on release, and never pans the map', async () => {
    const { h, map, handle, priv } = await setup();
    const el = handle()!;
    const c = map.latLngToContainerPoint([C.lat, C.lng]);
    const before = map.getCenter();
    const mpp = uiMapMetersPerPx(C.lat, 13);
    expect(map.dragging.enabled()).toBe(true);

    const down = pointer(el, 'pointerdown', c.x + 2000 / mpp, c.y);
    expect(down.defaultPrevented).toBe(true);
    expect(map.dragging.enabled()).toBe(false);
    // Leaflet's own drag start never reaches the map.
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: c.x + 2000 / mpp, clientY: c.y }));
    pointer(el, 'pointermove', c.x + 3000 / mpp, c.y);
    expect(h.changing).toEqual([3000]);
    expect(h.changed).toEqual([]);
    expect(priv.areaLine!.getRadius()).toBeCloseTo(3000 / mpp, 6);
    expect(el.getAttribute('aria-valuetext')).toBe('3 km');
    // Diagonal: the distance from the centre counts.
    pointer(el, 'pointermove', c.x + 3000 / mpp, c.y + 4000 / mpp);
    expect(h.changing).toEqual([3000, 5000]);
    // Far out: clamped to maxMeters; to the centre: minMeters.
    pointer(el, 'pointermove', c.x + 100000 / mpp, c.y);
    expect(h.changing.at(-1)).toBe(20000);
    pointer(el, 'pointermove', c.x + 1, c.y);
    expect(h.changing.at(-1)).toBe(500);
    pointer(el, 'pointermove', c.x + 4012 / mpp, c.y);
    expect(h.changing.at(-1)).toBe(4000);
    expect(map.getCenter().lat).toBe(before.lat);
    expect(map.getCenter().lng).toBe(before.lng);

    pointer(el, 'pointerup', c.x + 4012 / mpp, c.y);
    expect(h.changed).toEqual([4000]);
    expect(map.dragging.enabled()).toBe(true);
    // Another pointer's moves are ignored after release.
    pointer(el, 'pointermove', c.x + 9000 / mpp, c.y);
    expect(h.changing.at(-1)).toBe(4000);
    expect(map.getCenter().lat).toBe(before.lat);
  });

  it('a press on the handle is not a map tap or a pan, and the circle itself takes no pointer', async () => {
    const { map, handle, root } = await setup();
    let clicks = 0;
    map.on('click', () => clicks++);
    handle()!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
    expect(clicks).toBe(0);
    expect((root.querySelector('.ui-map-area-line') as SVGElement).closest('.leaflet-pane[style*="pointer-events: none"]')).toBeTruthy();
  });

  it('keys step the radius like a slider (mirrored in RTL), Home / End go to the ends, and the map never sees them', async () => {
    const { h, handle, canvas } = await setup();
    let mapKeys = 0;
    canvas.addEventListener('keydown', () => mapKeys++);
    const el = handle()!;
    expect(key(el, 'ArrowUp').defaultPrevented).toBe(true);
    expect(h.changed).toEqual([2200]);
    key(el, 'ArrowRight');
    expect(h.changed).toEqual([2200, 2400]);
    key(el, 'ArrowLeft');
    key(el, 'ArrowDown');
    expect(h.changed).toEqual([2200, 2400, 2200, 2000]);
    expect(h.changing).toEqual(h.changed);
    key(el, 'End');
    expect(h.changed.at(-1)).toBe(20000);
    key(el, 'ArrowUp');
    expect(h.changed.at(-1)).toBe(20000);
    expect(h.changed.length).toBe(5);
    key(el, 'Home');
    expect(h.changed.at(-1)).toBe(500);
    expect(el.getAttribute('aria-valuenow')).toBe('500');
    expect(mapKeys).toBe(0);
    key(el, 'a');
    expect(mapKeys).toBe(1);

    const rtl = await setup((x) => x.dir.set('rtl'));
    key(rtl.handle()!, 'ArrowLeft');
    expect(rtl.h.changed).toEqual([2200]);
    key(rtl.handle()!, 'ArrowRight');
    expect(rtl.h.changed).toEqual([2200, 2000]);
  });

  it('names the handle from areaLabel, else the mapSearchArea string', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: UI_STRINGS, useValue: { ...defaultUiStrings, mapSearchArea: 'AreaDV', mapRadiusKilometers: '{n} kmDV' } }] });
    const { h, handle, settle } = await setup();
    expect(handle()!.getAttribute('aria-label')).toBe('AreaDV');
    expect(handle()!.getAttribute('aria-valuetext')).toBe('2 kmDV');
    h.label.set('Job radius');
    await settle();
    expect(handle()!.getAttribute('aria-label')).toBe('Job radius');
  });

  it('a new area from the app replaces the chosen radius; not editable or a preview draws the circle without a handle; null removes it', async () => {
    const { h, handle, priv, settle, map, root } = await setup();
    key(handle()!, 'ArrowUp');
    expect(handle()!.getAttribute('aria-valuenow')).toBe('2200');
    h.area.set({ ...C, radiusMeters: 1000, editable: true, tone: 'danger' });
    await settle();
    expect(handle()!.getAttribute('aria-valuenow')).toBe('1000');
    expect(priv.areaLine!.getElement()!.getAttribute('data-tone')).toBe('danger');

    h.area.set({ ...C, radiusMeters: 1000 });
    await settle();
    expect(priv.areaLine).toBeTruthy();
    expect(handle()).toBeNull();

    h.area.set({ ...C, radiusMeters: 1000, editable: true });
    h.preview.set(true);
    await settle();
    expect(priv.areaLine).toBeTruthy();
    expect(handle()).toBeNull();
    h.preview.set(false);
    await settle();
    expect(handle()).toBeTruthy();
    expect(map.dragging.enabled()).toBe(true);

    h.area.set(null);
    await settle();
    expect(priv.areaLine).toBeNull();
    expect(handle()).toBeNull();
    expect(root.querySelector('.ui-map-area-line')).toBeNull();
  });

  it('fitArea shows the whole circle inside the visible part', async () => {
    const { cmp, map, h, settle } = await setup();
    h.area.set({ ...C, radiusMeters: 20000, editable: true });
    await settle();
    expect(map.getZoom()).toBe(13);
    cmp.fitArea({ animate: false });
    const z = map.getZoom();
    expect(z).toBeLessThan(13);
    const pts = uiMapAreaBounds({ ...C, radiusMeters: 20000 }).map((p) => map.latLngToContainerPoint([p.lat, p.lng]));
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(24 - 1);
      expect(p.x).toBeLessThanOrEqual(390 - 24 + 1);
      expect(p.y).toBeGreaterThanOrEqual(24 - 1);
      expect(p.y).toBeLessThanOrEqual(600 - 24 + 1);
    }
    // One zoom closer would not fit.
    expect(2 * 20000 / uiMapMetersPerPx(C.lat, z + 1)).toBeGreaterThan(390 - 48);
  });
});
