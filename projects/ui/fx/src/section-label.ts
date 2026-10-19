import { Component, input } from '@angular/core';

/**
 * How `ui-section-label` draws: `bracket` is the editorial mono marker made for Dark Orange
 * (`[ 00 · INDEX ]`), `eyebrow` a quieter accent bar + small caps in the theme's own font, and
 * `auto` picks bracket on Dark Orange and eyebrow everywhere else.
 */
export type UiSectionLabelVariant = 'auto' | 'bracket' | 'eyebrow';

/** `ui-section-label` — a section marker above a heading: an optional index and a label. */
@Component({
  selector: 'ui-section-label',
  template: `
    <div class="sl" [class.auto]="variant() === 'auto'" [class.bracket]="variant() === 'bracket'">
      <span class="bar" aria-hidden="true"></span>
      <span class="br" aria-hidden="true">[</span>
      @if (index()) { <span class="idx">{{ index() }}</span><span class="dot" aria-hidden="true">·</span> }
      <span class="label">{{ label() }}</span>
      <span class="br" aria-hidden="true">]</span>
      <span class="rule" aria-hidden="true"></span>
    </div>
  `,
  styles: `
    :host { display: block; }
    /* Eyebrow (the default outside Dark Orange): accent bar, index in the primary colour, label in
       secondary text, the theme's font, light tracking. --ui-section-label-bracket colours the bar. */
    .sl { display: inline-flex; align-items: center; gap: var(--ui-space-2); line-height: 1.35;
      font-family: var(--ui-font-default); font-size: 12px; font-weight: 600; text-transform: uppercase;
      letter-spacing: var(--ui-tracking-wide); color: var(--ui-color-text-secondary); }
    .bar { width: 16px; height: 2px; border-radius: var(--ui-radius-pill); background: var(--ui-section-label-bracket); }
    .br, .dot { display: none; }
    .idx { color: var(--ui-color-primary); font-variant-numeric: tabular-nums; }
    .rule { height: 1px; width: 3rem; margin-left: var(--ui-space-1); background: linear-gradient(90deg, var(--ui-color-border), transparent); }

    /* Bracket: the editorial mono marker, [ 00 · INDEX ]. (auto takes it under Dark Orange.) */
    .sl.bracket, :host-context([data-theme="darkOrange"]) .sl.auto {
      gap: var(--ui-space-3); font-family: var(--ui-font-mono); font-size: 11px; font-weight: 400;
      letter-spacing: 0.4em; color: var(--ui-color-text-muted); }
    .sl.bracket .bar, :host-context([data-theme="darkOrange"]) .sl.auto .bar { display: none; }
    .sl.bracket .br, .sl.bracket .dot,
    :host-context([data-theme="darkOrange"]) .sl.auto .br,
    :host-context([data-theme="darkOrange"]) .sl.auto .dot { display: inline; }
    .sl.bracket .br, :host-context([data-theme="darkOrange"]) .sl.auto .br { color: var(--ui-section-label-bracket); }
    .sl.bracket .idx, .sl.bracket .label,
    :host-context([data-theme="darkOrange"]) .sl.auto .idx,
    :host-context([data-theme="darkOrange"]) .sl.auto .label { color: var(--ui-color-text); }
  `,
})
export class UiSectionLabel {
  index = input<string>('');
  label = input.required<string>();
  /** `auto` = bracket on Dark Orange, eyebrow elsewhere. */
  variant = input<UiSectionLabelVariant>('auto');
}
