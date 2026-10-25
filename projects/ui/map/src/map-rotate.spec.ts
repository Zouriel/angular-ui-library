import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type * as Leaflet from 'leaflet';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiStringsService, uiStringsDv } from '@zouriel/ui';
import { UI_MAP_LEAFLET, UiMap, uiMapIsTurned, uiMapTwoFingerGesture, type UiMapMarker } from './map';

/*
 * 0.47.0: the person turns the map: two fingers (past 15 degrees before the pinch zooms 10% or pans
 * 30 px), Alt + drag with a mouse, and the compass that turns it back. On the real Leaflet in jsdom
 * (no layout: the canvas is sized by hand, so client coordinates are canvas coordinates).
 */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

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
  template: `<ui-map [center]="{ lat: 4.1755, lng: 73.5093 }" [zoom]="15" [markers]="markers" [rotatable]="rotatable()" [compass]="compass()"
    (userMove)="moves = moves + 1" (bearingChange)="bearings.push($event)" />`,
})
class Host {
  markers: UiMapMarker[] = [{ id: 'p', lat: 4.176, lng: 73.51, label: 'Lily Magu' }];
  rotatable = signal(true);
  compass = signal(true);
  moves = 0;
  bearings: number[] = [];
}

const leaflet = async () => {
  const mod = (await import('leaflet')) as unknown as { default?: typeof Leaflet } & typeof Leaflet;
  ((mod.default ?? mod).Browser as { svg: boolean }).svg = true;
  return mod;
};

async function setup(init?: (h: Host) => void) {
  TestBed.configureTestingModule({ providers: [{ provide: UI_MAP_LEAFLET, useValue: leaflet }] });
  const f = TestBed.createComponent(Host);
  init?.(f.componentInstance);
  f.detectChanges();
  const root = f.nativeElement as HTMLElement;
  const canvas = root.querySelector('.ui-map-canvas') as HTMLElement;
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 390 });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 844 });
  TestBed.inject(ApplicationRef).tick();
  const cmp = f.debugElement.query(By.directive(UiMap)).componentInstance as UiMap;
  const priv = cmp as unknown as { map: Leaflet.Map | null; turn: number; rotor: HTMLElement | null };
  for (let i = 0; i < 100 && !priv.map; i++) await new Promise((r) => setTimeout(r, 10));
  expect(priv.map).toBeTruthy();
  const settle = async () => {
    f.detectChanges();
    await f.whenStable();
  };
  /** Two fingers: a touch event with these points. */
  const touch = (type: string, pts: [number, number][]) => {
    const touches = pts.map(([x, y], i) => ({ identifier: i, clientX: x, clientY: y, target: canvas }));
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'touches', { value: touches });
    Object.defineProperty(e, 'targetTouches', { value: touches });
    Object.defineProperty(e, 'changedTouches', { value: touches });
    canvas.dispatchEvent(e);
  };
  /** Fingers `r` px either side of (cx, cy) at `deg` degrees. */
  const fingers = (deg: number, r = 80, cx = 195, cy = 400): [number, number][] => {
    const a = (deg * Math.PI) / 180;
    return [[cx - r * Math.cos(a), cy - r * Math.sin(a)], [cx + r * Math.cos(a), cy + r * Math.sin(a)]];
  };
  const compassBox = () => root.querySelector('.ui-map-compass-bar') as HTMLElement;
  return { f, cmp, priv, settle, touch, fingers, compassBox, canvas, root };
}

