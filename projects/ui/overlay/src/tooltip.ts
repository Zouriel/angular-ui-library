import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  Component, Directive, ElementRef, inject, input, OnDestroy, signal,
} from '@angular/core';

export type UiTooltipPosition = 'top' | 'bottom' | 'left' | 'right';

let tooltipSeq = 0;

const OPPOSITE: Record<UiTooltipPosition, UiTooltipPosition> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/** Internal panel rendered inside the CDK overlay. */
@Component({
  selector: 'ui-tooltip-panel',
  template: `<div class="ui-tooltip" role="tooltip" [id]="id">{{ text() }}</div>`,
  styles: `
    .ui-tooltip {
      max-width: 240px; padding: var(--ui-space-1) var(--ui-space-2);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-xs);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.35;
      overflow-wrap: anywhere;
      box-shadow: var(--ui-shadow-1); pointer-events: none;
      animation: ui-fade-in var(--ui-motion-fast) var(--ui-ease-standard);
    }
    @media (prefers-reduced-motion: reduce) { .ui-tooltip { animation: none; } }
  `,
})
export class UiTooltipPanel {
  readonly text = signal('');
  id = `ui-tooltip-${tooltipSeq++}`;
}

/**
 * `uiTooltip` — accessible hover/focus tooltip backed by the CDK Overlay.
 * Sets `aria-describedby` on the host so screen readers announce it.
 *
 * On touch (0.58.0) a long press (500ms held still) shows it, as on phones; it hides 1.5s after the
 * finger lifts, and that press doesn't count as a tap: the click it would end in is swallowed, and
 * the browser's own long-press menu doesn't open.
 */
@Directive({
  selector: '[uiTooltip]',
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focusin)': 'show()',
    '(focusout)': 'hide()',
    '(keydown.escape)': 'hide()',
    '(touchstart)': 'touchStart($event)',
    '(touchmove)': 'touchMove($event)',
    '(touchend)': 'touchEnd()',
    '(touchcancel)': 'touchEnd()',
    '(contextmenu)': 'contextMenu($event)',
    '[attr.aria-describedby]': 'describedBy()',
  },
})
export class UiTooltip implements OnDestroy {
  text = input.required<string>({ alias: 'uiTooltip' });
  position = input<UiTooltipPosition>('top', { alias: 'uiTooltipPosition' });

  private overlay = inject(Overlay);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private ref: OverlayRef | null = null;
  private panel: UiTooltipPanel | null = null;
  protected readonly describedBy = signal<string | null>(null);
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private pressStart: { x: number; y: number } | null = null;
  /** A long press showed the tooltip: the click that ends it is not a tap. */
  private longPressed = false;

  constructor() {
    // Capture on the host itself runs before the element's own (click) handlers.
    this.el.nativeElement.addEventListener('click', (e) => {
      if (!this.longPressed) return;
      this.longPressed = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, { capture: true });
  }

  protected touchStart(e: TouchEvent): void {
    if (!this.text() || e.touches.length !== 1) return;
    this.clearTimers();
    this.longPressed = false;
    this.pressStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    this.pressTimer = setTimeout(() => {
      this.pressTimer = null;
      this.longPressed = true;
      this.show();
    }, 500);
  }

  protected touchMove(e: TouchEvent): void {
    const t = e.touches[0];
    if (!this.pressStart || !t) return;
    if (Math.hypot(t.clientX - this.pressStart.x, t.clientY - this.pressStart.y) > 10) this.cancelPress();
  }

  protected touchEnd(): void {
    this.pressStart = null;
    if (this.pressTimer) this.cancelPress();
    if (this.longPressed) {
      this.hideTimer = setTimeout(() => this.hide(), 1500);
      // A click doesn't always follow (the finger moved, or the browser chose not to): forget the
      // press soon so the next real tap still works.
      setTimeout(() => (this.longPressed = false), 700);
    }
  }

  protected contextMenu(e: Event): void {
    if (this.longPressed || this.pressTimer) e.preventDefault();
  }

  private cancelPress(): void {
    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = null;
    this.pressStart = null;
  }

  private clearTimers(): void {
    this.cancelPress();
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  protected show(): void {
    if (this.ref || !this.text()) return;
    const pos = this.positionFor(this.position());
    this.ref = this.overlay.create({
      positionStrategy: this.overlay.position()
        .flexibleConnectedTo(this.anchor())
        // The opposite side as a fallback, so a tooltip near a screen edge flips rather than being
        // pushed back over the element it describes.
        .withPositions([pos, this.positionFor(OPPOSITE[this.position()])])
        .withPush(true)
        .withViewportMargin(8),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });
    const componentRef = this.ref.attach(new ComponentPortal(UiTooltipPanel));
    this.panel = componentRef.instance;
    this.panel.text.set(this.text());
    this.describedBy.set(this.panel.id);
  }

  protected hide(): void {
    this.ref?.dispose();
    this.ref = null;
    this.panel = null;
    this.describedBy.set(null);
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.hide();
  }

  /**
   * The box the tooltip points at. On a component host that only wraps the control it draws
   * (`<ui-button uiTooltip>`), that's the drawn control: a parent's flex or grid layout can stretch
   * the host far wider than the button, and centring on the host put the tooltip hundreds of px away.
   */
  private anchor(): HTMLElement {
    let el = this.el.nativeElement;
    while (el.tagName.includes('-') && el.childElementCount === 1) el = el.firstElementChild as HTMLElement;
    return el;
  }

  private positionFor(p: UiTooltipPosition) {
    const gap = 4;
    switch (p) {
      case 'bottom': return { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: gap } as const;
      case 'left':   return { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -gap } as const;
      case 'right':  return { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: gap } as const;
      default:       return { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -gap } as const;
    }
  }
}
