import { Component, ElementRef, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ViewIcon from '@hugeicons/core-free-icons/ViewIcon';
import ViewOffIcon from '@hugeicons/core-free-icons/ViewOffIcon';
import { UI_CONFIG, type UiSize, injectUiStrings } from '@zouriel/ui';

/** `ui-password-input` — password field with show/hide toggle (CVA). */
@Component({
  selector: 'ui-password-input',
  imports: [HugeiconsIconComponent],
  template: `
    <div class="wrap" [class.no-radius]="!radius()" [class.invalid]="invalid()" [attr.data-size]="size()">
      <input
        #pwField
        class="ui-pw"
        [attr.type]="reveal() ? 'text' : 'password'"
        [attr.placeholder]="placeholder()"
        [attr.aria-invalid]="invalid() || null"
        [attr.autocomplete]="autocomplete()"
        [attr.name]="name()"
        [value]="value()"
        [disabled]="disabled()"
        (input)="handleInput($event)"
        (blur)="onTouched()" />
      <button type="button" class="toggle"
              [attr.aria-label]="reveal() ? strings.hidePassword : strings.showPassword"
              [disabled]="disabled()" (click)="reveal.set(!reveal())">
        <!-- A drawn icon, not an emoji: 🙈 is a monkey on most platforms and a crossed-out eye on
             none of them, and emoji render in the vendor's own colours regardless of the theme. -->
        <hugeicons-icon [icon]="reveal() ? viewOffIcon : viewIcon" [size]="16" [strokeWidth]="1.8" />
      </button>
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { display: flex; align-items: center; box-sizing: border-box; height: var(--ui-size-md); padding-inline-end: 2px; border: 1px solid var(--ui-control-border);
      border-radius: var(--ui-radius); background: var(--ui-color-surface);
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .wrap:focus-within { border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .wrap.no-radius { border-radius: 0; }
    .wrap.invalid { border-color: var(--ui-color-danger); }
    .wrap.invalid:focus-within { box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 4px var(--ui-color-danger); }
    .wrap:has(.ui-pw:disabled) { opacity: .5; cursor: not-allowed; }
    .ui-pw { flex: 1; min-width: 0; height: 100%; box-sizing: border-box; padding: 0 var(--ui-space-3); border: none; background: transparent;
      color: var(--ui-color-text); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); outline: none; }
    .ui-pw::placeholder { color: var(--ui-color-text-muted); }
    .ui-pw:disabled { cursor: not-allowed; }
    .wrap[data-size="sm"] { height: var(--ui-size-sm); }
    .wrap[data-size="sm"] .ui-pw { font-size: var(--ui-font-size-sm); }
    .wrap[data-size="lg"] { height: var(--ui-size-lg); }
    .wrap[data-size="lg"] .ui-pw { font-size: var(--ui-font-size-lg); }
    /* Colour from tokens: a bare <button> uses the platform ButtonText colour, not the theme's. */
    .toggle { display: grid; place-items: center; flex: none; width: var(--ui-size-sm); height: calc(100% - 4px); max-height: var(--ui-size-sm); padding: 0;
      border: none; border-radius: var(--ui-radius-xs); background: transparent; color: var(--ui-color-text-muted); cursor: pointer; font: inherit;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard); }
    /* A 24px-tall hit area however low the field (compact md paints the button 20px, 0.45.0); 44px on touch screens. */
    .toggle { position: relative; }
    .toggle::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: max(100%, 24px); transform: translateY(-50%); }
    @media (pointer: coarse) { .toggle::before { height: var(--ui-size-touch); } }
    .toggle:hover:not(:disabled) { color: var(--ui-color-text); background: var(--ui-color-surface-hover); }
    .toggle:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .toggle:disabled { cursor: not-allowed; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiPasswordInput), multi: true }],
})
export class UiPasswordInput implements ControlValueAccessor {
  protected readonly strings = injectUiStrings();
  protected readonly viewIcon = ViewIcon;
  protected readonly viewOffIcon = ViewOffIcon;

  private config = inject(UI_CONFIG);
  placeholder = input('');
  size = input<UiSize>('md');
  /** Defaults to `'current-password'` (sign-in). Pass `'new-password'` for signup/change-password
   *  fields so browsers stop suggesting a saved password and offer to generate/save a new one. */
  autocomplete = input<string>('current-password');
  name = input<string>();
  invalid = input(false);
  radius = input<boolean>(this.config.radius);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly reveal = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  /** The model goes into the native control at once when they differ (0.46.1): the [value] binding alone
   *  skipped a '' written straight after typing (it matched the last value it had written). */
  writeValue(v: string): void {
    this.value.set(v ?? '');
    const el = this.nativeField()?.nativeElement;
    if (el && el.value !== this.value()) el.value = this.value();
  }
  private readonly nativeField = viewChild<ElementRef<HTMLInputElement>>('pwField');
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected handleInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
  }
}
