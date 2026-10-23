import { Component, HostAttributeToken, inject, input, output } from '@angular/core';
import { UI_CONFIG, type UiSize, injectUiStrings } from '@zouriel/ui';
import type { UiButtonVariant } from './button';

/**
 * `ui-split-button` — a primary action plus a caret that emits `(menu)` for an
 * attached dropdown. Project the main label as content.
 */
@Component({
  selector: 'ui-split-button',
  host: { '[attr.aria-label]': 'null' },
  template: `
    <div class="split" [class.no-radius]="!radius()">
      <button type="button" class="main" [attr.data-variant]="variant()" [attr.data-size]="size()"
              [attr.aria-label]="ariaLabel() ?? staticLabel"
              [disabled]="disabled()" (click)="action.emit()">
        <ng-content />
      </button>
      <button type="button" class="caret" [attr.data-variant]="variant()" [attr.data-size]="size()"
              [attr.aria-label]="menuLabel() ?? strings.moreActions" aria-haspopup="menu"
              [disabled]="disabled()" (click)="menu.emit()"><svg class="chev" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>
  `,
  styles: `
    :host { display: inline-flex; }
    .split { display: inline-flex; }
    button { display: inline-flex; align-items: center; justify-content: center; gap: var(--ui-space-2); box-sizing: border-box;
      border: 1px solid var(--ui-color-border); background: var(--ui-color-surface); color: var(--ui-color-text);
      height: var(--ui-size-md); font-family: var(--ui-font-default); font-size: calc(14px * var(--ui-font-scale)); font-weight: 500;
      letter-spacing: var(--ui-tracking-tight); cursor: pointer;
      transition: background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    button:hover:not(:disabled) { background: var(--ui-color-surface-hover); }
    button:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    button:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); z-index: 1; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .main { padding: 0 var(--ui-space-4); border-radius: var(--ui-radius) 0 0 var(--ui-radius); }
    .caret { padding: 0 var(--ui-space-2); border-left: none; border-radius: 0 var(--ui-radius) var(--ui-radius) 0; }
    .split.no-radius .main, .split.no-radius .caret { border-radius: 0; }
    button[data-variant="primary"] { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent; }
    button[data-variant="primary"]:hover:not(:disabled) { background: var(--ui-color-primary-hover); }
    button[data-variant="primary"]:active:not(:disabled) { background: var(--ui-color-primary-active); }
    button[data-variant="secondary"] { background: var(--ui-color-secondary); color: var(--ui-color-secondary-contrast); border-color: transparent; }
    button[data-variant="secondary"]:hover:not(:disabled) { background: var(--ui-color-secondary-hover); }
    button[data-variant="destructive"] { background: var(--ui-color-danger); color: var(--ui-color-danger-contrast); border-color: transparent; }
    button[data-variant="destructive"]:hover:not(:disabled) { background: var(--ui-color-danger-hover); }
    button[data-variant="primary"], button[data-variant="secondary"], button[data-variant="destructive"] { --ui-color-icon: currentColor; }
    button[data-variant="outline"] { background: transparent; }
    button[data-variant="ghost"] { background: transparent; border-color: transparent; }
    /* Filled variants have a transparent border, so the two halves need their own divider. */
    .caret[data-variant="primary"], .caret[data-variant="secondary"], .caret[data-variant="destructive"] {
      border-left: 1px solid color-mix(in srgb, currentColor 28%, transparent); }
    .chev { flex: none; }
    button[data-size="sm"] { height: var(--ui-size-sm); font-size: calc(13px * var(--ui-font-scale)); }
    button[data-size="lg"] { height: var(--ui-size-lg); font-size: calc(15px * var(--ui-font-scale)); }
    .main[data-size="sm"] { padding: 0 var(--ui-space-3); }
    .main[data-size="lg"] { padding: 0 var(--ui-space-6); }
    @media (pointer: coarse) {
      button { position: relative; }
      button::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: var(--ui-size-touch); transform: translateY(-50%); }
    }

  `,
})
export class UiSplitButton {
  private config = inject(UI_CONFIG);
  variant = input<UiButtonVariant>('primary');
  size = input<UiSize>('md');
  disabled = input(false);
  radius = input<boolean>(this.config.radius);
  action = output<void>();
  menu = output<void>();
  /** Accessible name for the main button, when its text doesn't say enough. A plain `aria-label` works too. */
  ariaLabel = input<string | undefined>(undefined);
  protected readonly staticLabel = inject(new HostAttributeToken('aria-label'), { optional: true });
  /** The menu (caret) button's accessible name; defaults to the built-in moreActions string. */
  menuLabel = input<string | undefined>(undefined);
  protected readonly strings = injectUiStrings();
}
