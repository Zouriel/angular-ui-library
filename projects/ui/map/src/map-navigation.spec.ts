import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as Leaflet from 'leaflet';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiStringsService, uiStringsDv } from '@zouriel/ui';
import { UI_MAP_LEAFLET, UiMap, uiMapRotatePoint, uiMapUserHtml, type UiLatLng } from './map';
import { UiMapNavigation, UiNavAction, uiNavFollowInsets, UI_NAV_FOLLOW_AT } from './map-navigation';
import type { UiMapInsets } from './map';
import VolumeHighIcon from '@hugeicons/core-free-icons/VolumeHighIcon';
import Alert02Icon from '@hugeicons/core-free-icons/Alert02Icon';
import { uiNavDistance, uiNavFitWords, type UiNavEvent, type UiNavPosition, type UiNavState, type UiNavStep } from './navigation';

/*
 * 0.47.0: ui-map-navigation and the map's turn (bearing), on the real Leaflet (jsdom: no layout,
 * so the canvas is sized by hand, and Leaflet is told it has SVG).
 */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const O = { lat: 4.17, lng: 73.51 };
const M_LAT = 111194.93;
const at = (north: number, east: number): UiLatLng => ({ lat: O.lat + north / M_LAT, lng: O.lng + east / (M_LAT * Math.cos((O.lat * Math.PI) / 180)) });
const ROUTE = [at(0, 0), at(500, 0), at(500, 300), at(700, 300)];
const step = (type: string, modifier: string | undefined, loc: UiLatLng, d: number, s: number, instruction: string, streetName?: string, exit?: number): UiNavStep =>
  ({ maneuver: { type, modifier, location: loc, exit }, distanceMeters: d, durationSeconds: s, instruction, streetName });
const STEPS: UiNavStep[] = [
  step('depart', undefined, at(0, 0), 500, 60, 'Head north', 'Majeedhee Magu'),
  step('turn', 'right', at(500, 0), 300, 40, 'Turn right onto Orchid Magu', 'Orchid Magu'),
  step('roundabout', 'left', at(500, 300), 200, 30, 'At the roundabout, take the 2nd exit', 'Chaandhanee Magu', 2),
  step('arrive', undefined, at(700, 300), 0, 0, 'You have arrived'),
];
const along = (d: number, side = 0): UiLatLng => (d <= 500 ? at(d, side) : d <= 800 ? at(500 - side, d - 500) : at(500 + d - 800, 300 + side));
const css = () => readFileSync(join(process.cwd(), 'projects/ui/map/src/map-navigation.css'), 'utf8');

let reduce = false;
const original = window.matchMedia;
beforeEach(() => {
  reduce = false;
  window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = original;
  document.documentElement.removeAttribute('dir');
});

@Component({
  imports: [UiMapNavigation],
  template: `<div [attr.dir]="dir()" style="height: 844px">
    <ui-map-navigation [route]="route()" [steps]="steps" [position]="position()" [options]="{ offRouteSeconds: 0 }" destinationLabel="Lily Magu"
      [formatTime]="fmt" (announce)="events.push($event)" (offRoute)="events.push($event)" (arrived)="events.push({ type: 'arrived' })"
      (progress)="states.push($event)" (end)="ended = ended + 1" />
  </div>`,
})
class Host {
  route = signal<UiLatLng[]>(ROUTE);
  steps = STEPS;
  position = signal<UiNavPosition | null>(null);
  dir = signal<'ltr' | 'rtl'>('ltr');
  events: UiNavEvent[] = [];
  states: UiNavState[] = [];
  ended = 0;
  fmt = (ms: number) => `T${Math.round(ms / 1000)}`;
}

const leaflet = async () => {
  const mod = (await import('leaflet')) as unknown as { default?: typeof Leaflet } & typeof Leaflet;
  ((mod.default ?? mod).Browser as { svg: boolean }).svg = true;
  return mod;
};

/** 0.47.1: the app's buttons (mute, SOS), a status and insets. */
@Component({
  imports: [UiMapNavigation, UiNavAction],
  template: `<div [attr.dir]="dir()" style="height: 844px">
    <ui-map-navigation [route]="route()" [steps]="steps" [position]="position()" [status]="status()" [insets]="insets()">
      <button uiNavAction id="mute" [icon]="muteIcon" label="Mute" [pressed]="muted()" (click)="muted.set(!muted())"></button>
      <button uiNavAction id="sos" [icon]="sosIcon" label="SOS" tone="danger" (click)="sos = sos + 1"></button>
    </ui-map-navigation>
  </div>`,
})
class ActionsHost extends Host {
  status = signal<string | null>(null);
  insets = signal<UiMapInsets>({});
  muted = signal(false);
  sos = 0;
  muteIcon = VolumeHighIcon;
  sosIcon = Alert02Icon;
}

async function setup<T extends Host = Host>(init?: (h: T) => void, cmp: new () => T = Host as unknown as new () => T) {
  TestBed.configureTestingModule({ providers: [{ provide: UI_MAP_LEAFLET, useValue: leaflet }] });
  const f = TestBed.createComponent(cmp);
  init?.(f.componentInstance);
  f.detectChanges();
  const root = f.nativeElement as HTMLElement;
  const canvas = root.querySelector('.ui-map-canvas') as HTMLElement;
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 390 });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 844 });
  TestBed.inject(ApplicationRef).tick();
  const mapCmp = f.debugElement.query(By.directive(UiMap)).componentInstance as UiMap;
  const nav = f.debugElement.query(By.directive(UiMapNavigation)).componentInstance as UiMapNavigation;
  const priv = mapCmp as unknown as { map: Leaflet.Map | null; rotor: HTMLElement | null; turn: number };
  for (let i = 0; i < 100 && !priv.map; i++) await new Promise((r) => setTimeout(r, 10));
  const map = priv.map!;
  expect(map).toBeTruthy();
  const host = root.querySelector('ui-map-navigation') as HTMLElement;
  const settle = async () => {
    f.detectChanges();
    await f.whenStable();
    TestBed.tick();
  };
  const feed = async (p: UiNavPosition) => {
    f.componentInstance.position.set(p);
    await settle();
  };
  const text = (sel: string) => host.querySelector(sel)?.textContent?.trim() ?? null;
  return { f, host, map, mapCmp, nav, priv, settle, feed, text };
}

