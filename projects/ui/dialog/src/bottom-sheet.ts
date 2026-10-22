import { FocusTrap, FocusTrapFactory } from '@angular/cdk/a11y';
import { isPlatformBrowser } from '@angular/common';
import { UI_ANIM, uiLeaveHidden, injectUiStrings, type UiGlassStrength } from '@zouriel/ui';
import {
  Component, DestroyRef, booleanAttribute, ElementRef, NgZone, PLATFORM_ID, afterNextRender, computed, effect, inject, input, model, output, signal,
  untracked, viewChild,
} from '@angular/core';

/** A drag shorter than this is a tap, and a body drag is left to the browser until it's longer. */
const SLOP = 6;
/** Faster than this on release (px per ms) moves one snap in that direction, however short the drag. */
const FLICK = 0.45;
/** Focus back on the same field within this long (ms) of leaving it is the browser's churn, not a new focus. */
const REFOCUS_MS = 600;
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
 * <p>It's non-modal by default: what's above stays usable, which is the point on an editor, so
 * opening it does not move focus and Tab can leave it. Set `backdrop` to make it modal while open:
 * the page dims and a backdrop tap closes it, it is marked `aria-modal`, focus moves into it (to an
 * element marked `cdkFocusInitial`, else the first focusable one, the handle), and Tab is trapped
 * inside (CDK `FocusTrap`). Escape closes it while focus is inside; closing either way sends focus
 * back to where it came from. A sheet whose smallest snap is above 0 is `persistent`: it has no
 * closed state, so Escape only collapses it to that smallest snap and does nothing once it rests
 * there (the sheet never touches browser history, so the browser's Back button always leaves the
 * page). With `maxWidth`, a wider screen gets a sheet that wide, centred. The handle is a button that steps through the snaps, and ↑/↓ on it do the same. When a field inside gains focus on a touch screen, the sheet
 * rises to its tallest snap (turn that off with `expandOnFocus`), once per field: typing, the keyboard
 * opening, and the browser taking focus away and straight back do not raise it again. While an
 * on-screen keyboard is up the sheet rests on top of it rather than behind it.</p>
 *
 * <p>When `snaps` changes (an app that sizes them to the viewport, which the keyboard shrinks), the
 * sheet stays at the snap nearest the height it rested at, and `snap` follows; an index past the end
 * is read as the last snap, never as closed.</p>
 *
 * <p>`glass` (0.41.2) makes it see-through, for a sheet over a map or a photo. `glassStrength`
 * (0.41.3) says how much: `'clear'` (the default) is for a map in the theme's own brightness (light
 * tiles under a light theme): a light tint over a lightly blurred backdrop squeezed into the theme's
 * `--ui-glass-clear-floor` to `--ui-glass-clear-ceiling` range, so roads and the coastline plainly
 * show through while text, muted text, primary and status colours keep WCAG AA over the colours such
 * a map is drawn in. `'frosted'` is the near-opaque 0.41.2 surface (60% tint, heavy blur, the
 * `--ui-glass-sheet-*` range) that keeps them AA over anything, pure white and pure black included:
 * for photos or a map in the other brightness. Fields and buttons inside keep their own solid
 * backgrounds. Where `backdrop-filter` isn't supported, or the user asks for reduced transparency or
 * more contrast, it is the solid surface. Off by default.</p>
 *
 * <p>`[sheet-footer]` content (0.44.0) is a footer pinned to the bottom of the visible sheet at every
 * open snap, the peek included: a primary action bar. The body scrolls above it; it has a top hairline,
 * the sheet's surface and the safe area below it, counts in `coverChange` (it is part of the sheet) and
 * rests on the keyboard with the sheet. A snap too short for the handle, header and footer is raised
 * to fit them, so the footer is never cut off.</p>
 *
 * <p>Positioned `fixed`; keep it out of transformed ancestors.</p>
 */
