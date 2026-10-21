import { booleanAttribute, Component, computed, inject, input, numberAttribute, output } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowRight02Icon from '@hugeicons/core-free-icons/ArrowRight02Icon';
import { UI_CONFIG } from '@zouriel/ui';

export type UiFeatureTone = 'primary' | 'accent' | 'brand' | 'neutral';
export type UiFeatureLayout = 'vertical' | 'horizontal';

let featureSeq = 0;

/**
 * `ui-feature-card` — a product or service card for a landing page: an icon in a tinted badge, an
 * optional eyebrow, a title, a description and an action.
 *
 *   <ui-feature-card title="Find a doctor" description="Book a visit at a clinic near you."
 *                    eyebrow="Clinics" actionLabel="Book now" tone="primary" (action)="go('doctors')">
 *     <hugeicons-icon feature-icon [icon]="stethoscope" />
 *   </ui-feature-card>
 *
 * With `actionLabel` (or `href`) the whole card is the target: the action is one real `<button>` (or
 * `<a>` with `href`) whose hit area is stretched over the card, so a click anywhere activates it and
 * there is only one control, named "title, action label" and described by the description. Without
 * either it is a static card. The title is a heading (`headingLevel`, default 3).
 *
 * The icon goes in the `[feature-icon]` slot (`[icon]` works too for an `<img>` or `<svg>`, but not on
 * `<hugeicons-icon>`, whose own `icon` input would take the attribute).
 */