describe('ui-map-navigation (0.47.0)', () => {
  it('the banner: the next maneuver\'s arrow, "in 500 m", instruction and street; the one after small; the bar: time, distance, arrival', async () => {
    const { host, feed, text } = await setup();
    await feed({ ...along(0), heading: 0, speed: 8, timestamp: 1_000_000 });
    expect(text('.ui-nav-distance')).toBe('in 500 m');
    expect(text('.ui-nav-instruction')).toBe('Turn right onto Orchid Magu');
    expect(text('.ui-nav-street')).toBe('Orchid Magu');
    expect(host.querySelector('.ui-nav-maneuver')!.getAttribute('data-kind')).toBe('right');
    expect(text('.ui-nav-then-text')).toBe('At the roundabout, take the 2nd exit');
    expect(text('.ui-nav-then-word')).toBe('Then');
    expect(text('.ui-nav-time')).toBe('3 min'); // 60 + 40 + 30 s
    expect([...host.querySelectorAll('.ui-nav-meta > span')].map((x) => x.textContent)).toEqual(['1 km', '·', 'T1130']);
    expect(host.querySelector('.ui-nav-eta')!.getAttribute('aria-label')).toBe('3 min left, 1 km, arrive at T1130');
    expect(host.querySelector('.ui-nav-banner')!.getAttribute('aria-label')).toBe('in 500 m, Turn right onto Orchid Magu, Orchid Magu');
    expect(host.querySelector('.ui-nav-instruction')!.getAttribute('aria-live')).toBe('polite');
    expect(host.getAttribute('aria-label')).toBe('Navigation');
  });

  it('steps along a simulated drive: banner, roundabout exit, events, the way behind dimmed', async () => {
    const { f, host, feed, text } = await setup();
    for (let d = 0; d <= 560; d += 20) await feed({ ...along(d), heading: d < 500 ? 0 : 90, speed: 10, timestamp: d * 100 });
    expect(text('.ui-nav-instruction')).toBe('At the roundabout, take the 2nd exit');
    expect(host.querySelector('.ui-nav-maneuver')!.getAttribute('data-kind')).toBe('roundabout-left');
    expect(text('.ui-nav-exit')).toBe('2');
    expect(text('.ui-nav-then-text')).toBe('You have arrived');
    // The way behind in the muted tone, the way ahead in the primary, meeting at the person.
    const lines = [...host.querySelectorAll('path.ui-map-route-line')];
    expect(lines.map((l) => [l.getAttribute('data-route'), l.getAttribute('data-tone')])).toEqual([['nav-traveled', 'muted'], ['nav-remaining', 'primary']]);
    expect([(lines[0] as SVGElement).style.strokeOpacity, (lines[1] as SVGElement).style.strokeOpacity]).toEqual(['0.6', '']);
    const ann = f.componentInstance.events.filter((e) => e.type === 'announce') as Extract<UiNavEvent, { type: 'announce' }>[];
    expect(ann.map((e) => `${e.stepIndex}:${e.reason}${e.threshold ?? ''}`)).toEqual(['1:step', '1:distance200', '1:distance30', '2:step']);
    expect(f.componentInstance.states.length).toBe(29);
    for (let d = 580; d <= 1000; d += 20) await feed({ ...along(d), heading: d <= 800 ? 90 : 0, speed: 10, timestamp: d * 100 });
    expect(f.componentInstance.events.filter((e) => e.type === 'arrived')).toHaveLength(1);
    expect(text('.ui-nav-time')).toBe('0 min');
   }, 30000); // 50 fixes on the real Leaflet: slow under the full suite's load

  it('off the route: offRoute with the distance; a new route (a reroute) starts over', async () => {
    const { f, feed, text } = await setup();
    await feed({ ...along(100), timestamp: 0 });
    await feed({ ...along(120, 90), timestamp: 1000 });
    const off = f.componentInstance.events.filter((e) => e.type === 'offRoute') as Extract<UiNavEvent, { type: 'offRoute' }>[];
    expect(off).toHaveLength(1);
    expect(off[0].distanceMeters).toBeCloseTo(90, 0);
    f.componentInstance.route.set([along(120, 90), at(500, 90), at(500, 300), at(700, 300)]);
    await feed({ ...along(120, 90), timestamp: 2000 });
    expect(f.componentInstance.states.at(-1)!.distanceFromRoute).toBeLessThan(1);
    expect(text('.ui-nav-distance')).toBe('in 400 m'); // the old steps' right turn, on the new road
  });

  it('turns the map heading-up about the person, keeps markers upright, and draws the arrow', async () => {
    const { host, feed, priv, map, mapCmp } = await setup();
    await feed({ ...along(600), heading: 90, speed: 10, timestamp: 0 });
    expect(mapCmp.bearing()).toBe(90);
    const rotor = priv.rotor!;
    expect(rotor).toBeTruthy();
    expect(rotor.style.transform).toBe('rotate(-90deg)');
    expect(rotor.contains(map.getPane('mapPane')!)).toBe(true);
    // The controls aren't turned.
    expect(rotor.contains(host.querySelector('.leaflet-control-container'))).toBe(false);
    // The destination marker is turned back upright.
    expect((host.querySelector('.ui-map-marker') as HTMLElement).style.transform).toMatch(/rotate\(90deg\)$/);
    // The person: an arrow puck turned to the heading (on the map, so it shows heading - bearing on screen).
    const puck = host.querySelector('.ui-map-user-puck') as HTMLElement;
    expect(puck.style.transform).toBe('rotate(90deg)');
    // It turns about the middle of the visible part, which is where the person is.
    const ins = mapCmp.insets();
    expect(rotor.style.transformOrigin).toBe(`195px ${(844 + (ins.top ?? 0) - (ins.bottom ?? 0)) / 2}px`);
    // The shorter way round: 90 to 350 turns -100, not +260.
    await feed({ ...along(620), heading: 350, speed: 10, timestamp: 1000 });
    expect(rotor.style.transform).toBe('rotate(10deg)');
    expect(rotor.hasAttribute('data-animate')).toBe(true);
    // The arrow is the same element, turned the same shorter way (so it eases along with the map).
    expect(host.querySelector('.ui-map-user-puck')).toBe(puck);
    expect(puck.style.transform).toBe('rotate(-10deg)');
  });

  it('reduced motion: the map turns at once', async () => {
    reduce = true;
    const { feed, priv } = await setup();
    await feed({ ...along(600), heading: 90, speed: 10, timestamp: 0 });
    expect(priv.rotor!.style.transform).toBe('rotate(-90deg)');
    expect(priv.rotor!.hasAttribute('data-animate')).toBe(false);
  });

  it('a drag stops the following (the map keeps its turn) and shows Recenter, which follows again at zoom 17', async () => {
    const { host, feed, map, settle, nav, mapCmp } = await setup();
    await feed({ ...along(100), heading: 0, speed: 10, timestamp: 0 });
    expect(host.querySelector('.ui-nav-recenter')).toBeNull();
    map.fire('dragstart');
    await settle();
    expect(nav.following()).toBe(false);
    const btn = host.querySelector('.ui-nav-recenter') as HTMLButtonElement;
    expect(btn.textContent!.trim()).toBe('Recenter');
    map.setZoom(13, { animate: false });
    // Not following: new fixes don't move the map, and the turn holds.
    const c = map.getCenter();
    await feed({ ...along(600), heading: 90, speed: 10, timestamp: 1000 });
    expect(map.getCenter().equals(c)).toBe(true);
    expect(mapCmp.bearing()).toBe(0);
    btn.click();
    await settle();
    expect(nav.following()).toBe(true);
    expect(host.querySelector('.ui-nav-recenter')).toBeNull();
    expect(map.getZoom()).toBe(17);
    expect(mapCmp.bearing()).toBe(90);
  });

  it('a two-finger turn pauses heading-up (compass shows); Recenter turns back heading-up', async () => {
    const { host, feed, settle, nav, priv, mapCmp } = await setup();
    await feed({ ...along(600), heading: 90, speed: 10, timestamp: 0 });
    const canvas = host.querySelector('.ui-map-canvas') as HTMLElement;
    const touch = (type: string, deg: number) => {
      const a = (deg * Math.PI) / 180;
      const pts = type === 'touchend' ? [] : [[195 - 80 * Math.cos(a), 400 - 80 * Math.sin(a)], [195 + 80 * Math.cos(a), 400 + 80 * Math.sin(a)]];
      const touches = pts.map(([x, y], i) => ({ identifier: i, clientX: x, clientY: y, target: canvas }));
      const e = new Event(type, { bubbles: true, cancelable: true });
      for (const k of ['touches', 'targetTouches', 'changedTouches']) Object.defineProperty(e, k, { value: touches });
      canvas.dispatchEvent(e);
    };
    const compass = () => host.querySelector('.ui-map-compass-bar') as HTMLElement;
    expect(compass().hidden).toBe(true); // heading-up while following: no compass
    touch('touchstart', 0);
    touch('touchmove', 30);
    touch('touchend', 0);
    await settle();
    expect(nav.following()).toBe(false);
    expect(priv.turn).toBeCloseTo(60, 6); // 90 less the 30 degree turn
    expect(compass().hidden).toBe(false);
    // Fixes don't turn it back while paused.
    await feed({ ...along(620), heading: 90, speed: 10, timestamp: 1000 });
    expect(priv.turn).toBeCloseTo(60, 6);
    (host.querySelector('.ui-nav-recenter') as HTMLButtonElement).click();
    await settle();
    expect(nav.following()).toBe(true);
    expect(mapCmp.currentBearing()).toBeCloseTo(90, 6);
    expect(compass().hidden).toBe(true);
  });

  it('End emits end; the strings follow the language', async () => {
    const { f, host, feed, settle, text } = await setup();
    await feed({ ...along(0), timestamp: 0 });
    (host.querySelector('.ui-nav-end button') as HTMLButtonElement).click();
    expect(f.componentInstance.ended).toBe(1);
    TestBed.inject(UiStringsService).set(uiStringsDv);
    await settle();
    expect(text('.ui-nav-distance')).toBe('500 މީޓަރު ދުރުން');
    expect(text('.ui-nav-end')).toBe('ނިންމާ');
    TestBed.inject(UiStringsService).set({});
  });

  it('RTL mirrors the layout (logical properties only), never the arrows', async () => {
    const c = css();
    expect(c).not.toMatch(/(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/m);
    expect(c).toMatch(/\.ui-nav-recenter \{[^}]*inset-inline-start/);
    expect(c).toMatch(/\.ui-nav-exit \{[^}]*inset-inline-end/);
    const { host, feed } = await setup((h) => h.dir.set('rtl'));
    await feed({ ...along(0), timestamp: 0 });
    // The banner reads icon first (the start: right in RTL); the right-turn arrow is still the right-turn arrow.
    const banner = host.querySelector('.ui-nav-banner')!;
    expect(banner.firstElementChild!.classList.contains('ui-nav-maneuver')).toBe(true);
    expect(host.querySelector('.ui-nav-maneuver')!.getAttribute('data-kind')).toBe('right');
    expect(c).not.toMatch(/scaleX\(-1\)|scale\(-1/);
  });

  it('the follow point: 68% of the way from the banner to the bar', () => {
    const ins = uiNavFollowInsets(844, 150, 90);
    const mid = ((ins.top ?? 0) + 844 - (ins.bottom ?? 0)) / 2;
    expect(mid).toBeCloseTo(150 + (844 - 150 - 90) * UI_NAV_FOLLOW_AT, 6);
    expect(ins.bottom).toBe(90);
  });
});

describe('ui-map bearing (0.47.0)', () => {
  it('turns points about the pivot, and back', () => {
    const p = { x: 195, y: 500 };
    // East up (90): a point right of the pivot on the unturned map shows above it.
    const s = uiMapRotatePoint({ x: 295, y: 500 }, p, 90);
    expect([s.x, s.y].map(Math.round)).toEqual([195, 400]);
    const back = uiMapRotatePoint(s, p, 90, true);
    expect([back.x, back.y].map((v) => Math.round(v))).toEqual([295, 500]);
  });

  it('a tap on the turned map lands on the point under the finger', async () => {
    const { map, feed, priv } = await setup();
    await feed({ ...along(600), heading: 90, speed: 10, timestamp: 0 });
    const t = (priv as unknown as { turn: number }).turn;
    expect(t).toBe(90);
    const pivot = (priv as unknown as { pivot: () => { x: number; y: number } }).pivot();
    // 100px right of the person on screen is, with east up, 100px south of them on the map.
    const e = { clientX: pivot.x + 100, clientY: pivot.y } as MouseEvent;
    const cp = map.mouseEventToContainerPoint(e);
    expect([Math.round(cp.x), Math.round(cp.y)]).toEqual([Math.round(pivot.x), Math.round(pivot.y + 100)]);
  });

  it('a drag on the turned map moves it the way the finger goes', async () => {
    const { map, feed } = await setup();
    await feed({ ...along(600), heading: 90, speed: 10, timestamp: 0 });
    const d = (map.dragging as unknown as { _draggable: Leaflet.Draggable & { _startPos: Leaflet.Point; _newPos: Leaflet.Point } })._draggable;
    d._startPos = { x: 0, y: 0, add: (q: Leaflet.Point) => q } as unknown as Leaflet.Point;
    d._newPos = { x: 50, y: 0, subtract: () => ({ x: 50, y: 0 }) } as unknown as Leaflet.Point;
    d.fire('predrag');
    // Finger 50px right; the map pane (turned -90) must move 50px down to look 50px right.
    expect([Math.round(d._newPos.x), Math.round(d._newPos.y)]).toEqual([0, 50]);
  });

  it('the tiles also load the corners the turned view shows', async () => {
    const { map, feed, priv } = await setup();
    const tiles = (priv as unknown as { tiles: { _getTiledPixelBounds: (c: Leaflet.LatLng) => Leaflet.Bounds } }).tiles;
    const flat = tiles._getTiledPixelBounds(map.getCenter());
    await feed({ ...along(600), heading: 45, speed: 10, timestamp: 0 });
    const turned = tiles._getTiledPixelBounds(map.getCenter());
    expect(turned.max!.x - turned.min!.x).toBeGreaterThan(flat.max!.x - flat.min!.x);
    expect(turned.max!.y - turned.min!.y).toBeGreaterThan(flat.max!.y - flat.min!.y);
  });

  it('the arrow puck: with a heading, a turned arrow; without, the dot', () => {
    expect(uiMapUserHtml(0, 45)).toContain('class="ui-map-user-puck" style="transform:rotate(45deg)"');
    expect(uiMapUserHtml(0, -90)).toContain('rotate(270deg)');
    expect(uiMapUserHtml(0)).toContain('ui-map-user-dot');
    expect(uiMapUserHtml(0)).not.toContain('puck');
    expect(uiNavDistance(at(0, 0), at(100, 0))).toBeCloseTo(100, 0);
  });
});

describe('ui-map-navigation: actions, status, insets, banner icon colour (0.47.1)', () => {
  it('the app\'s buttons stack at the end side under the banner: 48px round, opaque, in their order', async () => {
    const { f, host, feed, settle } = await setup<ActionsHost>(undefined, ActionsHost);
    await feed({ ...along(0), timestamp: 0 });
    const stack = host.querySelector('.ui-nav-under .ui-nav-actions') as HTMLElement;
    expect(stack).toBeTruthy();
    expect(stack.getAttribute('data-count')).toBe('2');
    const [mute, sos] = [...stack.querySelectorAll('button.ui-nav-action')] as HTMLButtonElement[];
    expect([mute.id, sos.id]).toEqual(['mute', 'sos']);
    // Not inside the banner (measured for the follow point) and after it in the reading order.
    expect(host.querySelector('.ui-nav-top .ui-nav-action')).toBeNull();
    expect(host.querySelector('.ui-nav-top')!.compareDocumentPosition(stack) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const b of [mute, sos]) {
      expect(b.getAttribute('type')).toBe('button');
      expect(b.querySelector('hugeicons-icon')!.getAttribute('aria-hidden')).toBe('true');
      const c = getComputedStyle(b);
      expect([c.width, c.height, c.borderRadius, c.position]).toEqual(['48px', '48px', '50%', 'relative']);
    }
    expect([mute.getAttribute('aria-label'), mute.getAttribute('title'), sos.getAttribute('aria-label')]).toEqual(['Mute', 'Mute', 'SOS']);
    expect(getComputedStyle(mute).getPropertyValue('background')).toBe('var(--ui-color-surface-raised)');
    // The block under the banner: compass column at the start, status in the middle, the stack at the end.
    const under = getComputedStyle(host.querySelector('.ui-nav-under')!);
    expect(under.display).toBe('grid');
    expect(under.gridTemplateColumns).toBe('48px minmax(0, 1fr) 48px');
    expect(under.top).toBe('calc(var(--ui-nav-top-bottom, 0px) + var(--ui-space-2))');
    expect(under.pointerEvents).toBe('none');
    expect(getComputedStyle(stack).gridColumn).toBe('3');
    expect(getComputedStyle(mute).pointerEvents).toBe('auto');
    // Clicks reach the app.
    mute.click();
    sos.click();
    await settle();
    expect(f.componentInstance.muted()).toBe(true);
    expect(f.componentInstance.sos).toBe(1);
  });

  it('pressed is a toggle (aria-pressed, the primary fill); danger is the prominent SOS style', async () => {
    const { f, host, feed, settle } = await setup<ActionsHost>(undefined, ActionsHost);
    await feed({ ...along(0), timestamp: 0 });
    const mute = host.querySelector('#mute') as HTMLButtonElement;
    const sos = host.querySelector('#sos') as HTMLButtonElement;
    expect(mute.getAttribute('aria-pressed')).toBe('false');
    expect(sos.hasAttribute('aria-pressed')).toBe(false);
    f.componentInstance.muted.set(true);
    await settle();
    expect(mute.getAttribute('aria-pressed')).toBe('true');
    expect(getComputedStyle(mute).getPropertyValue('background')).toBe('var(--ui-color-primary)');
    expect(sos.getAttribute('data-tone')).toBe('danger');
    expect(mute.getAttribute('data-tone')).toBe('neutral');
    const c = getComputedStyle(sos);
    expect(c.getPropertyValue('background')).toBe('var(--ui-color-danger)');
    expect(c.color).toBe('var(--ui-color-danger-contrast)');
    expect(c.boxShadow).toContain('0 0 0 3px var(--ui-color-surface-raised)');
  });

  it('status: a pill under the banner in the middle column, a polite live region, hidden without one', async () => {
    const { f, host, feed, settle } = await setup<ActionsHost>(undefined, ActionsHost);
    await feed({ ...along(0), timestamp: 0 });
    const pill = host.querySelector('.ui-nav-under .ui-nav-status') as HTMLElement;
    expect(pill.getAttribute('role')).toBe('status');
    expect(pill.hidden).toBe(true);
    expect(getComputedStyle(pill).display).toBe('none');
    f.componentInstance.status.set('Rerouting…');
    await settle();
    expect(pill.hidden).toBe(false);
    expect(pill.querySelector('.ui-nav-sr')!.textContent!.trim()).toBe('Rerouting…');
    const c = getComputedStyle(pill);
    expect(c.display).toBe('flex');
    expect(c.gridColumn).toBe('2');
    expect(c.borderRadius).toBe('var(--ui-radius-lg)');
    expect(c.getPropertyValue('background')).toBe('var(--ui-color-surface-raised)');
    // Not in the banner, so the follow point doesn't jump when it shows.
    expect(host.querySelector('.ui-nav-top .ui-nav-status')).toBeNull();
  });

  it('insets: the banner, stack, Recenter and bar keep inside them; the safe area counts where bigger; the map gets the sides', async () => {
    const { f, host, feed, settle, mapCmp } = await setup<ActionsHost>((h) => h.insets.set({ top: 56, bottom: 64, start: 72, end: 8 }), ActionsHost);
    await feed({ ...along(0), timestamp: 0 });
    await settle();
    expect(['top', 'bottom', 'start', 'end'].map((k) => host.style.getPropertyValue(`--ui-nav-inset-${k}`))).toEqual(['56px', '64px', '72px', '8px']);
    const h = getComputedStyle(host);
    expect(h.getPropertyValue('--ui-nav-edge-top')).toBe('max(var(--ui-nav-inset-top, 0px), env(safe-area-inset-top, 0px))');
    expect(h.getPropertyValue('--ui-nav-edge-start')).toBe('max(var(--ui-nav-inset-start, 0px), var(--ui-nav-safe-x))');
    expect(h.getPropertyValue('--ui-nav-safe-x')).toBe('max(env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px))');
    const top = getComputedStyle(host.querySelector('.ui-nav-top')!);
    expect(top.top).toBe('calc(var(--ui-nav-edge-top) + var(--ui-space-3))');
    expect(top.getPropertyValue('inset-inline-start')).toBe('calc(var(--ui-nav-edge-start) + var(--ui-space-3))');
    expect(top.getPropertyValue('inset-inline-end')).toBe('calc(var(--ui-nav-edge-end) + var(--ui-space-3))');
    const under = getComputedStyle(host.querySelector('.ui-nav-under')!);
    expect(under.getPropertyValue('inset-inline-end')).toBe('calc(var(--ui-nav-edge-end) + var(--ui-space-3))');
    const bar = getComputedStyle(host.querySelector('.ui-nav-bar')!);
    expect(bar.bottom).toBe('var(--ui-nav-inset-bottom, 0px)');
    expect(bar.getPropertyValue('inset-inline-start')).toBe('var(--ui-nav-inset-start, 0px)');
    expect(bar.getPropertyValue('padding-block')).toContain('max(0px, env(safe-area-inset-bottom, 0px) - var(--ui-nav-inset-bottom, 0px))');
    (f.debugElement.query(By.directive(UiMapNavigation)).componentInstance as UiMapNavigation).following.set(false);
    await settle();
    expect(getComputedStyle(host.querySelector('.ui-nav-recenter')!).getPropertyValue('inset-inline-start')).toBe('calc(var(--ui-nav-edge-start) + var(--ui-space-3))');
    // The compass keeps clear of a side rail: the map's start and end insets are the app's.
    const mi = mapCmp.insets();
    expect([mi.start, mi.end]).toEqual([72, 8]);
    // No insets: zero, and the safe area alone decides.
    f.componentInstance.insets.set({});
    await settle();
    expect(host.style.getPropertyValue('--ui-nav-inset-top')).toBe('0px');
    expect([mapCmp.insets().start, mapCmp.insets().end]).toEqual([0, 0]);
  });

  it('new insets move the banner without resizing it: measured again (the stack and follow point follow)', async () => {
    const { f, host, feed, settle } = await setup<ActionsHost>(undefined, ActionsHost);
    await feed({ ...along(0), timestamp: 0 });
    // jsdom has no layout: the banner's place follows the top inset, its size never changes.
    const top = host.querySelector('.ui-nav-top') as HTMLElement;
    Object.defineProperty(top, 'offsetHeight', { configurable: true, get: () => 150 });
    Object.defineProperty(top, 'offsetTop', { configurable: true, get: () => 12 + (f.componentInstance.insets().top ?? 0) });
    f.componentInstance.insets.set({ top: 1 });
    await settle();
    expect(host.style.getPropertyValue('--ui-nav-top-bottom')).toBe('163px');
    f.componentInstance.insets.set({ top: 48 });
    await settle();
    await new Promise((r) => setTimeout(r, 20));
    expect(host.style.getPropertyValue('--ui-nav-top-bottom')).toBe('210px');
  });

  it('banner icons take the banner\'s colour over a theme\'s or app\'s icon tint', async () => {
    const style = document.createElement('style');
    // A theme tint (maldives sets --ui-color-icon) and an app's own rules on icons.
    style.textContent = ':root { --ui-color-icon: #9fd8e0; } hugeicons-icon { color: #9fd8e0; } .app hugeicons-icon { color: #9fd8e0; } div hugeicons-icon { color: #9fd8e0; }';
    document.head.appendChild(style);
    try {
      const { f, host, feed } = await setup<ActionsHost>(undefined, ActionsHost);
      (f.nativeElement as HTMLElement).classList.add('app');
      await feed({ ...along(0), timestamp: 0 });
      // currentColor resolves to the element's own colour: the banner's contrast colour, the buttons' ink.
      const want: [string, string][] = [
        ['.ui-nav-maneuver hugeicons-icon', 'var(--ui-color-primary-contrast)'], ['.ui-nav-then hugeicons-icon', 'var(--ui-color-primary-contrast)'],
        ['#mute hugeicons-icon', 'var(--ui-color-text)'], ['#sos hugeicons-icon', 'var(--ui-color-danger-contrast)'],
      ];
      for (const [sel, colour] of want) expect(getComputedStyle(host.querySelector(sel)!).color, sel).toBe(colour);
      for (const sel of ['.ui-nav-banner', '.ui-nav-then', '.ui-nav-action']) {
        expect(getComputedStyle(host.querySelector(sel)!).getPropertyValue('--ui-color-icon'), sel).toBe('currentColor');
      }
      expect(getComputedStyle(host.querySelector('.ui-nav-banner')!).color).toBe('var(--ui-color-primary-contrast)');
      expect(getComputedStyle(host.querySelector('.ui-nav-maneuver')!).color).not.toContain('icon');
    } finally {
      style.remove();
    }
  });

  it('RTL: still logical properties only (the stack goes to the start side, the arrows stay)', () => {
    const c = css();
    expect(c).not.toMatch(/(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/m);
    expect(c).toMatch(/\.ui-nav-under \{[^}]*inset-inline-end/);
    expect(c).not.toMatch(/!important/);
  });
});

/** 0.47.2: a holding SOS (with and without the app's tap fallback) next to a plain mute button. */
@Component({
  imports: [UiMapNavigation, UiNavAction],
  template: `<div [attr.dir]="dir()" style="height: 844px">
    <ui-map-navigation [route]="route()" [steps]="steps" [position]="position()" [status]="status()">
      <button uiNavAction id="mute" [icon]="muteIcon" label="Mute" (click)="mutes = mutes + 1"></button>
      <button uiNavAction id="sos" [icon]="sosIcon" label="SOS" tone="danger" [hold]="hold()" [holdMs]="holdMs()" [onTap]="tapFallback() ? onTap : null"
        confirmTitle="Send an SOS?" confirmLabel="Send SOS" [destructive]="true" (confirmed)="sos = sos + 1"></button>
    </ui-map-navigation>
  </div>`,
})
class HoldHost extends Host {
  status = signal<string | null>(null);
  hold = signal(true);
  holdMs = signal<number | null>(null);
  tapFallback = signal(true);
  sos = 0;
  taps = 0;
  mutes = 0;
  muteIcon = VolumeHighIcon;
  sosIcon = Alert02Icon;
  onTap = () => {
    this.taps++;
  };
}

describe('ui-map-navigation: holding actions and the status pill (0.47.2)', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('.ui-layer').forEach((l) => l.remove());
    document.body.style.overflow = '';
  });

  async function holdSetup(init?: (h: HoldHost) => void) {
    const s = await setup<HoldHost>(init, HoldHost);
    await s.feed({ ...along(0), timestamp: 0 });
    document.body.appendChild(s.f.nativeElement);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
    const btn = s.host.querySelector('#sos') as HTMLButtonElement;
    Object.defineProperty(btn, 'getBoundingClientRect', { configurable: true, value: () => ({ left: 300, right: 348, top: 200, bottom: 248, width: 48, height: 48, x: 300, y: 200 }) });
    const ptr = (type: string, x = 324, y = 224) => {
      btn.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: x, clientY: y }));
      s.f.detectChanges();
    };
    const key = (type: string, k = ' ', target: HTMLElement = btn) => {
      const e = new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true });
      target.dispatchEvent(e);
      s.f.detectChanges();
      return e;
    };
    const wait = (ms: number) => {
      vi.advanceTimersByTime(ms);
      s.f.detectChanges();
    };
    const live = () => btn.querySelector('.ui-nav-hold-live')?.textContent?.trim() ?? null;
    const arc = () => btn.querySelector('.ui-nav-hold-arc') as SVGCircleElement | null;
    const dialog = () => document.querySelector('[role=alertdialog], [role=dialog]');
    return { ...s, h: s.f.componentInstance, btn, ptr, key, wait, live, arc, dialog };
  }

  it('fires only when held to the end (2 s by default), the ring filling over the hold; the click after is swallowed', async () => {
    const { h, btn, ptr, wait, arc, dialog } = await holdSetup();
    expect(btn.hasAttribute('data-hold')).toBe(true);
    expect(arc()).toBeTruthy();
    expect(btn.querySelector('.ui-nav-hold-ring')!.getAttribute('aria-hidden')).toBe('true');
    expect(arc()!.style.strokeDashoffset).toBe('100');
    ptr('pointerdown');
    expect(btn.hasAttribute('data-holding')).toBe(true);
    expect(arc()!.style.strokeDashoffset).toBe('0');
    expect(arc()!.style.transitionDuration).toBe('2000ms');
    wait(1990);
    expect(h.sos).toBe(0);
    wait(20);
    expect(h.sos).toBe(1);
    ptr('pointerup');
    btn.click();
    wait(500);
    expect([h.sos, h.taps]).toEqual([1, 0]);
    expect(dialog()).toBeNull();
    expect(btn.hasAttribute('data-holding')).toBe(false);
    expect(arc()!.style.strokeDashoffset).toBe('100');
  });

  it('let go early: cancelled, nothing fires, "Hold cancelled" is read; progress is read at each quarter', async () => {
    const { h, btn, ptr, wait, live } = await holdSetup();
    ptr('pointerdown');
    wait(450);
    expect(live()).toBe('');
    wait(100);
    expect(live()).toBe('Holding, 25%');
    wait(500);
    expect(live()).toBe('Holding, 50%');
    ptr('pointerup');
    btn.click();
    wait(3000);
    expect([h.sos, h.taps]).toEqual([0, 0]);
    expect(live()).toBe('Hold cancelled');
    expect(btn.hasAttribute('data-holding')).toBe(false);
  });

  it('sliding off the button cancels the hold (the pointer is captured, so no pointerleave comes)', async () => {
    const { h, btn, ptr, wait } = await holdSetup();
    ptr('pointerdown');
    wait(500);
    ptr('pointermove', 330, 230);
    wait(100);
    expect(btn.hasAttribute('data-holding')).toBe(true);
    ptr('pointermove', 360, 230);
    expect(btn.hasAttribute('data-holding')).toBe(false);
    wait(3000);
    ptr('pointerup', 360, 230);
    btn.click();
    wait(100);
    expect([h.sos, h.taps]).toEqual([0, 0]);
  });

  it('a tap, a quick key press or a screen reader\'s activation calls onTap; without one, the confirm dialog confirms', async () => {
    const { f, h, btn, ptr, key, wait, dialog } = await holdSetup();
    ptr('pointerdown');
    wait(100);
    ptr('pointerup');
    btn.click();
    expect([h.sos, h.taps]).toEqual([0, 1]);
    key('keydown', 'Enter');
    wait(50);
    key('keyup', 'Enter');
    expect(h.taps).toBe(2);
    btn.click(); // no press before it: assistive activation
    expect(h.taps).toBe(3);
    expect(dialog()).toBeNull();
    h.tapFallback.set(false);
    f.detectChanges();
    btn.click();
    wait(400);
    expect(h.taps).toBe(3);
    expect(dialog()?.textContent).toContain('Send an SOS?');
    const confirm = [...document.querySelectorAll('.ui-layer button')].find((b) => b.textContent?.trim() === 'Send SOS') as HTMLButtonElement;
    confirm.click();
    wait(400);
    expect(h.sos).toBe(1);
    // The dialog's host takes no room in the stack.
    expect(getComputedStyle(btn.parentElement!.querySelector('ui-confirm-dialog')!).display).toBe('contents');
  });

  it('keyboard: Space or Enter held to the end fires; the key never clicks a holding button at once', async () => {
    const { h, key, wait } = await holdSetup();
    const down = key('keydown', ' ');
    expect(down.defaultPrevented).toBe(true);
    wait(2010);
    expect(h.sos).toBe(1);
    key('keyup', ' ');
    expect(h.taps).toBe(0);
  });

  it('holdMs sets the time; reduced motion still needs the whole hold, with a steady ring', async () => {
    const { h, btn, ptr, wait, arc } = await holdSetup((x) => x.holdMs.set(3000));
    reduce = true;
    ptr('pointerdown');
    expect(btn.hasAttribute('data-still')).toBe(true);
    expect(arc()!.style.transitionDuration).toBe('0ms');
    wait(2500);
    expect(h.sos).toBe(0);
    wait(510);
    expect(h.sos).toBe(1);
    const c = css();
    expect(c).toMatch(/\.ui-nav-action\[data-still\] \.ui-nav-hold-arc \{ display: none; \}/);
    expect(c).toMatch(/\.ui-nav-action\[data-still\]\[data-holding\] \.ui-nav-hold-track \{ opacity: 1;/);
  });

  it('described by the hold hint; a plain action has no ring, no hint, and Enter / clicks work as a button\'s', async () => {
    const { f, h, btn, host, key } = await holdSetup();
    const hint = btn.getAttribute('aria-describedby')!;
    expect(document.getElementById(hint)?.textContent?.trim()).toBe('Press and hold to confirm');
    expect(btn.querySelector('.ui-nav-hold-live')!.getAttribute('aria-live')).toBe('polite');
    const mute = host.querySelector('#mute') as HTMLButtonElement;
    expect(mute.querySelector('svg.ui-nav-hold-ring')).toBeNull();
    expect(mute.hasAttribute('aria-describedby')).toBe(false);
    expect(mute.hasAttribute('data-hold')).toBe(false);
    expect(key('keydown', 'Enter', mute).defaultPrevented).toBe(false);
    mute.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerId: 2 }));
    mute.click();
    expect(h.mutes).toBe(1);
    // hold off again: a plain button.
    h.hold.set(false);
    f.detectChanges();
    expect(btn.hasAttribute('data-hold')).toBe(false);
    expect(btn.querySelector('svg.ui-nav-hold-ring')).toBeNull();
  });

  it('status: up to two lines, ending on a whole word with an ellipsis; screen readers hear it all', async () => {
    const { f, host, settle } = await setup<HoldHost>(undefined, HoldHost);
    const pill = host.querySelector('.ui-nav-status') as HTMLElement;
    const shown = pill.querySelector('.ui-nav-status-text') as HTMLElement;
    expect(shown.getAttribute('aria-hidden')).toBe('true');
    // jsdom has no layout: 20 characters a line, 2 lines.
    Object.defineProperty(shown, 'clientHeight', { configurable: true, get: () => Math.min(2, Math.ceil((shown.textContent ?? '').length / 20)) * 19 });
    Object.defineProperty(shown, 'scrollHeight', { configurable: true, get: () => Math.ceil((shown.textContent ?? '').length / 20) * 19 });
    const long = 'Rerouting around the closed road near the harbour, please wait';
    f.componentInstance.status.set(long);
    await settle();
    await new Promise((r) => setTimeout(r, 20));
    expect(pill.querySelector('.ui-nav-sr')!.textContent).toBe(long);
    const text = shown.textContent!;
    expect(text.endsWith('…')).toBe(true);
    expect(text.length).toBeLessThanOrEqual(40);
    expect(long.startsWith(text.slice(0, -1))).toBe(true);
    expect(long[text.length - 1]).toBe(' ');
    f.componentInstance.status.set('Rerouting…');
    await settle();
    await new Promise((r) => setTimeout(r, 20));
    expect(shown.textContent).toBe('Rerouting…');
    const c = getComputedStyle(shown);
    expect(c.getPropertyValue('-webkit-line-clamp')).toBe('2');
    expect(c.overflowWrap).toBe('break-word');
    expect(getComputedStyle(pill).borderRadius).toBe('var(--ui-radius-lg)');
    expect(getComputedStyle(pill).whiteSpace).not.toBe('nowrap');
  });
});

