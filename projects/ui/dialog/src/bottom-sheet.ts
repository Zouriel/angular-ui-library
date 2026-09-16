import { isPlatformBrowser } from '@angular/common';
import {
  Component, DestroyRef, ElementRef, NgZone, PLATFORM_ID, computed, effect, inject, input, model, output, signal, viewChild,
} from '@angular/core';

/** A drag shorter than this is a tap, and a body drag is left to the browser until it's longer. */
const SLOP = 6;
/** Faster than this on release (px per ms) moves one snap in that direction, however short the drag. */
const FLICK = 0.45;
/** Where a drag that starts inside the body is never read as moving the sheet. */
const OWN_DRAG = 'input, textarea, select, [contenteditable="true"], [role="slider"], [data-sheet-nodrag]';

interface Drag {
  id: number;
  startX: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastAt: number;
  velocity: number;
  /** Null until a body drag has shown which way it's going; header drags start decided. */
  engaged: boolean | null;
  fromBody: boolean;
}

/**
 * `ui-bottom-sheet` — a panel anchored to the bottom of the screen that the user drags between
 * resting heights, the mobile answer to a sidebar.
 *
 * <p>Heights are `snaps`: fractions of the room it has (the viewport, less `offset` below it for a
 * toolbar and `topInset` above it for a header). `snap` is the index it rests at, two-way; a first
 * snap of 0 is closed. Drag the header anywhere, or flick it — a fast release moves one snap in that
 * direction. Dragging the body moves the sheet too when that's the only sensible reading: pulling
 * down with the content already at its top, or pushing up while there's a taller snap to reach.
 * Otherwise the content scrolls as usual. Anything marked `data-sheet-nodrag` keeps its drags.</p>
 *
 * <h4>Touch events for the finger</h4>
 *
 * <p>A drag that the browser could read as a scroll never becomes a pointer event, so the finger is
 * followed with touch events, which arrive complete. Pointer events serve the mouse and pen only,
 * and are ignored once a touch has been seen so one finger isn't read as two drags.</p>
 *
 * <p>It's non-modal by default: what's above stays usable, which is the point on an editor. Set
 * `backdrop` for a modal sheet. Escape closes it; the handle is a button that steps through the
 * snaps, and ↑/↓ on it do the same. When a field inside gains focus on a touch screen, the sheet
 * rises to its tallest snap (turn that off with `expandOnFocus`), and while an on-screen keyboard is up
 * the sheet rests on top of it rather than behind it.</p>
 *
 * <p>Positioned `fixed`; keep it out of transformed ancestors.</p>
 */
