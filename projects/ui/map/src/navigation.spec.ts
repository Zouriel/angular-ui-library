import { describe, expect, it } from 'vitest';
import { defaultUiStrings, uiStringsDv } from '@zouriel/ui';
import type { UiLatLng } from './map';
import {
  UI_NAV_ICONS, UiNavTracker, uiNavBearing, uiNavDistance, uiNavFormatClock, uiNavFormatDistance, uiNavFormatDuration, uiNavIconKind,
  type UiNavEvent, type UiNavPosition, type UiNavStep,
} from './navigation';

/*
 * 0.47.0: the navigation logic, on a made-up drive in Male: 500 m north, right, 300 m east, left,
 * 200 m north to the end. The same route and numbers are in the Flutter twin's navigation_test.
 */

const O = { lat: 4.17, lng: 73.51 };
const M_LAT = 111194.93; // metres per degree of latitude at R = 6371 km
/** The point `north` m north and `east` m east of O. */
const at = (north: number, east: number): UiLatLng => ({ lat: O.lat + north / M_LAT, lng: O.lng + east / (M_LAT * Math.cos((O.lat * Math.PI) / 180)) });
const ROUTE = [at(0, 0), at(250, 0), at(500, 0), at(500, 300), at(700, 300)];
const step = (type: string, modifier: string | undefined, loc: UiLatLng, d: number, s: number, instruction: string, streetName?: string): UiNavStep =>
  ({ maneuver: { type, modifier, location: loc }, distanceMeters: d, durationSeconds: s, instruction, streetName });
const STEPS: UiNavStep[] = [
  step('depart', undefined, at(0, 0), 500, 60, 'Head north on Majeedhee Magu', 'Majeedhee Magu'),
  step('turn', 'right', at(500, 0), 300, 40, 'Turn right onto Orchid Magu', 'Orchid Magu'),
  step('turn', 'left', at(500, 300), 200, 30, 'Turn left onto Chaandhanee Magu', 'Chaandhanee Magu'),
  step('arrive', undefined, at(700, 300), 0, 0, 'You have arrived'),
];

/** The point `d` m along the route, `side` m to the right of it (east on the north legs). */
function along(d: number, side = 0): UiLatLng {
  if (d <= 500) return at(d, side);
  if (d <= 800) return at(500 - side, d - 500);
  return at(500 + (d - 800), 300 + side);
}

/** Drives the route from 0 to `to` m in `every` m steps, a second apart, with a little sideways wobble. */
function drive(t: UiNavTracker, to = 1000, every = 10, t0 = 0) {
  const out: { d: number; state: ReturnType<UiNavTracker['update']> }[] = [];
  for (let d = 0, i = 0; d <= to; d += every, i++) {
    const p: UiNavPosition = { ...along(d, (i % 3) - 1), timestamp: t0 + i * 1000, speed: 10 };
    out.push({ d, state: t.update(p) });
  }
  return out;
}

