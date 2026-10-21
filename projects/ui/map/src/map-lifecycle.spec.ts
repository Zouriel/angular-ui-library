import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * 0.35.0: init awaited import('leaflet') and only then registered onDestroy. A map destroyed while
 * Leaflet was loading (leaving the page at once) threw NG0911 "View has already been destroyed" as
 * an unhandled rejection. Leaflet is mocked here behind a gate, so the test decides when it loads.
 */
let release!: () => void;
const gate = new Promise<void>((r) => (release = r));
const created = vi.fn();
const chain = (): Record<string, unknown> => ({ addTo: () => chain(), on: () => chain(), remove: () => {}, clearLayers: () => {}, eachLayer: () => {}, getElement: () => null, options: {} });
const fakeLeaflet = {
  map: (...a: unknown[]) => {
    created(...a);
    return { ...chain(), getCenter: () => ({ lat: 0, lng: 0 }), getZoom: () => 1, getSize: () => ({ x: 0, y: 0 }), invalidateSize: () => {}, setView: () => {}, createPane: () => ({ style: {} }) };
  },
  control: { zoom: () => chain(), attribution: () => chain() },
  layerGroup: () => chain(),
  tileLayer: () => chain(),
  marker: () => chain(),
  divIcon: () => ({}),
};
/** Leaflet arrives when the test says so. */
const gatedLoader = () => gate.then(() => fakeLeaflet);

import { UI_MAP_LEAFLET, UiMap } from './map';

@Component({ imports: [UiMap], template: `@if (show()) { <ui-map /> }` })
class Host {
  show = signal(true);
}

describe('ui-map lifecycle', () => {
  afterEach(() => vi.restoreAllMocks());

  it('can be destroyed while Leaflet is still loading, without an error, and then builds nothing', async () => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    const errors: unknown[] = [];
    const onRejection = (e: PromiseRejectionEvent | unknown) => errors.push(e);
    globalThis.addEventListener?.('unhandledrejection', onRejection as EventListener);
    TestBed.configureTestingModule({ providers: [{ provide: UI_MAP_LEAFLET, useValue: gatedLoader }] });
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    TestBed.inject(ApplicationRef).tick(); // runs afterNextRender: the import starts
    f.componentInstance.show.set(false);
    f.detectChanges(); // the map is destroyed while the import waits
    f.destroy();
    release();
    await gate;
    await new Promise((r) => setTimeout(r, 20));
    expect(created).not.toHaveBeenCalled(); // the gated (fake) Leaflet arrived after destroy: nothing built
    expect(errors).toEqual([]);
    globalThis.removeEventListener?.('unhandledrejection', onRejection as EventListener);
  });

  it('builds the map when Leaflet arrives while it is still shown', async () => {
    created.mockClear();
    TestBed.configureTestingModule({ providers: [{ provide: UI_MAP_LEAFLET, useValue: () => Promise.resolve(fakeLeaflet) }] });
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await new Promise((r) => setTimeout(r, 20));
    expect(created).toHaveBeenCalledTimes(1);
    f.destroy();
  });
});
