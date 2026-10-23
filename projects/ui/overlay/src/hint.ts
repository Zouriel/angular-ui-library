import { Overlay, OverlayRef, type ConnectedPosition } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, Directive, ElementRef, NgZone, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';

/** Which side of its anchor a hint opens on. `start` / `end` follow the text direction. */
export type UiHintPlacement = 'top' | 'bottom' | 'start' | 'end';

/** Why a hint closed: its time ran out, a tap on it (or its ×, or its anchor), or Escape. */
export type UiHintCloseReason = 'timeout' | 'tap' | 'escape';

const OPPOSITE: Record<UiHintPlacement, UiHintPlacement> = { top: 'bottom', bottom: 'top', start: 'end', end: 'start' };

/** Along a side: centred on the anchor, else lined up with its start edge, else its end edge. */
type UiHintAlign = 'center' | 'start' | 'end';
/** Anchor to bubble: the arrow (7px) plus a 3px breath. */
const GAP = 10;

let hintSeq = 0;

/** The callout itself, rendered in a CDK overlay. Internal: use the `uiHint` directive. */
@Component({
  selector: 'ui-hint-panel',
  host: { '[attr.data-side]': 'side()', '[style.--ui-hint-arrow.px]': 'arrow()' },
  template: `
    <div class="ui-hint" [id]="id" role="status" aria-live="polite" aria-atomic="true" (click)="tapped()">
      <span class="text">{{ shown() }}</span>
      @if (dismissible()) {
        <button type="button" class="x" [attr.aria-label]="strings.dismiss" (click)="$event.stopPropagation(); tapped()">
          <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      }
      <span class="arrow" aria-hidden="true"></span>
    </div>
  `,
  styles: `
    :host { display: block; position: relative; }
    .ui-hint {
      position: relative; display: flex; align-items: flex-start; gap: var(--ui-space-2);
      max-width: 280px; box-sizing: border-box; padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast);
      border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-2);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.4;
      overflow-wrap: anywhere; cursor: pointer;
      animation: ui-hint-in var(--ui-motion-base) var(--ui-ease-decelerate) both;
    }
    .text { flex: 1; min-width: 0; }
    .x {
      position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; margin: 0 calc(var(--ui-space-1) * -1) 0 0; padding: 0;
      border: 0; border-radius: var(--ui-radius-xs); background: transparent; color: inherit;
      font: inherit; font-size: calc(14px * var(--ui-font-scale)); line-height: 1; cursor: pointer; opacity: .85;
    }
    .x:hover { opacity: 1; background: color-mix(in srgb, var(--ui-color-primary-contrast) 14%, transparent); }
    .x:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--ui-color-primary-contrast); }
    @media (pointer: coarse) { .x::before { content: ''; position: absolute; inset: calc((20px - var(--ui-size-touch)) / 2); } }
    /* A square turned 45 degrees, half of it outside the bubble, on the side facing the anchor;
       --ui-hint-arrow is its offset along that side, so it points at the anchor's centre. */
    .arrow {
      position: absolute; width: 10px; height: 10px; background: inherit; transform: rotate(45deg);
      pointer-events: none;
    }
    :host([data-side="top"]) .arrow { bottom: -5px; left: calc(var(--ui-hint-arrow, 20px) - 5px); }
    :host([data-side="bottom"]) .arrow { top: -5px; left: calc(var(--ui-hint-arrow, 20px) - 5px); }
    :host([data-side="left"]) .arrow { right: -5px; top: calc(var(--ui-hint-arrow, 16px) - 5px); }
    :host([data-side="right"]) .arrow { left: -5px; top: calc(var(--ui-hint-arrow, 16px) - 5px); }
    @keyframes ui-hint-in { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) {
      .ui-hint { animation-name: ui-hint-fade; }
      @keyframes ui-hint-fade { from { opacity: 0; } to { opacity: 1; } }
    }
  `,
})
export class UiHintPanel {
  protected readonly strings = injectUiStrings();
  readonly id = `ui-hint-${hintSeq++}`;
  /** The text announced and shown (set a beat after the panel appears, so it is announced). */
  readonly shown = signal('');
  readonly dismissible = signal(false);
  /** The physical side of the anchor the hint sits on (start/end already resolved). */
  readonly side = signal<'top' | 'bottom' | 'left' | 'right'>('top');
  /** Offset of the arrow along that side, in px from the panel's left or top edge. */
  readonly arrow = signal<number | null>(null);
  onTap: () => void = () => {};

