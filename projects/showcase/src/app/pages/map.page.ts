import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { injectUiStrings, type UiGlassStrength } from '@zouriel/ui';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiMapNavigation, UiNavTracker, UI_NAV_ICONS, uiNavBearing, type UiNavEvent, type UiNavIconKind, type UiNavPosition } from '@zouriel/ui/map';
import { NAV_DEMO_ROUTE, navDemoSteps } from './nav-demo';
import { UiMap, uiMapFormatRadius, type UiLatLng, type UiMapArea, type UiMapControl, type UiMapInsets, type UiMapMarker, type UiMapMarkerLabels, type UiMapPulse, type UiMapRoute, type UiMapRouteTone, type UiMapUserLocation, type UiMapView } from '@zouriel/ui/map';
import CenterFocusIcon from '@hugeicons/core-free-icons/CenterFocusIcon';
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
  animate?: boolean; // draw it in from start to end when it appears or changes (0.46.2); default true
}
interface UiMapFitOptions {
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number }; // px, default 24
  maxZoom?: number;  // default 17, and the zoom for a single point
  animate?: boolean; // default true; never under reduced motion
}
type UiMapMarkerLabels = 'all' | 'selected' | 'none'; // 0.43.0: which marker labels show
interface UiMapArea extends UiLatLng { // 0.44.0: a search area
  radiusMeters: number;
  tone?: UiStatus;      // default 'primary'
  editable?: boolean;   // a radius handle (a slider), default false
  minMeters?: number;   // default 200
  maxMeters?: number;   // default 50000
}
interface UiMapControl {  // 0.42.1: your own round button, in the locate button's stack
  id: string;
  icon: IconSvgObject;     // a hugeicons icon, one file per icon
  label: string;           // its accessible name
  tooltip?: string;
  disabled?: boolean;
}`;

const ROUTE_CODE = `<ui-map #map fill [insets]="{ top: cardCover(), bottom: sheetCover() }" [userLocation]="me()"
  [markers]="[patient]" [routes]="route() ? [{ id: 'to-patient', points: route()!.points, label: 'Route, ' + route()!.km + ' km' }] : []"
  [controls]="[{ id: 'fit', icon: CenterFocusIcon, label: strings.mapShowBoth, tooltip: strings.mapShowBoth }]" (controlPress)="map.fitPoints([me(), patient])" />

// The moment she accepts: fetch the road route (OSRM GeoJSON is [lng, lat]: swap it) and show it all.
const r = await api.route(job.id, me);
this.route.set({ points: r.geometry.map(([lng, lat]) => [lat, lng]), km: (r.distance / 1000).toFixed(1) });
this.map().fitPoints([me, patient, ...this.route()!.points]); // inside the part between the insets
// The route draws in from the nurse to the patient (0.46.2); add animate: false to a route to skip it.`;

const TURN_CODE = `<ui-map #map [markers]="places" rotatable (bearingChange)="bearing.set($event)" />
<!-- Two fingers (past 15 degrees) or Alt + drag turn it; the compass turns it back. From code: -->
<button (click)="map.rotateTo(0)">North up</button>`;

const NAV_CODE = `<ui-map-navigation [route]="route()" [steps]="steps()" [position]="position()" destinationLabel="Lily Magu"
  (announce)="speak($event.step.instruction)" (offRoute)="reroute()" (arrived)="arrive()" (end)="stop()" />

// OSRM: /route/v1/driving/{from};{to}?steps=true&geometries=geojson (the app's API in its own language)
const r = await api.route(job.id, me);
this.route.set(r.geometry.map(([lng, lat]) => [lat, lng]));
this.steps.set(r.steps.map((s) => ({
  maneuver: { type: s.maneuver.type, modifier: s.maneuver.modifier, exit: s.maneuver.exit, bearingAfter: s.maneuver.bearing_after,
    location: [s.maneuver.location[1], s.maneuver.location[0]], drivingSide: s.driving_side },
  distanceMeters: s.distance, durationSeconds: s.duration, instruction: s.instruction, streetName: s.name,
})));
navigator.geolocation.watchPosition((p) => this.position.set({ lat: p.coords.latitude, lng: p.coords.longitude,
  heading: p.coords.heading ?? undefined, speed: p.coords.speed ?? undefined, accuracy: p.coords.accuracy, timestamp: p.timestamp }));`;

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

const PREVIEW_CODE = `<!-- A result card's Map tab: a still map of the results; clicking it opens the full map. -->
<ui-map preview [markers]="results" markerLabels="none" (previewPress)="openResultsMap()" />
<!-- previewLabel="See 3 nurses on the map" names it; the default is the mapOpen string, "Open map". -->
<!-- Or place it on the results once it has loaded: map.fitPoints(points) (no animation on a preview). -->`;

const SELECTED_CODE = `<ui-map [markers]="results" [selectedMarkerId]="selected()?.id ?? null" markerLabels="selected"
  (markerSelected)="selected.set($event)" (mapTap)="selected.set(null)" />`;

