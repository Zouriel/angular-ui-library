import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output } from '@angular/core';

/**
 * `ui-starter-card` — one way to start, for an empty page's `[empty-starters]` slot: an icon in
 * `[starter-icon]`, a heading and one line, the whole card one button (`pressed`). Point it
 * somewhere instead with `href`, which makes it a link.
 */
@Component({
  selector: 'ui-starter-card',
  template: `
    <ng-template #body>
      <span class="icon" aria-hidden="true"><ng-content select="[starter-icon]" /></span>
      <span class="text">
        <span class="heading">{{ heading() }}</span>
        @if (description()) { <span class="desc">{{ description() }}</span> }
      </span>
      <svg class="chev" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </ng-template>
    @if (href()) {
      <a class="card" [attr.href]="href()" (click)="pressed.emit()"><ng-container [ngTemplateOutlet]="body" /></a>
    } @else {
      <button type="button" class="card" [disabled]="disabled()" (click)="pressed.emit()"><ng-container [ngTemplateOutlet]="body" /></button>
    }
  `,
  imports: [NgTemplateOutlet],
  styles: `
    :host { display: block; min-width: 0; }
    .card {
      width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; gap: var(--ui-space-3);
      min-height: 64px; padding: var(--ui-space-3) var(--ui-space-3) var(--ui-space-3) var(--ui-space-3); margin: 0;
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-lg);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      font: inherit; font-family: var(--ui-font-default); line-height: 1.35; text-align: start; text-decoration: none; cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), border-color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .card:hover { background: var(--ui-color-surface-hover); border-color: var(--ui-color-border-strong); }
    .card:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .card:disabled { cursor: not-allowed; color: var(--ui-color-text-disabled); }
    .card:disabled:hover { background: var(--ui-color-surface); border-color: var(--ui-color-border); }
    .icon {
      flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border-radius: var(--ui-radius);
      background: color-mix(in srgb, var(--ui-color-primary) 12%, var(--ui-color-surface));
      color: var(--ui-color-primary); font-size: calc(20px * var(--ui-font-scale));
    }
    .icon:empty { display: none; }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .heading { font-size: var(--ui-font-size-md); font-weight: 600; }
    .desc { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .chev { flex: none; color: var(--ui-color-text-muted); font-size: calc(16px * var(--ui-font-scale)); transform: scaleX(var(--ui-inline-sign, 1)); }
  `,
})
export class UiStarterCard {
  heading = input.required<string>();
  /** One line on what it starts. */
  description = input<string | null>(null);
  /** Makes the card a link. */
  href = input<string | null>(null);
  disabled = input(false);
  readonly pressed = output<void>();
}
