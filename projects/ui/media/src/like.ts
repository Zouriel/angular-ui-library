import { Component, computed, input, output, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import FavouriteIcon from '@hugeicons/core-free-icons/FavouriteIcon';

/** 1234 -> "1.2k", 15400 -> "15k", 1250000 -> "1.2m". Truncated, never rounded up into the next unit. */
export function uiCompactCount(n: number): string {
  const v = Math.max(0, Math.floor(n));
  if (v < 1000) return String(v);
  const [d, s] = v < 1_000_000 ? [1000, 'k'] : [1_000_000, 'm'];
  const x = v / d;
  return (x < 10 ? Math.floor(x * 10) / 10 : Math.floor(x)) + s;
}

/**
 * `ui-like-count`: a small heart and a number for a corner of a photo tile. A dark see-through pill
 * so it reads on any picture. Renders nothing at 0 unless `liked`; the heart is filled when `liked`.
 * Purely a badge (no target): liking is a double tap on the tile or `ui-like-button` in a viewer.
 *
 *   <ui-selectable ...><img .../><ui-like-count class="corner" [count]="p.likes" [liked]="p.mine" /></ui-selectable>
 */
@Component({
  selector: 'ui-like-count',
  imports: [HugeiconsIconComponent],
  host: { '[attr.hidden]': 'shown() ? null : ""', role: 'img', '[attr.aria-label]': 'label()' },
  template: `
    @if (shown()) {
      <span class="pill" [class.liked]="liked()" [attr.data-size]="size()" aria-hidden="true">
        <hugeicons-icon [icon]="heart" [size]="size() === 'md' ? 16 : 13" [strokeWidth]="2" />
        @if (count() > 0) { <span class="n">{{ text() }}</span> }
      </span>
    }
  `,
  styles: `
    :host { display: inline-flex; pointer-events: none; }
    :host([hidden]) { display: none; }
    .pill {
      display: inline-flex; align-items: center; gap: var(--ui-space-1);
      padding: 2px var(--ui-space-2); border-radius: var(--ui-radius-pill);
      background: color-mix(in srgb, var(--ui-media-scrim) 62%, transparent);
      color: var(--ui-media-on-scrim);
      font-family: var(--ui-font-default); font-size: calc(var(--ui-font-size-sm) * 0.92); font-weight: 600;
      line-height: 1.2; font-variant-numeric: tabular-nums;
      -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
    }
    .pill[data-size="md"] { font-size: var(--ui-font-size-sm); padding: var(--ui-space-1) var(--ui-space-2); }
    .pill ::ng-deep svg path { fill: none; }
    .pill.liked ::ng-deep svg path { fill: currentColor; }
  `,
})
export class UiLikeCount {
  readonly count = input(0);
  readonly liked = input(false);
  readonly size = input<'sm' | 'md'>('sm');
  protected readonly heart = FavouriteIcon;
  protected readonly shown = computed(() => this.count() > 0 || this.liked());
  protected readonly text = computed(() => uiCompactCount(this.count()));
  protected readonly label = computed(() => {
    if (!this.shown()) return null;
    const n = `${this.count()} ${this.count() === 1 ? 'like' : 'likes'}`;
    return this.liked() ? `Liked, ${n}` : n;
  });
}

/**
 * `ui-heart-burst`: the heart that pops where a photo was double-tapped. Place it inside the media's
 * positioned box (it covers it and never takes a pointer) and call `play(x, y)` with a point relative
 * to that box, or `play()` for the centre. Several can overlap. Reduced motion: a short fade only.
 */
@Component({
  selector: 'ui-heart-burst',
  imports: [HugeiconsIconComponent],
  host: { 'aria-hidden': 'true' },
  template: `
    @for (b of bursts(); track b.id) {
      <span class="burst" [style.left]="b.x === null ? '50%' : b.x + 'px'" [style.top]="b.y === null ? '50%' : b.y + 'px'"
            (animationend)="done(b.id)">
        <hugeicons-icon [icon]="heart" [size]="size()" [strokeWidth]="1.5" />
      </span>
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1; }
    .burst {
      position: absolute; transform: translate(-50%, -50%) scale(0); color: var(--ui-media-on-scrim);
      filter: drop-shadow(0 4px 14px color-mix(in srgb, var(--ui-media-scrim) 55%, transparent));
      animation: ui-heart-pop 720ms var(--ui-ease-standard) forwards;
    }
    .burst ::ng-deep svg path { fill: currentColor; }
    @keyframes ui-heart-pop {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
      18% { transform: translate(-50%, -50%) scale(1.18); opacity: 1; }
      32% { transform: translate(-50%, -50%) scale(0.94); }
      45% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      78% { transform: translate(-50%, -60%) scale(1); opacity: 1; }
      100% { transform: translate(-50%, -80%) scale(0.9); opacity: 0; }
    }
    @keyframes ui-heart-fade { 0%, 100% { opacity: 0; } 30%, 70% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      .burst { transform: translate(-50%, -50%); animation: ui-heart-fade 400ms linear forwards; }
    }
  `,
})
export class UiHeartBurst {
  /** The heart's size in px. */
  readonly size = input(88);
  private seq = 0;
  protected readonly heart = FavouriteIcon;
  protected readonly bursts = signal<{ id: number; x: number | null; y: number | null }[]>([]);

  /** Pops a heart at (x, y) inside this box, or in its centre. */
  play(x?: number, y?: number): void {
    const id = ++this.seq;
    this.bursts.update((b) => [...b, { id, x: x ?? null, y: y ?? null }]);
    // animationend never comes where animations are off (tests, some reduced-motion settings).
    setTimeout(() => this.done(id), 1000);
  }

  protected done(id: number): void {
    this.bursts.update((b) => b.filter((x) => x.id !== id));
  }
}

/**
 * `ui-like-button`: a heart toggle with its count beside it, for a viewer's toolbar (white on the
 * dark media scrim; `tone="surface"` for an ordinary background). Pops a little when liked.
 * Emits the new state on `(likedChange)`; the count is the caller's to update.
 */
@Component({
  selector: 'ui-like-button',
  imports: [HugeiconsIconComponent],
  template: `
    <button type="button" class="like" [class.liked]="liked()" [class.pop]="popping()" [attr.data-tone]="tone()"
            [disabled]="disabled()" [attr.aria-pressed]="liked()" [attr.aria-label]="label()"
            (click)="toggle()" (animationend)="popping.set(false)">
      <hugeicons-icon [icon]="heart" [size]="22" [strokeWidth]="1.9" />
      @if (count() > 0) { <span class="n" aria-hidden="true">{{ text() }}</span> }
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    .like {
      display: inline-flex; align-items: center; gap: var(--ui-space-1);
      min-height: 44px; min-width: 44px; padding: 0 var(--ui-space-2); justify-content: center;
      border: 0; border-radius: var(--ui-radius-pill); background: transparent; cursor: pointer;
      color: var(--ui-media-on-scrim); font: inherit; font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-sm); font-weight: 600; font-variant-numeric: tabular-nums;
    }
    .like[data-tone="surface"] { color: var(--ui-color-text); }
    .like:hover:not(:disabled) { background: color-mix(in srgb, currentColor 12%, transparent); }
    .like:focus-visible { outline: 2px solid var(--ui-color-primary); outline-offset: 2px; }
    .like:disabled { opacity: 0.5; cursor: default; }
    .like ::ng-deep svg path { fill: none; }
    .like.liked hugeicons-icon { color: var(--ui-color-danger); }
    .like.liked ::ng-deep svg path { fill: currentColor; }
    .like.pop hugeicons-icon { animation: ui-like-pop 320ms var(--ui-ease-standard); }
    @keyframes ui-like-pop { 0% { transform: scale(1); } 40% { transform: scale(1.3); } 100% { transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { .like.pop hugeicons-icon { animation: none; } }
  `,
})
export class UiLikeButton {
  readonly liked = input(false);
  readonly count = input(0);
  readonly disabled = input(false);
  readonly tone = input<'media' | 'surface'>('media');
  readonly likedChange = output<boolean>();
  protected readonly heart = FavouriteIcon;
  protected readonly popping = signal(false);
  protected readonly text = computed(() => uiCompactCount(this.count()));
  protected readonly label = computed(() => `Like, ${this.count()} ${this.count() === 1 ? 'like' : 'likes'}`);

  protected toggle(): void {
    const next = !this.liked();
    if (next) this.popping.set(true);
    this.likedChange.emit(next);
  }
}
