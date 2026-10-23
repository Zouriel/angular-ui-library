import { Component, inject, input, output } from '@angular/core';
import { UI_CONFIG, injectUiStrings } from '@zouriel/ui';

export type UiAlertTone = 'info' | 'success' | 'warning' | 'danger';

/** `ui-alert` — inline contextual message. Uses role="alert" for danger/warning. */
@Component({
  selector: 'ui-alert',
  template: `
    <div
      class="ui-alert"
      [attr.data-tone]="tone()"
      [class.no-radius]="!radius()"
      [attr.role]="tone() === 'danger' || tone() === 'warning' ? 'alert' : 'status'">
      <span class="icon" aria-hidden="true">
          @switch (tone()) {
            @case ('success') { <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM8 12.5l2.7 2.7L16 9.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
            @case ('warning') { <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M10.3 4.2L2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0zM12 9.5v4M12 17h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
            @case ('danger') { <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM9.5 9.5l5 5M14.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
            @default { <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 8h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
          }
      </span>
      <div class="content">
        @if (heading()) { <strong class="title">{{ heading() }}</strong> }
        <div class="body"><ng-content /></div>
      </div>
      @if (dismissible()) {
        <button class="x" type="button" [attr.aria-label]="strings.dismiss" (click)="dismiss.emit()"><svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-alert {
      display: flex; gap: var(--ui-space-2); align-items: flex-start;
      padding: var(--ui-space-2) var(--ui-space-3);
      border: 1px solid var(--ui-color-border); border-left-width: 3px;
      border-radius: var(--ui-radius);
      background: var(--ui-color-surface);
      color: var(--ui-color-text); font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-md); line-height: 1.35;
    }
    .ui-alert.no-radius { border-radius: 0; }
    /* One line tall, so the icon centres on the first line of text. */
    .icon { flex: none; display: inline-flex; align-items: center; height: 1.35em; color: var(--ui-color-info); }
    .ui-alert[data-tone="success"] .icon { color: var(--ui-color-success); }
    .ui-alert[data-tone="warning"] .icon { color: var(--ui-color-warning); }
    .ui-alert[data-tone="danger"]  .icon { color: var(--ui-color-danger); }
    .content { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .title { display: block; margin-bottom: 2px; letter-spacing: var(--ui-tracking-tight); }
    .body { color: var(--ui-color-text-muted); }
    .ui-alert { --ui-color-icon: currentColor; }
    .ui-alert[data-tone="info"]    { border-left-color: var(--ui-color-info); }
    .ui-alert[data-tone="success"] { border-left-color: var(--ui-color-success); }
    .ui-alert[data-tone="warning"] { border-left-color: var(--ui-color-warning); }
    .ui-alert[data-tone="danger"]  { border-left-color: var(--ui-color-danger); }
    .x {
      position: relative; flex: none;
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--ui-size-sm); height: var(--ui-size-sm); padding: 0; margin: calc(var(--ui-space-1) * -1);
      border: none; background: transparent; border-radius: var(--ui-radius-xs);
      color: var(--ui-color-text-muted); font: inherit; font-size: calc(16px * var(--ui-font-scale)); line-height: 1; cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard),
                  transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .x:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .x:active { transform: scale(var(--ui-scale-press)); }
    .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    /* Touch-only hit-slop: the visible box stays compact on desktop. */
    @media (pointer: coarse) { .x::before { content: ''; position: absolute; inset: calc((var(--ui-size-sm) - var(--ui-size-touch)) / 2); } }
  `,
})
export class UiAlert {
  protected readonly strings = injectUiStrings();
  private config = inject(UI_CONFIG);
  tone = input<UiAlertTone>('info');
  heading = input<string>();
  dismissible = input(false);
  radius = input<boolean>(this.config.radius);
  dismiss = output<void>();

}
