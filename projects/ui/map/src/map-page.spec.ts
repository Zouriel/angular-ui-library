import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as Leaflet from 'leaflet';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiBottomSheet } from '@zouriel/ui/dialog';
import { UiFloatingPanel } from '@zouriel/ui/layout';
import { UiMap, uiMapInsetShift, type UiLatLng, type UiMapInsets, type UiMapPulse, type UiMapView } from './map';

/*
 * 0.39.0: the pulse ("searching" rings) and view insets, on the real Leaflet (loaded by the default
 * UI_MAP_LEAFLET loader). jsdom has no layout, so the map's canvas is given a size by hand.
 */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const C: UiLatLng = { lat: 4.1755, lng: 73.5093 };
const W = 400;
const H = 800;

let reduce = false;
const original = window.matchMedia;
beforeEach(() => {
  reduce = false;
  window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = original;
});

@Component({
  imports: [UiMap],
  template: `<ui-map [center]="center()" [zoom]="15" [pulse]="pulse()" [insets]="insets()" [pinMode]="true" [(pin)]="pin"
    [style.direction]="dir()" (centerChanged)="views.push($event)" />`,
})
class Host {
  center = signal<UiLatLng>(C);
  pulse = signal<UiMapPulse | null>({ ...C, tone: 'success' });
  insets = signal<UiMapInsets>({});
  dir = signal<'ltr' | 'rtl'>('ltr');
  pin = signal<UiLatLng | null>(null);
  views: UiMapView[] = [];
}

async function setup(init?: (h: Host) => void) {
  const f = TestBed.createComponent(Host);
  init?.(f.componentInstance);
  f.detectChanges();
  const canvas = (f.nativeElement as HTMLElement).querySelector('.ui-map-canvas') as HTMLElement;
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: W });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: H });
  TestBed.inject(ApplicationRef).tick();
  const cmp = f.debugElement.query(By.directive(UiMap)).componentInstance as UiMap;
  const mapOf = () => (cmp as unknown as { map: Leaflet.Map | null }).map;
  for (let i = 0; i < 100 && !mapOf(); i++) await new Promise((r) => setTimeout(r, 10));
  const map = mapOf()!;
  expect(map).toBeTruthy();
  const settle = async () => {
    f.detectChanges();
    await f.whenStable();
    TestBed.tick();
  };
  const host = f.nativeElement.querySelector('ui-map') as HTMLElement;
  const pulseEl = () => host.querySelector('.ui-map-pulse') as HTMLElement | null;
  return { f, map, host, pulseEl, settle };
}

/** Where a Leaflet-positioned element sits in the map's container: the sum of its and its ancestors' Leaflet positions. */
function containerPos(map: Leaflet.Map, el: HTMLElement): { x: number; y: number } {
  const out = { x: 0, y: 0 };
  for (let e: HTMLElement | null = el; e && e !== map.getContainer(); e = e.parentElement) {
    const pos = (e as unknown as { _leaflet_pos?: { x: number; y: number } })._leaflet_pos;
    if (pos) {
      out.x += pos.x;
      out.y += pos.y;
    }
  }
  return out;
}

