import { Component, ElementRef, ViewEncapsulation, afterRenderEffect, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiMultiSelect } from '@zouriel/ui/combobox';
import { UiDatePicker } from '@zouriel/ui/datepicker';
import {
  UiCheckbox,
  UiCheckboxGroup,
  UiFileUpload,
  UiInput,
  UiNumberInput,
  UiRadioGroup,
  UiRating,
  UiSelect,
  UiSlider,
  UiSwitch,
  UiTextarea,
  UiTimePicker,
} from '@zouriel/ui/form';
import { isEmptyValue } from './conditions';
import type { UiFormEngine } from './engine';
import { fieldTypeInfo } from './field-types';
import { formatValue } from './format';
import type { UiFbErrorPlacement, UiFbField, UiFbFileValue, UiFbLabelPlacement } from './schema';
import { FB_ICONS } from './builder-icons';
import { optionValueOf, type UiFbChoice } from './option-sources';
import { UiFbSourcePicker } from './source-picker';

/** Uploads a picked file and returns what to store (usually with a `url` or `id`). */
export type UiFbUploader = (file: File, field: UiFbField) => Promise<UiFbFileValue>;

/** Controls that are several inputs (radios, ticks, stars) — labelled as a group, not with `for`. */
const GROUP_TYPES = new Set(['radio', 'checkboxes', 'checkbox', 'toggle', 'rating']);

/**
 * `ui-fb-field` — one field of a `ui-form-renderer`: label, help, control and
 * messages, laid out as the form (or the field) asks. Styles are global but all
 * scoped under `.ui-fbf` so placements can reach into the library controls.
 */
