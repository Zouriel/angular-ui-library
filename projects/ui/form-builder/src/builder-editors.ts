import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiDatePicker } from '@zouriel/ui/datepicker';
import { UiInput, UiNumberInput, UiSwitch, UiTextarea } from '@zouriel/ui/form';
import { UiMenu, type UiMenuItem } from '@zouriel/ui/overlay';
import { calcOpInfo, UI_FB_CALC_OPS } from './calc';
import { FbConditionEditor } from './builder-condition';
import { FbBuilderStore } from './builder-store';
import { FB_SHARED_STYLES } from './builder-styles';
import { fbSlug, fbUid, indexDefinition } from './definition';
import { requiredMessage } from './engine';
import { valueKindOf } from './field-types';
import type { UiFbCalc, UiFbCalcArg, UiFbCalcOp, UiFbCondition, UiFbField, UiFbGroup, UiFbOption, UiFbValidatorRule } from './schema';
import { comparisonWords, describeDateParam, formatMessage, UI_FB_IMPLICIT_VALIDATOR, type UiFbParamSpec, type UiFbValidatorDef } from './validators';
import { FB_ICONS } from './builder-icons';
import { FbSourceSettings } from './builder-source';
import { UI_FB_SOURCE_FIELD_TYPES } from './option-sources';

// ── Options ───────────────────────────────────────────────────────────────

/**
 * `ui-fb-options` — the choices of a dropdown, radio or checkbox field. Stored
 * values follow the labels until the form has answers; after that they're
 * locked (old answers point at them) and removing an option archives it.
 */