@Component({
  selector: 'ui-bottom-sheet',
  host: {
    class: 'ui-bottom-sheet',
    '[class.open]': 'isOpen()',
    '[class.dragging]': 'dragHeight() !== null',
    '[style.--ui-sheet-offset.px]': 'bottom()',
    '[style.--ui-sheet-hidden.px]': 'hiddenBelow()',
  },
  template: `
    @if (backdrop() && isOpen()) {
      <div class="backdrop" (click)="snap.set(0)"></div>
    }
    <section #sheet class="sheet" role="dialog" [attr.aria-modal]="backdrop() ? 'true' : null" [attr.aria-label]="title() || null"
      [attr.inert]="isOpen() ? null : ''" [style.height.px]="maxHeight()" [style.transform]="'translateY(' + translate() + 'px)'"
      (keydown.escape)="snap.set(0)" (focusin)="onFocusIn($event)">
      <header class="grab"
        (touchstart)="onTouchStart($event, false)" (touchmove)="onTouchMove($event)" (touchend)="onTouchEnd($event)" (touchcancel)="onTouchEnd($event)"
        (pointerdown)="onPointerDown($event)">
        <button type="button" class="handle" [attr.aria-label]="handleLabel()" (click)="onHandleClick()" (keydown)="onHandleKey($event)">
          <span aria-hidden="true"></span>
        </button>
        @if (title() || hasHeader()) {
          <div class="hd">
            <span class="title">{{ title() }}</span>
            <span class="actions"><ng-content select="[sheet-actions]" /></span>
            @if (closable()) {
              <button type="button" class="x" aria-label="Close" (click)="snap.set(0)">×</button>
            }
          </div>
        }
      </header>
      <div #body class="bd"
        (touchstart)="onTouchStart($event, true)" (touchmove)="onTouchMove($event)" (touchend)="onTouchEnd($event)" (touchcancel)="onTouchEnd($event)">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    :host { display: contents; }
    .backdrop { position: fixed; inset: 0; z-index: var(--ui-sheet-z, var(--ui-z-overlay)); background: var(--ui-color-overlay); }
    .sheet {
      position: fixed; left: 0; right: 0; bottom: var(--ui-sheet-offset, 0px); z-index: var(--ui-sheet-z, var(--ui-z-overlay));
      display: flex; flex-direction: column; box-sizing: border-box;
      background: var(--ui-color-surface); color: var(--ui-color-text); font-family: var(--ui-font-default);
      border: 1px solid var(--ui-color-border); border-bottom: 0; border-radius: var(--ui-radius-lg) var(--ui-radius-lg) 0 0;
      box-shadow: var(--ui-shadow-3);
      transition: transform var(--ui-motion-base) var(--ui-ease-standard), visibility 0s linear 0s;
      will-change: transform;
    }
    :host(:not(.open):not(.dragging)) .sheet { visibility: hidden; box-shadow: none;
      transition: transform var(--ui-motion-base) var(--ui-ease-standard), visibility 0s linear var(--ui-motion-base), box-shadow 0s linear var(--ui-motion-base); }
    :host(.dragging) .sheet { transition: none; }
    .grab { flex: none; touch-action: none; cursor: grab; user-select: none; }
    :host(.dragging) .grab { cursor: grabbing; }
    .handle { display: flex; justify-content: center; width: 100%; padding: 8px 0 6px; border: 0; background: transparent; cursor: inherit; }
    .handle span { width: 40px; height: 5px; border-radius: var(--ui-radius-pill); background: var(--ui-color-border-strong); }
    .handle:focus-visible { outline: none; }
    .handle:focus-visible span { box-shadow: var(--ui-focus-ring); }
    .hd { display: flex; align-items: center; gap: var(--ui-space-2); padding: 0 var(--ui-space-3) var(--ui-space-2) var(--ui-space-4); min-height: 32px; }
    .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; font-size: var(--ui-font-size-md); }
    .actions { display: flex; align-items: center; gap: var(--ui-space-1); }
    .actions:empty { display: none; }
    .x { display: grid; place-items: center; width: 36px; height: 36px; margin-right: calc(var(--ui-space-1) * -1); border: 0; border-radius: var(--ui-radius);
      background: transparent; color: var(--ui-color-text-muted); font-size: 22px; line-height: 1; cursor: pointer; }
    .x:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    /* The sheet is always its tallest height, slid down to rest lower; the part below the screen edge
       is padding here, so the end of the content can still be scrolled into view at a lower snap. */
    .bd { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; border-top: 1px solid var(--ui-color-border-subtle);
      padding-bottom: var(--ui-sheet-hidden, 0px); box-sizing: border-box; }
    @media (prefers-reduced-motion: reduce) { .sheet { transition: visibility 0s; } }
  `,
})
export class UiBottomSheet {
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');

  /** Resting heights as fractions (0–1) of the room the sheet has; ascending. */
  snaps = input<readonly number[]>([0, 0.5, 1]);
  /** Index into `snaps` the sheet rests at. */
  snap = model(0);
  title = input('');
  /** Space kept free below the sheet, in px — a toolbar it sits on top of. */
  offset = input(0);
  /** Space kept free above its tallest snap, in px — a header that stays reachable. */
  topInset = input(0);
  backdrop = input(false);
  closable = input(true);
  /** Show the header row even without a title, for the close button and `[sheet-actions]`. */
  hasHeader = input(false);
  /** Rise to the tallest snap when a field inside is focused on a touch screen. */
  expandOnFocus = input(true);

  /** The height it came to rest at, in px, once each drag or change settles. */
  readonly heightChange = output<number>();
  /**
   * How much of the screen, from its bottom edge, is taken up once it settles: the sheet plus what it
   * rests on (`offset`, or an on-screen keyboard). 0 when closed. For keeping content above it.
   */
  readonly coverChange = output<number>();

  /** The visible height, which an on-screen keyboard shortens. */
  private readonly viewport = signal(this.browser ? window.innerHeight : 800);
  /** How much of the layout viewport's bottom an on-screen keyboard covers. */
  private readonly keyboard = signal(0);
  /** Distance from the layout viewport's bottom to the visible bottom while the keyboard is up. */
  private readonly keyboardEdge = signal(0);
  /** Rests on the keyboard while it's up — the toolbar under it is hidden anyway — and on `offset` otherwise. */
  protected readonly bottom = computed(() => (this.keyboard() > 0 ? this.keyboardEdge() : this.offset()));
  /** The live height while a drag is in progress. */
  protected readonly dragHeight = signal<number | null>(null);

