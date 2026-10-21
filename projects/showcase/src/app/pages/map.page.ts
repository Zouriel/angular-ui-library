import { Component, computed, signal } from '@angular/core';
import { UiMap, type UiLatLng, type UiMapInsets, type UiMapMarker, type UiMapPulse, type UiMapView } from '@zouriel/ui/map';
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
interface UiMapInsets { top?: number; bottom?: number; start?: number; end?: number; } // px`;

const PAGE_CODE = `<div class="page"> <!-- position: fixed; inset: 0 -->
  <ui-map fill [center]="home" [zoom]="15" [markers]="nurses" [pin]="home" [pinDraggable]="false"
    [pulse]="{ lat: home.lat, lng: home.lng, active: searching() }"
    [insets]="{ top: cardCover(), bottom: sheetCover() }" />
  <ui-floating-panel placement="top" ariaLabel="Status" (coverChange)="cardCover.set($event)">
    <span role="status">{{ searching() ? 'Looking for a nurse near you' : 'Where should the nurse come?' }}</span>
  </ui-floating-panel>
  <ui-bottom-sheet title="Find a nurse" [snaps]="[0.42, 0.75]" [(snap)]="snap" [closable]="false" [maxWidth]="560"
    (coverChange)="sheetCover.set($event)">
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

      <doc-section name="Map page" anchor="map-page" selector="ui-map fill · [pulse] · [insets]" [api]="pageApi"
        summary="A full-screen map with the form in a ui-bottom-sheet and a ui-floating-panel status card at the top. fill makes the map fill its parent with square corners. pulse draws soft rings radiating from a point while the app searches (one still halo under reduced motion); they move with the map, sit under the markers and the pin, and say nothing to screen readers, so put the words in the status card. insets is how much of each edge the sheet and the card cover, straight from their coverChange outputs: the map still draws edge to edge, but its centre, the pin's centre, centerChanged and the zoom buttons and attribution use the part between them. When the sheet moves to another snap, the map pans so the point in the middle of the visible part stays in the middle of the new visible part.">
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
          <ui-map fill [center]="home" [zoom]="15" [markers]="markers" [pin]="home" [pinDraggable]="false" pinLabel="Your home"
            [pulse]="pulse()" [insets]="insets()" ariaLabel="Nurses near your home" />
          <ui-floating-panel placement="top" ariaLabel="Status" (coverChange)="cardCover.set($event)">
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
          <ui-bottom-sheet title="Find a nurse" [snaps]="[0.42, 0.75]" [(snap)]="snap" [closable]="false" [maxWidth]="560" (coverChange)="sheetCover.set($event)">
            <div class="form">
              <ui-form-field label="Address">
                <ui-input placeholder="Building, street, island" autocomplete="street-address" [(ngModel)]="address" />
              </ui-form-field>
              <ui-segmented label="When" [options]="whenOptions" [(value)]="when" />
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
  `,
})
export class MapPage {
  protected readonly MARKER = MARKER;
  protected readonly PAGE_CODE = PAGE_CODE;
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
  protected readonly pageApi: ApiRow[] = [
    { name: 'pulse', type: 'UiMapPulse | null', default: 'null', desc: 'Soft rings radiating from a point (3 staggered, 2.4s, up to 120px) while active; a still halo under reduced motion. Geo-anchored, under the markers and pin, silent.' },
    { name: 'insets', type: 'UiMapInsets', default: '{}', desc: 'Px covered over each edge (start/end follow the direction). Centre, pin centre, centerChanged and the controls use the part between them, and the zoom buttons zoom around its middle; a change pans to keep the visible middle in the middle.' },
    { name: 'fill', type: 'boolean', default: 'false', desc: 'Fill the parent\'s height with square corners: a full-screen map page.' },
    { name: 'ui-floating-panel (coverChange)', type: 'number', default: '—', desc: 'Px of its edge the card covers (gutter plus height): feed it to insets.top.' },
    { name: 'ui-bottom-sheet (coverChange)', type: 'number', default: '—', desc: 'Px of the screen bottom the sheet covers once it settles: feed it to insets.bottom.' },
    { name: 'ui-bottom-sheet maxWidth', type: 'number | string | null', default: 'null', desc: 'The widest the sheet gets (px or a CSS length). On a wider screen it is that wide and centred, the backdrop still covers everything, and coverChange still reports the covered height. 560 suits tablets and desktops.' },
    { name: 'ui-bottom-sheet persistent()', type: 'boolean', default: '—', desc: 'True when the smallest snap is above 0, as here: the sheet never closes. Escape collapses it to that snap and does nothing there; browser Back always leaves the page.' },
  ];
}
