import {
  Component, ComponentRef, DestroyRef, ElementRef, Injector, ViewContainerRef, ViewEncapsulation, afterNextRender, booleanAttribute, computed, contentChildren, effect, inject, input, output, signal, untracked, viewChild,
} from '@angular/core';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';
import Navigation03Icon from '@hugeicons/core-free-icons/Navigation03Icon';
import { UI_CONFIG, injectUiStrings, uiFormatString } from '@zouriel/ui';
import { UiButton } from '@zouriel/ui/button';
import { UiConfirmDialog } from '@zouriel/ui/dialog';
import { UiHoldPress, UI_HOLD_TAP_MS } from '@zouriel/ui/hold-button';
import { UiMap, UI_MAP_OSM_ATTRIBUTION, UI_MAP_OSM_TILES, uiMapPoint, type UiLatLng, type UiMapInsets, type UiMapMarker, type UiMapPoint, type UiMapRoute, type UiMapUserLocation } from './map';
import {
  UiNavTracker, uiNavFitWords, uiNavFormatClock, uiNavFormatDistance, uiNavFormatDuration, uiNavIcon, uiNavIconKind,
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

/** A navigation action's colour (0.47.1, Flutter `UiNavActionTone`): 'neutral', or 'danger' for SOS. */
export type UiNavActionTone = 'neutral' | 'danger';

/** How long a holding navigation action is held by default, in ms (0.47.2): the Dhirumi SOS hold. */
export const UI_NAV_HOLD_MS = 2000;

let navHoldSeq = 0;

/**
 * `button[uiNavAction]` — one of the app's own buttons on a navigation view (0.47.1, Flutter
 * `UiNavAction`): mute, SOS. Put it inside `ui-map-navigation`; it joins the round button stack at
 * the end side under the banner. A 48px opaque circle with the icon; `label` is its accessible name
 * (and tooltip). `tone` 'danger' is the prominent SOS style (the danger fill and a raised-surface
 * ring). `pressed` makes it a toggle (aria-pressed), drawn in the primary fill while on (muted).
 *
 * ```html
 * <button uiNavAction [icon]="muteIcon" label="Mute" [pressed]="muted()" (click)="toggleMute()"></button>
 * <button uiNavAction [icon]="sosIcon" label="SOS" tone="danger" hold [onTap]="openSosSheet" (confirmed)="sos()"></button>
 * ```
 *
 * Press and hold (0.47.2, off by default): `hold` (2 s) or `[holdMs]="3000"` makes it fire only when
 * held to the end, the way `ui-hold-button` and a holding `ui-fab` do (the same press logic,
 * `UiHoldPress`): a ring fills around the button while it is held; letting go, or sliding off it,
 * cancels. Space or Enter held works the same. Listen to `(confirmed)`, not `(click)` (a click still
 * fires on every press). The button is described by `holdHint` ("Press and hold to confirm"), and a
 * polite live region reads the hold's progress ("Holding, 50%") and a hold let go early ("Hold
 * cancelled"). Under reduced motion the hold is still needed, but the ring doesn't animate: it shows
 * whole and steady while held. A tap (shorter than 300ms), a quick Enter or Space, or a screen
 * reader's activation calls `onTap` when the app gives one (an SOS's confirm sheet), or opens the
 * library's confirm dialog (`confirmTitle`, `confirmMessage`, `confirmLabel`, `destructive`), which
 * confirms the same way.
 */
@Component({
  selector: 'button[uiNavAction]',
  imports: [HugeiconsIconComponent],
  host: {
    class: 'ui-nav-action', type: 'button',
    '[attr.aria-label]': 'label()', '[attr.title]': 'label()', '[attr.data-tone]': 'tone()', '[attr.aria-pressed]': 'pressed() ?? null',
    '[attr.data-hold]': 'holding() !== null ? "" : null', '[attr.data-holding]': 'held() ? "" : null', '[attr.data-still]': 'still() ? "" : null',
    '[attr.aria-describedby]': 'holding() !== null ? hintId : null',
    '(pointerdown)': 'holding() !== null ? press.down($event) : null',
    '(pointerup)': 'holding() !== null ? press.up(true) : null',
    '(pointercancel)': 'holding() !== null ? press.up(false) : null',
    '(pointerleave)': 'holding() !== null ? press.up(false) : null',
    '(pointermove)': 'holding() !== null ? moved($event) : null',
    '(keydown)': 'holding() !== null ? press.keyDown($event) : null',
    '(keyup)': 'holding() !== null ? press.keyUp($event) : null',
    '(blur)': 'holding() !== null ? press.abort() : null',
    '(click)': 'holding() !== null ? press.clicked($event) : null',
    '(contextmenu)': 'holding() !== null ? $event.preventDefault() : null',
  },
  template: `@if (holding() !== null) {
      <svg class="ui-nav-hold-ring" viewBox="0 0 48 48" aria-hidden="true">
        <circle class="ui-nav-hold-track" cx="24" cy="24" r="21" />
        <circle class="ui-nav-hold-arc" cx="24" cy="24" r="21" pathLength="100"
          [style.stroke-dashoffset]="100 - progress() * 100" [style.transition-duration.ms]="still() ? 0 : progressMs()" />
      </svg>
    }
    <hugeicons-icon [icon]="icon()" [size]="22" [strokeWidth]="1.8" aria-hidden="true" />
    @if (holding() !== null) {
      <span class="ui-nav-sr" [id]="hintId">{{ holdHint() ?? strings.holdHint }}</span>
      <span class="ui-nav-sr ui-nav-hold-live" aria-live="polite">{{ spoken() }}</span>
    }`,
})
export class UiNavAction {
  protected readonly strings = injectUiStrings();
  private readonly el = inject<ElementRef<HTMLButtonElement>>(ElementRef);
  private readonly vcr = inject(ViewContainerRef);
  /** The icon (a hugeicons icon, one file per icon). */
  icon = input.required<IconSvgObject>();
  /** The accessible name and tooltip: "Mute", "SOS". */
  label = input.required<string>();
  /** 'danger': the prominent SOS style. */
  tone = input<UiNavActionTone>('neutral');
  /** A toggle's state (aria-pressed), drawn in the primary fill while true; null: not a toggle. */
  pressed = input<boolean | null>(null);
  /** Press and hold to fire, `UI_NAV_HOLD_MS` (2 s) long (0.47.2); off by default. */
  hold = input(false, { transform: booleanAttribute });
  /** Press and hold this long, in ms, to fire (0.47.2; implies `hold`); null: `hold` decides. */
  holdMs = input<number | null>(null);
  /** What holding does, read with the button; defaults to the built-in holdHint string. */
  holdHint = input<string | undefined>(undefined);
  /** A holding button's tap (and a screen reader's activation): called instead of the confirm dialog (0.47.2). */
  onTap = input<(() => void) | null>(null);
  /** The tap fallback's dialog, when there is no `onTap`. */
  confirmTitle = input<string | undefined>(undefined);
  confirmMessage = input('');
  confirmLabel = input<string | undefined>(undefined);
  /** Style the dialog's confirm button as destructive. */
  destructive = input(false);
  /** A holding button: held to the end, or confirmed in the dialog (0.47.2). */
  readonly confirmed = output<void>();

  /** How long to hold, in ms; null: an ordinary button. */
  readonly holding = computed(() => this.holdMs() ?? (this.hold() ? UI_NAV_HOLD_MS : null));
  protected readonly hintId = `ui-nav-hold-hint-${navHoldSeq++}`;
  /** The ring, 0 to 1, and how long it takes to get there. */
  protected readonly progress = signal(0);
  protected readonly progressMs = signal(0);
  /** A hold is under way (the ring filling). */
  protected readonly held = signal(false);
  /** Reduced motion (read when a hold starts): the ring shows whole and steady instead of filling. */
  protected readonly still = signal(false);
  /** The live region's words: the hold's progress, or that it was let go. */
  protected readonly spoken = signal('');

  private startedAt = 0;
  private finished = false;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private said = 0;
  private dialog: ComponentRef<UiConfirmDialog> | null = null;

  protected readonly press = new UiHoldPress({
    hold: () => this.holding() ?? 0,
    disabled: () => this.el.nativeElement.disabled,
    fill: (p, ms) => this.fill(p, ms),
    openConfirm: () => this.tapped(),
    fire: () => {
      this.finished = true;
      this.stopTicker();
      this.confirmed.emit();
    },
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.press.destroy();
      this.stopTicker();
      this.dialog?.destroy();
    });
    effect(() => {
      if (this.holding() !== null) return;
      untracked(() => this.press.abort());
    });
  }

  /** The pointer slid off the button (captured, so no pointerleave comes): the hold is cancelled. */
  protected moved(e: PointerEvent): void {
    if (!this.press.pressing) return;
    const r = this.el.nativeElement.getBoundingClientRect();
    if (!r.width && !r.height) return;
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.press.up(false);
  }

  private fill(p: number, ms: number): void {
    if (p > 0) {
      // A hold starts: reduced motion is read now, so a change in the settings counts from the next press.
      this.still.set(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
      this.startedAt = performance.now();
      this.finished = false;
      this.said = 0;
      this.spoken.set('');
      this.held.set(true);
      this.stopTicker();
      this.ticker = setInterval(() => this.tick(ms), 100);
    } else if (this.held()) {
      this.stopTicker();
      // Let go before the end after a real try (not a tap, which opens the fallback instead).
      if (!this.finished && performance.now() - this.startedAt >= UI_HOLD_TAP_MS) this.spoken.set(this.strings.holdCancelled);
      this.held.set(false);
    }
    this.progressMs.set(ms);
    this.progress.set(p);
  }

  /** Reads the progress out at each quarter (25, 50, 75 %). */
  private tick(total: number): void {
    const q = Math.min(3, Math.floor(((performance.now() - this.startedAt) / Math.max(1, total)) * 4));
    if (q <= this.said) return;
    this.said = q;
    this.spoken.set(uiFormatString(this.strings.holdProgress, { percent: q * 25 }));
  }

  private stopTicker(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  /** A tap, a quick key press or an assistive activation: the app's onTap, else the confirm dialog. */
  private tapped(): void {
    const tap = this.onTap();
    if (tap) {
      tap();
      return;
    }
    if (!this.dialog) {
      // Beside the button (the modal itself renders on its own layer at the end of <body>).
      const ref = this.vcr.createComponent(UiConfirmDialog);
      ref.instance.confirm.subscribe(() => this.confirmed.emit());
      ref.instance.open.subscribe((open) => {
        if (!open) ref.setInput('open', false);
      });
      this.dialog = ref;
    }
    const d = this.dialog;
    d.setInput('title', this.confirmTitle() ?? this.strings.confirmTitle);
    d.setInput('message', this.confirmMessage());
    d.setInput('confirmLabel', this.confirmLabel() ?? this.strings.confirm);
    d.setInput('cancelLabel', this.strings.cancel);
    d.setInput('destructive', this.destructive());
    d.setInput('open', true);
  }
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
 * - Actions (0.47.1): `<button uiNavAction>` children (`UiNavAction`) stack as 48px round buttons at
 *   the end side under the banner (start in right-to-left text is mirrored), clear of the compass
 *   (inline start) and Recenter (bottom start). `status` ("Rerouting…") shows as a pill under the
 *   banner, announced politely. It wraps to two lines, then ends on a whole word with an ellipsis (0.47.2,
 *   `uiNavFitWords`; screen readers hear the whole text); being outside the measured banner, a taller
 *   pill moves neither the banner, the buttons nor the map. Actions can be held to fire (0.47.2, `hold`).
 * - `insets` (0.47.1): px the app covers along each edge (`{ top, bottom, start, end }`: an app bar
 *   with the status bar under it, a bottom navigation); the banner, actions and bar stay inside
 *   them. The device safe area (notch, status bar, gesture bar) is used wherever it is bigger.
 *
 * Give it a height (it fills it).
 */
@Component({
  selector: 'ui-map-navigation',
  encapsulation: ViewEncapsulation.None,
  imports: [UiMap, HugeiconsIconComponent, UiButton],
  host: {
    class: 'ui-map-navigation', role: 'region', '[attr.aria-label]': 'ariaLabel() ?? strings.navLabel', '[attr.data-glass]': 'glass() || null',
    '[style.--ui-nav-inset-top.px]': 'insets().top ?? 0', '[style.--ui-nav-inset-bottom.px]': 'insets().bottom ?? 0',
    '[style.--ui-nav-inset-start.px]': 'insets().start ?? 0', '[style.--ui-nav-inset-end.px]': 'insets().end ?? 0',
  },
  template: `<ui-map class="ui-nav-map" fill [center]="startCenter()" [zoom]="zoom()" [routes]="lines()" [userLocation]="puck()" [markers]="destination()"
      [bearing]="bearing()" [insets]="mapInsets()" [zoomButtons]="false" [compass]="!following()" [ariaLabel]="mapLabel() ?? strings.mapLabel"
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
    <div class="ui-nav-under" #under>
      <div class="ui-nav-status" role="status" [hidden]="!status()"><span class="ui-nav-status-text" aria-hidden="true" #statusText></span><span class="ui-nav-sr">{{ status() }}</span></div>
      <div class="ui-nav-actions" [attr.data-count]="actions().length"><ng-content select="[uiNavAction]" /></div>
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
  /** A short state under the banner, as a pill ("Rerouting…"), announced politely; null for none (0.47.1). Two lines at most, then whole words and an ellipsis (0.47.2). */
  status = input<string | null>(null);
  /**
   * Px the app covers along each edge (0.47.1): an app bar (with the status bar under it) at the top,
   * a bottom navigation, a side rail. The banner, actions, Recenter and bar stay inside them; the
   * device's safe area counts wherever it is bigger.
   */
  insets = input<UiMapInsets>({});

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
  private readonly injector = inject(Injector);
  private readonly map = viewChild.required(UiMap);
  private readonly top = viewChild.required<ElementRef<HTMLElement>>('top');
  private readonly bar = viewChild.required<ElementRef<HTMLElement>>('bar');
  private readonly under = viewChild.required<ElementRef<HTMLElement>>('under');
  private readonly statusText = viewChild.required<ElementRef<HTMLElement>>('statusText');
  /** The app's buttons (0.47.1). */
  protected readonly actions = contentChildren(UiNavAction);

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
  /** The map's insets: the follow point's top and bottom, and the app's sides (the compass keeps clear of a side rail). */
  protected readonly mapInsets = computed<UiMapInsets>(() => {
    const s = this.size();
    const app = this.insets();
    return { ...(s.height ? uiNavFollowInsets(s.height, s.top, s.bottom) : {}), start: app.start ?? 0, end: app.end ?? 0 };
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
    // New insets move the banner without resizing it (no ResizeObserver call): measure again (0.47.1).
    effect(() => {
      this.insets();
      untracked(() => afterNextRender(() => this.measure(), { injector: this.injector }));
    });
    // The status pill's words (0.47.2): fitted to two lines when it changes, the view's width changes or a
    // font arrives (Faruma's Thaana is wider than the fallback).
    effect(() => {
      this.status();
      untracked(() => afterNextRender(() => this.fitStatus(), { injector: this.injector }));
    });
    afterNextRender(() => {
      const measure = () => this.measure();
      measure();
      (globalThis.document as Document | undefined)?.fonts?.ready.then(() => this.fitStatus()).catch(() => undefined);
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(measure);
      ro.observe(this.host.nativeElement);
      ro.observe(this.top().nativeElement);
      ro.observe(this.bar().nativeElement);
      // The block under the banner sizes with the view, never with the pill's text: no loop.
      const fit = new ResizeObserver(() => this.fitStatus());
      fit.observe(this.under().nativeElement);
      destroy.onDestroy(() => {
        ro.disconnect();
        fit.disconnect();
      });
    });
  }

  /** Measures the banner and bar: the follow point, Recenter's and the button stack's places. */
  private measure(): void {
    const height = this.host.nativeElement.clientHeight;
    const top = this.top().nativeElement.offsetHeight + this.top().nativeElement.offsetTop;
    // The bar's top from the bottom: its height plus the app's bottom inset (0.47.1).
    const barEl = this.bar().nativeElement;
    const bottom = height ? Math.max(barEl.offsetHeight, height - barEl.offsetTop) : barEl.offsetHeight;
    const now = this.size();
    if (now.height !== height || now.top !== top || now.bottom !== bottom) this.size.set({ height, top, bottom });
    this.host.nativeElement.style.setProperty('--ui-nav-bar-height', `${bottom}px`);
    this.host.nativeElement.style.setProperty('--ui-nav-top-bottom', `${top}px`);
  }


  /**
   * Fits the status into the pill's two lines (0.47.2): the whole text when it fits, else whole words and an
   * ellipsis (uiNavFitWords), measured in the pill itself (line-clamped, so a taller text scrolls). The full
   * text is what screen readers hear. Without layout (hidden, or no CSS) the text is left whole.
   */
  private fitStatus(): void {
    const el = this.statusText().nativeElement;
    const text = this.status() ?? '';
    el.textContent = text;
    if (!text || !el.clientHeight) return;
    const fits = (candidate: string) => {
      el.textContent = candidate;
      return el.scrollHeight <= el.clientHeight + 1;
    };
    el.textContent = uiNavFitWords(text, fits);
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
