import { Component, HostAttributeToken, computed, inject, input } from '@angular/core';
import { UI_CONFIG, type UiSize, type UiButtonSize } from '@zouriel/ui';

export type UiButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive' | 'brand' | 'accent';

/**
 * `ui-button` — the action primitive. Wires `glass`/`radius` to the global
 * UiConfig defaults (overridable per instance) and uses only design tokens.
 */
@Component({
  selector: 'ui-button',
  template: `
    <button
      class="ui-btn"
      [class.glass]="glass()"
      [class.no-radius]="!radius()"
      [class.block]="block()"
      [attr.type]="type()"
      [attr.data-variant]="variant()"
      [attr.data-size]="size()"
      [attr.aria-label]="name()"
      [attr.aria-describedby]="ariaDescribedby() ?? null"
      [class.filling]="fill() !== null" [class.badged]="badge() !== null"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() || null">
      @if (fill() !== null) {
        <span class="fill" aria-hidden="true" [style.width.%]="fill()! * 100" [style.transition-duration.ms]="fillDuration()"></span>
      }
      @if (loading()) { <span class="spin" aria-hidden="true"></span> }
      <ng-content />
      @if (badge() !== null) {
        <span class="ui-badge" aria-hidden="true" [attr.data-tone]="badgeTone()">{{ badge() }}</span>
        @if (!(ariaLabel() ?? staticLabel)) { <span class="sr-only">, {{ badgeLabel() ?? badge() }}</span> }
      }
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    :host(.block-host), .ui-btn.block { width: 100%; }
    .ui-btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: var(--ui-space-2);
      height: var(--ui-size-md);
      padding: 0 var(--ui-space-4);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius);
      background: var(--ui-color-surface);
      color: var(--ui-color-text);
      font-family: var(--ui-font-default);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: var(--ui-tracking-tight);
      cursor: pointer;
      white-space: nowrap;
      transition: background var(--ui-motion-base) var(--ui-ease-standard),
                  border-color var(--ui-motion-base) var(--ui-ease-standard),
                  transform var(--ui-motion-fast) var(--ui-ease-standard),
                  opacity var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-btn:hover:not(:disabled) { background: var(--ui-color-surface-hover); }
    .ui-btn:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .ui-btn:focus-visible:not(:disabled) { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    /* Loading is disabled too, but keeps its full colour: the spinner says "busy", the dimming "off". */
    .ui-btn[aria-busy="true"] { opacity: 1; cursor: progress; }
    .ui-btn.no-radius { border-radius: 0; }
    /* Icons follow the label on filled and link buttons; on ghost and outline ones they take the
       theme's icon colour (--ui-color-icon, set by themes like maldives). */
    .ui-btn:not([data-variant="ghost"]):not([data-variant="outline"]) { --ui-color-icon: currentColor; }
    .ui-btn.glass {
      background: var(--ui-glass-bg);
      backdrop-filter: blur(var(--ui-glass-blur));
      border-color: var(--ui-glass-border);
    }
    .ui-btn[data-size="sm"] { height: var(--ui-size-sm); font-size: 13px; padding: 0 var(--ui-space-3); }
    .ui-btn[data-size="lg"] { height: var(--ui-size-lg); font-size: 15px; padding: 0 var(--ui-space-6); }
    .ui-btn[data-size="xl"] { height: var(--ui-size-xl); font-size: 17px; font-weight: 600; padding: 0 var(--ui-space-8); gap: var(--ui-space-3); border-radius: var(--ui-radius-lg); }
    .ui-btn[data-size="xl"].no-radius { border-radius: 0; }
    .ui-btn[data-variant="primary"] { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent; }
    .ui-btn[data-variant="primary"]:hover:not(:disabled) { background: var(--ui-color-primary-hover); }
    .ui-btn[data-variant="primary"]:active:not(:disabled) { background: var(--ui-color-primary-active); }
    .ui-btn[data-variant="secondary"] { background: var(--ui-color-secondary); color: var(--ui-color-secondary-contrast); border-color: transparent; }
    .ui-btn[data-variant="secondary"]:hover:not(:disabled) { background: var(--ui-color-secondary-hover); }
    /* The theme's accent (maldives: the coral CTA). Falls back to secondary in themes without one. */
    .ui-btn[data-variant="accent"] { background: var(--ui-color-accent); color: var(--ui-color-accent-contrast); border-color: transparent; }
    .ui-btn[data-variant="accent"]:hover:not(:disabled) { background: color-mix(in srgb, var(--ui-color-accent) 88%, var(--ui-color-accent-contrast)); }
    .ui-btn[data-variant="outline"] { background: transparent; }
    .ui-btn[data-variant="destructive"] { background: var(--ui-color-danger); color: var(--ui-color-danger-contrast); border-color: transparent; }
    .ui-btn[data-variant="destructive"]:hover:not(:disabled) { background: var(--ui-color-danger-hover); }
    .ui-btn[data-variant="ghost"] { background: transparent; border-color: transparent; }
    /* Text-sized, but never a box under 24x24 (WCAG 2.5.8 target size). */
    .ui-btn[data-variant="link"] { background: transparent; border-color: transparent; color: var(--ui-color-primary); text-decoration: underline; padding: 0; height: auto;
      min-height: 24px; min-width: 24px; }
    .ui-btn[data-variant="link"]:hover:not(:disabled) { background: transparent; color: var(--ui-color-primary-hover); }
    /* Signature CTA — the theme's own purple→gold sweep (falls back to a primary→hover gradient
       on themes that don't define one), pill-shaped so it reads as a distinct "hero action" rather
       than a bigger version of the ordinary primary button. Reserve it for the one action per view
       that should pull focus (hero CTA, final CTA) — not a default. */
    .ui-btn[data-variant="brand"] {
      background: var(--ui-gradient-brand, linear-gradient(90deg, var(--ui-color-primary), var(--ui-color-primary-hover)));
      color: var(--ui-color-primary-contrast);
      /* border: none rather than border-color: transparent — a 1px transparent border on top
         of a gradient fill with this much border-radius renders as a visible dark seam at the
         curved edge in Chrome/Firefox (the border box anti-aliases separately from the
         background). Every other filled variant keeps border-color: transparent since their
         radius is small enough that the seam isn't visible, but on a pill it is. */
      border: none;
      border-radius: var(--ui-radius-pill);
      font-weight: 600;
      box-shadow: var(--ui-glow-amber, none);
      transition: box-shadow var(--ui-motion-base) var(--ui-ease-standard),
                  transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .ui-btn[data-variant="brand"]:hover:not(:disabled) {
      /* Redeclared, not inherited — the base .ui-btn:hover:not(:disabled) rule above has
         higher specificity than the bare [data-variant="brand"] rule (two pseudo-classes vs.
         one attribute selector), so without this the generic white hover background wins and
         the gradient disappears on hover/press. Same background value as the non-hover rule. */
      background: var(--ui-gradient-brand, linear-gradient(90deg, var(--ui-color-primary), var(--ui-color-primary-hover)));
      /* Hover lifts the gradient with a contrast-colour wash rather than filter: brightness, so it
         follows each theme's own contrast colour (a dark wash on light gradients, light on dark). */
      box-shadow: inset 0 0 0 999px color-mix(in srgb, var(--ui-color-primary-contrast) 12%, transparent), var(--ui-glow-amber, 0 0 transparent);
    }
    .ui-btn[data-variant="brand"]:focus-visible:not(:disabled) { box-shadow: var(--ui-focus-ring); }
    .ui-btn[data-variant="brand"].no-radius { border-radius: 0; }
    .spin {
      width: 1em; height: 1em; border-radius: 50%;
      border: 2px solid currentColor; border-right-color: transparent;
      animation: ui-btn-spin var(--ui-motion-slow) linear infinite;
    }
    /* Touch: grow the hit area vertically to 44px on coarse pointers only, never sideways
       (so it can't overlap a neighbour in a row); desktop keeps the compact box. */
    @media (pointer: coarse) {
      .ui-btn { position: relative; }
      .ui-btn::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: var(--ui-size-touch); transform: translateY(-50%); }
    }
    @keyframes ui-btn-spin { to { transform: rotate(360deg); } }
    .ui-btn.badged { position: relative; overflow: visible; }
    /* badge (0.44.0): a count bubble at the top-end corner, the bottom nav's badge look. Hidden from
       screen readers: the button's name carries it ("Chat, 2 unread"). */
    .ui-badge { position: absolute; top: -6px; inset-inline-end: -6px; z-index: 1; min-width: 16px; height: 16px; padding: 0 var(--ui-space-1);
      box-sizing: border-box; border-radius: var(--ui-radius-pill); pointer-events: none; white-space: nowrap;
      background: var(--ui-color-danger); color: var(--ui-color-danger-contrast);
      font-family: var(--ui-font-default); font-size: 11px; font-weight: 600; line-height: 16px; text-align: center; font-variant-numeric: tabular-nums; letter-spacing: 0; }
    .ui-badge[data-tone="primary"] { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    /* A fill growing from the inline start under the label: hold-to-confirm progress. */
    .ui-btn.filling { position: relative; overflow: hidden; isolation: isolate; }
    .fill { position: absolute; inset-block: 0; inset-inline-start: 0; z-index: -1; pointer-events: none;
      background: color-mix(in srgb, currentColor 22%, transparent); transition-property: width; transition-timing-function: linear; }
  `,
  // The name belongs on the inner button, not on this wrapper.
  host: { '[class.block-host]': 'block()', '[attr.aria-label]': 'null' },
})
export class UiButton {
  private config = inject(UI_CONFIG);
  /** Accessible name for the inner native control, when its visible text doesn't say enough
   *  ("View" in a row of doctors: "View Dr Aminath"). A plain `aria-label="…"` on the element works too. */
  ariaLabel = input<string | undefined>(undefined);
  protected readonly staticLabel = inject(new HostAttributeToken('aria-label'), { optional: true });
  /** Ids of elements describing the inner button (a hint such as "Hold to confirm"). */
  ariaDescribedby = input<string | undefined>(undefined);
  /** A progress fill under the label, 0 to 1 (null: none). Used by ui-hold-button. */
  fill = input<number | null>(null);
  /** How long the fill takes to reach a new value, in ms. */
  fillDuration = input(0);
  variant = input<UiButtonVariant>('primary');
  /** `xl` (56px) is for the one big action on a phone screen. */
  size = input<UiButtonSize>('md');
  type = input<'button' | 'submit' | 'reset'>('button');
  disabled = input(false);
  loading = input(false);
  block = input(false);
  /** Opt-in glass treatment. Buttons are solid by default (not driven by the
   *  global glass config, which targets surface components only). */
  glass = input(false);
  radius = input<boolean>(this.config.radius);
  /** A count bubble at the top-end corner ("2", "9+": see uiBadgeCount); null for none (0.44.0). */
  badge = input<string | null>(null);
  badgeTone = input<'danger' | 'primary'>('danger');
  /** What screen readers hear for the badge ("2 unread"); null: the badge text. Added to the name. */
  badgeLabel = input<string | null>(null);
  /** The aria-label: the given one, with the badge after it ("Chat, 2 unread"). Without a given one
   *  the visible text names the button and a hidden ", 2 unread" follows it. */
  protected readonly name = computed(() => {
    const label = this.ariaLabel() ?? this.staticLabel;
    const badge = this.badge();
    if (!label) return null;
    return badge === null ? label : `${label}, ${this.badgeLabel() ?? badge}`;
  });
}
