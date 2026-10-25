import { Component, DestroyRef, ElementRef, HostAttributeToken, afterNextRender, afterRenderEffect, computed, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from '@zouriel/ui';
import { UI_SLOT_INTERACTIVE, uiNativeDir, uiResolvedDir, type UiTextDir } from './text-dir';

/**
 * `ui-input` — single-line text field. Implements ControlValueAccessor so it
 * works with template-driven, reactive, and Signal Forms.
 *
 * Content slots, as on ui-textarea: project `[input-leading]` and `[input-trailing]` (an icon, a
 * `ui-icon-button`). They sit inside the border at the inline start and end, centred on the line,
 * swap sides in RTL, and the text keeps clear of them. A click on a slot's empty space focuses the
 * field; buttons in it take their own.
 *
 * Font: set `--ui-field-font` on it (e.g. `style="--ui-field-font: Faruma, 'Noto Sans Thaana'"`) to type,
 * and show the placeholder, in an app font; it defaults to the theme's `--ui-font-default`.
 */
@Component({
  selector: 'ui-input',
  // The label belongs on the inner field, not on this wrapper. So does dir (0.46.1): a static
  // dir="auto" left on the wrapper resolved the empty field to LTR before the inner control saw it.
  host: { '[attr.aria-label]': 'null', '[attr.dir]': 'null' },
  template: `
    <div class="frame" [attr.data-size]="size()" [class.disabled]="disabled()" [attr.dir]="frameDir()">
    <span #lead class="slot lead" (pointerdown)="slotDown($event)"><ng-content select="[input-leading]" /></span>
    <input
      #field
      class="ui-input"
      [class.no-radius]="!radius()"
      [attr.data-size]="size()"
      [attr.type]="type()"
      [attr.placeholder]="placeholder()"
      [attr.inputmode]="inputmode()"
      [attr.autocomplete]="autocomplete()"
      [attr.name]="name()"
      [attr.aria-label]="ariaLabel() ?? staticLabel"
      [attr.aria-invalid]="invalid() || null"
      [attr.dir]="nativeDir()"
      [style.padding-inline-start]="leadW() ? 'calc(' + leadW() + 'px + var(--ui-space-1) + var(--ui-space-2))' : null"
      [style.padding-inline-end]="trailW() ? 'calc(' + trailW() + 'px + var(--ui-space-1) + var(--ui-space-2))' : null"
      [disabled]="disabled()"
      (input)="handleInput($event)"
      (blur)="onTouched()" />
    <span #trail class="slot trail" (pointerdown)="slotDown($event)"><ng-content select="[input-trailing]" /></span>
    </div>
  `,
  styles: `
    :host { display: block; }
    .frame { position: relative; }
    .slot {
      position: absolute; top: 1px; bottom: 1px; z-index: 1;
      display: flex; align-items: center; gap: var(--ui-space-1);
      color: var(--ui-color-text-muted); cursor: text;
    }
    .slot:empty { display: none; }
    .slot.lead { inset-inline-start: calc(1px + var(--ui-space-1)); }
    .slot.trail { inset-inline-end: calc(1px + var(--ui-space-1)); }
    .slot :where(button, a, [role=button]) { cursor: pointer; }
    .frame.disabled .slot { opacity: .5; pointer-events: none; }
    .ui-input {
      width: 100%; box-sizing: border-box;
      height: var(--ui-size-md); padding: 0 var(--ui-space-3);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius);
      font-family: var(--ui-field-font, var(--ui-font-default)); font-size: var(--ui-font-size-md);
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-input::placeholder { color: var(--ui-color-text-muted); }
    .ui-input:focus-visible { outline: none; border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .ui-input:disabled { opacity: .5; cursor: not-allowed; }
    .ui-input.no-radius { border-radius: 0; }
    .ui-input[data-size="sm"] { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .ui-input[data-size="lg"] { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .ui-input[aria-invalid="true"] { border-color: var(--ui-color-danger); }
    .ui-input[aria-invalid="true"]:focus-visible { box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 4px var(--ui-color-danger); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiInput), multi: true }],
})
export class UiInput implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  /** The field's name for screen readers, when no visible label points at it. */
  ariaLabel = input<string | undefined>(undefined);
  /** A plain `aria-label="…"` on the element also names the inner field. */
  protected readonly staticLabel = inject(new HostAttributeToken('aria-label'), { optional: true });
  type = input<'text' | 'email' | 'url' | 'tel' | 'password' | 'search'>('text');
  placeholder = input('');
  inputmode = input<string>();
  /** Passed straight through to the native `autocomplete` attribute — e.g. `"email"`,
   *  `"given-name"`, `"off"`. Unset lets the browser infer from `type`/`name`. */
  autocomplete = input<string>();
  /** Passed straight through to the native `name` attribute — browsers use it (together
   *  with `autocomplete`) to match a field against saved autofill data. */
  name = input<string>();
  size = input<UiSize>('md');
  invalid = input(false);
  radius = input<boolean>(this.config.radius);
  /** The writing direction, passed to the native input; `auto` follows the text and the slots swap with it. */
  dir = input<UiTextDir | null>(null);

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  /** The same control, null before the view exists (writeValue can come first). */
  private readonly fieldRef = viewChild<ElementRef<HTMLInputElement>>('field');
  private readonly lead = viewChild.required<ElementRef<HTMLElement>>('lead');
  private readonly trail = viewChild.required<ElementRef<HTMLElement>>('trail');
  protected readonly leadW = signal(0);
  protected readonly trailW = signal(0);
  protected readonly frameDir = computed(() => uiResolvedDir(this.dir(), this.value()));
  /** The native control's `dir`: `auto` only once there is text (0.46.1). Empty, Chromium resolves `auto`
   *  to LTR and a Thaana placeholder sits on the left of an RTL page; inheriting keeps it at the start. */
  protected readonly nativeDir = computed(() => uiNativeDir(this.dir(), this.value()));

  constructor() {
    // Every value change reaches the native control after render (the first render too).
    afterRenderEffect(() => {
      this.value();
      this.syncNative();
    });
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const measure = () => {
        this.leadW.set(Math.round(this.lead().nativeElement.getBoundingClientRect().width));
        this.trailW.set(Math.round(this.trail().nativeElement.getBoundingClientRect().width));
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(this.lead().nativeElement);
      ro.observe(this.trail().nativeElement);
      destroy.onDestroy(() => ro.disconnect());
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
    e.preventDefault();
    if (!this.disabled()) this.field().nativeElement.focus();
  }

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  /** Writes the model into the native control right away when they differ (0.46.1): the template
   *  binding compared against the last value it wrote, so '' set straight after typing (a chat
   *  composer clearing on send) could equal it and leave the typed text in the box. */
  writeValue(v: string): void {
    this.value.set(v ?? '');
    this.syncNative();
  }

  /** The native control takes the model's value whenever the two differ (compared with what the
   *  control holds, not with the last value written). */
  private syncNative(): void {
    const el = this.fieldRef()?.nativeElement;
    if (el && el.value !== this.value()) el.value = this.value();
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected handleInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
  }
}