describe('ui-map pulse', () => {
  it('shows three staggered rings while active, in its own pane between the tiles and the markers, hidden from screen readers', async () => {
    const { map, pulseEl } = await setup();
    const el = pulseEl()!;
    expect(el).toBeTruthy();
    expect(el.querySelectorAll('.ui-map-pulse-ring').length).toBe(3);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('data-tone')).toBe('success');
    const pane = map.getPane('uiMapPulse')!;
    expect(pane.contains(el)).toBe(true);
    const z = (name: string) => Number(map.getPane(name)!.style.zIndex || getComputedStyle(map.getPane(name)!).zIndex);
    expect(z('uiMapPulse')).toBeGreaterThan(z('tilePane'));
    expect(z('uiMapPulse')).toBeLessThan(z('markerPane'));
    expect(pane.style.pointerEvents).toBe('none');
  });

  it('is removed when inactive or null, and comes back when active again', async () => {
    const { f, pulseEl, settle } = await setup();
    f.componentInstance.pulse.set({ ...C, active: false });
    await settle();
    expect(pulseEl()).toBeNull();
    f.componentInstance.pulse.set({ ...C });
    await settle();
    expect(pulseEl()?.querySelectorAll('.ui-map-pulse-ring').length).toBe(3);
    expect(pulseEl()?.getAttribute('data-tone')).toBe('primary');
    f.componentInstance.pulse.set(null);
    await settle();
    expect(pulseEl()).toBeNull();
  });

  it('leaves nothing behind when the map is destroyed', async () => {
    const { f, pulseEl } = await setup();
    const el = pulseEl()!;
    expect(el.isConnected).toBe(true);
    const cmp = f.debugElement.query(By.directive(UiMap)).componentInstance as unknown as { pulseMarker: unknown; map: unknown };
    f.destroy();
    expect([cmp.pulseMarker, cmp.map]).toEqual([null, null]); // Leaflet's map (and the pulse with it) removed
    expect(el.isConnected).toBe(false);
    expect(document.querySelector('.ui-map-pulse, .ui-map-pulse-ring')).toBeNull();
  });

  it('is one still halo under reduced motion', async () => {
    reduce = true;
    const { pulseEl } = await setup();
    expect(pulseEl()!.querySelectorAll('.ui-map-pulse-ring').length).toBe(0);
    expect(pulseEl()!.querySelectorAll('.ui-map-pulse-halo').length).toBe(1);
    const css = readFileSync(join(process.cwd(), 'projects/ui/map/src/map.css'), 'utf8');
    // The rings animate; the halo has no animation of its own.
    expect(css).toMatch(/\.ui-map-pulse-ring \{[^}]*animation: ui-map-pulse 2\.4s/);
    expect(css).not.toMatch(/\.ui-map-pulse-halo \{[^}]*animation/);
  });

  it('stays on its point when the map moves (geo-anchored)', async () => {
    reduce = true;
    const { map, pulseEl } = await setup();
    expect(map.getPane('mapPane')!.contains(pulseEl()!)).toBe(true); // moves with the map, not fixed over it
    const before = containerPos(map, pulseEl()!);
    const expected = map.latLngToContainerPoint([C.lat, C.lng]);
    expect(before.x).toBeCloseTo(expected.x, 0);
    expect(before.y).toBeCloseTo(expected.y, 0);
    map.panBy([120, -40], { animate: false });
    const after = containerPos(map, pulseEl()!);
    const now = map.latLngToContainerPoint([C.lat, C.lng]);
    expect(after.x).toBeCloseTo(now.x, 0);
    expect(after.y).toBeCloseTo(now.y, 0);
    expect(after.x - before.x).toBeCloseTo(-120, 0);
    expect(after.y - before.y).toBeCloseTo(40, 0);
  });
});