@Component({
  selector: 'ui-fb-options',
  imports: [FormsModule, HugeiconsIconComponent, UiInput, UiSwitch, UiTextarea, UiButton, UiSegmented, FbSourceSettings],
  template: `
    @let f = field();
    @if (canSource()) {
      <ui-segmented class="from" size="sm" label="Where the options come from" [options]="fromModes" [value]="f.source ? 'source' : 'list'"
        (valueChange)="setFrom($any($event))" />
      @if (switchedToSource()) { <p class="fb-warn">People have answered this with the typed options. Those answers keep their saved values, shown as the value itself.</p> }
    }
    @if (f.source) {
      <ui-fb-source-settings [field]="f" />
    } @else {
    <div class="fb-stack tight">
      <ul class="opts" role="list">
        @for (o of f.options ?? []; track o.id; let i = $index; let last = $last) {
          <li class="opt" [class.archived]="o.archived">
            <div class="moves">
              <button type="button" class="fb-icon-btn sm" [disabled]="i === 0" (click)="move(i, -1)" [attr.aria-label]="'Move ' + o.label + ' up'">
                <hugeicons-icon aria-hidden="true" [icon]="upIcon" [size]="12" [strokeWidth]="2" />
              </button>
              <button type="button" class="fb-icon-btn sm" [disabled]="last" (click)="move(i, 1)" [attr.aria-label]="'Move ' + o.label + ' down'">
                <hugeicons-icon aria-hidden="true" [icon]="downIcon" [size]="12" [strokeWidth]="2" />
              </button>
            </div>
            <div class="opt-main">
              <label class="lw"><span class="fb-sr">Option {{ i + 1 }}</span>
                <ui-input [ngModel]="o.label" (ngModelChange)="setLabel(o, $event)" placeholder="Option label" (keydown.enter)="addAfter(i)" /></label>
              @if (showValues()) {
                <div class="val">
                  <span class="val-lbl">Saved as</span>
                  <input class="val-in" [value]="o.value" [disabled]="locked(o)" (change)="setValue(o, $any($event.target).value)" [attr.aria-label]="'Saved value of ' + o.label" />
                  @if (locked(o)) { <span class="lock" title="Answers already use this value, so it can’t change.">locked</span> }
                </div>
              }
              @if (o.archived) { <span class="arch">Archived: hidden from new answers, kept in old ones. <button type="button" class="fb-link" (click)="restore(o)">Restore</button></span> }
            </div>
            @if (!o.archived) {
              <button type="button" class="fb-icon-btn danger" (click)="remove(o)" [attr.aria-label]="'Remove ' + o.label"
                [title]="locked(o) ? 'Archive (answers use it)' : 'Remove'">
                <hugeicons-icon aria-hidden="true" [icon]="removeIcon" [size]="14" [strokeWidth]="1.8" />
              </button>
            }
          </li>
        }
      </ul>
      <div class="fb-row wrap">
        <button type="button" class="fb-link" (click)="add()"><hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="13" [strokeWidth]="2" /> Add option</button>
        <button type="button" class="fb-link" (click)="pasting.set(!pasting())" [attr.aria-expanded]="pasting()">Paste a list</button>
        <span class="small-switch"><ui-switch [ngModel]="showValues()" (ngModelChange)="showValues.set($event)">Show saved values</ui-switch></span>
      </div>
      @if (pasting()) {
        <div class="paste">
          <label class="lw"><span class="fb-sr">Options, one per line</span><ui-textarea [(ngModel)]="pasted" [rows]="4" placeholder="One option per line" /></label>
          <div class="fb-row">
            <ui-button size="sm" (click)="applyPaste()">Add these</ui-button>
            <ui-button size="sm" variant="ghost" (click)="pasting.set(false)">Cancel</ui-button>
          </div>
        </div>
      }
    </div>
    }
  `,
  styles: [FB_SHARED_STYLES, `
    .tight { gap: var(--ui-space-2); }
    .from { display: block; margin-bottom: var(--ui-space-2); }
    .opts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .opt { display: flex; align-items: flex-start; gap: 4px; }
    .opt.archived .opt-main ui-input { opacity: 0.55; }
    .moves { display: flex; flex-direction: column; gap: 0; padding-top: 1px; }
    .fb-icon-btn.sm { width: 20px; height: 15px; }
    @media (pointer: coarse) { .fb-icon-btn.sm { width: 36px; height: 22px; } }
    .opt-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .val { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ui-color-text-muted); }
    .val-in { flex: 1; min-width: 0; height: 22px; padding: 0 6px; border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius-xs);
      background: var(--ui-color-bg); color: var(--ui-color-text-secondary); font-family: var(--ui-font-mono); font-size: 11px; }
    .val-in:disabled { opacity: 0.7; }
    .lock { font-size: 11px; color: var(--ui-color-warning); }
    .arch { font-size: 11px; color: var(--ui-color-text-muted); }
    .wrap { flex-wrap: wrap; gap: var(--ui-space-3); }
    .fb-link { display: inline-flex; align-items: center; gap: 3px; }
    .small-switch { margin-left: auto; font-size: 12px; }
    .paste { display: flex; flex-direction: column; gap: var(--ui-space-2); }
  `],
})
export class FbOptionsEditor {
  protected readonly store = inject(FbBuilderStore);
  readonly field = input.required<UiFbField>();

  protected readonly fromModes = [{ value: 'list', label: 'Typed list' }, { value: 'source', label: 'Data source' }];
  /** Dropdowns and multi-selects can search an app list, when the app registered one (or the field already uses one). */
  protected readonly canSource = computed(() =>
    (UI_FB_SOURCE_FIELD_TYPES as readonly string[]).includes(this.field().type) && (!!this.store.optionSourceDefs().length || !!this.field().source));

  /** The published form had typed options here, and answers use them. */
  protected readonly switchedToSource = computed(() => {
    if (!this.store.live() || !this.field().source) return false;
    const pub = indexDefinition(this.store.published()!).get(this.field().id)?.element;
    return !!pub && 'kind' in pub && pub.kind === 'field' && !pub.source;
  });

  protected setFrom(mode: 'list' | 'source'): void {
    const f = this.field();
    if (mode === 'source' && !f.source) this.store.updateField(f.id, { source: { type: this.store.optionSourceDefs()[0]?.type ?? '', params: {} } });
    // The typed options are kept while a source is on, so switching back restores them.
    if (mode === 'list' && f.source) this.store.updateField(f.id, (old) => { const { source: _s, ...rest } = old; return rest as UiFbField; });
  }

