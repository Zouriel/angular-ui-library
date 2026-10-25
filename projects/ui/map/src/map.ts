import { isPlatformBrowser } from '@angular/common';
import {
  Component, DestroyRef, booleanAttribute, ElementRef, InjectionToken, NgZone, PLATFORM_ID, ViewEncapsulation, afterNextRender, effect, inject, input, model, output, signal, untracked,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';
import Gps01Icon from '@hugeicons/core-free-icons/Gps01Icon';
import GpsOff01Icon from '@hugeicons/core-free-icons/GpsOff01Icon';
import ArrowExpand01Icon from '@hugeicons/core-free-icons/ArrowExpand01Icon';
import { defaultUiStrings, injectUiStrings, uiWatchTheme, type UiStatus, type UiStrings, UiDirectionService } from '@zouriel/ui';
import { UiTooltip } from '@zouriel/ui/overlay';

/**
 * How ui-map loads Leaflet: `import('leaflet')` by default. Provide another loader to test a map
 * without the network or to control when Leaflet arrives.
 */
export const UI_MAP_LEAFLET = new InjectionToken<() => Promise<unknown>>('UI_MAP_LEAFLET', {
  providedIn: 'root',
  factory: () => () => import('leaflet'),
});

/** A point on the map. */
export interface UiLatLng {
  lat: number;
  lng: number;
}

/** A marker: a tone-coloured dot with an optional label beside it. */
export interface UiMapMarker extends UiLatLng {
  id: string;
  tone?: UiStatus;
  label?: string;
  /** The marker's accessible name when the label doesn't say enough, or there is no label. */
  ariaLabel?: string;
}

/** Where the map is looking, after the person (or the app) moved it. */
export interface UiMapView extends UiLatLng {
  zoom: number;
}

/**
 * The "searching" animation: soft rings radiating from a point on the map while `active` (true by
 * default). Under reduced motion, one still halo instead.
 */
export interface UiMapPulse extends UiLatLng {
  /** The rings' colour; 'primary' by default. */
  tone?: UiStatus;
  /** False shows nothing (and runs nothing); true or left out shows the rings. */
  active?: boolean;
}

/**
 * How much of the map, in px from each edge, is covered by something floating over it: a bottom
 * sheet, a status card. `start`/`end` follow the reading direction.
 */
export interface UiMapInsets {
  top?: number;
  bottom?: number;
  start?: number;
  end?: number;
}

/** Where the person is, from the app's own geolocation: the "you are here" dot. */
export interface UiMapUserLocation extends UiLatLng {
  /** How sure the position is, in metres: drawn as a soft halo of that radius (clamped on screen). */
  accuracy?: number;
  /**
   * The direction of travel, degrees clockwise from north (0.47.0): the dot becomes an arrow
   * pointing that way on the map (it turns with a rotated map). Left out: the round dot.
   */
  heading?: number;
}

/** The smallest and largest the accuracy halo is drawn, in px across. */
export const UI_MAP_ACCURACY_MIN = 28;
export const UI_MAP_ACCURACY_MAX = 240;

/**
 * How many px across the accuracy halo is: twice `accuracy` metres at `zoom` and `lat` (Web
 * Mercator, 256 px per tile at zoom 0), clamped to 28..240 so it never vanishes or swamps the map.
 * 0 without an accuracy.
 */
export function uiMapAccuracyPx(accuracy: number | undefined, lat: number, zoom: number): number {
  if (accuracy === undefined || !(accuracy > 0)) return 0;
  const metresPerPx = uiMapMetersPerPx(lat, zoom);
  return Math.min(UI_MAP_ACCURACY_MAX, Math.max(UI_MAP_ACCURACY_MIN, Math.round((2 * accuracy) / metresPerPx)));
}

/**
 * The "you are here" HTML: the halo (when sized) under a dot with a white ring; with a `heading`
 * (0.47.0) a bigger puck with an arrow turned to it instead of the dot.
 */
export function uiMapUserHtml(halo: number, heading?: number): string {
  const h = halo ? `<span class="ui-map-user-halo" style="width:${halo}px;height:${halo}px;left:${-halo / 2}px;top:${-halo / 2}px"></span>` : '';
  if (heading === undefined || heading === null || !Number.isFinite(heading)) return `${h}<span class="ui-map-user-dot"></span>`;
  const deg = Math.round((((heading % 360) + 360) % 360) * 10) / 10;
  return `${h}<span class="ui-map-user-puck" style="transform:rotate(${deg}deg)"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3.5L18.5 19.5L12 15.6L5.5 19.5Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>`;
}

/**
 * The rotation a map with `bearing` (0.47.0) gives a point: where `p`, a point of the unrotated map
 * (Leaflet's container point), appears on screen when the map is turned about `pivot` so that the
 * compass direction `bearing` is up. `inverse` goes back, from the screen to the unrotated map.
 */
export function uiMapRotatePoint(p: { x: number; y: number }, pivot: { x: number; y: number }, bearing: number, inverse = false): { x: number; y: number } {
  const a = ((inverse ? bearing : -bearing) * Math.PI) / 180;
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return { x: pivot.x + dx * Math.cos(a) - dy * Math.sin(a), y: pivot.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

/**
 * A search area on the map (0.44.0, Flutter `UiMapArea`): a soft circle of `radiusMeters` around a
 * point, in true metres (it scales with the zoom). `editable` adds a round handle on the circle's
 * inline-end edge (east; west in RTL) that drags the radius between `minMeters` and `maxMeters`, with
 * a chip showing it ("20 km"); it is a slider for keyboards and screen readers.
 */
export interface UiMapArea extends UiLatLng {
  radiusMeters: number;
  /** The circle's colour; 'primary' by default. */
  tone?: UiStatus;
  /** A drag handle (and slider) that changes the radius; false by default. */
  editable?: boolean;
  /** The smallest radius the handle gives; 200 by default. */
  minMeters?: number;
  /** The largest radius the handle gives; 50000 by default. */
  maxMeters?: number;
}

/** The default smallest and largest radius of an editable area, in metres. */
export const UI_MAP_AREA_MIN = 200;
export const UI_MAP_AREA_MAX = 50000;

/** The Earth's radius the area's fit uses, in metres (Leaflet's `CRS.Earth.R`). */
const EARTH_R = 6371000;

/**
 * How many metres one px covers at `lat` and `zoom` (0.44.0; Web Mercator, 256 px per tile at zoom
 * 0): the scale the accuracy halo and the search area are drawn at.
 */
export function uiMapMetersPerPx(lat: number, zoom: number): number {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** (zoom + 8);
}

/** The step a radius moves in: 10 m under 1 km, 100 m under 10 km, 1 km above. */
function radiusUnit(m: number): number {
  return m < 1000 ? 10 : m < 10000 ? 100 : 1000;
}

/** A radius rounded to a figure people say (0.44.0): to 10 m under 1 km, 100 m under 10 km, else 1 km. */
export function uiMapNiceRadius(m: number): number {
  const u = radiusUnit(m);
  return Math.round(m / u) * u;
}

/**
 * The radius one keyboard step away (0.44.0): about 10% bigger (`dir` 1) or smaller (`dir` -1),
 * rounded with `uiMapNiceRadius` and at least one unit on, kept within `min`..`max`.
 */
export function uiMapAreaStep(radius: number, dir: 1 | -1, min: number, max: number): number {
  let next = uiMapNiceRadius(dir > 0 ? radius * 1.1 : radius / 1.1);
  if (dir > 0 && next <= radius) next = radius + radiusUnit(radius);
  if (dir < 0 && next >= radius) next = radius - radiusUnit(radius - 1);
  return Math.min(max, Math.max(min, next));
}

/**
 * A radius in words (0.44.0, Flutter `uiMapFormatRadius`): "800 m" under 1 km, "1.5 km" (one
 * decimal, "2 km" without a trailing .0) under 10 km, "20 km" above. The units come from the
 * `mapRadiusMeters` / `mapRadiusKilometers` strings (`{n}` is the number).
 */
export function uiMapFormatRadius(m: number, strings: Pick<UiStrings, 'mapRadiusMeters' | 'mapRadiusKilometers'> = defaultUiStrings): string {
  if (m < 1000) return strings.mapRadiusMeters.replace('{n}', String(Math.round(m)));
  const km = m < 10000 ? String(Math.round(m / 100) / 10) : String(Math.round(m / 1000));
  return strings.mapRadiusKilometers.replace('{n}', km);
}

/** The circle's top, bottom, east and west points, for fitting it into view. */
export function uiMapAreaBounds(a: UiLatLng & { radiusMeters: number }): UiLatLng[] {
  const dLat = (a.radiusMeters / EARTH_R) * (180 / Math.PI);
  const dLng = dLat / Math.max(1e-9, Math.cos((a.lat * Math.PI) / 180));
  return [
    { lat: a.lat + dLat, lng: a.lng },
    { lat: a.lat - dLat, lng: a.lng },
    { lat: a.lat, lng: a.lng + dLng },
    { lat: a.lat, lng: a.lng - dLng },
  ];
}

/** A point given as `{ lat, lng }` or as `[lat, lng]` (the order OSRM's GeoJSON is not: swap those). */
export type UiMapPoint = UiLatLng | readonly [number, number];

/** A route line's colour: the theme's `--ui-map-route-<tone>` token. */
export type UiMapRouteTone = 'primary' | 'muted' | 'success' | 'warning' | 'danger';

/**
 * A route drawn on the map: a line in its tone over a casing, under the dots, markers and the pin.
 * `label` is its one accessible name ("Route, 1.2 km"), from the app.
 */
export interface UiMapRoute {
  id: string;
  points: readonly UiMapPoint[];
  /** The line's colour; 'primary' by default. */
  tone?: UiMapRouteTone;
  /** What screen readers hear for the route, e.g. "Route, 1.2 km"; without it the route is not read out. */
  label?: string;
  /**
   * Draw it in from start to end when it appears or its points change (0.46.2); true by default.
   * False draws it at once. Never animated under reduced motion or on a preview.
   */
  animate?: boolean;
  /** The line's opacity over its casing, 0..1 (0.47.0); 1 by default. A navigation view draws the way behind at 0.6. */
  opacity?: number;
}

/** Px of room kept free on each (physical) side by `fitPoints`, on top of the insets. */
export interface UiMapPadding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/** Options for `fitPoints`. */
export interface UiMapFitOptions {
  /** Room kept free inside the visible part, px per side or one number for all; 24 by default. */
  padding?: number | UiMapPadding;
  /** The closest it zooms in, and the zoom for a single point; 17 by default. */
  maxZoom?: number;
  /** Animate the move (never under reduced motion); true by default. */
  animate?: boolean;
}

/**
 * An app's own button on the map (0.42.1, Flutter `UiMapControl`), drawn in the same stack and style
 * as the "Show my location" button: round, raised, at the bottom-end of the visible part, above the
 * locate button; 48px targets on touch. Pressing it emits `(controlPress)` with the control.
 * For "Show both": `{ id: 'fit', icon: CenterFocusIcon, label: strings.mapShowBoth }` (the built-in word, so it
 * follows the app's language; recompute the array when the language changes) and
 * `(controlPress)="map.fitPoints([me, patient])"`.
 */
export interface UiMapControl {
  /** Identifies the control (tracked by it: keep it stable). */
  id: string;
  /** A hugeicons icon, imported one file per icon. */
  icon: IconSvgObject;
  /** Its accessible name, read out for the icon. */
  label: string;
  /** Shown beside it on hover and focus; none by default. */
  tooltip?: string;
  /** Shown but not pressable. */
  disabled?: boolean;
}

/** Which side of its dot a marker label sits on, on screen. */
export type UiMapLabelSide = 'left' | 'right';

/**
 * Which marker labels a map shows (0.43.0, Flutter `UiMapMarkerLabels`): every one ('all', the
 * default), only the selected marker's ('selected') or none ('none'). Hidden labels still name
 * their markers for screen readers.
 */
export type UiMapMarkerLabels = 'all' | 'selected' | 'none';

/** The selected marker's dot, in px across (0.43.0): the others' 16px, about 1.35x. */
export const UI_MAP_SELECTED_DOT = 22;

/** Whether a marker's label shows under `mode` (0.43.0). */
export function uiMapLabelShown(mode: UiMapMarkerLabels, selected: boolean): boolean {
  return mode === 'all' || (mode === 'selected' && selected);
}

/** The gap from a marker's point to its label (the dot's 8px radius and 4px). */
export const UI_MAP_LABEL_GAP = 12;
/** The room a marker label keeps from the map's edge. */
export const UI_MAP_LABEL_EDGE = 8;

/**
 * Which side of its dot a `labelWidth` px label goes for a marker `x` px from the map's left edge on
 * a `mapWidth` map (0.42.1, Flutter `uiMapLabelSide`): the inline end (the right, the left in RTL)
 * unless it would run past the map's edge there (keeping 8px); then the other side; when neither
 * fits, the side with more room.
 */
export function uiMapLabelSide(x: number, labelWidth: number, mapWidth: number, rtl = false): UiMapLabelSide {
  const fits = (side: UiMapLabelSide) =>
    side === 'right' ? x + UI_MAP_LABEL_GAP + labelWidth <= mapWidth - UI_MAP_LABEL_EDGE : x - UI_MAP_LABEL_GAP - labelWidth >= UI_MAP_LABEL_EDGE;
  const first: UiMapLabelSide = rtl ? 'left' : 'right';
  const other: UiMapLabelSide = rtl ? 'right' : 'left';
  if (fits(first)) return first;
  if (fits(other)) return other;
  return mapWidth - x >= x ? 'right' : 'left';
}

/** The closest `fitPoints` zooms by default, and the zoom it shows a single point at. */
export const UI_MAP_FIT_MAX_ZOOM = 17;
/** The room `fitPoints` leaves around the points by default, px per side. */
export const UI_MAP_FIT_PADDING = 24;

/** `[lat, lng]` or `{ lat, lng }` as `{ lat, lng }`. */
export function uiMapPoint(p: UiMapPoint): UiLatLng {
  return Array.isArray(p) ? { lat: (p as readonly [number, number])[0], lng: (p as readonly [number, number])[1] } : (p as UiLatLng);
}

/**
 * The route line's width and its casing's, in px, at `zoom`: 5px over a 9px casing (2px each side)
 * from zoom 14 in, thinning to 60% at zoom 10 and out, so a whole island's route doesn't swamp it.
 */
export function uiMapRouteWidth(zoom: number): { line: number; casing: number } {
  const k = Math.min(1, Math.max(0.6, 0.6 + 0.1 * (zoom - 10)));
  return { line: 5 * k, casing: 9 * k };
}

/** How long a removed route takes to fade out, in ms (0.46.2). */
export const UI_MAP_ROUTE_FADE_MS = 150;

/** The great-circle distance between two points, in metres (haversine). */
function metresBetween(a: UiLatLng, b: UiLatLng): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A route's length along its points, in metres (0.46.2, Flutter `uiMapRouteLength`). */
export function uiMapRouteLength(points: readonly UiMapPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += metresBetween(uiMapPoint(points[i - 1]), uiMapPoint(points[i]));
  return total;
}

/**
 * How long a route of `metres` takes to draw in, in ms (0.46.2, Flutter `uiMapRouteDrawDuration`):
 * 450 ms for 1 km, 150 ms more each time the length doubles, kept within 250..900 ms, so a
 * street-length route is quick and a long drive never drags.
 */
export function uiMapRouteDrawMs(metres: number): number {
  const km = Math.max(1e-6, metres / 1000);
  return Math.round(Math.min(900, Math.max(250, 450 + 150 * Math.log2(km))));
}

/** The draw-in's ease-out (cubic) for linear progress `t` in 0..1 (0.46.2). */
export function uiMapRouteEase(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) ** 3;
}

/**
 * The first `fraction` (0..1) of a route by length (0.46.2, Flutter `uiMapRoutePartial`): the points
 * up to there and one interpolated point where it ends. 0 gives the start point twice (a dot, with
 * the round caps); 1 (or more) all the points.
 */
export function uiMapRoutePartial(points: readonly UiMapPoint[], fraction: number): UiLatLng[] {
  const ll = points.map(uiMapPoint);
  if (ll.length < 2 || fraction >= 1) return ll.map((p) => ({ lat: p.lat, lng: p.lng }));
  const total = uiMapRouteLength(ll);
  const want = Math.max(0, fraction) * total;
  const out: UiLatLng[] = [{ lat: ll[0].lat, lng: ll[0].lng }];
  let done = 0;
  for (let i = 1; i < ll.length; i++) {
    const seg = metresBetween(ll[i - 1], ll[i]);
    if (done + seg >= want) {
      const k = seg > 0 ? (want - done) / seg : 0;
      out.push({ lat: ll[i - 1].lat + (ll[i].lat - ll[i - 1].lat) * k, lng: ll[i - 1].lng + (ll[i].lng - ll[i - 1].lng) * k });
      return out;
    }
    done += seg;
    out.push({ lat: ll[i].lat, lng: ll[i].lng });
  }
  return out;
}

const MAX_LAT = 85.0511287798;
const unitX = (lng: number) => (lng + 180) / 360;
const unitY = (lat: number) => {
  const s = Math.sin((Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
const unitLat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

/**
 * Where a map of `size` px looks so every point fits inside the part left free by `area` (the
 * insets plus padding, px per physical side): the map's own centre and a whole zoom level (Web
 * Mercator, 256 px tiles at zoom 0), at most `maxZoom`. All the points in one place (or one point):
 * `maxZoom`, the point in the middle of that part. Null without points.
 */
export function uiMapFitView(
  points: readonly UiMapPoint[],
  size: { width: number; height: number },
  area: Required<UiMapPadding>,
  maxZoom = UI_MAP_FIT_MAX_ZOOM,
  minZoom = 1,
): UiMapView | null {
  if (!points.length) return null;
  const ll = points.map(uiMapPoint);
  const xs = ll.map((p) => unitX(p.lng));
  const ys = ll.map((p) => unitY(p.lat));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = Math.max(1, size.width - area.left - area.right);
  const h = Math.max(1, size.height - area.top - area.bottom);
  const dx = (x1 - x0) * 256;
  const dy = (y1 - y0) * 256;
  let zoom = maxZoom;
  if (dx > 1e-12 || dy > 1e-12) {
    const fit = Math.log2(Math.min(dx > 1e-12 ? w / dx : Infinity, dy > 1e-12 ? h / dy : Infinity));
    zoom = Math.min(maxZoom, Math.floor(fit + 1e-9));
  }
  zoom = Math.max(minZoom, zoom);
  const scale = 256 * 2 ** zoom;
  // The middle of the points goes to the middle of the free part: the map's centre is that far off it.
  const cx = (x0 + x1) / 2 - (area.left - area.right) / 2 / scale;
  const cy = (y0 + y1) / 2 - (area.top - area.bottom) / 2 / scale;
  return { lat: unitLat(cy), lng: cx * 360 - 180, zoom };
}

/** The tile URL a map shows: the dark one on a dark theme when it is given, else the light one. */
export function uiMapTileUrl(tileUrl: string, tileUrlDark: string | null | undefined, dark: boolean): string {
  return dark && tileUrlDark ? tileUrlDark : tileUrl;
}

/** The shift, in px from the map's middle, of the middle of the part between the insets. */
export function uiMapInsetShift(insets: UiMapInsets, rtl: boolean): { x: number; y: number } {
  const start = insets.start ?? 0;
  const end = insets.end ?? 0;
  const left = rtl ? end : start;
  const right = rtl ? start : end;
  return { x: (left - right) / 2, y: ((insets.top ?? 0) - (insets.bottom ?? 0)) / 2 };
}

/** The pulse's HTML: three staggered rings, or one still halo under reduced motion. */
export function uiMapPulseHtml(still: boolean): string {
  return still ? '<span class="ui-map-pulse-halo"></span>' : '<span class="ui-map-pulse-ring"></span>'.repeat(3);
}

/** Two-finger rotation (0.47.0): the twist that turns the map, if it comes before the zoom or pan thresholds. */
export const UI_MAP_ROTATE_THRESHOLD = 15;
/** A pinch that changes the fingers' distance by this much (10%) first is a zoom: no turning in that gesture. */
export const UI_MAP_PINCH_ZOOM_THRESHOLD = 0.1;
/** Fingers whose middle moves this far (px) first are a pan: no turning in that gesture. */
export const UI_MAP_PINCH_MOVE_THRESHOLD = 30;

/**
 * Which gesture two fingers make (0.47.0, Flutter's gesture race with the same thresholds): 'rotate'
 * once they twist `UI_MAP_ROTATE_THRESHOLD` degrees before the pinch passes a 10% zoom or a 30 px pan;
 * 'pinch' once one of those comes first (and turning is out for that gesture); 'undecided' before.
 */
export function uiMapTwoFingerGesture(twistDeg: number, scale: number, movePx: number): 'rotate' | 'pinch' | 'undecided' {
  if (Math.abs(twistDeg) >= UI_MAP_ROTATE_THRESHOLD) return 'rotate';
  if (Math.abs(scale - 1) >= UI_MAP_PINCH_ZOOM_THRESHOLD || movePx >= UI_MAP_PINCH_MOVE_THRESHOLD) return 'pinch';
  return 'undecided';
}

/** Whether a bearing is away from north (more than half a degree): the compass shows. */
export function uiMapIsTurned(bearing: number): boolean {
  const b = ((bearing % 360) + 360) % 360;
  return Math.min(b, 360 - b) > 0.5;
}

/** The compass needle (0.47.0): north half in the danger tone, south half muted, turned to north. */
export const UI_MAP_COMPASS_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path class="ui-map-compass-n" d="M12 3L15.5 12H8.5Z"/><path class="ui-map-compass-s" d="M12 21L8.5 12H15.5Z"/></svg>';

/** The Leaflet pane the pulse is drawn in: above the tiles (200) and overlays (400), below markers (600). */
const PULSE_PANE = 'uiMapPulse';
/** The "you are here" dot's pane: above the pulse, below the markers and the pin. */
const USER_PANE = 'uiMapUser';
/** The routes' pane: above the tiles (200) and overlays (400), below the pulse (450), dot and markers. */
const ROUTE_PANE = 'uiMapRoute';
/** The search area's pane (0.44.0): above the tiles and overlays, below the routes (420). */
const AREA_PANE = 'uiMapArea';

/** A drawn route's two polylines, the geometry they show, and the draw-in running, if one is. */
interface RouteLayers {
  casing: Leaflet.Polyline;
  line: Leaflet.Polyline;
  key: string;
  anim?: { start: number; ms: number; pts: UiLatLng[] };
}

/** OpenStreetMap's standard tiles; use them within the OSM tile usage policy, or pass your own `tileUrl`. */
export const UI_MAP_OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const UI_MAP_OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Whether a CSS colour string is dark (relative luminance under 0.4), for dimming the tiles. */
export function uiMapIsDark(color: string): boolean {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return false;
  const [r, g, b] = m[1].split(/[\s,/]+/).map(Number);
  const c = (x: number) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b) < 0.4;
}

/** The marker's HTML: a dot in its tone and, when it has one, its label. */
export function uiMapMarkerHtml(m: Pick<UiMapMarker, 'tone' | 'label'>): string {
  return `<span class="ui-map-dot" data-tone="${m.tone ?? 'primary'}"></span>${m.label ? `<span class="ui-map-label">${esc(m.label)}</span>` : ''}`;
}

/**
 * `ui-map` — an OpenStreetMap map (Leaflet 1.9.4) with markers and an optional draggable pin.
 *
 * Its own entry point, and Leaflet itself is loaded on first use, so neither lands in an app's
 * initial bundle. Requires the `leaflet` package (1.9.x) installed next to the library.
 *
 * - `markers`: dots in their tone with a label; selecting one (click, or Enter when focused) emits
 *   `(markerSelected)`.
 * - `(mapTap)` (0.43.1): the point tapped on the map background (the user dot counts as background).
 *   Markers, the pin, controls and attribution do not emit it; neither do a drag, double-click zoom or `preview`.
 *   In `pinMode` a background tap both moves the pin and emits `(mapTap)`.
 * - `[(pin)]` with `pinMode`: a draggable pin; a tap on the map, or Enter with the map focused (it
 *   goes to the map's centre), moves it there. For choosing a location.
 * - `[center]` / `[zoom]` move the map; `(centerChanged)` reports where the person moved it.
 * - Theme-aware: the controls use the theme, and on a dark theme the tiles are dimmed.
 * - The zoom buttons sit at the inline start (left in LTR, right in RTL) and the OSM attribution at
 *   the inline end; under reduced motion there are no zoom or pan animations.
 * - `pulse`: the "searching" rings around a point, geo-anchored (they move with the map), drawn
 *   above the tiles and below markers and the pin. A still halo under reduced motion. Silent: the
 *   page's own status text announces the search.
 * - `insets`: for a full-screen map with a sheet or card floating over it. The map still draws
 *   edge to edge, but `center`, the pin's "centre", `centerChanged` and the controls use the part
 *   between the insets, and the zoom buttons zoom around its middle. When the insets change, the map
 *   pans so the point that was in the middle of the visible part stays in the middle of the new one.
 * - `fill`: fills its parent's height, square-cornered, for a full-screen map page.
 * - `tileUrlDark`: tiles drawn for dark themes (MapTiler's "-dark" styles, say). On a dark theme the
 *   map shows them undimmed, and swaps between the two live when the theme changes; without it the
 *   light tiles are dimmed. `{r}` in a URL is `@2x` on a high-density screen and empty otherwise;
 *   `tileSize` / `zoomOffset` are for 512 px tiles (512 and -1).
 * - `locateControl`: a round "Show my location" button at the bottom-end corner of the visible part
 *   (it follows `insets`, so it floats just above a bottom sheet). It emits `(locate)`; the app finds
 *   the position, sets `userLocation` and moves the map (`center`, or `flyTo`). `locating` shows a
 *   spinner (and presses do nothing), `locateOff` a struck-through icon with "Location is off".
 * - `userLocation`: the "you are here" dot with a white ring and a soft accuracy halo, sized in
 *   metres on the map; above the tiles and pulse, below the markers and the pin; named "Your location".
 * - `routes` (0.42.0): lines along the road (from OSRM, say) in a tone over a casing, round caps and
 *   joins, 5px over 9px (thinner when zoomed out), above the tiles and below the pulse, dot, markers
 *   and pin. Changing the list redraws only the lines; an empty list removes them. Each route's
 *   `label` is its one name for screen readers ("Route, 1.2 km").
 *   A route that appears, or gets new points, draws in from its start to its end (0.46.2): the
 *   casing and line grow along the path together, ease-out over 250..900 ms by length
 *   (`uiMapRouteDrawMs`), while the map moves as it would (a `fitPoints` straight after runs as
 *   before). The same points again don't replay it. `animate: false` on a route, reduced motion or
 *   a preview draw it at once. A removed route fades out over 150 ms (at once under reduced motion).
 * - `fitPoints(points, { padding, maxZoom, animate })` (0.42.0): shows every point (the nurse and the
 *   patient, a route) inside the visible part (between the insets) plus padding, at a whole zoom up
 *   to maxZoom (17); one point is centred there at maxZoom. Animated unless reduced motion. The fit
 *   then owns the camera (0.42.1): when the insets change while it animates or after it (a sheet
 *   growing as the route appears), it is worked out again for the new insets, until the person or
 *   the app moves the map (a drag, wheel, keys, the zoom buttons, `flyTo`, a new `center`).
 * - Marker labels sit at the inline end of the dot (right; left in RTL) and flip to the other side
 *   when they would run off the map there (0.42.1, `uiMapLabelSide`).
 * - `controls` (0.42.1): the app's own round buttons (`UiMapControl`) in the locate button's stack
 *   and style, above it at the bottom-end of the visible part, following the insets; pressing one
 *   emits `(controlPress)`.
 * - `preview` (0.43.0): a still picture of the map that is one button. No pan, zoom, keys or
 *   controls; markers drawn but not focusable; the wheel or a drag over it scrolls the page. A
 *   click, Enter or Space emits `(previewPress)`; it is named `previewLabel` ("Open map", from the
 *   `mapOpen` string) and shows a round expand badge at the top-end corner. `center`, `zoom` and
 *   `fitPoints` still place it (without animating). Turning it off gives the full map back.
 * - `selectedMarkerId` (0.43.0): that marker is drawn bigger (a 22px dot) with a white ring and a
 *   halo in its tone, above the others, its label shown, `aria-pressed="true"` (the others "false").
 *   Changing it updates the markers in place.
 * - `markerLabels` (0.43.0): 'all' (the default), 'selected' (only the selected marker's label) or
 *   'none'. Hidden labels still name the markers (`aria-label`).
 * - `area` (0.44.0): a search area, a soft circle in its tone with a clear outline, `radiusMeters`
 *   in true metres around its point (it scales with the zoom), under the routes, markers and pin; the
 *   map pans and zooms through it. With `editable` (not on a preview) a round handle sits on its
 *   inline-end edge (east; west in RTL) with a chip showing the radius ("20 km", `uiMapFormatRadius`).
 *   Dragging it changes the radius (rounded with `uiMapNiceRadius`, kept within `minMeters` 200 ..
 *   `maxMeters` 50000) and the map doesn't pan meanwhile; it emits `(areaChanging)` while dragging and
 *   `(areaChange)` on release. The handle is a slider named `areaLabel` (the `mapSearchArea` string):
 *   ArrowUp and the outward arrow (Right; Left in RTL) about 10% bigger, ArrowDown and the inward
 *   arrow smaller, Home / End the smallest and largest, each step emitting both outputs. Feed the
 *   radius back into `area`; until then the map keeps the one the person chose. `fitArea()` shows the
 *   whole circle in the visible part.
 *
 * Give it a height (`--ui-map-height`, 320px by default, or a height on the element, or `fill`).
 */
@Component({
  selector: 'ui-map',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'ui-map', '[attr.data-preview]': 'preview() || null', '[attr.data-dark]': 'dark() || null', '[attr.data-dark-tiles]': '(dark() && !!tileUrlDark()) || null', '[class.ui-map-fill]': 'fill()', role: 'region', '[attr.aria-label]': 'ariaLabel()' },
  imports: [HugeiconsIconComponent, UiTooltip],
  template: `<div class="ui-map-canvas" #canvas></div>
    @if (locateControl() && !preview()) {
      <button type="button" class="ui-map-locate" [attr.data-state]="locating() ? 'locating' : locateOff() ? 'off' : null"
        [attr.aria-label]="strings.mapLocate" [attr.aria-busy]="locating() ? 'true' : null"
        [attr.aria-description]="locateOff() ? strings.mapLocationOff : null"
        [uiTooltip]="locateOff() ? strings.mapLocationOff : ''" [uiTooltipPosition]="tooltipSide()" (click)="onLocate()">
        @if (locating()) {
          <span class="ui-map-locate-spin" aria-hidden="true"></span>
        } @else {
          <hugeicons-icon [icon]="locateOff() ? icons.off : icons.locate" [size]="20" [strokeWidth]="1.8" aria-hidden="true" />
        }
      </button>
    }
    @if (controls().length && !preview()) {
      <div class="ui-map-controls" [attr.data-locate]="locateControl() || null">
        @for (c of controls(); track c.id) {
          <button type="button" class="ui-map-control" [attr.data-control]="c.id" [attr.aria-label]="c.label" [disabled]="!!c.disabled"
            [uiTooltip]="c.tooltip ?? ''" [uiTooltipPosition]="tooltipSide()" (click)="onControl(c)">
            <hugeicons-icon [icon]="c.icon" [size]="20" [strokeWidth]="1.8" aria-hidden="true" />
          </button>
        }
      </div>
    }
    @if (preview()) {
      <button type="button" class="ui-map-preview" [attr.aria-label]="previewLabel() ?? strings.mapOpen" (click)="previewPress.emit()">
        <span class="ui-map-preview-badge" aria-hidden="true"><hugeicons-icon [icon]="icons.expand" [size]="16" [strokeWidth]="1.8" /></span>
      </button>
    }`,
  styleUrls: ['./leaflet.css', './map.css'],
})
export class UiMap {
  /** Where the map is centred. Changing it moves the map. */
  center = input<UiLatLng>({ lat: 4.1755, lng: 73.5093 });
  zoom = input(13);
  markers = input<UiMapMarker[]>([]);
  /** The chosen point, two-way. Shown as a draggable pin when set (or when `pinMode` is on). */
  pin = model<UiLatLng | null>(null);
  /** A tap on the map (or Enter on it) moves the pin there. */
  pinMode = input(false);
  /** The pin's accessible name. */
  pinLabel = input('Chosen location');
  /** Whether the pin can be dragged; false shows a fixed location with the pin's look. */
  pinDraggable = input(true);
  /** The tiles' Referer policy (OSM's tile policy needs a Referer). */
  tileReferrerPolicy = input<Exclude<ReferrerPolicy, ''>>('strict-origin-when-cross-origin');
  tileUrl = input(UI_MAP_OSM_TILES);
  /** Tiles for dark themes, shown undimmed; null dims the light tiles instead. */
  tileUrlDark = input<string | null>(null);
  /** The tiles' size in px: 512 for 512 px tiles (with `zoomOffset` -1). */
  tileSize = input(256);
  /** Added to the zoom in tile URLs: -1 for 512 px tiles. */
  zoomOffset = input(0);
  attribution = input(UI_MAP_OSM_ATTRIBUTION);
  ariaLabel = input('Map');
  /** The "searching" rings around a point; null or `active: false` for none. */
  pulse = input<UiMapPulse | null>(null);
  /** Px covered by panels over each edge; centring and the controls use the part between them. */
  insets = input<UiMapInsets>({});
  /** Fill the parent's height with square corners (a full-screen map page). */
  fill = input(false, { transform: booleanAttribute });
  /** A "Show my location" button at the bottom-end of the visible part; it emits `(locate)`. */
  locateControl = input(false, { transform: booleanAttribute });
  /** The app is finding the position: the button shows a spinner and ignores presses. */
  locating = input(false, { transform: booleanAttribute });
  /** Location is off or denied: the icon is struck through, with "Location is off". Still pressable, to ask again. */
  locateOff = input(false, { transform: booleanAttribute });
  /** The "you are here" dot, with an accuracy halo; null for none. */
  userLocation = input<UiMapUserLocation | null>(null);
  /** Route lines (0.42.0), drawn under the dot, markers and pin; an empty list removes them. */
  routes = input<readonly UiMapRoute[]>([]);
  /** The app's own buttons (0.42.1), above the locate button at the bottom-end of the visible part. */
  controls = input<readonly UiMapControl[]>([]);
  /** A still picture that is one button (0.43.0): no gestures, keys or controls; emits `(previewPress)`. */
  preview = input(false, { transform: booleanAttribute });
  /** The preview button's accessible name; null: the `mapOpen` string ("Open map"). */
  previewLabel = input<string | null>(null);
  /** The selected marker (0.43.0): bigger, ringed and haloed, on top, its label shown. */
  selectedMarkerId = input<string | null>(null);
  /** Which marker labels show (0.43.0); hidden ones still name their markers. */
  markerLabels = input<UiMapMarkerLabels>('all');
  /** A search area (0.44.0): a circle of `radiusMeters` around a point; `editable` adds a radius handle. */
  area = input<UiMapArea | null>(null);
  /** The radius handle's accessible name; null: the `mapSearchArea` string ("Search area"). */
  areaLabel = input<string | null>(null);
  /**
   * The compass direction at the top of the map, degrees clockwise from north (0.47.0): 0 is north
   * up; a heading turns the map heading-up. The map turns about the middle of the visible part.
   */
  bearing = input(0);
  /** The zoom buttons (0.47.0); false hides them (the wheel, pinch and keys still zoom). */
  zoomButtons = input(true, { transform: booleanAttribute });
  /**
   * The person can turn the map (0.47.0): a two-finger twist (past 15 degrees, before the pinch
   * zooms or pans), or Alt + drag with a mouse. Shift + drag stays Leaflet's box zoom.
   */
  rotatable = input(true, { transform: booleanAttribute });
  /** A compass button under the zoom buttons while the map is turned from north; it turns it back (0.47.0). */
  compass = input(true, { transform: booleanAttribute });

  readonly markerSelected = output<UiMapMarker>();
  /** A map-background tap (0.43.1); also emitted after that tap moves the pin in `pinMode`. */
  readonly mapTap = output<UiLatLng>();
  readonly centerChanged = output<UiMapView>();
  /** The "Show my location" button was pressed (not while `locating`). */
  readonly locate = output<void>();
  /** One of `controls` was pressed (not while disabled). */
  readonly controlPress = output<UiMapControl>();
  /** The preview was clicked, or Enter or Space pressed on it (0.43.0): open the full map. */
  readonly previewPress = output<void>();
  /** The area's radius in metres while its handle is dragged (0.44.0), on each change. */
  readonly areaChanging = output<number>();
  /** The area's radius in metres when its handle is let go, or after a keyboard step (0.44.0). */
  readonly areaChange = output<number>();
  /**
   * The person moved the map themselves (0.47.0): a drag, the wheel, a pinch, a double-click, the
   * arrow keys or a box zoom; not the zoom buttons, and never a move from the app.
   */
  readonly userMove = output<void>();
  /** The person turned the map, or pressed the compass (0.47.0): the new bearing, when the turn ends. */
  readonly bearingChange = output<number>();

  protected readonly icons = { locate: Gps01Icon, off: GpsOff01Icon, expand: ArrowExpand01Icon };

  /** The map is on a dark theme: tiles dimmed, or the dark tiles shown. */
  protected readonly dark = signal(false);
  /** The controls' tooltips face into the map: left of them, right in RTL (set once laid out). */
  protected readonly tooltipSide = signal<'left' | 'right'>('left');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly loadLeaflet = inject(UI_MAP_LEAFLET);
  protected readonly strings = injectUiStrings();
  private readonly zone = inject(NgZone);
  private L: typeof Leaflet | null = null;
  private map: Leaflet.Map | null = null;
  private markerLayer: Leaflet.LayerGroup | null = null;
  /** The markers drawn, by id, so the selection and label mode update them in place. */
  private markerById = new Map<string, Leaflet.Marker>();
  /** The zoom buttons, taken off a preview and put back after. */
  private zoomControl: Leaflet.Control.Zoom | null = null;
  /** The OSM credits, moved to the other corner when the text direction flips. */
  private attributionControl: Leaflet.Control.Attribution | null = null;
  private readonly direction = inject(UiDirectionService);
  private pinMarker: Leaflet.Marker | null = null;
  private tiles: Leaflet.TileLayer | null = null;
  private pulseMarker: Leaflet.Marker | null = null;
  private userMarker: Leaflet.Marker | null = null;
  /**
   * Each route's casing and line, by id, so an update moves them instead of rebuilding them; `key` is
   * the geometry drawn (an update with the same one doesn't replay the draw-in), `anim` the draw-in
   * running (0.46.2).
   */
  private routeLayers = new Map<string, RouteLayers>();
  /** Removed routes fading out (0.46.2), by id, with the timer that removes them. */
  private routeLeaving = new Map<string, { layers: RouteLayers; timer: ReturnType<typeof setTimeout> }>();
  /** The pending animation frame of the routes' draw-in, if one is. */
  private routeFrame: number | null = null;
  /** What the tile layer was built with (all but the URL, which it can swap in place). */
  private tilesKey = '';
  /** What the pulse marker was built for: rebuilt when its tone or the motion setting changes. */
  private pulseKey = '';
  /** The inset shift the view was last laid out for, to pan by the difference when it changes. */
  private shift = { x: 0, y: 0 };
  /** The map's own view, so a center input that only echoes it doesn't move it again. */
  private view: UiMapView | null = null;
  /** Destroyed, possibly while Leaflet was still loading. */
  private destroyed = false;
  /** Undoes what init set up (map, observers); set once the map exists. */
  private teardown: (() => void) | null = null;
  /**
   * The last `fitPoints`, while it owns the camera (0.42.1): an inset change works it out again for
   * the new insets. Let go when anything else moves the map.
   */
  private fit: { points: readonly UiMapPoint[]; options: UiMapFitOptions } | null = null;
  /** Insets changed while Leaflet was mid-zoom (it drops a setView then): fit again once it lands. */
  private refitPending = false;
  /** The search area's casing and line (two circles), and its radius handle. */
  private areaCasing: Leaflet.CircleMarker | null = null;
  private areaLine: Leaflet.CircleMarker | null = null;
  private areaHandle: Leaflet.Marker | null = null;
  /** The radius the person chose with the handle, until the app gives a new `area`. */
  private areaLocal: number | null = null;
  /** The pointer dragging the handle, if one is. */
  private areaPointer: number | null = null;
  /**
   * The map's turn (0.47.0): the bearing shown, unwrapped so 359 to 1 turns 2 degrees, not 358; and
   * the element turned (Leaflet's map pane, moved into it the first time the map turns).
   */
  private turn = 0;
  private rotor: HTMLElement | null = null;
  /** The compass control (0.47.0). */
  private compassControl: Leaflet.Control | null = null;
  /** The arrow puck as drawn (0.47.0): its halo size and heading (unwrapped like the map's turn), to update it in place. */
  private userKey = '';
  private puckTurn = 0;

  constructor() {
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    const destroy = inject(DestroyRef);
    // Registered now, not after Leaflet has loaded: the map can be destroyed while the import is
    // pending (leaving the page at once), and onDestroy on a destroyed view throws NG0911.
    destroy.onDestroy(() => {
      this.destroyed = true;
      this.teardown?.();
      this.teardown = null;
    });
    afterNextRender(() => {
      if (!browser || this.destroyed) return;
      this.watchTheme(destroy);
      void this.init();
    });
    effect(() => {
      const c = this.center();
      const z = this.zoom();
      untracked(() => this.moveTo(c, z));
    });
    effect(() => {
      const list = this.markers();
      untracked(() => this.drawMarkers(list));
    });
    effect(() => {
      const p = this.pin();
      this.pinMode();
      this.pinLabel();
      this.pinDraggable();
      untracked(() => this.drawPin(p));
    });
    effect(() => {
      const p = this.pulse();
      untracked(() => this.drawPulse(p));
    });
    effect(() => {
      const i = this.insets();
      untracked(() => this.applyInsets(i));
    });
    effect(() => {
      const url = uiMapTileUrl(this.tileUrl(), this.tileUrlDark(), this.dark());
      const attr = this.attribution();
      this.tileReferrerPolicy();
      this.tileSize();
      this.zoomOffset();
      untracked(() => this.drawTiles(url, attr));
    });
    effect(() => {
      const u = this.userLocation();
      untracked(() => this.drawUser(u));
    });
    effect(() => {
      const r = this.routes();
      untracked(() => this.drawRoutes(r));
    });
    effect(() => {
      this.selectedMarkerId();
      this.markerLabels();
      untracked(() => this.applySelection());
    });
    effect(() => {
      const p = this.preview();
      untracked(() => this.applyPreview(p));
    });
    effect(() => {
      this.area();
      untracked(() => {
        this.areaLocal = null;
        this.drawArea();
      });
    });
    effect(() => {
      this.areaLabel();
      untracked(() => this.drawArea());
    });
    effect(() => {
      const b = this.bearing();
      untracked(() => this.applyBearing(b));
    });
    effect(() => {
      this.zoomButtons();
      untracked(() => this.applyPreview(this.preview()));
    });
    effect(() => {
      this.compass();
      this.strings.mapResetNorth;
      untracked(() => this.updateCompass());
    });
    // An app's language toggle flips <html dir> at runtime (0.46.0): the zoom buttons, credits,
    // tooltips, insets and label sides follow without rebuilding the map.
    effect(() => {
      this.direction.dir();
      untracked(() => this.applyDirection());
    });
    effect(() => {
      const zoomIn = this.strings.zoomIn;
      const zoomOut = this.strings.zoomOut;
      untracked(() => this.applyZoomTitles(zoomIn, zoomOut));
    });
  }

  /** Puts the direction-dependent parts where the current direction wants them. */
  private applyDirection(): void {
    if (!this.map) return;
    const rtl = this.rtl();
    this.zoomControl?.setPosition(rtl ? 'topright' : 'topleft');
    this.compassControl?.setPosition(rtl ? 'topright' : 'topleft');
    this.attributionControl?.setPosition(rtl ? 'bottomleft' : 'bottomright');
    this.tooltipSide.set(rtl ? 'right' : 'left');
    this.applyInsets(this.insets());
    this.placeLabels();
  }

  /** The zoom buttons' names, in the current language. */
  private applyZoomTitles(zoomIn: string, zoomOut: string): void {
    const box = this.zoomControl?.getContainer?.();
    if (!box) return;
    for (const [sel, text] of [['.leaflet-control-zoom-in', zoomIn], ['.leaflet-control-zoom-out', zoomOut]] as const) {
      const a = box.querySelector(sel);
      a?.setAttribute('title', text);
      a?.setAttribute('aria-label', text);
    }
  }

  /** No animation on a preview (a picture) or under reduced motion. */
  private still(): boolean {
    return this.preview() || this.reduced();
  }

  private reduced(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  private rtl(): boolean {
    return getComputedStyle(this.host.nativeElement).direction === 'rtl';
  }

  private async init(): Promise<void> {
    const mod = await this.loadLeaflet();
    // Gone while Leaflet loaded: build nothing.
    if (this.destroyed) return;
    const L = ((mod as unknown as { default?: typeof Leaflet }).default ?? mod) as typeof Leaflet;
    if (this.map) return;
    this.L = L;
    const el = this.host.nativeElement.querySelector('.ui-map-canvas') as HTMLElement;
    const still = this.reduced();
    const rtl = this.rtl();
    this.zone.runOutsideAngular(() => {
      const map = L.map(el, {
        center: [this.center().lat, this.center().lng],
        zoom: this.zoom(),
        zoomControl: false,
        attributionControl: false,
        zoomAnimation: !still,
        fadeAnimation: !still,
        markerZoomAnimation: !still,
        inertia: !still,
        keyboard: true,
      });
      const zoom = L.control.zoom({ position: rtl ? 'topright' : 'topleft', zoomInTitle: this.strings.zoomIn, zoomOutTitle: this.strings.zoomOut });
      // The buttons zoom around the middle of the visible part (between the insets), not the map's own centre.
      const around = (dir: 1 | -1) => (e: { shiftKey?: boolean }) => {
        const z = map.getZoom() + dir * (map.options.zoomDelta ?? 1) * (e?.shiftKey ? 3 : 1);
        if (z > map.getMaxZoom() || z < map.getMinZoom()) return;
        const mid = map.getSize().divideBy(2);
        this.release();
        map.setZoomAround(L.point(mid.x + this.shift.x, mid.y + this.shift.y), z); // a Point: a container point
      };
      Object.assign(zoom, { _zoomIn: around(1), _zoomOut: around(-1) });
      zoom.addTo(map);
      this.zoomControl = zoom;
      // The map surface is the focusable, keyboard-pannable element: it carries the name.
      el.setAttribute('aria-label', this.ariaLabel());
      if (this.pinMode()) el.setAttribute('aria-description', this.strings.placePinAtCentre + ' (Enter)');
      // English credits: laid out LTR in any page direction (map.css isolates them too).
      const credits = L.control.attribution({ position: rtl ? 'bottomleft' : 'bottomright', prefix: false }).addTo(map);
      credits.getContainer?.()?.setAttribute('dir', 'ltr');
      this.attributionControl = credits;
      // The pulse's own pane: geo-anchored like a marker, under the markers, never hit.
      const pane = map.createPane(PULSE_PANE);
      pane.style.zIndex = '450';
      pane.style.pointerEvents = 'none';
      const userPane = map.createPane(USER_PANE);
      userPane.style.zIndex = '500';
      userPane.style.pointerEvents = 'none';
      const routePane = map.createPane(ROUTE_PANE);
      routePane.style.zIndex = '420';
      routePane.style.pointerEvents = 'none';
      const areaPane = map.createPane(AREA_PANE);
      areaPane.style.zIndex = '410';
      areaPane.style.pointerEvents = 'none';
      this.map = map;
      this.markerLayer = L.layerGroup().addTo(map);
      // The person moves the map (drag, wheel, double click, pinch, keys, box zoom): it is theirs now.
      const moved = () => {
        this.release();
        if (!this.preview()) this.zone.run(() => this.userMove.emit());
      };
      map.on('dragstart boxzoomend', moved);
      el.addEventListener('wheel', moved, { passive: true });
      el.addEventListener('dblclick', moved);
      el.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) moved();
      }, { passive: true });
      el.addEventListener('keydown', (e) => {
        if (e.target === el && /^(Arrow(Up|Down|Left|Right)|[-+=_])$/.test(e.key)) moved();
      });
      // A turned map (0.47.0): pointer positions are turned back into the unrotated map, so taps,
      // the wheel, pinches and double-clicks land on the point under the finger; and a drag moves
      // the map the way the finger goes (Leaflet would move it along the unrotated axes).
      if (typeof map.mouseEventToContainerPoint === 'function') {
        const toContainer = map.mouseEventToContainerPoint.bind(map);
        map.mouseEventToContainerPoint = (e: MouseEvent) => {
          const p = toContainer(e);
          if (!this.turn) return p;
          const q = uiMapRotatePoint(p, this.pivot(), this.turn, true);
          return L.point(q.x, q.y);
        };
      }
      const draggable = (map.dragging as unknown as { _draggable?: Leaflet.Draggable & { _newPos: Leaflet.Point; _startPos: Leaflet.Point } })?._draggable;
      draggable?.on('predrag', () => {
        if (!this.turn) return;
        const d = draggable._newPos.subtract(draggable._startPos);
        const r = uiMapRotatePoint({ x: d.x, y: d.y }, { x: 0, y: 0 }, this.turn, true);
        draggable._newPos = draggable._startPos.add(L.point(r.x, r.y));
      });
      this.wireRotation(el);
      // The compass: a Leaflet control in the zoom buttons' corner, so it stacks under them (0.47.0).
      const Compass = L.Control?.extend?.({
        onAdd: () => {
          const box = L.DomUtil.create('div', 'leaflet-bar leaflet-control ui-map-compass-bar');
          const a = L.DomUtil.create('a', 'ui-map-compass', box) as HTMLAnchorElement;
          a.href = '#';
          a.setAttribute('role', 'button');
          a.innerHTML = UI_MAP_COMPASS_SVG;
          L.DomEvent.disableClickPropagation(box);
          L.DomEvent.disableScrollPropagation(box);
          const reset = (e: Event) => {
            e.preventDefault();
            this.resetNorth();
          };
          a.addEventListener('click', reset);
          a.addEventListener('keydown', (e) => {
            if (e.key === ' ') reset(e);
          });
          return box;
        },
      });
      if (Compass) this.compassControl = new Compass({ position: rtl ? 'topright' : 'topleft' }).addTo(map);
      // A fit asked for while Leaflet was mid-zoom runs once it has landed.
      map.on('zoomend moveend', () => {
        if (!this.refitPending) return;
        this.refitPending = false;
        this.applyFit();
      });
      // Labels pick their side from where the marker is on screen.
      map.on('move zoomend resize', () => this.placeLabels());
      map.on('moveend', () => {
        // Leaflet can finish a queued moveend after this host has been destroyed.
        if (this.map !== map) return;
        const c = this.visibleCenter();
        if (!c) return;
        this.view = { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
        this.zone.run(() => this.centerChanged.emit({ ...this.view! }));
      });
      map.on('click', (e: Leaflet.LeafletMouseEvent) => {
        if (this.preview()) return;
        const point = { lat: e.latlng.lat, lng: e.latlng.lng };
        this.zone.run(() => {
          if (this.pinMode()) this.pin.set(point);
          this.mapTap.emit(point);
        });
      });
      // Enter on the focused map drops the pin at its centre (keyboard users pan with the arrows).
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !this.pinMode() || e.target !== el) return;
        const c = this.visibleCenter();
        if (!c) return;
        this.zone.run(() => this.pin.set({ lat: c.lat, lng: c.lng }));
      });
      const ro = new ResizeObserver(() => {
        map.invalidateSize({ animate: false });
        this.sizeLabels();
        this.placeLabels();
      });
      ro.observe(el);
      this.sizeLabels();
      // The accuracy halo is sized in metres, the route lines thin out: redraw them for the new zoom.
      map.on('zoomend', () => {
        this.drawUser(this.userLocation());
        this.styleRoutes();
        this.drawArea();
      });
      // A fit asked for before the map existed (fitPoints / fitArea on opening) runs now, without animating.
      if (this.fit) {
        this.fit = { ...this.fit, options: { ...this.fit.options, animate: false } };
        this.applyFit();
      }
      this.teardown = () => {
        ro.disconnect();
        this.stopRouteAnimations();
        // Leaflet ends a zoom animation on a timer that outlives remove() and then reads the removed
        // panes: end it now, so the timer finds nothing to do (0.47.0).
        const z = map as unknown as { _animatingZoom?: boolean; _onZoomTransitionEnd?: () => void };
        if (z._animatingZoom) z._onZoomTransitionEnd?.();
        map.remove();
        this.map = null;
        this.markerLayer = null;
        this.markerById.clear();
        this.zoomControl = null;
        this.attributionControl = null;
        this.pinMarker = null;
        this.pulseMarker = null;
        this.pulseKey = '';
        this.userMarker = null;
        this.userKey = '';
        this.routeLayers.clear();
        this.stopRouteAnimations();
        this.tiles = null;
        this.tilesKey = '';
        this.fit = null;
        this.refitPending = false;
        this.areaCasing = null;
        this.areaLine = null;
        this.areaHandle = null;
        this.areaPointer = null;
        this.rotor = null;
        this.compassControl = null;
      };
    });
    this.tooltipSide.set(rtl ? 'right' : 'left');
    // Laid out from no insets, so a non-zero first value centres the view in the visible part.
    this.shift = { x: 0, y: 0 };
    this.applyInsets(this.insets());
    this.drawTiles(uiMapTileUrl(this.tileUrl(), this.tileUrlDark(), this.dark()), this.attribution());
    this.drawMarkers(this.markers());
    this.drawPin(this.pin());
    this.drawPulse(this.pulse());
    this.drawUser(this.userLocation());
    this.drawRoutes(this.routes());
    this.drawArea();
    this.applyPreview(this.preview());
    this.turn = 0;
    this.applyBearing(this.bearing());
  }

  /**
   * A preview (0.43.0) is a picture under one button: every Leaflet handler off (drag, pinch,
   * double-click and wheel zoom, box zoom, keys), the zoom buttons taken off, and the canvas inert
   * and hidden from screen readers (the button names it). Off: all of it back.
   */
  private applyPreview(on: boolean): void {
    const { map, zoomControl } = this;
    if (!map) return;
    for (const h of [map.dragging, map.touchZoom, map.doubleClickZoom, map.scrollWheelZoom, map.boxZoom, map.keyboard]) {
      if (!h) continue;
      if (on) h.disable();
      else h.enable();
    }
    // The area's handle is not on a preview (the circle stays).
    this.drawArea();
    if (zoomControl) {
      if (on || !this.zoomButtons()) zoomControl.remove();
      else if (!(zoomControl as unknown as { _map?: unknown })._map) {
        zoomControl.addTo(map);
        // Put the compass back under it.
        if (this.compassControl) {
          this.compassControl.remove();
          this.compassControl.addTo(map);
        }
      }
    }
    this.updateCompass();
    const el = this.host.nativeElement.querySelector('.ui-map-canvas') as HTMLElement | null;
    if (!el) return;
    if (on) {
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.removeAttribute('inert');
      el.removeAttribute('aria-hidden');
    }
  }

  /**
   * Moves the map so `c` sits in the middle of the visible part (between the insets), at `zoom` or
   * the current zoom; animated unless reduced motion. For "my location": the app calls it with the
   * position it found.
   */
  flyTo(c: UiLatLng, zoom?: number): void {
    const map = this.map;
    if (!map) return;
    const z = zoom ?? map.getZoom();
    this.release();
    map.setView(this.mapCenterFor(c, z), z, { animate: !this.still() });
  }

  /**
   * Shows every point inside the visible part (between the insets) with `padding` px to spare (24 by
   * default), at a whole zoom up to `maxZoom` (17); a single point is centred there at `maxZoom`.
   * Animated unless `animate` is false or reduced motion is on. For "show me and the patient": the
   * nurse's position, the patient's, and the route's points.
   *
   * The fit then owns the camera (0.42.1): when the insets change while it animates or after it (a
   * sheet growing as the route appears), it is worked out again for the new insets, so the points
   * stay inside the visible part. It lets go when anything else moves the map: a drag, the wheel,
   * keys, the zoom buttons, `flyTo` or a new `center` / `zoom`.
   */
  fitPoints(points: readonly UiMapPoint[], options: UiMapFitOptions = {}): void {
    if (!points.length) return;
    this.fit = { points: [...points], options: { ...options } };
    // Asked before Leaflet has loaded (straight after the map is created): held, and run once it has (0.44.2).
    if (!this.map) return;
    this.refitPending = false;
    this.applyFit();
  }

  /** Moves to the held fit for the current insets; while Leaflet is mid-zoom, once it lands. */
  private applyFit(): void {
    const map = this.map;
    const f = this.fit;
    if (!map || !f) return;
    // Leaflet drops a setView during its zoom animation (_tryAnimatedZoom): ask again on zoomend.
    if ((map as unknown as { _animatingZoom?: boolean })._animatingZoom) {
      this.refitPending = true;
      return;
    }
    const { points, options } = f;
    const pad = typeof options.padding === 'number' ? { top: options.padding, right: options.padding, bottom: options.padding, left: options.padding } : (options.padding ?? {});
    const d = UI_MAP_FIT_PADDING;
    const i = this.insets();
    const rtl = this.rtl();
    const area = {
      top: (i.top ?? 0) + (pad.top ?? d),
      bottom: (i.bottom ?? 0) + (pad.bottom ?? d),
      left: (rtl ? (i.end ?? 0) : (i.start ?? 0)) + (pad.left ?? d),
      right: (rtl ? (i.start ?? 0) : (i.end ?? 0)) + (pad.right ?? d),
    };
    const s = map.getSize();
    const v = uiMapFitView(points, { width: s.x, height: s.y }, area, Math.min(options.maxZoom ?? UI_MAP_FIT_MAX_ZOOM, map.getMaxZoom()), Math.max(1, map.getMinZoom()));
    if (!v) return;
    map.setView([v.lat, v.lng], v.zoom, { animate: options.animate !== false && !this.still() });
  }

  /**
   * Shows the whole search area (0.44.0) inside the visible part (between the insets), with the
   * same options as `fitPoints` (24px padding, whole zooms up to 17, animated unless reduced motion).
   */
  fitArea(options: UiMapFitOptions = {}): void {
    const a = this.area();
    if (!a) return;
    this.fitPoints(uiMapAreaBounds({ lat: a.lat, lng: a.lng, radiusMeters: this.areaRadius() }), options);
  }

  /** The radius drawn: the one chosen with the handle, else the input's. */
  private areaRadius(): number {
    return this.areaLocal ?? this.area()?.radiusMeters ?? 0;
  }

  /**
   * Draws the search area: two circles (a casing under the tone line, which carries the fill) sized
   * in px for the current zoom, and the handle on the inline-end edge when editable.
   */
  private drawArea(): void {
    const { L, map } = this;
    if (!L || !map) return;
    const a = this.area();
    if (!a || !(a.radiusMeters >= 0)) {
      this.areaCasing?.remove();
      this.areaLine?.remove();
      this.areaHandle?.remove();
      this.areaCasing = this.areaLine = this.areaHandle = null;
      this.areaPointer = null;
      return;
    }
    const r = this.areaRadius();
    const zoom = map.getZoom();
    const px = r / uiMapMetersPerPx(a.lat, zoom);
    const ll: [number, number] = [a.lat, a.lng];
    if (!this.areaLine || !this.areaCasing) {
      const opts = { pane: AREA_PANE, interactive: false, bubblingMouseEvents: false } as const;
      this.areaCasing = L.circleMarker(ll, { ...opts, radius: px, weight: 4, fill: false, className: 'ui-map-area-casing' }).addTo(map);
      this.areaLine = L.circleMarker(ll, { ...opts, radius: px, weight: 2, fill: true, className: 'ui-map-area-line' }).addTo(map);
      this.areaCasing.getElement()?.setAttribute('aria-hidden', 'true');
      this.areaLine.getElement()?.setAttribute('aria-hidden', 'true');
    } else {
      this.areaCasing.setLatLng(ll).setRadius(px);
      this.areaLine.setLatLng(ll).setRadius(px);
    }
    this.areaLine.getElement()?.setAttribute('data-tone', a.tone ?? 'primary');
    this.areaCasing.getElement()?.setAttribute('data-tone', a.tone ?? 'primary');

    if (!a.editable || this.preview()) {
      this.areaHandle?.remove();
      this.areaHandle = null;
      this.areaPointer = null;
      return;
    }
    const p = map.project(ll, zoom);
    const at = map.unproject([p.x + (this.rtl() ? -px : px), p.y], zoom);
    if (!this.areaHandle) {
      this.zone.runOutsideAngular(() => {
        const marker = L.marker(at, {
          interactive: false,
          keyboard: false,
          zIndexOffset: 2000,
          icon: L.divIcon({ className: 'ui-map-area-handle', html: '<span class="ui-map-area-knob"></span><span class="ui-map-area-chip"></span>', iconSize: [48, 48], iconAnchor: [24, 24] }),
        });
        this.upright(marker);
        this.areaHandle = marker.addTo(map);
        const el = marker.getElement();
        if (el) this.wireAreaHandle(el);
      });
    } else {
      this.areaHandle.setLatLng(at);
    }
    const el = this.areaHandle!.getElement();
    if (!el) return;
    const text = uiMapFormatRadius(r, this.strings);
    el.setAttribute('role', 'slider');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-orientation', 'horizontal');
    el.setAttribute('aria-label', this.areaLabel() ?? this.strings.mapSearchArea);
    el.setAttribute('aria-valuemin', String(a.minMeters ?? UI_MAP_AREA_MIN));
    el.setAttribute('aria-valuemax', String(a.maxMeters ?? UI_MAP_AREA_MAX));
    el.setAttribute('aria-valuenow', String(Math.round(r)));
    el.setAttribute('aria-valuetext', text);
    el.setAttribute('data-tone', a.tone ?? 'primary');
    el.toggleAttribute('data-dragging', this.areaPointer !== null);
    const chip = el.querySelector('.ui-map-area-chip');
    if (chip && chip.textContent !== text) chip.textContent = text;
  }

  /** The handle's pointer and keyboard handling (outside the Angular zone; outputs run inside it). */
  private wireAreaHandle(el: HTMLElement): void {
    const L = this.L!;
    // Its presses never reach the map: no pan, no tap, no double-click zoom.
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    const set = (r: number, done: boolean) => {
      const changed = r !== this.areaRadius();
      if (changed) {
        this.areaLocal = r;
        this.drawArea();
        this.zone.run(() => this.areaChanging.emit(r));
      }
      if (done) this.zone.run(() => this.areaChange.emit(this.areaRadius()));
    };
    const limits = () => {
      const a = this.area();
      return { min: a?.minMeters ?? UI_MAP_AREA_MIN, max: a?.maxMeters ?? UI_MAP_AREA_MAX };
    };
    el.addEventListener('pointerdown', (e) => {
      if (this.areaPointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.stopPropagation();
      // No mouse emulation: Leaflet's own drag never starts.
      e.preventDefault();
      el.focus({ preventScroll: true });
      this.areaPointer = e.pointerId;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* not capturable (synthetic events) */
      }
      this.map?.dragging.disable();
      el.setAttribute('data-dragging', '');
    });
    el.addEventListener('pointermove', (e) => {
      const map = this.map;
      const a = this.area();
      if (e.pointerId !== this.areaPointer || !map || !a) return;
      e.stopPropagation();
      const p = map.mouseEventToContainerPoint(e as unknown as MouseEvent);
      const c = map.latLngToContainerPoint([a.lat, a.lng]);
      const { min, max } = limits();
      const raw = p.distanceTo(c) * uiMapMetersPerPx(a.lat, map.getZoom());
      set(Math.min(max, Math.max(min, uiMapNiceRadius(raw))), false);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.areaPointer) return;
      e.stopPropagation();
      this.areaPointer = null;
      el.removeAttribute('data-dragging');
      if (this.map && !this.preview()) this.map.dragging.enable();
      set(this.areaRadius(), true);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', (e) => {
      const rtl = this.rtl();
      const out = rtl ? 'ArrowLeft' : 'ArrowRight';
      const inward = rtl ? 'ArrowRight' : 'ArrowLeft';
      const { min, max } = limits();
      const r = this.areaRadius();
      let next: number | null = null;
      if (e.key === 'ArrowUp' || e.key === out) next = uiMapAreaStep(r, 1, min, max);
      else if (e.key === 'ArrowDown' || e.key === inward) next = uiMapAreaStep(r, -1, min, max);
      else if (e.key === 'Home') next = min;
      else if (e.key === 'End') next = max;
      if (next === null) return;
      // The map's own arrow-key panning never sees it.
      e.preventDefault();
      e.stopPropagation();
      if (next !== r) set(next, true);
    });
  }

  protected onLocate(): void {
    if (this.locating()) return;
    this.locate.emit();
  }

  protected onControl(c: UiMapControl): void {
    if (!c.disabled) this.controlPress.emit(c);
  }

  /** Something other than a fit moves the map: the fit lets go. */
  private release(): void {
    this.fit = null;
    this.refitPending = false;
  }

  /** The point in the middle of the part of the map between the insets. */
  private visibleCenter(): Leaflet.LatLng | null {
    const map = this.map;
    if (!map) return null;
    const c = map.getCenter();
    const { x, y } = this.shift;
    if (!x && !y) return c;
    // From the exact centre, not a container point (Leaflet rounds the pixel origin).
    const zoom = map.getZoom();
    const p = map.project(c, zoom);
    return map.unproject([p.x + x, p.y + y], zoom);
  }

  /** Where the map's own centre goes so that `c` lands in the middle of the visible part. */
  private mapCenterFor(c: UiLatLng, zoom: number): Leaflet.LatLngExpression {
    const { map, shift } = this;
    if (!map || (!shift.x && !shift.y)) return [c.lat, c.lng];
    const p = map.project([c.lat, c.lng], zoom);
    return map.unproject([p.x - shift.x, p.y - shift.y], zoom);
  }

  private moveTo(c: UiLatLng, zoom: number): void {
    const map = this.map;
    if (!map) return;
    const v = this.view;
    if (v && Math.abs(v.lat - c.lat) < 1e-7 && Math.abs(v.lng - c.lng) < 1e-7 && v.zoom === zoom) return;
    this.release();
    map.setView(this.mapCenterFor(c, zoom), zoom, { animate: !this.still() });
  }

  /**
   * Lays the controls out between the insets and keeps the middle of the visible part in place: the
   * point that was in the middle of the old visible part pans to the middle of the new one.
   */
  private applyInsets(insets: UiMapInsets): void {
    const el = this.host.nativeElement;
    const rtl = this.rtl();
    const start = insets.start ?? 0;
    const end = insets.end ?? 0;
    const px = (n: number) => `${Math.max(0, n)}px`;
    // The canvas lays out LTR (tiles are physical), so the controls' insets are physical too.
    el.style.setProperty('--ui-map-inset-top', px(insets.top ?? 0));
    el.style.setProperty('--ui-map-inset-bottom', px(insets.bottom ?? 0));
    el.style.setProperty('--ui-map-inset-left', px(rtl ? end : start));
    el.style.setProperty('--ui-map-inset-right', px(rtl ? start : end));
    // The locate button sits at the inline end (its own CSS flips it in RTL).
    el.style.setProperty('--ui-map-inset-end', px(end));
    const next = uiMapInsetShift(insets, rtl);
    const old = this.shift;
    this.shift = next;
    // A turned map turns about the middle of the visible part.
    if (this.rotor) this.rotor.style.transformOrigin = this.pivotCss();
    const map = this.map;
    if (!map || (old.x === next.x && old.y === next.y)) return;
    // A fit owns the camera: work it out again for the new insets (not a pan at a stale zoom).
    if (this.fit) {
      this.applyFit();
      return;
    }
    if (!this.view) {
      // Not moved yet: centre the input centre in the new visible part.
      map.setView(this.mapCenterFor(this.center(), this.zoom()), this.zoom(), { animate: false });
      return;
    }
    map.panBy([old.x - next.x, old.y - next.y], { animate: !this.still(), duration: 0.32, easeLinearity: 0.5 });
  }

  private drawPulse(p: UiMapPulse | null): void {
    const { L, map } = this;
    if (!L || !map) return;
    if (!p || p.active === false) {
      this.pulseMarker?.remove();
      this.pulseMarker = null;
      this.pulseKey = '';
      return;
    }
    const still = this.reduced();
    const key = `${p.tone ?? 'primary'}|${still}`;
    if (this.pulseMarker && key === this.pulseKey) {
      this.pulseMarker.setLatLng([p.lat, p.lng]);
      return;
    }
    this.pulseMarker?.remove();
    const marker = L.marker([p.lat, p.lng], {
      pane: PULSE_PANE,
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: 'ui-map-pulse', html: uiMapPulseHtml(still), iconSize: [0, 0] }),
    });
    this.pulseMarker = marker.addTo(map);
    this.pulseKey = key;
    const el = marker.getElement();
    el?.setAttribute('aria-hidden', 'true');
    el?.setAttribute('data-tone', p.tone ?? 'primary');
  }

  /**
   * Shows the tiles at `url`. Only the URL changed (the theme flipped between the light and dark
   * tiles): the same layer swaps its URL in place, so the map isn't rebuilt. Otherwise a new layer.
   */
  private drawTiles(url: string, attribution: string): void {
    const { L, map } = this;
    if (!L || !map) return;
    const tileSize = this.tileSize();
    const zoomOffset = this.zoomOffset();
    const referrerPolicy = this.tileReferrerPolicy();
    const key = JSON.stringify([attribution, tileSize, zoomOffset, referrerPolicy]);
    const layer = this.tiles as (Leaflet.TileLayer & { _url?: string }) | null;
    if (layer && key === this.tilesKey && typeof layer.setUrl === 'function') {
      if (layer._url !== url) layer.setUrl(url);
      return;
    }
    this.tiles?.remove();
    const tiles = L.tileLayer(url, { attribution, maxZoom: 19, tileSize, zoomOffset, crossOrigin: true, referrerPolicy });
    this.coverTurned(tiles);
    this.tiles = tiles.addTo(map);
    this.tilesKey = key;
  }

  private drawUser(u: UiMapUserLocation | null): void {
    const { L, map } = this;
    if (!L || !map) return;
    const halo = u ? uiMapAccuracyPx(u.accuracy, u.lat, map.getZoom()) : 0;
    const arrow = !!u && u.heading !== undefined && u.heading !== null && Number.isFinite(u.heading);
    const key = `${halo}|${arrow}`;
    // The same shape (0.47.0): move it and turn its arrow in place, so the arrow eases with the
    // map's turn instead of jumping ahead of it.
    if (u && this.userMarker && key === this.userKey) {
      this.userMarker.setLatLng([u.lat, u.lng]);
      if (arrow) this.turnPuck(u.heading!);
      return;
    }
    this.userMarker?.remove();
    this.userMarker = null;
    this.userKey = '';
    if (!u) return;
    if (arrow) this.puckTurn = ((u.heading! % 360) + 360) % 360;
    const marker = L.marker([u.lat, u.lng], {
      pane: USER_PANE,
      // Not a target: its halo can be 240px across, and a tap there still places the pin / is a map tap.
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: 'ui-map-user', html: uiMapUserHtml(halo, u.heading), iconSize: [0, 0] }),
    });
    this.userMarker = marker.addTo(map);
    this.userKey = key;
    const el = marker.getElement();
    el?.setAttribute('role', 'img');
    el?.setAttribute('aria-label', this.strings.mapYourLocation);
  }

  /** Turns the arrow puck to `heading` the shorter way round. */
  private turnPuck(heading: number): void {
    const delta = ((((heading - this.puckTurn) % 360) + 540) % 360) - 180;
    this.puckTurn += delta;
    const puck = this.userMarker?.getElement()?.querySelector<HTMLElement>('.ui-map-user-puck');
    if (puck) puck.style.transform = `rotate(${Math.round(this.puckTurn * 10) / 10}deg)`;
  }

  /** The widest a marker label gets: 320px, or the map's width less 32px when that is narrower. */
  private sizeLabels(): void {
    const canvas = this.host.nativeElement.querySelector('.ui-map-canvas') as HTMLElement | null;
    const w = canvas?.clientWidth ?? 0;
    // Not laid out yet: the stylesheet's 320px stands.
    if (w > 0) this.host.nativeElement.style.setProperty('--ui-map-label-max', `${Math.max(80, Math.min(320, w - 32))}px`);
  }

  /**
   * Draws `list`: moves, recolours or relabels the routes already drawn, adds new ones, removes the
   * rest. A new route, or new points for one, draws in from its start (0.46.2) unless `animate` is
   * false, reduced motion is on or the map is a preview; the same points again change nothing. A
   * removed route fades out over 150 ms (at once under reduced motion).
   */
  private drawRoutes(list: readonly UiMapRoute[]): void {
    const { L, map } = this;
    if (!L || !map) return;
    const seen = new Set<string>();
    const still = this.still();
    let animating = false;
    for (const r of list) {
      const ll = r.points.map(uiMapPoint);
      if (ll.length < 2 || seen.has(r.id)) continue;
      seen.add(r.id);
      const key = ll.map((p) => `${p.lat},${p.lng}`).join(';');
      const animate = r.animate !== false && !still;
      // Coming back while it fades out: the old lines go now, new ones draw.
      this.dropLeaving(r.id);
      let layers = this.routeLayers.get(r.id);
      const shown = (pts: readonly UiLatLng[]) => pts.map((p) => [p.lat, p.lng] as [number, number]);
      const first = animate ? shown(uiMapRoutePartial(ll, 0)) : shown(ll);
      if (!layers) {
        const { line: lw, casing: cw } = uiMapRouteWidth(map.getZoom());
        const opts = { pane: ROUTE_PANE, interactive: false, lineCap: 'round', lineJoin: 'round', smoothFactor: 1 } as const;
        layers = {
          casing: L.polyline(first, { ...opts, weight: cw, className: 'ui-map-route-casing' }).addTo(map),
          line: L.polyline(first, { ...opts, weight: lw, className: 'ui-map-route-line' }).addTo(map),
          key,
        };
        this.routeLayers.set(r.id, layers);
        layers.casing.getElement()?.setAttribute('aria-hidden', 'true');
        if (animate) layers.anim = { start: this.now(), ms: uiMapRouteDrawMs(uiMapRouteLength(ll)), pts: ll };
      } else if (layers.key !== key) {
        layers.key = key;
        layers.casing.setLatLngs(first);
        layers.line.setLatLngs(first);
        layers.anim = animate ? { start: this.now(), ms: uiMapRouteDrawMs(uiMapRouteLength(ll)), pts: ll } : undefined;
      } else if (layers.anim && !animate) {
        // Same points, but the draw-in is off now (animate: false, reduced motion): finish it at once.
        layers.anim = undefined;
        layers.casing.setLatLngs(shown(ll));
        layers.line.setLatLngs(shown(ll));
      }
      if (layers.anim) animating = true;
      const el = layers.line.getElement() as SVGElement | undefined;
      el?.setAttribute('data-tone', r.tone ?? 'primary');
      el?.setAttribute('data-route', r.id);
      // Inline, over the stylesheet's stroke-opacity: 1 (0.47.0).
      if (el) el.style.strokeOpacity = r.opacity === undefined || r.opacity >= 1 ? '' : String(Math.max(0, r.opacity));
      if (r.label) {
        el?.setAttribute('role', 'img');
        el?.setAttribute('aria-label', r.label);
        el?.removeAttribute('aria-hidden');
      } else {
        el?.removeAttribute('role');
        el?.removeAttribute('aria-label');
        el?.setAttribute('aria-hidden', 'true');
      }
    }
    for (const [id, layers] of this.routeLayers) {
      if (seen.has(id)) continue;
      this.routeLayers.delete(id);
      if (still) {
        layers.casing.remove();
        layers.line.remove();
        continue;
      }
      for (const l of [layers.casing, layers.line]) {
        const el = l.getElement();
        el?.classList.add('ui-map-route-leaving');
        el?.removeAttribute('role');
        el?.removeAttribute('aria-label');
        el?.setAttribute('aria-hidden', 'true');
      }
      this.routeLeaving.set(id, { layers, timer: setTimeout(() => this.dropLeaving(id), UI_MAP_ROUTE_FADE_MS) });
    }
    if (animating) this.routeTick();
  }

  /** Removes a fading route's lines now. */
  private dropLeaving(id: string): void {
    const leaving = this.routeLeaving.get(id);
    if (!leaving) return;
    clearTimeout(leaving.timer);
    leaving.layers.casing.remove();
    leaving.layers.line.remove();
    this.routeLeaving.delete(id);
  }

  /** The clock the draw-in runs on. */
  private now(): number {
    return globalThis.performance?.now() ?? Date.now();
  }

  /** One frame of the draw-in: each animating route grows to its eased length; asks for the next frame while any runs. */
  private routeTick(): void {
    if (this.routeFrame !== null) return;
    const raf = globalThis.requestAnimationFrame;
    if (!raf) {
      // No frames (a server, an odd test host): draw them whole.
      for (const r of this.routeLayers.values()) this.finishRoute(r);
      return;
    }
    // Outside the Angular zone: a frame per route point change must not run change detection.
    this.zone.runOutsideAngular(() => {
      this.routeFrame = raf(() => {
        this.routeFrame = null;
        if (!this.map) return;
        const now = this.now();
        let more = false;
        for (const r of this.routeLayers.values()) {
          const a = r.anim;
          if (!a) continue;
          const t = (now - a.start) / a.ms;
          if (t >= 1) {
            this.finishRoute(r);
            continue;
          }
          const pts = uiMapRoutePartial(a.pts, uiMapRouteEase(t)).map((p) => [p.lat, p.lng] as [number, number]);
          r.casing.setLatLngs(pts);
          r.line.setLatLngs(pts);
          more = true;
        }
        if (more) this.routeTick();
      });
    });
  }

  /** Ends a route's draw-in: the whole route. */
  private finishRoute(r: RouteLayers): void {
    if (!r.anim) return;
    const pts = r.anim.pts.map((p) => [p.lat, p.lng] as [number, number]);
    r.anim = undefined;
    r.casing.setLatLngs(pts);
    r.line.setLatLngs(pts);
  }

  /** Stops every draw-in and fade (the map is going). */
  private stopRouteAnimations(): void {
    if (this.routeFrame !== null) globalThis.cancelAnimationFrame?.(this.routeFrame);
    this.routeFrame = null;
    for (const l of this.routeLeaving.values()) clearTimeout(l.timer);
    this.routeLeaving.clear();
  }

  /** The route widths for the current zoom. */
  private styleRoutes(): void {
    const map = this.map;
    if (!map || !this.routeLayers.size) return;
    const { line, casing } = uiMapRouteWidth(map.getZoom());
    for (const r of this.routeLayers.values()) {
      r.casing.setStyle({ weight: casing });
      r.line.setStyle({ weight: line });
    }
  }

  private drawMarkers(list: UiMapMarker[]): void {
    const { L, markerLayer } = this;
    if (!L || !markerLayer) return;
    markerLayer.clearLayers();
    this.markerById.clear();
    for (const m of list) {
      const marker = L.marker([m.lat, m.lng], {
        icon: L.divIcon({ className: 'ui-map-marker', html: uiMapMarkerHtml(m), iconSize: undefined }),
        title: m.ariaLabel ?? m.label ?? '',
        alt: m.ariaLabel ?? m.label ?? '',
        keyboard: true,
        riseOnHover: true,
      });
      marker.on('click', () => this.zone.run(() => this.markerSelected.emit(m)));
      this.upright(marker);
      marker.addTo(markerLayer);
      // Its name, whether or not its label is shown (0.43.0: markerLabels can hide it).
      const name = m.ariaLabel ?? m.label;
      if (name) marker.getElement()?.setAttribute('aria-label', name);
      if (!this.markerById.has(m.id)) this.markerById.set(m.id, marker);
    }
    this.applySelection();
  }

  /**
   * The selected marker (0.43.0) and the label mode, on the markers already drawn: the selected one
   * gets data-selected (bigger, ringed, haloed), rises above the others and is aria-pressed; labels
   * the mode hides get data-label-hidden (their aria-label still names the marker).
   */
  private applySelection(): void {
    const selected = this.selectedMarkerId();
    const mode = this.markerLabels();
    for (const [id, marker] of this.markerById) {
      const el = marker.getElement();
      const on = selected !== null && id === selected;
      marker.setZIndexOffset(on ? 500 : 0);
      if (!el) continue;
      el.toggleAttribute('data-selected', on);
      if (selected === null) el.removeAttribute('aria-pressed');
      else el.setAttribute('aria-pressed', on ? 'true' : 'false');
      el.toggleAttribute('data-label-hidden', !uiMapLabelShown(mode, on));
    }
    this.placeLabels();
  }

  /**
   * Puts each marker label on the side of its dot where it fits (`uiMapLabelSide`): the inline end,
   * or the other side near the map's edge. Run as the map moves, zooms or resizes.
   */
  private placeLabels(): void {
    const { map, markerLayer } = this;
    if (!map || !markerLayer) return;
    const width = map.getSize().x;
    const rtl = this.rtl();
    markerLayer.eachLayer((layer) => {
      const marker = layer as Leaflet.Marker;
      const el = marker.getElement?.();
      const label = el?.querySelector<HTMLElement>('.ui-map-label');
      if (!el || !label) return;
      const c = map.latLngToContainerPoint(marker.getLatLng());
      // On a turned map, where the marker is on screen.
      const x = this.turn ? uiMapRotatePoint(c, this.pivot(), this.turn).x : c.x;
      const side = uiMapLabelSide(x, label.offsetWidth, width, rtl);
      if (el.getAttribute('data-side') !== side) el.setAttribute('data-side', side);
    });
  }

  private drawPin(p: UiLatLng | null): void {
    const { L, map } = this;
    if (!L || !map) return;
    if (!p) {
      this.pinMarker?.remove();
      this.pinMarker = null;
      return;
    }
    const draggable = this.pinDraggable();
    // A fixed pin is rebuilt when that changes (Leaflet sets keyboard and interactivity at creation).
    if (this.pinMarker && (this.pinMarker.options.draggable ?? false) !== draggable) {
      this.pinMarker.remove();
      this.pinMarker = null;
    }
    if (!this.pinMarker) {
      const marker = L.marker([p.lat, p.lng], {
        draggable,
        keyboard: draggable,
        // A fixed pin is still a foreground object: it takes taps without becoming focusable.
        interactive: true,
        bubblingMouseEvents: false,
        title: this.pinLabel(),
        alt: this.pinLabel(),
        zIndexOffset: 1000,
        // The head is a 22px square turned 45deg: its point is 11 + 11 * sqrt(2) = 27px down.
        icon: L.divIcon({ className: 'ui-map-pin', html: '<span class="ui-map-pin-head"></span>', iconSize: [28, 36], iconAnchor: [14, 27] }),
      });
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        this.zone.run(() => this.pin.set({ lat: ll.lat, lng: ll.lng }));
      });
      marker.on('click', () => {});
      this.upright(marker);
      this.pinMarker = marker.addTo(map);
      if (!draggable) {
        // A fixed location: still named for screen readers, though it takes no input.
        const el = marker.getElement();
        el?.setAttribute('role', 'img');
        el?.setAttribute('aria-label', this.pinLabel());
      }
    } else {
      this.pinMarker.setLatLng([p.lat, p.lng]);
    }
  }

  /** The point the map turns about: the middle of the visible part, in container px. */
  private pivot(): { x: number; y: number } {
    const s = this.map?.getSize();
    return { x: (s?.x ?? 0) / 2 + this.shift.x, y: (s?.y ?? 0) / 2 + this.shift.y };
  }

  private pivotCss(): string {
    const p = this.pivot();
    return `${p.x}px ${p.y}px`;
  }

  /**
   * Turns the map so `bearing` is up (0.47.0). Leaflet 1.9 can't rotate, and the leaflet-rotate
   * plugin patches Leaflet's prototypes for every map on the page (and needs a global L), so the
   * map turns here, for this map only: its map pane goes into a wrapper turned with CSS about the
   * middle of the visible part; pointer positions and drags are turned back (see init); the tiles
   * and lines cover the turned view's corners; markers, the pin and the area handle are turned back
   * upright. The controls stay put (they are outside the turned pane). A short turn animation
   * unless reduced motion or a preview.
   */
  private applyBearing(bearing: number, animate = true): void {
    const { L, map } = this;
    if (!L || !map) return;
    const target = Number.isFinite(bearing) ? bearing : 0;
    const delta = ((((target - this.turn) % 360) + 540) % 360) - 180;
    this.setTurn(Math.abs(delta) < 1e-9 ? this.turn : this.turn + delta, animate);
  }

  /** Turns the map to `next` degrees (unwrapped) about the middle of the visible part. */
  private setTurn(next: number, animate: boolean): void {
    const { L, map } = this;
    if (!L || !map) return;
    if (next === this.turn && (this.rotor || !next)) return;
    const was = this.turn;
    this.turn = Math.abs(((next % 360) + 360) % 360) < 1e-9 ? Math.round(next / 360) * 360 : next;
    if (!this.rotor) {
      const pane = map.getPane('mapPane')!;
      const rotor = document.createElement('div');
      rotor.className = 'ui-map-rotor';
      pane.parentNode!.insertBefore(rotor, pane);
      rotor.appendChild(pane);
      this.rotor = rotor;
    }
    const rotor = this.rotor;
    rotor.style.transformOrigin = this.pivotCss();
    rotor.toggleAttribute('data-animate', animate && !this.still() && was !== this.turn);
    rotor.style.transform = this.turn ? `rotate(${-this.turn}deg)` : '';
    this.host.nativeElement.toggleAttribute('data-turned', ((this.turn % 360) + 360) % 360 !== 0);
    // The lines and the area are clipped to what Leaflet thinks is in view: give them the corners.
    const padded = this.turn ? 1.5 : 0.1;
    const m = map as unknown as { _renderer?: Leaflet.Renderer; _paneRenderers?: Record<string, Leaflet.Renderer> };
    for (const r of [m._renderer, ...Object.values(m._paneRenderers ?? {})]) {
      if (!r) continue;
      r.options.padding = padded;
      (r as unknown as { _update?: () => void })._update?.();
    }
    if (!(map as unknown as { _animatingZoom?: boolean })._animatingZoom) (this.tiles as unknown as { _update?: () => void } | null)?._update?.();
    // Upright again for the new turn.
    for (const marker of [...this.markerById.values(), this.pinMarker, this.areaHandle]) (marker as unknown as { update?: () => void } | null)?.update?.();
    this.placeLabels();
    this.updateCompass();
  }

  /**
   * Turns the map so `bearing` is up (0.47.0), eased unless reduced motion; for an app that needs
   * the turn back after the person turned it (a navigation view's Recenter), since `[bearing]` only
   * acts when it changes.
   */
  rotateTo(bearing: number): void {
    this.applyBearing(bearing, true);
  }

  /** The bearing shown, degrees clockwise from north in 0..360. */
  currentBearing(): number {
    return ((this.turn % 360) + 360) % 360;
  }

  /** The compass: north up again, and `(bearingChange)` 0. */
  private resetNorth(): void {
    this.applyBearing(0, true);
    this.zone.run(() => this.bearingChange.emit(0));
  }

  /** The compass shows while the map is turned (and not on a preview); its needle points north. */
  private updateCompass(): void {
    const box = (this.compassControl as unknown as { getContainer?: () => HTMLElement | undefined } | null)?.getContainer?.();
    if (!box) return;
    box.hidden = !this.compass() || this.preview() || !uiMapIsTurned(this.turn);
    const a = box.querySelector('a');
    a?.setAttribute('title', this.strings.mapResetNorth);
    a?.setAttribute('aria-label', this.strings.mapResetNorth);
    const svg = box.querySelector<SVGElement>('svg');
    if (svg) svg.style.transform = `rotate(${-this.turn}deg)`;
  }

  /**
   * The person turns the map (0.47.0): two fingers twisting past `UI_MAP_ROTATE_THRESHOLD` before
   * the pinch zooms or pans (Leaflet's own pinch keeps the point under the fingers in place, so the
   * map turns about them), or Alt + drag around the middle of the visible part with a mouse.
   */
  private wireRotation(el: HTMLElement): void {
    const angle = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) => (Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180) / Math.PI;
    const diff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;
    let pinch: { angle: number; dist: number; mid: { x: number; y: number }; turn: number; mode: 'rotate' | 'pinch' | 'undecided' } | null = null;
    const can = () => this.rotatable() && !this.preview() && !!this.map;
    const finish = () => {
      if (pinch?.mode === 'rotate') this.zone.run(() => this.bearingChange.emit(this.currentBearing()));
      pinch = null;
    };
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 2 || !can()) {
        if (e.touches.length !== 2) finish();
        return;
      }
      const [a, b] = [e.touches[0], e.touches[1]];
      pinch = { angle: angle(a, b), dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY), mid: { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }, turn: this.turn, mode: 'undecided' };
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (!pinch || e.touches.length !== 2) return;
      const [a, b] = [e.touches[0], e.touches[1]];
      const twist = diff(angle(a, b), pinch.angle);
      if (pinch.mode === 'undecided') {
        const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        const mid = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
        pinch.mode = uiMapTwoFingerGesture(twist, pinch.dist ? dist / pinch.dist : 1, Math.hypot(mid.x - pinch.mid.x, mid.y - pinch.mid.y));
        // (The two-finger touch already said userMove.)
        if (pinch.mode === 'rotate') this.release();
      }
      // Fingers turning clockwise turn the map clockwise: north moves clockwise, the bearing goes down.
      if (pinch.mode === 'rotate') this.setTurn(pinch.turn - twist, false);
    }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) finish();
    }, { passive: true });
    el.addEventListener('touchcancel', finish, { passive: true });

    // Alt + drag with a mouse: the turn follows the pointer around the middle of the visible part.
    el.addEventListener('pointerdown', (e) => {
      if (!e.altKey || e.pointerType !== 'mouse' || e.button !== 0 || !can()) return;
      // Before Leaflet's own drag sees it.
      e.stopPropagation();
      e.preventDefault();
      const box = el.getBoundingClientRect();
      const p = this.pivot();
      const around = (ev: { clientX: number; clientY: number }) => (Math.atan2(ev.clientY - box.top - p.y, ev.clientX - box.left - p.x) * 180) / Math.PI;
      const start = around(e);
      const turn0 = this.turn;
      let turned = false;
      const move = (ev: PointerEvent) => {
        const d = diff(around(ev), start);
        if (!turned && Math.abs(d) < 2) return;
        if (!turned) {
          turned = true;
          this.release();
          this.zone.run(() => this.userMove.emit());
        }
        this.setTurn(turn0 - d, false);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (turned) this.zone.run(() => this.bearingChange.emit(this.currentBearing()));
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    }, { capture: true });
    // Leaflet starts its drag on mousedown: an Alt press is ours.
    el.addEventListener('mousedown', (e) => {
      if (e.altKey && e.button === 0 && can()) e.stopPropagation();
    }, { capture: true });
  }

  /** The tiles also load the corners a turned map shows (Leaflet loads only the unturned view). */
  private coverTurned(tiles: Leaflet.TileLayer): void {
    const L = this.L!;
    const layer = tiles as unknown as { _getTiledPixelBounds: (c: Leaflet.LatLng) => Leaflet.Bounds };
    if (typeof layer._getTiledPixelBounds !== 'function') return;
    const own = layer._getTiledPixelBounds.bind(layer);
    layer._getTiledPixelBounds = (center: Leaflet.LatLng) => {
      const b = own(center);
      const map = this.map;
      if (!this.turn || !map || !b.min || !b.max) return b;
      const size = map.getSize();
      const p = this.pivot();
      const corners = [[0, 0], [size.x, 0], [0, size.y], [size.x, size.y]].map(([x, y]) => uiMapRotatePoint({ x, y }, p, this.turn, true));
      const kx = (b.max.x - b.min.x) / Math.max(1, size.x);
      const ky = (b.max.y - b.min.y) / Math.max(1, size.y);
      const xs = corners.map((c) => b.min!.x + c.x * kx);
      const ys = corners.map((c) => b.min!.y + c.y * ky);
      return L.bounds([Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]);
    };
  }

  /**
   * Keeps a marker upright on a turned map (0.47.0): its icon is turned back by the bearing about
   * its anchor (Leaflet places it with a translate; the turn is added after it).
   */
  private upright(marker: Leaflet.Marker): void {
    const m = marker as unknown as { _setPos: (p: Leaflet.Point) => void; _icon?: HTMLElement };
    if (typeof m._setPos !== 'function') return;
    const own = m._setPos.bind(marker);
    m._setPos = (pos: Leaflet.Point) => {
      own(pos);
      const el = m._icon;
      if (!el) return;
      if (!this.turn) {
        el.style.removeProperty('transform-origin');
        return;
      }
      const cs = getComputedStyle(el);
      el.style.transformOrigin = `${-(parseFloat(cs.marginLeft) || 0)}px ${-(parseFloat(cs.marginTop) || 0)}px`;
      el.style.transform += ` rotate(${this.turn}deg)`;
    };
  }

  /** Dark theme: dim the tiles, or show the dark ones. Re-check when a theme changes anywhere up the tree. */
  private watchTheme(destroy: DestroyRef): void {
    uiWatchTheme(this.host.nativeElement, destroy, () => this.dark.set(uiMapIsDark(getComputedStyle(this.host.nativeElement).backgroundColor)));
  }
}