@Component({
  selector: 'ui-fb-field',
  encapsulation: ViewEncapsulation.None,
  imports: [
    FormsModule, NgTemplateOutlet, HugeiconsIconComponent, UiInput, UiTextarea, UiNumberInput, UiSelect, UiRadioGroup, UiCheckboxGroup,
    UiCheckbox, UiSwitch, UiRating, UiSlider, UiFileUpload, UiTimePicker, UiDatePicker, UiMultiSelect, UiFbSourcePicker,
  ],
  host: { class: 'ui-fbf-host', '[attr.data-addr]': 'addr()' },
  template: `
    @let st = state();
    @let f = field();
    <div class="ui-fbf" [attr.data-label]="labelPos()" [class.is-invalid]="showError()" [class.is-disabled]="st.disabled && !viewing()"
      [class.has-value]="hasValue()" [class.err-inside]="errInside()" [class.is-view]="viewing()">
      @if (labelPos() === 'top' || labelPos() === 'left') {
        <div class="ui-fbf-head">
          @if (grouped() || viewing()) {
            <span class="ui-fbf-label" [id]="ids().label">{{ f.label }}<ng-container [ngTemplateOutlet]="markerTpl" /></span>
          } @else {
            <label class="ui-fbf-label" [for]="ids().control" [id]="ids().label">{{ f.label }}<ng-container [ngTemplateOutlet]="markerTpl" /></label>
          }
        </div>
      }
      @if (labelPos() === 'hidden') {
        @if (grouped()) { <span class="sr-only" [id]="ids().label">{{ f.label }}</span> }
        @else { <label class="sr-only" [for]="ids().control" [id]="ids().label">{{ f.label }}</label> }
      }
      <div class="ui-fbf-body">
        @if (viewing()) {
          <div class="ui-fbf-value" [class.empty]="!display()">{{ display() || 'Not answered' }}</div>
        } @else {
          <div class="ui-fbf-control" (focusout)="blurred($event)" [attr.role]="grouped() ? 'group' : null"
            [attr.aria-labelledby]="grouped() ? ids().label : null">
            @if (labelPos() === 'inside') {
              <label class="ui-fbf-float" [for]="ids().control" [id]="ids().label">{{ f.label }}<ng-container [ngTemplateOutlet]="markerTpl" /></label>
            }
            @if (f.source && (f.type === 'select' || f.type === 'multiselect')) {
              @if (sourceDef(); as src) {
                <ui-fb-source-picker [source]="src" [params]="sourceParams()" [multiple]="f.type === 'multiselect'" [value]="st.value"
                  [placeholder]="placeholder() || 'Search ' + src.label.toLowerCase() + '…'" [disabled]="st.disabled" [invalid]="showError()"
                  [inputId]="ids().control" (valueChange)="set($event)" />
              } @else {
                <p class="ui-fbf-note bad" role="alert">This list isn’t available right now.@if (display()) { Saved answer: {{ display() }}. }</p>
              }
            } @else {
            @switch (f.type) {
              @case ('textarea') {
                <ui-textarea [rows]="f.props?.rows ?? 3" [autosize]="true" [maxRows]="f.props?.maxRows ?? 8" [placeholder]="placeholder()"
                  [name]="f.key" [autocomplete]="f.props?.autocomplete" [invalid]="showError()"
                  [ngModel]="text()" (ngModelChange)="set($event)" [disabled]="st.disabled" />
              }
              @case ('number') { <ng-container [ngTemplateOutlet]="numberTpl" /> }
              @case ('currency') { <ng-container [ngTemplateOutlet]="numberTpl" /> }
              @case ('date') {
                <ui-date-picker [placeholder]="placeholder() || 'Select a date'" [min]="dateMin()" [max]="dateMax()"
                  [ngModel]="st.value ?? null" (ngModelChange)="set($event)" [disabled]="st.disabled" />
              }
              @case ('time') {
                <ui-time-picker [invalid]="showError()" [ngModel]="st.value ?? ''" (ngModelChange)="set($event)" [disabled]="st.disabled" />
              }
              @case ('select') {
                <ui-select [options]="options()" [placeholder]="placeholder() || 'Choose…'" [label]="f.label" [invalid]="showError()"
                  [ngModel]="st.value ?? ''" (ngModelChange)="set($event)" [disabled]="st.disabled" />
              }
              @case ('radio') {
                <ui-radio-group [options]="options()" [label]="f.label" [orientation]="f.props?.orientation ?? 'vertical'"
                  [ngModel]="st.value ?? null" (ngModelChange)="set($event)" [disabled]="st.disabled" />
              }
              @case ('checkboxes') {
                <ui-checkbox-group [options]="options()" [label]="f.label" [orientation]="f.props?.orientation ?? 'vertical'" [selectAll]="!!f.props?.selectAll"
                  [ngModel]="list()" (ngModelChange)="set($event)" [disabled]="st.disabled" />
              }
              @case ('multiselect') {
                <ui-multi-select [options]="options()" [placeholder]="placeholder() || 'Choose…'" [invalid]="showError()"
                  [ngModel]="list()" (ngModelChange)="set($event)" [disabled]="st.disabled" />
              }
              @case ('checkbox') {
                <ui-checkbox [invalid]="showError()" [ngModel]="st.value === true" (ngModelChange)="set($event)" [disabled]="st.disabled">{{ f.props?.caption || f.label }}</ui-checkbox>
              }
              @case ('toggle') {
                <ui-switch [ngModel]="st.value === true" (ngModelChange)="set($event)" [disabled]="st.disabled">{{ f.props?.caption || 'Yes' }}</ui-switch>
              }
              @case ('rating') {
                <ui-rating [max]="f.props?.maxRating ?? 5" [label]="f.label" [ngModel]="st.value ?? 0" (ngModelChange)="set($event)" [disabled]="st.disabled" />
              }
              @case ('slider') {
                <ui-slider [min]="f.props?.min ?? 0" [max]="f.props?.max ?? 10" [step]="f.props?.step ?? 1" [label]="f.label"
                  [ngModel]="st.value ?? f.props?.min ?? 0" (ngModelChange)="set($event)" [disabled]="st.disabled" />
              }
              @case ('file') {
                <ui-file-upload [multiple]="!!f.props?.multiple" [accept]="f.props?.accept" (filesSelected)="pick($event)" />
                @if (files().length) {
                  <ul class="ui-fbf-files">
                    @for (file of files(); track $index) {
                      <li>
                        @if (file.url) { <a [href]="file.url" target="_blank" rel="noopener">{{ file.name }}</a> } @else { <span>{{ file.name }}</span> }
                        <span class="size">{{ size(file.size) }}</span>
                        <button type="button" class="ui-fbf-x" [attr.aria-label]="'Remove ' + file.name" [disabled]="st.disabled" (click)="unpick($index)">
                          <hugeicons-icon aria-hidden="true" [icon]="removeIcon" [size]="14" [strokeWidth]="1.8" />
                        </button>
                      </li>
                    }
                  </ul>
                }
                @if (uploading()) { <p class="ui-fbf-note" role="status">Uploading…</p> }
                @if (uploadError()) { <p class="ui-fbf-note bad" role="alert">{{ uploadError() }}</p> }
              }
              @case ('calculated') {
                <output class="ui-fbf-calc" [id]="ids().control" [attr.aria-labelledby]="ids().label">
                  <hugeicons-icon [icon]="calcIcon" [size]="15" [strokeWidth]="1.8" aria-hidden="true" />
                  <span [class.muted]="!display()">{{ display() || 'Worked out as you answer' }}</span>
                </output>
              }
              @default {
                <ui-input [type]="inputType()" [placeholder]="placeholder()" [inputmode]="inputmode()" [name]="f.key"
                  [autocomplete]="f.props?.autocomplete" [invalid]="showError()"
                  [ngModel]="text()" (ngModelChange)="set($event)" [disabled]="st.disabled" />
              }
            }
            }
            @if (errInside() && showError()) {
              <span class="ui-fbf-err-in" aria-hidden="true" [title]="error()">
                <hugeicons-icon aria-hidden="true" [icon]="errorIcon" [size]="14" [strokeWidth]="2" />
                <span>{{ error() }}</span>
              </span>
            }
          </div>
          @if (f.help) { <p class="ui-fbf-help" [id]="ids().help">{{ f.help }}</p> }
          @if (showError()) {
            <p class="ui-fbf-error" [class.sr-only]="errInside()" [id]="ids().error">
              <hugeicons-icon [icon]="errorIcon" [size]="14" [strokeWidth]="2" aria-hidden="true" />
              <span><span class="sr-only">Error: </span>{{ error() }}</span>
            </p>
          }
          @for (w of warningsShown(); track w) { <p class="ui-fbf-warning">{{ w }}</p> }
          @if (st.pending && touchedOnce()) { <p class="ui-fbf-note" role="status">Checking…</p> }
        }
      </div>
    </div>

    <ng-template #markerTpl>
      @if (marker() === 'asterisk' && st.required) { <span class="ui-fbf-req" aria-hidden="true">*</span> }
      @if (marker() === 'optional' && !st.required && !viewing() && f.type !== 'calculated') { <span class="ui-fbf-opt">(optional)</span> }
    </ng-template>
    <ng-template #numberTpl>
      <ui-number-input [min]="f.props?.min" [max]="f.props?.max" [step]="f.props?.step ?? 1" [precision]="f.props?.decimals ?? null"
        [suffix]="f.type === 'currency' ? (f.props?.currency ?? '') : (f.props?.suffix ?? '')" [steppers]="f.type !== 'currency'"
        [placeholder]="placeholder()" [ariaLabel]="f.label" [invalid]="showError()"
        [ngModel]="st.value ?? null" (ngModelChange)="set($event)" [disabled]="st.disabled" />
    </ng-template>
  `,
  styles: `
    .ui-fbf-host { display: block; min-width: 0; }
    .ui-fbf { display: flex; flex-direction: column; gap: var(--ui-space-1); font-family: var(--ui-font-default); }
    .ui-fbf-head { display: flex; flex-direction: column; gap: 2px; }
    .ui-fbf-label { font-size: var(--ui-font-size-sm); font-weight: 550; color: var(--ui-color-text); line-height: 1.35; overflow-wrap: anywhere; }
    .ui-fbf-help, .ui-fbf-error, .ui-fbf-warning { overflow-wrap: anywhere; }
    .ui-fbf-req { color: var(--ui-color-danger); margin-left: 3px; }
    .ui-fbf-opt { color: var(--ui-color-text-muted); font-weight: 400; margin-left: 5px; }
    .ui-fbf-help { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-secondary); line-height: 1.35; }
    .ui-fbf-body { display: flex; flex-direction: column; gap: var(--ui-space-1); min-width: 0; }
    .ui-fbf-control { position: relative; min-width: 0; }
    .ui-fbf-error { display: flex; align-items: flex-start; gap: 5px; margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-danger); line-height: 1.35; }
    .ui-fbf-error hugeicons-icon { flex: none; margin-top: 2px; }
    .ui-fbf-warning { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-warning); line-height: 1.35; }
    .ui-fbf-note { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .ui-fbf-note.bad { color: var(--ui-color-danger); }
    .ui-fbf .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    .ui-fbf-value { font-size: var(--ui-font-size-md); color: var(--ui-color-text); line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
    .ui-fbf-value.empty { color: var(--ui-color-text-muted); font-style: italic; }
    .ui-fbf-calc {
      display: flex; align-items: center; gap: var(--ui-space-2); min-height: var(--ui-size-md); padding: 0 var(--ui-space-3);
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface-subtle);
      color: var(--ui-color-text); font-size: var(--ui-font-size-md); font-variant-numeric: tabular-nums; box-sizing: border-box;
    }
    .ui-fbf-calc .muted { color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
    .ui-fbf-calc hugeicons-icon { color: var(--ui-color-text-muted); }
    .ui-fbf-files { list-style: none; margin: var(--ui-space-2) 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
    .ui-fbf-files li { display: flex; align-items: center; gap: var(--ui-space-2); font-size: var(--ui-font-size-sm); padding: 4px var(--ui-space-2); border-radius: var(--ui-radius); background: var(--ui-color-surface-subtle); }
    .ui-fbf-files li a, .ui-fbf-files li > span:first-child { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-color-text); }
    .ui-fbf-files .size { color: var(--ui-color-text-muted); font-variant-numeric: tabular-nums; }
    .ui-fbf-x { display: inline-grid; place-items: center; width: 24px; height: 24px; margin: -1px; border: 0; border-radius: var(--ui-radius-xs); background: transparent; color: var(--ui-color-text-muted); cursor: pointer; }
    .ui-fbf-x:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    @media (pointer: coarse) { .ui-fbf-x { width: 36px; height: 36px; margin: 0; } }
    .ui-fbf-x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }

    /* Controls without their own invalid state. */
    .ui-fbf.is-invalid ui-date-picker .wrap { border-color: var(--ui-color-danger); }

    /* Label to the left: two columns while there's room, stacked otherwise. */
    .ui-fbf[data-label="left"] { display: grid; grid-template-columns: minmax(120px, 32%) minmax(0, 1fr); column-gap: var(--ui-space-4); align-items: start; }
    .ui-fbf[data-label="left"] .ui-fbf-head { padding-top: 6px; }
    @container ui-fr (max-width: 520px) {
      .ui-fbf[data-label="left"] { display: flex; }
      .ui-fbf[data-label="left"] .ui-fbf-head { padding-top: 0; }
    }

    /* Label inside the box: sits where the text goes, floats up on focus or once filled. */
    .ui-fbf[data-label="inside"] .ui-fbf-float {
      position: absolute; left: calc(var(--ui-space-3) + 1px); top: 50%; transform: translateY(-50%); z-index: 1;
      max-width: calc(100% - var(--ui-space-6)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: var(--ui-font-size-md); color: var(--ui-color-text-muted); pointer-events: none;
      transform-origin: left top; transition: transform var(--ui-motion-fast) var(--ui-ease-decelerate, ease-out), color var(--ui-motion-fast);
    }
    .ui-fbf[data-label="inside"] .ui-input, .ui-fbf[data-label="inside"] ui-number-input .wrap { height: 46px; }
    .ui-fbf[data-label="inside"] .ui-input, .ui-fbf[data-label="inside"] .ui-number { padding-top: 16px; }
    .ui-fbf[data-label="inside"] ui-number-input .ui-number { height: 44px; }
    .ui-fbf[data-label="inside"] ui-textarea .ui-textarea { padding-top: 22px; }
    .ui-fbf[data-label="inside"]:has(ui-textarea) .ui-fbf-float { top: 14px; }
    .ui-fbf[data-label="inside"] .ui-input::placeholder, .ui-fbf[data-label="inside"] .ui-number::placeholder, .ui-fbf[data-label="inside"] .ui-textarea::placeholder { color: transparent; }
    .ui-fbf[data-label="inside"].has-value .ui-fbf-float,
    .ui-fbf[data-label="inside"] .ui-fbf-control:focus-within .ui-fbf-float { transform: translateY(calc(-50% - 8px)) scale(0.8); }
    .ui-fbf[data-label="inside"] .ui-fbf-control:focus-within .ui-fbf-float { color: var(--ui-color-primary); }
    .ui-fbf[data-label="inside"] .ui-fbf-control:focus-within .ui-input::placeholder,
    .ui-fbf[data-label="inside"] .ui-fbf-control:focus-within .ui-textarea::placeholder { color: var(--ui-color-text-muted); }
    .ui-fbf[data-label="inside"].is-invalid .ui-fbf-float { color: var(--ui-color-danger); }
    .ui-fbf[data-label="inside"]:has(ui-textarea) .ui-fbf-float { transform: none; }
    .ui-fbf[data-label="inside"]:has(ui-textarea).has-value .ui-fbf-float,
    .ui-fbf[data-label="inside"]:has(ui-textarea) .ui-fbf-control:focus-within .ui-fbf-float { transform: translateY(-8px) scale(0.8); }

    /* Error inside the box: a short line at the right edge; the full text is announced. */
    .ui-fbf.err-inside.is-invalid .ui-input, .ui-fbf.err-inside.is-invalid .ui-number, .ui-fbf.err-inside.is-invalid .ui-textarea { padding-right: min(46%, 220px); }
    .ui-fbf-err-in {
      position: absolute; right: var(--ui-space-2); top: 50%; transform: translateY(-50%); max-width: min(44%, 210px);
      display: flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: var(--ui-radius-xs);
      background: color-mix(in srgb, var(--ui-color-danger) 12%, var(--ui-color-surface));
      color: var(--ui-color-danger); font-size: 12px; line-height: 1.3; pointer-events: auto;
    }
    .ui-fbf-err-in > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ui-fbf-err-in hugeicons-icon { flex: none; }
    /* Clear of the number input's side-by-side steppers (2 x 24px plus dividers, ~49px); currency fields hide them. */
    .ui-fbf:has(ui-number-input .steppers) .ui-fbf-err-in { right: 58px; }
    .ui-fbf:has(ui-textarea) .ui-fbf-err-in { top: auto; bottom: var(--ui-space-2); transform: none; }
    @media (prefers-reduced-motion: reduce) { .ui-fbf-float { transition: none !important; } }
  `,
})
export class UiFbFieldView {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly engine = input.required<UiFormEngine>();
  readonly field = input.required<UiFbField>();
  readonly row = input<string | null>(null);
  /** Prefix that keeps ids unique when several forms share a page. */
  readonly idPrefix = input('fb');
  readonly uploader = input<UiFbUploader | null>(null);