  protected readonly addIcon = FB_ICONS.Add01Icon;
  protected readonly removeIcon = FB_ICONS.Cancel01Icon;
  protected readonly upIcon = FB_ICONS.ArrowUp01Icon;
  protected readonly downIcon = FB_ICONS.ArrowDown01Icon;
  protected readonly showValues = signal(false);
  protected readonly pasting = signal(false);
  protected pasted = '';

  /** Option values already used by saved answers. */
  private readonly published = computed(() => {
    const pub = this.store.live() ? this.store.published() : null;
    const f = pub ? indexDefinition(pub).get(this.field().id)?.element : null;
    return new Set(f && 'options' in f ? (f.options ?? []).map((o) => o.value) : []);
  });

  protected locked(o: UiFbOption): boolean {
    return this.published().has(o.value);
  }

  private write(options: UiFbOption[], mergeKey?: string): void {
    this.store.updateField(this.field().id, { options }, mergeKey);
  }

  private uniqueValue(base: string, exceptId?: string): string {
    const taken = new Set((this.field().options ?? []).filter((o) => o.id !== exceptId).map((o) => o.value));
    let v = base || 'option';
    let n = 2;
    while (taken.has(v)) v = `${base}_${n++}`;
    return v;
  }

  protected setLabel(o: UiFbOption, label: string): void {
    // The saved value follows the label until it's locked or was set by hand.
    const follows = !this.locked(o) && (o.value === fbSlug(o.label) || /^option_?\d*$/.test(o.value) || o.value.startsWith(fbSlug(o.label) + '_'));
    const value = follows ? this.uniqueValue(fbSlug(label), o.id) : o.value;
    this.write((this.field().options ?? []).map((x) => (x.id === o.id ? { ...x, label, value } : x)), `opt:${o.id}`);
  }

  protected setValue(o: UiFbOption, raw: string): void {
    const value = this.uniqueValue(raw.trim() || fbSlug(o.label), o.id);
    this.write((this.field().options ?? []).map((x) => (x.id === o.id ? { ...x, value } : x)));
  }

  protected add(): void {
    const n = (this.field().options ?? []).length + 1;
    const label = `Option ${n}`;
    this.write([...(this.field().options ?? []), { id: fbUid('opt'), label, value: this.uniqueValue(fbSlug(label)) }]);
  }

  protected addAfter(i: number): void {
    const list = [...(this.field().options ?? [])];
    const label = `Option ${list.length + 1}`;
    list.splice(i + 1, 0, { id: fbUid('opt'), label, value: this.uniqueValue(fbSlug(label)) });
    this.write(list);
  }

  protected remove(o: UiFbOption): void {
    const list = this.field().options ?? [];
    if (this.locked(o)) this.write(list.map((x) => (x.id === o.id ? { ...x, archived: true } : x)));
    else this.write(list.filter((x) => x.id !== o.id));
  }

  protected restore(o: UiFbOption): void {
    this.write((this.field().options ?? []).map((x) => (x.id === o.id ? { ...x, archived: undefined } : x)));
  }

  protected move(i: number, d: -1 | 1): void {
    const list = [...(this.field().options ?? [])];
    [list[i], list[i + d]] = [list[i + d], list[i]];
    this.write(list);
  }

  protected applyPaste(): void {
    const existing = new Set((this.field().options ?? []).map((o) => o.label.trim().toLowerCase()));
    const list = [...(this.field().options ?? [])];
    for (const line of this.pasted.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
      if (existing.has(line.toLowerCase())) continue;
      existing.add(line.toLowerCase());
      const value = fbSlug(line);
      const taken = new Set(list.map((o) => o.value));
      let v = value;
      let n = 2;
      while (taken.has(v)) v = `${value}_${n++}`;
      list.push({ id: fbUid('opt'), label: line, value: v });
    }
    this.write(list);
    this.pasted = '';
    this.pasting.set(false);
  }
}

// ── Checks (required + validators) ────────────────────────────────────────

/**
 * `ui-fb-checks` — whether an answer is needed, and the checks it must pass,
 * each with its own message (shown under the field by default).
 */