  protected readonly room = computed(() =>
    Math.max(0, this.viewport() - (this.keyboard() > 0 ? 0 : this.offset()) - this.topInset()));
  protected readonly maxHeight = computed(() => Math.round(this.room() * Math.max(0, ...this.snaps())));
  private readonly snapHeight = (i: number) => Math.round(this.room() * (this.snaps()[i] ?? 0));
  protected readonly isOpen = computed(() => this.snapHeight(this.snap()) > 0);
  protected readonly translate = computed(() => this.maxHeight() - (this.dragHeight() ?? this.snapHeight(this.snap())));
  /** How far the sheet's settled position hangs below its resting edge. Not live while dragging, so content doesn't jump. */
  protected readonly hiddenBelow = computed(() => this.maxHeight() - this.snapHeight(this.snap()));
  protected readonly handleLabel = computed(() => (this.snap() >= this.snaps().length - 1 ? 'Make smaller' : 'Make larger'));

  private drag: Drag | null = null;
  private touched = false;

  constructor() {
    if (this.browser) {
      const onResize = () => {
        const vv = window.visualViewport;
        if (!vv) {
          this.keyboard.set(0);
          this.viewport.set(window.innerHeight);
          return;
        }
        // The keyboard is what the visual viewport lost, however the browser has panned it. Chrome on
        // Android pans (offsetTop > 0) to bring the focused field into view; reading that pan as the
        // keyboard closing dropped the sheet back behind it — seen on a real device, not in emulation.
        const keyboardHeight = window.innerHeight - vv.height;
        const open = keyboardHeight > 120; // less is browser chrome settling, not a keyboard
        this.keyboard.set(open ? Math.round(keyboardHeight) : 0);
        // Rest on the bottom of what's VISIBLE: the layout viewport's bottom less the keyboard, less any pan.
        this.keyboardEdge.set(open ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0);
        this.viewport.set(open ? vv.height : window.innerHeight);
      };
      onResize();
      window.addEventListener('resize', onResize);
      window.visualViewport?.addEventListener('resize', onResize);
      window.visualViewport?.addEventListener('scroll', onResize);
      inject(DestroyRef).onDestroy(() => {
        window.removeEventListener('resize', onResize);
        window.visualViewport?.removeEventListener('resize', onResize);
        window.visualViewport?.removeEventListener('scroll', onResize);
        this.detachPointer();
      });
    }
    effect(() => {
      if (this.dragHeight() !== null) return;
      const height = this.snapHeight(this.snap());
      this.heightChange.emit(height);
      this.coverChange.emit(height > 0 ? height + this.bottom() : 0);
    });
  }

  // ----- Keyboard and taps -------------------------------------------------------------------------

