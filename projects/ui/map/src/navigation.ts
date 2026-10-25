import type { IconSvgObject } from '@hugeicons/angular';
import { defaultUiStrings, type UiStrings } from '@zouriel/ui';
import { uiMapPoint, type UiLatLng, type UiMapPoint } from './map';

/*
 * 0.47.0: turn-by-turn navigation logic, pure and testable, the same in the Flutter twin
 * (`navigation.dart`). The app feeds the route (OSRM geometry and steps) and live positions; this
 * works out where on the route the person is, the step they are on, the distance to the next
 * maneuver, what is left, and when to announce, when they are off the route and when they arrived.
 * The app speaks and reroutes.
 */

/** A maneuver, as OSRM gives it (`step.maneuver`): `type` and `modifier` keep OSRM's words. */
export interface UiNavManeuver {
  /** 'depart', 'turn', 'continue', 'new name', 'merge', 'on ramp', 'off ramp', 'fork', 'end of road', 'roundabout', 'rotary', 'roundabout turn', 'exit roundabout', 'notification', 'arrive', ... (snake_case 'end_of_road' works too, 0.47.1) */
  type: string;
  /** 'uturn', 'sharp right', 'right', 'slight right', 'straight', 'slight left', 'left', 'sharp left' (or 'sharp_right', 0.47.1). */
  modifier?: string;
  /** Where it happens: `{ lat, lng }` or `[lat, lng]` (OSRM's `location` is [lng, lat]: swap it). */
  location: UiMapPoint;
  /** The heading after it, degrees clockwise from north. */
  bearingAfter?: number;
  /** The roundabout exit to take (OSRM `maneuver.exit`), shown on the icon. */
  exit?: number;
  /** Which side traffic keeps to (OSRM `driving_side`): turns a U-turn's arrow the right way. 'right' by default. */
  drivingSide?: 'left' | 'right';
}

/** One step of the route (OSRM `route.legs[].steps[]`), with the app's already localized words. */
export interface UiNavStep {
  maneuver: UiNavManeuver;
  /** From this maneuver to the next, in metres. */
  distanceMeters: number;
  /** From this maneuver to the next, in seconds. */
  durationSeconds: number;
  /** What to do at this maneuver, in the app's language: "Turn left onto Majeedhee Magu". */
  instruction: string;
  /** The street after it, shown under the instruction. */
  streetName?: string;
}

/** Where the person is, from the app's own geolocation. */
export interface UiNavPosition extends UiLatLng {
  /** Direction of travel, degrees clockwise from north. */
  heading?: number;
  /** Metres per second. */
  speed?: number;
  /** Metres. */
  accuracy?: number;
  /** When it was measured, ms since the epoch (`GeolocationPosition.timestamp`); now when left out. */
  timestamp?: number;
}

/** Tuning for `UiNavTracker`. */
export interface UiNavOptions {
  /** Further than this from the route (or the position's accuracy, if bigger) counts as off it; 40 m. */
  offRouteMeters?: number;
  /** Off the route this long before `offRoute` fires; 5 s. */
  offRouteSeconds?: number;
  /** This close to the end counts as arrived; 20 m. */
  arriveMeters?: number;
  /** Distances before a maneuver that each fire one `announce`; [200, 30]. */
  announceMeters?: readonly number[];
}

export const UI_NAV_OFF_ROUTE_METERS = 40;
export const UI_NAV_OFF_ROUTE_SECONDS = 5;
export const UI_NAV_ARRIVE_METERS = 20;
export const UI_NAV_ANNOUNCE_METERS: readonly number[] = [200, 30];