const AREA_CODE = `<!-- "Find a nurse within": the patient drags the handle on the circle's edge. -->
<ui-map #map [center]="home" [zoom]="12" [pin]="home" [pinDraggable]="false"
  [area]="{ lat: home.lat, lng: home.lng, radiusMeters: radius(), editable: true, minMeters: 500, maxMeters: 30000 }"
  areaLabel="Search radius" (areaChanging)="live.set($event)" (areaChange)="radius.set($event)" />
<ui-button (click)="map.fitArea()">Show the whole area</ui-button>
<!-- uiMapFormatRadius(radius()) gives "5 km", "800 m" in the app's words (the mapRadius* strings). -->`;

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
  imports: [DecimalPipe, UiMap, UiMapNavigation, HugeiconsIconComponent, UiFloatingPanel, UiButton, UiSegmented, UiBottomSheet, UiInput, UiFormField, FormsModule, UiSpinner, UiText, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Components" title="Map"
      lead="An OpenStreetMap map from @zouriel/ui/map, on Leaflet 1.9.4. The entry point and Leaflet itself load on first use, so a map never lands in an app's first download. Install leaflet (~1.9.4) next to the library.">

      <doc-section name="Map" selector="ui-map" [api]="api" [outputs]="out" [shapes]="MARKER"
        summary="Markers are dots in their tone with a label pill; selecting one (click, or Enter when it has focus) emits markerSelected. center and zoom move the map; centerChanged reports where the person moved it. The zoom buttons sit at the inline start and the OSM attribution at the inline end, so they swap in RTL; the attribution itself is always set left to right, so English credits keep their © signs in place. On touch screens the zoom buttons are 44px with a 48px hit area. The controls use the theme, and on a dark theme the tiles are dimmed. Under reduced motion there are no zoom or pan animations. If a map is removed during an animated move, queued Leaflet events are ignored. Give it a height with --ui-map-height (320px by default).">
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
        summary="routes draws lines along the road, from OSRM say: each one a line in its tone over a casing, round-capped, 5px over 9px close in and thinner zoomed out. They sit above the tiles and below the pulse, the you-are-here dot, the markers and the pin, so the dots stay on top. A new list redraws the lines on the same map, and an empty one removes them. Each tone is a theme token (--ui-map-route-primary, -muted, -success, -warning, -danger over --ui-map-route-casing) checked at 3:1 against MapTiler's streets-v2 and dataviz tiles in the theme's own brightness. label is the route's one name for screen readers, such as Route, 1.3 km. fitPoints shows every point you give it (the nurse, the patient, the route) inside the part of the map the insets leave visible, with 24px to spare, at a whole zoom no closer than 17; one point is centred there at 17. It animates unless reduced motion. A route draws in (0.46.2): when it appears, or its points change, the casing and line grow together from its start to its end, easing out over 250 to 900 ms by length (uiMapRouteDrawMs: 450 ms for 1 km), while a fitPoints straight after moves the map as before. The same points again (a re-render with the same id and geometry) don't replay it. Set animate: false on a route to draw it at once; under reduced motion, and on a preview, routes are always drawn at once. A removed route fades out over 150 ms. Try Draw it again (a new route id), Remove the route, or the Draw-in switch. This map uses the tile URLs pasted under Styled tiles, to see a route over your own style. Marker labels now size to their text, up to 320px or the map's width less 32px, and wrap to a second line before the ellipsis; the zoom buttons share the locate button's raised surface and shadow. Near the map's edge a label flips to the other side of its dot rather than run off (0.42.1; in RTL it starts on the left). A fit owns the camera (0.42.1): if the insets change while it animates or after it, say a sheet grows as the route appears, the fit is worked out again for the new insets, until the person or the app moves the map. controls (0.42.1) adds your own round buttons in the locate button's stack and style, above it at the bottom-end of the visible part, and (controlPress) says which was pressed; the one here, Show the whole route, calls fitPoints.">
        <doc-demo lang="ts + html" [code]="ROUTE_CODE">
          <div class="map-wrap">
            <ui-map #routeMap [center]="center()" [zoom]="15" [routes]="routes()" [markers]="routeMarkers" [userLocation]="routeStart" locateControl ariaLabel="The way to the patient"
              [controls]="routeControls" (controlPress)="routeMap.fitPoints(routePoints)"
              [tileUrl]="tileLight || osm" [tileUrlDark]="tileDark || null" [attribution]="tileLight ? 'Tiles from your URL &copy; OpenStreetMap contributors' : osmAttribution" />
          </div>
          <div class="route-acts">
            <ui-segmented label="Tone (demo)" size="sm" [options]="toneOptions" [value]="tone()" (valueChange)="tone.set($any($event))" />
            <ui-button size="sm" variant="outline" (click)="routeMap.fitPoints(routePoints)">Fit the route</ui-button>
            <ui-button size="sm" variant="outline" (click)="routeMap.fitPoints([routeStart])">Fit one point</ui-button>
            <ui-button size="sm" variant="ghost" (click)="showRoute.set(!showRoute())">{{ showRoute() ? 'Remove the route' : 'Show the route' }}</ui-button>
            <ui-button size="sm" variant="outline" (click)="drawAgain()">Draw it again</ui-button>
            <ui-segmented label="Draw-in (demo)" size="sm" [options]="drawOptions" [value]="animateRoute() ? 'on' : 'off'" (valueChange)="animateRoute.set($event === 'on')" />
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Preview" anchor="preview" selector="ui-map preview · (previewPress)" [api]="previewApi"
        summary="preview (0.43.0) makes the map a still picture that is one button, for a map inside a list or a chat: clicking it, or Enter or Space when it has focus, emits previewPress, and the app opens the full map. Nothing on it moves: no pan, pinch, double-click or wheel zoom, no arrow keys, no zoom, locate or app buttons. The markers are drawn but take no clicks or focus of their own, and the attribution stays visible (the tile licence asks for it) without being a link. The mouse wheel or a finger dragging over it scrolls the page, as over a photo. It is one native button named previewLabel, Open map by default (the mapOpen string, so an app can translate it), with the focus ring inside its edge, a pointer cursor and a slight wash while pressed. A small round expand badge in the map controls' raised style sits in the top-end corner (top-left in RTL). center, zoom and fitPoints still place it, without animating. Turn preview off and the full map is back on the same map. Try it: scroll the page over the map, then click it.">
        <doc-demo lang="html" [code]="PREVIEW_CODE">
          <div class="map-wrap preview-wrap">
            <ui-map [preview]="previewOn()" (previewPress)="openResults()" [center]="previewCenter" [zoom]="15" [markers]="markers"
              [markerLabels]="previewOn() ? 'none' : 'all'" ariaLabel="Nurses near you" />
          </div>
          <div class="route-acts">
            <ui-segmented label="Preview (demo)" size="sm" [options]="onOffOptions" [value]="previewOn() ? 'on' : 'off'" (valueChange)="previewOn.set($event === 'on')" />
            <ui-text variant="caption">Opened {{ opened() }} {{ opened() === 1 ? 'time' : 'times' }}</ui-text>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Selected marker" anchor="selected-marker" selector="ui-map [selectedMarkerId] · markerLabels" [api]="selectedApi"
        summary="selectedMarkerId (0.43.0) marks one marker as the chosen one: its dot is drawn bigger (22px instead of 16) with a white ring and a soft halo in its tone, above the other markers, with its label shown, and it is aria-pressed (the others not), so screen readers hear which is selected. The others stay as they are. Changing it updates the markers in place, without rebuilding or moving the map. markerLabels says which labels show: all (the default), selected (only the selected marker's, for a busy map where a tapped pin shows its card) or none. A hidden label still names its marker for screen readers. Click a marker here to select it; click empty map to clear it through mapTap (0.43.1).">
        <doc-demo lang="html" [code]="SELECTED_CODE">
          <div class="map-wrap">
            <ui-map [center]="center()" [zoom]="15" [markers]="markers" [selectedMarkerId]="selectedId()" [markerLabels]="labelMode()"
              (markerSelected)="selectedId.set($event.id)" (mapTap)="selectedId.set(null)" ariaLabel="Nurses near you" />
          </div>
          <div class="route-acts">
            <ui-segmented label="Labels (demo)" size="sm" [options]="labelOptions" [value]="labelMode()" (valueChange)="labelMode.set($any($event))" />
            <ui-button size="sm" variant="ghost" [disabled]="!selectedId()" (click)="selectedId.set(null)">Clear the selection</ui-button>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Search area" anchor="search-area" selector="ui-map [area] · (areaChange) · fitArea()" [api]="areaApi"
        summary="area (0.44.0) draws a search area: a soft circle in its tone with a clear outline (a 2px line over a light casing, so it reads over busy street tiles in light and dark), radiusMeters in true metres around its point, so it grows and shrinks with the zoom. It sits under the routes, markers and pin, and the map pans and zooms right through it. With editable a round handle sits on the circle's inline-end edge (east; west in RTL) with a chip showing the radius (5 km, 800 m: uiMapFormatRadius, in the mapRadiusMeters and mapRadiusKilometers strings). Drag it to change the radius, rounded to 10 m, 100 m or 1 km and kept between minMeters and maxMeters; the map doesn't pan while the handle moves. areaChanging reports each new radius while dragging, areaChange the one let go on. For keyboards and screen readers the handle is a slider named areaLabel (the mapSearchArea string, Search area): ArrowUp and the outward arrow make it about 10% bigger, ArrowDown and the inward arrow smaller, Home and End go to the smallest and largest. Feed the radius back into area. fitArea() shows the whole circle in the visible part (between the insets). Without editable, and on a preview, it is just the circle.">
        <doc-demo lang="html" [code]="AREA_CODE">
          <div class="map-wrap area-wrap">
            <ui-map #areaMap [center]="home" [zoom]="12" [pin]="home" [pinDraggable]="false" [area]="area()" areaLabel="Search radius"
              (areaChanging)="areaLive.set($event)" (areaChange)="areaCommit($event)" ariaLabel="Search area around your home" />
          </div>
          <div class="route-acts">
            <ui-button size="sm" variant="outline" (click)="areaMap.fitArea()">Show the whole area</ui-button>
            <ui-segmented label="Tone (demo)" size="sm" [options]="areaToneOptions" [value]="areaTone()" (valueChange)="areaTone.set($any($event))" />
            <ui-text variant="caption">Nurses within {{ radiusText(areaLive() ?? radius()) }}{{ areaLive() !== null ? ' (dragging)' : '' }}</ui-text>
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

      <doc-section name="Turning the map" anchor="turning" selector="ui-map rotatable · compass · [bearing] · rotateTo()" [api]="turnApi"
        summary="rotatable (0.47.0, on by default) lets the person turn the map with two fingers. A pinch decides what it is in its first moments: a 15 degree twist turns the map (and it keeps zooming and panning with the fingers), while a 10% zoom or a 30 px pan that comes first makes it a zoom or pan, so no small twist turns the map by accident. With a mouse, Alt + drag turns it around the middle (Shift + drag stays the box zoom). While the map is turned away from north, a compass button sits under the zoom buttons in their style (48px targets on touch, following the insets, the inline start); its needle points north and a click eases the map back north up (Reset to north, in the strings). Markers, the pin, the label chips and the area handle stay upright; routes, dots and the you-are-here arrow turn with the map; the attribution stays put. bearingChange reports the bearing when a turn ends (or the compass is pressed), userMove that the person moved the map. [bearing] turns it from the app (heading-up navigation), and rotateTo() turns it back after the person turned it. Leaflet can't rotate, so ui-map turns its own map pane with CSS (the leaflet-rotate plugin patches Leaflet for every map on the page).">
        <doc-demo lang="html" [code]="TURN_CODE">
          <div class="map-wrap">
            <ui-map #turnMap [center]="center()" [zoom]="16" [markers]="markers" [routes]="turnRoutes" [rotatable]="turnRotatable()" (bearingChange)="turnBearing.set($event)"
              [tileUrl]="tileLight || osm" [tileUrlDark]="tileDark || null" [attribution]="tileLight ? 'Tiles from your URL &copy; OpenStreetMap contributors' : osmAttribution" ariaLabel="A map you can turn" />
          </div>
          <div class="route-acts">
            <ui-button size="sm" variant="outline" (click)="turnMap.rotateTo(45); turnBearing.set(45)">Turn to 45°</ui-button>
            <ui-segmented label="Rotatable (demo)" size="sm" [options]="drawOptions" [value]="turnRotatable() ? 'on' : 'off'" (valueChange)="turnRotatable.set($event === 'on')" />
            <span class="meta">Bearing {{ turnBearing() | number: '1.0-0' }}°</span>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Navigation" anchor="navigation" selector="ui-map-navigation" [api]="navApi" [outputs]="navOut"
        summary="ui-map-navigation (0.47.0) is a turn-by-turn view, like a car's navigation, for the nurse driving to a patient. The app gives it the route's geometry, its steps (OSRM's steps: maneuver type, modifier, location and exit, distance and duration, and the instruction already in the app's language) and the live position ({ lat, lng, heading, speed, accuracy, timestamp }); the view reads no GPS itself. The map follows the person and turns heading-up (flat, no tilt), the route ahead in the primary tone and the part already driven dimmed, with an arrow for the person. The banner shows the next maneuver: a big arrow for its type (turns, slight and sharp, U-turns, roundabouts with the exit number, forks, merges, depart, arrive), the distance to it (in 80 m), the instruction and the street, with the maneuver after it in a small tab. The bar shows the time and distance left, the arrival time and End. The logic is UiNavTracker, pure and testable: it snaps each position to the route, works out the step, the distance to the next maneuver and what is left, and emits announce at the start, on each new maneuver ahead and at 200 m and 30 m before it (each once, for the app to speak), offRoute after 5 s more than 40 m off the route (reroute: give a new route and steps) and arrived within 20 m of the end. Drag, the wheel or a pinch stop the following and show Recenter. Under reduced motion the map neither glides nor turns smoothly. In right-to-left text the banner and bar mirror; the arrows never do, since left is still left. glass frosts the banner and bar. Leaflet can't rotate, and the leaflet-rotate plugin patches Leaflet for every map on the page, so ui-map turns itself: bearing (0.47.0) turns its map pane with CSS about the middle of the visible part, turns taps and drags back, loads the turned corners' tiles and keeps markers upright. Play the drive below; Wander off leaves the road to show offRoute.">
        <doc-demo lang="ts + html" [code]="NAV_CODE">
          <div class="nav-wrap">
            <ui-map-navigation [route]="navRoute()" [steps]="navSteps()" [position]="navPos()" [glass]="navGlass()" destinationLabel="Lily Magu"
              [tileUrl]="tileLight || osm" [tileUrlDark]="tileDark || null" [attribution]="tileLight ? 'Tiles from your URL &copy; OpenStreetMap contributors' : osmAttribution"
              (announce)="navLog($event)" (offRoute)="navLog($event)" (arrived)="navLog({ type: 'arrived' })" (end)="navStop(true)" />
          </div>
          <div class="route-acts">
            <ui-button size="sm" (click)="navPlaying() ? navStop(false) : navPlay()">{{ navPlaying() ? 'Pause' : 'Play' }}</ui-button>
            <ui-segmented label="Speed (demo)" size="sm" [options]="navSpeeds" [value]="navSpeed()" (valueChange)="navSpeed.set($any($event))" />
            <ui-button size="sm" variant="outline" (click)="navRestart()">Restart</ui-button>
            <ui-button size="sm" variant="outline" (click)="navWander()">Wander off</ui-button>
            <ui-segmented label="Glass (demo)" size="sm" [options]="drawOptions" [value]="navGlass() ? 'on' : 'off'" (valueChange)="navGlass.set($event === 'on')" />
          </div>
          <ol class="nav-log" aria-label="Events (demo)">
            @for (e of navEvents(); track $index) { <li>{{ e }}</li> }
          </ol>
        </doc-demo>
      </doc-section>

      <doc-section name="Maneuver icons" anchor="maneuver-icons" selector="UI_NAV_ICONS · uiNavIcon()" [api]="iconApi"
        summary="The banner's arrows (0.47.0), one drawing per maneuver kind, in the library's line style on a 24px grid (hugeicons has no maneuver set: no roundabout exits, slight or sharp turns). uiNavIconKind picks the kind from OSRM's type and modifier: roundabouts and rotaries by their exit's direction, forks and merges by side, ramps as slight turns, everything else by its modifier; a U-turn bends left where traffic keeps right and right where it keeps left (drivingSide). The road not taken at a fork or merge is faint. They are never mirrored in right-to-left text. The same data draws them in the Flutter library.">
        <div class="icon-grid">
          @for (k of iconKinds; track k) {
            <figure class="icon-cell"><hugeicons-icon [icon]="icons[k]" [size]="36" [strokeWidth]="2" aria-hidden="true" /><figcaption>{{ k }}</figcaption></figure>
          }
        </div>
      </doc-section>
    </doc-page>

    @if (resultsOpen()) {
      <div class="map-page">
        <ui-map fill [center]="previewCenter" [zoom]="16" [markers]="markers" [selectedMarkerId]="resultsPick()?.id ?? null" markerLabels="selected"
          [insets]="{ top: resultsCover() }" (markerSelected)="resultsPick.set($event)" (mapTap)="resultsPick.set(null)" ariaLabel="Nurses near you" />
        <ui-floating-panel placement="top" ariaLabel="Nurse" (coverChange)="resultsCover.set($event)">
          <div class="status">
            <div class="status-text" role="status">
              <strong>{{ resultsPick()?.label ?? 'Nurses near you' }}</strong>
              <span class="meta">{{ resultsPick() ? resultsPick()!.lat.toFixed(4) + ', ' + resultsPick()!.lng.toFixed(4) : 'Click a pin to see the nurse.' }}</span>
            </div>
            <ui-button size="sm" variant="ghost" (click)="closeResults()">Close</ui-button>
          </div>
        </ui-floating-panel>
      </div>
    }

    @if (pageOpen()) {
      @for (d of [dir()]; track d) {
        <div class="map-page" [attr.dir]="d">
          <ui-map #page fill [center]="home" [zoom]="15" [markers]="markers" [pin]="home" [pinDraggable]="false" pinLabel="Your home"
            [pulse]="pulse()" [insets]="insets()" [userLocation]="me()" locateControl [locating]="locating()" [locateOff]="locOff() === 'off'"
            [controls]="pageControls" (controlPress)="page.fitPoints(allNurses)"
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
    .preview-wrap { --ui-map-height: 200px; }
    .area-wrap { --ui-map-height: 420px; }
    .route-acts { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-2); }
    .nav-wrap { height: 680px; max-width: 420px; margin-bottom: var(--ui-space-2); border-radius: var(--ui-radius); overflow: hidden; border: 1px solid var(--ui-color-border); }
    .nav-log { margin: var(--ui-space-3) 0 0; padding-inline-start: var(--ui-space-6); color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); min-height: 6em; }
    .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: var(--ui-space-2); }
    .icon-cell { margin: 0; display: flex; flex-direction: column; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-3); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); color: var(--ui-color-text); }
    .icon-cell figcaption { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); text-align: center; overflow-wrap: anywhere; }
    .tile-fields { display: grid; gap: var(--ui-space-3); grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-bottom: var(--ui-space-3); }
  `,
})
export class MapPage {
  // Turning the map (0.47.0).
  protected readonly TURN_CODE = TURN_CODE;
  protected readonly turnRotatable = signal(true);
  protected readonly turnBearing = signal(0);
  protected readonly turnRoutes: UiMapRoute[] = [{ id: 'r', points: NAV_DEMO_ROUTE, animate: false }];
  protected readonly turnApi: ApiRow[] = [
    { name: 'rotatable', type: 'boolean', default: 'true', desc: 'Two fingers turn the map (0.47.0): the first of a 15 degree twist, a 10% zoom or a 30 px pan wins the gesture. Alt + drag with a mouse.' },
    { name: 'compass', type: 'boolean', default: 'true', desc: 'The compass button under the zoom buttons while turned; a click eases north up.' },
    { name: 'bearing', type: 'number', default: '0', desc: 'The compass direction at the top, degrees clockwise from north; turns the map when it changes.' },
    { name: 'zoomButtons', type: 'boolean', default: 'true', desc: 'The zoom buttons; the wheel, pinch and keys still zoom.' },
    { name: '(bearingChange)', type: 'number', default: '—', desc: 'The bearing when the person ends a turn, or presses the compass (0).' },
    { name: '(userMove)', type: 'void', default: '—', desc: 'The person moved the map: drag, wheel, pinch, turn, double-click, keys, box zoom.' },
    { name: 'rotateTo(bearing) / currentBearing()', type: 'method', default: '—', desc: 'Turn the map from code (eased unless reduced motion); the bearing shown.' },
    { name: 'UiMapUserLocation.heading', type: 'number', default: '—', desc: 'The dot becomes an arrow puck pointing that way, turning with the map.' },
    { name: 'UiMapRoute.opacity', type: 'number', default: '1', desc: 'The line\'s opacity over its casing; a navigation view draws the way behind at 0.6.' },
    { name: 'strings mapResetNorth', type: 'UiStrings', default: "'Reset to north'", desc: 'The compass\'s name.' },
  ];

  // Navigation (0.47.0): a simulated drive along the demo route.
  protected readonly NAV_CODE = NAV_CODE;
  private readonly navStrings = injectUiStrings();
  protected readonly navRoute = signal<[number, number][]>(NAV_DEMO_ROUTE);
  protected readonly navSteps = computed(() => navDemoSteps(NAV_DEMO_ROUTE, this.navStrings.locale === 'dv'));
  private readonly navGeo = new UiNavTracker(NAV_DEMO_ROUTE, []);
  protected readonly navPos = signal<UiNavPosition | null>(null);
  protected readonly navPlaying = signal(false);
  protected readonly navSpeed = signal<'1' | '2' | '4' | '8'>('2');
  protected readonly navSpeeds = [{ value: '1', label: '1x' }, { value: '2', label: '2x' }, { value: '4', label: '4x' }, { value: '8', label: '8x' }];
  protected readonly navGlass = signal(false);
  protected readonly navEvents = signal<string[]>([]);
  private navAlong = 0;
  private navOff = 0;
  private navClock = Date.now();
  private navTimer: ReturnType<typeof setInterval> | null = null;
  protected readonly icons = UI_NAV_ICONS;
  protected readonly iconKinds = Object.keys(UI_NAV_ICONS) as UiNavIconKind[];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.navStop(false));
  }

  /** One simulated second: 8 m/s (about 29 km/h) times the speed, a fix every 250 ms. */
  private navTick(): void {
    const k = Number(this.navSpeed());
    this.navAlong = Math.min(this.navGeo.totalMeters, this.navAlong + 8 * 0.25 * k);
    this.navClock += 250 * k;
    const { point, segment } = this.navGeo.pointAt(this.navAlong);
    const pts = this.navGeo.points;
    const heading = uiNavBearing(pts[segment], pts[Math.min(pts.length - 1, segment + 1)]);
    // Wandering off: 80 m to the side of the road, east.
    const off = this.navOff ? this.navOff / (111195 * Math.cos((point.lat * Math.PI) / 180)) : 0;
    this.navPos.set({ lat: point.lat, lng: point.lng + off, heading, speed: 8 * k, accuracy: 12, timestamp: this.navClock });
    if (this.navAlong >= this.navGeo.totalMeters) this.navStop(false);
  }

  protected navPlay(): void {
    if (this.navTimer) return;
    if (this.navAlong >= this.navGeo.totalMeters) this.navRestart();
    this.navPlaying.set(true);
    this.navTick();
    this.navTimer = setInterval(() => this.navTick(), 250);
  }

  protected navStop(ended: boolean): void {
    if (this.navTimer) clearInterval(this.navTimer);
    this.navTimer = null;
    this.navPlaying.set(false);
    if (ended) this.navEvents.update((l) => ['end', ...l].slice(0, 6));
  }

  protected navRestart(): void {
    this.navAlong = 0;
    this.navOff = 0;
    this.navEvents.set([]);
    // A new route object: a new tracker (as after a reroute).
    this.navRoute.set([...NAV_DEMO_ROUTE]);
    this.navPos.set(null);
  }

  protected navWander(): void {
    this.navOff = this.navOff ? 0 : 80;
  }

  protected navLog(e: UiNavEvent): void {
    const text = e.type === 'announce' ? `announce (${e.reason}${e.threshold ? ` ${e.threshold} m` : ''}): ${e.step.instruction}` : e.type === 'offRoute' ? `offRoute, ${Math.round(e.distanceMeters)} m off` : 'arrived';
    this.navEvents.update((l) => [text, ...l].slice(0, 6));
  }

  protected readonly navApi: ApiRow[] = [
    { name: 'route', type: 'UiMapPoint[]', default: '[]', desc: 'The route\'s geometry, [lat, lng] or { lat, lng } (OSRM\'s GeoJSON is [lng, lat]: swap it). A new array (a reroute) starts a new tracker.' },
    { name: 'steps', type: 'UiNavStep[]', default: '[]', desc: 'OSRM steps: { maneuver: { type, modifier?, location, bearingAfter?, exit?, drivingSide? }, distanceMeters, durationSeconds, instruction, streetName? }, the instruction in the app\'s language.' },
    { name: 'position', type: 'UiNavPosition | null', default: 'null', desc: 'The live position from the app: { lat, lng, heading?, speed?, accuracy?, timestamp? }.' },
    { name: 'options', type: 'UiNavOptions', default: '{}', desc: 'offRouteMeters (40, or the accuracy if bigger), offRouteSeconds (5), arriveMeters (20), announceMeters ([200, 30]).' },
    { name: 'zoom', type: 'number', default: '17', desc: 'The zoom it follows at, and goes back to on Recenter.' },
    { name: 'destinationLabel', type: 'string | null', default: 'null', desc: 'The label on the destination marker (the route\'s end).' },
    { name: 'formatTime', type: '(ms) => string', default: '24-hour "14:05"', desc: 'Formats the arrival time.' },
    { name: 'glass', type: 'boolean', default: 'config', desc: 'The banner and bar frosted over the map.' },
    { name: 'tileUrl / tileUrlDark / tileSize / zoomOffset / attribution', type: '—', default: 'OSM', desc: 'As on ui-map.' },
    { name: 'recenter()', type: 'method', default: '—', desc: 'Follows the person again at zoom, heading-up.' },
    { name: 'UiNavTracker(route, steps, options?)', type: 'class', default: '—', desc: 'The logic: update(position) returns { snapped, display, distanceFromRoute, traveledMeters, stepIndex, next, nextNext, distanceToManeuver, remainingMeters, remainingSeconds, bearing, offRoute, arrived, events }; also split(along) and pointAt(along).' },
    { name: 'uiNavFormatDistance / uiNavFormatDuration / uiNavFormatClock', type: 'function', default: '—', desc: '"80 m", "150 m", "2.4 km"; "3 min", "1 h 5 min"; "14:05". Words from the nav* strings (Dhivehi in uiStringsDv).' },
    { name: 'strings navIn / navThen / navArrive / navRecenter / navEnd / navMinutes / navHours / navHoursMinutes / navMeters / navKilometers / navSummary / navLabel', type: 'UiStrings', default: 'English', desc: '"in {distance}", "Then", "Arrive", "Recenter", "End", "{min} min", "{h} h", "{h} h {min} min", "{n} m", "{n} km", the bar for screen readers, "Navigation".' },
    { name: 'ui-map bearing', type: 'number', default: '0', desc: 'The compass direction at the top (0.47.0); turns the map about the middle of the visible part, markers upright.' },
    { name: 'ui-map zoomButtons', type: 'boolean', default: 'true', desc: 'The zoom buttons (0.47.0); the wheel, pinch and keys still zoom.' },
    { name: 'ui-map (userMove)', type: 'void', default: '—', desc: 'The person moved the map themselves (0.47.0): drag, wheel, pinch, double-click, keys, box zoom.' },
    { name: 'UiMapUserLocation.heading', type: 'number', default: '—', desc: 'The dot becomes an arrow puck pointing that way (0.47.0).' },
  ];
  protected readonly navOut: ApiRow[] = [
    { name: '(announce)', type: "{ type: 'announce', reason: 'step' | 'distance', stepIndex, step, distanceMeters, threshold? }", default: '—', desc: 'Speak step.instruction: at the start, on each new maneuver ahead, at 200 m and 30 m before it; each once.' },
    { name: '(offRoute)', type: "{ type: 'offRoute', distanceMeters, position }", default: '—', desc: 'Off the route for offRouteSeconds: reroute. Again only after coming back to the route.' },
    { name: '(arrived)', type: 'void', default: '—', desc: 'Within arriveMeters of the end, once.' },
    { name: '(progress)', type: 'UiNavState', default: '—', desc: 'Every position\'s result.' },
    { name: '(end)', type: 'void', default: '—', desc: 'End was pressed.' },
  ];
  protected readonly iconApi: ApiRow[] = [
    { name: 'uiNavIconKind(maneuver)', type: 'UiNavIconKind', default: '—', desc: 'The drawing for an OSRM type + modifier (+ drivingSide for U-turns).' },
    { name: 'uiNavIcon(maneuver)', type: 'IconSvgObject', default: '—', desc: 'The drawing itself, for hugeicons-icon.' },
    { name: 'UI_NAV_ICONS', type: 'Record<UiNavIconKind, IconSvgObject>', default: '—', desc: 'Every drawing, by kind.' },
  ];
  protected readonly MARKER = MARKER;
  protected readonly PAGE_CODE = PAGE_CODE;
  protected readonly TILES_CODE = TILES_CODE;
  protected readonly LOCATE_CODE = LOCATE_CODE;
  protected readonly ROUTE_CODE = ROUTE_CODE;
  protected readonly PREVIEW_CODE = PREVIEW_CODE;
  protected readonly SELECTED_CODE = SELECTED_CODE;
  // Preview (0.43.0): the still map, and the full map it opens.
  protected readonly previewCenter: UiLatLng = { lat: 4.176, lng: 73.5087 };
  protected readonly previewOn = signal(true);
  protected readonly opened = signal(0);
  protected readonly onOffOptions = [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }];
  protected readonly resultsOpen = signal(false);
  protected readonly resultsPick = signal<UiMapMarker | null>(null);
  protected readonly resultsCover = signal(0);
  protected openResults(): void {
    this.opened.update((n) => n + 1);
    this.resultsPick.set(null);
    this.resultsOpen.set(true);
  }
  protected closeResults(): void {
    this.resultsOpen.set(false);
  }
  // Selected marker (0.43.0).
  protected readonly selectedId = signal<string | null>('n2');
  protected readonly labelMode = signal<UiMapMarkerLabels>('all');
  protected readonly labelOptions = [{ value: 'all', label: 'All' }, { value: 'selected', label: 'Selected' }, { value: 'none', label: 'None' }];
  protected readonly previewApi: ApiRow[] = [
    { name: 'preview', type: 'boolean', default: 'false', desc: 'A still picture that is one button (0.43.0): no gestures, keys or controls; markers drawn but not focusable; the wheel and drags scroll the page. Off at runtime gives the full map back.' },
    { name: '(previewPress)', type: 'void', default: '—', desc: 'The preview was clicked, or Enter or Space pressed on it: open the full map.' },
    { name: 'previewLabel', type: 'string | null', default: 'null', desc: 'Its accessible name. null: the mapOpen string.' },
    { name: 'mapOpen', type: 'UiStrings', default: "'Open map'", desc: 'The default preview name, from provideUiStrings.' },
    { name: '.ui-map-preview · .ui-map-preview-badge', type: 'CSS', default: '—', desc: 'The whole-map button (a slight wash while pressed, the focus ring inside the edge) and the 30px round expand badge at the top-end corner.' },
  ];
  protected readonly AREA_CODE = AREA_CODE;
  protected readonly radius = signal(5000);
  protected readonly areaLive = signal<number | null>(null);
  protected readonly areaTone = signal<'primary' | 'success' | 'danger'>('primary');
  protected readonly areaToneOptions = [{ value: 'primary', label: 'Primary' }, { value: 'success', label: 'Success' }, { value: 'danger', label: 'Danger' }];
  protected readonly area = computed<UiMapArea>(() => ({ lat: this.home.lat, lng: this.home.lng, radiusMeters: this.radius(), tone: this.areaTone(), editable: true, minMeters: 500, maxMeters: 30000 }));
  protected areaCommit(r: number): void {
    this.areaLive.set(null);
    this.radius.set(r);
  }
  protected radiusText(m: number): string {
    return uiMapFormatRadius(m);
  }
  protected readonly areaApi: ApiRow[] = [
    { name: 'area', type: 'UiMapArea | null', default: 'null', desc: 'A search area (0.44.0): a circle of radiusMeters (true metres) around lat/lng in its tone, under the routes, markers and pin. editable adds the radius handle (not on a preview).' },
    { name: 'areaLabel', type: 'string | null', default: 'null', desc: 'The handle\'s accessible name (a slider). null: the mapSearchArea string, Search area.' },
    { name: '(areaChanging)', type: 'number', default: '—', desc: 'The radius in metres on each change while the handle is dragged.' },
    { name: '(areaChange)', type: 'number', default: '—', desc: 'The radius in metres when the handle is let go, and after each keyboard step.' },
    { name: 'fitArea(options?)', type: 'method', default: '—', desc: 'Shows the whole circle in the visible part: the same options as fitPoints (padding 24, maxZoom 17, animate), and likewise held until Leaflet has loaded.' },
    { name: 'uiMapFormatRadius(m, strings?)', type: 'function', default: '—', desc: '"800 m" under 1 km, "1.5 km" under 10 km, "20 km" above, from the mapRadiusMeters / mapRadiusKilometers strings.' },
    { name: 'uiMapNiceRadius / uiMapAreaStep / uiMapMetersPerPx', type: 'function', default: '—', desc: 'The rounding the handle uses (10 m / 100 m / 1 km), one keyboard step (about 10%, within min..max), and metres per px at a latitude and zoom.' },
    { name: 'mapSearchArea / mapRadiusMeters / mapRadiusKilometers', type: 'UiStrings', default: "'Search area' / '{n} m' / '{n} km'", desc: 'The words, from provideUiStrings.' },
  ];
  protected readonly selectedApi: ApiRow[] = [
    { name: 'selectedMarkerId', type: 'string | null', default: 'null', desc: 'The selected marker (0.43.0): a 22px dot (UI_MAP_SELECTED_DOT) with a white ring and a halo in its tone, on top, its label shown, aria-pressed.' },
    { name: 'markerLabels', type: "'all' | 'selected' | 'none'", default: "'all'", desc: "Which labels show: every one, only the selected marker's, or none. Hidden labels still name their markers (aria-label)." },
    { name: '(mapTap)', type: 'UiLatLng', default: '—', desc: 'A background tap (0.43.1), used here to clear the selection; never a marker, pin, control, attribution, preview, drag or double-click.' },
    { name: 'uiMapLabelShown(mode, selected)', type: 'function', default: '—', desc: 'Whether a marker\'s label shows under a mode.' },
  ];
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
  /** Bumped by "Draw it again": a new route id, so the old line fades and the new one draws in. */
  protected readonly drawRun = signal(0);
  protected readonly animateRoute = signal(true);
  protected readonly drawOptions = [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }];
  protected readonly routes = computed<UiMapRoute[]>(() => (this.showRoute() ? [{ id: `to-patient-${this.drawRun()}`, points: this.routePoints, tone: this.tone(), label: 'Route, 1.3 km', animate: this.animateRoute() }] : []));
  protected drawAgain(): void {
    this.showRoute.set(true);
    this.drawRun.update((n) => n + 1);
  }
  protected readonly routeControls: UiMapControl[] = [{ id: 'fit', icon: CenterFocusIcon, label: 'Show the whole route', tooltip: 'Show the whole route' }];
  protected readonly pageControls: UiMapControl[] = [{ id: 'fit', icon: CenterFocusIcon, label: 'Show all the nurses', tooltip: 'Show all the nurses' }];
  protected readonly routeApi: ApiRow[] = [
    { name: 'routes', type: 'UiMapRoute[]', default: '[]', desc: 'Lines along the road: id, points ([lat, lng] or { lat, lng }), tone, label. Under the pulse, dot, markers and pin; updated in place; [] removes them.' },
    { name: 'UiMapRoute.tone', type: 'UiMapRouteTone', default: "'primary'", desc: "'primary' | 'muted' | 'success' | 'warning' | 'danger': the --ui-map-route-<tone> token over --ui-map-route-casing." },
    { name: 'UiMapRoute.label', type: 'string', default: '—', desc: 'The route\'s one accessible name ("Route, 1.3 km"); without it the line is hidden from screen readers.' },
    { name: 'UiMapRoute.animate', type: 'boolean', default: 'true', desc: 'Draw it in from start to end when it appears or its points change (0.46.2), ease-out over uiMapRouteDrawMs. False draws it at once; reduced motion and preview always do. The same id and points again never replay it.' },
    { name: 'uiMapRouteDrawMs(metres)', type: 'function', default: '—', desc: 'The draw-in time for a route length (0.46.2): 450 ms for 1 km, +150 ms per doubling, within 250..900 ms.' },
    { name: 'uiMapRouteLength(points) / uiMapRoutePartial(points, fraction)', type: 'function', default: '—', desc: 'A route\'s length in metres, and its first fraction by length (0.46.2): what the draw-in shows each frame.' },
    { name: 'UI_MAP_ROUTE_FADE_MS', type: 'number', default: '150', desc: 'How long a removed route fades out (0.46.2); at once under reduced motion.' },
    { name: 'fitPoints(points, options?)', type: 'method', default: '—', desc: 'Shows every point inside the visible part (between the insets) plus padding (24px), at a whole zoom up to maxZoom (17); one point is centred at maxZoom. Animated unless animate: false or reduced motion. Called before Leaflet has loaded (straight after the map is created), it is held and runs once it has, without animating (0.44.2).' },
    { name: 'uiMapFitView(points, size, area, maxZoom?)', type: 'function', default: '—', desc: 'The view fitPoints moves to (the map\'s own centre and zoom), for tests or a first view.' },
    { name: 'uiMapRouteWidth(zoom)', type: 'function', default: '—', desc: 'The line and casing widths at a zoom: 5 over 9px from zoom 14, down to 60% at zoom 10.' },
    { name: '--ui-map-route-casing / -primary / -muted / -success / -warning / -danger', type: 'CSS colour', default: 'theme', desc: 'The route colours, 3:1 against streets-v2 and dataviz tiles in every theme; override per theme.' },
    { name: '--ui-map-label-max', type: 'CSS length', default: 'min(320px, map width - 32px)', desc: 'The widest a marker label gets (set by the map); labels wrap to two lines before the ellipsis.' },
    { name: 'controls', type: 'UiMapControl[]', default: '[]', desc: 'Your own round buttons (0.42.1), above the locate button at the bottom-end of the visible part (in its place without one), 8px apart, following the insets; the bottom-left in RTL.' },
    { name: '(controlPress)', type: 'UiMapControl', default: '—', desc: 'One of controls was pressed (never while disabled).' },
    { name: 'UiMapControl', type: '{ id, icon, label, tooltip?, disabled? }', default: '—', desc: 'A stable id, a hugeicons icon, its accessible name, an optional tooltip; disabled shows it but it can\'t be pressed.' },
    { name: 'uiMapLabelSide(x, labelWidth, mapWidth, rtl?)', type: 'function', default: '—', desc: "Which side of its dot a label goes (0.42.1): the inline end unless it would run off the map there (8px to spare), then the other side, else the roomier one. Sets the marker's data-side." },
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
  /** The map page's Show all control: home and every nurse. */
  protected readonly allNurses: UiLatLng[] = [this.home, ...this.markers];
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
    { name: 'mapTap', type: 'UiLatLng', default: '—', desc: 'The map background was tapped (0.43.1), inside the Angular zone. Not a marker, pin, control, attribution, preview, drag or double-click (the user dot counts as background). Also fires in pinMode.' },
    { name: 'centerChanged', type: 'UiMapView', default: '—', desc: 'The map stopped moving; where it is now.' },
  ];
  protected readonly pinApi: ApiRow[] = [
    { name: 'pin', type: 'UiLatLng | null (model)', default: 'null', desc: 'Two-way ([(pin)]): the chosen point, a draggable pin when set.' },
    { name: 'pinMode', type: 'boolean', default: 'false', desc: 'A background tap moves the pin there and also emits mapTap; Enter moves only the pin.' },
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
