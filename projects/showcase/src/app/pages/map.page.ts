import { Component, computed, signal } from '@angular/core';
import type { UiGlassStrength } from '@zouriel/ui';
import { UiMap, type UiLatLng, type UiMapInsets, type UiMapMarker, type UiMapPulse, type UiMapRoute, type UiMapRouteTone, type UiMapUserLocation, type UiMapView } from '@zouriel/ui/map';
import { UiFloatingPanel } from '@zouriel/ui/layout';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiBottomSheet } from '@zouriel/ui/dialog';
import { UiFormField, UiInput } from '@zouriel/ui/form';
import { FormsModule } from '@angular/forms';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const MARKER = `interface UiMapMarker {
  id: string;
  lat: number;
  lng: number;
  tone?: UiStatus;   // the dot's colour, default 'primary'
  label?: string;    // a pill beside the dot, and its accessible name
  ariaLabel?: string; // the accessible name when the label doesn't say enough
}
interface UiLatLng { lat: number; lng: number; }
interface UiMapView extends UiLatLng { zoom: number; }
interface UiMapPulse extends UiLatLng {
  tone?: UiStatus;   // the rings' colour, default 'primary'
  active?: boolean;  // false: nothing shown, nothing running
}
interface UiMapInsets { top?: number; bottom?: number; start?: number; end?: number; } // px
interface UiMapUserLocation extends UiLatLng {
  accuracy?: number; // metres: the soft halo's radius, drawn 28..240px across
}
type UiMapPoint = UiLatLng | [lat: number, lng: number];
interface UiMapRoute {
  id: string;
  points: UiMapPoint[];
  tone?: 'primary' | 'muted' | 'success' | 'warning' | 'danger'; // default 'primary'
  label?: string;    // its one name for screen readers: "Route, 1.3 km"
}
interface UiMapFitOptions {
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number }; // px, default 24
  maxZoom?: number;  // default 17, and the zoom for a single point
  animate?: boolean; // default true; never under reduced motion
}`;

const ROUTE_CODE = `<ui-map #map fill [insets]="{ top: cardCover(), bottom: sheetCover() }" [userLocation]="me()"
  [markers]="[patient]" [routes]="route() ? [{ id: 'to-patient', points: route()!.points, label: 'Route, ' + route()!.km + ' km' }] : []" />

// The moment she accepts: fetch the road route (OSRM GeoJSON is [lng, lat]: swap it) and show it all.
const r = await api.route(job.id, me);
this.route.set({ points: r.geometry.map(([lng, lat]) => [lat, lng]), km: (r.distance / 1000).toFixed(1) });
this.map().fitPoints([me, patient, ...this.route()!.points]); // inside the part between the insets`;

const TILES_CODE = `<!-- MapTiler raster (256 px): {r} is @2x on high-density screens. Keep the key out of the repo. -->
<ui-map
  tileUrl="https://api.maptiler.com/maps/dataviz/256/{z}/{x}/{y}{r}.png?key=YOUR_KEY"
  tileUrlDark="https://api.maptiler.com/maps/dataviz-dark/256/{z}/{x}/{y}{r}.png?key=YOUR_KEY"
  attribution="&copy; MapTiler &copy; OpenStreetMap contributors" />
<!-- 512 px tiles: [tileSize]="512" [zoomOffset]="-1" -->`;

const LOCATE_CODE = `<ui-map fill [insets]="{ bottom: sheetCover() }" [userLocation]="me()"
  locateControl [locating]="locating()" [locateOff]="denied()" (locate)="findMe()" />

async findMe() {
  this.locating.set(true);
  navigator.geolocation.getCurrentPosition((p) => {
    const me = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
    this.me.set(me);
    this.map().flyTo(me, 16); // centred in the part above the sheet
    this.locating.set(false);
  }, () => { this.denied.set(true); this.locating.set(false); });
}`;

