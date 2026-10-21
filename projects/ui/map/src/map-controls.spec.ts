import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as Leaflet from 'leaflet';
import CenterFocusIcon from '@hugeicons/core-free-icons/CenterFocusIcon';
import Layers01Icon from '@hugeicons/core-free-icons/Layers01Icon';
import { UiTooltip } from '@zouriel/ui/overlay';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiMap, uiMapLabelSide, UI_MAP_LABEL_GAP, type UiLatLng, type UiMapControl, type UiMapInsets, type UiMapMarker } from './map';

/*
 * 0.42.1: the app's own map controls, and marker labels that flip away from the map's edge. On the
 * real Leaflet; jsdom has no layout, so the canvas is given a size by hand and the labels a width.
 */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const C: UiLatLng = { lat: 4.1755, lng: 73.5093 };
const W = 390;
const H = 844;
const ADDRESS = 'Lily Magu, Hiyaa Tower 4, Hulhumale Male'; // 40 characters
/** What a 40-character label measures in a browser (Poppins 12px semibold, with its padding). */
const LABEL_W = 250;
const css = () => readFileSync(join(process.cwd(), 'projects/ui/map/src/map.css'), 'utf8');
const rule = (selector: string) => {
  const m = css().match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`));
  expect(m, selector).toBeTruthy();
  return m![1];
};
const prop = (block: string, p: string) => block.match(new RegExp(`(?:^|[\\s;])${p}:\\s*([^;]+);`))?.[1].trim();

const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('ui-map-label') ? (this.textContent === ADDRESS ? LABEL_W : 100) : 0;
    },
  });
});
afterEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth);
});

@Component({
  imports: [UiMap],
  template: `<ui-map [center]="center" [zoom]="15" [markers]="markers()" [controls]="controls()" [locateControl]="locate()" [insets]="insets()"
    [style.direction]="dir()" (controlPress)="pressed.push($event.id)" />`,
})
class Host {
  center = C;
  markers = signal<UiMapMarker[]>([]);
  controls = signal<UiMapControl[]>([{ id: 'fit', icon: CenterFocusIcon, label: 'Show both', tooltip: 'Show both' }]);
  locate = signal(true);
  insets = signal<UiMapInsets>({});
  dir = signal<'ltr' | 'rtl'>('ltr');
  pressed: string[] = [];
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
  const priv = f.debugElement.query(By.directive(UiMap)).componentInstance as unknown as { map: Leaflet.Map | null };
  for (let i = 0; i < 100 && !priv.map; i++) await new Promise((r) => setTimeout(r, 10));
  const map = priv.map!;
  expect(map).toBeTruthy();
  const settle = async () => {
    f.detectChanges();
    await f.whenStable();
    TestBed.tick();
  };
  const host = root.querySelector('ui-map') as HTMLElement;
  /** A marker `x` px from the map's left edge (at y 400). */
  const at = (x: number, y = 400): UiLatLng => {
    const ll = map.containerPointToLatLng([x, y]);
    return { lat: ll.lat, lng: ll.lng };
  };
  return { f, map, host, settle, at };
}

describe('ui-map controls (0.42.1)', () => {
  it('draws an app control in the locate button’s stack, named, and emits (controlPress) with it', async () => {
    const { f, host, settle } = await setup();
    const stack = host.querySelector('.ui-map-controls')!;
    expect(stack.getAttribute('data-locate')).toBe('true');
    const b = stack.querySelector<HTMLButtonElement>('button.ui-map-control')!;
    expect([b.getAttribute('aria-label'), b.getAttribute('data-control'), b.type]).toEqual(['Show both', 'fit', 'button']);
    expect(b.querySelector('hugeicons-icon')?.getAttribute('aria-hidden')).toBe('true');
    b.click();
    expect(f.componentInstance.pressed).toEqual(['fit']);
    // Disabled: shown, not pressable.
    f.componentInstance.controls.set([{ id: 'fit', icon: CenterFocusIcon, label: 'Show both', disabled: true }, { id: 'layers', icon: Layers01Icon, label: 'Layers' }]);
    await settle();
    const [a, l] = [...host.querySelectorAll<HTMLButtonElement>('.ui-map-control')];
    expect(a.disabled).toBe(true);
    a.click();
    l.click();
    expect(f.componentInstance.pressed).toEqual(['fit', 'layers']); // in order, top to bottom
    f.componentInstance.controls.set([]);
    await settle();
    expect(host.querySelector('.ui-map-controls')).toBeNull();
  });

  it('has the locate button’s round raised surface, border and lift, 38px (44px on touch) with a 48px hit area', () => {
    const control = rule('.ui-map .ui-map-control');
    const locate = rule('.ui-map .ui-map-locate');
    for (const p of ['background', 'border', 'box-shadow', 'box-sizing', 'width', 'height', 'border-radius']) expect(prop(control, p), p).toBe(prop(locate, p));
    expect(prop(control, 'background')).toBe('var(--ui-color-surface-raised)');
    expect(css()).toMatch(/@media \(pointer: coarse\) \{[^@]*\.ui-map \.ui-map-control \{ width: var\(--ui-size-touch\); height: var\(--ui-size-touch\); \}/);
    expect(css()).toMatch(/\.ui-map \.ui-map-control::before \{[^}]*width: 48px; height: 48px/);
  });

  it('stacks above the locate button at the bottom-end of the visible part (in its place without one), following the insets, RTL-safe', async () => {
    const stack = rule('.ui-map .ui-map-controls');
    const locate = rule('.ui-map .ui-map-locate');
    // The same corner as the locate button, a logical inline-end (the left in RTL).
    expect(prop(stack, 'bottom')).toBe(prop(locate, 'bottom'));
    expect(prop(stack, 'inset-inline-end')).toBe(prop(locate, 'inset-inline-end'));
    expect(prop(stack, 'gap')).toBe('var(--ui-space-2)');
    // With the locate button: one button and the 8px gap higher, 38px or 44px on touch.
    expect(prop(rule('.ui-map .ui-map-controls[data-locate]'), 'bottom')).toBe('calc(var(--ui-map-inset-bottom, 0px) + var(--ui-space-8) + var(--ui-size-lg) + var(--ui-space-2))');
    expect(css()).toMatch(/\.ui-map \.ui-map-controls\[data-locate\] \{ bottom: calc\(var\(--ui-map-inset-bottom, 0px\) \+ var\(--ui-space-8\) \+ var\(--ui-size-touch\) \+ var\(--ui-space-2\)\); \}/);
    const { f, host, settle } = await setup((h) => h.locate.set(false));
    expect(host.querySelector('.ui-map-controls')!.hasAttribute('data-locate')).toBe(false);
    f.componentInstance.insets.set({ bottom: 300, end: 20 });
    await settle();
    expect([host.style.getPropertyValue('--ui-map-inset-bottom'), host.style.getPropertyValue('--ui-map-inset-end')]).toEqual(['300px', '20px']);
  });

  it('its tooltip faces into the map: left of it, right in RTL', async () => {
    const tip = async (dir: 'ltr' | 'rtl') => {
      const { f } = await setup((h) => h.dir.set(dir));
      f.detectChanges();
      const d = f.debugElement.query(By.css('.ui-map-control')).injector.get(UiTooltip);
      return [d.text(), d.position()];
    };
    expect(await tip('ltr')).toEqual(['Show both', 'left']);
    TestBed.resetTestingModule();
    expect(await tip('rtl')).toEqual(['Show both', 'right']);
  });
});

describe('ui-map labels near the edge (0.42.1)', () => {
  it('the side: the inline end unless it runs off there, then the other, else the roomier (the same numbers as Flutter)', () => {
    expect(uiMapLabelSide(100, 200, 390)).toBe('right');
    expect(uiMapLabelSide(350, 200, 390)).toBe('left'); // 40px from the right edge
    expect(uiMapLabelSide(220, 150, 390)).toBe('right'); // 220 + 12 + 150 = 382: just fits
    expect(uiMapLabelSide(221, 150, 390)).toBe('left');
    expect(uiMapLabelSide(170, 300, 390)).toBe('right');
    expect(uiMapLabelSide(250, 300, 390)).toBe('left');
    expect(uiMapLabelSide(250, 100, 390, true)).toBe('left');
    expect(uiMapLabelSide(40, 200, 390, true)).toBe('right');
    expect(UI_MAP_LABEL_GAP).toBe(12);
  });

  it('390 wide, a pin 40px from the right edge: the label goes left of the dot; in the middle it stays right', async () => {
    const { f, settle, at, host } = await setup();
    f.componentInstance.markers.set([
      { id: 'edge', ...at(W - 40), label: ADDRESS, ariaLabel: 'edge' },
      { id: 'mid', ...at(100), label: ADDRESS, ariaLabel: 'mid' },
    ]);
    await settle();
    const side = (name: string) => host.querySelector<HTMLElement>(`.ui-map-marker[title="${name}"]`)!.getAttribute('data-side');
    expect(side('edge')).toBe('left');
    expect(side('mid')).toBe('right');
    // The CSS puts a left label on the dot's other side, 12px from the point.
    expect(prop(rule('.ui-map .ui-map-marker[data-side="left"] .ui-map-label'), 'right')).toBe('calc(100% + var(--ui-space-1))');
    expect(prop(rule('.ui-map .ui-map-label'), 'left')).toBe('calc(100% + var(--ui-space-1))');
    expect(prop(rule('.ui-map .ui-map-label'), 'position')).toBe('absolute');
  });

  it('flips as the map pans', async () => {
    const { f, map, settle, at, host } = await setup();
    f.componentInstance.markers.set([{ id: 'p', ...at(100), label: ADDRESS, ariaLabel: 'p' }]);
    await settle();
    const el = host.querySelector<HTMLElement>('.ui-map-marker[title="p"]')!;
    expect(el.getAttribute('data-side')).toBe('right');
    map.panBy([-250, 0], { animate: false }); // the marker is now 40px from the right edge
    expect(el.getAttribute('data-side')).toBe('left');
    map.panBy([250, 0], { animate: false });
    expect(el.getAttribute('data-side')).toBe('right');
  });

  it('RTL mirrored: the label starts on the left; near the left edge it flips right', async () => {
    const { f, settle, at, host } = await setup((h) => h.dir.set('rtl'));
    f.componentInstance.markers.set([
      { id: 'm', ...at(250), label: 'Hiyaa Tower 4', ariaLabel: 'm' },
      { id: 'e', ...at(40), label: ADDRESS, ariaLabel: 'e' },
    ]);
    await settle();
    const side = (name: string) => host.querySelector<HTMLElement>(`.ui-map-marker[title="${name}"]`)!.getAttribute('data-side');
    expect(side('m')).toBe('left');
    expect(side('e')).toBe('right');
  });
});
