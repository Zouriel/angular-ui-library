import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, computed, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize, injectUiStrings } from '@zouriel/ui';
import type { UiComboboxOption } from './combobox';

let nextId = 0;

/**
 * `ui-multi-select` — choose several options; selections shown as chips (CVA; value is string[]).
 * Type to filter; Arrow keys + Enter toggle the active option; Backspace in an empty field removes
 * the last chip; Escape closes. With `clearable` (the default) a Clear all button at the end of the
 * field empties the selection.
 */
@Component({
  selector: 'ui-multi-select',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <div class="ms" cdkOverlayOrigin #origin="cdkOverlayOrigin" [class.no-radius]="!radius()" [class.invalid]="invalid()"
         [attr.data-size]="size()" (click)="openPanel(); entry.focus()">
      <span class="vals">
      @for (v of value(); track v) {
        <!-- A disabled control has nothing to remove, so its chips carry no x (as the clear button hides). -->
        <span class="chip" [class.static]="disabled()"><span class="chip-text" [attr.title]="labelOf(v)">{{ labelOf(v) }}</span>@if (!disabled()) {<button type="button" class="x" tabindex="-1"
          [attr.aria-label]="'Remove ' + labelOf(v)" (click)="toggle(v, $event)"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>}</span>
      }
      <input #entry class="entry" [attr.placeholder]="value().length ? '' : placeholder()"
             role="combobox" aria-autocomplete="list" [attr.aria-label]="label() || null" [attr.aria-expanded]="open()" [attr.aria-controls]="listId"
             [attr.aria-activedescendant]="open() && filtered().length ? listId + '-' + activeIndex() : null"
             [attr.aria-invalid]="invalid() || null"
             [value]="query()" [disabled]="disabled()" (input)="onInput($event)" (focus)="openPanel()"
             (keydown)="onKeydown($event)" (blur)="open.set(false); onTouched()" />
      </span>
      <!-- Clear all and the chevron sit at the end, centred on the whole field however many rows the chips take. -->
      <span class="end">
        @if (clearable() && value().length && !disabled()) {
          <button type="button" class="clear" tabindex="-1" [attr.aria-label]="strings.clearAll" (mousedown)="$event.preventDefault()" (click)="clear($event)"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        }
        <svg class="chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    </div>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open()"
                 [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="8" [cdkConnectedOverlayWidth]="width()" (overlayOutsideClick)="open.set(false)">
      <ul class="panel" role="listbox" aria-multiselectable="true" [id]="listId" (mousedown)="$event.preventDefault()">
        @for (opt of filtered(); track opt.value; let i = $index) {
          <li role="option" class="opt" [id]="listId + '-' + i" [class.active]="i === activeIndex()" [attr.aria-selected]="value().includes(opt.value)"
              (mousedown)="$event.preventDefault(); toggle(opt.value)" (mouseenter)="activeIndex.set(i)">
            <span class="box" aria-hidden="true"><svg viewBox="0 0 16 16" class="tick"><path d="M3 8.5l3 3 7-7" /></svg></span>
            <span class="opt-text">{{ opt.label }}</span>
          </li>
        } @empty {
          <li class="empty" role="presentation">No results</li>
        }
      </ul>
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .ms { display: flex; gap: var(--ui-space-1); align-items: center; box-sizing: border-box; min-height: var(--ui-size-md);
      padding: 2px var(--ui-space-3) 2px var(--ui-space-1); background: var(--ui-color-surface); border: 1px solid var(--ui-control-border);
      border-radius: var(--ui-radius); cursor: text; line-height: 1.35;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .ms[data-size="sm"] { min-height: var(--ui-size-sm); padding-block: 0; }
    .vals { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: var(--ui-space-1); align-items: center; }
    .end { flex: none; display: flex; align-items: center; color: var(--ui-color-text-muted); }
    .chevron { flex: none; transition: transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .ms:has([aria-expanded="true"]) .chevron { transform: rotate(180deg); }
    .ms[data-size="lg"] { min-height: var(--ui-size-lg); }
    .ms:focus-within { border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .ms.no-radius { border-radius: 0; }
    .ms.invalid { border-color: var(--ui-color-danger); }
    .ms.invalid:focus-within { box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 4px var(--ui-color-danger); }
    .ms:has(.entry:disabled) { opacity: .5; cursor: not-allowed; }
    .chip { display: inline-flex; align-items: center; gap: var(--ui-space-1); max-width: 100%; min-width: 0; box-sizing: border-box; height: 22px;
      padding: 0 var(--ui-space-1) 0 var(--ui-space-2);
      background: color-mix(in srgb, var(--ui-color-primary) 18%, var(--ui-color-surface)); border: 1px solid color-mix(in srgb, var(--ui-color-primary) 45%, transparent);
      border-radius: var(--ui-radius-pill); font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }
    .ms[data-size="sm"] .chip { height: 22px; }
    .chip-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip.static { padding-right: var(--ui-space-2); }
    /* A 24x22 hit box filling the chip's height (no spill above or below it) around the same 16px
       circle: padding outside the painted background, and negative margins keep the chip compact. */
    .x { display: grid; place-items: center; flex: none; box-sizing: border-box; width: 24px; height: 22px; margin: -1px -4px;
      border: none; background: none; background-clip: content-box; color: inherit; cursor: pointer;
      font: inherit; padding: 3px 4px; border-radius: var(--ui-radius-pill); opacity: .7;
      transition: opacity var(--ui-motion-fast) var(--ui-ease-standard), background var(--ui-motion-fast) var(--ui-ease-standard); }
    .x:hover { opacity: 1; background-color: color-mix(in srgb, currentColor 14%, transparent); }
    .x:focus-visible { outline: none; opacity: 1; box-shadow: var(--ui-focus-ring); }
    .clear { display: grid; place-items: center; flex: none; box-sizing: border-box; width: 24px; height: 24px; padding: 0;
      border: none; border-radius: var(--ui-radius-xs); background: transparent; color: var(--ui-color-text-muted); cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard); }
    .clear:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .entry { flex: 1; min-width: 80px; box-sizing: border-box; height: 24px; padding: 0 var(--ui-space-2); border: none; background: transparent; outline: none;
      color: var(--ui-color-text); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); }
    .ms[data-size="sm"] .entry { font-size: var(--ui-font-size-sm); }
    .ms[data-size="lg"] .entry { font-size: var(--ui-font-size-lg); }
    .entry::placeholder { color: var(--ui-color-text-muted); }
    .entry:disabled { cursor: not-allowed; }
    .panel { margin: 0; padding: var(--ui-space-1); list-style: none; max-height: 240px; overflow: auto; overscroll-behavior: contain; box-sizing: border-box; width: 100%;
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-2);
      font-family: var(--ui-font-default); line-height: 1.35; }
    /* 4px panel + 8px option padding: the checkbox lines up with the field's text. */
    .opt { display: flex; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-2); border-radius: var(--ui-radius-xs);
      cursor: pointer; color: var(--ui-color-text); font-size: var(--ui-font-size-md); }
    /* The ticked box marks a chosen row; the one fill marks the keyboard/pointer row, so two fills never compete. */
    .opt.active { background: var(--ui-color-elevated-hover); }
    .opt-text { min-width: 0; overflow-wrap: anywhere; }
    /* Same drawn box as ui-checkbox, at 16px — ☐/☑ glyphs rendered as emoji or in a fallback font. */
    .box { display: inline-flex; align-items: center; justify-content: center; flex: none; box-sizing: border-box; width: 16px; height: 16px;
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius-xs); background: var(--ui-color-surface); }
    .tick { width: 11px; height: 11px; fill: none; stroke: var(--ui-color-primary-contrast); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; visibility: hidden; }
    .opt[aria-selected="true"] .box { background: var(--ui-color-primary); border-color: var(--ui-color-primary); }
    .opt[aria-selected="true"] .tick { visibility: visible; }
    .empty { padding: var(--ui-space-2); color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiMultiSelect), multi: true }],
})
export class UiMultiSelect implements ControlValueAccessor {
  protected readonly strings = injectUiStrings();
  private config = inject(UI_CONFIG);
  options = input<UiComboboxOption[]>([]);
  placeholder = input('Select…');
  /** Accessible name for the text field, when no ui-form-field label names it (e.g. a toolbar search). */
  label = input<string>();
  invalid = input(false);
  radius = input<boolean>(this.config.radius);
  /** Control height, matching the other fields (min-height: chips may wrap onto more rows). */
  size = input<UiSize>('md');
  /** Shows a Clear all button while anything is selected. */
  clearable = input(true);

