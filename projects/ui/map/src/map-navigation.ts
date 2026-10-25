import {
  Component, DestroyRef, ElementRef, ViewEncapsulation, afterNextRender, booleanAttribute, computed, effect, inject, input, output, signal, untracked, viewChild,
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Navigation03Icon from '@hugeicons/core-free-icons/Navigation03Icon';
import { UI_CONFIG, injectUiStrings } from '@zouriel/ui';
import { UiButton } from '@zouriel/ui/button';
import { UiMap, UI_MAP_OSM_ATTRIBUTION, UI_MAP_OSM_TILES, uiMapPoint, type UiLatLng, type UiMapInsets, type UiMapMarker, type UiMapPoint, type UiMapRoute, type UiMapUserLocation } from './map';
import {
  UiNavTracker, uiNavFormatClock, uiNavFormatDistance, uiNavFormatDuration, uiNavIcon, uiNavIconKind,
  type UiNavEvent, type UiNavOptions, type UiNavPosition, type UiNavState, type UiNavStep,
} from './navigation';

/** Where the person sits in the visible part while followed: this far down it (0.47.0). */
export const UI_NAV_FOLLOW_AT = 0.68;
/** The zoom a navigation view follows at, and goes back to on Recenter. */
export const UI_NAV_ZOOM = 17;

/**
 * Where a followed person's dot goes (0.47.0, Flutter `uiNavFollowInsets`): the top inset that puts
 * the middle of the part between it and `bottom` at `UI_NAV_FOLLOW_AT` of the way down from `top`
 * (the banner) to the bottom bar, so there is more road ahead than behind.
 */
export function uiNavFollowInsets(height: number, top: number, bottom: number): UiMapInsets {
  const free = Math.max(0, height - top - bottom);
  const at = top + free * UI_NAV_FOLLOW_AT;
  return { top: Math.max(0, 2 * at - height + bottom), bottom };
}

/**
 * `ui-map-navigation` — a turn-by-turn view (0.47.0), like a car's navigation: a flat map that
 * follows the person and turns heading-up, the route ahead in the primary tone and the part behind
 * dimmed, an arrow for the person, a banner with the next maneuver (its arrow, "in 80 m", the
 * instruction and street) and the one after it small, and a bar with the time and distance left,
 * the arrival time and End.
 *
 * - The app gives `route` (the geometry), `steps` (OSRM steps with its own localized instructions)
 *   and the live `position` ({ lat, lng, heading, speed, accuracy, timestamp }); the view reads no
 *   GPS itself. A new route or steps (a reroute) starts a new `UiNavTracker`.
 * - `(announce)` at the start, on each new maneuver ahead and at 200 m and 30 m before it (each
 *   once): speak `event.step.instruction`. `(offRoute)` after 5 s more than 40 m off the route:
 *   reroute. `(arrived)` within 20 m of the end. `(progress)` every update, with the state. `(end)`
 *   when End is pressed. Tune with `options`.
 * - Drag, the wheel, a pinch or a two-finger turn stop the following (the map keeps its turn) and
 *   show Recenter, which follows again heading-up at `zoom`; the compass shows meanwhile (north up). Under reduced motion the map neither glides nor turns smoothly.
 * - In right-to-left text the banner and bar are mirrored; the maneuver arrows are not (left is left).
 * - `glass` (the config's by default) puts the banner and bar on glass.
 *
 * Give it a height (it fills it).
 */
@Component({
  selector: 'ui-map-navigation',
  encapsulation: ViewEncapsulation.None,
  imports: [UiMap, HugeiconsIconComponent, UiButton],
  host: { class: 'ui-map-navigation', role: 'region', '[attr.aria-label]': 'ariaLabel() ?? strings.navLabel', '[attr.data-glass]': 'glass() || null' },
  template: `<ui-map class="ui-nav-map" fill [center]="startCenter()" [zoom]="zoom()" [routes]="lines()" [userLocation]="puck()" [markers]="destination()"
      [bearing]="bearing()" [insets]="insets()" [zoomButtons]="false" [compass]="!following()" [ariaLabel]="mapLabel() ?? strings.mapLabel"
      [tileUrl]="tileUrl()" [tileUrlDark]="tileUrlDark()" [tileSize]="tileSize()" [zoomOffset]="zoomOffset()" [attribution]="attribution()"
      [tileReferrerPolicy]="tileReferrerPolicy()" (userMove)="following.set(false)" />
    <div class="ui-nav-top" #top>
      <div class="ui-nav-banner" role="group" [attr.aria-label]="bannerLabel()">
        <span class="ui-nav-maneuver" aria-hidden="true" [attr.data-kind]="kind()">
          <hugeicons-icon [icon]="icon()" [size]="40" [strokeWidth]="2.2" />
          @if (exit(); as n) { <span class="ui-nav-exit">{{ n }}</span> }
        </span>
        <span class="ui-nav-text">
          <span class="ui-nav-distance">{{ inText() }}</span>
          <span class="ui-nav-instruction" aria-live="polite">{{ instruction() }}</span>
          @if (street(); as s) { <span class="ui-nav-street">{{ s }}</span> }
        </span>
      </div>
      @if (state()?.nextNext; as nn) {
        <div class="ui-nav-then">
          <span class="ui-nav-then-word">{{ strings.navThen }}</span>
          <hugeicons-icon [icon]="iconOf(nn)" [size]="20" [strokeWidth]="2" aria-hidden="true" />
          <span class="ui-nav-then-text">{{ nn.instruction || strings.navArrive }}</span>
        </div>
      }
    </div>
    @if (!following()) {
      <button type="button" class="ui-nav-recenter" (click)="recenter()">
        <hugeicons-icon [icon]="recenterIcon" [size]="18" [strokeWidth]="1.8" aria-hidden="true" />
        <span>{{ strings.navRecenter }}</span>
      </button>
    }
    <div class="ui-nav-bar" #bar>
      <div class="ui-nav-eta" role="group" [attr.aria-label]="summary()">
        <span class="ui-nav-time" aria-hidden="true">{{ timeLeft() }}</span>
        <span class="ui-nav-meta" aria-hidden="true"><span>{{ distanceLeft() }}</span><span class="ui-nav-dot">·</span><span dir="ltr">{{ clock() }}</span></span>
      </div>
      <ui-button class="ui-nav-end" variant="destructive" (click)="end.emit()">{{ strings.navEnd }}</ui-button>
    </div>`,
  styleUrls: ['./map-navigation.css'],
})
export class UiMapNavigation {
  /** The route's geometry: `[lat, lng]` or `{ lat, lng }` (OSRM's GeoJSON is [lng, lat]: swap it). */
  route = input<readonly UiMapPoint[]>([]);
  /** The route's steps, with the app's localized instructions. */
  steps = input<readonly UiNavStep[]>([]);
  /** The person's live position, from the app; null before the first fix. */
  position = input<UiNavPosition | null>(null);
  /** Thresholds: off-route distance and time, arrival distance, announce distances. */
  options = input<UiNavOptions>({});
  /** The zoom it follows at, and goes back to on Recenter; 17. */
  zoom = input(UI_NAV_ZOOM);
  /** The destination marker's label; none by default. */
  destinationLabel = input<string | null>(null);
  /** The arrival time's format: 24-hour "14:05" by default. */
  formatTime = input<(ms: number) => string>(uiNavFormatClock);
  /** The banner and bar on glass. */
  glass = input<boolean, unknown>(inject(UI_CONFIG).glass, { transform: booleanAttribute });
  /** The view's name; null: the `navLabel` string ("Navigation"). */
  ariaLabel = input<string | null>(null);
  /** The map's name; null: the `mapLabel` string. */
  mapLabel = input<string | null>(null);
  tileUrl = input(UI_MAP_OSM_TILES);
  tileUrlDark = input<string | null>(null);
  tileSize = input(256);
  zoomOffset = input(0);
  attribution = input(UI_MAP_OSM_ATTRIBUTION);
  tileReferrerPolicy = input<Exclude<ReferrerPolicy, ''>>('strict-origin-when-cross-origin');

  /** Time to speak (at the start, each new maneuver ahead, and at 200 m and 30 m before it). */
  readonly announce = output<Extract<UiNavEvent, { type: 'announce' }>>();
  /** Off the route for a while: reroute (give a new route and steps). */
  readonly offRoute = output<Extract<UiNavEvent, { type: 'offRoute' }>>();
  /** At the destination. */
  readonly arrived = output<void>();
  /** Every position's result. */
  readonly progress = output<UiNavState>();
  /** End was pressed. */
  readonly end = output<void>();

  protected readonly strings = injectUiStrings();
  protected readonly recenterIcon = Navigation03Icon;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly map = viewChild.required(UiMap);
  private readonly top = viewChild.required<ElementRef<HTMLElement>>('top');
  private readonly bar = viewChild.required<ElementRef<HTMLElement>>('bar');

  /** Whether the map follows the person (until they move it). */
  readonly following = signal(true);
  /** The latest tracker state. */
  readonly state = signal<UiNavState | null>(null);
  private readonly size = signal({ height: 0, top: 0, bottom: 0 });
  /** The map's turn while not following: it keeps the last one. */
  private heldBearing = 0;

  /** The tracker for the current route; a new route or steps start a new one. */
  readonly tracker = computed(() => new UiNavTracker(this.route(), this.steps(), this.options()));

  protected readonly startCenter = computed<UiLatLng>(() => untracked(() => {
    const p = this.position();
    const r = this.route();
    return p ? { lat: p.lat, lng: p.lng } : r.length ? uiMapPoint(r[0]) : { lat: 4.1755, lng: 73.5093 };
  }));
  protected readonly insets = computed(() => {
    const s = this.size();
    return s.height ? uiNavFollowInsets(s.height, s.top, s.bottom) : {};
  });
  protected readonly lines = computed<UiMapRoute[]>(() => {
    const t = this.tracker();
    if (t.points.length < 2) return [];
    const s = this.state();
    // Both lines from the start (the way behind a dot until there is one), so the way ahead is
    // always drawn over it where they meet.
    const { traveled, remaining } = t.split(s?.traveledMeters ?? 0);
    // The way behind dimmed (the muted tone at 60% over its casing), the way ahead in the primary
    // tone; never drawn in (they change on every fix).
    return [
      { id: 'nav-traveled', points: traveled, tone: 'muted', opacity: 0.6, animate: false },
      { id: 'nav-remaining', points: remaining, animate: false },
    ];
  });
  protected readonly puck = computed<UiMapUserLocation | null>(() => {
    const s = this.state();
    const p = this.position();
    if (!s || !p) return null;
    return { ...s.display, accuracy: p.accuracy, heading: p.heading ?? s.bearing };
  });
  protected readonly destination = computed<UiMapMarker[]>(() => {
    const pts = this.tracker().points;
    const end = pts[pts.length - 1];
    if (!end) return [];
    const label = this.destinationLabel();
    return [{ id: 'nav-destination', lat: end.lat, lng: end.lng, tone: 'danger', ...(label ? { label } : {}) }];
  });
  protected readonly bearing = computed(() => {
    const s = this.state();
    if (this.following() && s) this.heldBearing = s.bearing;
    return this.heldBearing;
  });

  private readonly ahead = computed(() => this.state()?.next ?? this.steps()[1] ?? null);
  protected readonly kind = computed(() => {
    const n = this.ahead();
    return n ? uiNavIconKind(n.maneuver) : 'straight';
  });
  protected readonly icon = computed(() => {
    const n = this.ahead();
    return n ? uiNavIcon(n.maneuver) : uiNavIcon({ type: 'continue' });
  });
  protected readonly exit = computed(() => {
    const n = this.ahead();
    return n && this.kind().startsWith('roundabout') && n.maneuver.exit ? n.maneuver.exit : null;
  });
  protected readonly inText = computed(() => {
    const s = this.state();
    const d = s ? s.distanceToManeuver : (this.steps()[0]?.distanceMeters ?? 0);
    return this.strings.navIn.replace('{distance}', uiNavFormatDistance(d, this.strings));
  });
  protected readonly instruction = computed(() => this.ahead()?.instruction || this.strings.navArrive);
  protected readonly street = computed(() => this.ahead()?.streetName ?? null);
  protected readonly bannerLabel = computed(() => [this.inText(), this.instruction(), this.street()].filter(Boolean).join(', '));
  private readonly remaining = computed(() => {
    const s = this.state();
    if (s) return { meters: s.remainingMeters, seconds: s.remainingSeconds, at: this.position()?.timestamp ?? Date.now() };
    const steps = this.steps();
    return { meters: this.tracker().totalMeters, seconds: steps.reduce((a, x) => a + x.durationSeconds, 0), at: Date.now() };
  });
  protected readonly timeLeft = computed(() => uiNavFormatDuration(this.remaining().seconds, this.strings));
  protected readonly distanceLeft = computed(() => uiNavFormatDistance(this.remaining().meters, this.strings));
  protected readonly clock = computed(() => this.formatTime()(this.remaining().at + this.remaining().seconds * 1000));
  protected readonly summary = computed(() =>
    this.strings.navSummary.replace('{time}', this.timeLeft()).replace('{distance}', this.distanceLeft()).replace('{clock}', this.clock()),
  );

  constructor() {
    // Each fix: the tracker's state, the events out, and the map following.
    effect(() => {
      const p = this.position();
      const t = this.tracker();
      untracked(() => {
        if (!p) {
          this.state.set(null);
          return;
        }
        const s = t.update(p);
        this.state.set(s);
        for (const e of s.events) {
          if (e.type === 'announce') this.announce.emit(e);
          else if (e.type === 'offRoute') this.offRoute.emit(e);
          else this.arrived.emit();
        }
        this.progress.emit(s);
        if (this.following()) this.follow(false);
      });
    });
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const measure = () => {
        const height = this.host.nativeElement.clientHeight;
        const top = this.top().nativeElement.offsetHeight + this.top().nativeElement.offsetTop;
        const bottom = this.bar().nativeElement.offsetHeight;
        const now = this.size();
        if (now.height !== height || now.top !== top || now.bottom !== bottom) this.size.set({ height, top, bottom });
        this.host.nativeElement.style.setProperty('--ui-nav-bar-height', `${bottom}px`);
      };
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(measure);
      ro.observe(this.host.nativeElement);
      ro.observe(this.top().nativeElement);
      ro.observe(this.bar().nativeElement);
      destroy.onDestroy(() => ro.disconnect());
    });
  }

  /** Follows the person again at `zoom`, heading-up. */
  recenter(): void {
    this.following.set(true);
    this.follow(true);
    // Heading-up again, even when the person turned the map (the bearing input may not change).
    const s = this.state();
    if (s) this.map().rotateTo(s.bearing);
  }

  protected iconOf(step: UiNavStep) {
    return uiNavIcon(step.maneuver);
  }

  private follow(resetZoom: boolean): void {
    const s = this.state();
    if (!s) return;
    const map = this.map();
    map.flyTo(s.display, resetZoom ? this.zoom() : undefined);
  }
}
