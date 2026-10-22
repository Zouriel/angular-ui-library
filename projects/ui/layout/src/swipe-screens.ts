import {
  Component, DestroyRef, ElementRef, booleanAttribute, computed, contentChildren, effect, inject, input, model, signal, untracked,
} from '@angular/core';

/** A drag released faster than this (px per second) moves one screen that way, however short. */
export const UI_SWIPE_FLING_VELOCITY = 400;

/** How far (px) a pointer moves before a drag is decided: horizontal and claimed, or left alone. */
export const UI_SWIPE_SLOP = 8;

/**
 * Where a released swipe settles (0.44.0, Flutter `uiSwipeTarget`): from screen `start`, at position
 * `pos` (fractional, 1.4 = 40% of the way from screen 1 to 2) with `velocity` px/s towards the next
 * screen (negative: towards the previous one). Faster than 400 px/s moves one screen that way; else
 * past half the width moves one; else back. Kept within 0..`count`-1, and never forward when
 * `backOnly` (an edge swipe on a screen that keeps its own drags).
 */
export function uiSwipeTarget(start: number, pos: number, velocity: number, count: number, backOnly = false): number {
  let target = start;
  if (velocity > UI_SWIPE_FLING_VELOCITY) target = start + 1;
  else if (velocity < -UI_SWIPE_FLING_VELOCITY) target = start - 1;
  else if (pos - start > 0.5) target = start + 1;
  else if (pos - start < -0.5) target = start - 1;
  if (backOnly) target = Math.min(start, target);
  return Math.max(0, Math.min(count - 1, target));
}

/**
 * `ui-swipe-screen` — one full-height screen of a `ui-swipe-screens`. `label` names it for screen
 * readers (announced when it comes into view). `edgeSwipeOnly`: the screen keeps every drag for its
 * own content (a map that pans), and only a drag starting on its leading edge (`edgeWidth`, 24px)
 * swipes back to the screen before it.
 */
@Component({
  selector: 'ui-swipe-screen',
  host: {
    class: 'ui-swipe-screen',
    role: 'group',
    '[attr.aria-label]': 'label()',
    '[attr.aria-hidden]': "offscreen() ? 'true' : null",
    '[attr.inert]': "offscreen() ? '' : null",
    '[attr.data-edge-only]': 'edgeSwipeOnly() || null',
  },
  template: `<ng-content />
    @if (edgeSwipeOnly() && hasPrevious()) {
      <div class="ui-swipe-edge" data-swipe-edge aria-hidden="true" [style.width.px]="edgeWidth()"></div>
    }`,
  styles: `
    :host { display: block; position: relative; flex: 0 0 100%; width: 100%; height: 100%; min-width: 0; overflow: hidden; box-sizing: border-box; }
    /* The strip a back swipe starts on: above the screen's content (a map's panes included), so the
       content never sees those pointers. */
    .ui-swipe-edge { position: absolute; top: 0; bottom: 0; inset-inline-start: 0; z-index: 2; touch-action: none; }
  `,
})
export class UiSwipeScreen {
  /** Its name, for screen readers and the announcement when it comes into view. */
  label = input.required<string>();
  /** Drags stay with the content; only one starting on the leading edge swipes back. */
  edgeSwipeOnly = input(false, { transform: booleanAttribute });

  /** Set by the parent: out of view (inert and hidden from screen readers). */
  readonly offscreen = signal(false);
  /** Set by the parent: there is a screen before it to swipe back to. */
  readonly hasPrevious = signal(false);
  /** Set by the parent: the back-swipe strip's width. */
  readonly edgeWidth = signal(24);
  /** The element, for the parent's hit tests. */
  readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}

interface Gesture {
  id: number;
  x: number;
  y: number;
  start: number;
  rtl: boolean;
  width: number;
  /** Started on a back-swipe strip: only back. */
  backOnly: boolean;
  claimed: boolean;
  samples: { t: number; x: number }[];
}