  protected readonly errorIcon = FB_ICONS.Alert01Icon;
  protected readonly removeIcon = FB_ICONS.Cancel01Icon;
  protected readonly calcIcon = FB_ICONS.CalculatorIcon;
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal('');

  readonly addr = computed(() => (this.row() ? `${this.row()}/${this.field().id}` : this.field().id));
  protected readonly state = computed(() => this.engine().instanceState(this.field().id, this.row()));
  protected readonly viewing = computed(() => this.engine().mode === 'view');
  protected readonly info = computed(() => fieldTypeInfo(this.field().type));
  protected readonly grouped = computed(() => GROUP_TYPES.has(this.field().type));

  readonly ids = computed(() => {
    const base = `${this.idPrefix()}-${this.addr().replace(/[^\w-]/g, '_')}`;
    return { control: `${base}-in`, label: `${base}-lbl`, help: `${base}-help`, error: `${base}-err` };
  });

  protected readonly labelPos = computed<UiFbLabelPlacement>(() => {
    const p = this.field().layout?.labelPlacement ?? this.engine().definition.settings?.labelPlacement ?? 'top';
    // Floating labels only work inside a single text box.
    if (p === 'inside' && (!this.info().textLike || this.viewing())) return 'top';
    return p;
  });
  protected readonly errInside = computed(() => {
    const p: UiFbErrorPlacement = this.field().layout?.errorPlacement ?? this.engine().definition.settings?.errorPlacement ?? 'below';
    return p === 'inside' && !!this.info().textLike;
  });
  protected readonly marker = computed(() => this.engine().settings.requiredMarker);

