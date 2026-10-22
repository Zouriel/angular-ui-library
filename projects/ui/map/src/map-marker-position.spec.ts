import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type * as Leaflet from 'leaflet';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiMap, type UiLatLng, type UiMapMarker } from './map';

/*
 * 0.44.2: every marker sits exactly at its point. Since 0.35.1 `.ui-map .ui-map-marker` set
 * `position: relative` (for its hit-area ::before), which beat Leaflet's `.leaflet-marker-icon
 * { position: absolute }`: the icons fell into normal flow, so each was drawn its flow height (about
 * 16px) below the one before, and 280 pins on the Dhirumi web map became one long column.
 * jsdom has no layout, so this checks what decides it: each icon is absolutely positioned (out of
 * the flow, no stacking) at Leaflet's layer point for its marker, the selected one included.
 */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const MALE: UiLatLng = { lat: 4.1755, lng: 73.5093 };
const W = 390;
const H = 844;

const original = window.matchMedia;
beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = original;
});

// 60 markers on a grid around Malé, some labelled.
const MARKERS: UiMapMarker[] = Array.from({ length: 60 }, (_, i) => ({
  id: `m${i}`,
  lat: MALE.lat + ((i % 6) - 3) * 0.004,
  lng: MALE.lng + (Math.floor(i / 6) - 5) * 0.004,
  label: i % 4 === 0 ? `Clinic ${i}` : undefined,
  tone: i % 3 === 0 ? 'success' : 'primary',
}));

@Component({
  imports: [UiMap],
  template: `<ui-map [center]="center" [zoom]="14" [markers]="markers" [selectedMarkerId]="selected()" />`,
})
class Host {
  center = MALE;
  markers = MARKERS;
  selected = signal<string | null>(null);
}

async function open() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const root = f.nativeElement as HTMLElement;
  const canvas = root.querySelector('.ui-map-canvas') as HTMLElement;
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: W });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: H });
  const cmp = f.debugElement.query(By.directive(UiMap)).componentInstance as UiMap;
  const priv = cmp as unknown as { map: Leaflet.Map | null };
  for (let i = 0; i < 100 && !priv.map; i++) await new Promise((r) => setTimeout(r, 10));
  TestBed.inject(ApplicationRef).tick();
  f.detectChanges();
  return { f, root, map: priv.map! };
}

/** The translate Leaflet gave the icon (DomUtil.setPosition), in layer px. */
function placed(el: HTMLElement): { x: number; y: number } {
  const t = el.style.transform || '';
  const m = t.match(/translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/) ?? t.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px/);
  if (m) return { x: +m[1], y: +m[2] };
  return { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
}

function check(root: HTMLElement, map: Leaflet.Map) {
  const icons = [...root.querySelectorAll<HTMLElement>('.leaflet-marker-pane .ui-map-marker')];
  expect(icons.length).toBe(MARKERS.length);
  const wrong: string[] = [];
  icons.forEach((el, i) => {
    const s = getComputedStyle(el);
    // Out of the flow: Leaflet's absolute positioning, so no icon pushes the next one down.
    if (s.position !== 'absolute') wrong.push(`#${i}: position ${s.position}`);
    // Its corner at the layer point of its own marker, the dot centred there by the negative margin.
    const id = el.getAttribute('data-id') ?? el.dataset['markerId'];
    const m = MARKERS.find((x) => x.id === id) ?? MARKERS[i];
    const want = map.latLngToLayerPoint([m.lat, m.lng]).round();
    const got = placed(el);
    if (Math.abs(got.x - want.x) > 0.5 || Math.abs(got.y - want.y) > 0.5) wrong.push(`#${i}: at ${got.x},${got.y}, its point is ${want.x},${want.y}`);
  });
  expect(wrong).toEqual([]);
}

describe('ui-map markers sit at their points (0.44.2)', () => {
  it('60 markers: each icon absolutely positioned at its own layer point, no accumulating offset', async () => {
    const { root, map } = await open();
    check(root, map);
  });

  it('with a selected marker: still all at their points, and the selected one raised with its ring', async () => {
    const { f, root, map } = await open();
    f.componentInstance.selected.set('m17');
    f.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    check(root, map);
    const icons = [...root.querySelectorAll<HTMLElement>('.leaflet-marker-pane .ui-map-marker')];
    const sel = icons.filter((el) => el.hasAttribute('data-selected'));
    expect(sel.length).toBe(1);
    const others = icons.filter((el) => el !== sel[0]).map((el) => +(el.style.zIndex || 0));
    expect(+(sel[0].style.zIndex || 0)).toBeGreaterThan(Math.max(...others));
    expect(getComputedStyle(sel[0]).getPropertyValue('margin')).toContain('-11px');
  });
});

/*
 * The dot's centre, and its hit area's, exactly on the point. Leaflet puts the icon's top-left
 * corner on the point; the margin lifts it. The box is min-height 24px with the dot centred in it,
 * and the dot is the first thing in the row, so its centre is at (margin-left + dot/2,
 * margin-top + 12). Until 0.44.2 the margin lifted it only 8px, leaving every dot 4px low.
 */
describe('ui-map marker geometry (0.44.2)', () => {
  const css = readFileSync(join(process.cwd(), 'projects/ui/map/src/map.css'), 'utf8');
  const block = (sel: string, src = css) => {
    const m = src.match(new RegExp(`(?:^|\\n|\\{ )${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`));
    expect(m, sel).toBeTruthy();
    return m![1];
  };
  const px = (b: string, p: string) => {
    const v = b.match(new RegExp(`(?:^|[\\s;])${p}:\\s*(-?[\\d.]+)(?:px)?`))?.[1];
    return v === undefined ? undefined : +v;
  };
  const coarse = [...css.matchAll(/@media \(pointer: coarse\) \{([^\n]*)\}/g)].map((m) => m[1].trim()).join('\n');
  const margin = (b: string) => {
    const m = b.match(/margin:\s*(-?\d+)px 0 0 (-?\d+)px/)!;
    return { top: +m[1], left: +m[2] };
  };

  it.each([
    ['a marker', '.ui-map .ui-map-marker', '.ui-map .ui-map-dot', 16],
    ['the selected marker', '.ui-map .ui-map-marker[data-selected]', '.ui-map .ui-map-marker[data-selected] .ui-map-dot', 22],
  ] as const)('%s: dot centre and hit area centre on the point, fine and coarse pointers', (_, sel, dotSel, size) => {
    const box = 24; // min-height
    expect(css).toContain(`.ui-map .ui-map-marker { min-height: ${box}px; position: absolute; }`);
    expect(px(block(dotSel), 'width')).toBe(size);
    const m = margin(sel === '.ui-map .ui-map-marker' ? css.match(/\.ui-map \.ui-map-marker \{ display: flex[^}]*\}/)![0] : block(sel));
    expect(m.left + size / 2, 'dot centre x').toBe(0);
    expect(m.top + box / 2, 'dot centre y').toBe(0);
    for (const [where, src] of [['fine', css], ['coarse', coarse]] as const) {
      const hit = block(`${sel}::before`, src);
      const base = block('.ui-map .ui-map-marker::before', src);
      const left = px(hit, 'left') ?? px(base, 'left')!;
      const top = px(hit, 'top') ?? px(base, 'top')!;
      const w = px(hit, 'width') ?? px(base, 'width')!;
      const h = px(hit, 'height') ?? px(base, 'height')!;
      expect(m.left + left + w / 2, `${where} hit area centre x`).toBe(0);
      expect(m.top + top + h / 2, `${where} hit area centre y`).toBe(0);
    }
  });
});
