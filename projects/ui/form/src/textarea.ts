import { Component, DestroyRef, ElementRef, HostAttributeToken, afterNextRender, afterRenderEffect, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from '@zouriel/ui';

/**
 * `ui-textarea` — multi-line text field (CVA).
 *
 * `autosize` makes it grow with what is typed, from `rows` lines up to `maxRows`, and takes away the
 * drag handle: a comment box people resize by hand is a box that was the wrong size.
 */
@Component({
  selector: 'ui-textarea',
  // The label belongs on the inner field, not on this wrapper.
  host: { '[attr.aria-label]': 'null' },
  template: `
    <textarea
      #field
      class="ui-textarea"
      [class.no-radius]="!radius()"
      [class.autosize]="autosize()"
      [attr.data-size]="size()"
      [attr.placeholder]="placeholder()"
      [attr.rows]="rows()"
      [attr.autocomplete]="autocomplete()"
      [attr.name]="name()"
      [attr.maxlength]="maxlength() ?? null"
      [attr.aria-label]="ariaLabel() ?? staticLabel"
      [attr.aria-invalid]="invalid() || null"
      [value]="value()"
      [disabled]="disabled()"
      (input)="handleInput($event)"
      (blur)="onTouched()"></textarea>
  `,
  styles: `
    :host { display: block; }
    .ui-textarea {
      width: 100%; box-sizing: border-box; resize: vertical;
      padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); line-height: 1.5;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-textarea::placeholder { color: var(--ui-color-text-muted); }
    .ui-textarea:focus-visible { outline: none; border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .ui-textarea:disabled { opacity: .5; cursor: not-allowed; }
    .ui-textarea[data-size="sm"] { font-size: var(--ui-font-size-sm); padding: var(--ui-space-1) var(--ui-space-3); }
    .ui-textarea[data-size="lg"] { font-size: var(--ui-font-size-lg); }
    .ui-textarea.no-radius { border-radius: 0; }
    .ui-textarea.autosize { resize: none; overflow-y: hidden; }
    .ui-textarea[aria-invalid="true"] { border-color: var(--ui-color-danger); }
    .ui-textarea[aria-invalid="true"]:focus-visible { box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 4px var(--ui-color-danger); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiTextarea), multi: true }],
})
export class UiTextarea implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  /** The field's name for screen readers, when no visible label points at it. */
  ariaLabel = input<string | undefined>(undefined);
  /** A plain `aria-label="…"` on the element also names the inner field. */
  protected readonly staticLabel = inject(new HostAttributeToken('aria-label'), { optional: true });
  placeholder = input('');
  rows = input(4);
  autocomplete = input<string>();
  name = input<string>();
  /** The most characters it takes (the browser stops typing and pasting beyond it). */
  maxlength = input<number | null>(null);
  invalid = input(false);
  /** Text size, matching ui-input's sizes; `sm` for dense panels. */
  size = input<UiSize>('md');
  radius = input<boolean>(this.config.radius);
  /** Grow with the text instead of scrolling, and no resize handle. */
  autosize = input(false);
  /** With `autosize`: the most lines it grows to before scrolling. */
  maxRows = input(8);

  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');

  constructor() {
    // After render, so a value written from outside (a reset to '') shrinks it back too.
    afterRenderEffect(() => {
      this.value();
      if (this.autosize()) this.fit();
    });
    // A width change rewraps the text (a panel settling, a phone rotating): measure again then.
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      let width = 0;
      const ro = new ResizeObserver(([e]) => {
        if (!this.autosize() || Math.abs(e.contentRect.width - width) < 1) return;
        width = e.contentRect.width;
        // Next frame: resizing the box it is watching inside the callback would loop.
        requestAnimationFrame(() => this.fit());
      });
      ro.observe(this.field().nativeElement);
      destroy.onDestroy(() => ro.disconnect());
    });
  }

  private fit(): void {
    const el = this.field().nativeElement;
    const style = getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || 24;
    const chrome = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const max = line * this.maxRows() + chrome;
    el.style.height = 'auto';
    const wanted = el.scrollHeight + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    el.style.height = `${Math.min(wanted, max)}px`;
    el.style.overflowY = wanted > max ? 'auto' : 'hidden';
  }

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected handleInput(e: Event): void {
    const v = (e.target as HTMLTextAreaElement).value;
    this.value.set(v);
    this.onChange(v);
  }
}
