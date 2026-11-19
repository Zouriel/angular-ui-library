import { Component, ElementRef, booleanAttribute, input, signal, viewChild } from '@angular/core';

let fabSeq = 0;

/**
 * Where a `ui-fab` sits (0.44.0 adds the logical and centred ones, Flutter `UiFabPosition`): a top or
 * bottom corner at the inline start or end (mirrored in RTL), or centred. The physical
 * 'bottom-right' / 'bottom-left' / 'top-right' / 'top-left' still work.
 */
export type UiFabPlacement =
  | 'top-start' | 'top-center' | 'top-end'
  | 'bottom-start' | 'bottom-center' | 'bottom-end'
  | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

/**
 * A fab's colour:
 * - `'primary'` (default): primary fill with contrast ink.
 * - `'danger'` (0.44.0): high-visibility SOS style with danger fill, raised-surface ring and halo.
 * - `'inverted'`: high-contrast ink fill (`--ui-color-text`) with inverse ink (`--ui-color-bg`),
 *   1 px hairline ring and shadow across both light and dark themes.
 */
export type UiFabTone = 'primary' | 'danger' | 'inverted';

/**
 * `ui-fab` — floating action button, fixed to a screen corner (or centred at the top or bottom),
 * or laid out inline in a container when `position="static"`. `label` is required (a11y).
 *
 * - `position`: a corner or a centred top/bottom spot, offset from the edge by `--ui-space-6` plus
 *   the device's safe area, so a top fab sits below the status bar and notch, never over them; or
 *   `'static'` to lay it out in normal flow (e.g. inside `ui-speed-dial`).
 * - `tone`: `'danger'` (0.44.0) is the high-visibility style for an SOS button; `'inverted'` is
 *   a high-contrast inverted fill with a 1 px hairline ring and elevated shadow in light and dark.
 * - `text` (0.44.0): a visible word beside the icon ("SOS"), making it a pill. Keep it in `label`
 *   too (the accessible name should contain the visible text).
 * - `aboveOverlays` (0.44.0): stays above bottom sheets, drawers and modal backdrops
 *   (`--ui-z-overlay` + 1), below floating windows and toasts. Off by default: an everyday fab sits
 *   under them.
 * - `topOffset` (0.44.0): px added below the top edge for the top placements, so a top fab sits just
 *   under the app's own top bar rather than over it.
 * - `bottomOffset` (0.47.1, Flutter `UiFabHost.bottomOffset`): px added above the bottom edge for the
 *   bottom placements, so a fab floats above a bottom sheet's peek or a bottom navigation; it moves
 *   smoothly when it changes (a sheet opening).
 * - `expanded` / `controls`: ARIA disclosure attributes (`aria-expanded`, `aria-controls`) forwarded
 *   directly onto the inner `<button>` (used by `ui-speed-dial`).
 * - Hold to activate (0.44.0): add `[hold]="2000"` (ms) with `UiFabHold` from
 *   `@zouriel/ui/hold-button` imported, and listen to `(confirmed)`. A fill in the contrast colour
 *   grows across it from the inline start while it is held; a tap, a quick Enter or Space, or a
 *   screen reader's activation opens the same confirm dialog as `ui-hold-button` (`holdHint`,
 *   `confirmTitle`, `confirmMessage`, `confirmLabel`, `destructive`).
 */
