import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component, DestroyRef, ElementRef, PLATFORM_ID, afterRenderEffect, computed, inject, input, output, signal, viewChild,
} from '@angular/core';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import CheckmarkSquare02Icon from '@hugeicons/core-free-icons/CheckmarkSquare02Icon';
import RemoveSquareIcon from '@hugeicons/core-free-icons/RemoveSquareIcon';
import { injectUiStrings, uiFormatString } from '@zouriel/ui';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiTooltip } from '@zouriel/ui/overlay';

/** How long a finger must stay down for a long press (ms). */
export const UI_LONG_PRESS_MS = 500;
/** How far it may move before the press stops counting as a long press (px). */
export const UI_LONG_PRESS_SLOP = 10;

/**
 * `ui-selectable`: wraps one grid tile (a photo) for long-press multi-select, like a phone gallery.
 *
 * A click, tap, Enter or Space emits `tap` (the app decides: open the tile, or toggle it while
 * `selecting`). Holding a pointer down for 500ms emits `longPress` (with a short vibration where the
 * browser allows it); moving it more than 10px, a scroll anywhere, or lifting it first cancels the
 * hold, so a finger that scrolls never selects. The click that follows a long press is swallowed, and
 * the phone's own long-press menu and callout are suppressed. From the keyboard, the context-menu key
 * or Shift+F10 is the long press.
 *
 * While `selecting` a round mark sits in the top-start corner: an empty ring over a small scrim, or
 * filled with the primary colour and a check when `selected`, readable on white and black pictures. A
 * selected tile shrinks a little (no animation under reduced motion or with animations off) and gets a
 * primary outline and tint. When not selecting there is no mark and the content is untouched.
 *
 * It is a button named by `label`; while selecting it becomes a checkbox, checked or not.
 */
@Component({
  selector: 'ui-selectable',
  template: `
    <div class="tile" [style.border-radius]="borderRadius()"><ng-content /></div>
    @if (selecting()) {
      <span class="mark" [class.checked]="selected()" aria-hidden="true">
        @if (selected()) {
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        }
      </span>
    }
  `,
  host: {
    tabindex: '0',
    '[attr.role]': "selecting() ? 'checkbox' : 'button'",
    '[attr.aria-checked]': 'selecting() ? selected() : null',
    '[attr.aria-label]': 'label() || null',
    '[class.selecting]': 'selecting()',
    '[class.on]': 'selecting() && selected()',
    '(click)': 'onClick($event)',
    '(keydown)': 'onKey($event)',
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'stop()',
    '(pointercancel)': 'stop()',
    '(lostpointercapture)': 'stop()',
    '(contextmenu)': 'onContextMenu($event)',
    '(dragstart)': '$event.preventDefault()',
  },
  styles: `
    :host {
      position: relative; display: block; cursor: pointer; outline: none;
      -webkit-touch-callout: none; -webkit-user-select: none; user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    :host ::ng-deep img { -webkit-user-drag: none; -webkit-touch-callout: none; }
    .tile {
      position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: var(--ui-radius);
      transition: transform var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-fast) var(--ui-ease-standard);
    }
    /* The outline and tint lie over the content, so a picture can't cover them. */
    .tile::after {
      content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      border: 3px solid transparent; background: transparent;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), background var(--ui-motion-base) var(--ui-ease-standard);
    }
    :host(.on) .tile { transform: scale(0.9); }
    :host(.on) .tile::after { border-color: var(--ui-color-primary); background: color-mix(in srgb, var(--ui-color-primary) 18%, transparent); }
    :host(:focus-visible) .tile { box-shadow: var(--ui-focus-ring); }
    .mark {
      position: absolute; top: var(--ui-space-2); inset-inline-start: var(--ui-space-2);
      width: 24px; height: 24px; box-sizing: border-box; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      /* The light ring shows on dark pictures, the dark halo around it on white ones. */
      border: 2px solid var(--ui-media-on-scrim);
      background: color-mix(in srgb, var(--ui-media-scrim) 35%, transparent);
      box-shadow: 0 0 3px color-mix(in srgb, var(--ui-media-scrim) 40%, transparent);
      color: var(--ui-color-primary-contrast); pointer-events: none;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .mark.checked { background: var(--ui-color-primary); }
    @media (prefers-reduced-motion: reduce) { .tile, .tile::after, .mark { transition: none; } }
    :host-context(.ui-no-anim) .tile, :host-context(.ui-no-anim) .tile::after, :host-context(.ui-no-anim) .mark { transition: none; }
  `,
})
export class UiSelectable {
  readonly selected = input(false);
  /** Whether the grid is in selection mode (the marks show). */
  readonly selecting = input(false);
  /** The tile's accessible name (a picture has no text of its own). */
  readonly label = input<string | null>(null);
  /** The tile's corners (any CSS radius); the theme's radius when null. */
  readonly borderRadius = input<string | null>(null);
  /** A click, tap, Enter or Space (open, or toggle while selecting). */
  readonly tap = output<void>();
  /** Press and hold (start selecting); also the context-menu key and Shift+F10. */
  readonly longPress = output<void>();

