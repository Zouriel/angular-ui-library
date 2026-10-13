import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiMultiSelect } from '@zouriel/ui/combobox';
import { UiDatePicker } from '@zouriel/ui/datepicker';
import { UiInput, UiNumberInput, UiTimePicker } from '@zouriel/ui/form';
import { FbBuilderStore, type UiFbRefOption } from './builder-store';
import { FB_SHARED_STYLES } from './builder-styles';
import { operatorInfo, operatorsFor, type UiFbValueKind } from './field-types';
import type { UiFbCondition, UiFbConditionGroup, UiFbConditionRule, UiFbOperand, UiFbOperator } from './schema';
import { FB_ICONS } from './builder-icons';
import { UiFbSourcePicker } from './source-picker';

type Kind = UiFbRefOption['kind'];

/** Turns any condition into a group, so the editor always edits "match + list". */
export function asGroup(c: UiFbCondition | undefined): UiFbConditionGroup {
  if (!c) return { match: 'all', conditions: [] };
  return 'conditions' in c ? c : { match: 'all', conditions: [c] };
}

/** Unwraps a one-rule "all" group back to the rule, keeping stored JSON small. */
export function tidy(g: UiFbConditionGroup): UiFbCondition {
  return g.match === 'all' && g.conditions.length === 1 && !('conditions' in g.conditions[0]) ? g.conditions[0] : g;
}

/**
 * `ui-fb-value` — the right-hand side of a rule, shaped by what's being
 * compared: an option list for choices, a date picker (or "today ± days") for
 * dates, a number box for counts, or another question's answer.
 */
