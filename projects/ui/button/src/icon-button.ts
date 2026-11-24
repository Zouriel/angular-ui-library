import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { UI_CONFIG, injectUiLinkNavigator, uiFollowLink, type UiSize, type UiButtonSize } from '@zouriel/ui';
import type { UiButtonVariant } from './button';

/**
 * `ui-icon-button` — square, icon-only action. `label` is REQUIRED and applied
 * as `aria-label` so the control is named for assistive tech (WCAG).
 */
@Component({
  selector: 'ui-icon-button',
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #inner>
      <ng-content />
      @if (badge() !== null) { <span class="ui-badge" aria-hidden="true" [attr.data-tone]="badgeTone()">{{ badge() }}</span> }
    </ng-template>
    @if (href() !== null) {
      <a
        class="ui-icon-btn"
        [class.glass]="glass()"
        [class.no-radius]="!radius()"
        [class.round]="round()"
        [attr.href]="disabled() ? null : href()"
        [attr.target]="target()"
        [attr.rel]="target() === '_blank' ? 'noopener noreferrer' : null"
        [attr.aria-disabled]="disabled() || null"
        [attr.aria-current]="isCurrent() ? 'page' : null"
        [attr.data-variant]="variant()"
        [attr.data-size]="size()"
        [attr.aria-label]="name()"
        (click)="follow($event)">
        <ng-container [ngTemplateOutlet]="inner" />
      </a>
    } @else {
    <button
      class="ui-icon-btn"
      [class.glass]="glass()"
      [class.no-radius]="!radius()"
      [class.round]="round()"
      [attr.type]="type()"
      [attr.data-variant]="variant()"
      [attr.data-size]="size()"
      [attr.aria-label]="name()"
      [disabled]="disabled()">
      <ng-container [ngTemplateOutlet]="inner" />
    </button>
    }
  `,
  styles: `
    :host { display: inline-flex; }
    .ui-icon-btn {
      position: relative;
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--ui-size-md); height: var(--ui-size-md);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-button-radius);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      font: inherit; padding: 0;
      cursor: pointer;
      transition: background var(--ui-motion-base) var(--ui-ease-standard),
                  transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    /* Invisible hit-slop on coarse pointers only: every size here is below the 44px touch minimum.
       On desktop a slop overlapped the next button in a dense toolbar and stole its clicks. */
    @media (pointer: coarse) {
      .ui-icon-btn::before { content: ''; position: absolute; inset: calc((var(--ui-size-md) - var(--ui-size-touch)) / 2); }
      .ui-icon-btn[data-size="sm"]::before { inset: calc((var(--ui-size-sm) - var(--ui-size-touch)) / 2); }
      .ui-icon-btn[data-size="lg"]::before { inset: calc((var(--ui-size-lg) - var(--ui-size-touch)) / 2); }
    }
    .ui-icon-btn:hover:not(:disabled) { background: var(--ui-color-surface-hover); }
    .ui-icon-btn:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .ui-icon-btn:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-icon-btn:disabled { opacity: .5; cursor: not-allowed; }
    a.ui-icon-btn[aria-disabled="true"] { opacity: .5; cursor: not-allowed; }
    a.ui-icon-btn { box-sizing: border-box; text-decoration: none; }
    a.ui-icon-btn[aria-disabled="true"] { pointer-events: none; }
    .ui-icon-btn[aria-current="page"]:is([data-variant="ghost"], [data-variant="outline"], [data-variant="link"]) { background: var(--ui-color-selected); color: var(--ui-color-primary); }
    .ui-icon-btn.no-radius { border-radius: 0; }
    .ui-icon-btn.round { border-radius: var(--ui-radius-pill); }
    .ui-icon-btn.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); box-shadow: var(--ui-glass-highlight); }
    .ui-icon-btn[data-size="sm"] { width: var(--ui-size-sm); height: var(--ui-size-sm); }
    .ui-icon-btn[data-size="lg"] { width: var(--ui-size-lg); height: var(--ui-size-lg); }
    .ui-icon-btn[data-size="xl"] { width: var(--ui-size-xl); height: var(--ui-size-xl); }
    .ui-icon-btn[data-variant="primary"] { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent; }
    .ui-icon-btn[data-variant="primary"]:hover:not(:disabled) { background: var(--ui-color-primary-hover); }
    .ui-icon-btn[data-variant="destructive"] { background: var(--ui-color-danger); color: var(--ui-color-danger-contrast); border-color: transparent; }
    .ui-icon-btn[data-variant="destructive"]:hover:not(:disabled) { background: var(--ui-color-danger-hover); }
    .ui-icon-btn[data-variant="primary"]:active:not(:disabled) { background: var(--ui-color-primary-active); }
    .ui-icon-btn[data-variant="secondary"] { background: var(--ui-color-secondary); color: var(--ui-color-secondary-contrast); border-color: transparent; }
    .ui-icon-btn[data-variant="secondary"]:hover:not(:disabled) { background: var(--ui-color-secondary-hover); }
    .ui-icon-btn[data-variant="accent"] { background: var(--ui-color-accent); color: var(--ui-color-accent-contrast); border-color: transparent; }
    .ui-icon-btn[data-variant="accent"]:hover:not(:disabled) { background: color-mix(in srgb, var(--ui-color-accent) 88%, var(--ui-color-accent-contrast)); }
    .ui-icon-btn[data-variant="outline"] { background: transparent; }
    /* Icons follow the button's colour when it is filled; ghost and outline ones take --ui-color-icon. */
    .ui-icon-btn:not([data-variant="ghost"]):not([data-variant="outline"]):not([data-variant="link"]) { --ui-color-icon: currentColor; }
    .ui-icon-btn[data-variant="ghost"], .ui-icon-btn[data-variant="link"] { background: transparent; border-color: transparent; }
    /* On media (inside a [data-on-media] scope): light ink and a translucent light hover. */
    :host-context([data-on-media]) .ui-icon-btn:is([data-variant="ghost"], [data-variant="link"]):not([aria-current="page"]) {
      color: var(--ui-media-on-scrim); --ui-color-icon: var(--ui-media-on-scrim); }
    :host-context([data-on-media]) .ui-icon-btn:is([data-variant="ghost"], [data-variant="link"]):not([aria-current="page"]) ::ng-deep svg {
      filter: drop-shadow(0 1px 3px color-mix(in srgb, var(--ui-media-scrim) 45%, transparent)); }
    :host-context([data-on-media]) .ui-icon-btn:is([data-variant="ghost"], [data-variant="link"]):not([aria-current="page"]):hover:not(:disabled) {
      background: color-mix(in srgb, var(--ui-media-on-scrim) 16%, transparent); }
    .ui-icon-btn[data-variant="brand"] { background: var(--ui-gradient-brand, var(--ui-color-primary)); color: var(--ui-gradient-brand-contrast, var(--ui-color-primary-contrast)); border-color: transparent; }
    .ui-icon-btn[data-variant="brand"]:hover:not(:disabled) { background: var(--ui-gradient-brand, var(--ui-color-primary)); box-shadow: inset 0 0 0 999px color-mix(in srgb, var(--ui-gradient-brand-contrast, var(--ui-color-primary-contrast)) 12%, transparent); }
    /* badge (0.44.0): a count bubble at the top-end corner, the bottom nav's badge look. Hidden from
       screen readers: the button's name carries it ("Chat, 2 unread"). */
    .ui-badge { position: absolute; top: -6px; inset-inline-end: -6px; z-index: 1; min-width: 16px; height: 16px; padding: 0 var(--ui-space-1);
      box-sizing: border-box; border-radius: var(--ui-radius-pill); pointer-events: none; white-space: nowrap;
      background: var(--ui-color-danger); color: var(--ui-color-danger-contrast);
      font-family: var(--ui-font-default); font-size: 11px; font-weight: 600; line-height: 16px; text-align: center; font-variant-numeric: tabular-nums; letter-spacing: 0; }
    .ui-badge[data-tone="primary"] { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); }
    /* Projected icons carry the parent's content attribute, so they need ::ng-deep to be sized. */
    .ui-icon-btn ::ng-deep svg { width: 16px; height: 16px; flex: none; }
    .ui-icon-btn[data-size="sm"] ::ng-deep svg { width: 14px; height: 14px; }
    .ui-icon-btn[data-size="lg"] ::ng-deep svg { width: 18px; height: 18px; }
    .ui-icon-btn[data-size="xl"] ::ng-deep svg { width: 24px; height: 24px; }
  `,
})
export class UiIconButton {
  private config = inject(UI_CONFIG);
  /** Accessible name for the icon-only control (required for a11y). */
  label = input.required<string>();
  variant = input<UiButtonVariant>('ghost');
  size = input<UiButtonSize>('md');
  type = input<'button' | 'submit' | 'reset'>('button');
  disabled = input(false);
  round = input(false);
  /** Opt-in glass treatment; solid by default (see UiButton). */
  glass = input(false);
  radius = input<boolean>(this.config.radius);
  /** A count bubble at the top-end corner ("2", "9+": see uiBadgeCount); null for none (0.44.0). */
  badge = input<string | null>(null);
  badgeTone = input<'danger' | 'primary'>('danger');
  /** What screen readers hear for the badge ("2 unread"); null: the badge text. Added to the name. */
  badgeLabel = input<string | null>(null);
  /** Makes it a link to `href` (0.87.0), like `ui-button`'s `href`. */
  href = input<string | null>(null);
  target = input<string | null>(null);
  /** With `href`: marks the page that is open. Null: ask the link navigator. */
  current = input<boolean | null>(null);
  private readonly navigator = injectUiLinkNavigator();
  protected readonly isCurrent = computed(() => {
    const own = this.current();
    if (own !== null) return own;
    const href = this.href();
    return href !== null && !!this.navigator?.isCurrent?.(href);
  });
  protected follow(event: MouseEvent): void {
    if (this.disabled()) { event.preventDefault(); return; }
    uiFollowLink(this.navigator, this.href(), event, this.target());
  }
  /** The aria-label with the badge after it: "Chat, 2 unread". */
  protected readonly name = computed(() => {
    const badge = this.badge();
    return badge === null ? this.label() : `${this.label()}, ${this.badgeLabel() ?? badge}`;
  });
}