  private readonly doc = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private timer: ReturnType<typeof setTimeout> | null = null;
  private start: { x: number; y: number; id: number; touch: boolean } | null = null;
  /** A long press fired for the current press: its click is swallowed. */
  private fired = false;
  private readonly onScroll = () => this.stop();
  /** Any other finger going down anywhere (a pinch starting) cancels a pending long press. */
  private readonly onOtherPointer = (e: PointerEvent) => {
    if (this.start && e.pointerId !== this.start.id) this.stop();
  };
  private readonly onTouches = (e: TouchEvent) => {
    if (this.start && e.touches.length > 1) this.stop();
  };

  constructor() {
    if (this.browser) {
      for (const type of ['touchstart', 'touchend', 'touchcancel'] as const) {
        this.doc.addEventListener(type, this.countTouches, { capture: true, passive: true });
      }
    }
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      if (this.browser) {
        for (const type of ['touchstart', 'touchend', 'touchcancel'] as const) {
          this.doc.removeEventListener(type, this.countTouches, { capture: true });
        }
      }
    });
  }

  protected onDown(e: PointerEvent): void {
    if (e.button !== 0 || !e.isPrimary) return;
    this.stop();
    // A second finger already on the screen: this is a pinch, not a long press.
    if (this.otherTouches(e)) return;
    this.fired = false;
    this.start = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse' };
    this.timer = setTimeout(() => this.fire(), UI_LONG_PRESS_MS);
    if (this.browser) {
      this.doc.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
      this.doc.addEventListener('pointerdown', this.onOtherPointer, { capture: true, passive: true });
      this.doc.addEventListener('touchstart', this.onTouches, { capture: true, passive: true });
    }
  }

  /** Fingers down besides this one, from the touches the browser is tracking. */
  private otherTouches(e: PointerEvent): boolean {
    if (e.pointerType !== 'touch') return false;
    return this.activeTouches > 1;
  }

  /** How many fingers are on the screen, kept from touch events on the document. */
  private activeTouches = 0;
  private readonly countTouches = (e: TouchEvent) => {
    this.activeTouches = e.touches.length;
  };

  protected onMove(e: PointerEvent): void {
    const s = this.start;
    if (!s || e.pointerId !== s.id) return;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > UI_LONG_PRESS_SLOP) this.stop();
  }

  /** Ends the current press without a long press (lifted, moved, scrolled, cancelled). */
  protected stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.start = null;
    if (this.browser) {
      this.doc.removeEventListener('scroll', this.onScroll, { capture: true });
      this.doc.removeEventListener('pointerdown', this.onOtherPointer, { capture: true });
      this.doc.removeEventListener('touchstart', this.onTouches, { capture: true });
    }
  }

  private fire(): void {
    this.timer = null;
    this.fired = true;
    // A short buzz where the browser allows it (Android); silently nothing elsewhere.
    try {
      (this.doc.defaultView?.navigator as Navigator | undefined)?.vibrate?.(10);
    } catch {
      /* not allowed here */
    }
    this.longPress.emit();
  }

  protected onClick(e: MouseEvent): void {
    if (this.fired) {
      this.fired = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    this.tap.emit();
  }

  protected onContextMenu(e: MouseEvent): void {
    // A touch held down: the phone's own menu would open here. Treat it as our long press instead.
    if (this.start?.touch || this.fired) {
      e.preventDefault();
      if (!this.fired) {
        const s = this.start;
        this.stop();
        if (s) this.fire();
      }
    }
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.tap.emit();
    } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault();
      this.longPress.emit();
    }
  }
}

