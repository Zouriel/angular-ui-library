import { Component, computed, input, linkedSignal } from '@angular/core';
import type { UiButtonSize } from '@zouriel/ui';

/**
 * `ui-avatar` — user/entity image with graceful initials fallback.
 * Provide `src`+`alt`, or `name` to render initials. Initials also replace an image that fails to load.
 * Sizes sm/md/lg/xl (26/30/38/56px); `dimension` gives any pixel size for a profile photo (the
 * initials scale with it).
 */
@Component({
  selector: 'ui-avatar',
  template: `
    <span class="ui-avatar" [attr.data-size]="size()" [class.square]="square()"
          [style.width.px]="dimension() ?? null" [style.height.px]="dimension() ?? null"
          [style.font-size.px]="dimension() ? Math.round(dimension()! * 0.38) : null" role="img" [attr.aria-label]="alt() || name() || 'avatar'">
      @if (src() && !failed()) {
        <img [src]="src()" [alt]="alt() || name() || ''" (error)="failed.set(true)" />
      } @else {
        <span class="initials" aria-hidden="true">{{ initials() }}</span>
      }
    </span>
  `,
  styles: `
    :host { display: inline-flex; }
    .ui-avatar {
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--ui-size-md); height: var(--ui-size-md);
      border-radius: 50%; overflow: hidden;
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border);
      font-family: var(--ui-font-default); font-weight: 600; font-size: var(--ui-font-size-sm);
      user-select: none;
    }
    .ui-avatar.square { border-radius: var(--ui-radius); }
    .ui-avatar[data-size="sm"] { width: var(--ui-size-sm); height: var(--ui-size-sm); font-size: 11px; }
    .ui-avatar[data-size="lg"] { width: var(--ui-size-lg); height: var(--ui-size-lg); font-size: var(--ui-font-size-md); }
    .ui-avatar[data-size="xl"] { width: var(--ui-size-xl); height: var(--ui-size-xl); font-size: 21px; }
    .ui-avatar { box-sizing: border-box; flex: none; }
    img { width: 100%; height: 100%; object-fit: cover; }
  `,
})
export class UiAvatar {
  src = input<string>();
  alt = input<string>();
  name = input<string>();
  size = input<UiButtonSize>('md');
  /** A pixel size, for a profile photo bigger than xl (e.g. 96 or 128); overrides `size`. */
  dimension = input<number | null>(null);
  square = input(false);
  protected readonly Math = Math;
  /** The image failed to load; show initials instead. Resets when `src` changes. */
  protected readonly failed = linkedSignal({ source: this.src, computation: () => false });

  protected readonly initials = computed(() => {
    const n = (this.name() ?? '').trim();
    if (!n) return '?';
    const parts = n.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  });
}
