import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as Leaflet from 'leaflet';
import CenterFocusIcon from '@hugeicons/core-free-icons/CenterFocusIcon';
import { UI_STRINGS, defaultUiStrings } from '@zouriel/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiMap, uiMapLabelShown, UI_MAP_SELECTED_DOT, type UiLatLng, type UiMapControl, type UiMapMarker, type UiMapMarkerLabels } from './map';

/*
 * 0.43.0: the preview map (a still picture that is one button), the selected marker, and the
 * marker label modes. On the real Leaflet; jsdom has no layout, so the canvas is given a size.
 */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const C: UiLatLng = { lat: 4.1755, lng: 73.5093 };
const MARKERS: UiMapMarker[] = [
  { id: 'a', lat: 4.1762, lng: 73.5105, label: 'Aminath Hassan, RN', tone: 'success' },
  { id: 'b', lat: 4.1738, lng: 73.5072, label: 'Ibrahim Rasheed, RN' },
  { id: 'c', lat: 4.1781, lng: 73.5068, label: 'Busy', tone: 'warning', ariaLabel: 'Busy nurse' },
];
const css = () => readFileSync(join(process.cwd(), 'projects/ui/map/src/map.css'), 'utf8');
const rule = (selector: string) => {
  const m = css().match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`));
  expect(m, selector).toBeTruthy();
  return m![1];
};
const prop = (block: string, p: string) => block.match(new RegExp(`(?:^|[\\s;])${p}:\\s*([^;]+);`))?.[1].trim();

let reduce = true;
beforeEach(() => {
  reduce = true;
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce') && reduce, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});

@Component({
  imports: [UiMap],
  template: `<ui-map [center]="center" [zoom]="15" [markers]="markers()" [preview]="preview()" [previewLabel]="label()" (previewPress)="presses = presses + 1"
    [selectedMarkerId]="selected()" [markerLabels]="labels()" (markerSelected)="picked.push($event.id)"
    locateControl [controls]="controls" (controlPress)="0" [style.direction]="dir()" />`,
})
class Host {
  center = C;
  markers = signal<UiMapMarker[]>(MARKERS);
  preview = signal(true);
  label = signal<string | null>(null);
  selected = signal<string | null>(null);
  labels = signal<UiMapMarkerLabels>('all');
  dir = signal<'ltr' | 'rtl'>('ltr');
  controls: UiMapControl[] = [{ id: 'fit', icon: CenterFocusIcon, label: 'Show both' }];
  presses = 0;
  picked: string[] = [];
}

async function setup(init?: (h: Host) => void) {
  const f = TestBed.createComponent(Host);
  init?.(f.componentInstance);
  f.detectChanges();
  const root = f.nativeElement as HTMLElement;
  const canvas = root.querySelector('.ui-map-canvas') as HTMLElement;
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 390 });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 300 });
  TestBed.inject(ApplicationRef).tick();
  const cmp = f.debugElement.query(By.directive(UiMap)).componentInstance as UiMap;
  const priv = cmp as unknown as { map: Leaflet.Map | null; markerById: Map<string, Leaflet.Marker> };
  for (let i = 0; i < 100 && !priv.map; i++) await new Promise((r) => setTimeout(r, 10));
  const map = priv.map!;
  expect(map).toBeTruthy();
  const settle = async () => {
    f.detectChanges();
    await f.whenStable();
    TestBed.tick();
  };
  const host = root.querySelector('ui-map') as HTMLElement;
  const marker = (id: string) => priv.markerById.get(id)!;
  const markerEl = (id: string) => marker(id).getElement()!;
  return { f, cmp, map, host, canvas, settle, marker, markerEl };
}

const handlers = (map: Leaflet.Map) => ({
  dragging: map.dragging.enabled(),
  touchZoom: map.touchZoom.enabled(),
  doubleClickZoom: map.doubleClickZoom.enabled(),
  scrollWheelZoom: map.scrollWheelZoom.enabled(),
  boxZoom: map.boxZoom.enabled(),
  keyboard: map.keyboard.enabled(),
});
const allOff = { dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false, boxZoom: false, keyboard: false };
const allOn = { dragging: true, touchZoom: true, doubleClickZoom: true, scrollWheelZoom: true, boxZoom: true, keyboard: true };

/** Presses an arrow key on the map's surface (the full map pans on it). */
const arrow = (canvas: HTMLElement) => {
  // Leaflet listens for keys once its surface has focus.
  canvas.focus();
  canvas.dispatchEvent(new FocusEvent('focus'));
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, bubbles: true }));
};
const wheel = (el: Element) => {
  const e = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e.defaultPrevented;
};

describe('ui-map preview (0.43.0)', () => {
  it('a still picture: every gesture and key handler off, no zoom/locate/app buttons, the canvas inert and hidden, markers not selectable', async () => {
    const { f, map, host, canvas, settle, markerEl } = await setup();
    expect(host.hasAttribute('data-preview')).toBe(true);
    expect(handlers(map)).toEqual(allOff);
    expect(host.querySelector('.leaflet-control-zoom')).toBeNull();
    expect(host.querySelector('.ui-map-locate')).toBeNull();
    expect(host.querySelector('.ui-map-controls')).toBeNull();
    expect(canvas.hasAttribute('inert')).toBe(true);
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    // The credits stay drawn (the tile licence).
    expect(host.querySelector('.leaflet-control-attribution')?.textContent).toContain('OpenStreetMap');
    // Arrow keys leave it where it is.
    const before = map.getCenter();
    arrow(canvas);
    // Leaflet animates the pan a frame at a time.
    await new Promise((r) => setTimeout(r, 400));
    await settle();
    expect(map.getCenter().equals(before)).toBe(true);
    // Markers are drawn, under the button: a click lands on the button (z-index above every pane).
    expect(host.querySelectorAll('.ui-map-marker').length).toBe(3);
    expect(Number(prop(rule('.ui-map .ui-map-preview'), 'z-index'))).toBeGreaterThan(1000);
    expect(prop(rule('.ui-map .ui-map-preview'), 'inset')).toBe('0');
    expect(markerEl('a').closest('[inert]')).toBe(canvas);
    expect(f.componentInstance.picked).toEqual([]);
  });

  it('the wheel over it is never cancelled, so the page scrolls (the full map does cancel it, to zoom)', async () => {
    const { f, host, canvas, settle } = await setup();
    const button = host.querySelector('.ui-map-preview')!;
    expect(wheel(button)).toBe(false);
    expect(wheel(canvas)).toBe(false);
    // Touch: the button lets the browser pan and zoom the page (no touch-action: none).
    expect(prop(rule('.ui-map .ui-map-preview'), 'touch-action')).toBe('manipulation');
    f.componentInstance.preview.set(false);
    await settle();
    expect(wheel(canvas)).toBe(true);
    // Let Leaflet's wheel zoom (it waits 40ms) land before the map is torn down.
    await new Promise((r) => setTimeout(r, 150));
  });

  it('is one native button named Open map; a click emits one previewPress (Enter and Space are the button’s own click)', async () => {
    const { f, host } = await setup();
    const buttons = host.querySelectorAll('button');
    expect(buttons.length).toBe(1);
    const b = buttons[0] as HTMLButtonElement;
    expect([b.type, b.className, b.getAttribute('aria-label')]).toEqual(['button', 'ui-map-preview', 'Open map']);
    b.click();
    expect(f.componentInstance.presses).toBe(1);
    // No key handler of its own on top of the native activation (which would press twice).
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    b.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    expect(f.componentInstance.presses).toBe(1);
    // The badge is drawn inside it, not a control of its own.
    const badge = b.querySelector('.ui-map-preview-badge')!;
    expect(badge.getAttribute('aria-hidden')).toBe('true');
    expect(badge.querySelector('hugeicons-icon')).toBeTruthy();
  });

  it('the name comes from previewLabel, else the mapOpen string (so apps can translate it)', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: UI_STRINGS, useValue: { ...defaultUiStrings, mapOpen: 'OpenMapDV' } }] });
    const { f, host, settle } = await setup();
    expect(host.querySelector('.ui-map-preview')!.getAttribute('aria-label')).toBe('OpenMapDV');
    f.componentInstance.label.set('See 3 nurses on the map');
    await settle();
    expect(host.querySelector('.ui-map-preview')!.getAttribute('aria-label')).toBe('See 3 nurses on the map');
  });

  it('pointer cursor, a subtle press wash, the focus ring inside the edge, and the badge at the top-end corner in the controls’ raised style', () => {
    const b = rule('.ui-map .ui-map-preview');
    expect(prop(b, 'cursor')).toBe('pointer');
    expect(prop(rule('.ui-map .ui-map-preview:active'), 'background')).toBe('color-mix(in srgb, var(--ui-color-text) 8%, transparent)');
    expect(prop(rule('.ui-map .ui-map-preview:focus-visible'), 'box-shadow')).toBe('inset 0 0 0 2px var(--ui-color-bg), inset 0 0 0 4px var(--ui-color-border-focus)');
    const badge = rule('.ui-map .ui-map-preview-badge');
    const locate = rule('.ui-map .ui-map-locate');
    for (const p of ['background', 'border', 'box-shadow']) expect(prop(badge, p), p).toBe(prop(locate, p));
    expect([prop(badge, 'top'), prop(badge, 'inset-inline-end'), prop(badge, 'width'), prop(badge, 'height'), prop(badge, 'border-radius')]).toEqual([
      'var(--ui-space-2)', 'var(--ui-space-2)', 'var(--ui-size-md)', 'var(--ui-size-md)', '50%',
    ]);
    // Logical, so RTL puts it top-left: no physical left/right.
    expect(prop(badge, 'right')).toBeUndefined();
    expect(prop(badge, 'left')).toBeUndefined();
  });

  it('turning preview off gives the full map back, and on again takes it away, on the same map', async () => {
    const { f, map, host, canvas, settle, markerEl } = await setup();
    f.componentInstance.preview.set(false);
    await settle();
    const cmp = f.debugElement.query(By.directive(UiMap)).componentInstance as unknown as { map: Leaflet.Map };
    expect(cmp.map).toBe(map);
    expect(handlers(map)).toEqual(allOn);
    expect(host.querySelector('.leaflet-control-zoom')).toBeTruthy();
    expect(host.querySelector('.ui-map-locate')).toBeTruthy();
    expect(host.querySelector('.ui-map-controls')).toBeTruthy();
    expect(host.querySelector('.ui-map-preview')).toBeNull();
    expect(host.hasAttribute('data-preview')).toBe(false);
    expect(canvas.hasAttribute('inert')).toBe(false);
    expect(canvas.hasAttribute('aria-hidden')).toBe(false);
    // The keys pan it, and markers select.
    const before = map.getCenter();
    arrow(canvas);
    // Leaflet animates the pan a frame at a time.
    await new Promise((r) => setTimeout(r, 400));
    await settle();
    expect(map.getCenter().equals(before)).toBe(false);
    markerEl('a').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(f.componentInstance.picked).toEqual(['a']);
    f.componentInstance.preview.set(true);
    await settle();
    expect(handlers(map)).toEqual(allOff);
    expect(host.querySelector('.leaflet-control-zoom')).toBeNull();
    expect(canvas.hasAttribute('inert')).toBe(true);
  });

  it('center, zoom and fitPoints still place it, without animating (even with motion on)', async () => {
    reduce = false;
    const { cmp, map } = await setup();
    const setView = vi.spyOn(map, 'setView');
    cmp.fitPoints([{ lat: 4.2, lng: 73.5 }, { lat: 4.16, lng: 73.53 }]);
    expect(setView).toHaveBeenCalledTimes(1);
    expect(setView.mock.calls[0][2]).toMatchObject({ animate: false });
    cmp.flyTo({ lat: 4.18, lng: 73.51 }, 14);
    expect(setView.mock.calls[1][2]).toMatchObject({ animate: false });
  });
});

describe('ui-map selected marker (0.43.0)', () => {
  it('the selected one is marked, raised above the others and aria-pressed; the others aria-pressed false', async () => {
    const { marker, markerEl } = await setup((h) => {
      h.preview.set(false);
      h.selected.set('b');
    });
    expect(markerEl('b').hasAttribute('data-selected')).toBe(true);
    expect(markerEl('b').getAttribute('aria-pressed')).toBe('true');
    expect(marker('b').options.zIndexOffset).toBe(500);
    for (const id of ['a', 'c']) {
      expect(markerEl(id).hasAttribute('data-selected'), id).toBe(false);
      expect(markerEl(id).getAttribute('aria-pressed'), id).toBe('false');
      expect(marker(id).options.zIndexOffset, id).toBe(0);
    }
    // On top: Leaflet stacks markers by z-index (their latitude's pixel plus the offset).
    const z = (id: string) => Number(markerEl(id).style.zIndex);
    expect(z('b')).toBeGreaterThan(Math.max(z('a'), z('c')));
  });

  it('is drawn 22px (about 1.35x the 16px dot) with a white ring and a halo in its tone, still centred on its point', () => {
    expect(UI_MAP_SELECTED_DOT).toBe(22);
    const dot = rule('.ui-map .ui-map-marker[data-selected] .ui-map-dot');
    expect([prop(dot, 'width'), prop(dot, 'height'), prop(dot, 'border-color')]).toEqual(['22px', '22px', 'var(--ui-color-location-ring)']);
    expect(prop(dot, 'box-shadow')).toBe('0 0 0 6px color-mix(in srgb, var(--ui-map-dot-tone) 30%, transparent), var(--ui-shadow-2)');
    expect(rule('.ui-map .ui-map-marker[data-selected]')).toContain('margin: -11px 0 0 -11px !important');
    // The tone reaches the halo through --ui-map-dot-tone.
    expect(prop(rule('.ui-map .ui-map-dot[data-tone="success"]'), '--ui-map-dot-tone')).toBe('var(--ui-color-success)');
    expect(prop(rule('.ui-map .ui-map-dot'), 'background')).toBe('var(--ui-map-dot-tone)');
  });

  it('changing it updates the markers in place: the same map and marker elements, the view unmoved', async () => {
    const { f, map, settle, markerEl } = await setup((h) => {
      h.preview.set(false);
      h.selected.set('a');
    });
    const els = ['a', 'b', 'c'].map(markerEl);
    const before = map.getCenter();
    f.componentInstance.selected.set('c');
    await settle();
    expect(['a', 'b', 'c'].map(markerEl)).toEqual(els);
    expect(els.map((e) => e.hasAttribute('data-selected'))).toEqual([false, false, true]);
    expect(map.getCenter().equals(before)).toBe(true);
    f.componentInstance.selected.set(null);
    await settle();
    expect(els.map((e) => e.hasAttribute('data-selected'))).toEqual([false, false, false]);
    expect(els.map((e) => e.getAttribute('aria-pressed'))).toEqual([null, null, null]);
  });
});

describe('ui-map marker labels (0.43.0)', () => {
  it('uiMapLabelShown: all shows every label, selected only the selected one’s, none none', () => {
    expect([uiMapLabelShown('all', false), uiMapLabelShown('all', true)]).toEqual([true, true]);
    expect([uiMapLabelShown('selected', false), uiMapLabelShown('selected', true)]).toEqual([false, true]);
    expect([uiMapLabelShown('none', false), uiMapLabelShown('none', true)]).toEqual([false, false]);
    expect(prop(rule('.ui-map .ui-map-marker[data-label-hidden] .ui-map-label'), 'display')).toBe('none');
  });

  it('hides the labels the mode says, live, while every marker keeps its name', async () => {
    const { f, settle, markerEl } = await setup((h) => {
      h.preview.set(false);
      h.selected.set('b');
    });
    const hidden = () => ['a', 'b', 'c'].map((id) => markerEl(id).hasAttribute('data-label-hidden'));
    expect(hidden()).toEqual([false, false, false]);
    f.componentInstance.labels.set('selected');
    await settle();
    expect(hidden()).toEqual([true, false, true]);
    f.componentInstance.labels.set('none');
    await settle();
    expect(hidden()).toEqual([true, true, true]);
    expect(['a', 'b', 'c'].map((id) => markerEl(id).getAttribute('aria-label'))).toEqual(['Aminath Hassan, RN', 'Ibrahim Rasheed, RN', 'Busy nurse']);
    f.componentInstance.selected.set(null);
    f.componentInstance.labels.set('selected');
    await settle();
    expect(hidden()).toEqual([true, true, true]);
  });
});
