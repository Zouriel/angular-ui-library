import { isPlatformBrowser } from '@angular/common';
import {
  Component, DestroyRef, booleanAttribute, ElementRef, InjectionToken, NgZone, PLATFORM_ID, ViewEncapsulation, afterNextRender, effect, inject, input, model, output, signal, untracked,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';
import Gps01Icon from '@hugeicons/core-free-icons/Gps01Icon';
import GpsOff01Icon from '@hugeicons/core-free-icons/GpsOff01Icon';
import { injectUiStrings, uiWatchTheme, type UiStatus } from '@zouriel/ui';
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
  const metresPerPx = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** (zoom + 8);
  return Math.min(UI_MAP_ACCURACY_MAX, Math.max(UI_MAP_ACCURACY_MIN, Math.round((2 * accuracy) / metresPerPx)));
}

/** The "you are here" HTML: the halo (when sized) under a dot with a white ring. */
export function uiMapUserHtml(halo: number): string {
  return `${halo ? `<span class="ui-map-user-halo" style="width:${halo}px;height:${halo}px;left:${-halo / 2}px;top:${-halo / 2}px"></span>` : ''}<span class="ui-map-user-dot"></span>`;
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
 * For "Show both": `{ id: 'fit', icon: CenterFocusIcon, label: 'Show both' }` and
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

/** The Leaflet pane the pulse is drawn in: above the tiles (200) and overlays (400), below markers (600). */
const PULSE_PANE = 'uiMapPulse';
/** The "you are here" dot's pane: above the pulse, below the markers and the pin. */
const USER_PANE = 'uiMapUser';
/** The routes' pane: above the tiles (200) and overlays (400), below the pulse (450), dot and markers. */
const ROUTE_PANE = 'uiMapRoute';

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
 *
 * Give it a height (`--ui-map-height`, 320px by default, or a height on the element, or `fill`).
 */
@Component({
  selector: 'ui-map',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'ui-map', '[attr.data-dark]': 'dark() || null', '[attr.data-dark-tiles]': '(dark() && !!tileUrlDark()) || null', '[class.ui-map-fill]': 'fill()', role: 'region', '[attr.aria-label]': 'ariaLabel()' },
  imports: [HugeiconsIconComponent, UiTooltip],
  template: `<div class="ui-map-canvas" #canvas></div>
    @if (locateControl()) {
      <button type="button" class="ui-map-locate" [attr.data-state]="locating() ? 'locating' : locateOff() ? 'off' : null"
        [attr.aria-label]="strings.mapLocate" [attr.aria-busy]="locating() ? 'true' : null"
        [attr.aria-description]="locateOff() ? strings.mapLocationOff : null"
        [uiTooltip]="locateOff() ? strings.mapLocationOff : ''" uiTooltipPosition="left" (click)="onLocate()">
        @if (locating()) {
          <span class="ui-map-locate-spin" aria-hidden="true"></span>
        } @else {
          <hugeicons-icon [icon]="locateOff() ? icons.off : icons.locate" [size]="20" [strokeWidth]="1.8" aria-hidden="true" />
        }
      </button>
    }
    @if (controls().length) {
      <div class="ui-map-controls" [attr.data-locate]="locateControl() || null">
        @for (c of controls(); track c.id) {
          <button type="button" class="ui-map-control" [attr.data-control]="c.id" [attr.aria-label]="c.label" [disabled]="!!c.disabled"
            [uiTooltip]="c.tooltip ?? ''" [uiTooltipPosition]="tooltipSide()" (click)="onControl(c)">
            <hugeicons-icon [icon]="c.icon" [size]="20" [strokeWidth]="1.8" aria-hidden="true" />
          </button>
        }
      </div>
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

  readonly markerSelected = output<UiMapMarker>();
  readonly centerChanged = output<UiMapView>();
  /** The "Show my location" button was pressed (not while `locating`). */
  readonly locate = output<void>();
  /** One of `controls` was pressed (not while disabled). */
  readonly controlPress = output<UiMapControl>();

  protected readonly icons = { locate: Gps01Icon, off: GpsOff01Icon };

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
  private pinMarker: Leaflet.Marker | null = null;
  private tiles: Leaflet.TileLayer | null = null;
  private pulseMarker: Leaflet.Marker | null = null;
  private userMarker: Leaflet.Marker | null = null;
  /** Each route's casing and line, by id, so an update moves them instead of rebuilding them. */
  private routeLayers = new Map<string, { casing: Leaflet.Polyline; line: Leaflet.Polyline }>();
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
      // The map surface is the focusable, keyboard-pannable element: it carries the name.
      el.setAttribute('aria-label', this.ariaLabel());
      if (this.pinMode()) el.setAttribute('aria-description', this.strings.placePinAtCentre + ' (Enter)');
      // English credits: laid out LTR in any page direction (map.css isolates them too).
      L.control.attribution({ position: rtl ? 'bottomleft' : 'bottomright', prefix: false }).addTo(map).getContainer?.()?.setAttribute('dir', 'ltr');
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
      this.map = map;
      this.markerLayer = L.layerGroup().addTo(map);
      // The person moves the map (drag, wheel, double click, pinch, keys, box zoom): it is theirs now.
      map.on('dragstart boxzoomend', () => this.release());
      el.addEventListener('wheel', () => this.release(), { passive: true });
      el.addEventListener('dblclick', () => this.release());
      el.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) this.release();
      }, { passive: true });
      el.addEventListener('keydown', (e) => {
        if (e.target === el && /^(Arrow(Up|Down|Left|Right)|[-+=_])$/.test(e.key)) this.release();
      });
      // A fit asked for while Leaflet was mid-zoom runs once it has landed.
      map.on('zoomend moveend', () => {
        if (!this.refitPending) return;
        this.refitPending = false;
        this.applyFit();
      });
      // Labels pick their side from where the marker is on screen.
      map.on('move zoomend resize', () => this.placeLabels());
      map.on('moveend', () => {
        const c = this.visibleCenter();
        this.view = { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
        this.zone.run(() => this.centerChanged.emit({ ...this.view! }));
      });
      map.on('click', (e: Leaflet.LeafletMouseEvent) => {
        if (this.pinMode()) this.zone.run(() => this.pin.set({ lat: e.latlng.lat, lng: e.latlng.lng }));
      });
      // Enter on the focused map drops the pin at its centre (keyboard users pan with the arrows).
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !this.pinMode() || e.target !== el) return;
        const c = this.visibleCenter();
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
      });
      this.teardown = () => {
        ro.disconnect();
        map.remove();
        this.map = null;
        this.markerLayer = null;
        this.pinMarker = null;
        this.pulseMarker = null;
        this.pulseKey = '';
        this.userMarker = null;
        this.routeLayers.clear();
        this.tiles = null;
        this.tilesKey = '';
        this.fit = null;
        this.refitPending = false;
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
    map.setView(this.mapCenterFor(c, z), z, { animate: !this.reduced() });
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
    if (!this.map || !points.length) return;
    this.fit = { points: [...points], options: { ...options } };
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
    map.setView([v.lat, v.lng], v.zoom, { animate: options.animate !== false && !this.reduced() });
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
  private visibleCenter(): Leaflet.LatLng {
    const map = this.map!;
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
    map.setView(this.mapCenterFor(c, zoom), zoom, { animate: !this.reduced() });
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
    map.panBy([old.x - next.x, old.y - next.y], { animate: !this.reduced(), duration: 0.32, easeLinearity: 0.5 });
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
    this.tiles = L.tileLayer(url, { attribution, maxZoom: 19, tileSize, zoomOffset, crossOrigin: true, referrerPolicy }).addTo(map);
    this.tilesKey = key;
  }

  private drawUser(u: UiMapUserLocation | null): void {
    const { L, map } = this;
    if (!L || !map) return;
    this.userMarker?.remove();
    this.userMarker = null;
    if (!u) return;
    const halo = uiMapAccuracyPx(u.accuracy, u.lat, map.getZoom());
    const marker = L.marker([u.lat, u.lng], {
      pane: USER_PANE,
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: 'ui-map-user', html: uiMapUserHtml(halo), iconSize: [0, 0] }),
    });
    this.userMarker = marker.addTo(map);
    const el = marker.getElement();
    el?.setAttribute('role', 'img');
    el?.setAttribute('aria-label', this.strings.mapYourLocation);
  }

  /** The widest a marker label gets: 320px, or the map's width less 32px when that is narrower. */
  private sizeLabels(): void {
    const canvas = this.host.nativeElement.querySelector('.ui-map-canvas') as HTMLElement | null;
    const w = canvas?.clientWidth ?? 0;
    // Not laid out yet: the stylesheet's 320px stands.
    if (w > 0) this.host.nativeElement.style.setProperty('--ui-map-label-max', `${Math.max(80, Math.min(320, w - 32))}px`);
  }

  /** Draws `list`: moves, recolours or relabels the routes already drawn, adds new ones, removes the rest. */
  private drawRoutes(list: readonly UiMapRoute[]): void {
    const { L, map } = this;
    if (!L || !map) return;
    const seen = new Set<string>();
    for (const r of list) {
      const pts = r.points.map(uiMapPoint).map((p) => [p.lat, p.lng] as [number, number]);
      if (pts.length < 2 || seen.has(r.id)) continue;
      seen.add(r.id);
      let layers = this.routeLayers.get(r.id);
      if (!layers) {
        const { line: lw, casing: cw } = uiMapRouteWidth(map.getZoom());
        const opts = { pane: ROUTE_PANE, interactive: false, lineCap: 'round', lineJoin: 'round', smoothFactor: 1 } as const;
        layers = {
          casing: L.polyline(pts, { ...opts, weight: cw, className: 'ui-map-route-casing' }).addTo(map),
          line: L.polyline(pts, { ...opts, weight: lw, className: 'ui-map-route-line' }).addTo(map),
        };
        this.routeLayers.set(r.id, layers);
        layers.casing.getElement()?.setAttribute('aria-hidden', 'true');
      } else {
        layers.casing.setLatLngs(pts);
        layers.line.setLatLngs(pts);
      }
      const el = layers.line.getElement();
      el?.setAttribute('data-tone', r.tone ?? 'primary');
      el?.setAttribute('data-route', r.id);
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
      layers.casing.remove();
      layers.line.remove();
      this.routeLayers.delete(id);
    }
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
    for (const m of list) {
      const marker = L.marker([m.lat, m.lng], {
        icon: L.divIcon({ className: 'ui-map-marker', html: uiMapMarkerHtml(m), iconSize: undefined }),
        title: m.ariaLabel ?? m.label ?? '',
        alt: m.ariaLabel ?? m.label ?? '',
        keyboard: true,
        riseOnHover: true,
      });
      marker.on('click', () => this.zone.run(() => this.markerSelected.emit(m)));
      marker.addTo(markerLayer);
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
      const x = map.latLngToContainerPoint(marker.getLatLng()).x;
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
        interactive: draggable,
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

  /** Dark theme: dim the tiles, or show the dark ones. Re-check when a theme changes anywhere up the tree. */
  private watchTheme(destroy: DestroyRef): void {
    uiWatchTheme(this.host.nativeElement, destroy, () => this.dark.set(uiMapIsDark(getComputedStyle(this.host.nativeElement).backgroundColor)));
  }
}