/** One action at the end of a ui-selection-bar (Share, Save, Delete). */
export interface UiSelectionAction {
  /** What `(action)` emits. */
  id: string;
  label: string;
  /** A HugeIcons icon. Needed for the action to shrink to an icon on a narrow bar; one without keeps its label. */
  icon?: IconSvgObject;
  /** Drawn in the destructive style (delete). */
  danger?: boolean;
  /** false greys it out; every action is also off while nothing is selected. Default true. */
  enabled?: boolean;
}

/**
 * `ui-selection-bar`: the bar shown while selecting. Cancel (an X) at the start, "N selected", a
 * Select all toggle that turns into Clear once `count` reaches `total`, then the actions.
 *
 * The toggle emits `selectAll` or `clear`; set `canSelectAll` / `canClear` false to hide a side (and
 * without a `total` it never turns into Clear). Actions are disabled while `count` is 0 or their
 * `enabled` is false. When the labels don't all fit (a 360px phone with three actions), the toggle and
 * the actions with an icon shrink to icon buttons that keep their label as their accessible name and
 * tooltip; then, if "12 selected" still doesn't fit, it shows the number alone (read out in full), so
 * nothing overflows even at 320px. Count changes are announced politely.
 */
@Component({
  selector: 'ui-selection-bar',
  imports: [HugeiconsIconComponent, UiButton, UiIconButton, UiTooltip],
  template: `
    <div class="bar" #bar [class.compact]="compact()">
      <ui-icon-button class="cancel" variant="ghost" size="sm" [label]="strings.cancelSelection" (click)="cancel.emit()">
        <hugeicons-icon [icon]="icons.cancel" [size]="16" [strokeWidth]="1.8" />
      </ui-icon-button>
      <span class="count" #countBox>
        <span aria-hidden="true">{{ short() ? count() : countText() }}</span>
        <span class="sr" aria-live="polite" aria-atomic="true">{{ countText() }}</span>
      </span>
      @if (toggleLabel(); as tl) {
        @if (compact()) {
          <ui-icon-button class="toggle" variant="ghost" size="sm" [label]="tl" [uiTooltip]="tl" (click)="toggle()">
            <hugeicons-icon [icon]="all() ? icons.clear : icons.selectAll" [size]="16" [strokeWidth]="1.8" />
          </ui-icon-button>
        } @else {
          <ui-button class="toggle" variant="ghost" size="sm" (click)="toggle()">{{ tl }}</ui-button>
        }
      }
      @for (a of actions(); track a.id) {
        @if (compact() && a.icon) {
          <ui-icon-button class="act" size="sm" [variant]="a.danger ? 'destructive' : 'ghost'" [label]="a.label" [uiTooltip]="a.label"
            [disabled]="!on(a)" [attr.data-id]="a.id" (click)="press(a)">
            <hugeicons-icon [icon]="a.icon" [size]="16" [strokeWidth]="1.8" />
          </ui-icon-button>
        } @else {
          <ui-button class="act" size="sm" [variant]="a.danger ? 'destructive' : 'ghost'" [disabled]="!on(a)" [attr.data-id]="a.id" (click)="press(a)">
            @if (a.icon) { <hugeicons-icon [icon]="a.icon" [size]="14" [strokeWidth]="1.8" /> }
            {{ a.label }}
          </ui-button>
        }
      }
    </div>
    <!-- The labelled layout, laid out off screen to learn whether it fits. -->
    <div class="measure" #measure aria-hidden="true" inert>
      <span class="m-icon"></span>
      <span class="m-count">{{ countText() }}</span>
      @if (toggleLabel(); as tl) { <span class="m-btn">{{ tl }}</span> }
      @for (a of actions(); track a.id) { <span class="m-btn" [class.m-with-icon]="!!a.icon">{{ a.label }}</span> }
    </div>
  `,
  styles: `
    :host { display: block; position: relative; min-width: 0; }
    .bar {
      display: flex; align-items: center; gap: var(--ui-space-1);
      padding: var(--ui-space-1); min-height: calc(var(--ui-size-md) + var(--ui-space-2)); box-sizing: border-box;
      font-family: var(--ui-font-default); color: var(--ui-color-text);
    }
    .bar > * { flex: none; }
    /* .bar > .count, to beat the .bar > * rule above (Angular's scoping attributes count too). */
    .bar > .count {
      flex: 1 1 0; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
      font-size: var(--ui-font-size-sm); font-weight: 600; font-variant-numeric: tabular-nums;
    }
    @media (pointer: coarse) {
      .bar { min-height: calc(var(--ui-size-touch) + var(--ui-space-2)); }
      /* Icon buttons keep a full touch target in a row of them. */
      .bar.compact ui-icon-button, .bar ui-icon-button.cancel { min-width: var(--ui-size-touch); justify-content: center; }
    }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .measure {
      position: absolute; top: 0; left: 0; width: max-content; visibility: hidden; pointer-events: none; height: 0; overflow: hidden;
      display: flex; gap: var(--ui-space-1); padding: 0 var(--ui-space-1); white-space: nowrap;
      font-family: var(--ui-font-default);
    }
    .m-icon { flex: none; width: var(--ui-size-sm); }
    @media (pointer: coarse) { .m-icon { width: var(--ui-size-touch); } }
    .m-count { flex: none; margin-inline-start: 0; font-size: var(--ui-font-size-sm); font-weight: 600; }
    /* ui-button size sm: 12px padding each side, 1px border, 13px medium text, a 14px icon and an 8px gap. */
    .m-btn { flex: none; padding: 0 calc(var(--ui-space-3) + 1px); font-size: calc(13px * var(--ui-font-scale)); font-weight: 500; letter-spacing: var(--ui-tracking-tight); }
    .m-btn.m-with-icon { padding-inline-start: calc(var(--ui-space-3) + 1px + 14px + var(--ui-space-2)); }
  `,
})
export class UiSelectionBar {
  protected readonly strings = injectUiStrings();
  protected readonly icons = { cancel: Cancel01Icon, selectAll: CheckmarkSquare02Icon, clear: RemoveSquareIcon };

