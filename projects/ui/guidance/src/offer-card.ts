import { Component, input, output } from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';
import { UiButton } from '@zouriel/ui/button';

/** `default`: a small icon or picture by the text. `role`: a bigger avatar or cover picture, for
 *  "X added you to their event". */
export type UiOfferVariant = 'default' | 'role';

let offerSeq = 0;

/**
 * `ui-offer-card` — a card that offers help ("New here? Take a quick tour."), made to sit at the top
 * of a feed or list. Art goes in `[offer-art]` (an icon, or with `variant="role"` an avatar or cover
 * picture). Its look is the coach-mark tint, so it doesn't pass for content. It fits a 360px phone:
 * the buttons wrap under the text.
 */
@Component({
  selector: 'ui-offer-card',
  imports: [UiButton],
  host: { '[attr.data-variant]': 'variant()' },
  template: `
    <section class="offer" [attr.aria-labelledby]="headingId">
      <div class="art"><ng-content select="[offer-art]" /></div>
      <div class="main">
        <div class="heading" [id]="headingId">{{ heading() }}</div>
        @if (body()) { <p class="body">{{ body() }}</p> }
        <ng-content />
        @if (primaryLabel() || secondaryLabel()) {
          <div class="actions">
            @if (primaryLabel()) { <ui-button size="sm" (click)="primaryClick.emit()">{{ primaryLabel() }}</ui-button> }
            @if (secondaryLabel()) { <ui-button size="sm" variant="ghost" (click)="secondaryClick.emit()">{{ secondaryLabel() }}</ui-button> }
          </div>
        }
        @if (tipsOff()) {
          <button type="button" class="off" (click)="tipsOffClick.emit()">{{ tipsOffLabel() ?? strings.tipsOff }}</button>
        }
      </div>
      @if (dismissible()) {
        <button type="button" class="x" [attr.aria-label]="strings.dismiss" (click)="dismissed.emit()">
          <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .offer {
      position: relative; display: flex; align-items: flex-start; gap: var(--ui-space-3);
      padding: var(--ui-space-3) var(--ui-space-4); box-sizing: border-box;
      background: color-mix(in srgb, var(--ui-color-primary) 8%, var(--ui-color-surface));
      border: 1px solid color-mix(in srgb, var(--ui-color-primary) 28%, var(--ui-color-border));
      border-radius: var(--ui-radius-lg);
      color: var(--ui-color-text); font-family: var(--ui-font-default); line-height: 1.4;
    }
    .art { flex: none; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .art:empty { display: none; }
    :host([data-variant="default"]) .art {
      width: 40px; height: 40px; border-radius: var(--ui-radius-pill);
      background: color-mix(in srgb, var(--ui-color-primary) 16%, var(--ui-color-surface));
      color: var(--ui-color-primary); font-size: calc(20px * var(--ui-font-scale));
    }
    :host([data-variant="role"]) .art { width: 56px; height: 56px; border-radius: var(--ui-radius); background: var(--ui-color-surface-subtle); }
    .art ::ng-deep > img, .art ::ng-deep > svg { display: block; max-width: 100%; max-height: 100%; }
    :host([data-variant="role"]) .art ::ng-deep > img { width: 100%; height: 100%; object-fit: cover; }
    .main { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: var(--ui-space-1); }
    /* Room for the × beside the heading. */
    .heading { font-size: var(--ui-font-size-md); font-weight: 600; color: var(--ui-color-text); padding-inline-end: var(--ui-space-6); text-wrap: pretty; }
    .body { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-secondary); text-wrap: pretty; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-2); margin-top: var(--ui-space-2); }
    .off {
      position: relative; margin: var(--ui-space-1) 0 0; padding: 0; border: 0; background: transparent; cursor: pointer;
      font: inherit; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted);
      text-decoration: underline; text-underline-offset: 2px; text-decoration-thickness: 1px;
      border-radius: var(--ui-radius-xs);
    }
    .off:hover { color: var(--ui-color-text); }
    .off:focus-visible, .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .x {
      position: absolute; top: var(--ui-space-2); inset-inline-end: var(--ui-space-2);
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; padding: 0; border: 0; border-radius: var(--ui-radius-pill);
      background: transparent; color: var(--ui-color-text-muted); cursor: pointer;
      font-size: calc(16px * var(--ui-font-scale)); line-height: 1;
    }
    .x:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    @media (pointer: coarse) {
      .x::before { content: ''; position: absolute; inset: calc((28px - var(--ui-size-touch)) / 2); }
      .off::before { content: ''; position: absolute; inset: -12px -4px; }
    }
  `,
})
export class UiOfferCard {
  protected readonly strings = injectUiStrings();
  protected readonly headingId = `ui-offer-${offerSeq++}`;
  heading = input.required<string>();
  body = input<string | null>(null);
  variant = input<UiOfferVariant>('default');
  /** The main button's words; no button without them. */
  primaryLabel = input<string | null>(null);
  /** The quieter button's words ("Not now"); no button without them. */
  secondaryLabel = input<string | null>(null);
  /** Show the × (reported by `dismissed`). Default true. */
  dismissible = input(true);
  /** Show the small "Turn off tips" link (reported by `tipsOffClick`). */
  tipsOff = input(false);
  /** Default: the built-in `tipsOff` (Turn off tips). */
  tipsOffLabel = input<string | null>(null);
  readonly primaryClick = output<void>();
  readonly secondaryClick = output<void>();
  readonly dismissed = output<void>();
  readonly tipsOffClick = output<void>();
}
