import { Component, DestroyRef, ElementRef, HostAttributeToken, afterNextRender, afterRenderEffect, computed, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from '@zouriel/ui';
import { UI_SLOT_INTERACTIVE, uiResolvedDir, type UiTextDir } from './text-dir';

/**
 * `ui-textarea` — multi-line text field (CVA).
 *
 * `autosize` makes it grow with what is typed, from `rows` lines up to `maxRows`. There is never a drag
 * handle: a comment box people resize by hand is a box that was the wrong size (use `autosize`).
 *
 * Content slots: project `[textarea-leading]` and `[textarea-trailing]` (an icon, a `ui-icon-button`
 * to attach or send). They sit inside the border at the inline start and end, aligned to the last
 * line (they stay at the bottom while autosize grows), and the text keeps clear of them. They swap
 * sides in RTL. A click on a slot's empty space focuses the field; buttons in it take their own.
 *
 * Font: set `--ui-field-font` on it (e.g. `style="--ui-field-font: Faruma, 'Noto Sans Thaana'"`) to type,
 * and show the placeholder, in an app font; it defaults to the theme's `--ui-font-default`.
 */
@Component({
  selector: 'ui-textarea',
  // The label belongs on the inner field, not on this wrapper.
  host: { '[attr.aria-label]': 'null' },
  template: `
    <div class="frame" [attr.data-size]="size()" [class.disabled]="disabled()" [attr.dir]="frameDir()">
    <span #lead class="slot lead" (pointerdown)="slotDown($event)"><ng-content select="[textarea-leading]" /></span>
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
      [attr.dir]="dir() ?? null"
      [style.padding-inline-start]="leadW() ? 'calc(' + leadW() + 'px + var(--ui-space-1) + var(--ui-space-2))' : null"
      [style.padding-inline-end]="trailW() ? 'calc(' + trailW() + 'px + var(--ui-space-1) + var(--ui-space-2))' : null"
      [value]="value()"
      [disabled]="disabled()"
      (input)="handleInput($event)"
      (blur)="onTouched()"></textarea>
    <span #trail class="slot trail" (pointerdown)="slotDown($event)"><ng-content select="[textarea-trailing]" /></span>
    </div>
  `,
  styles: `
    :host { display: block; }
    .frame { position: relative; }
    /* Inside the border, at the inline edges, as tall as the last line (its padding included), so a
       button or icon centres on the line being typed and stays at the bottom as the box grows. */
    .slot {
      position: absolute; bottom: 1px; z-index: 1;
      display: flex; align-items: center; gap: var(--ui-space-1);
      height: calc(var(--ui-font-size-md) * 1.5 + 2 * var(--ui-space-2));
      color: var(--ui-color-text-muted); cursor: text;
    }
    .slot:empty { display: none; }
    .slot.lead { inset-inline-start: calc(1px + var(--ui-space-1)); }
    .slot.trail { inset-inline-end: calc(1px + var(--ui-space-1)); }
    .slot :where(button, a, [role=button]) { cursor: pointer; }
    .frame[data-size="sm"] .slot { height: calc(var(--ui-font-size-sm) * 1.5 + 2 * var(--ui-space-1)); }
    .frame[data-size="lg"] .slot { height: calc(var(--ui-font-size-lg) * 1.5 + 2 * var(--ui-space-2)); }
    .frame.disabled .slot { opacity: .5; pointer-events: none; }
    .ui-textarea {
      display: block; width: 100%; box-sizing: border-box; resize: none; /* block: an inline textarea leaves a descender gap under it */
      padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius);
      font-family: var(--ui-field-font, var(--ui-font-default)); font-size: var(--ui-font-size-md); line-height: 1.5;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-textarea::placeholder { color: var(--ui-color-text-muted); }
    .ui-textarea:focus-visible { outline: none; border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .ui-textarea:disabled { opacity: .5; cursor: not-allowed; }
    .ui-textarea[data-size="sm"] { font-size: var(--ui-font-size-sm); padding: var(--ui-space-1) var(--ui-space-3); }
    .ui-textarea[data-size="lg"] { font-size: var(--ui-font-size-lg); }
    .ui-textarea.no-radius { border-radius: 0; }
    .ui-textarea.autosize { overflow-y: hidden; }
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
  /** Grow with the text instead of scrolling. */
  autosize = input(false);
  /** With `autosize`: the most lines it grows to before scrolling. */
  maxRows = input(8);
  /**
   * The writing direction, passed to the native textarea. `auto` follows the text typed (Thaana,
   * Arabic or Hebrew first: right to left), and the slots swap sides with it. Unset inherits.
   */
  dir = input<UiTextDir | null>(null);

  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');
  private readonly lead = viewChild.required<ElementRef<HTMLElement>>('lead');
  private readonly trail = viewChild.required<ElementRef<HTMLElement>>('trail');
  /** Widths of the projected slots, so the text keeps clear of them. */
  protected readonly leadW = signal(0);
  protected readonly trailW = signal(0);
  /** The direction the slots lay out in: `auto` resolved from the text, or null to inherit. */
  protected readonly frameDir = computed(() => uiResolvedDir(this.dir(), this.value()));

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
      // The slots: their width is the text's inset on that side.
      const measure = () => {
        this.leadW.set(Math.round(this.lead().nativeElement.getBoundingClientRect().width));
        this.trailW.set(Math.round(this.trail().nativeElement.getBoundingClientRect().width));
      };
      measure();
      const slots = new ResizeObserver(measure);
      slots.observe(this.lead().nativeElement);
      slots.observe(this.trail().nativeElement);
      destroy.onDestroy(() => {
        ro.disconnect();
        slots.disconnect();
      });
    });
  }

  /** Focuses the field. */
  focus(): void {
    this.field().nativeElement.focus();
  }

  /** A press on a slot's empty space (or a plain icon) focuses the field; buttons keep their own. */
  protected slotDown(e: PointerEvent): void {
    const target = e.target as Element | null;
    const slot = e.currentTarget as HTMLElement;
    const hit = target?.closest(UI_SLOT_INTERACTIVE);
    if (hit && slot.contains(hit)) return;
    e.preventDefault(); // keep the caret where it was rather than blurring first
    if (!this.disabled()) this.field().nativeElement.focus();
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