/** Something the app may act on, from one `update`. */
export type UiNavEvent =
  /**
   * Time to speak: `reason` 'step' when a new maneuver becomes the next one (and at the start),
   * 'distance' when it comes within one of `announceMeters` (`threshold`). Each fires once per step.
   */
  | { type: 'announce'; reason: 'step' | 'distance'; stepIndex: number; step: UiNavStep; distanceMeters: number; threshold?: number }
  /** Off the route for `offRouteSeconds`: reroute. Fires again only after coming back to the route. */
  | { type: 'offRoute'; distanceMeters: number; position: UiNavPosition }
  /** Within `arriveMeters` of the end. Once. */
  | { type: 'arrived' };

/** Where the person is on the route, after an `update`. */
export interface UiNavState {
  /** The position put on the route (the nearest point of it). */
  snapped: UiLatLng;
  /** Where to draw the person: on the route while on it, else where they are. */
  display: UiLatLng;
  /** Metres from the position to the route. */
  distanceFromRoute: number;
  /** Metres along the route from its start to `snapped`. */
  traveledMeters: number;
  /** The index of the route point at the start of the segment `snapped` is on. */
  segmentIndex: number;
  /** The step being driven (its maneuver is behind). */
  stepIndex: number;
  /** The maneuver ahead: `steps[stepIndex + 1]`, or null past the last one. */
  next: UiNavStep | null;
  /** The one after that, or null. */
  nextNext: UiNavStep | null;
  /** Metres to the maneuver ahead (to the end with none). */
  distanceToManeuver: number;
  remainingMeters: number;
  remainingSeconds: number;
  /** The way to point the map, degrees clockwise from north: the heading while moving, else the road's. */
  bearing: number;
  offRoute: boolean;
  arrived: boolean;
  /** What happened in this update. */
  events: UiNavEvent[];
}

/** The Earth's radius the tracker measures with, in metres. */
const R = 6371000;
const RAD = Math.PI / 180;

/** Great-circle metres between two points. */
export function uiNavDistance(a: UiLatLng, b: UiLatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The compass bearing from `a` to `b`, degrees clockwise from north in 0..360. */
export function uiNavBearing(a: UiLatLng, b: UiLatLng): number {
  const y = Math.sin((b.lng - a.lng) * RAD) * Math.cos(b.lat * RAD);
  const x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lng - a.lng) * RAD);
  return ((Math.atan2(y, x) / RAD) % 360 + 360) % 360;
}

/** A point on segment `i` of the route, `t` (0..1) of the way along it. */
interface Snap {
  i: number;
  t: number;
  along: number;
  dist: number;
}

/**
 * Follows a person along a route (0.47.0, Flutter `UiNavTracker`). Make one per route (a reroute is
 * a new tracker) and call `update` with each position; it returns the state and the events of that
 * update. Pure: no timers, the clock is the positions' `timestamp`.
 *
 * Positions snap to the nearest point of the route at or past the last one (less 50 m), so a road
 * that doubles back doesn't pull the person backwards; going back further is being off the route.
 */
export class UiNavTracker {
  readonly points: UiLatLng[];
  readonly steps: readonly UiNavStep[];
  readonly totalMeters: number;
  private readonly opts: Required<UiNavOptions>;
  /** Local metres (x east, y north) of each route point, around the route's first point. */
  private readonly xy: [number, number][];
  /** Metres along the route at each point. */
  private readonly cum: number[];
  /** Metres along the route at each step's maneuver. */
  readonly stepAlong: number[];
  private readonly kx: number;
  private last: UiNavState | null = null;
  private lastAlong = 0;
  private announcedStep = -1;
  private fired = new Set<number>();
  private offSince: number | null = null;
  private offFired = false;
  private arrivedFired = false;

