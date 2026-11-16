import { Component, input } from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';
import { WF_SHARED_STYLES } from './styles';

/**
 * A workflow component's error (0.87.0): the plain sentence, and, when there is one, the technical
 * detail (method, path, status, what came back) in a closed "Technical details" disclosure, so a raw
 * error page is never shown open. Internal: used by the panel, task list, run view, audit and permissions.
 */
@Component({
  selector: 'ui-wf-error',
  template: `
    <div class="wf-error" role="alert">
      <span>{{ text() }}</span><ng-content />
      @if (detail(); as d) {
        <details class="tech"><summary>{{ strings.technicalDetails }}</summary><code>{{ d }}</code></details>
      }
    </div>
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: block; }
    .tech { margin-top: var(--ui-space-1); }
    .tech summary { cursor: pointer; font-size: 11.5px; color: var(--ui-color-text-muted); width: fit-content; border-radius: var(--ui-radius-xs); }
    .tech summary:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .tech code { display: block; margin-top: var(--ui-space-1); font-family: var(--ui-font-mono, monospace); font-size: 11px; line-height: 1.4;
      color: var(--ui-color-text-muted); overflow-wrap: anywhere; white-space: pre-wrap; }
  `],
})
export class WfErrorNote {
  protected readonly strings = injectUiStrings();
  readonly text = input.required<string>();
  readonly detail = input<string | null>(null);
}