describe('uiNavFitWords (0.47.2)', () => {
  const lines = (perLine: number, max = 2) => (s: string) => {
    // Greedy word wrap: whole words, a word longer than the line takes lines of its own.
    let n = 1;
    let used = 0;
    for (const w of s.split(' ')) {
      const need = used ? used + 1 + w.length : w.length;
      if (need <= perLine) used = need;
      else {
        n += used ? 1 : 0;
        used = w.length;
        n += Math.max(0, Math.ceil(w.length / perLine) - 1);
      }
    }
    return n <= max;
  };
  it('the whole text when it fits; else whole words and an ellipsis, the most that fit', () => {
    expect(uiNavFitWords('Rerouting…', lines(20))).toBe('Rerouting…');
    expect(uiNavFitWords('  Rerouting   now ', lines(20))).toBe('Rerouting now');
    const out = uiNavFitWords('Rerouting around the closed road near the harbour', lines(20));
    expect(out).toBe('Rerouting around the closed road near…');
    expect(lines(20)(out)).toBe(true);
  });
  it('drops a comma or colon before the ellipsis; Thaana words cut the same way', () => {
    expect(uiNavFitWords('Rerouting, closed road, harbour ahead, please wait for it', lines(12))).toBe('Rerouting, closed road…');
    const dv = 'އަލުން މަގު ހޯދަނީ، ބަނދަރު ކައިރީގައި މަގު ބަންދުކޮށްފައި';
    const cut = uiNavFitWords(dv, lines(16));
    expect(cut.endsWith('…')).toBe(true);
    expect(dv.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut.slice(-2, -1)).not.toBe('،');
    expect([' ', '،']).toContain(dv[cut.length - 1]);
  });
  it('a first word longer than the space: the text as it is (the pill\'s own clamp cuts it)', () => {
    expect(uiNavFitWords('Supercalifragilisticexpialidocious', () => false)).toBe('Supercalifragilisticexpialidocious');
    expect(uiNavFitWords('', () => false)).toBe('');
  });
});