/**
 * `ui-swipe-screens` (0.44.0, Flutter `UiSwipeScreens`) — full-height screens side by side, moved
 * between with a horizontal swipe: a chat with its map one swipe away.
 *
 *   <ui-swipe-screens [(index)]="screen">
 *     <ui-swipe-screen label="Chat">…</ui-swipe-screen>
 *     <ui-swipe-screen label="Map" edgeSwipeOnly><ui-map fill … /></ui-swipe-screen>
 *   </ui-swipe-screens>
 *
 * - Screen i+1 sits at the inline end (to the right; to the left in RTL). A drag moves the screens
 *   with the finger and snaps on release: faster than 400 px/s one screen that way, else past half
 *   the width one screen, else back. Under reduced motion the snap is instant.
 * - Only clearly horizontal drags are taken: a drag that is more vertical than horizontal is left to
 *   the content, so lists inside scroll as usual (the host is `touch-action: pan-y`).
 * - On the first screen, a drag starting within `leadingEdgeExclusion` (24px) of the leading edge
 *   is left alone: an app drawer opens from there.
 * - A screen with `edgeSwipeOnly` keeps its drags (a map pans); a drag starting on its leading edge
 *   (`edgeWidth`, 24px) swipes back.
 * - `[(index)]`: setting it animates there. Every screen stays alive off screen; screens out of view
 *   are `inert` and `aria-hidden`, and the screen that comes into view is announced by its label.
 *   There is no page indicator: apps add their own buttons that set `index`.
 *
 * Give it a height (it fills its parent's: `height: 100%`).
 */
@Component({
  selector: 'ui-swipe-screens',
  host: {
    class: 'ui-swipe-screens',
    '[attr.data-dragging]': "dragPos() !== null ? '' : null",
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'onUp($event)',
    '(pointercancel)': 'onUp($event, true)',
  },
  template: `<div class="ui-swipe-track" [style.transform]="transform()"><ng-content /></div>
    <div class="ui-swipe-live" aria-live="polite" aria-atomic="true">{{ announcement() }}</div>`,
  styles: `
    :host { display: block; position: relative; height: 100%; overflow: hidden; touch-action: pan-y; }
    .ui-swipe-track { display: flex; width: 100%; height: 100%; transition: transform var(--ui-motion-base) var(--ui-ease-standard); }
    :host([data-dragging]) .ui-swipe-track { transition: none; user-select: none; -webkit-user-select: none; }
    .ui-swipe-live { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    @media (prefers-reduced-motion: reduce) { .ui-swipe-track { transition: none; } }
  `,
})
export class UiSwipeScreens {
  /** The screen in view, two-way. Setting it animates there (instantly under reduced motion). */
  index = model(0);
  /** On the first screen, px from the leading edge where a drag is left alone (an app drawer's). */
  leadingEdgeExclusion = input(24);
  /** The width of the strip a back swipe starts on, on `edgeSwipeOnly` screens. */
  edgeWidth = input(24);

