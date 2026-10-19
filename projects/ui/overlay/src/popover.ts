import {
  CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition,
} from '@angular/cdk/overlay';
import { Component, ElementRef, computed, inject, input, model, viewChild } from '@angular/core';
import { UI_CONFIG } from '@zouriel/ui';

let popoverSeq = 0;

export type UiPopoverPlacement = 'bottom' | 'top' | 'bottom-start' | 'bottom-end';

/**
 * `ui-popover` — click-triggered floating panel anchored to its trigger via the
 * CDK Overlay. Project the trigger with `[popover-trigger]` and the panel body
 * as default content. Dismisses on outside click and Escape. Focus is not moved into the panel;
 * if it is inside when Escape closes it, it goes back to the trigger. The panel is a `role="dialog"`
 * named by `label` when set, and otherwise by the trigger's text (`aria-labelledby`).
 */
@Component({
  selector: 'ui-popover',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <span
      #trigger
      class="trigger"
      [id]="triggerId"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      (click)="toggle()">
      <ng-content select="[popover-trigger]" />
    </span>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions()"
      [cdkConnectedOverlayPush]="true"
      [cdkConnectedOverlayViewportMargin]="8"
      [cdkConnectedOverlayHasBackdrop]="false"
      (overlayOutsideClick)="open.set(false)"
      (detach)="open.set(false)">
      <div
        class="ui-popover"
        [class.glass]="glass()"
        [class.no-radius]="!radius()"
        role="dialog"
        [attr.aria-label]="label() || null"
        [attr.aria-labelledby]="label() ? null : triggerId"
        (keydown.escape)="closeFromPanel()"
        animate.enter="ui-scale-enter"
        animate.leave="ui-scale-leave">
        <ng-content />
      </div>
    </ng-template>
  `,
  styles: `
    .trigger { display: inline-flex; }
    .ui-popover {
      min-width: 180px; max-width: 320px;
      padding: var(--ui-space-3);
      overflow-wrap: anywhere; line-height: 1.35;
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2);
      font-family: var(--ui-font-default);
    }
    .ui-popover.no-radius { border-radius: 0; }
    .ui-popover.glass { background: var(--ui-glass-panel-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
  `,
})
export class UiPopover {
  private config = inject(UI_CONFIG);
  open = model(false);
  placement = input<UiPopoverPlacement>('bottom-start');
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
  /** Accessible name for the panel. Without it the panel is named by the trigger's text. */
  label = input('');

  protected readonly triggerId = `ui-popover-trigger-${popoverSeq++}`;

  private trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  /** Escape from inside the panel: close, and put focus back on the trigger rather than <body>. */
  protected closeFromPanel(): void {
    this.open.set(false);
    const host = this.trigger().nativeElement;
    (host.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])') ?? host).focus();
  }

  /** A computed, not a getter: a fresh array on every check would make the overlay re-apply its positions each time. */
  protected readonly positions = computed<ConnectedPosition[]>(() => {
    const map: Record<UiPopoverPlacement, ConnectedPosition> = {
      'bottom':       { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 4 },
      'bottom-start': { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
      'bottom-end':   { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
      'top':          { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -4 },
    };
    const primary = map[this.placement()];
    return [primary, map['top']];
  });
}
