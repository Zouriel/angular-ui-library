import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, computed, effect, forwardRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, uiFontStack, type UiSize } from '@zouriel/ui';

let nextId = 0;

export interface UiComboboxOption {
  label: string;
  value: string;
  /** Show this option in this font (a family name or a CSS font stack). */
  fontFamily?: string;
}

/**
 * `ui-combobox` — filterable autocomplete (CVA). Type to filter; Arrow keys +
 * Enter to choose; Escape to close. Backed by the CDK Overlay (WAI-ARIA combobox).
 *
 * With `clearable` (the default) a chosen value can be removed: the Clear button next to the
 * chevron, or emptying the text and leaving the field, sets the value to null.
 */
@Component({
  selector: 'ui-combobox',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <div class="wrap" cdkOverlayOrigin #origin="cdkOverlayOrigin" [class.no-radius]="!radius()" [class.has-clear]="showClear()" [attr.data-size]="size()">
      <input
        #field
        class="ui-combobox"
        role="combobox"
        [attr.aria-label]="label() || null"
        [attr.aria-expanded]="open()"
        [attr.aria-invalid]="invalid() || null"
        aria-autocomplete="list"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="open() && filtered().length ? listId + '-' + activeIndex() : null"
        [attr.placeholder]="placeholder()"
        [style.font-family]="selectedFont()"
        [value]="query()"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (focus)="openPanel()"
        (click)="openPanel()"
        (keydown)="onKeydown($event)"
        (blur)="onBlur($event)" />
      @if (showClear()) {
        <button type="button" class="clear" tabindex="-1" aria-label="Clear" (mousedown)="$event.preventDefault()" (click)="clear()"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      }
      <svg class="chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="8"
      [cdkConnectedOverlayWidth]="triggerWidth()"
      (overlayOutsideClick)="open.set(false)">
      <ul class="panel" role="listbox" [id]="listId" (mousedown)="$event.preventDefault()">
        @for (opt of filtered(); track opt.value; let i = $index) {
          <li
            role="option"
            [id]="listId + '-' + i"
            class="opt"
            [class.active]="i === activeIndex()"
            [attr.aria-selected]="opt.value === value()"
            (mousedown)="$event.preventDefault(); select(opt)"
            (mouseenter)="activeIndex.set(i)"
            [style.font-family]="fontOf(opt)">
            {{ opt.label }}
          </li>
        } @empty {
          <li class="empty" role="presentation">No results</li>
        }
      </ul>
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .wrap { position: relative; }
    .ui-combobox { width: 100%; box-sizing: border-box; height: var(--ui-size-md);
      padding: 0 calc(var(--ui-space-3) + 12px + var(--ui-space-2)) 0 var(--ui-space-3);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); outline: none;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .ui-combobox::placeholder { color: var(--ui-color-text-muted); }
    .ui-combobox:focus-visible { border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .ui-combobox:disabled { opacity: .5; cursor: not-allowed; }
    .wrap:has(.ui-combobox:disabled) .chevron { opacity: .5; }
    .ui-combobox[aria-invalid="true"] { border-color: var(--ui-color-danger); }
    .ui-combobox[aria-invalid="true"]:focus-visible { box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 4px var(--ui-color-danger); }
    .wrap.no-radius .ui-combobox { border-radius: 0; }
    .wrap[data-size="sm"] .ui-combobox { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .wrap[data-size="lg"] .ui-combobox { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .chevron { position: absolute; right: var(--ui-space-3); top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--ui-color-text-muted);
      transition: transform var(--ui-motion-fast) var(--ui-ease-standard); }
    /* Room for the Clear button between the text and the chevron. */
    .wrap.has-clear .ui-combobox { padding-right: calc(var(--ui-space-3) + 12px + var(--ui-space-1) + 24px); }
    .clear { position: absolute; top: 50%; right: calc(var(--ui-space-3) + 12px); transform: translateY(-50%);
      display: grid; place-items: center; box-sizing: border-box; width: 24px; height: 24px; padding: 0; border: none;
      border-radius: var(--ui-radius-xs); background: transparent; color: var(--ui-color-text-muted); cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard); }
    .clear:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .wrap:has([aria-expanded="true"]) .chevron { transform: translateY(-50%) rotate(180deg); }
    .panel { margin: 0; padding: var(--ui-space-1); list-style: none; max-height: 240px; overflow: auto; overscroll-behavior: contain; box-sizing: border-box; width: 100%;
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2); font-family: var(--ui-font-default); line-height: 1.35; }
    .opt { padding: var(--ui-space-2) var(--ui-space-3); border-radius: var(--ui-radius-xs); cursor: pointer; color: var(--ui-color-text); font-size: var(--ui-font-size-md); overflow-wrap: anywhere; }
    .opt.active { background: var(--ui-color-elevated-hover); }
    .opt[aria-selected="true"] { background: var(--ui-color-selected); font-weight: 600; }
    .opt.active[aria-selected="true"] { background: color-mix(in srgb, var(--ui-color-selected), var(--ui-color-elevated-hover)); }
    .empty { padding: var(--ui-space-2) var(--ui-space-3); color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiCombobox), multi: true }],
})
export class UiCombobox implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  options = input<UiComboboxOption[]>([]);
  placeholder = input('Search…');
  /** Draw each option, and the chosen value, in the font it names (for font pickers). */
  fontPreview = input(false);
  /** Accessible name for the text field, when no ui-form-field label names it (e.g. a toolbar search). */
  label = input<string>();
  size = input<UiSize>('md');
  invalid = input(false);
  radius = input<boolean>(this.config.radius);
  /** Shows a Clear button while a value is chosen, and lets an emptied field clear the value on blur. */
  clearable = input(true);

  protected readonly query = signal('');
  protected readonly selectedFont = computed(() => {
    if (!this.fontPreview()) return null;
    const opt = this.options().find((o) => o.value === this.value());
    return opt ? this.fontOf(opt) : null;
  });

  /** An option's preview font: its own fontFamily, or with fontPreview its value as a family name. */
  protected fontOf(opt: UiComboboxOption): string | null {
    return uiFontStack(opt.fontFamily ?? (this.fontPreview() ? opt.value : null));
  }
  protected readonly value = signal<string | null>(null);
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly disabled = signal(false);
  protected readonly triggerWidth = signal<number | string>('auto');

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    // Near the right edge of the screen, line up with the trigger's right edge instead.
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];
  protected readonly listId = `ui-combobox-${nextId++}`;
  private readonly origin = viewChild.required(CdkOverlayOrigin);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  protected readonly showClear = computed(() => this.clearable() && this.value() !== null && !this.disabled());

  /** Opens the list at the field's width (measured on open, not on every render). */
  protected openPanel(): void {
    if (this.disabled()) return;
    this.triggerWidth.set((this.origin().elementRef.nativeElement as HTMLElement).getBoundingClientRect().width);
    if (!this.open()) {
      // A fresh open lists everything, with the chosen option active, until the user types.
      this.typed.set(false);
      const i = this.options().findIndex((o) => o.value === this.value());
      this.activeIndex.set(Math.max(0, i));
      if (i > 0) this.revealActive();
    }
    this.open.set(true);
  }

  /** Whether the text was edited since the list opened; only then does it filter. */
  private readonly typed = signal(false);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q || !this.typed()) return this.options();
    return this.options().filter((o) => o.label.toLowerCase().includes(q));
  });

  private onChange: (v: string | null) => void = () => {};
  protected onTouched: () => void = () => {};

  constructor() {
    // Options that arrive after the value (loaded from a server) still show the chosen label.
    effect(() => {
      const options = this.options();
      untracked(() => {
        const match = options.find((o) => o.value === this.value());
        if (match && !this.open()) this.query.set(match.label);
      });
    });
  }

  writeValue(v: string | null): void {
    this.value.set(v ?? null);
    const match = this.options().find((o) => o.value === v);
    this.query.set(match ? match.label : '');
  }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.openPanel();
    this.typed.set(true);
    this.activeIndex.set(0);
  }

  /** Keeps the keyboard-active option in view in a long, scrolling list. */
  private revealActive(): void {
    queueMicrotask(() => document.getElementById(`${this.listId}-${this.activeIndex()}`)?.scrollIntoView({ block: 'nearest' }));
  }

  protected onKeydown(e: KeyboardEvent): void {
    const items = this.filtered();
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!this.open()) this.openPanel(); this.activeIndex.update((i) => Math.min(items.length - 1, i + 1)); this.revealActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.activeIndex.update((i) => Math.max(0, i - 1)); this.revealActive(); }
    else if (e.key === 'Enter') { if (!this.open()) return; e.preventDefault(); const opt = items[this.activeIndex()]; if (opt) this.select(opt); }
    else if (e.key === 'Escape') { this.open.set(false); }
  }

  protected select(opt: UiComboboxOption): void {
    this.value.set(opt.value);
    this.query.set(opt.label);
    this.open.set(false);
    this.onChange(opt.value);
  }

  /** Clears the value (null), tells the form, and leaves focus in the field with the list closed. */
  clear(): void {
    if (this.disabled()) return;
    this.value.set(null);
    this.query.set('');
    this.open.set(false);
    this.onChange(null);
    this.field().nativeElement.focus({ preventScroll: true });
    // Focusing opens the list; after an explicit clear, keep it closed until the user types or clicks.
    this.open.set(false);
  }

  protected onBlur(e?: FocusEvent): void {
    // Tabbing away closes the list; clicks inside it never take focus (mousedown is cancelled).
    this.open.set(false);
    this.onTouched();
    // An emptied field clears the value rather than snapping back to the old label.
    if (this.clearable() && !this.query().trim() && this.value() !== null) {
      this.value.set(null);
      this.onChange(null);
      return;
    }
    // Restore the selected label if the typed query doesn't match a selection.
    const match = this.options().find((o) => o.value === this.value());
    if (match) {
      this.query.set(match.label);
      // The [value] binding skips the write when the label equals what it last rendered, which is the
      // case when the text was edited and blurred before a render; put the label back directly.
      const field = e?.target as HTMLInputElement | undefined;
      if (field && field.value !== match.label) field.value = match.label;
    }
  }
}