@Component({
  selector: 'ui-fb-value',
  imports: [FormsModule, UiInput, UiNumberInput, UiDatePicker, UiTimePicker, UiMultiSelect, UiFbSourcePicker],
  template: `
    @if (sources().length > 1) {
      <select class="fb-native-select src" (change)="setSource($any($event.target).value)" aria-label="Compare with">
        @for (s of sources(); track s.value) { <option [value]="s.value" [selected]="s.value === source()">{{ s.label }}</option> }
      </select>
    }
    @switch (source()) {
      @case ('ref') {
        <select class="fb-native-select" (change)="emit({ ref: $any($event.target).value })" aria-label="Other answer">
          <option value="" disabled [selected]="!refId()">Choose an answer…</option>
          @for (r of comparable(); track r.id) { <option [value]="r.id" [selected]="r.id === refId()">{{ r.label }}</option> }
        </select>
      }
      @case ('today') {
        <div class="today">
          <ui-number-input [ngModel]="todayOffset()" (ngModelChange)="emit({ today: $event ?? 0 })" [step]="1" ariaLabel="Days from today" />
          <span class="unit">days from today</span>
        </div>
        <p class="fb-hint">0 is today, 7 is a week from now, -7 a week ago.</p>
      }
      @default {
        @if (count()) {
          <ui-number-input [ngModel]="constNum()" (ngModelChange)="emit({ const: $event })" [min]="0" [step]="1" ariaLabel="How many" />
        } @else if (sourceDef(); as sd) {
          <!-- A sourced question: search the same list; the rule keeps { value, label } so it reads well later. -->
          @for (p of refParams(); track p.key) {
            <!-- Its list follows another answer, which a rule doesn't have: pick one to browse with (not saved). -->
            <div class="fb-row with">
              <span class="with-lbl">From {{ p.label.toLowerCase() }}</span>
              @if (p.options?.length) {
                <select class="fb-native-select grow" (change)="setBrowse(p.key, $any($event.target).value)" [attr.aria-label]="'Browse ' + sd.label + ' for ' + p.label">
                  <option value="" [selected]="!browse()[p.key]">Choose…</option>
                  @for (o of p.options!; track o.value) { <option [value]="o.value" [selected]="o.value === browse()[p.key]">{{ o.label }}</option> }
                </select>
              } @else {
                <label class="lw grow"><span class="fb-sr">Browse with {{ p.label }}</span>
                  <ui-input size="sm" [ngModel]="browse()[p.key] ?? ''" (ngModelChange)="setBrowse(p.key, $event)" placeholder="A value" /></label>
              }
            </div>
          }
          <ui-fb-source-picker [source]="sd" [params]="sourceParams()" [multiple]="multi()" [value]="constRaw()"
            (valueChange)="emit({ const: $event })" [ariaLabel]="label()" [placeholder]="'Search ' + sd.label.toLowerCase() + '…'" />
        } @else if (options().length && multi()) {
          <label class="lw"><span class="fb-sr">{{ label() }}</span>
            <ui-multi-select [options]="options()" [ngModel]="constList()" (ngModelChange)="emit({ const: $event })" placeholder="Choose options…" /></label>
        } @else if (options().length) {
          <select class="fb-native-select" (change)="emit({ const: $any($event.target).value })" [attr.aria-label]="label()">
            <option value="" disabled [selected]="!constText()">Choose…</option>
            @for (op of options(); track op.value) { <option [value]="op.value" [selected]="op.value === constText()">{{ op.label }}</option> }
          </select>
        } @else {
          @switch (kind()) {
            @case ('boolean') {
              <select class="fb-native-select" (change)="emit({ const: $any($event.target).value === 'true' })" [attr.aria-label]="label()">
                <option value="" disabled [selected]="constText() === ''">Choose…</option>
                <option value="true" [selected]="constText() === 'true'">Ticked (yes)</option>
                <option value="false" [selected]="constText() === 'false'">Not ticked (no)</option>
              </select>
            }
            @case ('number') { <ui-number-input [ngModel]="constNum()" (ngModelChange)="emit({ const: $event })" [ariaLabel]="label()" /> }
            @case ('date') { <label class="lw"><span class="fb-sr">{{ label() }}</span><ui-date-picker [ngModel]="constText() || null" (ngModelChange)="emit({ const: $event })" /></label> }
            @case ('time') { <label class="lw"><span class="fb-sr">{{ label() }}</span><ui-time-picker [ngModel]="constText()" (ngModelChange)="emit({ const: $event })" /></label> }
            @default { <label class="lw"><span class="fb-sr">{{ label() }}</span><ui-input [ngModel]="constText()" (ngModelChange)="emit({ const: $event })" placeholder="Value" /></label> }
          }
        }
      }
    }
  `,
  styles: [FB_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .today { display: flex; align-items: center; gap: var(--ui-space-2); }
    .today ui-number-input { width: 96px; flex: none; }
    .unit { font-size: 12px; color: var(--ui-color-text-secondary); }
    .with { gap: var(--ui-space-2); }
    .with-lbl { flex: none; font-size: 12px; color: var(--ui-color-text-secondary); }
    .grow { flex: 1; min-width: 0; }
  `],
})
export class FbValueInput {
  private readonly store = inject(FbBuilderStore);

  /** What's being asked about (the rule's subject). */
  readonly subject = input<UiFbRefOption | null>(null);
  readonly op = input<UiFbOperator>('eq');
  readonly operand = input<UiFbOperand | undefined>(undefined);
  /** The element the rule lives on (its own answer can't be compared with itself). */
  readonly forId = input<string | null>(null);
  /** What the value is, for screen readers ("Value", "Starts with"…). */
  readonly label = input('Value');
  /** Only fixed values (e.g. a default answer), never "another answer". */
  readonly constOnly = input(false);
  readonly operandChange = output<UiFbOperand>();

  protected readonly kind = computed(() => this.subject()?.kind ?? 'text');
  protected readonly count = computed(() => !!operatorInfo(this.op()).countValue);
  protected readonly multi = computed(() => !!operatorInfo(this.op()).multiValue);
  protected readonly options = computed(() => {
    const s = this.subject();
    const f = s ? this.store.field(s.id) : null;
    return (f?.options ?? []).filter((o) => !o.archived).map((o) => ({ label: o.label, value: o.value }));
  });

  /** The list the subject searches, when its options come from a data source. */
  protected readonly sourceDef = computed(() => {
    const s = this.subject();
    const f = s ? this.store.field(s.id) : null;
    return f?.source ? this.store.optionSourceDefs().find((d) => d.type === f.source!.type) : undefined;
  });
  /** Its settings: fixed ones as set, ones that follow another answer from the browse choice below. */
  protected readonly sourceParams = computed(() => {
    const s = this.subject();
    const f = s ? this.store.field(s.id) : null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f?.source?.params ?? {})) out[k] = 'const' in v ? v.const : this.browse()[k];
    return out;
  });
  /** Settings of the subject's list that follow another answer. */
  protected readonly refParams = computed(() => {
    const s = this.subject();
    const params = (s ? this.store.field(s.id)?.source?.params : undefined) ?? {};
    return (this.sourceDef()?.params ?? []).filter((p) => { const v = params[p.key]; return !!v && 'ref' in v; });
  });
  /** What to browse the list with, for those settings. Only for picking here; not saved. */
  protected readonly browse = signal<Record<string, unknown>>({});
  protected setBrowse(key: string, value: unknown): void {
    this.browse.update((b) => ({ ...b, [key]: value === '' ? undefined : value }));
  }
  protected readonly constRaw = computed(() => { const o = this.operand(); return o && 'const' in o ? o.const : null; });

  protected readonly sources = computed(() => {
    const out = [{ value: 'const', label: 'a value' }];
    const k = this.kind();
    if (this.constOnly() || this.count() || this.multi() || !['text', 'number', 'date', 'time'].includes(k)) return out;
    if (this.comparable().length) out.push({ value: 'ref', label: 'another answer' });
    if (k === 'date') out.push({ value: 'today', label: 'a date from today' });
    return out;
  });

  protected readonly source = computed(() => {
    const o = this.operand();
    return o && 'ref' in o ? 'ref' : o && 'today' in o ? 'today' : 'const';
  });

  /** Other answers of the same kind (for "end date is after start date"). */
  protected readonly comparable = computed(() => {
    const s = this.subject();
    return this.store.refOptions(this.forId()).filter((r) => r.kind === s?.kind && r.id !== s?.id);
  });

  protected readonly refId = computed(() => { const o = this.operand(); return o && 'ref' in o ? o.ref : ''; });
  protected readonly todayOffset = computed(() => { const o = this.operand(); return o && 'today' in o ? o.today : 0; });
  protected readonly constText = computed(() => { const o = this.operand(); return o && 'const' in o && o.const != null ? String(o.const) : ''; });
  protected readonly constNum = computed(() => { const o = this.operand(); return o && 'const' in o && typeof o.const === 'number' ? o.const : null; });
  protected readonly constList = computed(() => { const o = this.operand(); return o && 'const' in o && Array.isArray(o.const) ? (o.const as string[]) : []; });

  protected setSource(s: string): void {
    this.emit(s === 'ref' ? { ref: '' } : s === 'today' ? { today: 0 } : { const: '' });
  }

  protected emit(o: UiFbOperand): void {
    this.operandChange.emit(o);
  }
}

/**
 * `ui-fb-condition` — builds "when …" rules as sentences: pick a question,
 * how to compare, and a value. Rules combine with all/any, and one level of
 * nested groups covers "A and (B or C)".
 */
@Component({
  selector: 'ui-fb-condition',
  imports: [HugeiconsIconComponent, FbValueInput],
  template: `
    @let g = group();
    <div class="cond" [class.nested]="nested()">
      @if (g.conditions.length > 1 || nested()) {
        <div class="match">
          <select class="fb-native-select" (change)="setMatch($any($event.target).value)" aria-label="How to combine these rules">
            <option value="all" [selected]="g.match === 'all'">All of these</option>
            <option value="any" [selected]="g.match === 'any'">Any of these</option>
            <option value="none" [selected]="g.match === 'none'">None of these</option>
          </select>
          @if (nested()) {
            <button type="button" class="fb-icon-btn danger" aria-label="Remove this group" (click)="removed.emit()">
              <hugeicons-icon aria-hidden="true" [icon]="removeIcon" [size]="14" [strokeWidth]="1.8" />
            </button>
          }
        </div>
      }
      @for (c of g.conditions; track $index; let i = $index) {
        @if (isGroup(c)) {
          <ui-fb-condition [condition]="c" [forId]="forId()" [nested]="true" (conditionChange)="replace(i, $event)" (removed)="remove(i)" />
        } @else {
          @let rule = asRule(c);
          @let subj = subjectOf(rule.ref);
          <div class="rule" [class.unfinished]="!rule.ref">
            @if (i > 0) { <span class="joiner">{{ g.match === 'any' ? 'or' : g.match === 'none' ? 'nor' : 'and' }}</span> }
            <div class="rule-row">
              <select class="fb-native-select" (change)="setRef(i, $any($event.target).value)" aria-label="Question">
                <option value="" disabled [selected]="!rule.ref">Choose a question…</option>
                @for (o of options(); track o.id) {
                  <option [value]="o.id" [selected]="o.id === rule.ref">{{ o.label }}{{ o.kind === 'group' || o.kind === 'repeat' ? ' (section)' : o.kind === 'page' ? ' (page)' : '' }}</option>
                }
                @if (rule.ref && !subj) { <option [value]="rule.ref" selected>Deleted question</option> }
              </select>
              <button type="button" class="fb-icon-btn danger" aria-label="Remove this rule" (click)="remove(i)">
                <hugeicons-icon aria-hidden="true" [icon]="removeIcon" [size]="14" [strokeWidth]="1.8" />
              </button>
            </div>
            @if (subj) {
              <select class="fb-native-select" (change)="setOp(i, $any($event.target).value)" aria-label="Comparison">
                @for (op of opsFor(subj.kind); track op.op) { <option [value]="op.op" [selected]="op.op === rule.op">{{ op.label.replace(' … ', ' N ').replace('…', 'N') }}</option> }
              </select>
              @if (arity(rule.op) >= 1) {
                <ui-fb-value [subject]="subj" [op]="rule.op" [operand]="rule.value" [forId]="forId()" (operandChange)="setValue(i, 'value', $event)" />
              }
              @if (arity(rule.op) === 2) {
                <span class="joiner">and</span>
                <ui-fb-value [subject]="subj" [op]="rule.op" [operand]="rule.value2" [forId]="forId()" (operandChange)="setValue(i, 'value2', $event)" />
              }
            }
          </div>
        }
      }
      <div class="adds">
        <button type="button" class="fb-link" (click)="addRule()"><hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="13" [strokeWidth]="2" /> Add rule</button>
        @if (!nested() && g.conditions.length) {
          <button type="button" class="fb-link" (click)="addGroup()"><hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="13" [strokeWidth]="2" /> Add a group of rules</button>
        }
      </div>
      @if (!options().length) { <p class="fb-hint">Add other questions to the form first. Rules compare with other answers.</p> }
    </div>
  `,
  styles: [FB_SHARED_STYLES, `
    :host { display: block; }
    .cond { display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .cond.nested { padding: var(--ui-space-2); border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius);
      background: color-mix(in srgb, var(--ui-color-surface-hover) 50%, transparent); }
    .match { display: flex; align-items: center; gap: var(--ui-space-2); }
    .match select { width: auto; }
    .rule { display: flex; flex-direction: column; gap: 4px; }
    .rule-row { display: flex; align-items: center; gap: 4px; }
    .rule.unfinished .rule-row select { border-color: color-mix(in srgb, var(--ui-color-warning) 70%, var(--ui-control-border)); }
    .joiner { font-size: 11px; font-weight: 600; color: var(--ui-color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .adds { display: flex; flex-wrap: wrap; gap: var(--ui-space-3); }
    .adds .fb-link { display: inline-flex; align-items: center; gap: 3px; }
  `],
})
export class FbConditionEditor {
  private readonly store = inject(FbBuilderStore);

  readonly condition = input<UiFbCondition | undefined>(undefined);
  /** The element the rule belongs to (decides what it may ask about). */
  readonly forId = input<string | null>(null);
  readonly nested = input(false);
  readonly conditionChange = output<UiFbCondition>();
  readonly removed = output<void>();

  protected readonly addIcon = FB_ICONS.Add01Icon;
  protected readonly removeIcon = FB_ICONS.Cancel01Icon;
  protected readonly group = computed(() => asGroup(this.condition()));
  protected readonly options = computed(() => this.store.refOptions(this.forId()));

  protected subjectOf(id: string): UiFbRefOption | null {
    return this.options().find((o) => o.id === id) ?? null;
  }

  protected opsFor(kind: Kind) {
    return operatorsFor(kind as UiFbValueKind | 'group' | 'repeat' | 'page');
  }

  protected arity(op: UiFbOperator): number {
    return operatorInfo(op).arity;
  }

  protected isGroup(c: UiFbCondition): c is UiFbConditionGroup {
    return 'conditions' in c;
  }

  protected asRule(c: UiFbCondition): UiFbConditionRule {
    return c as UiFbConditionRule;
  }

  private write(conditions: UiFbCondition[], match = this.group().match): void {
    const g: UiFbConditionGroup = { match, conditions };
    this.conditionChange.emit(this.nested() ? g : tidy(g));
  }

  protected setMatch(match: UiFbConditionGroup['match']): void {
    this.write(this.group().conditions, match);
  }

  protected addRule(): void {
    // Start from the question asked about most recently: rules usually share it.
    const prev = [...this.group().conditions].reverse().find((c): c is UiFbConditionRule => !('conditions' in c));
    const first = prev?.ref ? this.subjectOf(prev.ref) : this.options().find((o) => o.kind !== 'page' && o.kind !== 'group');
    const rule: UiFbConditionRule = first ? { ref: first.id, op: this.opsFor(first.kind)[0].op } : { ref: '', op: 'eq' };
    this.write([...this.group().conditions, rule]);
  }

  protected addGroup(): void {
    const first = this.options()[0];
    const rule: UiFbConditionRule = first ? { ref: first.id, op: this.opsFor(first.kind)[0].op } : { ref: '', op: 'eq' };
    this.write([...this.group().conditions, { match: 'any', conditions: [rule] }]);
  }

  protected replace(i: number, c: UiFbCondition): void {
    const list = [...this.group().conditions];
    list[i] = c;
    this.write(list);
  }

  protected remove(i: number): void {
    this.write(this.group().conditions.filter((_, j) => j !== i));
  }

  protected setRef(i: number, ref: string): void {
    const subj = this.subjectOf(ref);
    const old = this.group().conditions[i] as UiFbConditionRule;
    const sameKind = subj && this.subjectOf(old.ref)?.kind === subj.kind;
    const ops = subj ? this.opsFor(subj.kind) : [];
    const op = sameKind && ops.some((o) => o.op === old.op) ? old.op : ops[0]?.op ?? 'eq';
    this.replace(i, { ref, op });
  }

  protected setOp(i: number, op: UiFbOperator): void {
    const old = this.group().conditions[i] as UiFbConditionRule;
    const was = operatorInfo(old.op);
    const now = operatorInfo(op);
    // Keep the value when it still makes sense for the new comparison.
    const keep = now.arity > 0 && !!was.multiValue === !!now.multiValue && !!was.countValue === !!now.countValue;
    this.replace(i, { ref: old.ref, op, ...(keep && old.value ? { value: old.value } : {}), ...(keep && now.arity === 2 && old.value2 ? { value2: old.value2 } : {}) });
  }

  protected setValue(i: number, which: 'value' | 'value2', v: UiFbOperand): void {
    const old = this.group().conditions[i] as UiFbConditionRule;
    this.replace(i, { ...old, [which]: v });
  }
}