@Component({
  selector: 'ui-fab',
  template: `
    <button #btn type="button" class="ui-fab" [attr.data-position]="position()" [attr.data-size]="size()" [attr.data-tone]="tone()"
            [attr.data-extended]="text() ? '' : null" [attr.data-above]="aboveOverlays() ? '' : null"
            [attr.aria-label]="label()" [attr.aria-expanded]="expanded() === null ? null : expanded()"
            [attr.aria-controls]="controls()" [attr.aria-describedby]="holdHint() ? hintId : null" [disabled]="disabled()"
            [class.filling]="holdFill() !== null" [style.--ui-fab-top-offset.px]="topOffset()" [style.--ui-fab-bottom-offset.px]="bottomOffset()">
      @if (holdFill() !== null) {
        <span class="fill" aria-hidden="true" [style.width.%]="holdFill()! * 100" [style.transition-duration.ms]="holdFillDuration()"></span>
      }
      <ng-content />
      @if (text()) { <span class="ui-fab-text">{{ text() }}</span> }
    </button>
    @if (holdHint()) { <span class="sr-only" [id]="hintId">{{ holdHint() }}</span> }
  `,
  styles: `
    :host { --ui-color-icon: currentColor; } /* always filled: the icon follows its contrast colour */
    .ui-fab {
      --ui-fab-edge: var(--ui-space-6);
      position: fixed; z-index: var(--ui-z-docked); box-sizing: border-box;
      display: inline-flex; align-items: center; justify-content: center; gap: var(--ui-space-2);
      width: 52px; height: 52px; padding: 0; border-radius: 50%;
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast);
      border: none; box-shadow: var(--ui-shadow-2); cursor: pointer; font-family: var(--ui-font-default); font-size: calc(22px * var(--ui-font-scale));
      transition: transform var(--ui-motion-fast) var(--ui-ease-spring), background var(--ui-motion-base) var(--ui-ease-standard),
                  bottom var(--ui-motion-base) var(--ui-ease-standard), top var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-fab:hover:not(:disabled) { background: var(--ui-color-primary-hover); transform: scale(1.05); }
    .ui-fab:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .ui-fab:focus-visible { outline: none; box-shadow: var(--ui-focus-ring), var(--ui-shadow-2); }
    .ui-fab:disabled { opacity: .5; cursor: not-allowed; }
    .ui-fab[data-size="sm"] { width: 40px; height: 40px; font-size: calc(18px * var(--ui-font-scale)); }
    /* text: a pill, the icon then the word. */
    .ui-fab[data-extended] { width: auto; padding-inline: var(--ui-space-4); border-radius: var(--ui-radius-pill); }
    .ui-fab-text { font-size: calc(16px * var(--ui-font-scale)); font-weight: 700; line-height: 1; letter-spacing: 0.02em; }
    .ui-fab[data-size="sm"] .ui-fab-text { font-size: calc(14px * var(--ui-font-scale)); }
    /* tone danger: high visibility (SOS). A raised-surface ring and a danger halo outside the fill. */
    .ui-fab[data-tone="danger"] {
      background: var(--ui-color-danger); color: var(--ui-color-danger-contrast);
      box-shadow: 0 0 0 3px var(--ui-color-surface-raised), 0 0 0 9px color-mix(in srgb, var(--ui-color-danger) 30%, transparent), var(--ui-shadow-2);
    }
    .ui-fab[data-tone="danger"]:hover:not(:disabled) { background: var(--ui-color-danger-hover); }
    .ui-fab[data-tone="danger"]:focus-visible { box-shadow: 0 0 0 3px var(--ui-color-surface-raised), var(--ui-focus-ring), var(--ui-shadow-2); }
    /* tone inverted: high-contrast fill with inverse ink, a 1px hairline ring and shadow in both light and dark. */
    .ui-fab[data-tone="inverted"] {
      background: var(--ui-color-text); color: var(--ui-color-bg);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-color-bg) 35%, var(--ui-color-text)), var(--ui-shadow-2);
    }
    .ui-fab[data-tone="inverted"]:hover:not(:disabled) { background: color-mix(in srgb, var(--ui-color-text) 88%, var(--ui-color-bg)); }
    .ui-fab[data-tone="inverted"]:focus-visible {
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-color-bg) 35%, var(--ui-color-text)), var(--ui-focus-ring), var(--ui-shadow-2);
    }
    /* aboveOverlays: over sheets, drawers and backdrops, under windows and toasts. */
    .ui-fab[data-above] { z-index: calc(var(--ui-z-overlay) + 1); }
    /* static: laid out inline inside a container (such as ui-speed-dial) instead of fixed to the viewport. */
    .ui-fab[data-position="static"] { position: relative; inset: auto; z-index: auto; }
    /* Offset from the edge plus the device's safe area (notches, status bar, home indicator). */
    .ui-fab[data-position^="top"] { top: calc(var(--ui-fab-edge) + env(safe-area-inset-top, 0px) + var(--ui-fab-top-offset, 0px)); }
    .ui-fab[data-position^="bottom"] { bottom: calc(var(--ui-fab-edge) + env(safe-area-inset-bottom, 0px) + var(--ui-fab-bottom-offset, 0px)); }
    .ui-fab[data-position$="-right"] { right: calc(var(--ui-fab-edge) + env(safe-area-inset-right, 0px)); }
    .ui-fab[data-position$="-left"] { left: calc(var(--ui-fab-edge) + env(safe-area-inset-left, 0px)); }
    /* Logical sides: the larger side safe area, so an RTL page keeps clear of a notch either side. */
    .ui-fab[data-position$="-end"] { inset-inline-end: calc(var(--ui-fab-edge) + max(env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px))); }
    .ui-fab[data-position$="-start"] { inset-inline-start: calc(var(--ui-fab-edge) + max(env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px))); }
    .ui-fab[data-position$="-center"] { left: 0; right: 0; margin-inline: auto; }
    .ui-fab[data-position$="-center"][data-extended] { width: fit-content; }
    @media (pointer: coarse) {
      .ui-fab[data-size="sm"] { width: var(--ui-size-touch); height: var(--ui-size-touch); }
      .ui-fab[data-size="sm"][data-extended] { width: auto; }
      .ui-fab[data-size="sm"][data-extended][data-position$="-center"] { width: fit-content; }
    }
    /* Hold progress (UiFabHold): a contrast-colour fill from the inline start, clipped to the shape. */
    .ui-fab.filling { overflow: hidden; isolation: isolate; touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    .fill { position: absolute; inset-block: 0; inset-inline-start: 0; z-index: -1; pointer-events: none;
      background: color-mix(in srgb, currentColor 22%, transparent); transition-property: width; transition-timing-function: linear; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    @media (prefers-reduced-motion: reduce) {
      .ui-fab { transition: transform var(--ui-motion-fast) var(--ui-ease-standard), background var(--ui-motion-base) var(--ui-ease-standard); }
      .ui-fab:hover:not(:disabled) { transform: none; }
    }
  `,
})
export class UiFab {
  private readonly btn = viewChild<ElementRef<HTMLButtonElement>>('btn');