  protected onHandleClick(): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    const last = this.snaps().length - 1;
    const firstOpen = this.snaps().findIndex((s) => s > 0);
    this.snap.set(this.snap() >= last ? Math.max(0, firstOpen) : this.snap() + 1);
  }

  protected onHandleKey(e: KeyboardEvent): void {
    const last = this.snaps().length - 1;
    if (e.key === 'ArrowUp') this.snap.set(Math.min(last, this.snap() + 1));
    else if (e.key === 'ArrowDown') this.snap.set(Math.max(0, this.snap() - 1));
    else return;
    e.preventDefault();
  }

  protected onFocusIn(e: FocusEvent): void {
    if (!this.expandOnFocus() || !(this.touched || window.matchMedia('(pointer: coarse)').matches)) return;
    const target = e.target as Element | null;
    if (target?.closest('input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable="true"]'))
      this.snap.set(this.snaps().length - 1);
  }

  private suppressClick = false;

  // ----- Touch: the finger -------------------------------------------------------------------------

  protected onTouchStart(e: TouchEvent, fromBody: boolean): void {
    this.touched = true;
    if (e.touches.length > 1) {
      this.cancel();
      return;
    }
    // A header touch also bubbles nowhere near the body, but a body touch must not restart a header drag.
    if (this.drag) return;
    const t = e.changedTouches[0];
    if (!t) return;
    if (fromBody && this.ownsDrag(e.target as Element | null)) return;
    this.begin(t.identifier, t.clientX, t.clientY, e.timeStamp, fromBody);
  }

  protected onTouchMove(e: TouchEvent): void {
    const d = this.drag;
    if (!d) return;
    if (e.touches.length > 1) {
      this.cancel();
      return;
    }
    const t = Array.from(e.changedTouches).find((x) => x.identifier === d.id);
    if (!t) return;
    if (d.engaged === null) {
      const dy = t.clientY - d.startY;
      const dx = Math.abs(t.clientX - d.startX);
      if (Math.abs(dy) < SLOP) return;
      d.engaged = dx <= Math.abs(dy) && this.bodyShouldMove(e.target as Element, dy);
      if (!d.engaged) {
        this.drag = null;
        return;
      }
      // Start from here, so the sheet doesn't jump by the slop.
      d.startY = t.clientY;
    }
    if (!d.engaged) return;
    if (e.cancelable) e.preventDefault();
    this.follow(t.clientY, e.timeStamp);
  }

  protected onTouchEnd(e: TouchEvent): void {
    const d = this.drag;
    if (!d) return;
    const t = Array.from(e.changedTouches).find((x) => x.identifier === d.id);
    if (!t) return;
    this.release();
  }

  // ----- Pointer: the mouse and the pen --------------------------------------------------------------

  protected onPointerDown(e: PointerEvent): void {
    if (this.touched || e.pointerType === 'touch' || e.button !== 0) return;
    this.begin(e.pointerId, e.clientX, e.clientY, e.timeStamp, false);
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp);
      window.addEventListener('pointercancel', this.onPointerUp);
    });
  }

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    this.zone.run(() => this.follow(e.clientY, e.timeStamp));
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    this.detachPointer();
    this.zone.run(() => this.release());
  };

  private detachPointer(): void {
    if (!this.browser) return;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

  // ----- The drag ----------------------------------------------------------------------------------

  private begin(id: number, x: number, y: number, at: number, fromBody: boolean): void {
    this.drag = {
      id, startX: x, startY: y, startHeight: this.snapHeight(this.snap()), lastY: y, lastAt: at, velocity: 0,
      engaged: fromBody ? null : true, fromBody,
    };
  }

  /** Whether what's under the finger drags for its own reasons: a field, a slider, or anything that took the gesture with `touch-action`. */
  private ownsDrag(target: Element | null): boolean {
    if (!target || target.closest(OWN_DRAG)) return true;
    const root = this.body().nativeElement;
    for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
      const action = getComputedStyle(el).touchAction;
      if (action === 'none' || action === 'pan-x' || action === 'pinch-zoom') return true;
    }
    return false;
  }

  /** A body drag moves the sheet when the content can't use it: already at its top going down, or while there's more sheet above. */
  private bodyShouldMove(target: Element | null, dy: number): boolean {
    if (dy > 0) return !this.scrollableAbove(target);
    return this.snap() < this.snaps().length - 1;
  }

  private scrollableAbove(target: Element | null): boolean {
    const root = this.body().nativeElement;
    for (let el: Element | null = target; el; el = el.parentElement) {
      if (el.scrollTop > 0) return true;
      if (el === root) break;
    }
    return false;
  }

  private follow(y: number, at: number): void {
    const d = this.drag!;
    const dt = at - d.lastAt;
    if (dt > 0) d.velocity = 0.7 * ((y - d.lastY) / dt) + 0.3 * d.velocity;
    d.lastY = y;
    d.lastAt = at;
    const height = Math.min(this.maxHeight(), Math.max(0, d.startHeight - (y - d.startY)));
    if (this.dragHeight() !== null || Math.abs(y - d.startY) >= SLOP) this.dragHeight.set(height);
  }

  private release(): void {
    const d = this.drag;
    this.drag = null;
    const height = this.dragHeight();
    this.dragHeight.set(null);
    if (!d || height === null) return;
    this.suppressClick = !d.fromBody;
    setTimeout(() => (this.suppressClick = false));

    const heights = this.snaps().map((_, i) => this.snapHeight(i));
    let target: number;
    if (Math.abs(d.velocity) >= FLICK) {
      // Flicked: the next snap past where it was let go, in the direction of travel.
      const up = d.velocity < 0;
      const candidates = heights.map((h, i) => ({ h, i })).filter((c) => (up ? c.h > height + 1 : c.h < height - 1));
      target = candidates.length
        ? (up ? candidates[0] : candidates[candidates.length - 1]).i
        : up ? heights.length - 1 : 0;
    } else {
      target = heights.reduce((best, h, i) => (Math.abs(h - height) < Math.abs(heights[best] - height) ? i : best), 0);
    }
    this.snap.set(target);
  }

  private cancel(): void {
    this.drag = null;
    this.dragHeight.set(null);
  }
}
