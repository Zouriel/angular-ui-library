import { Component, forwardRef, inject, input, signal, computed } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize, injectUiStrings } from '@zouriel/ui';

/** `ui-search-input` — search field with icon and clear button (CVA). */
@Component({
  selector: 'ui-search-input',
  imports: [HugeiconsIconComponent],
  template: `
    <div class="wrap" [class.no-radius]="!radius()" [attr.data-size]="size()">
      <span class="icon" aria-hidden="true">
        <hugeicons-icon [icon]="searchIcon" [size]="16" [strokeWidth]="1.8" />
      </span>
      <input
        #inp
        class="ui-search"
        type="search"
        role="searchbox"
        [attr.aria-label]="label() || null"
        [attr.placeholder]="placeholderText()"
        [value]="value()"
        [disabled]="disabled()"
        (input)="handleInput($event)"
        (blur)="onTouched()" />
      @if (value()) {
        <button type="button" class="clear" [attr.aria-label]="strings.clearSearch" [disabled]="disabled()" (click)="clear(inp)"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { display: flex; align-items: center; gap: var(--ui-space-2); box-sizing: border-box; height: var(--ui-size-md); padding: 0 var(--ui-space-1) 0 var(--ui-space-3);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius-pill); background: var(--ui-color-surface);
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .wrap:focus-within { border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .wrap:has(.ui-search:disabled) { opacity: .5; cursor: not-allowed; }
    .wrap.no-radius { border-radius: 0; }
    .icon { display: inline-flex; flex: none; color: var(--ui-color-text-muted); }
    .ui-search { flex: 1; min-width: 0; height: 100%; padding: 0; border: none; background: transparent;
      color: var(--ui-color-text); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); outline: none; }
    .ui-search::-webkit-search-cancel-button { display: none; }
    .ui-search::placeholder { color: var(--ui-color-text-muted); }
    .ui-search:disabled { cursor: not-allowed; }
    .wrap[data-size="sm"] { height: var(--ui-size-sm); padding-inline-start: var(--ui-space-2); }
    .wrap[data-size="sm"] .ui-search { font-size: var(--ui-font-size-sm); }
    .wrap[data-size="lg"] { height: var(--ui-size-lg); }
    .wrap[data-size="lg"] .ui-search { font-size: var(--ui-font-size-lg); }
    .clear { display: grid; place-items: center; flex: none; width: 20px; height: 20px; padding: 0; border: none; border-radius: var(--ui-radius-pill);
      background: transparent; color: var(--ui-color-text-muted); cursor: pointer; font: inherit;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard); }
    .clear:hover:not(:disabled) { color: var(--ui-color-text); background: var(--ui-color-surface-hover); }
    .clear:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSearchInput), multi: true }],
})
export class UiSearchInput implements ControlValueAccessor {
  protected readonly strings = injectUiStrings();
  protected readonly searchIcon = Search01Icon;

  private config = inject(UI_CONFIG);
  /** Default: the built-in `searchPlaceholder` (Search…), which follows the app's language. */
  placeholder = input<string | undefined>(undefined);
  protected readonly placeholderText = computed(() => this.placeholder() ?? this.strings.searchPlaceholder);
  /** Accessible name for the text field, when no ui-form-field label names it (e.g. a toolbar search). */
  label = input<string>();
  size = input<UiSize>('md');
  radius = input<boolean>(this.config.radius);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected handleInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
  }
  /** Clears and puts focus back in the field (the clear button itself disappears). */
  protected clear(field: HTMLInputElement): void {
    this.value.set('');
    this.onChange('');
    field.focus();
  }
}