  protected tapped(): void {
    this.onTap();
  }
}

/**
 * `uiHint` — a coachmark: a small callout pointed at an element, opened from code.
 *
 *   <ui-icon-button [uiHint]="'Tap to record a voice note'" [(uiHintOpen)]="showHint" uiHintPlacement="top" />
 *
 * Not a dialog: it is a polite live region (`role="status"`), never takes focus and never blocks
 * typing or the pointer outside itself. It closes on a tap on it or on its anchor, Escape, or after
 * `uiHintDuration` ms (0 keeps it until dismissed), and reports why in `(uiHintClosed)`. Above or
 * below, it slides along that side to stay on screen, and flips to the opposite side only when there
 * is no room; it never moves beside the anchor unless placed there. It follows the anchor when it
 * moves, follows the theme (the primary colour), and only fades under reduced motion.
 */
@Directive({
  selector: '[uiHint]',
  host: {
    '(click)': 'anchorTapped()',
    '[attr.aria-describedby]': 'describedBy()',
  },
})
export class UiHint {
  /** The hint's text. */
  text = input.required<string>({ alias: 'uiHint' });
  /** Whether it is showing. Set true to open it; it sets itself false when it closes. */
  open = model(false, { alias: 'uiHintOpen' });
  /** The side it prefers; `start` and `end` follow the text direction. */
  placement = input<UiHintPlacement>('top', { alias: 'uiHintPlacement' });
  /** How long it stays, in ms; 0 keeps it until it is tapped or Escape is pressed. */
  duration = input(6000, { alias: 'uiHintDuration' });
  /** Show a small × button (it closes with reason 'tap'). */
  dismissible = input(false, { alias: 'uiHintDismissible' });
  /** It closed by itself or by the person, with the reason. Not emitted when the app closes it. */
  readonly closed = output<UiHintCloseReason>({ alias: 'uiHintClosed' });