describe('UiNavTracker (0.47.0)', () => {
  it('measures the route and puts each maneuver on it', () => {
    const t = new UiNavTracker(ROUTE, STEPS);
    expect(t.totalMeters).toBeCloseTo(1000, 0);
    expect(t.stepAlong.map((x) => Math.round(x))).toEqual([0, 500, 800, 1000]);
    expect(uiNavDistance(at(0, 0), at(500, 0))).toBeCloseTo(500, 0);
    expect(Math.round(uiNavBearing(at(0, 0), at(10, 0)))).toBe(0);
    expect(Math.round(uiNavBearing(at(0, 0), at(0, 10)))).toBe(90);
  });

  it('steps along a drive: the step, the maneuver ahead and the one after, distance to it, what is left', () => {
    const t = new UiNavTracker(ROUTE, STEPS);
    const states = drive(t);
    const byD = new Map(states.map((s) => [s.d, s.state]));
    const s100 = byD.get(100)!;
    expect([s100.stepIndex, s100.next?.instruction, s100.nextNext?.instruction]).toEqual([0, 'Turn right onto Orchid Magu', 'Turn left onto Chaandhanee Magu']);
    expect(s100.distanceToManeuver).toBeCloseTo(400, 0);
    expect(s100.remainingMeters).toBeCloseTo(900, 0);
    // 4/5 of the first step's 60 s, and the 70 s after it.
    expect(s100.remainingSeconds).toBeCloseTo(60 * 0.8 + 70, 0);
    const s600 = byD.get(600)!;
    expect([s600.stepIndex, s600.next?.maneuver.type, s600.nextNext?.maneuver.type]).toEqual([1, 'turn', 'arrive']);
    expect(s600.distanceToManeuver).toBeCloseTo(200, 0);
    const s900 = byD.get(900)!;
    expect([s900.stepIndex, s900.next?.maneuver.type, s900.nextNext]).toEqual([2, 'arrive', null]);
    expect(s900.distanceToManeuver).toBeCloseTo(100, 0);
    // The step index only goes up, and changes exactly at the maneuvers.
    const idx = states.map((s) => s.state.stepIndex);
    expect(idx.every((v, i) => i === 0 || v >= idx[i - 1])).toBe(true);
    expect(states.find((s) => s.state.stepIndex === 1)!.d).toBe(500);
    expect(states.find((s) => s.state.stepIndex === 2)!.d).toBe(800);
    // The wobble (1 m) stays on the route; the dot is drawn on it.
    expect(Math.max(...states.map((s) => s.state.distanceFromRoute))).toBeLessThan(1.5);
    expect(uiNavDistance(s100.display, along(100))).toBeLessThan(0.5);
  });

  it('announces each maneuver once on becoming the next one, and once at 200 m and at 30 m before it', () => {
    const t = new UiNavTracker(ROUTE, STEPS);
    const events = drive(t, 1000, 5).flatMap((s) => s.state.events.map((e) => ({ d: s.d, e })));
    const ann = events.filter((x) => x.e.type === 'announce') as { d: number; e: Extract<UiNavEvent, { type: 'announce' }> }[];
    const summary = ann.map((x) => `${x.e.stepIndex}:${x.e.reason}${x.e.threshold ?? ''}@${x.d}`);
    expect(summary).toEqual([
      '1:step@0', '1:distance200@300', '1:distance30@470', // the right turn, 500 m away at the start
      '2:step@500', '2:distance200@600', '2:distance30@770', // the left turn, 300 m on
      '3:step@800', '3:distance30@970', // the end, 200 m on: 200 is covered by the step announcement
    ]);
    // Each carries the step to speak and the distance at the time.
    expect(ann[1].e.step.instruction).toBe('Turn right onto Orchid Magu');
    expect(ann[1].e.distanceMeters).toBeLessThanOrEqual(200);
  });

  it('a short step: thresholds already passed on becoming the next one are not announced again', () => {
    const steps = [STEPS[0], step('turn', 'right', at(500, 0), 20, 5, 'Turn right'), step('turn', 'left', at(500, 20), 980, 60, 'Turn left'), step('arrive', undefined, at(700, 20), 0, 0, 'Arrive')];
    const route = [at(0, 0), at(500, 0), at(500, 20), at(700, 20)];
    const t = new UiNavTracker(route, steps);
    const pts = [...Array.from({ length: 51 }, (_, i) => at(i * 10, 0)), at(500, 5), at(500, 12), at(500, 18)];
    const ann = pts.flatMap((p, i) => t.update({ ...p, timestamp: i * 1000 }).events).filter((e) => e.type === 'announce') as Extract<UiNavEvent, { type: 'announce' }>[];
    const forStep2 = ann.filter((e) => e.stepIndex === 2).map((e) => `${e.reason}${e.threshold ?? ''}`);
    expect(forStep2).toEqual(['step']); // 20 m away when it became next: nothing more to say until it is passed
  });

  it('off the route for 5 s fires offRoute once, again only after coming back', () => {
    const t = new UiNavTracker(ROUTE, STEPS);
    t.update({ ...along(100), timestamp: 0 });
    const off = (s: number) => t.update({ ...along(110, 60), timestamp: s * 1000 });
    // Off from the fix at 1 s: 5 s later, at 6 s.
    const fired = [1, 2, 3, 4, 5.5, 6, 9].map((s) => off(s).events.filter((e) => e.type === 'offRoute').length);
    expect(fired).toEqual([0, 0, 0, 0, 0, 1, 0]);
    expect(off(10).offRoute).toBe(true);
    // Off the route, progress holds where it left the route.
    expect(off(11).traveledMeters).toBeCloseTo(100, 0);
    expect(t.update({ ...along(120), timestamp: 12000 }).offRoute).toBe(false);
    const again = [13, 15, 17.5, 18, 19].map((s) => off(s).events.filter((e) => e.type === 'offRoute').length);
    expect(again).toEqual([0, 0, 0, 1, 0]);
    // The off-route event says how far off.
    const t2 = new UiNavTracker(ROUTE, STEPS, { offRouteSeconds: 0 });
    const e = t2.update({ ...along(100, 80), timestamp: 0 }).events.find((x) => x.type === 'offRoute') as Extract<UiNavEvent, { type: 'offRoute' }>;
    expect(e.distanceMeters).toBeCloseTo(80, 0);
  });

  it('a poor fix (accuracy over the threshold) widens what counts as on the route', () => {
    const t = new UiNavTracker(ROUTE, STEPS, { offRouteSeconds: 0 });
    expect(t.update({ ...along(100, 60), accuracy: 80, timestamp: 0 }).events.some((e) => e.type === 'offRoute')).toBe(false);
    expect(t.update({ ...along(100, 60), accuracy: 10, timestamp: 1000 }).events.some((e) => e.type === 'offRoute')).toBe(true);
  });

  it('fires arrived once within 20 m of the end, and nothing after it', () => {
    const t = new UiNavTracker(ROUTE, STEPS);
    const states = drive(t, 1000, 5);
    const arrived = states.filter((s) => s.state.events.some((e) => e.type === 'arrived')).map((s) => s.d);
    expect(arrived).toEqual([980]);
    expect(states.filter((s) => s.d > 980).flatMap((s) => s.state.events)).toEqual([]);
    expect(states[states.length - 1].state.arrived).toBe(true);
    expect(states[states.length - 1].state.remainingSeconds).toBe(0);
  });

  it('does not slide back along a road that doubles back on itself', () => {
    const route = [at(0, 0), at(300, 0), at(300, 100), at(0, 100)];
    const steps = [step('depart', undefined, at(0, 0), 300, 30, 'North'), step('turn', 'uturn', at(300, 0), 400, 30, 'U-turn'), step('arrive', undefined, at(0, 100), 0, 0, 'Arrive')];
    const t = new UiNavTracker(route, steps, { offRouteSeconds: 0 });
    for (let d = 0; d <= 250; d += 10) t.update({ ...at(d, 0), timestamp: d * 100 });
    // On the way back, level with the way out: the way back wins.
    const back = t.update({ ...at(100, 100), timestamp: 30000 });
    expect(back.traveledMeters).toBeCloseTo(600, 0);
    // Back on the way out, behind: off the route, not pulled back.
    const behind = t.update({ ...at(100, 0), timestamp: 31000 });
    expect(behind.traveledMeters).toBeCloseTo(600, 0);
    expect(behind.events.some((e) => e.type === 'offRoute')).toBe(true);
  });

  it('points the map: the heading while moving, else the road', () => {
    const t = new UiNavTracker(ROUTE, STEPS);
    expect(t.update({ ...along(100), heading: 5, speed: 8, timestamp: 0 }).bearing).toBe(5);
    expect(Math.round(t.update({ ...along(600), timestamp: 1000 }).bearing)).toBe(90); // standing still on the east leg
    expect(Math.round(t.update({ ...along(600), heading: 270, speed: 0.2, timestamp: 2000 }).bearing)).toBe(90); // a heading from a standstill is noise
    expect(t.update({ ...along(600), heading: -10, timestamp: 3000 }).bearing).toBe(350);
  });

  it('splits the route at the person: the way behind and the way ahead meet there', () => {
    const t = new UiNavTracker(ROUTE, STEPS);
    const { traveled, remaining } = t.split(600);
    expect(traveled.slice(0, 3)).toEqual(ROUTE.slice(0, 3));
    expect(uiNavDistance(traveled[traveled.length - 1], along(600))).toBeLessThan(0.5);
    expect(remaining[0]).toEqual(traveled[traveled.length - 1]);
    expect(remaining.slice(1)).toEqual(ROUTE.slice(3));
  });
});