@Component({
  selector: 'ui-fb-checks',
  imports: [FormsModule, HugeiconsIconComponent, UiInput, UiNumberInput, UiSwitch, UiSegmented, UiMenu, UiDatePicker, FbConditionEditor],
  template: `
    @let f = field();
    <div class="fb-stack">
      @if (f.type !== 'calculated' && f.type !== 'hidden') {
        <section class="block">
          <span class="fb-label">Answer needed?</span>
          <ui-segmented size="sm" label="Answer needed" [options]="requiredModes" [value]="requiredMode()" (valueChange)="setRequiredMode($event)" />
          @if (requiredMode() === 'when') {
            <ui-fb-condition [condition]="requiredWhen()" [forId]="f.id" (conditionChange)="store.updateField(f.id, { required: { when: $event } }, 'req:' + f.id)" />
          }
          @if (requiredMode() !== 'no') {
            <label class="msg">
              <span class="fb-label">Message when it’s left empty</span>
              <ui-input [ngModel]="f.requiredMessage ?? ''" (ngModelChange)="store.updateField(f.id, { requiredMessage: $event || undefined }, 'reqmsg:' + f.id)"
                [placeholder]="defaultRequired()" />
            </label>
          }
        </section>
      }

      @if (implicitDef(); as d) {
        <section class="block auto">
          <div class="rule-head"><span class="rule-name">{{ d.label }}</span><span class="fb-chip ok">Automatic</span></div>
          <p class="fb-hint">{{ d.description }}. Every {{ f.type === 'email' ? 'email' : f.type === 'url' ? 'website' : 'phone' }} field checks this.</p>
          @if (!hasExplicit(d.type)) {
            <button type="button" class="fb-link" (click)="add(d)">Change its message</button>
          }
        </section>
      }

      @for (rule of f.validators ?? []; track rule.id) {
        @let d = defOf(rule.type);
        <section class="block rule" [class.unknown]="!d">
          <div class="rule-head">
            <span class="rule-name">{{ d?.label ?? rule.type }}</span>
            @if (rule.severity === 'warning') { <span class="fb-chip warn">Warning</span> }
            <button type="button" class="fb-icon-btn danger push" (click)="remove(rule)" [attr.aria-label]="'Remove ' + (d?.label ?? rule.type)">
              <hugeicons-icon aria-hidden="true" [icon]="removeIcon" [size]="14" [strokeWidth]="1.8" />
            </button>
          </div>
          @if (!d) {
            <p class="fb-hint">This check is provided by the app, which hasn’t registered it here. It is kept, but can’t be edited.</p>
          } @else {
            @if (d.description) { <p class="fb-hint">{{ d.description }}</p> }
            @for (p of d.params ?? []; track p.key) {
              @if (!(p.key === 'regex' && rule.params?.['preset'] !== 'custom')) {
                <div class="param">
                  <span class="fb-label" aria-hidden="true">{{ p.label }}</span>
                  @switch (p.kind) {
                    @case ('number') {
                      <ui-number-input [ngModel]="num(rule, p)" (ngModelChange)="setParam(rule, p.key, $event)" [placeholder]="p.placeholder ?? ''" [ariaLabel]="p.label" />
                    }
                    @case ('select') {
                      <select class="fb-native-select" (change)="setParam(rule, p.key, $any($event.target).value)" [attr.aria-label]="p.label">
                        @for (o of p.options ?? []; track o.value) { <option [value]="o.value" [selected]="o.value === param(rule, p)">{{ o.label }}</option> }
                      </select>
                    }
                    @case ('field') {
                      <select class="fb-native-select" (change)="setParam(rule, p.key, $any($event.target).value)" [attr.aria-label]="p.label">
                        <option value="" disabled [selected]="!param(rule, p)">Choose a question…</option>
                        @for (o of fieldChoices(p); track o.id) { <option [value]="o.id" [selected]="o.id === param(rule, p)">{{ o.label }}</option> }
                      </select>
                    }
                    @case ('date') {
                      <div class="date-param">
                        <select class="fb-native-select" (change)="setDateMode(rule, p.key, $any($event.target).value)" [attr.aria-label]="p.label + ': kind of date'">
                          <option value="today" [selected]="dateMode(rule, p) === 'today'">Today</option>
                          <option value="offset" [selected]="dateMode(rule, p) === 'offset'">Days from today</option>
                          <option value="date" [selected]="dateMode(rule, p) === 'date'">A set date</option>
                        </select>
                        @if (dateMode(rule, p) === 'offset') {
                          <ui-number-input [ngModel]="dateOffset(rule, p)" (ngModelChange)="setParam(rule, p.key, 'today' + (($event ?? 0) >= 0 ? '+' : '') + ($event ?? 0))" ariaLabel="Days from today" />
                        }
                        @if (dateMode(rule, p) === 'date') {
                          <label class="lw"><span class="fb-sr">{{ p.label }}: date</span><ui-date-picker [ngModel]="dateFixed(rule, p)" (ngModelChange)="setParam(rule, p.key, $event)" /></label>
                        }
                      </div>
                    }
                    @default {
                      <label class="lw"><span class="fb-sr">{{ p.label }}</span><ui-input [ngModel]="param(rule, p)" (ngModelChange)="setParam(rule, p.key, $event)" [placeholder]="p.placeholder ?? ''" /></label>
                    }
                  }
                  @if (p.hint) { <span class="fb-hint">{{ p.hint }}</span> }
                </div>
              }
            }
            <label class="msg">
              <span class="fb-label">Message</span>
              <ui-input [ngModel]="rule.message ?? ''" (ngModelChange)="patch(rule, { message: $event || undefined }, 'msg')" [placeholder]="preview(rule, d)" />
            </label>
            <div class="toggles">
              <ui-switch [ngModel]="!!rule.when" (ngModelChange)="toggleWhen(rule, $event)">Only check sometimes</ui-switch>
              <ui-switch [ngModel]="rule.severity === 'warning'" (ngModelChange)="patch(rule, { severity: $event ? 'warning' : undefined })">Warn but allow submitting</ui-switch>
            </div>
            @if (rule.when) {
              <div class="when">
                <span class="fb-label">Check only when</span>
                <ui-fb-condition [condition]="rule.when" [forId]="f.id" (conditionChange)="patch(rule, { when: $event }, 'when')" />
              </div>
            }
          }
        </section>
      }

      @if (addable().length) {
        <ui-menu [items]="addable()" (select)="addByType($event)">
          <button menu-trigger type="button" class="add-check"><hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="14" [strokeWidth]="1.8" /> Add a check</button>
        </ui-menu>
      } @else if (f.type === 'hidden') {
        <p class="fb-hint">Hidden values aren’t checked: people never see them.</p>
      }
    </div>
  `,
  styles: [FB_SHARED_STYLES, `
    .block { display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .rule, .auto { padding: var(--ui-space-2); border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius); background: var(--ui-color-surface); }
    .rule.unknown { border-style: dashed; }
    .rule-head { display: flex; align-items: center; gap: 6px; }
    .rule-name { font-size: 13px; font-weight: 600; }
    .push { margin-left: auto; }
    .param, .msg, .when { display: flex; flex-direction: column; }
    .toggles { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
    .date-param { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-2); }
    .add-check { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 var(--ui-space-3);
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); background: transparent; color: var(--ui-color-text-secondary); font: inherit; font-size: 13px; cursor: pointer; }
    .add-check:hover { color: var(--ui-color-text); border-color: var(--ui-color-border-strong, var(--ui-color-primary)); }
    .add-check:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  `],
})
export class FbChecksEditor {
  protected readonly store = inject(FbBuilderStore);
  readonly field = input.required<UiFbField>();

