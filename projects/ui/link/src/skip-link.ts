import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';

/**
 * `ui-skip-link` — "Skip to content" (0.87.0): the first thing a keyboard reaches on a page, hidden until it
 * has focus, then shown at the top-start corner. Activating it moves focus to the page's main content
 * (`target`, an element id) without a page load (a `<base href>` would turn `#main` into one): the target
 * gets `tabindex="-1"` when it has none, and is scrolled into view. Put it first in the app's root template.
 *
 * ```html
 * <ui-skip-link />  <!-- …later: <main id="main"> -->
 * ```
 */
@Component({
  selector: 'ui-skip-link',
  template: `<a class="ui-skip-link" [attr.href]="'#' + target()" (click)="skip($event)">{{ text() }}</a>`,
  styles: `
    :host { display: contents; }
    .ui-skip-link {
      position: fixed; inset-block-start: var(--ui-space-2); inset-inline-start: var(--ui-space-2); z-index: var(--ui-z-toast);
      padding: var(--ui-space-2) var(--ui-space-4); border-radius: var(--ui-radius);
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); font-weight: 600; text-decoration: none;
      box-shadow: var(--ui-shadow-2);
    }
    /* Out of sight (but not out of the tab order) until it has focus. */
    .ui-skip-link:not(:focus) { width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; box-shadow: none; }
    .ui-skip-link:focus-visible { outline: none; box-shadow: var(--ui-focus-ring), var(--ui-shadow-2); }
  `,
})
export class UiSkipLink {
  private readonly strings = injectUiStrings();
  private readonly doc = inject(DOCUMENT);
  /** The id of the element holding the page's main content. */
  readonly target = input('main');
  /** The link's words; null: the built-in "Skip to content". */
  readonly label = input<string | null>(null);
  protected readonly text = computed(() => this.label() ?? this.strings.skipToContent);

  protected skip(event: MouseEvent): void {
    const el = this.doc.getElementById(this.target());
    if (!el) return;
    event.preventDefault();
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'start' });
  }
}
