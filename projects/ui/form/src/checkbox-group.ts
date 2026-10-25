import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { injectUiStrings } from '@zouriel/ui';

export interface UiCheckboxOption {
  label: string;
  value: string;
  disabled?: boolean;
}

/**
 * `ui-checkbox-group` — multi-select checkbox set (CVA; value is string[]).
 *
 * Set `selectAll` to prepend a master checkbox that ticks or clears every enabled option. It shows
 * an indeterminate state while the selection is partial, and never touches disabled options — the
 * consumer's disabled rules stay authoritative.
 */
@Component({
  selector: 'ui-checkbox-group',
  template: `
    <div class="grp" role="group" [attr.aria-label]="label()" [class.row]="orientation() === 'horizontal'">
      @if (selectAll() && options().length) {
        <label class="opt all" [class.disabled]="disabled()">
          <input type="checkbox" class="native"
                 [checked]="allSelected()"
                 [indeterminate]="someSelected()"
                 [disabled]="disabled()"
                 (change)="toggleAll()" (blur)="onTouched()" />
          <span class="box" aria-hidden="true">
            <svg viewBox="0 0 16 16" class="tick"><path d="M3 8.5l3 3 7-7" /></svg>
            <span class="dash"></span>
          </span>
          <span class="text">{{ selectAllLabelText() }}</span>
        </label>
      }
      @for (opt of options(); track opt.value) {
        <label class="opt" [class.disabled]="disabled() || opt.disabled">
          <input type="checkbox" class="native"
                 [checked]="selected().has(opt.value)"
                 [disabled]="disabled() || !!opt.disabled"
                 (change)="toggle(opt.value)" (blur)="onTouched()" />
          <span class="box" aria-hidden="true">
            <svg viewBox="0 0 16 16" class="tick"><path d="M3 8.5l3 3 7-7" /></svg>
          </span>
          <span class="text">{{ opt.label }}</span>
        </label>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .grp { display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .grp.row { flex-direction: row; flex-wrap: wrap; gap: var(--ui-space-4); }
    .opt { display: inline-flex; align-items: flex-start; gap: var(--ui-space-2); cursor: pointer; font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); line-height: 1.35; color: var(--ui-color-text); }
    .opt.disabled { opacity: .5; cursor: not-allowed; }
    .native { position: absolute; opacity: 0; width: 0; height: 0; }
    .box { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 18px; height: 18px; flex: none; margin-top: 1px;
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius-xs); background: var(--ui-color-surface);
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), border-color var(--ui-motion-fast) var(--ui-ease-standard); }
    .tick { width: 12px; height: 12px; fill: none; stroke: var(--ui-color-primary-contrast); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 16; stroke-dashoffset: 16; transition: stroke-dashoffset var(--ui-motion-base) var(--ui-ease-standard); }
    .native:checked + .box { background: var(--ui-color-primary); border-color: var(--ui-color-primary); }
    .native:checked + .box .tick { stroke-dashoffset: 0; }
    .native:focus-visible + .box { box-shadow: var(--ui-focus-ring); }
    .opt:not(.disabled):hover .native:not(:checked):not(:indeterminate) + .box { border-color: var(--ui-color-primary); }
    /* Master row: set apart from the options it governs. */
    .opt.all { font-weight: 600; }
    .grp:not(.row) .opt.all { padding-bottom: var(--ui-space-2); border-bottom: 1px solid var(--ui-color-border); }
    .grp.row .opt.all { padding-inline-end: var(--ui-space-4); border-inline-end: 1px solid var(--ui-color-border); }
    .dash { display: none; width: 9px; height: 2px; border-radius: 1px; background: var(--ui-color-primary-contrast); }
    /* Partial selection reads as a dash, not a tick — "some" must not look like "all". */
    .native:indeterminate + .box { background: var(--ui-color-primary); border-color: var(--ui-color-primary); }
    .native:indeterminate + .box .tick { display: none; }
    .native:indeterminate + .box .dash { display: block; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiCheckboxGroup), multi: true }],
})
export class UiCheckboxGroup implements ControlValueAccessor {
  protected readonly strings = injectUiStrings();
  options = input<UiCheckboxOption[]>([]);
  label = input<string>();
  orientation = input<'vertical' | 'horizontal'>('vertical');
  /** Show a master checkbox that ticks/clears every enabled option. */
  selectAll = input(false);
  /** Default: the built-in `selectAll` (Select all), which follows the app's language. */
  selectAllLabel = input<string | undefined>(undefined);
  protected readonly selectAllLabelText = computed(() => this.selectAllLabel() ?? this.strings.selectAll);

  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly disabled = signal(false);

  /** Options the master row governs — disabled ones are never toggled by it. */
  private readonly togglable = computed(() => this.options().filter((o) => !o.disabled));
  protected readonly allSelected = computed(() => {
    const all = this.togglable();
    return all.length > 0 && all.every((o) => this.selected().has(o.value));
  });
  protected readonly someSelected = computed(
    () => !this.allSelected() && this.togglable().some((o) => this.selected().has(o.value)),
  );
  private onChange: (v: string[]) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string[]): void { this.selected.set(new Set(v ?? [])); }
  registerOnChange(fn: (v: string[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected toggle(value: string): void {
    const next = new Set(this.selected());
    next.has(value) ? next.delete(value) : next.add(value);
    this.selected.set(next);
    this.onChange([...next]);
  }

  /**
   * Ticks every enabled option, or clears them when they're already all ticked. A disabled option's
   * current state is preserved either way — the master row governs what the user could click.
   */
  protected toggleAll(): void {
    const next = new Set(this.selected());
    const shouldSelect = !this.allSelected();
    for (const option of this.togglable()) {
      if (shouldSelect) next.add(option.value);
      else next.delete(option.value);
    }
    this.selected.set(next);
    this.onChange([...next]);
  }
}
