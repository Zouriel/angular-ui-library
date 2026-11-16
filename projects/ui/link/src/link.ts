import { Component, computed, input } from '@angular/core';
import { injectUiLinkNavigator, uiFollowLink } from '@zouriel/ui';

/**
 * `ui-link` — themed anchor. External links get safe rel + a visual marker.
 *
 * A plain click on an app-internal href goes through the app's link navigator when there is one
 * (`provideUiLinkNavigator`, or `provideUiRouterLinks()` from `@zouriel/ui/router`), so it needs no
 * click handler of its own. `current` marks the page that is open (`aria-current="page"`); left null, the
 * navigator's `isCurrent` decides (0.87.0).
 */
@Component({
  selector: 'ui-link',
  template: `
    <a
      class="ui-link"
      [attr.href]="href()"
      [attr.target]="external() ? '_blank' : null"
      [attr.rel]="external() ? 'noopener noreferrer' : null"
      [attr.aria-current]="isCurrent() ? 'page' : null"
      [attr.data-tone]="tone()"
      (click)="follow($event)">
      <ng-content />
      @if (external()) {
        <svg class="ext" viewBox="0 0 12 12" width="0.75em" height="0.75em" aria-hidden="true"><path d="M4 2.5h5.5V8M9.5 2.5L3 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="sr-only">(opens in a new tab)</span>
      }
    </a>
  `,
  styles: `
    :host { display: inline; }
    .ui-link {
      /* Holds the visually hidden "(opens in a new tab)": without a positioned ancestor that absolute text
         escaped a scrolling box (a table cell) and widened the page on phones. */
      position: relative;
      color: var(--ui-color-primary);
      /* Underlined at rest (subtle), so a link never relies on colour alone — plain inherits the text colour. */
      text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px;
      text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);
      font-family: var(--ui-font-default); cursor: pointer;
      border-radius: var(--ui-radius-xs);
      transition: color var(--ui-motion-fast) var(--ui-ease-standard), text-decoration-color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .ui-link:hover { text-decoration-color: currentColor; color: var(--ui-color-primary-hover); }
    .ui-link:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-link[data-tone="muted"] { color: var(--ui-color-text-muted); }
    .ui-link[data-tone="plain"] { color: inherit; }
    .ui-link[data-tone="muted"]:hover { color: var(--ui-color-text); }
    /* The page that is open: the text colour, heavier, the underline solid (not colour alone). */
    .ui-link[aria-current="page"] { color: var(--ui-color-text); font-weight: 600; text-decoration-color: currentColor; text-decoration-thickness: 2px; }
    .ext { margin-left: 0.15em; vertical-align: baseline; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  `,
})
export class UiLink {
  href = input<string>();
  external = input(false);
  tone = input<'primary' | 'muted' | 'plain'>('primary');
  /** The page this link opens is the one shown: `aria-current="page"` and the current look. Null: ask the link navigator. */
  current = input<boolean | null>(null);

  private readonly navigator = injectUiLinkNavigator();
  protected readonly isCurrent = computed(() => {
    const own = this.current();
    if (own !== null) return own;
    const href = this.href();
    return !!href && !this.external() && !!this.navigator?.isCurrent?.(href);
  });

  protected follow(event: MouseEvent): void {
    uiFollowLink(this.navigator, this.href(), event, this.external() ? '_blank' : null);
  }
}
