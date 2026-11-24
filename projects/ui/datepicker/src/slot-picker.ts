import { Component, ElementRef, computed, forwardRef, inject, input, model, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { injectUiStrings, uiFormatString, uiLogicalKey } from '@zouriel/ui';

export interface UiSlot {
  id: string;
  label: string;
  note?: string;
  remaining?: number;
  disabled?: boolean;
}

/**
 * `ui-slot-picker` — radio-group of choice cards for sessions or appointment times with places left.
 * Supports `[(value)]` and reactive/template-driven forms (`ControlValueAccessor`).
 */
@Component({
  selector: 'ui-slot-picker',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSlotPicker), multi: true }],
  template: `
    <div class="grid" role="radiogroup" [attr.aria-label]="label() ?? null"
      [class.fixed-cols]="columns() !== 'auto'"
      [style.--ui-slot-cols]="columns() === 'auto' ? null : columns()">
      @for (slot of slots(); track slot.id) {
        @let off = isDisabled() || isSlotDisabled(slot);
        @let selected = slot.id === value();
        <button type="button" role="radio" class="card"
          [class.selected]="selected"
          [attr.aria-checked]="selected"
          [attr.tabindex]="tabStop() === slot.id ? 0 : -1"
          [disabled]="off"
          [attr.data-slot]="slot.id"
          (click)="choose(slot)"
          (keydown)="onKey($event, slot)">
          <span class="main">
            <span class="label">{{ slot.label }}</span>
            @if (slot.note) {
              <span class="note">{{ slot.note }}</span>
            }
          </span>
          @if (slot.remaining !== undefined) {
            <span class="remaining"
              [class.low]="slot.remaining > 0 && slot.remaining <= lowAt()"
              [class.full]="slot.remaining === 0">
              {{ slot.remaining === 0 ? strings.slotFull : formatLeft(slot.remaining) }}
            </span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: var(--ui-space-2);
    }
    .grid.fixed-cols {
      grid-template-columns: repeat(var(--ui-slot-cols, 2), minmax(0, 1fr));
    }
    .card {
      display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between;
      gap: var(--ui-space-1); min-width: 0; min-height: 44px; padding: var(--ui-space-3);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      font-family: var(--ui-font-default); text-align: start; cursor: pointer;
      transition: border-color var(--ui-motion-fast) var(--ui-ease-standard),
        background var(--ui-motion-fast) var(--ui-ease-standard),
        transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .card:hover:not(:disabled) { border-color: var(--ui-color-primary); }
    .card:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .card:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .card.selected, .card.selected:hover:not(:disabled) {
      background: var(--ui-color-secondary); color: var(--ui-color-secondary-contrast);
      border-color: var(--ui-color-primary);
      outline: 2px solid var(--ui-color-primary); outline-offset: -2px;
    }
    .card.selected:focus-visible {
      outline: 2px solid var(--ui-color-primary); outline-offset: -2px;
      box-shadow: var(--ui-focus-ring);
    }
    .card:disabled { opacity: 0.5; cursor: not-allowed; }
    .main { display: flex; flex-direction: column; gap: 2px; min-width: 0; width: 100%; }
    .label { font-size: var(--ui-font-size-md); font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
    .note { font-size: var(--ui-font-size-sm); line-height: 1.35; color: var(--ui-color-text-muted); overflow-wrap: anywhere; }
    .card.selected .note { color: inherit; opacity: 0.85; }
    .remaining { font-size: var(--ui-font-size-sm); line-height: 1.3; font-variant-numeric: tabular-nums; color: var(--ui-color-text-muted); }
    .remaining.low { color: var(--ui-color-warning); font-weight: 600; }
    .remaining.full { color: var(--ui-color-text-muted); }
    @media (prefers-reduced-motion: reduce) {
      .card { transition: none; }
      .card:active:not(:disabled) { transform: none; }
    }
  `,
})
export class UiSlotPicker implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly strings = injectUiStrings();

  slots = input<readonly UiSlot[]>([]);
  value = model<string | null>(null);
  lowAt = input(5);
  columns = input<number | 'auto'>('auto');
  label = input<string | undefined>(undefined);
  disabled = input(false);

  private readonly cvaDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  private onChange: (v: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  protected isSlotDisabled(slot: UiSlot): boolean {
    return !!slot.disabled || slot.remaining === 0;
  }

  protected formatLeft(n: number): string {
    return uiFormatString(this.strings.slotLeft, { n });
  }

  /** Only one tab stop in the radiogroup: the selected enabled slot, or the first enabled slot. */
  protected readonly tabStop = computed(() => {
    if (this.isDisabled()) return null;
    const enabled = this.slots().filter((s) => !this.isSlotDisabled(s));
    return enabled.find((s) => s.id === this.value())?.id ?? enabled[0]?.id ?? null;
  });

  writeValue(v: string | null): void {
    this.value.set(v ?? null);
  }

  registerOnChange(fn: (v: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(d: boolean): void {
    this.cvaDisabled.set(d);
  }

  protected choose(slot: UiSlot): void {
    if (this.isDisabled() || this.isSlotDisabled(slot)) return;
    this.value.set(slot.id);
    this.onChange(slot.id);
    this.onTouched();
  }

  protected onKey(e: KeyboardEvent, slot: UiSlot): void {
    if (this.isDisabled()) return;
    const enabled = this.slots().filter((s) => !this.isSlotDisabled(s));
    const i = enabled.findIndex((s) => s.id === slot.id);
    if (i < 0) return;

    let next = -1;
    const key = uiLogicalKey(e);
    if (key === 'ArrowRight' || key === 'ArrowDown') next = (i + 1) % enabled.length;
    else if (key === 'ArrowLeft' || key === 'ArrowUp') next = (i - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;

    if (next < 0) return;
    e.preventDefault();
    const target = enabled[next];
    this.choose(target);
    Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[data-slot]'))
      .find((b) => b.dataset['slot'] === target.id)
      ?.focus();
  }
}
