import { CdkConnectedOverlay, CdkOverlayOrigin, type ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, HostAttributeToken, computed, effect, forwardRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import GlobalIcon from '@hugeicons/core-free-icons/GlobalIcon';
import { UI_CONFIG, injectUiStrings, type UiSize } from '@zouriel/ui';
import { UiFormField } from './form-field';
import {
  UI_PHONE_COUNTRIES,
  uiPhoneCountry,
  uiPhoneE164,
  uiPhoneFlag,
  uiPhoneInternationalDigits,
  uiPhoneIsInternational,
  uiPhoneSearch,
  uiPhoneSplit,
  type UiPhoneCountry,
} from './phone';

let nextId = 0;

/**
 * `ui-phone-input` — a phone number as one E.164 string ("+447700900123"): a country button (flag
 * and dial code, opening a searchable list of every country) beside the national number field.
 * ControlValueAccessor, so it works with reactive, template-driven and Signal Forms, and inside
 * `ui-form-field` (the label names the number field).
 *
 * In: an E.164 value picks its country by dial code (the longest that exists; for a shared code like
 * +1, the country whose leading digits match, else `defaultCountry` if it shares the code, else the
 * code's main country) and shows the national digits as stored. With no value, `defaultCountry`
 * (ISO 3166 alpha-2) is chosen; without one, no country is (the library never assumes one).
 *
 * Out: '+', the dial code, and the typed digits with spaces, dashes, dots and brackets dropped and the
 * country's trunk prefix removed (the UK's leading 0; never Italy's 0, which belongs to the number).
 * Typing or pasting "+44…" or "0044…" switches the country. Empty, or no country: null. Whether the
 * number is valid is the app's job (libphonenumber); show it with `invalid` and the form field's error.
 * Twin of Flutter's `UiPhoneInput`.
 */
@Component({
  selector: 'ui-phone-input',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay, HugeiconsIconComponent],
  host: { class: 'ui-phone-input', '[attr.aria-label]': 'null' },
  template: `
    <div class="frame" cdkOverlayOrigin #origin="cdkOverlayOrigin" [attr.data-size]="size()" [class.no-radius]="!radius()"
      [class.invalid]="invalid()" [class.disabled]="disabled()">
      <button #trigger type="button" class="cty" aria-haspopup="listbox" [attr.aria-expanded]="open()" [attr.aria-controls]="open() ? listId : null"
        [attr.aria-label]="countryName()" [disabled]="disabled()" (click)="toggle()" (keydown)="triggerKey($event)">
        @if (country(); as c) {
          <span class="flag" aria-hidden="true">{{ flagOf(c) }}</span>
          <span class="dial">+{{ c.dial }}</span>
        } @else {
          <hugeicons-icon class="globe" [icon]="globeIcon" [size]="16" [strokeWidth]="1.6" aria-hidden="true" />
          <span class="dial">+</span>
        }
        <svg class="chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <input #field class="num" type="tel" inputmode="tel" autocomplete="tel-national" data-ui-field-control
        [attr.placeholder]="placeholder() || null" [attr.aria-label]="fieldName()" [attr.aria-invalid]="invalid() || null"
        [attr.name]="name() ?? null" [disabled]="disabled()" (input)="onInput($event)" (blur)="onTouched()" />
    </div>

    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="8"
      [cdkConnectedOverlayWidth]="panelWidth()" (overlayOutsideClick)="close(false)" (detach)="open.set(false)" (attach)="focusSearch()">
      <div class="panel">
        <input #search class="search" type="search" role="combobox" aria-autocomplete="list" aria-expanded="true"
          [attr.aria-controls]="listId" [attr.aria-activedescendant]="filtered().length ? listId + '-' + active() : null"
          [attr.placeholder]="strings.phoneSearch" [attr.aria-label]="strings.phoneSearch" [value]="query()"
          (input)="onSearch($event)" (keydown)="searchKey($event)" />
        <ul class="list" role="listbox" [id]="listId" [attr.aria-label]="strings.phoneCountry" (mousedown)="$event.preventDefault()">
          @for (c of filtered(); track c.iso2; let i = $index) {
            <li role="option" class="opt" [id]="listId + '-' + i" [class.active]="i === active()" [attr.aria-selected]="c === country()"
              [attr.data-iso]="c.iso2" (click)="choose(c)" (mouseenter)="active.set(i)">
              <span class="flag" aria-hidden="true">{{ flagOf(c) }}</span>
              <span class="name">{{ c.name }}</span>
              <span class="code">+{{ c.dial }}</span>
            </li>
          } @empty {
            <li class="empty" role="presentation">{{ strings.noResults }}</li>
          }
        </ul>
      </div>
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    /* The frame is ui-input's box: same height, border, corners, focus ring and invalid colour. */
    .frame {
      display: flex; align-items: stretch; box-sizing: border-box; width: 100%;
      height: var(--ui-size-md);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius);
      font-family: var(--ui-field-font, var(--ui-font-default)); font-size: var(--ui-font-size-md);
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard);
    }
    .frame[data-size="sm"] { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .frame[data-size="lg"] { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .frame.no-radius { border-radius: 0; }
    .frame:has(.num:focus-visible) { border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .frame.invalid { border-color: var(--ui-color-danger); }
    .frame.invalid:has(.num:focus-visible) { box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 4px var(--ui-color-danger); }
    .frame.disabled { opacity: .5; }
    .cty {
      flex: none; display: inline-flex; align-items: center; gap: var(--ui-space-1);
      margin: 0; padding: 0 var(--ui-space-2) 0 var(--ui-space-3);
      background: transparent; color: var(--ui-color-text); border: none;
      border-inline-end: 1px solid var(--ui-color-border);
      border-start-start-radius: inherit; border-end-start-radius: inherit;
      font: inherit; line-height: 1; cursor: pointer;
      font-variant-numeric: tabular-nums;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .cty:hover:not(:disabled) { background: var(--ui-color-surface-hover); }
    .cty:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--ui-color-primary); }
    .cty:disabled { cursor: not-allowed; }
    .flag { font-size: 1.15em; line-height: 1; }
    .globe { display: block; line-height: 0; color: var(--ui-color-text-muted); }
    .chevron { color: var(--ui-color-text-muted); transition: transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .cty[aria-expanded="true"] .chevron { transform: rotate(180deg); }
    .num {
      flex: 1 1 auto; min-width: 0; margin: 0; padding: 0 var(--ui-space-3);
      background: transparent; color: inherit; border: none; outline: none;
      font: inherit; font-variant-numeric: tabular-nums;
    }
    .num::placeholder { color: var(--ui-color-text-muted); }
    .num:disabled { cursor: not-allowed; }
    .panel {
      box-sizing: border-box; width: 100%; min-width: min(280px, calc(100vw - 16px)); padding: var(--ui-space-1);
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2); font-family: var(--ui-font-default); line-height: 1.35;
    }
    .search {
      box-sizing: border-box; width: 100%; height: var(--ui-size-md); margin: 0 0 var(--ui-space-1); padding: 0 var(--ui-space-2);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius-xs);
      font: inherit; font-size: var(--ui-font-size-md); outline: none;
    }
    .search:focus-visible { border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .search::placeholder { color: var(--ui-color-text-muted); }
    .list { margin: 0; padding: 0; list-style: none; max-height: 260px; overflow: auto; overscroll-behavior: contain; }
    .opt {
      display: flex; align-items: center; gap: var(--ui-space-2); min-height: 32px; padding: 0 var(--ui-space-2);
      border-radius: var(--ui-radius-xs); cursor: pointer; color: var(--ui-color-text); font-size: var(--ui-font-size-md);
    }
    .opt .name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .opt .code { flex: none; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); font-variant-numeric: tabular-nums; }
    .opt.active { background: var(--ui-color-elevated-hover); }
    .opt[aria-selected="true"] { background: var(--ui-color-selected); font-weight: 600; }
    .opt.active[aria-selected="true"] { background: color-mix(in srgb, var(--ui-color-selected), var(--ui-color-elevated-hover)); }
    .empty { padding: var(--ui-space-2); color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiPhoneInput), multi: true }],
})
export class UiPhoneInput implements ControlValueAccessor {
  protected readonly strings = injectUiStrings();
  private readonly config = inject(UI_CONFIG);
  private readonly formField = inject(UiFormField, { optional: true });
  /** A plain `aria-label="…"` on the element names the number field. */
  private readonly staticLabel = inject(new HostAttributeToken('aria-label'), { optional: true });

  /** ISO 3166 alpha-2 ('GB', 'US', 'MV') chosen while the value is empty. No default otherwise. */
  defaultCountry = input<string | null>(null);
  placeholder = input<string>();
  /** The number field's name for screen readers; default the form field's label, else "Phone number". */
  ariaLabel = input<string>();
  /** Passed to the native input's `name`. */
  name = input<string>();
  size = input<UiSize>('md');
  /** Marks the field invalid (red border), e.g. when the app's libphonenumber check fails. */
  invalid = input(false);
  radius = input<boolean>(this.config.radius);
  /** The user picked a country (from the list, or by typing a '+' number). */
  readonly countryChange = output<string>();

  protected readonly globeIcon = GlobalIcon;
  protected readonly listId = `ui-phone-list-${nextId++}`;
  protected readonly country = signal<UiPhoneCountry | null>(null);
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly panelWidth = signal<number | string>('auto');
  protected readonly filtered = computed(() => uiPhoneSearch(this.query(), UI_PHONE_COUNTRIES));
  protected readonly countryName = computed(() => {
    const c = this.country();
    return c ? `${this.strings.phoneCountry}: ${c.name} +${c.dial}` : this.strings.phoneCountry;
  });
  protected readonly fieldName = computed(() => this.ariaLabel() ?? this.staticLabel ?? (this.formField ? null : this.strings.phoneNumber));
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  private readonly origin = viewChild.required(CdkOverlayOrigin);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');
  /** The national text as typed. */
  private text = '';
  /** Whether the country came from a value or the user (then defaultCountry no longer moves it). */
  private fixed = false;
  private onChange: (v: string | null) => void = () => {};
  protected onTouched: () => void = () => {};

  constructor() {
    // An empty field follows defaultCountry, also when it arrives after the first render.
    effect(() => {
      const d = uiPhoneCountry(this.defaultCountry());
      untracked(() => {
        if (!this.fixed && !this.text) this.country.set(d);
      });
    });
  }

  protected flagOf(c: UiPhoneCountry): string {
    return uiPhoneFlag(c.iso2);
  }

  /** The value now: E.164, or null. */
  get value(): string | null {
    const c = this.country();
    return c ? uiPhoneE164(c, this.text) : null;
  }

  writeValue(v: string | null): void {
    const parsed = v ? uiPhoneSplit(uiPhoneInternationalDigits(v.startsWith('+') ? v : `+${v}`), this.defaultCountry()) : null;
    if (parsed) {
      this.country.set(parsed.country);
      this.text = parsed.national;
      this.fixed = true;
    } else {
      this.text = '';
      this.fixed = false;
      this.country.set(uiPhoneCountry(this.defaultCountry()));
    }
    const f = this.fieldRef();
    if (f) f.value = this.text;
    else queueMicrotask(() => { const g = this.fieldRef(); if (g) g.value = this.text; });
  }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  /** Focuses the number field. */
  focus(): void {
    this.field().nativeElement.focus();
  }

  private fieldRef(): HTMLInputElement | null {
    try {
      return this.field().nativeElement;
    } catch {
      return null;
    }
  }

  protected onInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    let text = el.value;
    if (uiPhoneIsInternational(text)) {
      const parsed = uiPhoneSplit(uiPhoneInternationalDigits(text), this.defaultCountry());
      if (parsed) {
        this.setCountry(parsed.country);
        text = parsed.national;
        el.value = text;
      }
    }
    this.text = text;
    if (text) this.fixed = true;
    this.onChange(this.value);
  }

  private setCountry(c: UiPhoneCountry): void {
    const changed = c !== this.country();
    this.country.set(c);
    this.fixed = true;
    if (changed) this.countryChange.emit(c.iso2);
  }

  protected toggle(): void {
    if (this.open()) this.close(true);
    else this.openPanel();
  }

  protected openPanel(): void {
    if (this.disabled()) return;
    const w = (this.origin().elementRef.nativeElement as HTMLElement).getBoundingClientRect().width;
    this.panelWidth.set(w);
    this.query.set('');
    const i = this.country() ? UI_PHONE_COUNTRIES.indexOf(this.country()!) : 0;
    this.active.set(Math.max(0, i));
    this.open.set(true);
  }

  protected close(refocus: boolean): void {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.trigger().nativeElement.focus();
  }

  protected focusSearch(): void {
    queueMicrotask(() => {
      this.search()?.nativeElement.focus({ preventScroll: true });
      this.reveal();
    });
  }

  protected triggerKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.openPanel();
    }
  }

  protected onSearch(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.active.set(0);
    this.reveal();
  }

  protected searchKey(e: KeyboardEvent): void {
    const n = this.filtered().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.active.update((i) => Math.min(n - 1, i + 1)); this.reveal(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.update((i) => Math.max(0, i - 1)); this.reveal(); }
    else if (e.key === 'Home') { e.preventDefault(); this.active.set(0); this.reveal(); }
    else if (e.key === 'End') { e.preventDefault(); this.active.set(Math.max(0, n - 1)); this.reveal(); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = this.filtered()[this.active()]; if (c) this.choose(c); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(true); }
    else if (e.key === 'Tab') { this.close(false); }
  }

  /** Picks a country: closes the list, emits the new value, and moves to the number field. */
  protected choose(c: UiPhoneCountry): void {
    this.setCountry(c);
    this.open.set(false);
    this.onChange(this.value);
    this.field().nativeElement.focus();
  }

  private reveal(): void {
    queueMicrotask(() => document.getElementById(`${this.listId}-${this.active()}`)?.scrollIntoView?.({ block: 'nearest' }));
  }
}
