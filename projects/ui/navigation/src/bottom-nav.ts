import { Component, inject, input, model } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import type { IconSvgObject } from '@hugeicons/angular';
import { UI_CONFIG } from '@zouriel/ui';

export interface UiBottomNavItem {
  label: string;
  value: string;
  /**
   * A HugeIcons icon, or a short string (an emoji, a letter) for the simplest cases.
   *
   * <p>It used to be a string only, which meant the icon was whatever glyph the reader's font
   * happened to have. Most of them do not have one for U+23FB POWER SYMBOL, so a perfectly working
   * sign-out button rendered as an empty box and read as broken. A real icon draws the same
   * everywhere, and inherits `currentColor` so it still follows the active state.</p>
   */
  icon?: string | IconSvgObject;
  badge?: string | number;
}

/** `ui-bottom-nav` — mobile-style bottom navigation bar (glass-capable). */
@Component({
  selector: 'ui-bottom-nav',
  imports: [HugeiconsIconComponent],
  template: `
    <nav class="bn" [class.glass]="glass()" role="tablist">
      @for (item of items(); track item.value) {
        <button type="button" class="item" role="tab" [class.active]="item.value === active()"
                [attr.aria-selected]="item.value === active()" (click)="active.set(item.value)">
          <span class="icon" aria-hidden="true">
            @if (isSvg(item.icon)) {
              <hugeicons-icon [icon]="item.icon" [size]="iconSize()" [strokeWidth]="1.8" />
            } @else {
              {{ item.icon }}
            }
            @if (item.badge) { <span class="badge">{{ item.badge }}</span> }
          </span>
          <span class="label">{{ item.label }}</span>
        </button>
      }
    </nav>
  `,
  styles: `
    :host { display: block; }
    .bn { display: flex; align-items: stretch; height: 56px; background: var(--ui-color-surface);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; font-family: var(--ui-font-default); }
    .bn.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
      background: none; border: none; cursor: pointer; color: var(--ui-color-text-muted); font: inherit; }
    .item.active { color: var(--ui-color-primary); }
    .item:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    /* Flex so a drawn icon sits on the text baseline the same way a glyph did. */
    .icon { position: relative; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; }
    .badge { position: absolute; top: -4px; right: -8px; min-width: 14px; height: 14px; padding: 0 3px; box-sizing: border-box;
      background: var(--ui-color-danger); color: #fff; border-radius: 999px; font-size: 9px; line-height: 14px; text-align: center; }
    .label { font-size: 11px; }
  `,
})
export class UiBottomNav {
  private config = inject(UI_CONFIG);
  items = input<UiBottomNavItem[]>([]);
  active = model<string>('');
  glass = input<boolean>(this.config.glass);
  /** Drawn-icon size in px. Ignored by string icons, which follow `.icon`'s font-size. */
  iconSize = input<number>(22);

  /**
   * A HugeIcons icon is an array of [tag, attributes] pairs; a legacy icon is a string. Narrowing on
   * the shape rather than on a flag keeps both spellings working with no migration.
   */
  protected isSvg(icon: string | IconSvgObject | undefined): icon is IconSvgObject {
    return Array.isArray(icon);
  }
}
