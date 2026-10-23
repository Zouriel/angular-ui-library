import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender, booleanAttribute, Component, computed, DestroyRef, effect, ElementRef, inject, input, isDevMode, numberAttribute, output, PLATFORM_ID, signal, untracked,
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowRight02Icon from '@hugeicons/core-free-icons/ArrowRight02Icon';
import { UI_CONFIG, uiWatchTheme } from '@zouriel/ui';
import { uiLuminance, uiParseColor, uiParseColorAlpha, uiResolveFeatureColors, type UiFeatureCardColors, type UiFeatureColorTheme } from './feature-colors';

export type UiFeatureTone = 'primary' | 'accent' | 'brand' | 'neutral';
export type UiFeatureLayout = 'vertical' | 'horizontal';
export type UiFeatureSize = 'sm' | 'md' | 'lg';
/** `default`: a white bordered card with a faint wash. `tinted`: a soft wash in the tone, no border, shadow only on hover. */
export type UiFeatureSurface = 'default' | 'tinted';
/** `true` the card radius (--ui-radius-lg), `false` square, `'control'` an input's radius (--ui-radius). */
export type UiFeatureRadius = boolean | 'control';

let featureSeq = 0;

const themeKey = (t: UiFeatureColorTheme | null) => (t ? `${t.surface}|${t.text}|${t.muted}` : '');

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
 * `trailingArrow` without `actionLabel` makes the card itself the action: the whole card is one `<button>`
 * (or `<a>` with `href`) named "title, description", with a small arrow at the end of the title row that
 * points the reading way: at the end of the badge row in the vertical layout (the end of the title row
 * when horizontal or without an icon). `size="sm"`, `surface="tinted"`, `radius="control"` and `descriptionLines`
 * make the compact tile of a start screen (two side by side under a chat bar, matching its corners).
 *
 * `badgeTone` gives the badge (its tint and icon) a tone of its own, e.g. a coral accent card with a
 * primary badge. `colors` gives the card an app's own surface and accent (derived for dark themes,
 * contrast-checked; see `UiFeatureCardColors`); it wins over `tone` and `badgeTone` for the wash,
 * the badge, the arrow and the action words, while the title and description keep the theme's text
 * colours. `enter` plays a short entrance (fade and an 8px rise) once, when the card first appears,
 * after `enterDelay` ms, so two cards can stagger. On hover, keyboard focus or press the badge icon
 * lifts a little and the arrow nudges towards the end. No motion under reduced motion.
 *
 * The icon goes in the `[feature-icon]` slot (`[icon]` works too for an `<img>` or `<svg>`, but not on
 * `<hugeicons-icon>`, whose own `icon` input would take the attribute).
 */