  label = input.required<string>();
  position = input<UiFabPlacement | 'static'>('bottom-right');
  size = input<'sm' | 'md'>('md');
  disabled = input(false);
  /** `'danger'` (0.44.0): high-visibility SOS style; `'inverted'`: high-contrast fill with a 1 px hairline ring. */
  tone = input<UiFabTone>('primary');
  /** A visible word beside the icon, making it a pill (0.44.0); null for the round button. */
  text = input<string | null>(null);
  /** Above sheets, drawers and modal backdrops, below windows and toasts (0.44.0). */
  aboveOverlays = input(false, { transform: booleanAttribute });
  /** Px below the top edge (plus the safe area and the 24px gap) for top placements: an app bar's height (0.44.0). */
  topOffset = input(0);
  /** Px above the bottom edge (plus the safe area and the 24px gap) for bottom placements: a bottom sheet's peek (0.47.1). */
  bottomOffset = input(0);
  /** Forwarded to `aria-expanded` on the native button when non-null (used by `ui-speed-dial`). */
  expanded = input<boolean | null>(null);
  /** Forwarded to `aria-controls` on the native button when non-null (used by `ui-speed-dial`). */
  controls = input<string | null>(null);

  /** Set by UiFabHold: the hold fill (0 to 1, null for none) and how long it takes to get there. */
  readonly holdFill = signal<number | null>(null);
  readonly holdFillDuration = signal(0);
  /** Set by UiFabHold: what holding does, read with the button. */
  readonly holdHint = signal<string | null>(null);
  protected readonly hintId = `ui-fab-hint-${fabSeq++}`;

  /** Moves keyboard focus to the inner native `<button>`. */
  focus(): void {
    this.btn()?.nativeElement.focus();
  }
}
