import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UI_MAP_LEAFLET, UiMap, type UiLatLng, type UiMapMarker } from './map';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

/** A fake Leaflet that records what ui-map asks of it. */
function recorder() {
  const calls: Record<string, unknown[][]> = {};
  const note = (k: string, ...a: unknown[]) => (calls[k] ??= []).push(a);
  const el = document.createElement('div');
  const chain = (): Record<string, unknown> => ({ addTo: () => chain(), on: () => chain(), remove: () => {}, clearLayers: () => {}, eachLayer: () => {}, getElement: () => el, options: {}, setLatLng: () => {} });
  const L = {
    map: () => ({ ...chain(), getCenter: () => ({ lat: 0, lng: 0 }), getZoom: () => 1, getSize: () => ({ x: 0, y: 0 }), invalidateSize: () => {}, setView: () => {}, createPane: () => ({ style: {} }) }),
    control: { zoom: (o: unknown) => (note('zoom', o), chain()), attribution: () => chain() },
    layerGroup: () => chain(),
    tileLayer: (u: unknown, o: unknown) => (note('tileLayer', u, o), chain()),
    marker: (ll: unknown, o: { draggable?: boolean }) => {
      note('marker', ll, o);
      // Like Leaflet: addTo returns the marker itself.
      const m: Record<string, unknown> = { ...chain(), options: o };
      m['addTo'] = () => m;
      return m;
    },
    divIcon: () => ({}),
  };
  return { L, calls, pinEl: el };
}

@Component({
  imports: [UiMap],
  template: `<ui-map [markers]="markers" [pin]="pin()" [pinDraggable]="drag()" ariaLabel="Nurses near you" />`,
})
class Host {
  markers: UiMapMarker[] = [{ id: 'n1', lat: 1, lng: 2 }, { id: 'n2', lat: 1, lng: 2, label: 'Busy', ariaLabel: 'Busy nurse' }];
  pin = signal<UiLatLng | null>({ lat: 1, lng: 2 });
  drag = signal(true);
}

async function setup() {
  const r = recorder();
  TestBed.configureTestingModule({ providers: [{ provide: UI_MAP_LEAFLET, useValue: () => Promise.resolve(r.L) }] });
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  TestBed.inject(ApplicationRef).tick();
  await new Promise((res) => setTimeout(res, 20));
  return { f, ...r };
}

describe('ui-map options', () => {
  it('asks the tiles for a Referer, names the zoom buttons from the built-in strings, labels the map surface', async () => {
    const { f, calls } = await setup();
    expect((calls['tileLayer'][0][1] as { referrerPolicy: string }).referrerPolicy).toBe('strict-origin-when-cross-origin');
    expect(calls['zoom'][0][0]).toMatchObject({ zoomInTitle: 'Zoom in', zoomOutTitle: 'Zoom out' });
    expect((f.nativeElement as HTMLElement).querySelector('.ui-map-canvas')!.getAttribute('aria-label')).toBe('Nurses near you');
  });

  it('names markers by ariaLabel, else label (never the id)', async () => {
    const { calls } = await setup();
    const opts = calls['marker'].map((c) => c[1] as { title: string; alt: string; zIndexOffset?: number }).filter((o) => o.zIndexOffset === undefined);
    expect(opts.map((o) => o.alt)).toEqual(['', 'Busy nurse']);
  });

  it('a fixed pin (pinDraggable false) is not draggable nor focusable, but still named', async () => {
    const { f, calls, pinEl } = await setup();
    const pinOpts = () => calls['marker'].map((c) => c[1] as { draggable?: boolean; keyboard?: boolean; zIndexOffset?: number }).filter((o) => o.zIndexOffset === 1000).at(-1)!;
    expect(pinOpts().draggable).toBe(true);
    f.componentInstance.drag.set(false);
    f.detectChanges();
    await f.whenStable();
    TestBed.tick();
    expect([pinOpts().draggable, pinOpts().keyboard]).toEqual([false, false]);
    expect([pinEl.getAttribute('role'), pinEl.getAttribute('aria-label')]).toEqual(['img', 'Chosen location']);
  });

  it('is its own stacking context, so panels over it are not hidden behind Leaflet panes', () => {
    const css = readFileSync(join(process.cwd(), 'projects/ui/map/src/map.css'), 'utf8');
    expect(css).toMatch(/\.ui-map \{[^}]*isolation: isolate;/);
  });
});