  protected readonly touchedOnce = computed(() => this.engine().touched().has(this.addr()));
  protected readonly showError = computed(() => !!this.state().errors.length && this.engine().errorsShown(this.field().id, this.row()));
  protected readonly error = computed(() => this.state().errors[0] ?? '');
  protected readonly warningsShown = computed(() => (this.engine().errorsShown(this.field().id, this.row()) ? this.state().warnings : []));
  protected readonly hasValue = computed(() => !isEmptyValue(this.state().value));
  protected readonly placeholder = computed(() => (this.labelPos() === 'inside' ? '' : this.field().placeholder ?? ''));
  protected readonly text = computed(() => (this.state().value == null ? '' : String(this.state().value)));
  protected readonly list = computed(() => (Array.isArray(this.state().value) ? (this.state().value as string[]) : []));
  protected readonly files = computed(() => (Array.isArray(this.state().value) ? (this.state().value as UiFbFileValue[]) : []));
  protected readonly display = computed(() => formatValue(this.field(), this.state().value));

  protected readonly inputType = computed(() => ({ email: 'email', phone: 'tel', url: 'url' } as Record<string, 'email' | 'tel' | 'url'>)[this.field().type] ?? 'text');
  protected readonly inputmode = computed(() => ({ email: 'email', phone: 'tel', url: 'url' } as Record<string, string>)[this.field().type]);