/** How many px apart a point and C are on the map. */
function px(map: Leaflet.Map, ll: UiLatLng): number {
  const a = map.project([ll.lat, ll.lng]);
  const b = map.project([C.lat, C.lng]);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('ui-map pin point', () => {
  it("puts the pin's drawn point (11 + 11 * sqrt(2) px down its turned head) on the place, so it sits in the pulse's middle", async () => {
    const { f, host, settle } = await setup();
    f.componentInstance.pin.set({ ...C });
    await settle();
    const pin = host.querySelector('.ui-map-pin') as HTMLElement;
    // Leaflet places the icon's anchor on the point through negative margins.
    expect([pin.style.marginLeft, pin.style.marginTop]).toEqual(['-14px', `-${Math.round(11 + 11 * Math.SQRT2)}px`]);
  });
});

describe('ui-map insets', () => {
  it('works out the middle of the visible part, mirrored in RTL', () => {
    expect(uiMapInsetShift({ top: 100, bottom: 300 }, false)).toEqual({ x: 0, y: -100 });
    expect(uiMapInsetShift({ start: 40 }, false)).toEqual({ x: 20, y: 0 });
    expect(uiMapInsetShift({ start: 40 }, true)).toEqual({ x: -20, y: 0 });
  });

  it('centres `center` in the part between the insets, and reports that point', async () => {
    reduce = true;
    const { f, map } = await setup((h) => h.insets.set({ top: 100, bottom: 300, start: 40 }));
    const p = map.latLngToContainerPoint([C.lat, C.lng]);
    // Visible part: x 40..400, y 100..500.
    expect(p.x).toBeCloseTo(220, 0);
    expect(p.y).toBeCloseTo(300, 0);
    // Within a pixel: Leaflet pans by whole pixels.
    expect(px(map, f.componentInstance.views.at(-1)!)).toBeLessThan(1);
  });

  it('a new center input lands in the visible part too', async () => {
    reduce = true;
    const { f, map, settle } = await setup((h) => h.insets.set({ bottom: 400 }));
    const next = { lat: 4.18, lng: 73.52 };
    f.componentInstance.center.set(next);
    await settle();
    const p = map.latLngToContainerPoint([next.lat, next.lng]);
    expect(p.x).toBeCloseTo(200, 0);
    expect(p.y).toBeCloseTo(200, 0);
  });

  it('when the insets change, the point in the middle of the visible part pans to the middle of the new one', async () => {
    reduce = true;
    const { f, map, settle } = await setup();
    expect(map.latLngToContainerPoint([C.lat, C.lng]).y).toBeCloseTo(400, 0);
    f.componentInstance.insets.set({ bottom: 300 }); // the sheet rose
    await settle();
    expect(map.latLngToContainerPoint([C.lat, C.lng]).y).toBeCloseTo(250, 0);
    f.componentInstance.insets.set({ top: 80, bottom: 300 }); // a status card appeared
    await settle();
    expect(map.latLngToContainerPoint([C.lat, C.lng]).y).toBeCloseTo(290, 0);
    // The app's center echo (the same point) doesn't move it again.
    f.componentInstance.center.set({ ...C });
    await settle();
    expect(map.latLngToContainerPoint([C.lat, C.lng]).y).toBeCloseTo(290, 0);
  });

  it('Enter in pin mode drops the pin in the middle of the visible part', async () => {
    reduce = true;
    const { f, map, settle } = await setup((h) => h.insets.set({ bottom: 300 }));
    const canvas = (f.nativeElement as HTMLElement).querySelector('.ui-map-canvas') as HTMLElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(px(map, f.componentInstance.pin()!)).toBeLessThan(1);
  });

  it('the zoom buttons zoom around the middle of the visible part', async () => {
    reduce = true;
    const { map, host } = await setup((h) => h.insets.set({ top: 80, bottom: 300 }));
    expect(map.latLngToContainerPoint([C.lat, C.lng]).y).toBeCloseTo(290, 0);
    (host.querySelector('.leaflet-control-zoom-in') as HTMLElement).click();
    expect(map.getZoom()).toBe(16);
    const p = map.latLngToContainerPoint([C.lat, C.lng]);
    // Within Leaflet's whole-pixel rounding; zooming around the map's own centre would put it near y 180.
    expect(Math.abs(p.y - 290)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(p.x - 200)).toBeLessThanOrEqual(1.5);
  });

  it('moves the zoom buttons and attribution inside the insets, start/end swapped in RTL', async () => {
    const { f, host, settle } = await setup((h) => h.insets.set({ top: 80, bottom: 240, start: 12, end: 4 }));
    const v = (k: string) => host.style.getPropertyValue(`--ui-map-inset-${k}`);
    expect([v('top'), v('bottom'), v('left'), v('right')]).toEqual(['80px', '240px', '12px', '4px']);
    f.componentInstance.dir.set('rtl');
    f.componentInstance.insets.set({ top: 80, bottom: 240, start: 12, end: 4 });
    await settle();
    expect([v('left'), v('right')]).toEqual(['4px', '12px']);
    const css = readFileSync(join(process.cwd(), 'projects/ui/map/src/map.css'), 'utf8');
    expect(css).toMatch(/\.ui-map \.leaflet-top \{ top: var\(--ui-map-inset-top/);
    expect(css).toMatch(/\.ui-map \.leaflet-bottom \{ bottom: var\(--ui-map-inset-bottom/);
    expect(css).toMatch(/\.ui-map \.leaflet-left \{ left: var\(--ui-map-inset-left/);
    expect(css).toMatch(/\.ui-map \.leaflet-right \{ right: var\(--ui-map-inset-right/);
  });
});

/* A full-screen map page: the map fills the page, a status card floats at the top and a bottom sheet
   holds the form. Their coverChange outputs feed the map's insets. */
@Component({
  imports: [UiMap, UiFloatingPanel, UiBottomSheet],
  template: `
    <div class="page" style="position: fixed; inset: 0">
      <ui-map fill [center]="center" [insets]="{ top: top(), bottom: bottom() }" [pulse]="{ lat: center.lat, lng: center.lng }" />
      <ui-floating-panel placement="top" ariaLabel="Status" (coverChange)="top.set($event)">
        <button type="button" class="cancel" (click)="cancelled = cancelled + 1">Cancel</button>
      </ui-floating-panel>
      <ui-bottom-sheet [snaps]="[0.25, 0.6]" [snap]="0" title="Find a nurse" [closable]="false" (coverChange)="bottom.set($event)">
        <input class="addr" aria-label="Address" />
      </ui-bottom-sheet>
    </div>`,
})
class PageHost {
  center = C;
  top = signal(0);
  bottom = signal(0);
  cancelled = 0;
}

describe('a full-screen map page (map, top status card, bottom sheet)', () => {
  it('feeds the card and sheet heights into the map insets, and both stay usable over the map', async () => {
    reduce = true;
    const f = TestBed.createComponent(PageHost);
    f.detectChanges();
    const root = f.nativeElement as HTMLElement;
    const panel = root.querySelector('ui-floating-panel') as HTMLElement;
    const page = root.querySelector('.page') as HTMLElement;
    // jsdom has no layout: a 64px card 16px from the top of an 800px page.
    Object.defineProperty(panel, 'offsetHeight', { configurable: true, value: 64 });
    Object.defineProperty(panel, 'offsetTop', { configurable: true, value: 16 });
    Object.defineProperty(panel, 'offsetParent', { configurable: true, value: page });
    Object.defineProperty(page, 'clientHeight', { configurable: true, value: 800 });
    TestBed.inject(ApplicationRef).tick();
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 10));
      f.detectChanges();
    }
    const map = root.querySelector('ui-map') as HTMLElement;
    expect(map.classList).toContain('ui-map-fill');
    expect(f.componentInstance.top()).toBe(80);
    const sheetCover = Math.round(window.innerHeight * 0.25);
    expect(f.componentInstance.bottom()).toBe(sheetCover);
    expect(map.style.getPropertyValue('--ui-map-inset-top')).toBe('80px');
    expect(map.style.getPropertyValue('--ui-map-inset-bottom')).toBe(`${sheetCover}px`);

    // The card's button and the sheet's field still work over the map, after it in focus order.
    (root.querySelector('.cancel') as HTMLButtonElement).click();
    expect(f.componentInstance.cancelled).toBe(1);
    const input = root.querySelector('.addr') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);
    const order = [map.querySelector('.ui-map-canvas')!, root.querySelector('.cancel')!, input];
    for (let i = 1; i < order.length; i++) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Stacking: the map is its own stacking context, the card is positioned above it, the sheet is fixed on the overlay layer.
    const mapCss = readFileSync(join(process.cwd(), 'projects/ui/map/src/map.css'), 'utf8');
    expect(mapCss).toMatch(/\.ui-map \{[^}]*isolation: isolate;/);
    const panelSrc = readFileSync(join(process.cwd(), 'projects/ui/layout/src/floating-panel.ts'), 'utf8');
    expect(panelSrc).toMatch(/position: absolute; z-index: 1;/);
    const sheetSrc = readFileSync(join(process.cwd(), 'projects/ui/dialog/src/bottom-sheet.ts'), 'utf8');
    expect(sheetSrc).toMatch(/\.sheet \{[^}]*position: fixed;[^}]*z-index: var\(--ui-sheet-z, var\(--ui-z-overlay\)\)/);
    f.destroy();
  });

  it('the card reports 0 once it is gone from layout, and nothing after it is destroyed', async () => {
    const f = TestBed.createComponent(PageHost);
    f.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await new Promise((r) => setTimeout(r, 20));
    expect(f.componentInstance.top()).toBe(0); // jsdom: no height, no cover
    f.destroy();
    await new Promise((r) => setTimeout(r, 20)); // a queued measure after destroy must not throw
  });
});