  constructor(route: readonly UiMapPoint[], steps: readonly UiNavStep[], options: UiNavOptions = {}) {
    this.points = route.map((p) => ({ ...uiMapPoint(p) }));
    this.steps = steps;
    this.opts = {
      offRouteMeters: options.offRouteMeters ?? UI_NAV_OFF_ROUTE_METERS,
      offRouteSeconds: options.offRouteSeconds ?? UI_NAV_OFF_ROUTE_SECONDS,
      arriveMeters: options.arriveMeters ?? UI_NAV_ARRIVE_METERS,
      announceMeters: [...(options.announceMeters ?? UI_NAV_ANNOUNCE_METERS)].sort((a, b) => b - a),
    };
    const o = this.points[0] ?? { lat: 0, lng: 0 };
    this.kx = Math.cos(o.lat * RAD);
    this.xy = this.points.map((p) => this.local(p));
    this.cum = [0];
    for (let i = 1; i < this.xy.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.xy[i][0] - this.xy[i - 1][0], this.xy[i][1] - this.xy[i - 1][1]));
    this.totalMeters = this.cum[this.cum.length - 1] ?? 0;
    // Each maneuver's place on the route, never before the one before it.
    this.stepAlong = [];
    let from = 0;
    for (const s of steps) {
      const snap = this.snap(uiMapPoint(s.maneuver.location), from);
      this.stepAlong.push(snap ? snap.along : from);
      if (snap) from = snap.along;
    }
    if (this.stepAlong.length) this.stepAlong[0] = 0;
  }

  /** The state after the last `update`, or null before the first. */
  get state(): UiNavState | null {
    return this.last;
  }

  private local(p: UiLatLng): [number, number] {
    const o = this.points[0];
    return [(p.lng - o.lng) * RAD * R * this.kx, (p.lat - o.lat) * RAD * R];
  }

  /** The nearest point of the route at or past `fromAlong` metres. */
  private snap(p: UiLatLng, fromAlong: number): Snap | null {
    const n = this.xy.length;
    if (n === 0) return null;
    const [px, py] = this.local(p);
    if (n === 1) return { i: 0, t: 0, along: 0, dist: Math.hypot(px - this.xy[0][0], py - this.xy[0][1]) };
    let best: Snap | null = null;
    for (let i = 0; i < n - 1; i++) {
      if (this.cum[i + 1] < fromAlong) continue;
      const [ax, ay] = this.xy[i];
      const [bx, by] = this.xy[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const along = this.cum[i] + t * (this.cum[i + 1] - this.cum[i]);
      if (along < fromAlong) {
        t = this.cum[i + 1] > this.cum[i] ? (fromAlong - this.cum[i]) / (this.cum[i + 1] - this.cum[i]) : 0;
      }
      const qx = ax + t * dx;
      const qy = ay + t * dy;
      const dist = Math.hypot(px - qx, py - qy);
      // Strictly nearer wins, so the earliest of equally near points is kept.
      if (!best || dist < best.dist - 1e-9) best = { i, t, along: Math.max(along, fromAlong), dist };
    }
    return best;
  }

  /** The point `along` metres from the start, and the segment it is on. */
  pointAt(along: number): { point: UiLatLng; segment: number } {
    const n = this.points.length;
    if (n < 2) return { point: { ...(this.points[0] ?? { lat: 0, lng: 0 }) }, segment: 0 };
    const a = Math.max(0, Math.min(this.totalMeters, along));
    let i = 0;
    while (i < n - 2 && this.cum[i + 1] < a) i++;
    const seg = this.cum[i + 1] - this.cum[i];
    const t = seg > 0 ? (a - this.cum[i]) / seg : 0;
    const p = this.points[i];
    const q = this.points[i + 1];
    return { point: { lat: p.lat + (q.lat - p.lat) * t, lng: p.lng + (q.lng - p.lng) * t }, segment: i };
  }

  /** The route from its start to `along` metres (travelled) and from there to its end (to go). */
  split(along: number): { traveled: UiLatLng[]; remaining: UiLatLng[] } {
    const { point, segment } = this.pointAt(along);
    return {
      traveled: [...this.points.slice(0, segment + 1), point],
      remaining: [point, ...this.points.slice(segment + 1)],
    };
  }

  /** Takes a position: where it is on the route, what is next, and what happened. */
  update(position: UiNavPosition): UiNavState {
    const now = position.timestamp ?? Date.now();
    const o = this.opts;
    const events: UiNavEvent[] = [];
    const snap = this.snap(position, Math.max(0, this.lastAlong - 50)) ?? { i: 0, t: 0, along: 0, dist: 0 };
    const limit = Math.max(o.offRouteMeters, position.accuracy ?? 0);
    const on = snap.dist <= limit;
    // Progress only moves on while on the route; off it, the last place on it holds.
    const along = on ? Math.max(snap.along, this.lastAlong) : this.lastAlong;
    if (on) this.lastAlong = along;
    const at = this.pointAt(along);

    // The step being driven: the last maneuver at or behind.
    let stepIndex = 0;
    for (let k = 0; k < this.stepAlong.length; k++) if (this.stepAlong[k] <= along + 1e-6) stepIndex = k;
    // Past the arrive maneuver's place there is nothing ahead: stay on the step before it.
    if (this.steps.length > 1 && stepIndex === this.steps.length - 1) stepIndex = this.steps.length - 2;
    const next = this.steps[stepIndex + 1] ?? null;
    const nextNext = this.steps[stepIndex + 2] ?? null;
    const nextAlong = next ? this.stepAlong[stepIndex + 1] : this.totalMeters;
    const distanceToManeuver = Math.max(0, nextAlong - along);
    const remainingMeters = Math.max(0, this.totalMeters - along);
    let remainingSeconds = 0;
    if (this.steps.length) {
      const s = this.steps[stepIndex];
      const span = nextAlong - this.stepAlong[stepIndex];
      const left = span > 0 ? Math.min(1, Math.max(0, (nextAlong - along) / span)) : 0;
      remainingSeconds = s.durationSeconds * left;
      for (let k = stepIndex + 1; k < this.steps.length; k++) remainingSeconds += this.steps[k].durationSeconds;
    }

    // Arrived: near the end, on the route or straight there.
    const end = this.points[this.points.length - 1];
    const arrivedNow = !!end && (uiNavDistance(position, end) <= o.arriveMeters || (on && remainingMeters <= o.arriveMeters));
    if (arrivedNow && !this.arrivedFired) {
      this.arrivedFired = true;
      events.push({ type: 'arrived' });
    }

    // Announcements, for the maneuver ahead.
    if (next && !this.arrivedFired) {
      if (this.announcedStep !== stepIndex + 1) {
        this.announcedStep = stepIndex + 1;
        this.fired = new Set(o.announceMeters.filter((t) => distanceToManeuver <= t));
        events.push({ type: 'announce', reason: 'step', stepIndex: stepIndex + 1, step: next, distanceMeters: distanceToManeuver });
      } else if (on) {
        for (const t of o.announceMeters) {
          if (distanceToManeuver <= t && !this.fired.has(t)) {
            for (const u of o.announceMeters) if (u >= t) this.fired.add(u);
            events.push({ type: 'announce', reason: 'distance', stepIndex: stepIndex + 1, step: next, distanceMeters: distanceToManeuver, threshold: t });
          }
        }
      }
    }

    // Off the route for long enough: once, until back on it.
    if (on) {
      this.offSince = null;
      this.offFired = false;
    } else if (!this.arrivedFired) {
      this.offSince ??= now;
      if (!this.offFired && now - this.offSince >= o.offRouteSeconds * 1000) {
        this.offFired = true;
        events.push({ type: 'offRoute', distanceMeters: snap.dist, position });
      }
    }

    // Heading-up: the direction of travel while moving, else the road's.
    let bearing = this.last?.bearing ?? 0;
    const moving = position.heading !== undefined && position.heading !== null && (position.speed === undefined || position.speed >= 1);
    if (moving) bearing = ((position.heading! % 360) + 360) % 360;
    else if (on && this.points.length > 1) {
      const seg = at.segment;
      bearing = uiNavBearing(this.points[seg], this.points[Math.min(this.points.length - 1, seg + 1)]);
    }

    const state: UiNavState = {
      snapped: at.point,
      display: on ? at.point : { lat: position.lat, lng: position.lng },
      distanceFromRoute: snap.dist,
      traveledMeters: along,
      segmentIndex: at.segment,
      stepIndex,
      next,
      nextNext,
      distanceToManeuver,
      remainingMeters,
      remainingSeconds,
      bearing,
      offRoute: this.offFired,
      arrived: this.arrivedFired,
      events,
    };
    this.last = state;
    return state;
  }
}