  protected readonly addIcon = FB_ICONS.Add01Icon;
  protected readonly removeIcon = FB_ICONS.Cancel01Icon;
  protected readonly requiredModes = [
    { value: 'no', label: 'Optional' },
    { value: 'yes', label: 'Required' },
    { value: 'when', label: 'Required when…' },
  ];

  protected readonly requiredMode = computed(() => {
    const r = this.field().required;
    return r === true ? 'yes' : r && typeof r === 'object' ? 'when' : 'no';
  });
  protected readonly requiredWhen = computed<UiFbCondition | undefined>(() => {
    const r = this.field().required;
    return r && typeof r === 'object' ? r.when : undefined;
  });
  protected readonly defaultRequired = computed(() => formatMessage(requiredMessage(this.field(), this.field().label || 'This field'), { label: this.field().label || 'This field' }));

  protected readonly implicitDef = computed(() => {
    const t = UI_FB_IMPLICIT_VALIDATOR[this.field().type];
    return t ? this.defOf(t) : undefined;
  });

  /** Checks that can still be added (a check that only makes sense once isn't offered twice). */
  protected readonly addable = computed<UiMenuItem[]>(() => {
    const f = this.field();
    const repeatable = new Set(['pattern', 'compareField', 'equalsField']);
    const have = new Set((f.validators ?? []).map((v) => v.type));
    return this.store.validatorsFor(f)
      .filter((d) => repeatable.has(d.type) || !have.has(d.type))
      .filter((d) => d.type !== UI_FB_IMPLICIT_VALIDATOR[f.type])
      .map((d) => ({ label: d.label, value: d.type }));
  });

