import { Component, HostAttributeToken, inject, input, model } from '@angular/core';
import { UI_CONFIG, type UiSize } from '@zouriel/ui';

/** `ui-toggle-button` — two-state button (`aria-pressed`). Bind `[(pressed)]`. */
@Component({
  selector: 'ui-toggle-button',
  host: { '[attr.aria-label]': 'null' },
  template: `
    <button
      type="button"
      class="ui-toggle"
      [class.pressed]="pressed()"
      [class.no-radius]="!radius()"
      [attr.data-size]="size()"
      [attr.aria-pressed]="pressed()"
      [attr.aria-label]="ariaLabel() ?? staticLabel"
      [disabled]="disabled()"
      (click)="toggle()">
      <ng-content />
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    .ui-toggle {
      display: inline-flex; align-items: center; justify-content: center; gap: var(--ui-space-2);
      height: var(--ui-size-md); padding: 0 var(--ui-space-4);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default); font-size: 14px; font-weight: 500;
      letter-spacing: var(--ui-tracking-tight); cursor: pointer;
      transition: background var(--ui-motion-base) var(--ui-ease-standard), border-color var(--ui-motion-base) var(--ui-ease-standard),
                  transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .ui-toggle:hover:not(:disabled) { background: var(--ui-color-surface-hover); }
    .ui-toggle:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    /* On: a solid primary fill, so it can't be mistaken for the off state in any theme (a light tint
       read as plain grey on the dark themes). */
    .ui-toggle.pressed { --ui-color-icon: currentColor; }
    .ui-toggle.pressed { background: var(--ui-color-primary); border-color: transparent; color: var(--ui-color-primary-contrast); }
    /* Redeclared, not inherited — .ui-toggle:hover:not(:disabled) above has higher specificity
       (one class + two pseudo-classes = (0,3,0)) than the bare .ui-toggle.pressed rule (two
       classes = (0,2,0)), so without this the generic hover background would silently replace
       the pressed highlight while hovering a pressed toggle. */
    .ui-toggle.pressed:hover:not(:disabled) { background: var(--ui-color-primary-hover); border-color: transparent; color: var(--ui-color-primary-contrast); }
    .ui-toggle.no-radius { border-radius: 0; }
    .ui-toggle[data-size="sm"] { height: var(--ui-size-sm); font-size: 13px; padding: 0 var(--ui-space-3); }
    .ui-toggle[data-size="lg"] { height: var(--ui-size-lg); font-size: 15px; padding: 0 var(--ui-space-6); }
    .ui-toggle:disabled { opacity: .5; cursor: not-allowed; }
    .ui-toggle:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    /* Touch: grow the hit area vertically to 44px on coarse pointers only, never sideways
       (so it can't overlap a neighbour in a row); desktop keeps the compact box. */
    @media (pointer: coarse) {
      .ui-toggle { position: relative; }
      .ui-toggle::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: var(--ui-size-touch); transform: translateY(-50%); }
    }
  `,
})
export class UiToggleButton {
  private config = inject(UI_CONFIG);
  /** Accessible name for the inner native control, when its visible text doesn't say enough.
   *  A plain `aria-label="…"` on the element works too. */
  ariaLabel = input<string | undefined>(undefined);
  protected readonly staticLabel = inject(new HostAttributeToken('aria-label'), { optional: true });
  pressed = model(false);
  size = input<UiSize>('md');
  disabled = input(false);
  radius = input<boolean>(this.config.radius);

  protected toggle(): void {
    if (!this.disabled()) this.pressed.update((v) => !v);
  }
}
