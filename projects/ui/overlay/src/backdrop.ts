import { Component, input, output } from '@angular/core';
import { UI_ANIM, uiLeaveHidden } from '@zouriel/ui';

/**
 * `ui-backdrop` — full-viewport scrim behind overlays. Emits `(backdropClick)`.
 * Render conditionally with `@if`; it animates via the shared backdrop fade.
 */
@Component({
  selector: 'ui-backdrop',
  template: `
    <div
      class="ui-backdrop"
      [class.blur]="blur()"
      (click)="backdropClick.emit()"
      animate.enter="ui-backdrop-enter"
      (animate.leave)="backdropLeave($event)"></div>
  `,
  styles: `
    .ui-backdrop { position: fixed; inset: 0; z-index: var(--ui-z-overlay); background: var(--ui-color-overlay); }
    .ui-backdrop.blur { backdrop-filter: blur(3px); }
  `,
})
export class UiBackdrop {
  /** Fades the backdrop out and keeps it at 0 until the panel's longer leave ends (no flash back). */
  protected readonly backdropLeave = uiLeaveHidden(UI_ANIM.backdrop.leave);

  blur = input(false);
  backdropClick = output<void>();
}