  protected defOf(type: string): UiFbValidatorDef | undefined {
    return this.store.validatorDefs().find((d) => d.type === type);
  }

  protected hasExplicit(type: string): boolean {
    return !!this.field().validators?.some((v) => v.type === type);
  }

  protected setRequiredMode(mode: string | null): void {
    const f = this.field();
    if (mode === 'yes') this.store.updateField(f.id, { required: true });
    else if (mode === 'when') this.store.updateField(f.id, { required: { when: this.requiredWhen() ?? { match: 'all', conditions: [] } } });
    else this.store.updateField(f.id, { required: undefined, requiredMessage: undefined });
  }

  private writeRules(rules: UiFbValidatorRule[], mergeKey?: string): void {
    this.store.updateField(this.field().id, { validators: rules.length ? rules : undefined }, mergeKey);
  }

  protected add(d: UiFbValidatorDef): void {
    const params = Object.fromEntries((d.params ?? []).filter((p) => p.default !== undefined).map((p) => [p.key, p.default]));
    this.writeRules([...(this.field().validators ?? []), { id: fbUid('val'), type: d.type, ...(Object.keys(params).length ? { params } : {}) }]);
  }

  protected addByType(item: UiMenuItem): void {
    const d = this.defOf(item.value);
    if (d) this.add(d);
  }

  protected remove(rule: UiFbValidatorRule): void {
    this.writeRules((this.field().validators ?? []).filter((r) => r.id !== rule.id));
  }

  protected patch(rule: UiFbValidatorRule, patch: Partial<UiFbValidatorRule>, merge?: string): void {
    this.writeRules((this.field().validators ?? []).map((r) => (r.id === rule.id ? { ...r, ...patch } : r)), merge ? `${merge}:${rule.id}` : undefined);
  }

  protected toggleWhen(rule: UiFbValidatorRule, on: boolean): void {
    this.patch(rule, { when: on ? { match: 'all', conditions: [] } : undefined });
  }

  protected param(rule: UiFbValidatorRule, p: UiFbParamSpec): string {
    const v = rule.params?.[p.key] ?? p.default;
    return v == null ? '' : String(v);
  }

  protected num(rule: UiFbValidatorRule, p: UiFbParamSpec): number | null {
    const v = rule.params?.[p.key];
    return typeof v === 'number' ? v : v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
  }

  protected setParam(rule: UiFbValidatorRule, key: string, value: unknown): void {
    this.patch(rule, { params: { ...(rule.params ?? {}), [key]: value } }, `p:${key}`);
  }

  protected dateMode(rule: UiFbValidatorRule, p: UiFbParamSpec): 'today' | 'offset' | 'date' {
    const v = this.param(rule, p);
    if (!v || /^today$/i.test(v.trim())) return 'today';
    return /^today/i.test(v) ? 'offset' : 'date';
  }

  protected dateOffset(rule: UiFbValidatorRule, p: UiFbParamSpec): number {
    const m = /^today\s*([+-]\s*\d+)/i.exec(this.param(rule, p));
    return m ? Number(m[1].replace(/\s/g, '')) : 0;
  }

  protected dateFixed(rule: UiFbValidatorRule, p: UiFbParamSpec): string | null {
    const v = this.param(rule, p);
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  }

  protected setDateMode(rule: UiFbValidatorRule, key: string, mode: string): void {
    this.setParam(rule, key, mode === 'today' ? 'today' : mode === 'offset' ? 'today+7' : '');
  }