  private readonly overlay = inject(Overlay);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private ref: OverlayRef | null = null;
  private panel: UiHintPanel | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopKeys: (() => void) | null = null;
  protected readonly describedBy = signal<string | null>(null);

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => (open ? this.show() : this.hide()));
    });
    // Text and options changed while open: show the new text, restart the timer.
    effect(() => {
      const text = this.text();
      const dismissible = this.dismissible();
      this.duration();
      untracked(() => {
        if (!this.panel) return;
        this.panel.shown.set(text);
        this.panel.dismissible.set(dismissible);
        this.arm();
        this.ref?.updatePosition();
      });
    });
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  protected anchorTapped(): void {
    if (this.ref) this.close('tap');
  }

  private close(reason: UiHintCloseReason): void {
    if (!this.ref) return;
    this.hide();
    this.open.set(false);
    this.closed.emit(reason);
  }

  private show(): void {
    if (this.ref || !this.text()) return;
    const anchor = this.anchor();
    const rtl = this.doc.defaultView?.getComputedStyle(anchor).direction === 'rtl';
    const preferred = this.placement();
    // Above or below: stay on that side and slide along it (centred, then lined up with either
    // edge of the anchor) before trying the opposite side; never move beside the anchor, where it
    // would cover what sits next to it (a field around an icon). Start or end: that side, the
    // opposite one, then above or below.
    const vertical = preferred === 'top' || preferred === 'bottom';
    const sides = vertical ? [preferred, OPPOSITE[preferred]] : [preferred, OPPOSITE[preferred], 'top', 'bottom'] as UiHintPlacement[];
    const aligns: UiHintAlign[] = ['center', 'start', 'end'];
    const order = sides.flatMap((p) => (p === 'top' || p === 'bottom' ? aligns.map((a) => this.positionFor(p, rtl, a)) : [this.positionFor(p, rtl)]));
    const strategy = this.overlay.position()
      .flexibleConnectedTo(anchor)
      .withPositions(order)
      .withFlexibleDimensions(false)
      .withPush(true)
      .withViewportMargin(8);
    this.ref = this.overlay.create({
      positionStrategy: strategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      direction: rtl ? 'rtl' : 'ltr',
      panelClass: 'ui-hint-pane',
    });
    const panel = (this.panel = this.ref.attach(new ComponentPortal(UiHintPanel)).instance);
    panel.dismissible.set(this.dismissible());
    panel.onTap = () => this.close('tap');
    panel.side.set(this.physical(preferred, rtl));
    strategy.positionChanges.subscribe((change) => {
      const p = change.connectionPair as ConnectedPosition & { ['uiSide']?: UiHintPlacement };
      panel.side.set(this.physical(p.uiSide ?? preferred, rtl));
      this.aimArrow();
    });
    this.describedBy.set(panel.id);
    // Empty first, then the text: a live region announces what changes in it, not what it was born with.
    setTimeout(() => {
      if (this.panel !== panel) return;
      panel.shown.set(this.text());
      this.ref?.updatePosition();
      this.aimArrow();
    }, 30);
    this.arm();
    // Escape anywhere closes it; the key still reaches whatever has focus (typing is never blocked).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.zone.run(() => this.close('escape'));
    };
    this.zone.runOutsideAngular(() => this.doc.addEventListener('keydown', onKey, true));
    // Follow the anchor: it can move without the page scrolling or resizing (Thaana typed into a
    // field swaps its slot icons to the other side). A frame loop compares its box while open.
    const view = this.doc.defaultView;
    let last = '';
    let frame = 0;
    const follow = () => {
      if (!this.ref) return;
      const r = anchor.getBoundingClientRect();
      const key = `${r.left},${r.top},${r.width},${r.height}`;
      if (key !== last) {
        if (last) {
          this.ref.updatePosition();
          this.aimArrow();
        }
        last = key;
      }
      frame = view?.requestAnimationFrame(follow) ?? 0;
    };
    if (view?.requestAnimationFrame) this.zone.runOutsideAngular(() => (frame = view.requestAnimationFrame(follow)));
    this.stopKeys = () => {
      this.doc.removeEventListener('keydown', onKey, true);
      if (frame) view?.cancelAnimationFrame(frame);
    };
  }

  /** (Re)starts the timeout. */
  private arm(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const ms = this.duration();
    if (this.ref && ms > 0) this.timer = setTimeout(() => this.close('timeout'), ms);
  }

  private hide(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stopKeys?.();
    this.stopKeys = null;
    this.ref?.dispose();
    this.ref = null;
    this.panel = null;
    this.describedBy.set(null);
  }

  /** Points the arrow at the anchor's centre, wherever push moved the bubble along its side. */
  private aimArrow(): void {
    const panel = this.panel;
    const pane = this.ref?.overlayElement;
    if (!panel || !pane) return;
    const a = this.anchor().getBoundingClientRect();
    const b = pane.getBoundingClientRect();
    if (!b.width && !b.height) return;
    const side = panel.side();
    // Keep clear of the rounded corners.
    const clamp = (v: number, max: number) => Math.max(16, Math.min(max - 16, v));
    panel.arrow.set(
      side === 'top' || side === 'bottom'
        ? Math.round(clamp(a.left + a.width / 2 - b.left, b.width))
        : Math.round(clamp(a.top + a.height / 2 - b.top, b.height)),
    );
  }

  private physical(p: UiHintPlacement, rtl: boolean): 'top' | 'bottom' | 'left' | 'right' {
    if (p === 'start') return rtl ? 'right' : 'left';
    if (p === 'end') return rtl ? 'left' : 'right';
    return p;
  }

  /** As uiTooltip: on a component host that only wraps its control, point at the drawn control. */
  private anchor(): HTMLElement {
    let el = this.el.nativeElement;
    while (el.tagName.includes('-') && el.childElementCount === 1) el = el.firstElementChild as HTMLElement;
    return el;
  }

  private positionFor(p: UiHintPlacement, rtl: boolean, align: UiHintAlign = 'center'): ConnectedPosition {
    // CDK resolves start/end against the overlay's direction, so these swap in RTL; its offsets are
    // physical, so the gap's sign flips with them.
    const x = rtl ? -GAP : GAP;
    const pos: ConnectedPosition = (() => {
      switch (p) {
        case 'bottom': return { originX: align, originY: 'bottom', overlayX: align, overlayY: 'top', offsetY: GAP };
        case 'start': return { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -x };
        case 'end': return { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: x };
        default: return { originX: align, originY: 'top', overlayX: align, overlayY: 'bottom', offsetY: -GAP };
      }
    })();
    return Object.assign(pos, { uiSide: p });
  }
}
