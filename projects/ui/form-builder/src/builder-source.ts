import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiInput, UiNumberInput } from '@zouriel/ui/form';
import { FbBuilderStore } from './builder-store';
import { FB_SHARED_STYLES } from './builder-styles';
import type { UiFbChoice, UiFbOptionSourceDef, UiFbSourceParamSpec } from './option-sources';
import type { UiFbField, UiFbOptionSourceRef, UiFbSourceParamValue } from './schema';
import { UiFbSourcePicker } from './source-picker';

/**
 * `ui-fb-source-settings` — where a dropdown or multi-select gets its options
 * from a registered list: which list, its settings (each a fixed value or
 * another question's answer, for lists that depend on each other), and a live
 * preview to try it.
 */
@Component({
  selector: 'ui-fb-source-settings',
  imports: [FormsModule, UiInput, UiNumberInput, UiFbSourcePicker],
  template: `
    @let src = source();
    <div class="fb-stack tight">
      <label class="lw"><span class="fb-label">List</span>
        <select class="fb-native-select" (change)="setType($any($event.target).value)">
          @if (!def()) { <option value="" selected disabled>{{ src.type ? '“' + src.type + '” (not available here)' : 'Choose a list…' }}</option> }
          @for (d of store.optionSourceDefs(); track d.type) { <option [value]="d.type" [selected]="d.type === src.type">{{ d.label }}</option> }
        </select>
      </label>
      @if (def(); as d) {
        @if (d.description) { <p class="fb-hint">{{ d.description }}</p> }
        @for (p of d.params ?? []; track p.key) {
          @let v = src.params?.[p.key];
          <div class="param">
            <span class="fb-label">{{ p.label }}@if (p.required) { <span class="req" aria-hidden="true">*</span> }</span>
            <div class="fb-row">
              <select class="fb-native-select mode" (change)="setMode(p, $any($event.target).value)" [attr.aria-label]="p.label + ': where the value comes from'">
                <option value="const" [selected]="!isRef(v)">is</option>
                @if (answers().length) { <option value="ref" [selected]="isRef(v)">is the answer to</option> }
              </select>
              @if (isRef(v)) {
                <select class="fb-native-select grow" (change)="setParam(p, { ref: $any($event.target).value })" [attr.aria-label]="p.label + ': question'">
                  <option value="" disabled [selected]="!refOf(v)">Choose a question…</option>
                  @for (r of answers(); track r.id) { <option [value]="r.id" [selected]="r.id === refOf(v)">{{ r.label }}</option> }
                </select>
              } @else {
                @switch (p.kind ?? 'text') {
                  @case ('select') {
                    <select class="fb-native-select grow" (change)="setParam(p, { const: $any($event.target).value })" [attr.aria-label]="p.label">
                      <option value="" [selected]="!constOf(v)">{{ p.required ? 'Choose…' : 'Any' }}</option>
                      @for (o of p.options ?? []; track o.value) { <option [value]="o.value" [selected]="o.value === constOf(v)">{{ o.label }}</option> }
                    </select>
                  }
                  @case ('number') {
                    <ui-number-input class="grow" size="sm" [ngModel]="numOf(v)" (ngModelChange)="setParam(p, { const: $event })" [ariaLabel]="p.label" />
                  }
                  @default {
                    <label class="lw grow"><span class="fb-sr">{{ p.label }}</span>
                      <ui-input size="sm" [ngModel]="constOf(v)" (ngModelChange)="setParam(p, { const: $event }, 'srcp:' + field().id + ':' + p.key)" [placeholder]="p.placeholder ?? ''" /></label>
                  }
                }
              }
            </div>
            @if (p.hint) { <p class="fb-hint">{{ p.hint }}</p> }
            @if (isRef(v)) { <p class="fb-hint">Changing that answer clears this one, since the list changes.</p> }
          </div>
        }
        <div class="try">
          <span class="fb-label">Try it</span>
          @for (p of refParams(); track p.key) {
            <!-- Settings that follow another answer have no answer here; let the admin pick one to try with. -->
            <div class="fb-row with">
              <span class="with-lbl">With {{ p.label.toLowerCase() }}</span>
              @if (p.options?.length) {
                <select class="fb-native-select grow" (change)="setTry(p.key, $any($event.target).value)" [attr.aria-label]="'Try with ' + p.label">
                  <option value="" [selected]="!tryWith()[p.key]">Choose…</option>
                  @for (o of p.options!; track o.value) { <option [value]="o.value" [selected]="o.value === tryWith()[p.key]">{{ o.label }}</option> }
                </select>
              } @else {
                <label class="lw grow"><span class="fb-sr">Try with {{ p.label }}</span>
                  <ui-input size="sm" [ngModel]="tryWith()[p.key] ?? ''" (ngModelChange)="setTry(p.key, $event)" placeholder="A value to try" /></label>
              }
            </div>
          }
          <ui-fb-source-picker [source]="d" [params]="previewParams()" [multiple]="field().type === 'multiselect'" [value]="tried()"
            (valueChange)="tried.set($event)" [placeholder]="'Search ' + d.label.toLowerCase() + '…'" ariaLabel="Preview of the list" />
          <p class="fb-hint">Answers are saved with both the value and its label, so they stay readable later.</p>
        </div>
      } @else if (!store.optionSourceDefs().length) {
        <p class="fb-warn">This app hasn’t registered any lists. Switch back to a typed list, or ask a developer to add one.</p>
      }
    </div>
  `,
  styles: [FB_SHARED_STYLES, `
    :host { display: block; }
    .tight { gap: var(--ui-space-2); }
    .param { display: flex; flex-direction: column; gap: 4px; }
    .mode { width: auto; flex: none; }
    .grow { flex: 1; min-width: 0; }
    .req { color: var(--ui-color-danger); margin-left: 3px; }
    .with { gap: var(--ui-space-2); }
    .with-lbl { flex: none; font-size: 12px; color: var(--ui-color-text-secondary); }
    .try { display: flex; flex-direction: column; gap: 4px; padding-top: var(--ui-space-2); border-top: 1px dashed var(--ui-color-border); }
  `],
})
export class FbSourceSettings {
  protected readonly store = inject(FbBuilderStore);
  readonly field = input.required<UiFbField>();

