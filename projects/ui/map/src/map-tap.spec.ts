import { ApplicationRef, Component, NgZone, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type * as Leaflet from 'leaflet';
import CenterFocusIcon from '@hugeicons/core-free-icons/CenterFocusIcon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiMap, type UiLatLng, type UiMapControl, type UiMapMarker, type UiMapUserLocation } from './map';

/* 0.43.1: mapTap reports only a tap on the map background. */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const C: UiLatLng = { lat: 4.1755, lng: 73.5093 };
const MARKER: UiMapMarker = { id: 'nurse', lat: 4.1762, lng: 73.5105, label: 'Aminath Hassan, RN' };

beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});

@Component({
  imports: [UiMap],
  template: `<ui-map [center]="center" [zoom]="15" [markers]="markers" [pin]="pin()" [pinMode]="pinMode()" [pinDraggable]="pinDraggable()"
    [userLocation]="user()" [preview]="preview()" (previewPress)="previewPresses = previewPresses + 1" locateControl (locate)="locates = locates + 1"
    [controls]="controls" (controlPress)="controlsPressed.push($event.id)" (markerSelected)="selected.push($event.id)"
    (pinChange)="onPinChange($event)" (mapTap)="onMapTap($event)" />`,
})
class Host {
  center = C;
  markers = [MARKER];
  pin = signal<UiLatLng | null>(null);
  pinMode = signal(false);
  pinDraggable = signal(false);
  user = signal<UiMapUserLocation | null>(null);
  preview = signal(false);
  controls: UiMapControl[] = [{ id: 'fit', icon: CenterFocusIcon, label: 'Show both' }];
  taps: UiLatLng[] = [];
  pins: UiLatLng[] = [];
  selected: string[] = [];
  controlsPressed: string[] = [];
  locates = 0;
  previewPresses = 0;

  onMapTap(point: UiLatLng): void {
    this.taps.push(point);
  }

  onPinChange(point: UiLatLng | null): void {
    if (point) this.pins.push(point);
  }
}

async function setup() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const root = f.nativeElement as HTMLElement;
  const canvas = root.querySelector('.ui-map-canvas') as HTMLElement;
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 390 });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 300 });
  canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 300, width: 390, height: 300, toJSON: () => ({}) });
  TestBed.inject(ApplicationRef).tick();
  const cmp = f.debugElement.query(By.directive(UiMap)).componentInstance as UiMap;
  const priv = cmp as unknown as {
    map: Leaflet.Map | null;
    markerById: Map<string, Leaflet.Marker>;
    pinMarker: Leaflet.Marker | null;
    userMarker: Leaflet.Marker | null;
  };
  for (let i = 0; i < 100 && !priv.map; i++) await new Promise((r) => setTimeout(r, 10));
  expect(priv.map).toBeTruthy();
  const settle = async () => {
    f.detectChanges();
    await f.whenStable();
    TestBed.tick();
  };
  return { f, root, canvas, cmp, priv, map: priv.map!, settle };
}

function click(el: Element, x = 120, y = 180): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y, screenX: x, screenY: y }));
}

describe('ui-map mapTap (0.43.1)', () => {
  it('a background click emits once with its point, inside the Angular zone; pinMode also moves the pin', async () => {
    const { f, cmp, map, settle } = await setup();
    const zone = (cmp as unknown as { zone: NgZone }).zone;
    const run = vi.spyOn(zone, 'run');
    const first = map.containerPointToLatLng([120, 180]);
    map.fire('click', { latlng: first });
    expect(f.componentInstance.taps).toEqual([{ lat: first.lat, lng: first.lng }]);
    expect(run).toHaveBeenCalledTimes(1);

    f.componentInstance.pinMode.set(true);
    await settle();
    const second = map.containerPointToLatLng([260, 120]);
    map.fire('click', { latlng: second });
    expect(f.componentInstance.taps).toEqual([{ lat: first.lat, lng: first.lng }, { lat: second.lat, lng: second.lng }]);
    expect(f.componentInstance.pins).toEqual([{ lat: second.lat, lng: second.lng }]);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('a marker click selects the marker but does not emit mapTap', async () => {
    const { f, priv } = await setup();
    click(priv.markerById.get('nurse')!.getElement()!);
    expect(f.componentInstance.selected).toEqual(['nurse']);
    expect(f.componentInstance.taps).toEqual([]);
  });

  it('zoom, locate and app controls, attribution and the pin do not emit mapTap', async () => {
    const { f, root, priv, settle } = await setup();
    click(root.querySelector('.leaflet-control-zoom-in')!);
    click(root.querySelector('.ui-map-locate')!);
    click(root.querySelector('.ui-map-control')!);
    click(root.querySelector('.leaflet-control-attribution')!);
    expect(f.componentInstance.locates).toBe(1);
    expect(f.componentInstance.controlsPressed).toEqual(['fit']);

    f.componentInstance.pin.set({ lat: 4.1745, lng: 73.5085 });
    f.componentInstance.user.set({ lat: 4.177, lng: 73.507 });
    await settle();
    click(priv.pinMarker!.getElement()!);
    expect(f.componentInstance.taps).toEqual([]);
  });

  it('the user dot (its halo can be 240px) is map background: a tap there emits mapTap', async () => {
    const { f, priv, settle } = await setup();
    f.componentInstance.user.set({ lat: 4.177, lng: 73.507 });
    await settle();
    click(priv.userMarker!.getElement()!);
    expect(f.componentInstance.taps.length).toBe(1);
  });

  it('preview emits only previewPress', async () => {
    const { f, root, settle } = await setup();
    f.componentInstance.preview.set(true);
    await settle();
    click(root.querySelector('.ui-map-preview')!);
    expect(f.componentInstance.previewPresses).toBe(1);
    expect(f.componentInstance.taps).toEqual([]);
  });

  it('Leaflet suppresses the click produced after a drag, so it is not a background tap', async () => {
    const { f, canvas, map } = await setup();
    const draggable = (map.dragging as unknown as { _draggable: { _moved: boolean } })._draggable;
    draggable._moved = true;
    click(canvas, 210, 190);
    expect(f.componentInstance.taps).toEqual([]);
    draggable._moved = false;
  });
});