  protected readonly screens = contentChildren(UiSwipeScreen);
  /** The fractional screen position while a finger drags, else null. */
  protected readonly dragPos = signal<number | null>(null);
  protected readonly announcement = signal('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private gesture: Gesture | null = null;
  /** A drag just ended: swallow the click it would cause on the content. */
  private swallowClick = false;

  /** The index in range. */
  protected readonly current = computed(() => Math.max(0, Math.min(this.screens().length - 1, this.index())));

  protected readonly transform = computed(() => {
    const p = this.dragPos() ?? this.current();
    const rtl = this.rtlNow();
    return `translateX(${(rtl ? 1 : -1) * p * 100}%)`;
  });

  /** The reading direction, re-read when the screens change (and on every drag). */
  private readonly rtlNow = signal(false);

  constructor() {
    effect(() => {
      const list = this.screens();
      const drag = this.dragPos();
      const cur = this.current();
      const edge = this.edgeWidth();
      untracked(() => {
        list.forEach((s, i) => {
          s.offscreen.set(drag !== null ? Math.abs(i - drag) >= 1 : i !== cur);
          s.hasPrevious.set(i > 0);
          s.edgeWidth.set(edge);
        });
      });
    });
    // The screen that comes into view is announced (not the first one shown).
    let shown: number | null = null;
    effect(() => {
      const cur = this.current();
      const label = this.screens()[cur]?.label();
      untracked(() => {
        this.rtlNow.set(this.readRtl());
        if (label === undefined) return;
        if (shown !== null && shown !== cur) this.announcement.set(label);
        shown = cur;
      });
    });
    const swallow = (e: Event) => {
      if (!this.swallowClick) return;
      this.swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    };
    this.host.addEventListener('click', swallow, true);
    inject(DestroyRef).onDestroy(() => this.host.removeEventListener('click', swallow, true));
  }

  private readRtl(): boolean {
    return typeof getComputedStyle === 'function' && getComputedStyle(this.host).direction === 'rtl';
  }

  protected onDown(e: PointerEvent): void {
    if (this.gesture || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.swallowClick = false;
    const list = this.screens();
    const cur = this.current();
    const screen = list[cur];
    if (!screen) return;
    const rtl = this.readRtl();
    this.rtlNow.set(rtl);
    const rect = this.host.getBoundingClientRect();
    const width = rect.width || this.host.clientWidth;
    if (!width) return;
    const target = e.target as Element | null;
    const strip = target?.closest?.('[data-swipe-edge]');
    let backOnly = false;
    if (strip && screen.el.contains(strip)) {
      backOnly = true;
    } else if (screen.edgeSwipeOnly()) {
      // The screen keeps its drags (a map pans).
      return;
    } else if (cur === 0) {
      const fromLeading = rtl ? rect.right - e.clientX : e.clientX - rect.left;
      // An app drawer opens from here.
      if (fromLeading < this.leadingEdgeExclusion()) return;
    }
    if (list.length < 2) return;
    this.gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, start: cur, rtl, width, backOnly, claimed: false, samples: [{ t: e.timeStamp, x: e.clientX }] };
  }

  protected onMove(e: PointerEvent): void {
    const g = this.gesture;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    // Towards the next screen is a finger moving to the inline start.
    const towardsNext = g.rtl ? dx : -dx;
    if (!g.claimed) {
      if (Math.abs(dx) <= UI_SWIPE_SLOP && Math.abs(dy) <= UI_SWIPE_SLOP) return;
      // Vertical (or a back strip pushed forward): not ours.
      if (Math.abs(dy) >= Math.abs(dx) || (g.backOnly && towardsNext > 0)) {
        this.gesture = null;
        return;
      }
      g.claimed = true;
      try {
        this.host.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointer */
      }
    }
    e.preventDefault();
    g.samples.push({ t: e.timeStamp, x: e.clientX });
    while (g.samples.length > 2 && e.timeStamp - g.samples[0].t > 100) g.samples.shift();
    const n = this.screens().length;
    const lo = g.backOnly ? Math.max(0, g.start - 1) : 0;
    const hi = g.backOnly ? g.start : n - 1;
    this.dragPos.set(Math.max(lo, Math.min(hi, g.start + towardsNext / g.width)));
  }

  protected onUp(e: PointerEvent, cancelled = false): void {
    const g = this.gesture;
    if (!g || e.pointerId !== g.id) return;
    this.gesture = null;
    if (!g.claimed) return;
    const pos = this.dragPos() ?? g.start;
    let velocity = 0;
    if (!cancelled) {
      const s = g.samples[0];
      const dt = (e.timeStamp - s.t) / 1000;
      const vx = dt > 0 ? (e.clientX - s.x) / dt : 0;
      velocity = g.rtl ? vx : -vx;
    }
    const target = uiSwipeTarget(g.start, pos, velocity, this.screens().length, g.backOnly);
    this.swallowClick = !cancelled;
    this.dragPos.set(null);
    this.index.set(target);
  }
}
