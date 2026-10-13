import { Component, input } from '@angular/core';

/** `ui-link` — themed anchor. External links get safe rel + a visual marker. */
@Component({
  selector: 'ui-link',
  template: `
    <a
      class="ui-link"
      [attr.href]="href()"
      [attr.target]="external() ? '_blank' : null"
      [attr.rel]="external() ? 'noopener noreferrer' : null"
      [attr.data-tone]="tone()">
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
    .ext { margin-left: 0.15em; vertical-align: baseline; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  `,
})
export class UiLink {
  href = input<string>();
  external = input(false);
  tone = input<'primary' | 'muted' | 'plain'>('primary');
}