  /** Questions a "compare with" check can point at: same kind of answer by default. */
  protected fieldChoices(p: UiFbParamSpec) {
    const f = this.field();
    const kinds = p.fieldKinds ?? [valueKindOf(f.type, f.props?.format)];
    return this.store.refOptions(f.id).filter((o) => (kinds as string[]).includes(o.kind));
  }

  /** The default message with this rule's settings filled in. */
  protected preview(rule: UiFbValidatorRule, d: UiFbValidatorDef): string {
    const vars: Record<string, unknown> = { label: this.field().label || 'This field' };
    for (const p of d.params ?? []) {
      const v = rule.params?.[p.key] ?? p.default;
      vars[p.key] = p.kind === 'field' ? `“${this.store.name(String(v ?? ''))}”` : p.kind === 'date' ? describeDateParam(v) : p.key === 'comparison' ? comparisonWords(v) : v;
    }
    return formatMessage(d.defaultMessage, vars);
  }
}

// ── Calculations ──────────────────────────────────────────────────────────

/**
 * `ui-fb-calc` — how a calculated field works its value out: an operation
 * and its inputs (other answers or fixed numbers).
 */
@Component({
  selector: 'ui-fb-calc',
  imports: [FormsModule, HugeiconsIconComponent, UiInput, UiNumberInput],
  template: `
    @let c = calc();
    @let info = opInfo();
    <div class="fb-stack tight">
      <label>
        <span class="fb-label">Work out</span>
        <select class="fb-native-select" (change)="setOp($any($event.target).value)">
          @for (o of ops; track o.op) { <option [value]="o.op" [selected]="o.op === c.op">{{ o.label }}</option> }
        </select>
      </label>
      <p class="fb-hint">{{ info.hint }}</p>
      <span class="fb-label">Using</span>
      <ul class="args" role="list">
        @for (a of c.args; track $index; let i = $index) {
          <li class="arg">
            <select class="fb-native-select" (change)="setArgSource(i, $any($event.target).value)" [attr.aria-label]="'Input ' + (i + 1)">
              <option value="__const" [selected]="!isRef(a)">{{ info.text ? 'Fixed text' : 'A fixed number' }}</option>
              @for (o of choices(); track o.id) { <option [value]="o.id" [selected]="isRef(a) && refOf(a) === o.id">{{ o.label }}</option> }
            </select>
            @if (!isRef(a)) {
              @if (info.text) {
                <label class="const"><span class="fb-sr">Text</span><ui-input [ngModel]="constOf(a)" (ngModelChange)="setConst(i, $event)" placeholder="Text" /></label>
              } @else {
                <ui-number-input class="const" [ngModel]="constNum(a)" (ngModelChange)="setConst(i, $event)" ariaLabel="Number" />
              }
            }
            <button type="button" class="fb-icon-btn danger" (click)="removeArg(i)" aria-label="Remove input">
              <hugeicons-icon aria-hidden="true" [icon]="removeIcon" [size]="14" [strokeWidth]="1.8" />
            </button>
          </li>
        }
      </ul>
      @if (!info.arity || c.args.length < info.arity) {
        <button type="button" class="fb-link" (click)="addArg()"><hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="13" [strokeWidth]="2" /> Add an input</button>
      }
      @if (!info.text && !info.dates && c.op !== 'count') {
        <label>
          <span class="fb-label">Round to</span>
          <select class="fb-native-select" (change)="setDecimals($any($event.target).value)">
            <option value="" [selected]="c.decimals == null">Don’t round</option>
            @for (d of [0, 1, 2, 3, 4]; track d) { <option [value]="d" [selected]="c.decimals === d">{{ d === 0 ? 'Whole number' : d + ' decimal place' + (d > 1 ? 's' : '') }}</option> }
          </select>
        </label>
      }
      <p class="sentence">= {{ store.describeCalc(field()) }}</p>
    </div>
  `,
  styles: [FB_SHARED_STYLES, `
    .tight { gap: var(--ui-space-2); }
    label { display: flex; flex-direction: column; }
    .args { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .arg { display: flex; align-items: center; gap: 4px; }
    .arg select { flex: 1; }
    .const { width: 110px; flex: none; }
    .fb-link { display: inline-flex; align-items: center; gap: 3px; align-self: flex-start; }
    .sentence { margin: 0; padding: 6px var(--ui-space-2); border-radius: var(--ui-radius-xs); background: var(--ui-color-surface-hover); font-size: 12px; color: var(--ui-color-text-secondary); }
  `],
})
export class FbCalcEditor {
  protected readonly store = inject(FbBuilderStore);
  readonly field = input.required<UiFbField>();