describe('ui-map turning (0.47.0)', () => {
  it('the race: a 15 degree twist turns, a 10% pinch or 30 px pan first does not', () => {
    expect(uiMapTwoFingerGesture(16, 1, 0)).toBe('rotate');
    expect(uiMapTwoFingerGesture(-15, 1.05, 10)).toBe('rotate');
    expect(uiMapTwoFingerGesture(10, 1.12, 0)).toBe('pinch');
    expect(uiMapTwoFingerGesture(10, 0.88, 0)).toBe('pinch');
    expect(uiMapTwoFingerGesture(5, 1, 31)).toBe('pinch');
    expect(uiMapTwoFingerGesture(10, 1.05, 10)).toBe('undecided');
    expect([uiMapIsTurned(0), uiMapIsTurned(0.4), uiMapIsTurned(359.8), uiMapIsTurned(10), uiMapIsTurned(-90)]).toEqual([false, false, false, true, true]);
  });

  it('two fingers twisting turn the map with them, keep markers upright, and say so', async () => {
    const { f, priv, settle, touch, fingers, compassBox, root } = await setup();
    expect(compassBox().hidden).toBe(true);
    touch('touchstart', fingers(0));
    touch('touchmove', fingers(10));
    expect(priv.turn).toBe(0); // under the threshold: nothing yet
    touch('touchmove', fingers(20));
    touch('touchmove', fingers(40));
    // Fingers turned 40 degrees clockwise: the map too, so north is now 40 degrees clockwise: bearing 320.
    expect(priv.turn).toBeCloseTo(-40, 6);
    expect(priv.rotor!.style.transform).toBe('rotate(40deg)');
    expect(priv.rotor!.hasAttribute('data-animate')).toBe(false); // it follows the fingers, no easing
    expect((root.querySelector('.ui-map-marker') as HTMLElement).style.transform).toMatch(/rotate\(-40deg\)$/);
    touch('touchend', []);
    await settle();
    expect(f.componentInstance.moves).toBe(1);
    expect(f.componentInstance.bearings).toEqual([320]);
    expect(compassBox().hidden).toBe(false);
    expect(compassBox().querySelector('svg')!.style.transform).toBe('rotate(40deg)'); // the needle points north
  });

  it('a small twist during a pinch does not turn the map (the zoom won)', async () => {
    const { f, priv, settle, touch, fingers } = await setup();
    touch('touchstart', fingers(0, 80));
    touch('touchmove', fingers(8, 92)); // 15% wider, 8 degrees: a zoom
    touch('touchmove', fingers(30, 100)); // more twist later: still the zoom's gesture
    touch('touchend', []);
    await settle();
    expect(priv.turn).toBe(0);
    expect(f.componentInstance.bearings).toEqual([]);
  });

  it('rotatable false: no turning', async () => {
    const { priv, touch, fingers } = await setup((h) => h.rotatable.set(false));
    touch('touchstart', fingers(0));
    touch('touchmove', fingers(40));
    touch('touchend', []);
    expect(priv.turn).toBe(0);
  });

  it('the compass: named from the strings, in the zoom corner, turns back to north and hides', async () => {
    const { f, cmp, priv, settle, compassBox, root } = await setup();
    cmp.rotateTo(90);
    await settle();
    const box = compassBox();
    expect(box.hidden).toBe(false);
    // In the zoom buttons' corner, under them (the same stack and style).
    const corner = root.querySelector('.leaflet-top.leaflet-left')!;
    expect([...corner.children].map((c) => c.classList.contains('ui-map-compass-bar') ? 'compass' : c.classList.contains('leaflet-control-zoom') ? 'zoom' : '?')).toEqual(['zoom', 'compass']);
    const a = box.querySelector('a')!;
    expect([a.getAttribute('role'), a.getAttribute('aria-label')]).toEqual(['button', 'Reset to north']);
    a.click();
    await settle();
    expect(((priv.turn % 360) + 360) % 360).toBe(0);
    expect(f.componentInstance.bearings).toEqual([0]);
    expect(box.hidden).toBe(true);
    TestBed.inject(UiStringsService).set(uiStringsDv);
    cmp.rotateTo(45);
    await settle();
    expect(a.getAttribute('aria-label')).toBe('އުތުރު މައްޗަށް ގެންނާ');
    TestBed.inject(UiStringsService).set({});
  });

  it('compass false: never shown', async () => {
    const { cmp, settle, compassBox } = await setup((h) => h.compass.set(false));
    cmp.rotateTo(90);
    await settle();
    expect(compassBox().hidden).toBe(true);
  });

  it('Alt + drag with a mouse turns the map about the middle', async () => {
    const { f, priv, settle, canvas } = await setup();
    const fire = (type: string, x: number, y: number, target: EventTarget = canvas) => {
      const e = Object.assign(new MouseEvent(type, { clientX: x, clientY: y, altKey: true, button: 0, bubbles: true, cancelable: true }), { pointerType: 'mouse', pointerId: 1 });
      target.dispatchEvent(e);
    };
    // A quarter turn clockwise around the middle (195, 422).
    fire('pointerdown', 295, 422);
    fire('pointermove', 195 + 100 * Math.cos(Math.PI / 4), 422 + 100 * Math.sin(Math.PI / 4), window);
    fire('pointermove', 195, 522, window);
    fire('pointerup', 195, 522, window);
    await settle();
    expect(priv.turn).toBeCloseTo(-90, 6);
    expect(f.componentInstance.bearings).toEqual([270]);
    expect(f.componentInstance.moves).toBe(1);
  });
});
