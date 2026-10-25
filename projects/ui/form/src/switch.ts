import { Component, HostAttributeToken, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import type { UiSize } from '@zouriel/ui';

/** `ui-switch` — on/off toggle (CVA). Uses role="switch" on a native checkbox. */
@Component({
  selector: 'ui-switch',
  // The name belongs on the inner switch, not on this wrapper.
  host: { '[attr.aria-label]': 'null' },
  template: `
    <label class="ui-switch" [class.disabled]="disabled()" [attr.data-size]="size()">
      <input
        type="checkbox"
        role="switch"
        class="native"
        [checked]="checked()"
        [disabled]="disabled()"
        [attr.aria-checked]="checked()"
        [attr.aria-label]="ariaLabel() ?? staticLabel"
        (change)="toggle($event)"
        (blur)="onTouched()" />
      <span class="track" aria-hidden="true"><span class="thumb"></span></span>
      <span class="text"><ng-content /></span>
    </label>
  `,
  styles: `
    :host { display: inline-flex; }
    .ui-switch { display: inline-flex; align-items: center; gap: var(--ui-space-2); cursor: pointer; font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); line-height: 1.35; color: var(--ui-color-text); }
    .ui-switch[data-size="sm"] { font-size: var(--ui-font-size-sm); }
    .ui-switch.disabled { opacity: .5; cursor: not-allowed; }
    .native { position: absolute; opacity: 0; width: 0; height: 0; }
    .track {
      position: relative; width: 38px; height: 22px; flex: none; zoom: var(--ui-density-scale);
      background: var(--ui-switch-track); border-radius: var(--ui-radius-pill);
      transition: background var(--ui-motion-base) var(--ui-ease-standard);
    }
    .thumb {
      position: absolute; top: 2px; inset-inline-start: 2px; width: 18px; height: 18px;
      background: var(--ui-switch-thumb); border-radius: 50%; box-shadow: var(--ui-shadow-1);
      transition: transform var(--ui-motion-base) var(--ui-ease-spring);
    }
    .native:checked + .track { background: var(--ui-switch-track-checked); }
    .native:checked + .track .thumb { background: var(--ui-switch-thumb-checked); }
    /* On moves the thumb to the inline end: the right in LTR, the left in RTL. */
    .native:checked + .track .thumb { transform: translateX(calc(16px * var(--ui-inline-sign, 1))); }
    [data-size="sm"] .track { width: 30px; height: 18px; }
    [data-size="sm"] .thumb { width: 14px; height: 14px; }
    [data-size="sm"] .native:checked + .track .thumb { transform: translateX(calc(12px * var(--ui-inline-sign, 1))); }
    .native:focus-visible + .track { box-shadow: var(--ui-focus-ring); }
    @media (prefers-reduced-motion: reduce) { .thumb { transition-timing-function: var(--ui-ease-standard); } }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSwitch), multi: true }],
})
export class UiSwitch implements ControlValueAccessor {
  /** `sm` for dense panels (inspectors, settings): a smaller track and 13px label. */
  size = input<UiSize>('md');
  /** Accessible name when there is no visible label text (projected content). A plain `aria-label` works too. */
  ariaLabel = input<string | undefined>(undefined);
  protected readonly staticLabel = inject(new HostAttributeToken('aria-label'), { optional: true });
  protected readonly checked = signal(false);
  protected readonly disabled = signal(false);
  private onChange: (v: boolean) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: boolean): void { this.checked.set(!!v); }
  registerOnChange(fn: (v: boolean) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected toggle(e: Event): void {
    const v = (e.target as HTMLInputElement).checked;
    this.checked.set(v);
    this.onChange(v);
  }
}