  readonly count = input(0);
  /** Everything there is to select; when `count` reaches it the toggle reads Clear. */
  readonly total = input<number | null>(null);
  readonly actions = input<readonly UiSelectionAction[]>([]);
  /** Show Select all (the web has no "callback is null"; set false to hide it). */
  readonly canSelectAll = input(true);
  /** Show Clear once everything is selected. */
  readonly canClear = input(true);
  readonly selectAll = output<void>();
  readonly clear = output<void>();
  readonly cancel = output<void>();
  /** The id of the action pressed. */
  readonly action = output<string>();

  protected readonly all = computed(() => {
    const t = this.total();
    return t != null && t > 0 && this.count() >= t;
  });
  protected readonly countText = computed(() => uiFormatString(this.strings.selectionCount, { n: this.count() }));
  protected readonly toggleLabel = computed(() =>
    this.all() ? (this.canClear() ? this.strings.clearSelection : null) : this.canSelectAll() ? this.strings.selectAll : null,
  );
  /** The labels don't all fit: icon buttons. */
  readonly compact = signal(false);
  /** Even then "12 selected" doesn't fit: the number alone. */
  readonly short = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly measureEl = viewChild.required<ElementRef<HTMLElement>>('measure');
  private readonly countBox = viewChild.required<ElementRef<HTMLElement>>('countBox');
  private readonly countMeasure = computed(() => this.measureEl().nativeElement.querySelector<HTMLElement>('.m-count'));

  constructor() {
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    afterRenderEffect(() => {
      // Re-measure when anything that changes the labelled width changes.
      this.countText();
      this.toggleLabel();
      this.actions();
      this.compact();
      this.measure();
    });
    if (browser && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.measure());
      ro.observe(this.host.nativeElement);
      inject(DestroyRef).onDestroy(() => ro.disconnect());
    }
  }

  /** Decides compact / short from the room there is (runs on resize and when the content changes). */
  measure(): void {
    const room = this.host.nativeElement.clientWidth;
    const needed = this.measureEl().nativeElement.scrollWidth;
    this.compact.set(room > 0 && needed > room);
    const box = this.countBox().nativeElement.clientWidth;
    const text = this.countMeasure()?.scrollWidth ?? 0;
    this.short.set(box > 0 && text > box);
  }

  protected on(a: UiSelectionAction): boolean {
    return this.count() > 0 && a.enabled !== false;
  }

  protected press(a: UiSelectionAction): void {
    if (this.on(a)) this.action.emit(a.id);
  }

  protected toggle(): void {
    if (this.all()) this.clear.emit();
    else this.selectAll.emit();
  }
}