@Component({
  selector: 'ui-bottom-sheet',
  host: {
    class: 'ui-bottom-sheet',
    '[class.open]': 'isOpen()',
    '[class.dragging]': 'dragHeight() !== null',
    '[class.glass]': 'glass()',
    '[class.frosted]': "glass() && glassStrength() === 'frosted'",
    '[style.--ui-sheet-offset.px]': 'bottom()',
    '[style.--ui-sheet-hidden.px]': 'hiddenBelow()',
    '[style.--ui-sheet-max-width]': 'maxWidthCss()',
    '[style.--ui-sheet-live-hidden.px]': 'translate()',
    '[style.--ui-sheet-footer.px]': 'footerHeight() || null',
  },
  template: `
    @if (backdrop() && isOpen()) {
      <div class="backdrop" animate.enter="ui-backdrop-enter" (animate.leave)="backdropLeave($event)" (click)="snap.set(0)"></div>
    }
    <section #sheet class="sheet" role="dialog" [attr.aria-modal]="modal() ? 'true' : null" [attr.aria-label]="title() || null"
      [attr.inert]="isOpen() ? null : ''" [style.height.px]="maxHeight()" [style.transform]="'translateY(' + translate() + 'px)'"
      (keydown.escape)="onEscape()" (focusin)="onFocusIn($event)" (focusout)="onFocusOut($event)">
      <header #grab class="grab"
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
              <button type="button" class="x" [attr.aria-label]="strings.close" (click)="close()"><svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
            }
          </div>
        }
      </header>
      <div #body class="bd"
        (touchstart)="onTouchStart($event, true)" (touchmove)="onTouchMove($event)" (touchend)="onTouchEnd($event)" (touchcancel)="onTouchEnd($event)">
        <ng-content />
      </div>
      <div #foot class="ft"><ng-content select="[sheet-footer]" /></div>
    </section>
  `,
  styles: `
    :host { display: contents; }
    .backdrop { position: fixed; inset: 0; z-index: var(--ui-sheet-z, var(--ui-z-overlay)); background: var(--ui-color-overlay); }
    .sheet {
      position: fixed; left: 0; right: 0; bottom: var(--ui-sheet-offset, 0px); z-index: var(--ui-sheet-z, var(--ui-z-overlay));
      /* With maxWidth on a wider screen: that wide and centred (auto margins split what is left). */
      max-width: var(--ui-sheet-max-width, none); margin-inline: auto;
      display: flex; flex-direction: column; box-sizing: border-box;
      background: var(--ui-color-surface); color: var(--ui-color-text); font-family: var(--ui-font-default); line-height: 1.35;
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
    /* 24px is the WCAG 2.5.8 minimum target; the padding alone (8 + 5 + 8) came to 21. */
    .handle { display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: 100%; min-height: 24px; padding: var(--ui-space-2) 0; border: 0; background: transparent; cursor: inherit; }
    @media (pointer: coarse) { .handle { min-height: var(--ui-size-touch); padding: 0; } }
    .handle span { width: 40px; height: 5px; border-radius: var(--ui-radius-pill); background: var(--ui-color-border-strong); }
    .handle:focus-visible { outline: none; }
    .handle:focus-visible span { box-shadow: var(--ui-focus-ring); }
    .hd { display: flex; align-items: center; gap: var(--ui-space-2); padding: 0 var(--ui-space-4) var(--ui-space-2); min-height: 32px; }
    .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; font-size: var(--ui-font-size-md); letter-spacing: var(--ui-tracking-tight); }
    .actions { display: flex; align-items: center; gap: var(--ui-space-1); }
    .actions:empty { display: none; }
    .x {
      position: relative; flex: none;
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--ui-size-sm); height: var(--ui-size-sm); padding: 0; margin: calc(var(--ui-space-1) * -1) 0;
      border: none; background: transparent; border-radius: var(--ui-radius-xs);
      color: var(--ui-color-text-muted); font: inherit; font-size: 16px; line-height: 1; cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard),
                  transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .x:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .x:active { transform: scale(var(--ui-scale-press)); }
    .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    /* Touch-only hit-slop: the visible box stays compact on desktop. */
    @media (pointer: coarse) { .x::before { content: ''; position: absolute; inset: calc((var(--ui-size-sm) - var(--ui-size-touch)) / 2); } }
    /* The sheet is always its tallest height, slid down to rest lower; the part below the screen edge
       is padding here, so the end of the content can still be scrolled into view at a lower snap. */
    /* Same body padding as ui-modal and ui-drawer, so content lines up with the title above it. */
    .bd { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; border-top: 1px solid var(--ui-color-border-subtle);
      padding: var(--ui-space-3) var(--ui-space-4) calc(var(--ui-space-3) + var(--ui-sheet-hidden, 0px) + var(--ui-sheet-footer, env(safe-area-inset-bottom)));
      box-sizing: border-box; }
    /* [sheet-footer] (0.44.0): pinned to the bottom of the visible part (the sheet hangs below the screen
       by --ui-sheet-live-hidden, which follows a drag), over the body's bottom padding. */
    .ft { position: absolute; left: 0; right: 0; bottom: var(--ui-sheet-live-hidden, 0px); z-index: 1; box-sizing: border-box;
      padding: var(--ui-space-3) var(--ui-space-4) calc(var(--ui-space-3) + env(safe-area-inset-bottom));
      border-top: 1px solid var(--ui-color-border); background: var(--ui-color-surface); }
    .ft:empty { display: none; }
    @media (prefers-reduced-motion: reduce) { .sheet { transition: visibility 0s; } }
    /* glass: see-through over a map. The filter squeezes the backdrop into the theme's floor-ceiling
       range before the tint, which is what keeps the text AA (see tokens.css): clear (the default,
       0.41.3) over a map in the theme's brightness, frosted over anything. */
    :host(.glass) .sheet {
      background: var(--ui-glass-clear-bg); border-color: var(--ui-glass-border);
      -webkit-backdrop-filter: var(--ui-glass-clear-filter); backdrop-filter: var(--ui-glass-clear-filter);
    }
    :host(.glass.frosted) .sheet {
      background: var(--ui-glass-sheet-bg);
      -webkit-backdrop-filter: var(--ui-glass-sheet-filter); backdrop-filter: var(--ui-glass-sheet-filter);
    }
    :host(.glass) .bd { border-top-color: var(--ui-glass-border); }
    /* The footer is always frosted (0.44.2): the body scrolls under it, so clear glass would show its text
       through the buttons. */
    :host(.glass) .ft {
      background: var(--ui-glass-sheet-bg); border-top-color: var(--ui-glass-border);
      -webkit-backdrop-filter: var(--ui-glass-sheet-filter); backdrop-filter: var(--ui-glass-sheet-filter);
    }
    /* No backdrop-filter: an unfiltered map under a 60% tint can't promise contrast, so solid. */
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      :host(.glass) .sheet, :host(.glass.frosted) .sheet, :host(.glass) .ft { background: var(--ui-color-surface); }
    }
    @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
      :host(.glass) .sheet, :host(.glass.frosted) .sheet, :host(.glass) .ft { background: var(--ui-color-surface); -webkit-backdrop-filter: none; backdrop-filter: none; }
    }
  `,
})
export class UiBottomSheet {
  protected readonly strings = injectUiStrings();
  /** The backdrop fades out and stays at 0 until it is removed. */
  protected readonly backdropLeave = uiLeaveHidden(UI_ANIM.backdrop.leave);
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');
  private readonly sheet = viewChild.required<ElementRef<HTMLElement>>('sheet');
  private readonly grab = viewChild.required<ElementRef<HTMLElement>>('grab');
  private readonly foot = viewChild.required<ElementRef<HTMLElement>>('foot');
  /** The handle and header's height, and the footer's (0 without one), measured. */
  protected readonly headHeight = signal(0);
  protected readonly footerHeight = signal(0);
  /** Where focus came from when it first moved into the sheet; closing from the keyboard hands it back. */
  private returnFocus: HTMLElement | null = null;
  /** Created once the sheet is rendered; enabled only while the sheet is modal (`backdrop` and open). */
  private focusTrap: FocusTrap | null = null;
  private readonly trapReady = signal(false);

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
  /**
   * See-through surface, for a sheet over a map (0.41.2); how see-through is `glassStrength`. Solid
   * where backdrop-filter is missing or under reduced transparency / more contrast. Off by default,
   * whatever `UiConfig.glass` says.
   */
  glass = input(false, { transform: booleanAttribute });
  /**
   * How see-through `glass` is (0.41.3). `'clear'` (default): for a map in the theme's brightness,
   * which plainly shows through, text AA over such a map. `'frosted'`: near-opaque, AA over anything.
   */
  glassStrength = input<UiGlassStrength>('clear');
  /**
   * The widest the sheet gets: a number in px or a CSS length (`'560px'`, `'40rem'`). On a wider
   * screen the sheet is that wide and centred; the backdrop still covers the whole screen. Default:
   * the full width.
   */
  maxWidth = input<number | string | null>(null);
  protected readonly maxWidthCss = computed(() => {
    const w = this.maxWidth();
    return w === null || w === '' ? null : typeof w === 'number' ? `${w}px` : w;
  });

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
  /** With a footer, the least an open sheet shows: the handle and header plus the footer. */
  private readonly minOpen = computed(() => (this.footerHeight() > 0 ? this.headHeight() + this.footerHeight() : 0));
  protected readonly maxHeight = computed(() => {
    const top = Math.max(0, ...this.snaps());
    return Math.max(Math.round(this.room() * top), top > 0 ? this.minOpen() : 0);
  });
  /**
   * `snap` within the snaps. Out of range reads as the nearest end: an app whose snaps shrank (fewer
   * of them while the keyboard is up) once had its sheet read as closed, which made it inert, blurred
   * the field, dropped the keyboard and restored the snaps: the sheet re-opened, over and over.
   */
  private readonly index = computed(() => Math.min(Math.max(0, this.snap()), Math.max(0, this.snaps().length - 1)));
  private readonly snapHeight = (i: number) => {
    const s = this.snaps()[i] ?? 0;
    const h = Math.round(this.room() * s);
    // A footer always fits: an open snap shorter than the handle, header and footer is raised to them.
    return s > 0 ? Math.min(this.maxHeight(), Math.max(h, this.minOpen())) : h;
  };
  protected readonly isOpen = computed(() => this.snapHeight(this.index()) > 0);
  /** Index of the smallest snap. */
  private readonly lowest = computed(() => {
    const snaps = this.snaps();
    return snaps.reduce((lo, s, i) => (s < snaps[lo] ? i : lo), 0);
  });
  /** Has no closed state: its smallest snap is above 0, so it is always on screen. */
  readonly persistent = computed(() => (this.snaps()[this.lowest()] ?? 0) > 0);
  /** With a backdrop and open, it's a modal dialog: focus moves in and is trapped. */
  protected readonly modal = computed(() => this.backdrop() && this.isOpen());
  protected readonly translate = computed(() => this.maxHeight() - (this.dragHeight() ?? this.snapHeight(this.index())));
  /** How far the sheet's settled position hangs below its resting edge. Not live while dragging, so content doesn't jump. */
  protected readonly hiddenBelow = computed(() => this.maxHeight() - this.snapHeight(this.index()));
  protected readonly handleLabel = computed(() => (this.index() >= this.snaps().length - 1 ? 'Make smaller' : 'Make larger'));

