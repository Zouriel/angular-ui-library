import { Component, signal } from '@angular/core';
import { UiMap, type UiLatLng, type UiMapMarker, type UiMapView } from '@zouriel/ui/map';
import { UiFloatingPanel } from '@zouriel/ui/layout';
import { UiButton } from '@zouriel/ui/button';
import { UiText } from '@zouriel/ui/text';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const MARKER = `interface UiMapMarker {
  id: string;
  lat: number;
  lng: number;
  tone?: UiStatus;   // the dot's colour, default 'primary'
  label?: string;    // a pill beside the dot, and its accessible name
}
interface UiLatLng { lat: number; lng: number; }
interface UiMapView extends UiLatLng { zoom: number; }`;

@Component({
  selector: 'page-map',
  imports: [UiMap, UiFloatingPanel, UiButton, UiText, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Components" title="Map"
      lead="An OpenStreetMap map from @zouriel/ui/map, on Leaflet 1.9.4. The entry point and Leaflet itself load on first use, so a map never lands in an app's first download. Install leaflet (~1.9.4) next to the library.">

      <doc-section name="Map" selector="ui-map" [api]="api" [outputs]="out" [shapes]="MARKER"
        summary="Markers are dots in their tone with a label pill; selecting one (click, or Enter when it has focus) emits markerSelected. center and zoom move the map; centerChanged reports where the person moved it. The zoom buttons sit at the inline start and the OSM attribution at the inline end, so they swap in RTL. The controls use the theme, and on a dark theme the tiles are dimmed. Under reduced motion there are no zoom or pan animations. Give it a height with --ui-map-height (320px by default).">
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
    </doc-page>
  `,
  styles: `
    .map-wrap { position: relative; --ui-map-height: 360px; margin-bottom: var(--ui-space-2); }
    .meta { color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); margin-top: var(--ui-space-1); font-variant-numeric: tabular-nums; }
    .acts { margin-top: var(--ui-space-3); }
  `,
})
export class MapPage {
  protected readonly MARKER = MARKER;
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
    { name: 'ariaLabel', type: 'string', default: "'Map'", desc: 'Names the map region.' },
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
  ];
}
