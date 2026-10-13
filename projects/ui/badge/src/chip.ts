import { Component, inject, input, output } from '@angular/core';
import { UI_CONFIG, type UiStatus } from '@zouriel/ui';

/** `ui-chip` — compact, optionally-removable tag/token. */
@Component({
  selector: 'ui-chip',
  template: `
    <span class="ui-chip" [attr.data-tone]="tone()" [class.no-radius]="!radius()">
      <ng-content />
      @if (removable()) {
        <button class="x" type="button" [attr.aria-label]="'Remove ' + (label() || 'chip')" (click)="remove.emit()"><svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      }
    </span>
  `,
  styles: `
    :host { display: inline-flex; }
    .ui-chip {
      display: inline-flex; align-items: center; gap: var(--ui-space-1);
      height: var(--ui-size-sm); padding: 0 var(--ui-space-3);
      border-radius: var(--ui-radius-pill); font-size: var(--ui-font-size-sm);
      box-sizing: border-box; max-width: 100%; white-space: nowrap;
      font-family: var(--ui-font-default); line-height: 1.35;
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border);
    }
    .ui-chip.no-radius { border-radius: var(--ui-radius); }
    .ui-chip[data-tone="primary"] { background: color-mix(in srgb, var(--ui-color-primary) 22%, transparent); border-color: var(--ui-color-primary); }
    .ui-chip[data-tone="success"] { background: color-mix(in srgb, var(--ui-color-success) 22%, transparent); border-color: var(--ui-color-success); }
    .ui-chip[data-tone="warning"] { background: color-mix(in srgb, var(--ui-color-warning) 22%, transparent); border-color: var(--ui-color-warning); }
    .ui-chip[data-tone="danger"] { background: color-mix(in srgb, var(--ui-color-danger) 22%, transparent); border-color: var(--ui-color-danger); }
    /* 24x24 hit box (WCAG 2.5.8) that still paints a 16px circle: 4px padding outside the painted
       background, negative margins so the chip keeps its size. It fits inside the 26px chip, so
       it never reaches over a neighbouring chip. */
    .x {
      position: relative; box-sizing: border-box;
      display: inline-flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; border: none; border-radius: 50%;
      flex: none; padding: 4px; margin: -4px calc(var(--ui-space-1) * -2) -4px calc(var(--ui-space-1) * -1);
      background: transparent; background-clip: content-box; color: inherit; cursor: pointer;
      font: inherit; font-size: 12px; line-height: 1;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard);
    }
    /* Touch-only hit-slop. On desktop it would reach over neighbouring chips and remove the wrong one. */
    @media (pointer: coarse) {
      .x::before { content: ''; position: absolute; inset: calc((24px - var(--ui-size-touch)) / 2); }
    }
    .x:hover { background-color: color-mix(in srgb, currentColor 18%, transparent); }
    .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  `,
})
export class UiChip {
  private config = inject(UI_CONFIG);
  tone = input<UiStatus>('neutral');
  removable = input(false);
  /** Used to build the remove button's accessible name. */
  label = input<string>();
  radius = input<boolean>(this.config.radius);
  remove = output<void>();
}
