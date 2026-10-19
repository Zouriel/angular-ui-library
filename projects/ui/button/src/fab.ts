import { Component, input } from '@angular/core';

/** `ui-fab` — floating action button, fixed to a screen corner. `label` is required (a11y). */
@Component({
  selector: 'ui-fab',
  template: `
    <button type="button" class="ui-fab" [attr.data-position]="position()" [attr.data-size]="size()"
            [attr.aria-label]="label()" [disabled]="disabled()">
      <ng-content />
    </button>
  `,
  styles: `
    :host { --ui-color-icon: currentColor; } /* always filled: the icon follows its contrast colour */
    .ui-fab {
      position: fixed; z-index: var(--ui-z-docked);
      display: inline-flex; align-items: center; justify-content: center;
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast);
      border: none; box-shadow: var(--ui-shadow-2); cursor: pointer; font-family: var(--ui-font-default); font-size: 22px;
      transition: transform var(--ui-motion-fast) var(--ui-ease-spring), background var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-fab:hover:not(:disabled) { background: var(--ui-color-primary-hover); transform: scale(1.05); }
    .ui-fab:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .ui-fab:focus-visible { outline: none; box-shadow: var(--ui-focus-ring), var(--ui-shadow-2); }
    .ui-fab:disabled { opacity: .5; cursor: not-allowed; }
    .ui-fab[data-size="sm"] { width: 40px; height: 40px; font-size: 18px; }
    /* Offset from the edge plus the device's safe area (notches, home indicator). */
    .ui-fab[data-position="bottom-right"] { right: calc(var(--ui-space-6) + env(safe-area-inset-right, 0px)); bottom: calc(var(--ui-space-6) + env(safe-area-inset-bottom, 0px)); }
    .ui-fab[data-position="bottom-left"] { left: calc(var(--ui-space-6) + env(safe-area-inset-left, 0px)); bottom: calc(var(--ui-space-6) + env(safe-area-inset-bottom, 0px)); }
    .ui-fab[data-position="top-right"] { right: calc(var(--ui-space-6) + env(safe-area-inset-right, 0px)); top: calc(var(--ui-space-6) + env(safe-area-inset-top, 0px)); }
    .ui-fab[data-position="top-left"] { left: calc(var(--ui-space-6) + env(safe-area-inset-left, 0px)); top: calc(var(--ui-space-6) + env(safe-area-inset-top, 0px)); }
    @media (pointer: coarse) { .ui-fab[data-size="sm"] { width: var(--ui-size-touch); height: var(--ui-size-touch); } }
    @media (prefers-reduced-motion: reduce) {
      .ui-fab { transition: transform var(--ui-motion-fast) var(--ui-ease-standard), background var(--ui-motion-base) var(--ui-ease-standard); }
      .ui-fab:hover:not(:disabled) { transform: none; }
    }
  `,
})
export class UiFab {
  label = input.required<string>();
  position = input<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right');
  size = input<'sm' | 'md'>('md');
  disabled = input(false);
}