  protected readonly value = signal<string[]>([]);
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly disabled = signal(false);
  protected readonly width = signal<number | string>('auto');
  protected readonly listId = `ui-multi-select-${nextId++}`;
  private readonly origin = viewChild.required(CdkOverlayOrigin);
  private readonly entry = viewChild.required<ElementRef<HTMLInputElement>>('entry');
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    // Near the right edge of the screen, line up with the trigger's right edge instead.
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.options().filter((o) => o.label.toLowerCase().includes(q)) : this.options();
  });

  private onChange: (v: string[]) => void = () => {};
  protected onTouched: () => void = () => {};
  writeValue(v: string[]): void { this.value.set(v ?? []); }
  registerOnChange(fn: (v: string[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); if (d) this.open.set(false); }

  protected labelOf(v: string): string { return this.options().find((o) => o.value === v)?.label ?? v; }

  /** Opens at the field's width (measured on open, not on every render). A disabled control never opens. */
  protected openPanel(): void {
    if (this.disabled()) return;
    this.width.set((this.origin().elementRef.nativeElement as HTMLElement).getBoundingClientRect().width);
    this.open.set(true);
  }

  protected onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.activeIndex.set(0);
    this.openPanel();
  }

  /** Keeps the keyboard-active option in view in a long, scrolling list. */
  private revealActive(): void {
    queueMicrotask(() => document.getElementById(`${this.listId}-${this.activeIndex()}`)?.scrollIntoView({ block: 'nearest' }));
  }

  protected onKeydown(e: KeyboardEvent): void {
    const items = this.filtered();
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!this.open()) this.openPanel(); this.activeIndex.update((i) => Math.min(items.length - 1, i + 1)); this.revealActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.activeIndex.update((i) => Math.max(0, i - 1)); this.revealActive(); }
    else if (e.key === 'Enter') {
      const opt = this.open() ? items[this.activeIndex()] : undefined;
      if (opt) { e.preventDefault(); this.toggle(opt.value); }
    }
    else if (e.key === 'Escape') { this.open.set(false); }
    else if (e.key === 'Backspace' && !this.query() && this.value().length) { this.toggle(this.value()[this.value().length - 1]); }
  }

  /** Empties the selection, tells the form, and leaves focus in the field with the list closed. */
  clear(e?: Event): void {
    e?.stopPropagation();
    if (this.disabled()) return;
    this.value.set([]);
    this.onChange([]);
    this.entry().nativeElement.focus({ preventScroll: true });
    // Focusing opens the list; after an explicit clear, keep it closed until the user types or clicks.
    this.open.set(false);
  }

  protected toggle(v: string, e?: Event): void {
    e?.stopPropagation();
    if (this.disabled()) return;
    const next = this.value().includes(v) ? this.value().filter((x) => x !== v) : [...this.value(), v];
    this.value.set(next);
    this.onChange(next);
  }
}