  protected readonly source = computed<UiFbOptionSourceRef>(() => this.field().source ?? { type: '' });
  protected readonly def = computed<UiFbOptionSourceDef | undefined>(() => this.store.optionSourceDefs().find((d) => d.type === this.source().type));
  /** Questions a param can follow: answers outside this field that aren't files. */
  protected readonly answers = computed(() =>
    this.store.refOptions(this.field().id).filter((r) => r.id !== this.field().id && !['group', 'repeat', 'page', 'file'].includes(r.kind)));
  /** Settings that follow another question's answer. */
  protected readonly refParams = computed(() => (this.def()?.params ?? []).filter((p) => { const v = this.source().params?.[p.key]; return !!v && 'ref' in v; }));
  /** Stand-in answers for those, only for trying the list here. */
  protected readonly tryWith = signal<Record<string, unknown>>({});
  protected readonly previewParams = computed(() => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this.source().params ?? {})) out[k] = 'const' in v ? v.const : this.tryWith()[k];
    return out;
  });

  protected setTry(key: string, value: unknown): void {
    this.tried.set(null);
    this.tryWith.update((t) => ({ ...t, [key]: value === '' ? undefined : value }));
  }
  protected readonly tried = signal<UiFbChoice | UiFbChoice[] | null>(null);

  protected isRef(v: UiFbSourceParamValue | undefined): boolean {
    return !!v && 'ref' in v;
  }
  protected refOf(v: UiFbSourceParamValue | undefined): string {
    return v && 'ref' in v ? v.ref : '';
  }
  protected constOf(v: UiFbSourceParamValue | undefined): string {
    return v && 'const' in v && v.const != null ? String(v.const) : '';
  }
  protected numOf(v: UiFbSourceParamValue | undefined): number | null {
    return v && 'const' in v && typeof v.const === 'number' ? v.const : null;
  }

  protected setType(type: string): void {
    this.tried.set(null);
    this.store.updateField(this.field().id, { source: { type, params: {} } });
  }

  protected setMode(p: UiFbSourceParamSpec, mode: string): void {
    this.setParam(p, mode === 'ref' ? { ref: '' } : { const: '' });
  }

  protected setParam(p: UiFbSourceParamSpec, v: UiFbSourceParamValue, mergeKey?: string): void {
    const src = this.source();
    const params = { ...(src.params ?? {}) };
    const empty = 'const' in v ? v.const == null || v.const === '' : false;
    if (empty && !('ref' in v)) delete params[p.key];
    else params[p.key] = v;
    this.tried.set(null);
    this.store.updateField(this.field().id, { source: { ...src, params } }, mergeKey);
  }
}
