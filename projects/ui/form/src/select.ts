import { Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, uiFontStack, type UiSize } from '@zouriel/ui';

export interface UiSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
  /** Show this option in this font (a family name or a CSS font stack). */
  fontFamily?: string;
}

/**
 * `ui-select` — single-choice dropdown (CVA) built on a native `<select>` for
 * full keyboard/screen-reader support. For rich filtering use combobox instead.
 *
 * Font pickers: with `fontPreview` each option is drawn in its own font (`option.fontFamily`, or
 * the option's value as a family name), and so is the closed field. Desktop Chrome and Firefox
 * style native options; where the browser supports `appearance: base-select` the whole list is
 * drawn by the page instead, so it works there too. Phone and macOS native pickers ignore option
 * fonts; use `ui-combobox` with `fontPreview` when the preview must show everywhere.
 */
@Component({
  selector: 'ui-select',
  template: `
    <div class="wrap" [class.no-radius]="!radius()" [attr.data-size]="size()">
      <select
        class="ui-select"
        [class.font-preview]="fontPreview()"
        [style.font-family]="selectedFont()"
        [disabled]="disabled()"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-label]="label()"
        (change)="handleChange($event)"
        (blur)="onTouched()">
        <!--
          Selectedness is bound per-option (a pure function of value()) rather than via [value] on
          the <select>. With [value] alone, async-loaded options make the browser silently reset the
          selection to the first enabled option WITHOUT firing 'change', so the displayed option and
          the control value drift apart (placeholder shows an option that was never actually chosen).
        -->
        @if (placeholder()) {
          <option value="" disabled [selected]="!value()">{{ placeholder() }}</option>
        }
        @for (opt of options(); track opt.value) {
          <option [value]="opt.value" [selected]="opt.value === value()" [disabled]="!!opt.disabled" [style.font-family]="fontOf(opt)">{{ opt.label }}</option>
        }
      </select>
      <svg class="chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { position: relative; }
    .ui-select {
      width: 100%; box-sizing: border-box; appearance: none;
      height: var(--ui-size-md); padding-block: 0; padding-inline: var(--ui-space-3) calc(var(--ui-space-3) + 12px + var(--ui-space-2));
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); cursor: pointer;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-select:focus-visible { outline: none; border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .ui-select:disabled { opacity: .5; cursor: not-allowed; }
    .wrap.no-radius .ui-select { border-radius: 0; }
    .wrap[data-size="sm"] .ui-select { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .wrap[data-size="lg"] .ui-select { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .ui-select[aria-invalid="true"] { border-color: var(--ui-color-danger); }
    .ui-select[aria-invalid="true"]:focus-visible { box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 4px var(--ui-color-danger); }
    .wrap:has(.ui-select:disabled) .chevron { opacity: .5; }
    .chevron { position: absolute; inset-inline-end: var(--ui-space-3); top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--ui-color-text-muted); }
    /*
     * The popup list is painted by the platform, not by this stylesheet, so it has to be told the
     * theme's colours outright. "color: initial" put black text in it, which on a dark theme is
     * either unreadable or invisible depending on what the platform chose for the background.
     */
    option { background-color: var(--ui-color-surface); color: var(--ui-color-text); }
    option:disabled { color: var(--ui-color-text-muted); }
    /* Font pickers: where supported, the page draws the list, so every option shows its font on
       every platform that has the feature. Styled with the same tokens as the rest of the field. */
    @supports (appearance: base-select) {
      .ui-select.font-preview, .ui-select.font-preview::picker(select) { appearance: base-select; }
      /* A base-select lays its button out as a block, with the value at the top; centre it like the native field. */
      .ui-select.font-preview { display: flex; align-items: center; }
      .ui-select.font-preview::picker-icon { display: none; }
      .ui-select.font-preview::picker(select) {
        background: var(--ui-color-surface-raised); color: var(--ui-color-text);
        border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
        box-shadow: var(--ui-shadow-2); padding: var(--ui-space-1); max-height: 320px;
        margin-block: var(--ui-space-1); /* the 4px gap the combobox and date picker leave below the field */
      }
      /* 4px panel + 8px option padding: option text starts under the field's value text. */
      .ui-select.font-preview option { padding: var(--ui-space-2); border-radius: var(--ui-radius-xs); font-size: var(--ui-font-size-md); }
      .ui-select.font-preview option:hover, .ui-select.font-preview option:focus-visible { background: var(--ui-color-elevated-hover); outline: none; }
      .ui-select.font-preview option:checked { background: var(--ui-color-selected); }
      .ui-select.font-preview option::checkmark { display: none; }
    }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSelect), multi: true }],
})
export class UiSelect implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  options = input<UiSelectOption[]>([]);
  placeholder = input<string>();
  label = input<string>();
  size = input<UiSize>('md');
  invalid = input(false);
  radius = input<boolean>(this.config.radius);
  /** Draw each option, and the closed field, in the font it names (for font pickers). */
  fontPreview = input(false);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly selectedFont = computed(() => {
    if (!this.fontPreview()) return null;
    const opt = this.options().find((o) => o.value === this.value());
    return opt ? this.fontOf(opt) : null;
  });

  /** An option's preview font: its own fontFamily, or with fontPreview its value as a family name. */
  protected fontOf(opt: UiSelectOption): string | null {
    return uiFontStack(opt.fontFamily ?? (this.fontPreview() ? opt.value : null));
  }
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected handleChange(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.value.set(v);
    this.onChange(v);
  }
}
