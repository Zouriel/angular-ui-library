import { isPlatformBrowser } from '@angular/common';
import {
  Component, DestroyRef, ElementRef, NgZone, PLATFORM_ID, ViewEncapsulation, afterNextRender, effect, inject, input, model, output, signal, untracked,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import type { UiStatus } from '@zouriel/ui';

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
}

/** Where the map is looking, after the person (or the app) moved it. */
export interface UiMapView extends UiLatLng {
  zoom: number;
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
 * - `[(pin)]` with `pinMode`: a draggable pin; a tap on the map, or Enter with the map focused (it
 *   goes to the map's centre), moves it there. For choosing a location.
 * - `[center]` / `[zoom]` move the map; `(centerChanged)` reports where the person moved it.
 * - Theme-aware: the controls use the theme, and on a dark theme the tiles are dimmed.
 * - The zoom buttons sit at the inline start (left in LTR, right in RTL) and the OSM attribution at
 *   the inline end; under reduced motion there are no zoom or pan animations.
 *
 * Give it a height (`--ui-map-height`, 320px by default, or a height on the element).
 */
@Component({
  selector: 'ui-map',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'ui-map', '[attr.data-dark]': 'dark() || null', role: 'region', '[attr.aria-label]': 'ariaLabel()' },
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
  tileUrl = input(UI_MAP_OSM_TILES);
  attribution = input(UI_MAP_OSM_ATTRIBUTION);
  ariaLabel = input('Map');

  readonly markerSelected = output<UiMapMarker>();
  readonly centerChanged = output<UiMapView>();

  /** The map is on a dark theme: tiles dimmed. */
  protected readonly dark = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private L: typeof Leaflet | null = null;
  private map: Leaflet.Map | null = null;
  private markerLayer: Leaflet.LayerGroup | null = null;
  private pinMarker: Leaflet.Marker | null = null;
  private tiles: Leaflet.TileLayer | null = null;
  /** The map's own view, so a center input that only echoes it doesn't move it again. */
  private view: UiMapView | null = null;

  constructor() {
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (!browser) return;
      this.watchTheme(destroy);
      void this.init(destroy);
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
      untracked(() => this.drawPin(p));
    });
    effect(() => {
      const url = this.tileUrl();
      const attr = this.attribution();
      untracked(() => this.drawTiles(url, attr));
    });
  }

  private reduced(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  private rtl(): boolean {
    return getComputedStyle(this.host.nativeElement).direction === 'rtl';
  }

  private async init(destroy: DestroyRef): Promise<void> {
    const mod = await import('leaflet');
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
      L.control.zoom({ position: rtl ? 'topright' : 'topleft' }).addTo(map);
      L.control.attribution({ position: rtl ? 'bottomleft' : 'bottomright', prefix: false }).addTo(map);
      this.map = map;
      this.markerLayer = L.layerGroup().addTo(map);
      map.on('moveend', () => {
        const c = map.getCenter();
        this.view = { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
        this.zone.run(() => this.centerChanged.emit({ ...this.view! }));
      });
      map.on('click', (e: Leaflet.LeafletMouseEvent) => {
        if (this.pinMode()) this.zone.run(() => this.pin.set({ lat: e.latlng.lat, lng: e.latlng.lng }));
      });
      // Enter on the focused map drops the pin at its centre (keyboard users pan with the arrows).
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !this.pinMode() || e.target !== el) return;
        const c = map.getCenter();
        this.zone.run(() => this.pin.set({ lat: c.lat, lng: c.lng }));
      });
      const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
      ro.observe(el);
      destroy.onDestroy(() => {
        ro.disconnect();
        map.remove();
        this.map = null;
      });
    });
    this.drawTiles(this.tileUrl(), this.attribution());
    this.drawMarkers(this.markers());
    this.drawPin(this.pin());
  }

  private moveTo(c: UiLatLng, zoom: number): void {
    const map = this.map;
    if (!map) return;
    const v = this.view;
    if (v && Math.abs(v.lat - c.lat) < 1e-7 && Math.abs(v.lng - c.lng) < 1e-7 && v.zoom === zoom) return;
    map.setView([c.lat, c.lng], zoom, { animate: !this.reduced() });
  }

  private drawTiles(url: string, attribution: string): void {
    const { L, map } = this;
    if (!L || !map) return;
    this.tiles?.remove();
    this.tiles = L.tileLayer(url, { attribution, maxZoom: 19, crossOrigin: true }).addTo(map);
  }

  private drawMarkers(list: UiMapMarker[]): void {
    const { L, markerLayer } = this;
    if (!L || !markerLayer) return;
    markerLayer.clearLayers();
    for (const m of list) {
      const marker = L.marker([m.lat, m.lng], {
        icon: L.divIcon({ className: 'ui-map-marker', html: uiMapMarkerHtml(m), iconSize: undefined }),
        title: m.label ?? '',
        alt: m.label ?? '',
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
    if (!this.pinMarker) {
      const marker = L.marker([p.lat, p.lng], {
        draggable: true,
        keyboard: true,
        title: this.pinLabel(),
        alt: this.pinLabel(),
        zIndexOffset: 1000,
        icon: L.divIcon({ className: 'ui-map-pin', html: '<span class="ui-map-pin-head"></span>', iconSize: [28, 36], iconAnchor: [14, 34] }),
      });
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        this.zone.run(() => this.pin.set({ lat: ll.lat, lng: ll.lng }));
      });
      this.pinMarker = marker.addTo(map);
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
