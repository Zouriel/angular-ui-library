import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type * as Leaflet from 'leaflet';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiMap, type UiLatLng } from './map';

/*
 * 0.44.2: fitPoints / fitArea asked straight after the map is created (before Leaflet has loaded)
 * are held and run once it has, without animating; they used to do nothing (the Dhirumi nurse map).
 */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const MALE: UiLatLng = { lat: 4.1755, lng: 73.5093 };
const HULHUMALE: UiLatLng = { lat: 4.2105, lng: 73.5402 };
const W = 390;
const H = 844;

const original = window.matchMedia;
beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = original;
});

@Component({
  imports: [UiMap],
  template: `<ui-map [center]="center" [zoom]="5" [area]="{ lat: center.lat, lng: center.lng, radiusMeters: 20000 }" />`,
})
class Host {
  center = MALE;
}

async function open(ask: (cmp: UiMap) => void) {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const root = f.nativeElement as HTMLElement;
  const canvas = root.querySelector('.ui-map-canvas') as HTMLElement;
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: W });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: H });
  const cmp = f.debugElement.query(By.directive(UiMap)).componentInstance as UiMap;
  const priv = cmp as unknown as { map: Leaflet.Map | null };
  expect(priv.map, 'asked before Leaflet has loaded').toBeNull();
  ask(cmp);
  TestBed.inject(ApplicationRef).tick();
  for (let i = 0; i < 100 && !priv.map; i++) await new Promise((r) => setTimeout(r, 10));
  f.detectChanges();
  return priv.map!;
}

describe('ui-map fit asked before the map exists (0.44.2)', () => {
  it('fitPoints runs once Leaflet has loaded: both points in view, not the input zoom', async () => {
    const map = await open((cmp) => cmp.fitPoints([MALE, HULHUMALE]));
    expect(map.getZoom()).toBeGreaterThan(10);
    for (const p of [MALE, HULHUMALE]) {
      const s = map.latLngToContainerPoint([p.lat, p.lng]);
      expect(s.x).toBeGreaterThanOrEqual(23);
      expect(s.x).toBeLessThanOrEqual(W - 23);
      expect(s.y).toBeGreaterThanOrEqual(23);
      expect(s.y).toBeLessThanOrEqual(H - 23);
    }
  });

  it('fitArea runs once Leaflet has loaded: the whole 20 km circle in view', async () => {
    const map = await open((cmp) => cmp.fitArea());
    expect(map.getZoom()).toBeGreaterThan(5);
    const b = map.getBounds();
    // 20 km east and west of Malé (0.18° of longitude) and north and south (0.18° of latitude).
    expect(b.getWest()).toBeLessThanOrEqual(MALE.lng - 0.17);
    expect(b.getEast()).toBeGreaterThanOrEqual(MALE.lng + 0.17);
    expect(b.getSouth()).toBeLessThanOrEqual(MALE.lat - 0.17);
    expect(b.getNorth()).toBeGreaterThanOrEqual(MALE.lat + 0.17);
  });
});