  private drag: Drag | null = null;
  private touched = false;
  /** The field that last raised the sheet, and when focus last left the sheet: a field that gets focus straight back doesn't raise it again. */
  private expandedFor: Element | null = null;
  private leftAt = -Infinity;
  /** The snaps the sheet last rested on, to find the same height in new ones. */
  private lastSnaps: readonly number[] | null = null;
  private lastIndex = -1;

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
        // A pan moves the sheet with the visible area, so where it is on screen doesn't change.
        this.keyboardEdge.set(open ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0);
        // Whole px: sub-pixel jitter in the visual viewport (zoom, scroll) must not resize the sheet.
        this.viewport.set(Math.round(open ? vv.height : window.innerHeight));
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
    if (this.browser) {
      const trapFactory = inject(FocusTrapFactory);
      afterNextRender(() => {
        this.measure();
        if (typeof ResizeObserver !== 'undefined') {
          const ro = new ResizeObserver(() => this.measure());
          ro.observe(this.grab().nativeElement);
          ro.observe(this.foot().nativeElement);
          this.destroyRef.onDestroy(() => ro.disconnect());
        }
        this.focusTrap = trapFactory.create(this.sheet().nativeElement);
        this.focusTrap.enabled = false;
        this.trapReady.set(true);
      });
      inject(DestroyRef).onDestroy(() => this.focusTrap?.destroy());
    }
    effect(() => {
      const modal = this.modal();
      const trap = this.trapReady() ? this.focusTrap : null;
      if (!trap || trap.enabled === modal) return;
      untracked(() => {
        trap.enabled = modal;
        if (modal) {
          const active = document.activeElement;
          if (active instanceof HTMLElement && !this.sheet().nativeElement.contains(active)) this.returnFocus = active;
          void trap.focusInitialElementWhenReady();
        } else {
          // Closed by a backdrop tap or from outside: focus is in the (now inert) sheet or already on <body>.
          this.restoreFocus(true);
        }
      });
    });
    // New snaps: stay at the snap nearest the fraction it rested at (and tell the app), unless the
    // app moved `snap` along with them, which says where it wants the sheet.
    effect(() => {
      const snaps = this.snaps();
      const i = this.snap();
      untracked(() => {
        const prev = this.lastSnaps;
        const prevIndex = this.lastIndex;
        this.lastSnaps = snaps;
        this.lastIndex = i;
        if (!prev || !snaps.length || prev === snaps || i !== prevIndex) return;
        const was = prev[Math.min(Math.max(0, i), prev.length - 1)];
        if (was === undefined) return;
        let best = 0;
        snaps.forEach((s, j) => {
          if (Math.abs(s - was) < Math.abs(snaps[best] - was)) best = j;
        });
        if (best !== i) {
          this.lastIndex = best;
          this.snap.set(best);
        }
      });
    });
    effect(() => {
      if (this.dragHeight() !== null) return;
      const height = this.snapHeight(this.index());
      this.heightChange.emit(height);
      this.coverChange.emit(height > 0 ? height + this.bottom() : 0);
    });
  }

  private readonly destroyRef = inject(DestroyRef);

  /** Reads the header's and the footer's heights (the footer is 0 without content). */
  protected measure(): void {
    this.headHeight.set(Math.round(this.grab().nativeElement.offsetHeight));
    this.footerHeight.set(Math.round(this.foot().nativeElement.offsetHeight));
  }

  // ----- Keyboard and taps -------------------------------------------------------------------------

  protected onHandleClick(): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    const last = this.snaps().length - 1;
    const firstOpen = this.snaps().findIndex((s) => s > 0);
    this.snap.set(this.index() >= last ? Math.max(0, firstOpen) : this.index() + 1);
  }

  protected onHandleKey(e: KeyboardEvent): void {
    const last = this.snaps().length - 1;
    if (e.key === 'ArrowUp') this.snap.set(Math.min(last, this.index() + 1));
    else if (e.key === 'ArrowDown') this.snap.set(Math.max(0, this.index() - 1));
    else return;
    e.preventDefault();
  }

  /**
   * Closes it (snap 0). If focus is inside, it goes back to where it came from first: the closed
   * sheet is inert, and the browser would otherwise drop focus on <body>. A `persistent` sheet
   * collapses to its smallest snap instead and keeps focus, since it stays on screen.
   */
  close(): void {
    if (this.persistent()) {
      this.snap.set(this.lowest());
      return;
    }
    this.restoreFocus(false);
    this.snap.set(0);
  }

  /** Escape closes it, or collapses a `persistent` sheet to its smallest snap and does nothing there. */
  protected onEscape(): void {
    if (this.persistent() && this.index() === this.lowest()) return;
    this.close();
  }

  /** Hands focus back to where it came from, if it's in the sheet (or, when `fromBody`, lost to <body>). */
  private restoreFocus(fromBody: boolean): void {
    const sheet = this.sheet().nativeElement;
    const back = this.returnFocus;
    this.returnFocus = null;
    const active = document.activeElement;
    const lost = sheet.contains(active) || (fromBody && (!active || active === document.body));
    if (lost && back?.isConnected && !sheet.contains(back)) back.focus();
  }

  protected onFocusIn(e: FocusEvent): void {
    const from = e.relatedTarget;
    // The focus trap's anchors sit just outside the sheet; Tab wrapping through one is not where focus came from.
    if (from instanceof HTMLElement && !this.sheet().nativeElement.contains(from) && !from.classList.contains('cdk-focus-trap-anchor')) this.returnFocus = from;
    if (!this.expandOnFocus() || !(this.touched || window.matchMedia('(pointer: coarse)').matches)) return;
    const target = e.target as Element | null;
    const field = target?.closest('input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable="true"]');
    if (!field) return;
    // The same field getting focus straight back (the browser blurred it for a moment) is not a new
    // focus: the person may have lowered the sheet on purpose.
    if (field === this.expandedFor && e.timeStamp - this.leftAt < REFOCUS_MS) return;
    this.expandedFor = field;
    this.snap.set(this.snaps().length - 1);
  }

  protected onFocusOut(e: FocusEvent): void {
    const to = e.relatedTarget;
    if (!(to instanceof Node) || !this.sheet().nativeElement.contains(to)) this.leftAt = e.timeStamp;
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
      id, startX: x, startY: y, startHeight: this.snapHeight(this.index()), lastY: y, lastAt: at, velocity: 0,
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
    return this.index() < this.snaps().length - 1;
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