/** Words the navigation view formats with. */
export type UiNavStrings = Pick<UiStrings, 'navMeters' | 'navKilometers' | 'navMinutes' | 'navHours' | 'navHoursMinutes'>;

/**
 * A distance to say or show (0.47.0, Flutter `uiNavFormatDistance`): under 100 m to the nearest
 * 10 m, under 1 km to the nearest 50 m, under 10 km in km with one decimal ("2.5 km", "2 km"), then
 * whole km. Units from `navMeters` / `navKilometers` (`{n}`).
 */
export function uiNavFormatDistance(m: number, strings: Pick<UiStrings, 'navMeters' | 'navKilometers'> = defaultUiStrings): string {
  const v = Math.max(0, m);
  if (v < 1000) {
    const r = v < 100 ? Math.round(v / 10) * 10 : Math.round(v / 50) * 50;
    if (r < 1000) return strings.navMeters.replace('{n}', String(r));
  }
  const km = v < 9950 ? String(Math.round(v / 100) / 10) : String(Math.round(v / 1000));
  return strings.navKilometers.replace('{n}', km);
}

/**
 * A time left (0.47.0, Flutter `uiNavFormatDuration`): whole minutes rounded up ("1 min" for any
 * part of one, "0 min" at none), and from an hour "1 h 5 min" / "2 h".
 */
