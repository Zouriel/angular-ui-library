import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as Leaflet from 'leaflet';
import { describe, expect, it } from 'vitest';
import { UI_MAP_LEAFLET, UiMap, UiMapFeatureDetails, type UiLatLng, type UiMapFeatureSelection, type UiMapGeometry, type UiMapLayer } from './map';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const CENTER: UiLatLng = { lat: 4.1755, lng: 73.5093 };
const feature = (title: string, geometry: UiMapGeometry): GeoJSON.Feature<UiMapGeometry> => ({ type: 'Feature', properties: { title }, geometry });
const layers = (): UiMapLayer[] => [
  { id: 'places', label: 'Places', tone: 'info', features: { type: 'FeatureCollection', features: [
    feature('Morrow Library', { type: 'Point', coordinates: [73.5093, 4.1755] }),
    feature('Lantern Walk', { type: 'LineString', coordinates: [[73.501, 4.171], [73.515, 4.181]] }),
  ] } },
  { id: 'parks', label: 'Parks', tone: 'success', visible: false, features: { type: 'FeatureCollection', features: [
    feature('Seaside Park', { type: 'Polygon', coordinates: [[[73.50, 4.17], [73.52, 4.17], [73.52, 4.19], [73.50, 4.17]]] }),
  ] } },
];

@Component({
  imports: [UiMap, UiMapFeatureDetails],
  template: `<ui-map [center]="center" [layers]="layers()" layerControl [visibleLayers]="visible()"
    (visibleLayersChange)="visible.set($event)" (featureSelected)="selection.set($event)" [drawMode]="mode()" [editGeometry]="edit()" (drawn)="drawn.set($event)" (drawCancelled)="cancelled = cancelled + 1">
    <ng-template uiMapFeatureDetails let-selection><span class="detail">{{ selection.feature.properties?.['title'] }}</span></ng-template>
  </ui-map>`,
})
class Host {
  center = CENTER;
  layers = signal<UiMapLayer[]>(layers());
  visible = signal<string[]>(['places']);
  selection = signal<UiMapFeatureSelection | null>(null);
  mode = signal<'none' | 'point' | 'line' | 'area'>('none');
  edit = signal<GeoJSON.Geometry | null>(null);
  drawn = signal<GeoJSON.Geometry | null>(null);
  cancelled = 0;
}

async function setup(init?: (host: Host) => void) {
  TestBed.configureTestingModule({ providers: [{ provide: UI_MAP_LEAFLET, useValue: async () => {
    const mod = (await import('leaflet')) as unknown as { default?: typeof Leaflet } & typeof Leaflet;
    ((mod.default ?? mod).Browser as { svg: boolean }).svg = true;
    return mod;
  } }] });
  const fixture = TestBed.createComponent(Host);
  init?.(fixture.componentInstance);
  fixture.detectChanges();
  const canvas = (fixture.nativeElement as HTMLElement).querySelector('.ui-map-canvas') as HTMLElement;
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 320 });
  TestBed.inject(ApplicationRef).tick();
  const component = fixture.debugElement.query(By.directive(UiMap)).componentInstance as UiMap;
  const mapOf = () => (component as unknown as { map: Leaflet.Map | null }).map;
  for (let i = 0; i < 100 && !mapOf(); i++) await new Promise((resolve) => setTimeout(resolve, 5));
  await fixture.whenStable();
  return { fixture, host: fixture.nativeElement as HTMLElement, component, map: mapOf()! };
}

