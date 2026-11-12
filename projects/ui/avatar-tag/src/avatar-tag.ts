import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { UI_CONFIG } from '@zouriel/ui';

/** Where the tag sits: `overlay` on a photo (a dark see-through pill), `plain` on an ordinary surface. */
export type UiAvatarTagVariant = 'overlay' | 'plain';

/** `sm` for a feed post's header, `xs` for the corner of a small tile. */
export type UiAvatarTagSize = 'sm' | 'xs';

/** The first letter of a name, upper case, for the round fallback; '?' for no name. */
export function uiAvatarTagLetter(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  if (!n) return '?';
  return Array.from(n)[0].toLocaleUpperCase();
}

/**
 * `ui-avatar-tag`: a tiny round picture and a name in small text, for a venue or a person on the
 * corner of a photo tile or in a feed post's header. The picture is decorative (alt=""); without
 * one, or when it fails to load, the circle shows the name's first letter. A long name ends in an
 * ellipsis inside whatever width the tag is given (it never grows past its container).
 *
 * `variant="overlay"` (the default) is a dark see-through pill that reads on any picture; with
 * `glass` (the library's `glass` config by default) it blurs the photo behind it and lights its rim.
 * `variant="plain"` sits on a normal surface. Read out as `prefix` + name, e.g. "At Coco Palm".
 *
 *   <ui-avatar-tag class="corner" size="xs" [name]="venue.name" [src]="venue.logo" prefix="At" />
 */
@Component({
  selector: 'ui-avatar-tag',
  host: { role: 'img', '[attr.aria-label]': 'label()' },
  template: `
    <span class="tag" [attr.data-variant]="variant()" [attr.data-size]="size()" [class.glass]="glass()" aria-hidden="true">
      <span class="pic">
        @if (src() && !failed()) {
          <img [src]="src()" alt="" (error)="failed.set(true)" />
        } @else {
          <span class="letter">{{ letter() }}</span>
        }
      </span>
      <span class="name">{{ name() }}</span>
    </span>
  `,
  styles: `
    :host { display: inline-flex; max-width: 100%; min-width: 0; vertical-align: middle; }
    .tag {
      --tag-pic: 20px;
      display: inline-flex; align-items: center; gap: var(--ui-space-1);
      box-sizing: border-box; max-width: 100%; min-width: 0;
      padding: 2px var(--ui-space-2) 2px 2px; border-radius: var(--ui-radius-pill);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); font-weight: 600; line-height: 1.2;
      user-select: none;
    }
    .tag[data-size="xs"] { --tag-pic: 16px; font-size: calc(var(--ui-font-size-sm) * 0.85); padding-inline-end: var(--ui-space-1); }
    .tag[data-variant="overlay"] {
      background: color-mix(in srgb, var(--ui-media-scrim) 62%, transparent);
      color: var(--ui-media-on-scrim);
    }
    .tag[data-variant="overlay"].glass {
      -webkit-backdrop-filter: blur(var(--ui-glass-blur)); backdrop-filter: blur(var(--ui-glass-blur));
      box-shadow: var(--ui-glass-highlight);
    }
    .tag[data-variant="plain"] {
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      box-shadow: inset 0 0 0 1px var(--ui-color-border);
    }
    .tag[data-variant="plain"].glass {
      background: var(--ui-glass-bg); box-shadow: var(--ui-glass-highlight), inset 0 0 0 1px var(--ui-glass-border);
      -webkit-backdrop-filter: blur(var(--ui-glass-blur)); backdrop-filter: blur(var(--ui-glass-blur));
    }
    .pic {
      flex: none; width: var(--tag-pic); height: var(--tag-pic); border-radius: 50%; overflow: hidden;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast);
    }
    .pic img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .letter { font-size: calc(var(--tag-pic) * 0.55); line-height: 1; }
    .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
})
export class UiAvatarTag {
  private readonly config = inject(UI_CONFIG);
  /** The name shown (a venue, a person); also the source of the fallback letter. */
  readonly name = input('');
  /** The picture's URL. Decorative; the first letter shows without it or when it fails. */
  readonly src = input<string | null | undefined>(null);
  /** Words read before the name, e.g. "At" for "At Coco Palm". Not shown. */
  readonly prefix = input<string | null | undefined>(null);
  readonly variant = input<UiAvatarTagVariant>('overlay');
  readonly size = input<UiAvatarTagSize>('sm');
  /** Blur what is behind the tag and light its rim. Defaults to the library's `glass` config. */
  readonly glass = input<boolean>(this.config.glass);

  /** The picture failed to load; resets when `src` changes. */
  protected readonly failed = linkedSignal({ source: this.src, computation: () => false });
  protected readonly letter = computed(() => uiAvatarTagLetter(this.name()));
  protected readonly label = computed(() => [this.prefix()?.trim(), this.name().trim()].filter(Boolean).join(' ') || null);
}