const PAGE_CODE = `<div class="page"> <!-- position: fixed; inset: 0 -->
  <ui-map fill [center]="home" [zoom]="15" [markers]="nurses" [pin]="home" [pinDraggable]="false"
    [pulse]="{ lat: home.lat, lng: home.lng, active: searching() }"
    [insets]="{ top: cardCover(), bottom: sheetCover() }" />
  <ui-floating-panel placement="top" ariaLabel="Status" glass (coverChange)="cardCover.set($event)">
    <span role="status">{{ searching() ? 'Looking for a nurse near you' : 'Where should the nurse come?' }}</span>
  </ui-floating-panel>
  <ui-bottom-sheet title="Find a nurse" [snaps]="[0.42, 0.75]" [(snap)]="snap" [closable]="false" [maxWidth]="560"
    glass (coverChange)="sheetCover.set($event)">
    <ui-form-field label="Address"><ui-input [(ngModel)]="address" /></ui-form-field>
    <ui-button [block]="true" (click)="searching.set(!searching())">Find a nurse</ui-button>
  </ui-bottom-sheet>
</div>`;

@Component({
  selector: 'page-map',
  imports: [UiMap, UiFloatingPanel, UiButton, UiSegmented, UiBottomSheet, UiInput, UiFormField, FormsModule, UiSpinner, UiText, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Components" title="Map"
      lead="An OpenStreetMap map from @zouriel/ui/map, on Leaflet 1.9.4. The entry point and Leaflet itself load on first use, so a map never lands in an app's first download. Install leaflet (~1.9.4) next to the library.">

      <doc-section name="Map" selector="ui-map" [api]="api" [outputs]="out" [shapes]="MARKER"
        summary="Markers are dots in their tone with a label pill; selecting one (click, or Enter when it has focus) emits markerSelected. center and zoom move the map; centerChanged reports where the person moved it. The zoom buttons sit at the inline start and the OSM attribution at the inline end, so they swap in RTL; the attribution itself is always set left to right, so English credits keep their © signs in place. On touch screens the zoom buttons are 44px with a 48px hit area. The controls use the theme, and on a dark theme the tiles are dimmed. Under reduced motion there are no zoom or pan animations. Give it a height with --ui-map-height (320px by default).">
        <doc-demo lang="ts + html" code="import { UiMap, type UiMapMarker } from '@zouriel/ui/map';

<ui-map [center]=&quot;{ lat: 4.1755, lng: 73.5093 }&quot; [zoom]=&quot;15&quot; [markers]=&quot;nurses&quot;
  (markerSelected)=&quot;show($event)&quot; (centerChanged)=&quot;view = $event&quot; />">
          <div class="map-wrap">
            <ui-map [center]="center()" [zoom]="15" [markers]="markers" (markerSelected)="picked.set($event)" (centerChanged)="view.set($event)" ariaLabel="Nurses near you" />
            @if (picked(); as p) {
              <ui-floating-panel ariaLabel="Nurse">
                <strong>{{ p.label }}</strong>
                <div class="meta">{{ p.lat.toFixed(4) }}, {{ p.lng.toFixed(4) }}</div>
                <div class="acts"><ui-button size="sm" variant="outline" (click)="picked.set(null)">Close</ui-button></div>
              </ui-floating-panel>
            }
          </div>
          <ui-text variant="caption">View: {{ view() ? view()!.lat.toFixed(4) + ', ' + view()!.lng.toFixed(4) + ' at zoom ' + view()!.zoom : '—' }}</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Pin" anchor="pin" selector="ui-map [(pin)] · pinMode" [api]="pinApi"
        summary="For choosing a location: with pinMode a tap on the map moves the pin there, and the pin can be dragged. From the keyboard, focus the map, pan with the arrow keys and press Enter to drop the pin at the centre. pin is two-way.">
        <doc-demo code="<ui-map [pinMode]=&quot;true&quot; [(pin)]=&quot;home&quot; pinLabel=&quot;Your home&quot; />">
          <div class="map-wrap">
            <ui-map [center]="center()" [zoom]="16" [pinMode]="true" [(pin)]="pin" pinLabel="Your home" ariaLabel="Choose your home on the map" />
          </div>
          <ui-text variant="caption">Pin: {{ pin() ? pin()!.lat.toFixed(5) + ', ' + pin()!.lng.toFixed(5) : 'tap the map' }}</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Styled tiles" anchor="styled-tiles" selector="ui-map tileUrl · tileUrlDark" [api]="tilesApi"
        summary="Any raster tile service: tileUrl for light themes and tileUrlDark for dark ones. On a dark theme the dark tiles are shown as they are (no dimming), and the map swaps between the two the moment the theme changes, in the same tile layer. Without tileUrlDark the light tiles are dimmed on dark themes. {r} in the URL becomes @2x on a high-density screen; for 512 px tiles pass tileSize 512 and zoomOffset -1. Paste your own URLs below to try a style (this page never stores a key).">
        <doc-demo lang="html" [code]="TILES_CODE">
          <div class="tile-fields">
            <ui-form-field label="Light tile URL" hint="Empty: OpenStreetMap"><ui-input placeholder="https://api.maptiler.com/maps/dataviz/256/{z}/{x}/{y}{r}.png?key=YOUR_KEY" [(ngModel)]="tileLight" /></ui-form-field>
            <ui-form-field label="Dark tile URL" hint="Empty: the light tiles, dimmed"><ui-input placeholder="https://api.maptiler.com/maps/dataviz-dark/256/{z}/{x}/{y}{r}.png?key=YOUR_KEY" [(ngModel)]="tileDark" /></ui-form-field>
          </div>
          <div class="map-wrap">
            <ui-map [center]="center()" [zoom]="15" [markers]="markers" [tileUrl]="tileLight || osm" [tileUrlDark]="tileDark || null"
              [attribution]="tileLight ? 'Tiles from your URL &copy; OpenStreetMap contributors' : osmAttribution" ariaLabel="Styled map" />
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="My location" anchor="my-location" selector="ui-map locateControl · [userLocation]" [api]="locateApi"
        summary="locateControl adds a round Show my location button at the bottom-end corner of the visible part: it follows insets, so on a map page it floats just above the bottom sheet and moves with it. It is 38px, and on touch screens 44px with a 48px hit area around the circle. It emits locate; the app finds the position itself, sets userLocation and moves the map with flyTo (or center), which centre in the visible part. locating shows a spinner and ignores presses; locateOff shows the icon struck through with the tooltip Location is off, and a press still emits so the app can ask again. userLocation draws the you-are-here dot, blue with a white ring, over a soft halo as wide as the accuracy in metres (28 to 240 px across), above the tiles and below markers and the pin, named Your location. Try it on the map page.">
        <doc-demo lang="ts + html" [code]="LOCATE_CODE">
          <div class="map-wrap">
            <ui-map #small [center]="center()" [zoom]="15" [userLocation]="me()" locateControl [locating]="locating()" [locateOff]="locOff() === 'off'"
              (locate)="findMe(small)" ariaLabel="Where you are" />
          </div>
          <ui-segmented label="Location (demo)" size="sm" [options]="locOptions" [value]="locOff()" (valueChange)="locOff.set($any($event))" />
        </doc-demo>
      </doc-section>

      <doc-section name="Routes" anchor="routes" selector="ui-map [routes] · fitPoints()" [api]="routeApi"
        summary="routes draws lines along the road, from OSRM say: each one a line in its tone over a casing, round-capped, 5px over 9px close in and thinner zoomed out. They sit above the tiles and below the pulse, the you-are-here dot, the markers and the pin, so the dots stay on top. A new list redraws the lines on the same map, and an empty one removes them. Each tone is a theme token (--ui-map-route-primary, -muted, -success, -warning, -danger over --ui-map-route-casing) checked at 3:1 against MapTiler's streets-v2 and dataviz tiles in the theme's own brightness. label is the route's one name for screen readers, such as Route, 1.3 km. fitPoints shows every point you give it (the nurse, the patient, the route) inside the part of the map the insets leave visible, with 24px to spare, at a whole zoom no closer than 17; one point is centred there at 17. It animates unless reduced motion. This map uses the tile URLs pasted under Styled tiles, to see a route over your own style. Marker labels now size to their text, up to 320px or the map's width less 32px, and wrap to a second line before the ellipsis; the zoom buttons share the locate button's raised surface and shadow.">
        <doc-demo lang="ts + html" [code]="ROUTE_CODE">
          <div class="map-wrap">
            <ui-map #routeMap [center]="center()" [zoom]="15" [routes]="routes()" [markers]="routeMarkers" [userLocation]="routeStart" locateControl ariaLabel="The way to the patient"
              [tileUrl]="tileLight || osm" [tileUrlDark]="tileDark || null" [attribution]="tileLight ? 'Tiles from your URL &copy; OpenStreetMap contributors' : osmAttribution" />
          </div>
          <div class="route-acts">
            <ui-segmented label="Tone (demo)" size="sm" [options]="toneOptions" [value]="tone()" (valueChange)="tone.set($any($event))" />
            <ui-button size="sm" variant="outline" (click)="routeMap.fitPoints(routePoints)">Fit the route</ui-button>
            <ui-button size="sm" variant="outline" (click)="routeMap.fitPoints([routeStart])">Fit one point</ui-button>
            <ui-button size="sm" variant="ghost" (click)="showRoute.set(!showRoute())">{{ showRoute() ? 'Remove the route' : 'Show the route' }}</ui-button>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Map page" anchor="map-page" selector="ui-map fill · [pulse] · [insets]" [api]="pageApi"
        summary="A full-screen map with the form in a ui-bottom-sheet and a ui-floating-panel status card at the top. fill makes the map fill its parent with square corners. pulse draws soft rings radiating from a point while the app searches (one still halo under reduced motion); they move with the map, sit under the markers and the pin, and say nothing to screen readers, so put the words in the status card. insets is how much of each edge the sheet and the card cover, straight from their coverChange outputs: the map still draws edge to edge, but its centre, the pin's centre, centerChanged and the zoom buttons and attribution use the part between them. When the sheet moves to another snap, the map pans so the point in the middle of the visible part stays in the middle of the new visible part. glass on the sheet and the card (0.41.2) makes them see-through, and glassStrength (0.41.3) says how much: clear, the default, lets a map in the theme's brightness plainly show through (roads, coastline, parks), lightly blurred and squeezed just enough to keep every text colour AA over such a map; frosted is the near-opaque surface that stays AA over any backdrop, for photos or a map in the other brightness. Solid where backdrop-filter is missing or under reduced transparency or more contrast.">
        <doc-demo lang="html" [code]="PAGE_CODE">
          <div class="page-intro">
            <ui-text variant="body">Opens over the whole window, the way an app shows it on a phone.</ui-text>
            <ui-button class="open-page" (click)="openPage()">Open the map page</ui-button>
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>

    @if (pageOpen()) {
      @for (d of [dir()]; track d) {
        <div class="map-page" [attr.dir]="d">
          <ui-map #page fill [center]="home" [zoom]="15" [markers]="markers" [pin]="home" [pinDraggable]="false" pinLabel="Your home"
            [pulse]="pulse()" [insets]="insets()" [userLocation]="me()" locateControl [locating]="locating()" [locateOff]="locOff() === 'off'"
            (locate)="findMe(page)" ariaLabel="Nurses near your home" />
          <ui-floating-panel placement="top" ariaLabel="Status" [glass]="surface() !== 'solid'" [glassStrength]="strength()" (coverChange)="cardCover.set($event)">
            <div class="status">
              @if (searching()) {
                <ui-spinner size="sm" label="Searching" />
              }
              <div class="status-text" role="status">
                <strong>{{ searching() ? 'Looking for a nurse near you' : 'Where should the nurse come?' }}</strong>
                <span class="meta">{{ searching() ? 'We ask the nearest nurse first. This takes a minute or two.' : 'Your home is on the map. Fill in the details below.' }}</span>
              </div>
              <ui-button size="sm" variant="ghost" (click)="closePage()">Close</ui-button>
            </div>
          </ui-floating-panel>
          <ui-bottom-sheet title="Find a nurse" [snaps]="[0.42, 0.75]" [(snap)]="snap" [closable]="false" [maxWidth]="560" [glass]="surface() !== 'solid'" [glassStrength]="strength()" (coverChange)="sheetCover.set($event)">
            <div class="form">
              <ui-form-field label="Address">
                <ui-input placeholder="Building, street, island" autocomplete="street-address" [(ngModel)]="address" />
              </ui-form-field>
              <ui-segmented label="When" [options]="whenOptions" [(value)]="when" />
              <ui-segmented label="Surface (demo)" size="sm" [options]="surfaceOptions" [value]="surface()" (valueChange)="surface.set($any($event))" />
              <ui-segmented label="Location (demo)" size="sm" [options]="locOptions" [value]="locOff()" (valueChange)="locOff.set($any($event))" />
              <ui-segmented label="Direction (demo)" size="sm" [options]="dirOptions" [value]="dir()" (valueChange)="dir.set($any($event))" />
              <ui-button [block]="true" [variant]="searching() ? 'outline' : 'primary'" (click)="searching.set(!searching())">
                {{ searching() ? 'Stop searching' : 'Find a nurse' }}
              </ui-button>
            </div>
          </ui-bottom-sheet>
        </div>
      }
    }
  `,
  styles: `
    .map-wrap { position: relative; --ui-map-height: 360px; margin-bottom: var(--ui-space-2); }
    .meta { color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); margin-top: var(--ui-space-1); font-variant-numeric: tabular-nums; }
    .acts { margin-top: var(--ui-space-3); }
    .page-intro { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--ui-space-3); }
    /* The full-screen page: above the docs shell; the sheet inside rests on its overlay layer. */
    .map-page { position: fixed; inset: 0; z-index: var(--ui-z-overlay); background: var(--ui-color-bg); }
    .status { display: flex; align-items: center; gap: var(--ui-space-3); }
    .status-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .status-text strong { font-size: var(--ui-font-size-md); }
    .status .meta { margin-top: 0; }
    .form { display: flex; flex-direction: column; gap: var(--ui-space-4); }
    .route-acts { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-2); }
    .tile-fields { display: grid; gap: var(--ui-space-3); grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-bottom: var(--ui-space-3); }
  `,
})
export class MapPage {
  protected readonly MARKER = MARKER;
  protected readonly PAGE_CODE = PAGE_CODE;
  protected readonly TILES_CODE = TILES_CODE;
  protected readonly LOCATE_CODE = LOCATE_CODE;
  protected readonly ROUTE_CODE = ROUTE_CODE;
  /** A real road route across Male (OSRM, 1.3 km), from the nurse to the patient. */
  protected readonly routePoints: [number, number][] = [
    [4.17682, 73.5121], [4.17678, 73.51237], [4.17708, 73.51244], [4.17709, 73.51223], [4.17716, 73.51216], [4.17773, 73.51224], [4.17785, 73.51146],
    [4.1769, 73.51136], [4.1771, 73.50974], [4.17284, 73.50825], [4.17311, 73.50751], [4.1732, 73.50755], [4.17344, 73.50696], [4.17388, 73.50715], [4.17387, 73.50721],
  ];
  protected readonly routeStart: UiMapUserLocation = { lat: 4.17682, lng: 73.5121, accuracy: 20 };
  protected readonly routeMarkers: UiMapMarker[] = [{ id: 'patient', lat: 4.17387, lng: 73.50721, label: 'Lily Magu, Hiyaa Tower 4, Hulhumale', tone: 'danger' }];
  protected readonly tone = signal<UiMapRouteTone>('primary');
  protected readonly toneOptions = (['primary', 'muted', 'success', 'warning', 'danger'] as const).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
  protected readonly showRoute = signal(true);
  protected readonly routes = computed<UiMapRoute[]>(() => (this.showRoute() ? [{ id: 'to-patient', points: this.routePoints, tone: this.tone(), label: 'Route, 1.3 km' }] : []));
  protected readonly routeApi: ApiRow[] = [
    { name: 'routes', type: 'UiMapRoute[]', default: '[]', desc: 'Lines along the road: id, points ([lat, lng] or { lat, lng }), tone, label. Under the pulse, dot, markers and pin; updated in place; [] removes them.' },
    { name: 'UiMapRoute.tone', type: 'UiMapRouteTone', default: "'primary'", desc: "'primary' | 'muted' | 'success' | 'warning' | 'danger': the --ui-map-route-<tone> token over --ui-map-route-casing." },
    { name: 'UiMapRoute.label', type: 'string', default: '—', desc: 'The route\'s one accessible name ("Route, 1.3 km"); without it the line is hidden from screen readers.' },
    { name: 'fitPoints(points, options?)', type: 'method', default: '—', desc: 'Shows every point inside the visible part (between the insets) plus padding (24px), at a whole zoom up to maxZoom (17); one point is centred at maxZoom. Animated unless animate: false or reduced motion.' },
    { name: 'uiMapFitView(points, size, area, maxZoom?)', type: 'function', default: '—', desc: 'The view fitPoints moves to (the map\'s own centre and zoom), for tests or a first view.' },
    { name: 'uiMapRouteWidth(zoom)', type: 'function', default: '—', desc: 'The line and casing widths at a zoom: 5 over 9px from zoom 14, down to 60% at zoom 10.' },
    { name: '--ui-map-route-casing / -primary / -muted / -success / -warning / -danger', type: 'CSS colour', default: 'theme', desc: 'The route colours, 3:1 against streets-v2 and dataviz tiles in every theme; override per theme.' },
    { name: '--ui-map-label-max', type: 'CSS length', default: 'min(320px, map width - 32px)', desc: 'The widest a marker label gets (set by the map); labels wrap to two lines before the ellipsis.' },
  ];
  protected readonly osm = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  protected readonly osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  /** Pasted tile URLs for the styled-tiles demo; never stored. */
  protected tileLight = '';
  protected tileDark = '';
  // "My location": a stand-in position (the showcase doesn't ask for the real one).
  protected readonly me = signal<UiMapUserLocation | null>(null);
  protected readonly locating = signal(false);
  protected readonly locOff = signal<'on' | 'off'>('on');
  protected readonly locOptions = [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }];
  protected findMe(map: UiMap): void {
    if (this.locOff() === 'off') return; // the app would ask for permission here
    this.locating.set(true);
    setTimeout(() => {
      const me: UiMapUserLocation = { lat: 4.1768, lng: 73.5121, accuracy: 35 };
      this.me.set(me);
      map.flyTo(me, 16);
      this.locating.set(false);
    }, 700);
  }
  protected readonly home: UiLatLng = { lat: 4.1752, lng: 73.5089 };
  protected readonly pageOpen = signal(false);
  protected readonly searching = signal(false);
  protected readonly snap = signal(0);
  protected readonly cardCover = signal(0);
  protected readonly sheetCover = signal(0);
  protected readonly dir = signal<'ltr' | 'rtl'>('ltr');
  protected address = 'M. Blue Lagoon, Majeedhee Magu';
  protected readonly when = signal<string | null>('now');
  protected readonly whenOptions = [{ value: 'now', label: 'Now' }, { value: 'later', label: 'Later today' }];
  /** The sheet and status card: clear glass (the default here), frosted glass or the solid surface. */
  protected readonly surface = signal<'clear' | 'frosted' | 'solid'>('clear');
  protected readonly strength = computed<UiGlassStrength>(() => (this.surface() === 'frosted' ? 'frosted' : 'clear'));
  protected readonly surfaceOptions = [{ value: 'clear', label: 'Clear' }, { value: 'frosted', label: 'Frosted' }, { value: 'solid', label: 'Solid' }];
  protected readonly dirOptions = [{ value: 'ltr', label: 'LTR' }, { value: 'rtl', label: 'RTL' }];
  protected readonly pulse = computed<UiMapPulse>(() => ({ ...this.home, active: this.searching() }));
  protected readonly insets = computed<UiMapInsets>(() => ({ top: this.cardCover(), bottom: this.sheetCover() }));
  protected openPage(): void {
    this.snap.set(0);
    this.pageOpen.set(true);
  }
  protected closePage(): void {
    this.pageOpen.set(false);
    this.searching.set(false);
  }
  protected readonly center = signal<UiLatLng>({ lat: 4.1755, lng: 73.5093 });
  protected readonly picked = signal<UiMapMarker | null>(null);
  protected readonly view = signal<UiMapView | null>(null);
  protected readonly pin = signal<UiLatLng | null>({ lat: 4.1745, lng: 73.5085 });
  protected readonly markers: UiMapMarker[] = [
    { id: 'n1', lat: 4.1762, lng: 73.5105, label: 'Aminath Hassan, RN', tone: 'success' },
    { id: 'n2', lat: 4.1738, lng: 73.5072, label: 'Ibrahim Rasheed, RN' },
    { id: 'n3', lat: 4.1781, lng: 73.5068, label: 'Busy', tone: 'warning' },
  ];
  protected readonly api: ApiRow[] = [
    { name: 'center', type: 'UiLatLng', default: 'Malé', desc: 'Where the map is centred; changing it moves the map.' },
    { name: 'zoom', type: 'number', default: '13', desc: 'Zoom level (0–19).' },
    { name: 'markers', type: 'UiMapMarker[]', default: '[]', desc: 'Dots with labels (see Data shapes).' },
    { name: 'tileUrl', type: 'string', default: 'OSM standard tiles', desc: 'Tile URL template; use OSM tiles within their usage policy.' },
    { name: 'attribution', type: 'string (HTML)', default: '© OpenStreetMap contributors', desc: 'Shown at the inline end.' },
    { name: 'ariaLabel', type: 'string', default: "'Map'", desc: 'Names the map region and its focusable surface.' },
    { name: 'tileReferrerPolicy', type: 'ReferrerPolicy', default: "'strict-origin-when-cross-origin'", desc: 'Sent with tile requests (OSM needs a Referer).' },
    { name: 'UI_MAP_LEAFLET', type: 'InjectionToken<() => Promise<unknown>>', default: "() => import('leaflet')", desc: 'How Leaflet is loaded: provide a fake to test without the network.' },
    { name: '--ui-map-height', type: 'CSS length', default: '320px', desc: 'Its height.' },
  ];
  protected readonly out: ApiRow[] = [
    { name: 'markerSelected', type: 'UiMapMarker', default: '—', desc: 'A marker was clicked or activated with Enter.' },
    { name: 'centerChanged', type: 'UiMapView', default: '—', desc: 'The map stopped moving; where it is now.' },
  ];
  protected readonly pinApi: ApiRow[] = [
    { name: 'pin', type: 'UiLatLng | null (model)', default: 'null', desc: 'Two-way ([(pin)]): the chosen point, a draggable pin when set.' },
    { name: 'pinMode', type: 'boolean', default: 'false', desc: 'A tap on the map, or Enter on it, moves the pin there.' },
    { name: 'pinLabel', type: 'string', default: "'Chosen location'", desc: "The pin's accessible name." },
    { name: 'pinDraggable', type: 'boolean', default: 'true', desc: 'false shows a fixed location with the pin\'s look (not draggable, not focusable, still named).' },
  ];
  protected readonly tilesApi: ApiRow[] = [
    { name: 'tileUrl', type: 'string', default: 'OSM standard tiles', desc: 'Tile URL template for light themes. {r} is @2x on a high-density screen, empty otherwise.' },
    { name: 'tileUrlDark', type: 'string | null', default: 'null', desc: 'Tiles for dark themes, shown undimmed; swapped live on a theme change (same layer). null: the light tiles, dimmed.' },
    { name: 'tileSize', type: 'number', default: '256', desc: 'Tile size in px: 512 for 512 px tiles.' },
    { name: 'zoomOffset', type: 'number', default: '0', desc: 'Added to the zoom in tile URLs: -1 with 512 px tiles.' },
    { name: 'attribution', type: 'string (HTML)', default: '© OpenStreetMap contributors', desc: 'The tiles\' credit, e.g. © MapTiler © OpenStreetMap contributors.' },
  ];
  protected readonly locateApi: ApiRow[] = [
    { name: 'locateControl', type: 'boolean', default: 'false', desc: 'A round Show my location button at the bottom-end of the visible part; follows insets.' },
    { name: 'locating', type: 'boolean', default: 'false', desc: 'A spinner (aria-busy) instead of the icon; presses do nothing.' },
    { name: 'locateOff', type: 'boolean', default: 'false', desc: 'Location off or denied: struck-through icon, tooltip and description Location is off. Presses still emit, to ask again.' },
    { name: '(locate)', type: 'void', default: '—', desc: 'The button was pressed (not while locating).' },
    { name: 'userLocation', type: 'UiMapUserLocation | null', default: 'null', desc: 'The you-are-here dot (--ui-color-location, a white ring) over an accuracy halo sized in metres; named Your location.' },
    { name: 'flyTo(point, zoom?)', type: 'method', default: '—', desc: 'Moves the map so the point is in the middle of the visible part (between the insets).' },
    { name: 'mapLocate / mapLocationOff / mapYourLocation', type: 'UiStrings', default: "'Show my location' / 'Location is off' / 'Your location'", desc: 'The words, from provideUiStrings.' },
  ];
  protected readonly pageApi: ApiRow[] = [
    { name: 'pulse', type: 'UiMapPulse | null', default: 'null', desc: 'Soft rings radiating from a point (3 staggered, 2.4s, up to 120px) while active; a still halo under reduced motion. Geo-anchored, under the markers and pin, silent.' },
    { name: 'insets', type: 'UiMapInsets', default: '{}', desc: 'Px covered over each edge (start/end follow the direction). Centre, pin centre, centerChanged and the controls use the part between them, and the zoom buttons zoom around its middle; a change pans to keep the visible middle in the middle.' },
    { name: 'fill', type: 'boolean', default: 'false', desc: 'Fill the parent\'s height with square corners: a full-screen map page.' },
    { name: 'ui-floating-panel (coverChange)', type: 'number', default: '—', desc: 'Px of its edge the card covers (gutter plus height): feed it to insets.top.' },
    { name: 'ui-bottom-sheet (coverChange)', type: 'number', default: '—', desc: 'Px of the screen bottom the sheet covers once it settles: feed it to insets.bottom.' },
    { name: 'ui-bottom-sheet maxWidth', type: 'number | string | null', default: 'null', desc: 'The widest the sheet gets (px or a CSS length). On a wider screen it is that wide and centred, the backdrop still covers everything, and coverChange still reports the covered height. 560 suits tablets and desktops.' },
    { name: 'ui-bottom-sheet glass · ui-floating-panel glass', type: 'boolean', default: 'false · UiConfig.glass', desc: 'See-through surface over the map (0.41.2); how see-through is glassStrength. Fields and buttons stay solid. Solid without backdrop-filter, and under prefers-reduced-transparency or prefers-contrast: more.' },
    { name: 'glassStrength', type: "'clear' | 'frosted'", default: "'clear'", desc: 'How see-through glass is (0.41.3). clear: a 12% tint over a 3px blur, squeezed into the theme\'s --ui-glass-clear-floor/-ceiling range and saturated, so a map in the theme\'s brightness plainly shows through with text, muted text, primary and status colours AA (icons 3:1) over it. frosted: the 0.41.2 recipe, 60% over a 20px blur and the --ui-glass-sheet-* range, AA over anything, pure white and black included.' },
    { name: 'ui-bottom-sheet persistent()', type: 'boolean', default: '—', desc: 'True when the smallest snap is above 0, as here: the sheet never closes. Escape collapses it to that snap and does nothing there; browser Back always leaves the page.' },
  ];
}