  protected readonly dateMin = computed(() => this.dateBound('minDate'));
  protected readonly dateMax = computed(() => this.dateBound('maxDate'));

  /**
   * Live options, plus any the saved answer still uses that are archived or
   * gone, so old answers show (and stay chosen) instead of silently vanishing.
   */
  protected readonly options = computed(() => {
    const f = this.field();
    const live = (f.options ?? []).filter((o) => !o.archived).map((o) => ({ label: o.label, value: o.value }));
    const v = this.state().value;
    const chosen = (Array.isArray(v) ? v : isEmptyValue(v) ? [] : [v]).map(String);
    for (const c of chosen) {
      if (live.some((o) => o.value === c)) continue;
      const old = f.options?.find((o) => o.value === c);
      live.push({ label: `${old?.label ?? c} (no longer offered)`, value: c });
    }
    return live;
  });

  /** The registered list a sourced field searches (undefined when the app doesn't provide it). */
  protected readonly sourceDef = computed(() => this.engine().optionSource(this.field().source?.type));
  /** The source's settings with other answers filled in (as plain values). */
  protected readonly sourceParams = computed(() => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this.field().source?.params ?? {})) {
      out[k] = optionValueOf('ref' in v ? this.engine().answerFor(v.ref, this.row()) : v.const);
    }
    return out;
  });

  constructor() {
    // A dependent list (Cities of the chosen Country) drops its answer when what it depends on changes.
    let lastParams: string | null = null;
    effect(() => {
      const key = JSON.stringify(this.sourceParams());
      untracked(() => {
        if (lastParams !== null && key !== lastParams && !this.viewing() && !isEmptyValue(this.state().value)) {
          this.set(this.field().type === 'multiselect' ? ([] as UiFbChoice[]) : null);
        }
        lastParams = key;
      });
    });
    // The library controls render their own native inputs; point those at our
    // label, help and error so screen readers get the whole picture.
    afterRenderEffect(() => {
      const ids = this.ids();
      const st = this.state();
      const shown = this.showError();
      const help = !!this.field().help;
      const grouped = this.grouped();
      const root = this.host.nativeElement.querySelector('.ui-fbf-control');
      if (!root) return;
      const describedBy = [shown ? ids.error : '', help ? ids.help : ''].filter(Boolean).join(' ') || null;
      const target = grouped
        ? (root as HTMLElement)
        : root.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select, [role=combobox], button.trigger');
      if (!target) return;
      if (!grouped) target.id = ids.control;
      setAttr(target, 'aria-describedby', describedBy);
      setAttr(target, 'aria-invalid', shown ? 'true' : null);
      setAttr(target, 'aria-required', st.required ? 'true' : null);
    });
  }

  protected set(v: unknown): void {
    this.engine().setValue(this.field().id, this.row(), v);
  }

  protected blurred(e: FocusEvent): void {
    // Leaving one radio for the next isn't leaving the field.
    const next = e.relatedTarget as Node | null;
    if (next && (e.currentTarget as HTMLElement).contains(next)) return;
    this.engine().markTouched(this.field().id, this.row());
  }

  /** Moves focus into the control (used by the error summary). */
  focus(): void {
    const root = this.host.nativeElement;
    const el = root.querySelector<HTMLElement>('.ui-fbf-control input:not([type=hidden]), .ui-fbf-control textarea, .ui-fbf-control select, .ui-fbf-control button, .ui-fbf-control [tabindex="0"]');
    root.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el?.focus({ preventScroll: true });
  }

  protected async pick(picked: File[]): Promise<void> {
    const f = this.field();
    const keep = f.props?.multiple ? this.files() : [];
    const up = this.uploader();
    this.engine().markTouched(f.id, this.row());
    if (!up) {
      const meta = picked.map((p) => ({ name: p.name, size: p.size, type: p.type }));
      const prev = this.engine().files.get(this.addr()) ?? [];
      this.engine().files.set(this.addr(), f.props?.multiple ? [...prev, ...picked] : picked);
      this.engine().setValue(f.id, this.row(), [...keep, ...meta]);
      return;
    }
    this.uploading.set(true);
    this.uploadError.set('');
    try {
      const done = await Promise.all(picked.map((p) => up(p, f)));
      this.engine().setValue(f.id, this.row(), [...keep, ...done]);
    } catch {
      this.uploadError.set('The file could not be uploaded. Try again.');
    } finally {
      this.uploading.set(false);
    }
  }

  protected unpick(i: number): void {
    const next = this.files().filter((_, j) => j !== i);
    const kept = this.engine().files.get(this.addr());
    if (kept) this.engine().files.set(this.addr(), kept.filter((_, j) => j !== i));
    this.engine().setValue(this.field().id, this.row(), next);
  }

  protected size(bytes: number): string {
    const [n, unit] = bytes < 1024 ? [bytes, 'byte'] : bytes < 1024 * 1024 ? [bytes / 1024, 'kilobyte'] : [bytes / 1024 / 1024, 'megabyte'];
    return new Intl.NumberFormat(undefined, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: unit === 'megabyte' ? 1 : 0 }).format(n);
  }

  private dateBound(type: 'minDate' | 'maxDate'): string | null {
    const rule = this.field().validators?.find((v) => v.type === type);
    const raw = rule?.params?.['date'];
    if (typeof raw !== 'string') return null;
    const m = /^today\s*([+-]\s*\d+)?$/i.exec(raw.trim());
    if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    const d = new Date();
    d.setDate(d.getDate() + (m[1] ? Number(m[1].replace(/\s/g, '')) : 0));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

function setAttr(el: HTMLElement, name: string, value: string | null): void {
  if (value === null) el.removeAttribute(name);
  else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}