describe('navigation formatting (0.47.0)', () => {
  it('distances: 10 m steps under 100 m, 50 m under 1 km, then km', () => {
    const f = (m: number) => uiNavFormatDistance(m);
    expect([f(0), f(4), f(84), f(96), f(130), f(180), f(980), f(994), f(1000), f(2449), f(2000), f(12400)]).toEqual(
      ['0 m', '0 m', '80 m', '100 m', '150 m', '200 m', '1 km', '1 km', '1 km', '2.4 km', '2 km', '12 km'],
    );
    expect(uiNavFormatDistance(80, uiStringsDv)).toBe('80 މީޓަރު');
    expect(uiNavFormatDistance(2500, uiStringsDv)).toBe('2.5 ކިލޯމީޓަރު');
  });

  it('times: minutes rounded up, hours from 60', () => {
    const f = (s: number) => uiNavFormatDuration(s);
    expect([f(0), f(1), f(60), f(61), f(59 * 60), f(3600), f(3900), f(7200)]).toEqual(['0 min', '1 min', '1 min', '2 min', '59 min', '1 h', '1 h 5 min', '2 h']);
    expect(uiNavFormatDuration(300, uiStringsDv)).toBe('5 މިނެޓު');
    expect(uiNavFormatClock(new Date(2026, 9, 25, 9, 5).getTime())).toBe('09:05');
    expect(defaultUiStrings.navIn.replace('{distance}', '80 m')).toBe('in 80 m');
  });
});

