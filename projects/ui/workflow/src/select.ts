import { Component, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { UiSelect, type UiSelectOption } from '@zouriel/ui/form';

/** A choice in a `ui-wf-select`. */
export interface WfOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * `ui-wf-select` — the workflow editors' compact dropdown: a small `ui-select` with value in,
 * `valueChange` out. A stored value that isn't among the options is shown as
 * "[value] (not available here)" (or `unknownLabel`), so nothing silently changes. With `reset`
 * it is a picker ("Add…"): every pick is reported and the field goes back to the placeholder.
 */
@Component({
  selector: 'ui-wf-select',
  imports: [UiSelect],
  // A picker is drawn afresh after each pick: the browser keeps showing the picked option otherwise.
  template: `@for (g of [generation()]; track g) { <ui-select [size]="size()" [options]="shown()" [placeholder]="placeholder()" [label]="label()" /> }`,
  styles: `:host { display: block; min-width: 0; }`,
})
export class WfSelect {
  readonly options = input<readonly WfOption[]>([]);
  readonly value = input<string | null | undefined>(null);
  /** Shown (and not choosable) while nothing is chosen. */
  readonly placeholder = input<string | undefined>(undefined);
  /** Accessible name. */
  readonly label = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly size = input<'sm' | 'md'>('sm');
  /** How a stored value that isn't among the options reads. */
  readonly unknownLabel = input<((value: string) => string) | null>(null);
  /** A picker: report each pick, then show the placeholder again. */
  readonly reset = input(false);
  readonly valueChange = output<string>();

  /** Empty for a moment while a picker draws its select afresh. */
  private readonly select = viewChild(UiSelect);
  protected readonly generation = signal(0);
  private readonly current = computed(() => (this.reset() ? '' : (this.value() ?? '')));
  protected readonly shown = computed<UiSelectOption[]>(() => {
    const v = this.current();
    const opts: UiSelectOption[] = this.options().map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }));
    if (v && !opts.some((o) => o.value === v)) opts.unshift({ value: v, label: this.unknownLabel()?.(v) ?? `${v} (not available here)`, disabled: true });
    return opts;
  });

  constructor() {
    // Drive the select directly (not through ngModel, which writes a tick later) so it always shows the value given.
    effect(() => this.select()?.writeValue(this.current()));
    effect(() => this.select()?.setDisabledState(this.disabled()));
    effect(() => {
      const sel = this.select();
      sel?.registerOnChange((v: string) => {
        this.valueChange.emit(v);
        if (this.reset()) this.generation.update((g) => g + 1);
      });
    });
  }
}
