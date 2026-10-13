import { Component, input } from '@angular/core';

/** `ui-section-label` — editorial mono section marker, e.g. `[ 00 · INDEX ]`. */
@Component({
  selector: 'ui-section-label',
  template: `
    <div class="sl">
      <span class="br" aria-hidden="true">[</span>
      @if (index()) { <span class="idx">{{ index() }}</span><span class="dot" aria-hidden="true">·</span> }
      <span class="label">{{ label() }}</span>
      <span class="br" aria-hidden="true">]</span>
      <span class="rule" aria-hidden="true"></span>
    </div>
  `,
  styles: `
    :host { display: block; }
    .sl { display: inline-flex; align-items: center; gap: var(--ui-space-3); line-height: 1.35;
      font-family: var(--ui-font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.4em;
      color: var(--ui-color-text-muted); }
    .br { color: var(--ui-section-label-bracket); }
    .idx { color: var(--ui-color-text); }
    .dot { color: var(--ui-color-text-muted); }
    .label { color: var(--ui-color-text); }
    .rule { height: 1px; width: 3rem; background: linear-gradient(90deg, var(--ui-color-border), transparent); }
  `,
})
export class UiSectionLabel {
  index = input<string>('');
  label = input.required<string>();
}