@Component({
  selector: 'ui-feature-card',
  imports: [HugeiconsIconComponent],
  template: `
    <div class="fc" [attr.data-tone]="tone()" [attr.data-layout]="layout()" [attr.data-size]="size()"
         [attr.data-surface]="surface()" [attr.data-radius]="radius() === 'control' ? 'control' : null"
         [class.interactive]="interactive()" [class.disabled]="disabled()" [class.glass]="glass() && surface() !== 'tinted' && !custom()"
         [class.no-radius]="square()" [class.card-action]="cardAction()"
         [attr.data-badge-tone]="badgeTone() ?? null" [class.enter]="enter()" [style.--fc-enter-delay.ms]="enter() ? enterDelay() : null"
         [attr.data-colors]="custom() ? '' : null" [style.--fc-wash]="custom()?.surface ?? null"
         [style.--fc-badge-bg]="custom()?.badge ?? null" [style.--fc-badge-fg]="custom()?.accent ?? null"
         [style.--fc-accent]="custom()?.accent ?? null" [style.--fc-ink]="custom()?.ink ?? null"
         [style.--fc-eyebrow]="custom()?.ink ?? null" [style.--fc-desc]="custom()?.desc ?? null">
      <span class="badge" aria-hidden="true"><ng-content select="[feature-icon], [icon]" /></span>
      <div class="text">
        @if (eyebrow()) { <span class="eyebrow">{{ eyebrow() }}</span> }
        <div class="title-row">
        <div class="title" role="heading" [attr.aria-level]="headingLevel()" [id]="titleId">
          @if (cardAction()) {
            <!-- The card is the action: one control over the whole card, named by the title and the description. -->
            @if (href()) {
              <a class="hit card-hit" [attr.href]="disabled() ? null : href()" [attr.target]="target() || null"
                 [attr.aria-disabled]="disabled() ? 'true' : null" [attr.aria-labelledby]="cardName()"
                 (click)="activate($event)"><span [id]="titleTextId">{{ title() }}</span></a>
            } @else {
              <button type="button" class="hit card-hit" [disabled]="disabled()" [attr.aria-labelledby]="cardName()"
                      (click)="activate($event)"><span [id]="titleTextId">{{ title() }}</span></button>
            }
          } @else if (href() && !actionLabel()) {
            <a class="hit" [attr.href]="disabled() ? null : href()" [attr.target]="target() || null"
               [attr.aria-disabled]="disabled() ? 'true' : null" [attr.aria-describedby]="description() ? descId : null"
               (click)="activate($event)">{{ title() }}</a>
          } @else {
            {{ title() }}
          }
        </div>
        @if (cardAction()) { <hugeicons-icon class="arrow trail" [icon]="arrow" [size]="16" [strokeWidth]="2" aria-hidden="true" /> }
        </div>
        @if (description()) {
          <p class="desc" [id]="descId" [class.clamp]="descriptionLines() > 0" [style.--fc-lines]="descriptionLines() > 0 ? descriptionLines() : null">{{ description() }}</p>
        }
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
    /* sm: the compact tile (a start screen's shortcuts): 40px badge, 16px padding, body-strong title. */
    .fc[data-size="sm"] { padding: var(--ui-space-4); gap: var(--ui-space-3); --fc-badge: 40px; --fc-icon: 20px; }
    .fc[data-size="sm"][data-layout="horizontal"] { gap: var(--ui-space-3); }

    /* Control radius: the corners of an input (--ui-radius), so a tile matches the field above it. */
    .fc[data-radius="control"]:not(.no-radius) { border-radius: var(--ui-radius); }
    .fc[data-radius="control"]:not(.no-radius) .badge { border-radius: var(--ui-radius); }

    /*
     * Tinted: a soft wash in the tone instead of a white bordered card; no border (kept transparent, so the
     * size matches the default surface), no shadow until hover. On the wash the muted and primary-coloured
     * words are deepened a quarter towards the text colour (text-muted fails 4.5:1 on an 8% wash in
     * lightPink), and the primary badge tint is raised to 18% so it still reads on the wash.
     */
    .fc[data-surface="tinted"] {
      /* 8% of the tone over the surface with 4% of the text, so a pale tone (Winter's sun accent) still shows. */
      --fc-wash: color-mix(in srgb, var(--fc-tone) 8%, color-mix(in srgb, var(--ui-color-text) 4%, var(--ui-color-surface)));
      --fc-desc: color-mix(in srgb, var(--ui-color-text-muted) 75%, var(--ui-color-text));
      background: var(--fc-wash);
      border-color: transparent;
      box-shadow: none;
    }
    .fc[data-surface="tinted"]:is([data-tone="primary"], [data-tone="brand"]) {
      --fc-badge-bg: color-mix(in srgb, var(--ui-color-primary) 18%, var(--ui-color-surface));
      --fc-ink: color-mix(in srgb, var(--ui-color-primary) 75%, var(--ui-color-text));
      --fc-eyebrow: color-mix(in srgb, var(--ui-color-primary) 75%, var(--ui-color-text));
    }
    .fc[data-surface="tinted"][data-tone="neutral"] { --fc-wash: color-mix(in srgb, var(--ui-color-text) 5%, var(--ui-color-surface)); }
    .fc[data-layout="horizontal"] { flex-direction: row; align-items: flex-start; }

    .badge {
      flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: var(--fc-badge); height: var(--fc-badge); box-sizing: border-box;
      border-radius: var(--ui-radius-lg);
      background: var(--fc-badge-bg); color: var(--fc-badge-fg);
      /* The icon follows the badge colour, not a theme's icon tint (maldives' Lagoon on the coral badge was 1.5:1). */
      --ui-color-icon: currentColor;
    }
    .badge:empty { display: none; }
    .fc[data-tone="neutral"] .badge { border: 1px solid var(--ui-color-border); }
    .fc[data-tone="brand"] .badge {
      border: 2px solid transparent;
      background: linear-gradient(var(--fc-badge-bg), var(--fc-badge-bg)) padding-box, var(--ui-gradient-brand) border-box;
    }
    .badge ::ng-deep svg { width: var(--fc-icon); height: var(--fc-icon); }
    .fc[data-size="sm"]:not(.no-radius) .badge { border-radius: var(--ui-radius-sm); }
    .fc[data-size="sm"][data-radius="control"]:not(.no-radius) .badge { border-radius: var(--ui-radius); }

    .text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
    .eyebrow {
      margin-bottom: var(--ui-space-1);
      font-size: var(--ui-font-size-sm); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
      color: var(--fc-eyebrow);
    }
    /* The title and, for a card action, the trailing arrow at the end of its row. */
    .title-row { display: flex; align-items: flex-start; gap: var(--ui-space-2); }
    .title {
      flex: 1 1 auto; min-width: 0;
      font-size: var(--ui-font-size-lg); font-weight: 600; line-height: 1.3; letter-spacing: var(--ui-tracking-tight);
      color: var(--ui-color-text); overflow-wrap: anywhere;
    }
    .fc[data-size="lg"] .title { font-family: var(--ui-font-display); font-size: calc(22px * var(--ui-font-scale)); font-weight: 700; }
    .fc[data-size="sm"] .title { font-size: var(--ui-font-size-md); line-height: 1.35; letter-spacing: normal; }
    .desc {
      margin: var(--ui-space-2) 0 0;
      font-size: var(--ui-font-size-md); line-height: 1.5; color: var(--fc-desc, var(--ui-color-text-muted));
    }
    .fc[data-size="lg"] .desc { font-size: calc(16px * var(--ui-font-scale)); }
    .fc[data-size="sm"] .desc { margin-top: var(--ui-space-1); font-size: var(--ui-font-size-sm); line-height: 1.4; }
    /* descriptionLines: clamp with an ellipsis. */
    .desc.clamp {
      display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;
      -webkit-line-clamp: var(--fc-lines); line-clamp: var(--fc-lines);
    }

    /* Sits at the bottom, so actions line up across a row of cards. */
    .act-row { margin-top: auto; padding-top: var(--ui-space-4); }
    .fc[data-size="sm"] .act-row { padding-top: var(--ui-space-3); }
    .act {
      display: inline-flex; align-items: center; gap: var(--ui-space-2);
      padding: 0; border: none; background: none; color: var(--fc-ink);
      font: inherit; font-size: var(--ui-font-size-md); font-weight: 600; text-decoration: none;
      cursor: pointer;
    }
    .title .hit { color: inherit; text-decoration: none; }
    .card-hit {
      display: inline; padding: 0; margin: 0; border: none; background: none;
      font: inherit; color: inherit; letter-spacing: inherit; text-align: start; cursor: pointer;
    }
    /*
     * The card action's arrow: subtle (muted). Horizontal, or with no icon: at the end of the title row,
     * centred on its first line. Vertical with an icon: at the end of the badge row, centred on the badge,
     * so the title keeps the full width (a narrow tile no longer wraps its title around the arrow).
     */
    .trail { flex: none; height: 1.35em; align-items: center; color: var(--fc-desc, var(--ui-color-text-muted)); }
    .fc:not([data-size="sm"]) .trail { height: 1.3em; }
    .fc[data-layout="vertical"]:has(.badge:not(:empty)) .trail {
      position: absolute; height: 16px;
      inset-inline-end: var(--ui-space-6); top: calc(var(--ui-space-6) + 16px);
    }
    .fc[data-layout="vertical"][data-size="sm"]:has(.badge:not(:empty)) .trail { inset-inline-end: var(--ui-space-4); top: calc(var(--ui-space-4) + 12px); }
    .fc[data-layout="vertical"][data-size="lg"]:has(.badge:not(:empty)) .trail { inset-inline-end: var(--ui-space-8); top: calc(var(--ui-space-8) + 20px); }
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
    .fc.interactive:not(.disabled):not([data-tone="brand"]):not(.glass):not([data-surface="tinted"]):hover { border-color: var(--ui-color-border-strong); }
    .fc.interactive:not(.disabled):active { transform: translateY(-1px) scale(var(--ui-scale-press)); }
    .fc.interactive:not(.disabled):hover .arrow { transform: translateX(3px); }
    :host-context([dir="rtl"]) .fc.interactive:not(.disabled):hover .arrow { transform: scaleX(-1) translateX(3px); }
    .fc.interactive:not(.disabled):hover .arrow:dir(rtl) { transform: scaleX(-1) translateX(3px); }
    .fc.interactive:has(.hit:focus-visible) { box-shadow: var(--ui-focus-ring); }
    .fc.disabled { opacity: 0.5; cursor: not-allowed; }
    .fc.disabled .hit { cursor: not-allowed; }

    /* badgeTone: the badge's own tone (tint and icon), over whatever the card's tone set. Each rule also has a
       [data-surface] form, so it outranks the tinted tone rules (.fc[data-surface="tinted"]:is(...)). */
    .fc[data-badge-tone] .badge { border: 0; background: var(--fc-badge-bg); }
    .fc[data-surface]:is([data-badge-tone="primary"], [data-badge-tone="brand"]) {
      --fc-badge-bg: color-mix(in srgb, var(--ui-color-primary) 14%, var(--ui-color-surface));
      --fc-badge-fg: var(--ui-color-primary);
    }
    .fc[data-surface="tinted"]:is([data-badge-tone="primary"], [data-badge-tone="brand"]) {
      --fc-badge-bg: color-mix(in srgb, var(--ui-color-primary) 18%, var(--ui-color-surface));
    }
    .fc[data-surface][data-badge-tone="accent"] { --fc-badge-bg: var(--ui-color-accent); --fc-badge-fg: var(--ui-color-accent-contrast); }
    .fc[data-surface][data-badge-tone="neutral"] { --fc-badge-bg: var(--ui-color-surface-raised); --fc-badge-fg: var(--ui-color-text); }
    .fc[data-badge-tone="neutral"] .badge { border: 1px solid var(--ui-color-border); }
    .fc[data-badge-tone="brand"] .badge {
      border: 2px solid transparent;
      background: linear-gradient(var(--fc-badge-bg), var(--fc-badge-bg)) padding-box, var(--ui-gradient-brand) border-box;
    }

    /* colors: the app's surface and accent. No border at rest; the accent border on hover and focus. */
    .fc[data-colors], .fc[data-colors][data-tone="brand"] { background: var(--fc-wash); border-color: transparent; }
    .fc[data-colors] .badge, .fc[data-colors][data-tone="brand"] .badge { border: 0; background: var(--fc-badge-bg); }
    .fc[data-colors] .trail { color: var(--fc-accent); }
    .fc[data-colors].interactive:not(.disabled):hover, .fc[data-colors].interactive:has(.hit:focus-visible) { border-color: var(--fc-accent); }

    /* enter: a short fade and rise when the card first appears (backwards fill, so hover still lifts it after). */
    .fc.enter { animation: ui-fc-enter var(--ui-motion-slow) var(--ui-ease-decelerate) backwards; animation-delay: var(--fc-enter-delay, 0ms); }
    @keyframes ui-fc-enter { from { opacity: 0; transform: translateY(8px); } }

    /* Hover, keyboard focus and press: the badge icon lifts a little; the arrow nudges towards the end. */
    .badge ::ng-deep > * { transition: transform var(--ui-motion-base) var(--ui-ease-spring); }
    .fc.interactive:not(.disabled):is(:hover, :active, :has(.hit:focus-visible)) .badge ::ng-deep > * { transform: translateY(-2px) scale(1.08); }
    .fc.interactive:not(.disabled):is(:active, :has(.hit:focus-visible)) .arrow { transform: translateX(3px); }
    .fc.interactive:not(.disabled):is(:active, :has(.hit:focus-visible)) .arrow:dir(rtl) { transform: scaleX(-1) translateX(3px); }

    @media (prefers-reduced-motion: reduce) {
      .fc.interactive:hover, .fc.interactive:active { transform: none; }
      .fc.interactive:not(.disabled):hover .arrow { transform: none; }
      .fc.enter { animation: none; }
      .fc.interactive:not(.disabled):is(:hover, :active, :has(.hit:focus-visible)) .badge ::ng-deep > * { transform: none; }
      .fc.interactive:not(.disabled):is(:active, :has(.hit:focus-visible)) .arrow { transform: none; }
      .fc.interactive:not(.disabled):is(:active, :has(.hit:focus-visible)) .arrow:dir(rtl) { transform: scaleX(-1); }
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
  /** sm: the compact tile (40px badge, 16px padding, body-strong title); lg: roomier. */
  size = input<UiFeatureSize>('md');
  /** `tinted`: a soft wash in the tone, no border, shadow only on hover (and `glass` is ignored). */
  surface = input<UiFeatureSurface>('default');
  /** With no `actionLabel`, the whole card is one button named "title, description", with a trailing arrow. */
  trailingArrow = input(false, { transform: booleanAttribute });
  /** Clamp the description to this many lines with an ellipsis; 0 shows it all. */
  descriptionLines = input(0, { transform: numberAttribute });
  disabled = input(false, { transform: booleanAttribute });
  /** The title's heading level (aria-level). */
  headingLevel = input(3, { transform: numberAttribute });
  glass = input<boolean>(this.config.glass);
  /** Corners: `true` the card radius, `false` square, `'control'` an input's radius (square too when UiConfig.radius is off, like the input). */
  radius = input<UiFeatureRadius, UiFeatureRadius | '' | 'true' | 'false'>(this.config.radius, {
    transform: (v) => (v === 'control' ? 'control' : booleanAttribute(v)),
  });

  /** The badge's own tone (its tint and icon colour); the card's `tone` when left out. */
  badgeTone = input<UiFeatureTone | undefined>(undefined);
  /** The app's own surface and accent (see UiFeatureCardColors); wins over `tone`/`badgeTone`. Invalid colours fall back to the tone. */
  colors = input<UiFeatureCardColors | null>(null);
  /** Play a short entrance (fade and an 8px rise) once, when the card first appears. Off under reduced motion. */
  enter = input(false, { transform: booleanAttribute });
  /** Wait this many ms before the entrance, to stagger cards. */
  enterDelay = input(0, { transform: numberAttribute });

  /** The card (its action) was activated. Not emitted while disabled. */
  readonly action = output<MouseEvent>();

  /** The card itself is the action (trailingArrow without an action label). */
  protected readonly cardAction = computed(() => this.trailingArrow() && !this.actionLabel());
  protected readonly interactive = computed(() => !!this.actionLabel() || !!this.href() || this.cardAction());
  protected readonly square = computed(() => this.radius() === false || (this.radius() === 'control' && !this.config.radius));
  protected readonly cardName = computed(() => (this.description() ? `${this.titleTextId} ${this.descId}` : this.titleTextId));
  private readonly seq = featureSeq++;
  protected readonly titleId = `ui-feature-${this.seq}-title`;
  protected readonly descId = `ui-feature-${this.seq}-desc`;
  protected readonly actId = `ui-feature-${this.seq}-act`;
  protected readonly titleTextId = `ui-feature-${this.seq}-name`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** The theme colours under the card, read from the page: when colours are set, after the first render, and whenever the tokens may change. */
  private readonly themeColors = signal<UiFeatureColorTheme | null>(null);
  /** The custom colours this card draws, or null (none given, invalid, or not in a browser). */
  protected readonly custom = computed(() => {
    const c = this.colors();
    const theme = this.themeColors();
    if (!c || !theme) return null;
    const r = uiResolveFeatureColors(c, theme);
    if (!r && isDevMode()) console.warn('ui-feature-card: colors must be hex (#rgb, #rrggbb) or rgb() strings; using the tone instead.', c);
    return r;
  });

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const destroy = inject(DestroyRef);
    // Only re-set when a token changed, so a re-check that finds the same theme doesn't re-render.
    const read = () => {
      const next = this.readTheme();
      if (themeKey(next) !== themeKey(untracked(this.themeColors))) this.themeColors.set(next);
    };
    let rendered = false;
    let watching = false;
    const watch = () => {
      if (watching) return;
      watching = true;
      uiWatchTheme(this.host, destroy, read);
    };
    // As soon as colours are given: read the tokens now, so the first paint has the colours when the page
    // is already styled. Before the first render that read can be early (the host not yet in the page, or
    // the app's stylesheet with its [data-theme] rules not yet loaded, leaving the inlined :root tokens), so
    // after it the card reads again and keeps watching everything that can change the tokens (uiWatchTheme).
    effect(() => {
      if (!this.colors()) return;
      untracked(() => (rendered ? watch() : read()));
    });
    afterNextRender(() => {
      rendered = true;
      if (untracked(this.colors)) watch();
    });
  }

  private readTheme(): UiFeatureColorTheme | null {
    const cs = getComputedStyle(this.host);
    const surface = uiParseColor(cs.getPropertyValue('--ui-color-surface'));
    const text = uiParseColorAlpha(cs.getPropertyValue('--ui-color-text'));
    const muted = uiParseColorAlpha(cs.getPropertyValue('--ui-color-text-muted'));
    if (!surface || !text || !muted) return null;
    return { surface, text, muted, dark: uiLuminance(surface) < 0.2 };
  }

  protected activate(e: MouseEvent): void {
    if (this.disabled()) {
      e.preventDefault();
      return;
    }
    this.action.emit(e);
  }
}