export function uiNavFormatDuration(seconds: number, strings: Pick<UiStrings, 'navMinutes' | 'navHours' | 'navHoursMinutes'> = defaultUiStrings): string {
  const min = Math.max(0, Math.ceil(seconds / 60 - 1e-9));
  if (min < 60) return strings.navMinutes.replace('{min}', String(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? strings.navHoursMinutes.replace('{h}', String(h)).replace('{min}', String(m)) : strings.navHours.replace('{h}', String(h));
}

/** A clock time, 24-hour "14:05" (0.47.0, Flutter `uiNavFormatClock`); the view's default for the arrival time. */
export function uiNavFormatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The drawings the maneuver icons come in. */
export type UiNavIconKind =
  | 'depart' | 'arrive' | 'straight'
  | 'slight-left' | 'slight-right' | 'left' | 'right' | 'sharp-left' | 'sharp-right' | 'uturn-left' | 'uturn-right'
  | 'roundabout-straight' | 'roundabout-slight-left' | 'roundabout-slight-right' | 'roundabout-left' | 'roundabout-right'
  | 'roundabout-sharp-left' | 'roundabout-sharp-right' | 'roundabout-uturn'
  | 'fork-left' | 'fork-right' | 'merge-left' | 'merge-right';

type Dir = 'straight' | 'slight-left' | 'slight-right' | 'left' | 'right' | 'sharp-left' | 'sharp-right' | 'uturn';

/**
 * A maneuver word in OSRM's spaced form (0.47.1, Flutter `uiNavWord`): lower case, with underscores
 * and hyphens as spaces, so 'sharp_right', 'END_OF_ROAD', 'sharp-right' and 'sharp right' are the same.
 */
export function uiNavWord(word: string | null | undefined): string {
  return (word ?? '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function dirOf(modifier: string | undefined): Dir {
  switch (uiNavWord(modifier)) {
    case 'uturn': case 'u turn': return 'uturn';
    case 'sharp right': return 'sharp-right';
    case 'right': return 'right';
    case 'slight right': return 'slight-right';
    case 'slight left': return 'slight-left';
    case 'left': return 'left';
    case 'sharp left': return 'sharp-left';
    default: return 'straight';
  }
}

/**
 * Which drawing a maneuver gets (0.47.0, Flutter `uiNavIconKind`): roundabouts and rotaries by
 * their exit's direction, forks and merges by side, ramps as slight turns, depart and arrive their
 * own, everything else by its modifier. A U-turn bends left where traffic keeps right and right
 * where it keeps left. Never mirrored for right-to-left text: left means left. Type and modifier may
 * be OSRM's spaced words ('end of road', 'sharp right') or snake_case ('end_of_road', 'sharp_right'), 0.47.1.
 */
export function uiNavIconKind(m: Pick<UiNavManeuver, 'type' | 'modifier' | 'drivingSide'>): UiNavIconKind {
  const type = uiNavWord(m.type);
  const dir = dirOf(m.modifier);
  const side = uiNavWord(m.modifier).includes('left') ? 'left' : 'right';
  switch (type) {
    case 'depart': return 'depart';
    case 'arrive': return 'arrive';
    case 'roundabout': case 'rotary': case 'roundabout turn': case 'exit roundabout': case 'exit rotary':
      return `roundabout-${dir}` as UiNavIconKind;
    case 'fork': return `fork-${side}`;
    case 'merge': return `merge-${side}`;
    case 'on ramp': case 'off ramp':
      return dir === 'straight' ? 'straight' : (`slight-${side}` as UiNavIconKind);
  }
  if (dir === 'uturn') return m.drivingSide === 'left' ? 'uturn-right' : 'uturn-left';
  return dir;
}

const line = (d: string, extra: Record<string, string> = {}) =>
  ['path', { d, stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', ...extra }] as const;
const ring = (cx: number, cy: number, r: number) =>
  ['circle', { cx: String(cx), cy: String(cy), r: String(r), stroke: 'currentColor', strokeWidth: '2' }] as const;
/** The road not taken at a fork or merge: drawn faint (hugeicons' secondary layer). */
const faint = { opacity: '0.4' };

/**
 * The maneuver drawings (0.47.0), in hugeicons' format on a 24px grid, stroked in the current
 * colour: the same data as the Flutter twin's `uiNavIcons`, drawn with `hugeicons-icon` there and
 * `UiIcon` here. Hugeicons has no maneuver set (no roundabout exits, slight or sharp turns), so
 * these are the library's own, in its line style.
 */
export const UI_NAV_ICONS: Record<UiNavIconKind, IconSvgObject> = {
  depart: [ring(12, 18.5, 2), line('M12 16.5V4'), line('M7 9L12 4L17 9')],
  arrive: [line('M12 21C12 21 19 15.5 19 10C19 6.13 15.87 3 12 3C8.13 3 5 6.13 5 10C5 15.5 12 21 12 21Z'), ring(12, 10, 2.5)],
  straight: [line('M12 20V4'), line('M7 9L12 4L17 9')],
  right: [line('M7 20V13C7 10.79 8.79 9 11 9H19'), line('M15 5L19 9L15 13')],
  left: [line('M17 20V13C17 10.79 15.21 9 13 9H5'), line('M9 5L5 9L9 13')],
  'slight-right': [line('M9 20V14.83C9 13.77 9.42 12.75 10.17 12L17 5.17'), line('M11.5 5H17V10.5')],
  'slight-left': [line('M15 20V14.83C15 13.77 14.58 12.75 13.83 12L7 5.17'), line('M12.5 5H7V10.5')],
  'sharp-right': [line('M8 20V7L17 16'), line('M17 10.5V16H11.5')],
  'sharp-left': [line('M16 20V7L7 16'), line('M7 10.5V16H12.5')],
  'uturn-left': [line('M16 20V10C16 7.79 14.21 6 12 6C9.79 6 8 7.79 8 10V17'), line('M5 14L8 17L11 14')],
  'uturn-right': [line('M8 20V10C8 7.79 9.79 6 12 6C14.21 6 16 7.79 16 10V17'), line('M19 14L16 17L13 14')],
  'roundabout-straight': [ring(12, 11, 3.5), line('M12 21V14.5'), line('M12 7.5V3'), line('M9 6L12 3L15 6')],
  'roundabout-right': [ring(12, 11, 3.5), line('M12 21V14.5'), line('M15.5 11H21'), line('M18 8L21 11L18 14')],
  'roundabout-left': [ring(12, 11, 3.5), line('M12 21V14.5'), line('M8.5 11H3'), line('M6 8L3 11L6 14')],
  'roundabout-slight-right': [ring(12, 11, 3.5), line('M12 21V14.5'), line('M14.47 8.53L19 4'), line('M14.5 4H19V8.5')],
  'roundabout-slight-left': [ring(12, 11, 3.5), line('M12 21V14.5'), line('M9.53 8.53L5 4'), line('M9.5 4H5V8.5')],
  'roundabout-sharp-right': [ring(12, 11, 3.5), line('M12 21V14.5'), line('M14.47 13.47L19 18'), line('M19 13.5V18H14.5')],
  'roundabout-sharp-left': [ring(12, 11, 3.5), line('M12 21V14.5'), line('M9.53 13.47L5 18'), line('M5 13.5V18H9.5')],
  'roundabout-uturn': [ring(12, 11, 3.5), line('M12 21V14.5'), line('M8.5 11V20'), line('M5.5 17L8.5 20L11.5 17')],
  'fork-left': [line('M12 21V14'), line('M12 14L7 7'), line('M7 12V7H12'), line('M12 14L17 7', faint)],
  'fork-right': [line('M12 21V14'), line('M12 14L17 7'), line('M12 7H17V12'), line('M12 14L7 7', faint)],
  'merge-left': [line('M12 12V3'), line('M9 6L12 3L15 6'), line('M17 21V18C17 15.24 12 14.76 12 12'), line('M7 21V18C7 15.24 12 14.76 12 12', faint)],
  'merge-right': [line('M12 12V3'), line('M9 6L12 3L15 6'), line('M7 21V18C7 15.24 12 14.76 12 12'), line('M17 21V18C17 15.24 12 14.76 12 12', faint)],
} as unknown as Record<UiNavIconKind, IconSvgObject>;

/** The drawing for a maneuver (0.47.0, Flutter `uiNavIcon`). */
export function uiNavIcon(m: Pick<UiNavManeuver, 'type' | 'modifier' | 'drivingSide'>): IconSvgObject {
  return UI_NAV_ICONS[uiNavIconKind(m)];
}

/**
 * The status pill's text cut to whole words (0.47.2, Flutter `uiNavFitWords`): `text` when it `fits`;
 * otherwise the most words from its start that fit with an ellipsis after them, so the pill's second
 * line ends on a word, never in the middle of one (a trailing comma or colon before the ellipsis goes).
 * When not even the first word fits, `text` (the pill's own ellipsis cuts that one word). Whitespace
 * runs become single spaces. `fits` is the caller's measure: two lines in the pill's width.
 */
export function uiNavFitWords(text: string, fits: (candidate: string) => boolean): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t || fits(t)) return t;
  const words = t.split(' ');
  const cut = (n: number) => `${words.slice(0, n).join(' ').replace(/[\s,،;:.\-–—]+$/u, '')}…`;
  // lo: the most words known to fit (0: none yet); never all of them, which didn't fit.
  let lo = 0;
  let hi = words.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(cut(mid))) lo = mid;
    else hi = mid - 1;
  }
  return lo ? cut(lo) : t;
}