  protected readonly addIcon = FB_ICONS.Add01Icon;
  protected readonly removeIcon = FB_ICONS.Cancel01Icon;
  protected readonly ops = UI_FB_CALC_OPS;
  protected readonly calc = computed<UiFbCalc>(() => this.field().calc ?? { op: 'sum', args: [] });
  protected readonly opInfo = computed(() => calcOpInfo(this.calc().op));

  /**
   * Answers a calculation can use. Fields inside a repeating section are
   * allowed from outside it: they combine every entry (e.g. a total).
   */
  protected readonly choices = computed(() => {
    const me = this.field();
    const myRepeat = this.store.index().get(me.id)?.repeat ?? null;
    const info = this.opInfo();
    const out: { id: string; label: string }[] = [];
    for (const e of this.store.index().values()) {
      if (e.id === me.id || e.kind === 'page' || e.kind === 'static') continue;
      if (e.repeat && myRepeat && e.repeat.id !== myRepeat.id) continue;
      if (e.kind === 'group') {
        const g = e.element as UiFbGroup;
        if (g.repeat && this.calc().op === 'count') out.push({ id: g.id, label: `${g.title || 'Repeating section'} (entries)` });
        continue;
      }
      const f = e.element as UiFbField;
      if (f.archived) continue;
      const kind = valueKindOf(f.type, f.props?.format);
      const ok = this.calc().op === 'count' ? true : info.dates ? kind === 'date' : info.text ? true : kind === 'number' || kind === 'boolean';
      if (!ok) continue;
      out.push({ id: f.id, label: (f.label || f.key) + (e.repeat && !myRepeat ? ' (each entry)' : '') });
    }
    return out;
  });

  private write(c: UiFbCalc): void {
    this.store.updateField(this.field().id, { calc: c }, `calc:${this.field().id}`);
  }

  protected isRef(a: UiFbCalcArg): boolean { return 'ref' in a; }
  protected refOf(a: UiFbCalcArg): string { return 'ref' in a ? a.ref : ''; }
  protected constOf(a: UiFbCalcArg): string { return 'const' in a ? String(a.const ?? '') : ''; }
  protected constNum(a: UiFbCalcArg): number | null { return 'const' in a && typeof a.const === 'number' ? a.const : null; }

  protected setOp(op: UiFbCalcOp): void {
    const info = calcOpInfo(op);
    const c = this.calc();
    const props = { ...(this.field().props ?? {}) };
    props.format = info.text ? 'text' : props.format === 'text' ? 'number' : props.format ?? 'number';
    this.store.updateField(this.field().id, { calc: { ...c, op, args: info.arity ? c.args.slice(0, info.arity) : c.args }, props });
  }

  protected addArg(): void {
    const first = this.choices()[0];
    this.write({ ...this.calc(), args: [...this.calc().args, first ? { ref: first.id } : { const: 0 }] });
  }

  protected removeArg(i: number): void {
    this.write({ ...this.calc(), args: this.calc().args.filter((_, j) => j !== i) });
  }

  protected setArgSource(i: number, v: string): void {
    const args = [...this.calc().args];
    args[i] = v === '__const' ? { const: this.opInfo().text ? '' : 0 } : { ref: v };
    this.write({ ...this.calc(), args });
  }

  protected setConst(i: number, v: unknown): void {
    const args = [...this.calc().args];
    args[i] = { const: (v ?? (this.opInfo().text ? '' : 0)) as number | string };
    this.write({ ...this.calc(), args });
  }

  protected setDecimals(v: string): void {
    this.write({ ...this.calc(), decimals: v === '' ? undefined : Number(v) });
  }
}
