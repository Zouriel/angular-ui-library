import { Component, input } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import MinusSignIcon from '@hugeicons/core-free-icons/MinusSignIcon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import type { UiTier } from '@zouriel/ui';

/** A column of `ui-plan-compare`: one plan. */
export interface UiPlanColumn {
  key: string;
  name: string;
  tier?: UiTier | null;
}

/** A row of `ui-plan-compare`: a feature and each plan's value, by plan key. `true` is a check
 *  ("Included"), `false` or `null` a dash ("Not included"), a string is shown as it is. */
export interface UiPlanRow {
  label: string;
  values: Record<string, string | boolean | null>;
}

/**
 * `ui-plan-compare` — a plain table comparing plans feature by feature. Column headers carry a slim
 * underline in the plan's tier metal; `highlight` tints one plan's column. On a narrow screen the table
 * scrolls sideways inside the component while the feature column stays put.
 */
@Component({
  selector: 'ui-plan-compare',
  imports: [HugeiconsIconComponent],
  template: `
    <div class="scroll" tabindex="0" [attr.role]="caption() ? 'region' : null" [attr.aria-label]="caption() ?? null">
      <table [style.--_cols]="plans().length">
        @if (caption()) { <caption class="sr-only">{{ caption() }}</caption> }
        <thead>
          <tr>
            <td class="corner"></td>
            @for (p of plans(); track p.key) {
              <th scope="col" [attr.data-tier]="p.tier ?? null" [class.hl]="p.key === highlight()">
                <span class="plan">{{ p.name }}</span>
                <span class="bar" aria-hidden="true"></span>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track $index) {
            <tr>
              <th scope="row">{{ r.label }}</th>
              @for (p of plans(); track p.key) {
                @let v = r.values[p.key];
                <td [class.hl]="p.key === highlight()">
                  @if (v === true) {
                    <hugeicons-icon class="yes" [icon]="tick" [size]="16" [strokeWidth]="2" aria-hidden="true" /><span class="sr-only">{{ includedLabel() }}</span>
                  } @else if (v === false || v === null || v === undefined) {
                    <hugeicons-icon class="no" [icon]="dash" [size]="16" [strokeWidth]="2" aria-hidden="true" /><span class="sr-only">{{ notIncludedLabel() }}</span>
                  } @else {
                    {{ v }}
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host { display: block; container-type: inline-size; }
    /* relative: the hidden screen-reader text in the cells is positioned, and must scroll with the
       table rather than widen the page. */
    .scroll {
      position: relative; overflow-x: auto; overscroll-behavior-x: contain;
      background: var(--ui-color-surface);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-lg);
    }
    .scroll:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    table {
      --_label: 220px;
      width: 100%; min-width: calc(var(--_label) + var(--_cols) * 120px);
      border-collapse: separate; border-spacing: 0; table-layout: fixed;
      font-family: var(--ui-font-default); font-size: calc(14px * var(--ui-font-scale)); line-height: 1.45; color: var(--ui-color-text);
    }
    th, td {
      padding: var(--ui-space-3) var(--ui-space-4);
      border-bottom: 1px solid var(--ui-color-border-subtle);
      text-align: center; vertical-align: middle; overflow-wrap: anywhere;
    }
    tbody tr:last-child > * { border-bottom: 0; }
    /* The feature column stays put while the plans scroll under it, so it has its own opaque ground. */
    th[scope="row"], .corner {
      position: sticky; inset-inline-start: 0; z-index: 1;
      width: var(--_label); box-sizing: border-box;
      background: var(--ui-color-surface);
      text-align: start; font-weight: 500;
    }
    thead th { font-weight: 600; vertical-align: bottom; }
    .plan { display: block; }
    .bar { display: block; height: 3px; margin-top: var(--ui-space-2); border-radius: var(--ui-radius-pill); background: var(--ui-color-border); }
    th[data-tier="gold"] .bar { background: var(--ui-gradient-tier-gold); }
    th[data-tier="platinum"] .bar { background: var(--ui-gradient-tier-platinum); }
    th[data-tier="premium"] .bar { background: var(--ui-gradient-tier-premium); }
    .hl { background: var(--ui-color-selected); }
    hugeicons-icon { display: inline-flex; vertical-align: middle; }
    .yes { color: var(--ui-color-success); }
    .no { color: var(--ui-color-text-muted); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    /* Narrow: a slimmer feature column. After the base rule it overrides. */
    @container (max-width: 599px) {
      table { --_label: 160px; }
    }
  `,
})
export class UiPlanCompare {
  protected readonly tick = Tick02Icon;
  protected readonly dash = MinusSignIcon;
  /** The plans, one column each, in order. */
  plans = input.required<readonly UiPlanColumn[]>();
  /** The features, one row each. */
  rows = input.required<readonly UiPlanRow[]>();
  /** A plan key whose column is tinted. */
  highlight = input<string | null>(null);
  /** Names the table for screen readers (a hidden caption). */
  caption = input<string | null>(null);
  includedLabel = input('Included');
  notIncludedLabel = input('Not included');
}
