import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { clampOffset, isSwipe, resist } from './gestures';

/** One thing in the lightbox: a photograph or a clip. */
export interface UiMediaItem {
  /** The full-size image, or the playable video. */
  src: string;
  /** A still: the filmstrip's tile, and a clip's poster frame while it loads. */
  thumb?: string;
  /** Which of the two this is. Images are the common case, so that is the default. */
  kind?: 'image' | 'video';
  /** Alternative text for the image. A clip is announced by its caption instead. */
  alt?: string;
  /** The line the chrome shows above the counter — whose it is, when it was taken, anything. */
  caption?: string;
}

/**
 * A button in the lightbox's top bar. `href` makes it a link — which is how a download stays a
 * download rather than something the host has to synthesise from a click.
 */
export interface UiMediaAction {
  id: string;
  label: string;
  /** Destructive actions are set apart and drawn in red. */
  tone?: 'default' | 'danger';
  /** Offered only for the items it applies to — someone else's photograph is not yours to remove. */
  when?: (item: UiMediaItem, index: number) => boolean;
  /** Renders an anchor instead of a button. */
  href?: (item: UiMediaItem, index: number) => string;
  /** The `download` attribute for that anchor: a file name, or `''` to just ask for a save. */
  download?: (item: UiMediaItem, index: number) => string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

/** How far the sheet must be dragged down before letting go closes it. */
const DISMISS_DISTANCE = 110;
/** How far a pointer may travel and still count as a tap rather than a drag. */
const TAP_SLOP = 6;
/** How long the chrome stays up once a clip is playing and nothing has moved. */
const IDLE_MS = 2600;
/** What a seek key is worth. */
const SEEK_STEP = 10;

function fmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * `ui-media-lightbox` — photographs and clips at full screen, the way a phone's own gallery shows
 * them: edge to edge, over everything, with the chrome floating on top and getting out of the way.
 *
 * <p>It is a native `<dialog>` opened with `showModal`, which buys three things that are otherwise
 * fragile at this size: the top layer, so no ancestor's `overflow`, `transform` or z-index can clip
 * or bury it — a lightbox nested inside a card or a tab panel is exactly where a `position: fixed`
 * overlay goes wrong; a focus trap; and Escape, for free.</p>
 *
 * <p>The host owns the list and the position in it. {@link items} is what there is, {@link index} is
 * where you are, and both a swipe and the arrows just move that number — so a photo deleted from
 * under the lightbox, or a list that grows while it is open, needs nothing from here.</p>
 *
 * <p>Gestures are ours rather than the browser's (`touch-action: none` on the stage), because a
 * pinch the browser claims first would zoom the page instead of the picture. Which is also why the
 * clip uses our controls rather than the platform's: the native scrubber lives inside a shadow root
 * whose drags are indistinguishable from a swipe across the picture, and scrubbing would jump to the
 * next video.</p>
 */
@Component({
  selector: 'ui-media-lightbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      class="lb"
      [attr.aria-label]="label() || 'Media viewer'"
      (cancel)="onCancel($event)"
      (close)="open.set(false)"
      (keydown)="onKey($event)"
    >
      @if (open() && current(); as item) {
        <div
          class="sheet"
          [class.sheet--bare]="!chrome()"
          [style.--lb-drag.px]="drag()"
          [style.--lb-veil]="veil()"
        >
          <!-- The picture sits under the chrome rather than beside it: at this size every pixel of
               the screen is the photograph, and the bars are scrims over the top and bottom of it. -->
          <div
            #stage
            class="stage"
            [class.stage--grab]="pannable()"
            (pointerdown)="onDown($event)"
            (pointermove)="onMove($event)"
            (pointerup)="onUp($event)"
            (pointercancel)="onUp($event)"
            (wheel)="onWheel($event)"
            (dblclick)="toggleZoom()"
          >
            @if (isVideo()) {
              <video
                #clip
                class="media"
                [src]="item.src"
                [poster]="item.thumb || ''"
                playsinline
                preload="metadata"
                [style.transform]="transform()"
                [class.settling]="!interacting()"
                (loadedmetadata)="onMeta()"
                (loadeddata)="onClipReady()"
                (timeupdate)="onTime()"
                (progress)="onBuffered()"
                (waiting)="loading.set(true)"
                (playing)="onPlaying()"
                (play)="playing.set(true)"
                (pause)="playing.set(false)"
                (ended)="onEnded()"
              ></video>
            } @else {
              <img
                #img
                class="media"
                [src]="item.src"
                [alt]="item.alt || ''"
                draggable="false"
                [style.transform]="transform()"
                [class.settling]="!interacting()"
                (load)="onLoaded()"
                (error)="loading.set(false)"
              />
            }

            @if (loading()) {
              <span class="spin" aria-hidden="true"></span>
            }

            <!-- The one control that is not chrome: a paused clip should say so in the middle of
                 itself, not in a bar that has faded out. -->
            @if (isVideo() && !playing() && !loading()) {
              <button type="button" class="play" aria-label="Play" (click)="togglePlay()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
              </button>
            }
          </div>

          <header class="bar bar--top">
            <div class="meta">
              @if (item.caption || label(); as line) {
                <span class="meta__line">{{ line }}</span>
              }
              @if (items().length > 1) {
                <span class="meta__count">{{ index() + 1 }} of {{ items().length }}</span>
              }
            </div>

            <div class="acts">
              @if (zoomed()) {
                <button type="button" class="chip" (click)="resetView()">
                  {{ zoomPercent() }}% · Fit
                </button>
              }
              <ng-content select="[lightbox-actions]" />
              @for (action of visibleActions(); track action.id) {
                @if (action.href) {
                  <a
                    class="act"
                    [class.act--danger]="action.tone === 'danger'"
                    [href]="action.href(item, index())"
                    [attr.download]="action.download ? action.download(item, index()) : null"
                    target="_blank"
                    rel="noopener"
                    (click)="fire(action)"
                    >{{ action.label }}</a
                  >
                } @else {
                  <button
                    type="button"
                    class="act"
                    [class.act--danger]="action.tone === 'danger'"
                    (click)="fire(action)"
                  >
                    {{ action.label }}
                  </button>
                }
              }
              <button type="button" class="ic ic--x" aria-label="Close" (click)="close()">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </header>

          <!-- Pointer-fine only. On a phone the same move is the swipe, and an arrow parked over the
               picture would just be something to hit by accident. -->
          @if (items().length > 1) {
            <button
              type="button"
              class="edge edge--prev"
              aria-label="Previous"
              [disabled]="!hasPrevious()"
              (click)="step(-1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <button
              type="button"
              class="edge edge--next"
              aria-label="Next"
              [disabled]="!hasNext()"
              (click)="step(1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          }

          <footer class="bar bar--bottom">
            @if (isVideo()) {
              <div class="vc">
                <button
                  type="button"
                  class="ic"
                  [attr.aria-label]="playing() ? 'Pause' : 'Play'"
                  (click)="togglePlay()"
                >
                  @if (playing()) {
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 5v14M15 5v14" />
                    </svg>
                  } @else {
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
                  }
                </button>

                <span class="time">{{ elapsed() }}</span>

                <!-- Three layers, one control: what has loaded, what has played, and a transparent
                     range on top that keeps the keyboard and the screen reader working. -->
                <div class="scrub">
                  <span class="scrub__track"></span>
                  <span class="scrub__load" [style.width.%]="bufferedPercent()"></span>
                  <span class="scrub__fill" [style.width.%]="playedPercent()"></span>
                  <span class="scrub__knob" [style.left.%]="playedPercent()"></span>
                  <input
                    class="scrub__input"
                    type="range"
                    min="0"
                    [max]="duration() || 0"
                    step="0.05"
                    [value]="time()"
                    aria-label="Seek"
                    (input)="seekTo($event)"
                  />
                </div>

                <span class="time">{{ total() }}</span>

                <button
                  type="button"
                  class="ic"
                  [attr.aria-label]="muted() ? 'Unmute' : 'Mute'"
                  (click)="toggleMute()"
                >
                  @if (muted()) {
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 9v6h4l5 4V5L8 9H4zM17 9l4 6M21 9l-4 6" />
                    </svg>
                  } @else {
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 9v6h4l5 4V5L8 9H4zM17 8a5 5 0 010 8" />
                    </svg>
                  }
                </button>

                <input
                  class="vol"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  [value]="muted() ? 0 : volume()"
                  aria-label="Volume"
                  (input)="setVolume($event)"
                />

                <button type="button" class="ic ic--rate" aria-label="Playback speed" (click)="cycleRate()">
                  {{ rate() }}×
                </button>

                <button
                  type="button"
                  class="ic"
                  [attr.aria-label]="fullscreen() ? 'Exit full screen' : 'Full screen'"
                  (click)="toggleFullscreen()"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                  </svg>
                </button>
              </div>
            }

            @if (items().length > 1) {
              <div #strip class="strip" aria-label="Everything in this set">
                @for (thing of items(); track $index) {
                  <button
                    type="button"
                    class="strip__item"
                    [attr.data-at]="$index"
                    [class.strip__item--on]="$index === index()"
                    [attr.aria-current]="$index === index() ? 'true' : null"
                    [attr.aria-label]="thing.caption || 'Item ' + ($index + 1)"
                    (click)="goTo($index)"
                  >
                    <img [src]="thing.thumb || thing.src" alt="" loading="lazy" decoding="async" />
                    @if (thing.kind === 'video') {
                      <span class="strip__play" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg>
                      </span>
                    }
                  </button>
                }
              </div>
            }
          </footer>
        </div>
      }
    </dialog>
  `,
  styles: `
    :host { display: contents; }

    /* The dialog IS the screen. Its own box is stripped back to nothing so the sheet inside can
       paint the whole of it — the default dialog is a centred, bordered, padded card. */
    .lb { width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; margin: 0; padding: 0;
      border: 0; background: transparent; color: #fff; overflow: hidden;
      font-family: var(--ui-font-default, system-ui, sans-serif); }
    .lb::backdrop { background: rgba(6, 7, 10, 0.86); backdrop-filter: blur(18px) saturate(120%); }
    .lb:not([open]) { display: none; }

    /* --lb-drag is how far a dismissing drag has come, --lb-veil how much of the dark is left. Both
       are set from the gesture so the whole sheet moves and fades as one thing. */
    .sheet { position: relative; width: 100%; height: 100%; overflow: hidden;
      background: rgba(6, 7, 10, calc(0.92 * var(--lb-veil, 1)));
      transform: translateY(var(--lb-drag, 0px)) scale(calc(1 - 0.06 * (1 - var(--lb-veil, 1))));
      transform-origin: 50% 40%; }
    /* Opacity here, scale on the stage: the sheet's transform belongs to the dismiss drag, and an
       entrance animation that also wrote it would fight the finger for the first frames. */
    .lb[open] .sheet { animation: lb-fade var(--ui-motion-base, 200ms) var(--ui-ease-decelerate, ease-out); }
    .lb[open] .stage { animation: lb-rise var(--ui-motion-base, 200ms) var(--ui-ease-decelerate, ease-out); }
    @keyframes lb-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes lb-rise { from { transform: scale(0.94); } to { transform: none; } }

    .stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      touch-action: none; overflow: hidden; }
    .stage--grab { cursor: grab; }
    .stage--grab:active { cursor: grabbing; }
    .media { max-width: 100%; max-height: 100%; object-fit: contain; user-select: none;
      -webkit-user-drag: none; will-change: transform; }
    /* Only eases back to rest — a transition mid-pinch makes the picture lag the fingers. */
    .media.settling { transition: transform var(--ui-motion-fast, 120ms) var(--ui-ease-standard, ease-out); }

    .spin { position: absolute; width: 34px; height: 34px; border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.22); border-top-color: #fff;
      animation: lb-spin 700ms linear infinite; }
    @keyframes lb-spin { to { transform: rotate(360deg); } }

    .play { position: absolute; width: 84px; height: 84px; border-radius: 50%; border: 0; cursor: pointer;
      display: grid; place-items: center; color: #fff;
      background: rgba(255, 255, 255, 0.16); backdrop-filter: blur(14px);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
      transition: transform var(--ui-motion-fast, 120ms) var(--ui-ease-spring, ease-out),
        background var(--ui-motion-base, 200ms) var(--ui-ease-standard, ease); }
    .play svg { width: 38px; height: 38px; fill: currentColor; margin-left: 4px; }
    .play:hover { background: rgba(255, 255, 255, 0.26); transform: scale(1.05); }
    .play:active { transform: scale(0.96); }

    /* Scrims, not bars: the picture runs under them, and they only darken enough to keep white text
       legible over whatever happens to be behind it. */
    .bar { position: absolute; left: 0; right: 0; display: flex; z-index: 2;
      padding: max(var(--ui-space-3, 12px), env(safe-area-inset-top)) var(--ui-space-4, 16px)
        var(--ui-space-3, 12px);
      transition: opacity var(--ui-motion-base, 200ms) var(--ui-ease-standard, ease),
        transform var(--ui-motion-base, 200ms) var(--ui-ease-standard, ease); }
    /* Two stops rather than one: a single linear fade is already half transparent where the text
       and the controls actually sit, which over a bright photograph is where white stops being
       legible. The dark is held through the band the chrome occupies and only then let go. */
    .bar--top { top: 0; align-items: flex-start; justify-content: space-between; gap: var(--ui-space-3, 12px);
      background: linear-gradient(to bottom, rgba(0, 0, 0, 0.78) 0%, rgba(0, 0, 0, 0.5) 55%, rgba(0, 0, 0, 0) 100%); }
    .bar--bottom { bottom: 0; flex-direction: column; gap: var(--ui-space-3, 12px);
      padding-bottom: max(var(--ui-space-3, 12px), env(safe-area-inset-bottom));
      background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.62) 55%, rgba(0, 0, 0, 0) 100%); }
    /* Faded out, and unclickable with it — chrome you cannot see must not be chrome you can press. */
    .sheet--bare .bar { opacity: 0; pointer-events: none; }
    .sheet--bare .bar--top { transform: translateY(-8px); }
    .sheet--bare .bar--bottom { transform: translateY(8px); }
    .sheet--bare .edge { opacity: 0; pointer-events: none; }
    .sheet--bare .stage { cursor: none; }

    .meta { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .meta__line { font-size: var(--ui-font-size-sm, 14px); font-weight: 600; letter-spacing: 0.01em;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      text-shadow: 0 1px 12px rgba(0, 0, 0, 0.6); }
    .meta__count { font-size: 12px; color: rgba(255, 255, 255, 0.66); font-variant-numeric: tabular-nums; }

    .acts { display: flex; align-items: center; gap: var(--ui-space-2, 8px); flex: none; }

    /* One glass treatment for everything that floats over the picture. */
    .act, .ic, .chip, .edge {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      border: 1px solid rgba(255, 255, 255, 0.16); background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(14px); color: #fff; cursor: pointer; text-decoration: none;
      font-family: inherit; font-size: 13px; line-height: 1;
      transition: background var(--ui-motion-base, 200ms) var(--ui-ease-standard, ease),
        transform var(--ui-motion-fast, 120ms) var(--ui-ease-standard, ease),
        opacity var(--ui-motion-base, 200ms) var(--ui-ease-standard, ease); }
    .act, .chip { height: 34px; padding: 0 14px; border-radius: var(--ui-radius-pill, 9999px); }
    .ic { width: 38px; height: 38px; border-radius: 50%; padding: 0; }
    .ic--rate { width: auto; padding: 0 10px; border-radius: var(--ui-radius-pill, 9999px);
      font-variant-numeric: tabular-nums; }
    .ic svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.9;
      stroke-linecap: round; stroke-linejoin: round; }
    .ic--x svg { stroke-width: 2.1; }
    .act:hover, .ic:hover, .chip:hover, .edge:hover:not(:disabled) { background: rgba(255, 255, 255, 0.22); }
    .act:active, .ic:active, .chip:active { transform: scale(var(--ui-scale-press, 0.97)); }
    .act--danger { color: #ff8b8b; border-color: rgba(255, 139, 139, 0.35); background: rgba(255, 80, 80, 0.14); }
    .act--danger:hover { background: rgba(255, 80, 80, 0.26); }
    .act:focus-visible, .ic:focus-visible, .chip:focus-visible, .edge:focus-visible,
    .strip__item:focus-visible, .scrub__input:focus-visible, .vol:focus-visible, .play:focus-visible {
      outline: 2px solid #fff; outline-offset: 2px; }

    .edge { position: absolute; top: 50%; margin-top: -24px; width: 48px; height: 48px; border-radius: 50%;
      z-index: 2; }
    .edge svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2;
      stroke-linecap: round; stroke-linejoin: round; }
    .edge--prev { left: var(--ui-space-4, 16px); }
    .edge--next { right: var(--ui-space-4, 16px); }
    .edge:disabled { opacity: 0.25; cursor: default; }
    /* A swipe is the gesture on touch, and an arrow under the thumb is only something to hit by
       mistake. Hover-capable pointers get the arrows; the rest get the picture. */
    @media (hover: none), (max-width: 640px) { .edge { display: none; } }

    .vc { display: flex; align-items: center; gap: var(--ui-space-2, 8px); min-width: 0; }
    .time { font-size: 12px; font-variant-numeric: tabular-nums; color: rgba(255, 255, 255, 0.8);
      min-width: 42px; text-align: center; }

    .scrub { position: relative; flex: 1; height: 26px; display: flex; align-items: center; min-width: 60px; }
    .scrub__track, .scrub__load, .scrub__fill { position: absolute; left: 0; height: 4px; border-radius: 999px;
      transition: height var(--ui-motion-fast, 120ms) var(--ui-ease-standard, ease); }
    .scrub__track { right: 0; background: rgba(255, 255, 255, 0.24); }
    .scrub__load { background: rgba(255, 255, 255, 0.38); }
    .scrub__fill { background: #fff; }
    .scrub__knob { position: absolute; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%;
      background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5); opacity: 0; transform: scale(0.6);
      transition: opacity var(--ui-motion-fast, 120ms) ease, transform var(--ui-motion-fast, 120ms) ease; }
    .scrub:hover .scrub__track, .scrub:hover .scrub__load, .scrub:hover .scrub__fill { height: 6px; }
    .scrub:hover .scrub__knob, .scrub:focus-within .scrub__knob { opacity: 1; transform: scale(1); }
    /* The real control, invisible over the drawn one: the platform keeps the keyboard steps, the
       ARIA role and the value announcements that a div could only imitate. */
    .scrub__input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0;
      cursor: pointer; }

    .vol { width: 76px; accent-color: #fff; cursor: pointer; flex: none; }
    /* No room for it on a phone, and nothing to point at it with either: the hardware keys are the
       volume control there. The width test matters as well as the hover one — a narrow window on a
       desktop has the same problem and none of the same excuse. */
    @media (hover: none), (max-width: 560px) { .vol { display: none; } }

    .strip { display: flex; gap: var(--ui-space-2, 8px); overflow-x: auto; scrollbar-width: none;
      padding: 2px; }
    .strip::-webkit-scrollbar { display: none; }
    .strip__item { position: relative; flex: 0 0 auto; width: 54px; height: 54px; padding: 0; border: 0;
      border-radius: var(--ui-radius-sm, 8px); overflow: hidden; cursor: pointer; background: rgba(255, 255, 255, 0.08);
      opacity: 0.5; transition: opacity var(--ui-motion-base, 200ms) var(--ui-ease-standard, ease),
        transform var(--ui-motion-base, 200ms) var(--ui-ease-standard, ease),
        box-shadow var(--ui-motion-base, 200ms) var(--ui-ease-standard, ease); }
    .strip__item img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .strip__item:hover { opacity: 0.8; }
    .strip__item--on { opacity: 1; transform: translateY(-3px); box-shadow: 0 0 0 2px #fff, 0 6px 18px rgba(0, 0, 0, 0.5); }
    .strip__play { position: absolute; inset: 0; display: grid; place-items: center;
      background: rgba(0, 0, 0, 0.28); }
    .strip__play svg { width: 16px; height: 16px; fill: #fff; }

    @media (prefers-reduced-motion: reduce) {
      .lb[open] .sheet, .lb[open] .stage { animation: none; }
      .media.settling, .bar, .strip__item, .act, .ic, .chip, .edge, .play { transition: none; }
      .spin { animation-duration: 1400ms; }
    }
  `,
})
export class UiMediaLightbox {
  /** Everything the lightbox can show, in the order the host wants it stepped through. */
  items = input<readonly UiMediaItem[]>([]);

  /**
   * Where in that list the viewer is. Two-way: a swipe, an arrow key, the filmstrip and the host all
   * move the same number, so nothing has to be kept in step by hand.
   */
  index = model(0);

  /** Whether the lightbox is up. Setting it false closes; Escape and the close button set it false. */
  open = model(false);

  /** What the set is called, shown when an item has no caption of its own. */
  label = input('');

  /** Buttons for the top bar — download, remove, whatever the host offers. */
  actions = input<readonly UiMediaAction[]>([]);

  /** One of those buttons was pressed, with the item it was pressed over. */
  action = output<{ id: string; item: UiMediaItem; index: number }>();

  /** The lightbox closed, however it was closed. */
  closed = output<void>();

  private readonly dlg = viewChild<ElementRef<HTMLDialogElement>>('dlg');
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly img = viewChild<ElementRef<HTMLImageElement>>('img');
  private readonly clip = viewChild<ElementRef<HTMLVideoElement>>('clip');
  private readonly strip = viewChild<ElementRef<HTMLElement>>('strip');

  protected readonly current = computed(() => this.items()[this.index()]);
  protected readonly isVideo = computed(() => this.current()?.kind === 'video');
  protected readonly hasPrevious = computed(() => this.index() > 0);
  protected readonly hasNext = computed(() => this.index() < this.items().length - 1);

  protected readonly loading = signal(true);

  /** Zoom and pan, for images. A clip is watched, not read: it stays fitted. */
  protected readonly zoom = signal(1);
  protected readonly offset = signal({ x: 0, y: 0 });
  protected readonly interacting = signal(false);
  protected readonly zoomed = computed(() => this.zoom() > 1);
  protected readonly pannable = computed(() => !this.isVideo() && this.zoomed());
  protected readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

  /** Live travel of the current drag: sideways is a swipe, down is a dismiss. */
  protected readonly swipe = signal(0);
  protected readonly drag = signal(0);
  /** 1 is fully dark; a dismissing drag fades the whole sheet toward the page underneath. */
  protected readonly veil = computed(() =>
    Math.max(0, 1 - Math.abs(this.drag()) / (DISMISS_DISTANCE * 2.2)),
  );

  protected readonly transform = computed(() => {
    const o = this.offset();
    return `translate(${o.x + this.swipe()}px, ${o.y}px) scale(${this.zoom()})`;
  });

  /** Whether the bars are up. They only ever hide over a playing clip — see {@link wake}. */
  protected readonly chrome = signal(true);
  private idle?: ReturnType<typeof setTimeout>;

  protected readonly playing = signal(false);
  protected readonly time = signal(0);
  protected readonly duration = signal(0);
  protected readonly buffered = signal(0);
  protected readonly volume = signal(1);
  protected readonly muted = signal(false);
  protected readonly rate = signal(1);
  protected readonly fullscreen = signal(false);

  protected readonly elapsed = computed(() => fmt(this.time()));
  protected readonly total = computed(() => fmt(this.duration()));
  protected readonly playedPercent = computed(() =>
    this.duration() > 0 ? Math.min(100, (this.time() / this.duration()) * 100) : 0,
  );
  protected readonly bufferedPercent = computed(() =>
    this.duration() > 0 ? Math.min(100, (this.buffered() / this.duration()) * 100) : 0,
  );

  protected readonly visibleActions = computed(() => {
    const item = this.current();
    if (!item) return [];
    const at = this.index();
    return this.actions().filter((a) => !a.when || a.when(item, at));
  });

  /** Live pointers, by id. Two of them is a pinch rather than a drag. */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchFrom = 0;
  private pinchZoom = 1;
  private from: { x: number; y: number; at: number } | null = null;
  private moved = 0;

  private readonly onFullscreen = () => this.fullscreen.set(!!document.fullscreenElement);

  constructor() {
    const destroy = inject(DestroyRef);
    // Rendered on a server there is no document to listen to, and nothing to listen for.
    const browser = typeof document !== 'undefined';
    if (browser) document.addEventListener('fullscreenchange', this.onFullscreen);
    destroy.onDestroy(() => {
      if (browser) document.removeEventListener('fullscreenchange', this.onFullscreen);
      clearTimeout(this.idle);
    });

    // Opening and closing the real dialog. showModal is what puts it in the top layer, and the top
    // layer is the whole reason this is a <dialog>: nothing an ancestor does can clip or bury it.
    effect(() => {
      const el = this.dlg()?.nativeElement;
      if (!el) return;
      // showModal/close are what an engine WITH a real dialog gives us; the `open` property is the
      // same state without the top layer, and is all jsdom and very old engines have.
      if (this.open()) {
        if (!el.open) {
          if (typeof el.showModal === 'function') el.showModal();
          else el.open = true;
        }
      } else if (el.open) {
        if (typeof el.close === 'function') el.close();
        else el.open = false;
      }
    });

    // A new item is a new view: the last one's zoom, pan and half-finished drag belong to it, not
    // to this one.
    effect(() => {
      this.index();
      this.open();
      untracked(() => {
        this.resetView();
        this.loading.set(true);
        this.time.set(0);
        this.buffered.set(0);
        this.wake();
        this.scrollStripIntoView();
        this.preloadNeighbours();
      });
    });

    // Closing hands the screen back: a clip left playing behind a closed lightbox is a voice in an
    // empty room, and a full-screen viewer that stays full screen has stolen the browser.
    effect(() => {
      if (this.open()) return;
      untracked(() => {
        this.clip()?.nativeElement.pause();
        this.playing.set(false);
        if (typeof document !== 'undefined' && document.fullscreenElement) document.exitFullscreen?.();
      });
    });
  }

  protected close(): void {
    this.open.set(false);
    this.closed.emit();
  }

  /** Escape reaches the dialog itself, so it is answered here rather than by the browser closing it. */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  protected goTo(at: number): void {
    if (at >= 0 && at < this.items().length) this.index.set(at);
  }

  protected step(by: -1 | 1): void {
    this.goTo(this.index() + by);
  }

  protected fire(action: UiMediaAction): void {
    const item = this.current();
    if (item) this.action.emit({ id: action.id, item, index: this.index() });
  }

  // ---- the view ------------------------------------------------------------------------------

  protected resetView(): void {
    this.zoom.set(1);
    this.offset.set({ x: 0, y: 0 });
    this.swipe.set(0);
    this.drag.set(0);
  }

  protected onLoaded(): void {
    this.loading.set(false);
  }

  /**
   * A clip opened on purpose is a clip somebody wants to watch, so it starts itself. Autoplay with
   * sound is refused by some browsers however it was reached — hence the catch, and the big play
   * button that is already there for exactly that outcome.
   */
  protected onClipReady(): void {
    this.loading.set(false);
    const video = this.clip()?.nativeElement;
    if (video?.paused && this.open()) video.play().catch(() => undefined);
  }

  protected toggleZoom(): void {
    if (this.isVideo()) return;
    if (this.zoomed()) this.resetView();
    else this.setZoom(2.5);
  }

  private setZoom(next: number): void {
    this.zoom.set(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +next.toFixed(3))));
    this.offset.update((o) => this.clamp(o));
  }

  private clamp(o: { x: number; y: number }): { x: number; y: number } {
    const stage = this.stage()?.nativeElement;
    const img = this.img()?.nativeElement;
    if (!stage || !img) return o;
    return clampOffset(
      o,
      { width: img.clientWidth, height: img.clientHeight },
      { width: stage.clientWidth, height: stage.clientHeight },
      this.zoom(),
    );
  }

  protected onWheel(event: WheelEvent): void {
    this.wake();
    if (this.isVideo()) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      this.setZoom(this.zoom() * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
      return;
    }
    if (!this.zoomed()) return;
    const before = this.offset();
    const after = this.clamp({ x: before.x - event.deltaX, y: before.y - event.deltaY });
    if (after.x !== before.x || after.y !== before.y) {
      event.preventDefault();
      this.offset.set(after);
    }
  }

  // ---- gestures ------------------------------------------------------------------------------

  protected onDown(event: PointerEvent): void {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.wake();

    if (this.pointers.size === 1) {
      this.from = { x: event.clientX, y: event.clientY, at: event.timeStamp };
      this.moved = 0;
    }
    if (this.pointers.size === 2) {
      // A pinch is not a half-finished swipe: drop the candidate rather than let the release read
      // as a flick.
      this.pinchFrom = this.spread();
      this.pinchZoom = this.zoom();
      this.from = null;
      this.swipe.set(0);
      this.drag.set(0);
    }
    this.interacting.set(true);
  }

  protected onMove(event: PointerEvent): void {
    // Any movement at all brings hidden chrome back — including a mouse moving with nothing held,
    // which is the only way a desktop viewer asks for the controls again.
    if (!this.chrome()) this.wake();
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size >= 2) {
      if (!this.isVideo() && this.pinchFrom > 0) {
        this.setZoom(this.pinchZoom * (this.spread() / this.pinchFrom));
      }
      return;
    }

    // A zoomed image is being read, not browsed: the drag pans it, and only back at fit does the
    // same gesture mean "show me the next one". Both at once and neither works.
    if (this.pannable()) {
      this.offset.update((o) =>
        this.clamp({
          x: o.x + (event.clientX - previous.x),
          y: o.y + (event.clientY - previous.y),
        }),
      );
      return;
    }

    const from = this.from;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    this.moved = Math.max(this.moved, Math.hypot(dx, dy));

    // Sideways is the gallery, down is the way out — whichever the drag is mostly doing wins, so a
    // gesture never does half of each.
    if (Math.abs(dx) > Math.abs(dy)) {
      this.drag.set(0);
      const blocked = dx > 0 ? !this.hasPrevious() : !this.hasNext();
      this.swipe.set(resist(dx, this.stage()?.nativeElement.clientWidth ?? 0, blocked));
    } else {
      this.swipe.set(0);
      this.drag.set(Math.max(0, dy));
    }
  }

  protected onUp(event: PointerEvent): void {
    (event.target as Element).releasePointerCapture?.(event.pointerId);
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchFrom = 0;
    if (this.pointers.size > 0) return;

    this.interacting.set(false);
    const from = this.from;
    const dx = this.swipe();
    const down = this.drag();
    this.from = null;
    this.swipe.set(0);
    this.drag.set(0);

    if (!from) return;

    // Barely moved: that was a tap, and what a tap means depends on what is under it.
    if (this.moved <= TAP_SLOP) {
      this.onTap(event);
      return;
    }

    if (down >= DISMISS_DISTANCE) {
      this.close();
      return;
    }
    if (!dx) return;

    const width = this.stage()?.nativeElement.clientWidth ?? 0;
    const dy = event.clientY - from.y;
    if (!isSwipe(dx, dy, event.timeStamp - from.at, width)) return;
    if (dx < 0 && this.hasNext()) this.step(1);
    else if (dx > 0 && this.hasPrevious()) this.step(-1);
  }

  /**
   * A tap on the picture: play or pause a clip, and on a photograph nothing — the dark around it is
   * the way out, which is where a tap closes.
   */
  private onTap(event: PointerEvent): void {
    const onMedia = (event.target as Element)?.classList?.contains('media');
    if (!onMedia) {
      this.close();
      return;
    }
    if (this.isVideo()) this.togglePlay();
    else if (event.pointerType !== 'mouse') this.chrome.update((up) => !up);
  }

  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  // ---- chrome --------------------------------------------------------------------------------

  /**
   * Shows the bars and starts the clock on hiding them again.
   *
   * <p>They only ever hide over a playing clip. A photograph with no chrome is a photograph with no
   * way out — nothing on screen says how to close it — whereas a clip mid-play is exactly when the
   * bars are in the way, and any movement brings them straight back.</p>
   */
  protected wake(): void {
    this.chrome.set(true);
    clearTimeout(this.idle);
    if (this.isVideo() && this.playing()) {
      this.idle = setTimeout(() => this.chrome.set(false), IDLE_MS);
    }
  }

  // ---- the clip ------------------------------------------------------------------------------

  protected togglePlay(): void {
    const video = this.clip()?.nativeElement;
    if (!video) return;
    if (video.paused) {
      // Autoplay policies reject this when the gesture is not counted; the big play button is
      // already the fallback, so a refusal needs nothing beyond not throwing.
      video.play().catch(() => this.playing.set(false));
    } else {
      video.pause();
    }
  }

  protected onMeta(): void {
    const video = this.clip()?.nativeElement;
    if (!video) return;
    this.duration.set(video.duration);
    video.playbackRate = this.rate();
    video.volume = this.volume();
    video.muted = this.muted();
  }

  protected onTime(): void {
    const video = this.clip()?.nativeElement;
    if (video) this.time.set(video.currentTime);
  }

  protected onBuffered(): void {
    const video = this.clip()?.nativeElement;
    if (!video || video.buffered.length === 0) return;
    this.buffered.set(video.buffered.end(video.buffered.length - 1));
  }

  /** A clip that has run out leaves nothing on screen to press, so the chrome comes back with it. */
  protected onEnded(): void {
    this.playing.set(false);
    this.wake();
  }

  protected onPlaying(): void {
    this.loading.set(false);
    this.playing.set(true);
    this.wake();
  }

  protected seekTo(event: Event): void {
    const to = Number((event.target as HTMLInputElement).value);
    const video = this.clip()?.nativeElement;
    if (video) video.currentTime = to;
    this.time.set(to);
    this.wake();
  }

  private seekBy(seconds: number): void {
    const video = this.clip()?.nativeElement;
    if (!video) return;
    video.currentTime = Math.min(
      video.duration || Infinity,
      Math.max(0, video.currentTime + seconds),
    );
    this.wake();
  }

  protected setVolume(event: Event): void {
    const to = Number((event.target as HTMLInputElement).value);
    const video = this.clip()?.nativeElement;
    this.volume.set(to);
    // Dragging the slider off zero is how people unmute; making them press mute as well is a
    // control that ignores what was just asked of it.
    this.muted.set(to === 0);
    if (video) {
      video.volume = to;
      video.muted = to === 0;
    }
    this.wake();
  }

  protected toggleMute(): void {
    const video = this.clip()?.nativeElement;
    const next = !this.muted();
    this.muted.set(next);
    if (video) video.muted = next;
    this.wake();
  }

  protected cycleRate(): void {
    const rates = [1, 1.5, 2, 0.5];
    const next = rates[(rates.indexOf(this.rate()) + 1) % rates.length];
    this.rate.set(next);
    const video = this.clip()?.nativeElement;
    if (video) video.playbackRate = next;
    this.wake();
  }

  protected toggleFullscreen(): void {
    const el = this.dlg()?.nativeElement;
    if (!el || typeof document === 'undefined') return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => undefined);
  }

  // ---- keyboard ------------------------------------------------------------------------------

  protected onKey(event: KeyboardEvent): void {
    this.wake();
    // Typing into the scrubber or the volume slider is the platform's business, not ours: their own
    // arrow keys seek and set the volume, and stealing those would break the accessible control.
    const onSlider = (event.target as HTMLElement)?.tagName === 'INPUT';

    switch (event.key) {
      case 'ArrowRight':
        if (onSlider) return;
        if (event.shiftKey && this.isVideo()) this.seekBy(SEEK_STEP);
        else this.step(1);
        break;
      case 'ArrowLeft':
        if (onSlider) return;
        if (event.shiftKey && this.isVideo()) this.seekBy(-SEEK_STEP);
        else this.step(-1);
        break;
      case ' ':
      case 'k':
        if (!this.isVideo()) return;
        this.togglePlay();
        break;
      case 'l':
        if (!this.isVideo()) return;
        this.seekBy(SEEK_STEP);
        break;
      case 'j':
        if (!this.isVideo()) return;
        this.seekBy(-SEEK_STEP);
        break;
      case 'm':
        if (!this.isVideo()) return;
        this.toggleMute();
        break;
      case 'f':
        this.toggleFullscreen();
        break;
      case '0':
        this.resetView();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  // ---- housekeeping --------------------------------------------------------------------------

  /**
   * The next photograph is fetched while the current one is being looked at, so a swipe lands on a
   * picture rather than on a blank stage. Videos are left alone: preloading one is megabytes spent
   * on a guess.
   */
  private preloadNeighbours(): void {
    if (typeof Image === 'undefined') return;
    for (const at of [this.index() + 1, this.index() - 1]) {
      const item = this.items()[at];
      if (item && item.kind !== 'video') new Image().src = item.src;
    }
  }

  private scrollStripIntoView(): void {
    const strip = this.strip()?.nativeElement;
    const tile = strip?.querySelector<HTMLElement>(`[data-at="${this.index()}"]`);
    tile?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
}
