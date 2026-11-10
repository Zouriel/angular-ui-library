import { Component, computed, input, linkedSignal } from '@angular/core';
import type { UiButtonSize } from '@zouriel/ui';

/** A rectangle inside an image, as fractions (0-1) of its width and height. */
export interface UiAvatarCrop { x: number; y: number; w: number; h: number }

/** Where the whole image sits inside the avatar, in percent of the avatar's size. */
export interface UiAvatarCropLayout { width: number; height: number; left: number; top: number }

/**
 * Works out how to place an image so `crop` (grown by `padding` of its size on every side, kept
 * inside the image) fills a round avatar, centred. `aspect` is the image's width over its height.
 * A box that is not square in pixels is covered by its larger side. Returns null for no crop.
 */
export function uiAvatarCropLayout(crop: UiAvatarCrop | null | undefined, padding = 0.25, aspect = 1): UiAvatarCropLayout | null {
  if (!crop || !(crop.w > 0) || !(crop.h > 0)) return null;
  const a = aspect > 0 && isFinite(aspect) ? aspect : 1;
  const pad = padding > 0 ? padding : 0;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const x0 = clamp(crop.x - crop.w * pad, 0, 1), x1 = clamp(crop.x + crop.w * (1 + pad), 0, 1);
  const y0 = clamp(crop.y - crop.h * pad, 0, 1), y1 = clamp(crop.y + crop.h * (1 + pad), 0, 1);
  const w = x1 - x0, h = y1 - y0;
  if (!(w > 0) || !(h > 0)) return null;
  const width = 100 / Math.max(w, h / a);
  const height = 100 / Math.max(w * a, h);
  // Keep the image covering the circle when it can; otherwise centre it.
  const place = (centre: number, size: number) =>
    size >= 100 ? clamp(50 - centre * size, 100 - size, 0) : (100 - size) / 2;
  return { width, height, left: place((x0 + x1) / 2, width), top: place((y0 + y1) / 2, height) };
}

/**
 * `ui-avatar` — user/entity image with graceful initials fallback.
 * Provide `src`+`alt`, or `name` to render initials. Initials also replace an image that fails to load.
 * Sizes sm/md/lg/xl (26/30/38/56px); `dimension` gives any pixel size for a profile photo (the
 * initials scale with it). `crop` shows just a box of the image (a face from a photo) filling the
 * avatar, so no cropped file is needed.
 */
@Component({
  selector: 'ui-avatar',
  template: `
    <span class="ui-avatar" [attr.data-size]="size()" [class.square]="square()"
          [style.width.px]="dimension() ?? null" [style.height.px]="dimension() ?? null"
          [style.font-size.px]="dimension() ? Math.round(dimension()! * 0.38) : null" role="img" [attr.aria-label]="alt() || name() || 'avatar'">
      @if (src() && !failed()) {
        @if (cropLayout(); as c) {
          <img class="cropped" [src]="src()" [alt]="alt() || name() || ''" (error)="failed.set(true)" (load)="onLoad($event)"
               [style.visibility]="aspect() ? null : 'hidden'"
               [style.width.%]="c.width" [style.height.%]="c.height" [style.left.%]="c.left" [style.top.%]="c.top" />
        } @else {
          <img [src]="src()" [alt]="alt() || name() || ''" (error)="failed.set(true)" (load)="onLoad($event)" />
        }
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
    .ui-avatar[data-size="xl"] { width: var(--ui-size-xl); height: var(--ui-size-xl); font-size: calc(21px * var(--ui-font-scale)); }
    .ui-avatar { box-sizing: border-box; flex: none; position: relative; }
    img { width: 100%; height: 100%; object-fit: cover; }
    img.cropped { position: absolute; max-width: none; object-fit: fill; }
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
  /** A box of the image, as fractions, to fill the avatar (e.g. a face); null shows the whole image. */
  crop = input<UiAvatarCrop | null>(null);
  /** How much of the box's size to add on every side so the whole face and hair show. */
  cropPadding = input(0.25);
  protected readonly Math = Math;
  /** The image failed to load; show initials instead. Resets when `src` changes. */
  protected readonly failed = linkedSignal({ source: this.src, computation: () => false });

  /** The loaded image's width over height, needed to keep a crop undistorted. */
  protected readonly aspect = linkedSignal<string | undefined, number | null>({ source: this.src, computation: () => null });
  protected readonly cropLayout = computed(() => uiAvatarCropLayout(this.crop(), this.cropPadding(), this.aspect() ?? 1));

  protected onLoad(e: Event) {
    const i = e.target as HTMLImageElement;
    if (i.naturalWidth > 0 && i.naturalHeight > 0) this.aspect.set(i.naturalWidth / i.naturalHeight);
  }

  protected readonly initials = computed(() => {
    const n = (this.name() ?? '').trim();
    if (!n) return '?';
    const parts = n.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  });
}