@Component({
  selector: 'ui-feature-card',
  imports: [HugeiconsIconComponent],
  template: `
    <div class="fc" [attr.data-tone]="tone()" [attr.data-layout]="layout()" [attr.data-size]="size()"
         [class.interactive]="interactive()" [class.disabled]="disabled()" [class.glass]="glass()" [class.no-radius]="!radius()">
      <span class="badge" aria-hidden="true"><ng-content select="[feature-icon], [icon]" /></span>
      <div class="text">
        @if (eyebrow()) { <span class="eyebrow">{{ eyebrow() }}</span> }
        <div class="title" role="heading" [attr.aria-level]="headingLevel()" [id]="titleId">
          @if (href() && !actionLabel()) {
            <a class="hit" [attr.href]="disabled() ? null : href()" [attr.target]="target() || null"
               [attr.aria-disabled]="disabled() ? 'true' : null" [attr.aria-describedby]="description() ? descId : null"
               (click)="activate($event)">{{ title() }}</a>
          } @else {
            {{ title() }}
          }
        </div>
        @if (description()) { <p class="desc" [id]="descId">{{ description() }}</p> }
        <ng-content />
        @if (actionLabel()) {
          <div class="act-row">
            @if (href()) {
              <a class="hit act" [attr.href]="disabled() ? null : href()" [attr.target]="target() || null"
                 [attr.aria-disabled]="disabled() ? 'true' : null" [attr.aria-labelledby]="titleId + ' ' + actId"
                 [attr.aria-describedby]="description() ? descId : null" (click)="activate($event)">
                <span [id]="actId">{{ actionLabel() }}</span><hugeicons-icon class="arrow" [icon]="arrow" [size]="16" [strokeWidth]="2" aria-hidden="true" />
              </a>
            } @else {
              <button type="button" class="hit act" [disabled]="disabled()" [attr.aria-labelledby]="titleId + ' ' + actId"
                      [attr.aria-describedby]="description() ? descId : null" (click)="activate($event)">
                <span [id]="actId">{{ actionLabel() }}</span><hugeicons-icon class="arrow" [icon]="arrow" [size]="16" [strokeWidth]="2" aria-hidden="true" />
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .fc {
      /* Tone: the wash and eyebrow/action colour (primary), the badge fill and icon colour. */
      --fc-tone: var(--ui-color-primary);
      --fc-ink: var(--ui-color-primary);
      --fc-eyebrow: var(--ui-color-primary);
      --fc-badge-bg: color-mix(in srgb, var(--ui-color-primary) 14%, var(--ui-color-surface));
      --fc-badge-fg: var(--ui-color-primary);
      --fc-wash: linear-gradient(160deg, color-mix(in srgb, var(--fc-tone) 3%, var(--ui-color-surface)) 0%, var(--ui-color-surface) 55%);
      --fc-badge: 48px;
      --fc-icon: 24px;

      position: relative;
      display: flex; flex-direction: column; gap: var(--ui-space-4);
      /* Fills a stretched host (a grid row) so neighbouring cards are equal height, like ui-card. */
      height: 100%; box-sizing: border-box;
      padding: var(--ui-space-6);
      background: var(--fc-wash);
      color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius-lg);
      box-shadow: var(--ui-shadow-1);
      font-family: var(--ui-font-default); line-height: 1.35;
    }
    .fc[data-tone="accent"] {
      --fc-tone: var(--ui-color-accent);
      --fc-ink: var(--ui-color-text);
      --fc-eyebrow: var(--ui-color-text-muted);
      --fc-badge-bg: var(--ui-color-accent);
      --fc-badge-fg: var(--ui-color-accent-contrast);
    }
    .fc[data-tone="neutral"] {
      --fc-ink: var(--ui-color-text);
      --fc-eyebrow: var(--ui-color-text-muted);
      --fc-badge-bg: var(--ui-color-surface-raised);
      --fc-badge-fg: var(--ui-color-text);
      --fc-wash: var(--ui-color-surface);
    }
    /* Brand: the theme's brand gradient on the card's edge and around the badge (never under text). */
    .fc[data-tone="brand"] {
      border-color: transparent;
      background: var(--fc-wash) padding-box, var(--ui-gradient-brand) border-box;
    }
    .fc.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .fc.no-radius, .fc.no-radius .badge { border-radius: 0; }

    .fc[data-size="lg"] { padding: var(--ui-space-8); --fc-badge: 56px; --fc-icon: 28px; }
    .fc[data-layout="horizontal"] { flex-direction: row; align-items: flex-start; }

    .badge {
      flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: var(--fc-badge); height: var(--fc-badge); box-sizing: border-box;
      border-radius: var(--ui-radius-lg);
      background: var(--fc-badge-bg); color: var(--fc-badge-fg);
    }
    .badge:empty { display: none; }
    .fc[data-tone="neutral"] .badge { border: 1px solid var(--ui-color-border); }
    .fc[data-tone="brand"] .badge {
      border: 2px solid transparent;
      background: linear-gradient(var(--fc-badge-bg), var(--fc-badge-bg)) padding-box, var(--ui-gradient-brand) border-box;
    }
    .badge ::ng-deep svg { width: var(--fc-icon); height: var(--fc-icon); }

    .text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
    .eyebrow {
      margin-bottom: var(--ui-space-1);
      font-size: var(--ui-font-size-sm); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
      color: var(--fc-eyebrow);
    }
    .title {
      font-size: var(--ui-font-size-lg); font-weight: 600; line-height: 1.3; letter-spacing: var(--ui-tracking-tight);
      color: var(--ui-color-text); overflow-wrap: anywhere;
    }
    .fc[data-size="lg"] .title { font-family: var(--ui-font-display); font-size: 22px; font-weight: 700; }
    .desc {
      margin: var(--ui-space-2) 0 0;
      font-size: var(--ui-font-size-md); line-height: 1.5; color: var(--ui-color-text-muted);
    }
    .fc[data-size="lg"] .desc { font-size: 16px; }

    /* Sits at the bottom, so actions line up across a row of cards. */
    .act-row { margin-top: auto; padding-top: var(--ui-space-4); }
    .act {
      display: inline-flex; align-items: center; gap: var(--ui-space-2);
      padding: 0; border: none; background: none; color: var(--fc-ink);
      font: inherit; font-size: var(--ui-font-size-md); font-weight: 600; text-decoration: none;
      cursor: pointer;
    }
    .title .hit { color: inherit; text-decoration: none; }
    .hit { outline: none; }
    /* The one control's hit area covers the whole card. */
    .hit::after { content: ''; position: absolute; inset: 0; border-radius: inherit; z-index: 1; }
    .arrow { display: inline-flex; transition: transform var(--ui-motion-fast) var(--ui-ease-standard); }
    :host-context([dir="rtl"]) .arrow { transform: scaleX(-1); }
    .arrow:dir(rtl) { transform: scaleX(-1); }

    .fc.interactive {
      cursor: pointer;
      transition: transform var(--ui-motion-base) var(--ui-ease-standard),
                  box-shadow var(--ui-motion-base) var(--ui-ease-standard),
                  border-color var(--ui-motion-base) var(--ui-ease-standard);
    }
    .fc.interactive:not(.disabled):hover { transform: translateY(-2px); box-shadow: var(--ui-shadow-2); }
    .fc.interactive:not(.disabled):not([data-tone="brand"]):not(.glass):hover { border-color: var(--ui-color-border-strong); }
    .fc.interactive:not(.disabled):active { transform: translateY(-1px) scale(var(--ui-scale-press)); }
    .fc.interactive:not(.disabled):hover .arrow { transform: translateX(3px); }
    :host-context([dir="rtl"]) .fc.interactive:not(.disabled):hover .arrow { transform: scaleX(-1) translateX(3px); }
    .fc.interactive:not(.disabled):hover .arrow:dir(rtl) { transform: scaleX(-1) translateX(3px); }
    .fc.interactive:has(.hit:focus-visible) { box-shadow: var(--ui-focus-ring); }
    .fc.disabled { opacity: 0.5; cursor: not-allowed; }
    .fc.disabled .hit { cursor: not-allowed; }
    @media (prefers-reduced-motion: reduce) {
      .fc.interactive:hover, .fc.interactive:active { transform: none; }
      .fc.interactive:not(.disabled):hover .arrow { transform: none; }
    }
  `,
})
export class UiFeatureCard {
  private config = inject(UI_CONFIG);
  protected readonly arrow = ArrowRight02Icon;

  title = input.required<string>();
  description = input('');
  /** A short tag above the title ("New", "Clinics"). */
  eyebrow = input('');
  /** The action's words. With it (or `href`) the whole card is clickable. */
  actionLabel = input('');
  /** Makes the action a link (`<a href>`) instead of a button. */
  href = input<string>();
  /** Link target, with `href`. */
  target = input<string>();
  /** Badge tint and surface treatment. */
  tone = input<UiFeatureTone>('primary');
  layout = input<UiFeatureLayout>('vertical');
  size = input<'md' | 'lg'>('md');
  disabled = input(false, { transform: booleanAttribute });
  /** The title's heading level (aria-level). */
  headingLevel = input(3, { transform: numberAttribute });
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);

  /** The card (its action) was activated. Not emitted while disabled. */
  readonly action = output<MouseEvent>();

  protected readonly interactive = computed(() => !!this.actionLabel() || !!this.href());
  private readonly seq = featureSeq++;
  protected readonly titleId = `ui-feature-${this.seq}-title`;
  protected readonly descId = `ui-feature-${this.seq}-desc`;
  protected readonly actId = `ui-feature-${this.seq}-act`;

  protected activate(e: MouseEvent): void {
    if (this.disabled()) {
      e.preventDefault();
      return;
    }
    this.action.emit(e);
  }
}