function key(el: Element, keyName: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('ui-map GeoJSON layers, selection and drawing', () => {
  it('renders visible point, line and area layers with tone data, hides false layers, and updates in place', async () => {
    const { fixture, host, component } = await setup();
    expect(host.querySelectorAll('.ui-map-geo-marker').length).toBe(1);
    expect(host.querySelectorAll('path.ui-map-feature-path').length).toBe(1);
    expect(host.querySelector('.ui-map-geo-marker [data-tone="info"]')).toBeTruthy();
    expect(host.querySelector('path.ui-map-feature-path')?.getAttribute('data-tone')).toBe('info');
    expect(host.querySelector('[aria-label="Seaside Park"]')).toBeNull();
    const map = (component as unknown as { map: Leaflet.Map }).map;
    fixture.componentInstance.visible.set(['parks']);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.querySelector('.ui-map-geo-marker')).toBeNull();
    expect(host.querySelector('[aria-label="Seaside Park"]')).toBeTruthy();
    expect(host.querySelector('path.ui-map-feature-path')?.getAttribute('data-tone')).toBe('success');
    fixture.componentInstance.layers.set([{ ...layers()[0], features: { ...layers()[0].features, features: [layers()[0].features.features[0]] } }, layers()[1]]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect((component as unknown as { map: Leaflet.Map }).map).toBe(map);
    expect(host.querySelectorAll('path.ui-map-feature-path').length).toBe(1);
  });

  it('renders labels and counts, emits visibility changes, and toggles a layer with Space', async () => {
    const { fixture, host } = await setup();
    expect([...host.querySelectorAll('.ui-map-layer-label')].map((el) => el.textContent?.trim())).toEqual(['Places', 'Parks']);
    expect([...host.querySelectorAll('.ui-map-layer-count')].map((el) => el.textContent?.trim())).toEqual(['2', '1']);
    const checkbox = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.visible()).toEqual([]);
    expect(host.querySelector('.ui-map-geo-marker')).toBeNull();
    key(checkbox, ' ');
    fixture.detectChanges();
    expect(fixture.componentInstance.visible()).toEqual(['places']);
    expect((host.querySelectorAll('input')[1] as HTMLInputElement).checked).toBe(false);
  });

  it('places the RTL legend at the inline-start corner', () => {
    const css = readFileSync(join(process.cwd(), 'projects/ui/map/src/map.css'), 'utf8');
    expect(css).toMatch(/\.ui-map \.ui-map-layer-control \{[^}]*inset-inline-start:/);
  });

  it('selects by click and keyboard, highlights it, projects details, and clears on Escape or close', async () => {
    const { fixture, host } = await setup();
    const path = host.querySelector('path.ui-map-feature-path') as SVGPathElement;
    path.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.selection()?.layerId).toBe('places');
    expect(path.hasAttribute('data-selected')).toBe(true);
    expect(host.querySelector('.detail')?.textContent).toContain('Lantern Walk');
    key(path, 'Escape');
    expect(fixture.componentInstance.selection()).toBeNull();

    fixture.componentInstance.visible.set(['places']);
    fixture.detectChanges();
    await fixture.whenStable();
    const feature = host.querySelector('.ui-map-geo-marker') as HTMLElement;
    expect(feature.tabIndex).toBe(0);
    key(feature, ' ');
    fixture.detectChanges();
    expect(fixture.componentInstance.selection()?.feature.properties?.['title']).toBe('Morrow Library');
    expect(host.querySelector('.detail')?.textContent).toContain('Morrow Library');
    (host.querySelector('.ui-map-feature-details-close') as HTMLButtonElement).click();
    expect(fixture.componentInstance.selection()).toBeNull();
  });

  it('draws point, line and closed area geometries, with undo and cancel', async () => {
    const { fixture, map, host } = await setup();
    fixture.componentInstance.mode.set('point');
    fixture.detectChanges();
    map.fire('click', { latlng: (await import('leaflet')).latLng(4.18, 73.52) });
    fixture.detectChanges();
    expect(fixture.componentInstance.drawn()?.type).toBe('Point');
    expect((fixture.componentInstance.drawn() as GeoJSON.Point).coordinates).toEqual([73.52, 4.18]);

    fixture.componentInstance.mode.set('line');
    fixture.componentInstance.drawn.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    const L = await import('leaflet');
    map.fire('click', { latlng: L.latLng(4.18, 73.52) });
    map.fire('click', { latlng: L.latLng(4.19, 73.53) });
    key(host.querySelector('.ui-map-canvas')!, 'Enter');
    expect(fixture.componentInstance.drawn()?.type).toBe('LineString');

    fixture.componentInstance.mode.set('area');
    fixture.componentInstance.drawn.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    for (const [lat, lng] of [[4.18, 73.52], [4.19, 73.53], [4.18, 73.54]]) map.fire('click', { latlng: L.latLng(lat, lng) });
    map.fire('dblclick', { latlng: L.latLng(4.18, 73.54), originalEvent: new MouseEvent('dblclick') });
    const ring = (fixture.componentInstance.drawn() as GeoJSON.Polygon).coordinates[0];
    expect(ring[0]).toEqual(ring.at(-1));

    fixture.componentInstance.mode.set('line');
    fixture.componentInstance.drawn.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    map.fire('click', { latlng: L.latLng(4.18, 73.52) });
    map.fire('click', { latlng: L.latLng(4.19, 73.53) });
    key(host.querySelector('.ui-map-canvas')!, 'Backspace');
    fixture.detectChanges();
    expect(host.querySelector('.ui-map-drawing-status')?.textContent).toContain('1 point');
    key(host.querySelector('.ui-map-canvas')!, 'Escape');
    fixture.detectChanges();
    expect(fixture.componentInstance.cancelled).toBe(1);
    fixture.componentInstance.mode.set('none');
    fixture.detectChanges();
    expect(host.querySelector('.ui-map-drawing-controls')).toBeNull();
  });

  it('shows editGeometry and emits it on Finish; drawMode none ignores clicks', async () => {
    const { fixture, map, host } = await setup();
    const L = await import('leaflet');
    map.fire('click', { latlng: L.latLng(4.18, 73.52) });
    expect(fixture.componentInstance.drawn()).toBeNull();
    const geometry: GeoJSON.LineString = { type: 'LineString', coordinates: [[73.52, 4.18], [73.53, 4.19]] };
    fixture.componentInstance.edit.set(geometry);
    fixture.detectChanges();
    expect(host.querySelector('.ui-map-drawing-controls')).toBeTruthy();
    (host.querySelectorAll('.ui-map-drawing-controls button')[1] as HTMLButtonElement).click();
    expect(fixture.componentInstance.drawn()).toEqual(geometry);
  });
});
