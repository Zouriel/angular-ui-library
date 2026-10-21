import { isPlatformBrowser } from '@angular/common';
import {
  Component, DestroyRef, booleanAttribute, ElementRef, InjectionToken, NgZone, PLATFORM_ID, ViewEncapsulation, afterNextRender, effect, inject, input, model, output, signal, untracked,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { injectUiStrings, type UiStatus } from '@zouriel/ui';

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
 *
 * Give it a height (`--ui-map-height`, 320px by default, or a height on the element, or `fill`).
 */
@Component({
  selector: 'ui-map',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'ui-map', '[attr.data-dark]': 'dark() || null', '[class.ui-map-fill]': 'fill()', role: 'region', '[attr.aria-label]': 'ariaLabel()' },
  template: `<div class="ui-map-canvas" #canvas></div>`,
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
  attribution = input(UI_MAP_OSM_ATTRIBUTION);
  ariaLabel = input('Map');
  /** The "searching" rings around a point; null or `active: false` for none. */
  pulse = input<UiMapPulse | null>(null);
  /** Px covered by panels over each edge; centring and the controls use the part between them. */
  insets = input<UiMapInsets>({});
  /** Fill the parent's height with square corners (a full-screen map page). */
  fill = input(false, { transform: booleanAttribute });

  readonly markerSelected = output<UiMapMarker>();
  readonly centerChanged = output<UiMapView>();

  /** The map is on a dark theme: tiles dimmed. */
  protected readonly dark = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly loadLeaflet = inject(UI_MAP_LEAFLET);
  private readonly strings = injectUiStrings();
  private readonly zone = inject(NgZone);
  private L: typeof Leaflet | null = null;
  private map: Leaflet.Map | null = null;
  private markerLayer: Leaflet.LayerGroup | null = null;
  private pinMarker: Leaflet.Marker | null = null;
  private tiles: Leaflet.TileLayer | null = null;
  private pulseMarker: Leaflet.Marker | null = null;
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
      const url = this.tileUrl();
      const attr = this.attribution();
      this.tileReferrerPolicy();
      untracked(() => this.drawTiles(url, attr));
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
        map.setZoomAround(L.point(mid.x + this.shift.x, mid.y + this.shift.y), z); // a Point: a container point
      };
      Object.assign(zoom, { _zoomIn: around(1), _zoomOut: around(-1) });
      zoom.addTo(map);
      // The map surface is the focusable, keyboard-pannable element: it carries the name.
      el.setAttribute('aria-label', this.ariaLabel());
      if (this.pinMode()) el.setAttribute('aria-description', this.strings.placePinAtCentre + ' (Enter)');
      L.control.attribution({ position: rtl ? 'bottomleft' : 'bottomright', prefix: false }).addTo(map);
      // The pulse's own pane: geo-anchored like a marker, under the markers, never hit.
      const pane = map.createPane(PULSE_PANE);
      pane.style.zIndex = '450';
      pane.style.pointerEvents = 'none';
      this.map = map;
      this.markerLayer = L.layerGroup().addTo(map);
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
      const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
      ro.observe(el);
      this.teardown = () => {
        ro.disconnect();
        map.remove();
        this.map = null;
        this.markerLayer = null;
        this.pinMarker = null;
        this.pulseMarker = null;
        this.pulseKey = '';
        this.tiles = null;
      };
    });
    // Laid out from no insets, so a non-zero first value centres the view in the visible part.
    this.shift = { x: 0, y: 0 };
    this.applyInsets(this.insets());
    this.drawTiles(this.tileUrl(), this.attribution());
    this.drawMarkers(this.markers());
    this.drawPin(this.pin());
    this.drawPulse(this.pulse());
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
    const next = uiMapInsetShift(insets, rtl);
    const old = this.shift;
    this.shift = next;
    const map = this.map;
    if (!map || (old.x === next.x && old.y === next.y)) return;
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

  private drawTiles(url: string, attribution: string): void {
    const { L, map } = this;
    if (!L || !map) return;
    this.tiles?.remove();
    this.tiles = L.tileLayer(url, { attribution, maxZoom: 19, crossOrigin: true, referrerPolicy: this.tileReferrerPolicy() }).addTo(map);
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

  /** Dim the tiles on a dark theme; re-check when a theme changes anywhere up the tree. */
  private watchTheme(destroy: DestroyRef): void {
    const check = () => this.dark.set(uiMapIsDark(getComputedStyle(this.host.nativeElement).backgroundColor));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-theme'] });
    destroy.onDestroy(() => mo.disconnect());
  }
}