describe('maneuver icons (0.47.0)', () => {
  it('picks a drawing for every OSRM type and modifier', () => {
    const k = (type: string, modifier?: string, drivingSide?: 'left' | 'right') => uiNavIconKind({ type, modifier, drivingSide });
    expect([k('depart'), k('arrive', 'left'), k('turn', 'left'), k('turn', 'right'), k('turn', 'slight left'), k('turn', 'sharp right'), k('continue'), k('new name', 'straight')]).toEqual(
      ['depart', 'arrive', 'left', 'right', 'slight-left', 'sharp-right', 'straight', 'straight'],
    );
    expect([k('roundabout', 'right'), k('rotary', 'slight left'), k('roundabout turn', 'straight'), k('exit roundabout', 'sharp left'), k('roundabout', 'uturn')]).toEqual(
      ['roundabout-right', 'roundabout-slight-left', 'roundabout-straight', 'roundabout-sharp-left', 'roundabout-uturn'],
    );
    expect([k('fork', 'slight left'), k('fork', 'right'), k('merge', 'slight left'), k('merge', 'slight right'), k('on ramp', 'left'), k('off ramp', 'slight right'), k('off ramp')]).toEqual(
      ['fork-left', 'fork-right', 'merge-left', 'merge-right', 'slight-left', 'slight-right', 'straight'],
    );
    expect([k('turn', 'uturn'), k('turn', 'uturn', 'left'), k('end of road', 'left'), k('notification', 'right'), k('something new')]).toEqual(['uturn-left', 'uturn-right', 'left', 'right', 'straight']);
  });

  it('every drawing is stroked in the current colour on the 24 grid, left and right are mirror images', () => {
    for (const [kind, icon] of Object.entries(UI_NAV_ICONS)) {
      expect(icon.length, kind).toBeGreaterThan(0);
      for (const [, attrs] of icon as unknown as [string, Record<string, string>][]) {
        expect(attrs['stroke'], kind).toBe('currentColor');
        for (const n of (attrs['d'] ?? '').match(/-?\d+(\.\d+)?/g) ?? []) expect(Math.abs(Number(n)), kind).toBeLessThanOrEqual(24);
      }
    }
    const mirror = (d: string) => d.replace(/([MLHVC])([^MLHVCZ]*)/g, (_, c: string, args: string) => {
      const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (c === 'V') return c + args;
      if (c === 'H') return c + n.map((x) => +(24 - x).toFixed(2)).join(' ');
      return c + n.map((x, i) => (i % 2 === 0 ? +(24 - x).toFixed(2) : x)).join(' ');
    });
    const ds = (kind: keyof typeof UI_NAV_ICONS) => (UI_NAV_ICONS[kind] as unknown as [string, Record<string, string>][]).map(([, a]) => a['d'] ?? '').map((d) => d.replace(/\s+/g, ' '));
    const norm = (d: string) => d.replace(/([MLHVC])\s*/g, '$1').replace(/(\d)\s+(?=-?\d)/g, '$1 ');
    for (const [l, r] of [['left', 'right'], ['slight-left', 'slight-right'], ['sharp-left', 'sharp-right'], ['uturn-left', 'uturn-right']] as const) {
      expect(ds(r).map(norm), r).toEqual(ds(l).map(mirror).map(norm));
    }
  });
});
