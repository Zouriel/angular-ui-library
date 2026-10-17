import { Component, computed, effect, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton } from '@zouriel/ui/button';
import { UiModal } from '@zouriel/ui/dialog';
import { UiInput, UiNumberInput, UiTokenInput, type UiTokenRun } from '@zouriel/ui/form';
import { UiFormBuilder, createDefinition, operatorInfo, operatorsFor, type UiFbOperator, type UiFormDefinition } from '@zouriel/ui/form-builder';
import type { UiWorkflowApi, UiWfUser } from './api';
import { describeAssignees, optionLabel, tokenLabel, valueKindOfField, type UiWfToken } from './definition';
import { WF_ICONS } from './icons';
import type {
  UiWfAssignee,
  UiWfCondition,
  UiWfConditionGroup,
  UiWfConditionRule,
  UiWfFieldDescriptor,
  UiWfFieldType,
  UiWfOperand,
  UiWfRecipient,
  UiWfTemplate,
  UiWorkflowRegistry,
} from './schema';
import { WF_SHARED_STYLES } from './styles';

// ── Token select ──────────────────────────────────────────────────────────

/** `ui-wf-token-select` — pick a value to read (a field of the record, an earlier step's result…), grouped. */
@Component({
  selector: 'ui-wf-token-select',
  template: `
    <select class="wf-select" [attr.aria-label]="label()" [disabled]="disabled()" (change)="pick($any($event.target).value)">
      <option value="" [selected]="!value()" [disabled]="!allowEmpty()">{{ placeholder() }}</option>
      @for (g of groups(); track g.name) {
        <optgroup [label]="g.name">
          @for (t of g.tokens; track t.path) { <option [value]="t.path" [selected]="t.path === value()">{{ t.label }}</option> }
        </optgroup>
      }
      @if (value() && !known()) { <option [value]="value()" selected>{{ value() }} (not available here)</option> }
    </select>
  `,
  styles: [WF_SHARED_STYLES, `:host { display: block; min-width: 0; }`],
})
export class WfTokenSelect {
  readonly tokens = input<readonly UiWfToken[]>([]);
  readonly value = input<string | null | undefined>(null);
  /** Only offer tokens of these types (`any` tokens always pass). */
  readonly types = input<readonly UiWfFieldType[] | null>(null);
  readonly placeholder = input('Choose a value…');
  readonly label = input('Value');
  readonly allowEmpty = input(false);
  readonly disabled = input(false);
  readonly valueChange = output<string>();

  protected readonly filtered = computed(() => {
    const types = this.types();
    return this.tokens().filter((t) => !types || t.type === 'any' || types.includes(t.type as UiWfFieldType));
  });
  protected readonly groups = computed(() => {
    const m = new Map<string, UiWfToken[]>();
    for (const t of this.filtered()) m.set(t.group, [...(m.get(t.group) ?? []), t]);
    return [...m].map(([name, tokens]) => ({ name, tokens }));
  });
  protected readonly known = computed(() => this.filtered().some((t) => t.path === this.value()));

  protected pick(v: string): void {
    this.valueChange.emit(v);
  }
}

// ── Template ──────────────────────────────────────────────────────────────

function toRuns(t: UiWfTemplate | undefined): UiTokenRun[] {
  if (!t) return [];
  if (typeof t === 'string') return t ? [{ text: t }] : [];
  return t.map((p) => (typeof p === 'string' ? { text: p } : { token: p.ref }));
}

function fromRuns(runs: UiTokenRun[]): UiWfTemplate {
  const parts: (string | { ref: string })[] = [];
  for (const r of runs) {
    if (r.token) parts.push({ ref: r.token });
    else if (r.text) {
      const last = parts[parts.length - 1];
      if (typeof last === 'string') parts[parts.length - 1] = last + r.text;
      else parts.push(r.text);
    }
  }
  if (!parts.length) return '';
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

/**
 * `ui-wf-template` — text with values from the workflow mixed in ("Hello [Applicant], your
 * application [Title] was approved"). Values are chips: pick one from "Insert value" and it lands
 * at the caret.
 */
@Component({
  selector: 'ui-wf-template',
  imports: [FormsModule, UiTokenInput, WfTokenSelect],
  template: `
    <ui-token-input [ngModel]="runs()" (ngModelChange)="change($event)" [multiline]="multiline()" [placeholder]="placeholder()"
      [label]="label()" [tokenLabel]="labelOf" [minHeight]="multiline() ? '84px' : null" />
    <ui-wf-token-select class="insert" [tokens]="tokens()" [value]="null" placeholder="Insert a value…" label="Insert a value" (valueChange)="insert($event)" />
  `,
  styles: [WF_SHARED_STYLES, `:host { display: flex; flex-direction: column; gap: 4px; min-width: 0; } .insert { max-width: 260px; }`],
})
export class WfTemplateEditor {
  private readonly editor = viewChild(UiTokenInput);
  readonly tokens = input<readonly UiWfToken[]>([]);
  readonly value = input<UiWfTemplate | undefined>('');
  readonly multiline = input(true);
  readonly placeholder = input('');
  readonly label = input('Text');
  readonly valueChange = output<UiWfTemplate>();
  protected readonly runs = computed(() => toRuns(this.value()));
  protected readonly labelOf = (path: string) => tokenLabel(this.tokens(), path);

  protected change(runs: UiTokenRun[]): void {
    const next = fromRuns(runs);
    if (JSON.stringify(next) !== JSON.stringify(this.value() ?? '')) this.valueChange.emit(next);
  }

  protected insert(path: string): void {
    const ed = this.editor();
    if (ed) ed.insertToken(path);
    else this.valueChange.emit(fromRuns([...this.runs(), { token: path }]));
  }
}

// ── Duration ──────────────────────────────────────────────────────────────

type Unit = 'M' | 'H' | 'D' | 'W' | 'Mo';
const UNITS: { value: Unit; label: string }[] = [
  { value: 'M', label: 'minutes' }, { value: 'H', label: 'hours' }, { value: 'D', label: 'days' }, { value: 'W', label: 'weeks' }, { value: 'Mo', label: 'months' },
];

/**
 * Reads an ISO duration as one number and unit (`P3D` → 3 days). Durations written with several
 * parts elsewhere become their total in the largest unit that keeps them exact (`P1DT12H` → 36
 * hours); null when that's impossible (months mixed with days) or it isn't a duration.
 */
export function parseSimpleDuration(iso: string | undefined | null): { n: number; unit: Unit; negative: boolean } | null {
  const m = /^(-)?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? '');
  if (!m || iso === 'P' || iso === '-P' || /T$/.test(iso ?? '')) return null;
  const negative = !!m[1];
  const [y, mo, w, d, h, mi, sec] = m.slice(2).map((x) => +(x ?? 0));
  const months = y * 12 + mo;
  const minutes = ((w * 7 + d) * 24 + h) * 60 + mi + Math.round(sec / 60);
  if (months && minutes) return null;
  if (months) return { n: months, unit: 'Mo', negative };
  if (w && !d && !h && !mi && !sec) return { n: w, unit: 'W', negative };
  if (minutes % 1440 === 0) return { n: minutes / 1440, unit: 'D', negative };
  if (minutes % 60 === 0) return { n: minutes / 60, unit: 'H', negative };
  return { n: minutes, unit: 'M', negative };
}

/** The most of each unit a duration may hold (the engines refuse more than 50 years). */
const UNIT_MAX: Record<Unit, number> = { Mo: 600, W: 2600, D: 18250, H: 438000, M: 26280000 };

export function formatSimpleDuration(n: number, unit: Unit, negative = false): string {
  const v = Math.min(UNIT_MAX[unit], Math.max(0, Math.round(n)));
  const body = unit === 'Mo' ? `P${v}M` : unit === 'W' ? `P${v}W` : unit === 'D' ? `P${v}D` : unit === 'H' ? `PT${v}H` : `PT${v}M`;
  return (negative ? '-' : '') + body;
}

/** `ui-wf-duration` — "3 days", "4 hours", stored as an ISO 8601 duration. `signed` adds before/after. */
@Component({
  selector: 'ui-wf-duration',
  imports: [FormsModule, UiNumberInput],
  template: `
    <ui-number-input [ngModel]="parts().n" (ngModelChange)="set($event ?? 0, parts().unit, parts().negative)" [min]="0" [max]="unitMax[parts().unit]" [step]="1" [ariaLabel]="label() + ' amount'" size="sm" />
    <select class="wf-select unit" [attr.aria-label]="label() + ' unit'" (change)="set(parts().n, $any($event.target).value, parts().negative)">
      @for (u of units; track u.value) { <option [value]="u.value" [selected]="u.value === parts().unit">{{ u.label }}</option> }
    </select>
    @if (signed()) {
      <select class="wf-select dir" [attr.aria-label]="label() + ' direction'" (change)="set(parts().n, parts().unit, $any($event.target).value === 'before')">
        <option value="before" [selected]="parts().negative">before</option>
        <option value="after" [selected]="!parts().negative">after</option>
      </select>
    }
  `,
  styles: [WF_SHARED_STYLES, `
    /* The unit select keeps room for its longest word ("minutes", "months"). */
    :host { display: grid; grid-template-columns: minmax(64px, 96px) minmax(88px, 1fr); gap: 6px; align-items: center; min-width: 0; }
    :host(.signed) { grid-template-columns: minmax(64px, 88px) minmax(88px, 1fr) minmax(76px, 0.9fr); }
    .wf-select { height: var(--ui-size-sm); }
  `],
  host: { '[class.signed]': 'signed()' },
})
export class WfDurationInput {
  readonly value = input<string | undefined>('P1D');
  readonly label = input('Duration');
  readonly signed = input(false);
  readonly valueChange = output<string>();
  protected readonly units = UNITS;
  protected readonly unitMax = UNIT_MAX;
  protected readonly parts = computed(() => parseSimpleDuration(this.value()) ?? { n: 1, unit: 'D' as Unit, negative: false });

  protected set(n: number, unit: Unit, negative: boolean): void {
    this.valueChange.emit(formatSimpleDuration(n, unit, negative));
  }
}

// ── People ────────────────────────────────────────────────────────────────

/**
 * `ui-wf-assignees` — who a task is for, who may apply a transition, or who gets a message: roles,
 * groups, people, a person stored on the record, someone's manager, or whoever started the run.
 */
@Component({
  selector: 'ui-wf-assignees',
  imports: [FormsModule, HugeiconsIconComponent, UiInput],
  template: `
    @if (value().length) {
      <ul class="chips" role="list">
        @for (a of value(); track $index) {
          <li class="wf-chip person">{{ describe(a) }}
            <button type="button" class="x" (click)="remove($index)" [attr.aria-label]="'Remove ' + describe(a)">
              <hugeicons-icon aria-hidden="true" [icon]="icons.Cancel01Icon" [size]="11" [strokeWidth]="2" />
            </button>
          </li>
        }
      </ul>
    } @else if (emptyText()) {
      <p class="wf-hint">{{ emptyText() }}</p>
    }
    <div class="add">
      <select class="wf-select" [attr.aria-label]="'Add to ' + label()" (change)="add($any($event.target)); $any($event.target).value = ''">
        <option value="" selected>Add…</option>
        @if (registry()?.roles?.length) {
          <optgroup label="Everyone with a role">@for (r of registry()!.roles!; track r.key) { <option [value]="'role:' + r.key">{{ r.label }}</option> }</optgroup>
        }
        @if (registry()?.groups?.length) {
          <optgroup label="A group">@for (g of registry()!.groups!; track g.key) { <option [value]="'group:' + g.key">{{ g.label }}</option> }</optgroup>
        }
        @if (userTokens().length) {
          <optgroup label="A person on the record">@for (t of userTokens(); track t.path) { <option [value]="'field:' + t.path">{{ t.group }} › {{ t.label }}</option> }</optgroup>
        }
        <optgroup label="Other">
          <option value="initiator">Whoever started it</option>
          <option value="managerOf:initiator">The manager of whoever started it</option>
          @if (allowManagerOfAssignees()) { <option value="managerOf:assignees">Their managers</option> }
          @for (t of userTokens(); track t.path) { <option [value]="'managerOf:' + t.path">Manager of {{ t.label }}</option> }
          @if (api()) { <option value="person">A specific person…</option> }
          @if (allowEmail()) { <option value="email">An email address…</option> }
        </optgroup>
      </select>
    </div>
    @if (searching()) {
      <div class="search">
        <ui-input size="sm" placeholder="Search people by name" [ngModel]="query()" (ngModelChange)="search($event)" aria-label="Search people" />
        @if (results().length) {
          <ul class="results" role="listbox" aria-label="People">
            @for (u of results(); track u.id) {
              <li><button type="button" role="option" (click)="pickUser(u)">{{ u.name }}<span class="muted">{{ u.email ?? u.id }}</span></button></li>
            }
          </ul>
        } @else if (query()) {
          <p class="wf-hint">Nobody found.</p>
        }
      </div>
    }
    @if (emailing()) {
      <div class="search">
        <ui-input size="sm" type="email" placeholder="name@example.com" [ngModel]="email()" (ngModelChange)="email.set($event)" (keydown.enter)="addEmail()" aria-label="Email address" />
        <button type="button" class="wf-link" (click)="addEmail()">Add</button>
      </div>
    }
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 0; padding: 0; list-style: none; }
    .person { height: 22px; padding-right: 2px; font-size: 12px; color: var(--ui-color-text); }
    .x { display: inline-grid; place-items: center; width: 18px; height: 18px; border: 0; padding: 0; border-radius: 3px; background: transparent; color: var(--ui-color-text-muted); cursor: pointer; }
    .x:hover { color: var(--ui-color-danger); background: color-mix(in srgb, var(--ui-color-danger) 12%, transparent); }
    .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    /* Touch: a 44px target around the small cross; the gaps grow so neighbouring targets never overlap
       (22px chip + 22px row gap, 18px cross + 13px each side within a 14px column gap). */
    @media (pointer: coarse) {
      .chips { gap: 22px 14px; padding: 11px 0; }
      .x { position: relative; }
      .x::after { content: ''; position: absolute; left: 50%; top: 50%; width: var(--ui-size-touch); height: var(--ui-size-touch); transform: translate(-50%, -50%); }
    }
    .search { display: flex; flex-direction: column; gap: 4px; }
    .results { margin: 0; padding: 2px; list-style: none; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); max-height: 180px; overflow: auto; }
    .results button { display: flex; justify-content: space-between; gap: 8px; width: 100%; padding: 5px 8px; border: 0; border-radius: var(--ui-radius-xs); background: transparent; color: var(--ui-color-text); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
    .results button:hover, .results button:focus-visible { background: var(--ui-color-surface-hover); outline: none; }
    .muted { color: var(--ui-color-text-muted); font-size: 12px; }
  `],
})
export class WfAssigneesEditor {
  readonly value = input<readonly (UiWfAssignee | UiWfRecipient)[]>([]);
  readonly registry = input<UiWorkflowRegistry | null>(null);
  readonly tokens = input<readonly UiWfToken[]>([]);
  readonly api = input<UiWorkflowApi | null>(null);
  readonly label = input('people');
  readonly emptyText = input('');
  readonly allowEmail = input(false);
  readonly allowManagerOfAssignees = input(false);
  readonly valueChange = output<(UiWfAssignee | UiWfRecipient)[]>();
  protected readonly icons = WF_ICONS;
  protected readonly searching = signal(false);
  protected readonly emailing = signal(false);
  protected readonly query = signal('');
  protected readonly email = signal('');
  protected readonly results = signal<UiWfUser[]>([]);
  private readonly names = signal<Record<string, string>>({});
  protected readonly userTokens = computed(() => this.tokens().filter((t) => t.type === 'user' && !t.path.startsWith('steps.')));
  private searchSeq = 0;

  constructor() {
    // Show people by name, not id.
    effect(() => {
      const api = this.api();
      const ids = this.value().filter((a): a is { user: string } => 'user' in a).map((a) => a.user);
      const known = untracked(this.names);
      for (const id of ids) {
        if (known[id] || !api) continue;
        api.user(id).then((u) => u && this.names.update((n) => ({ ...n, [id]: u.name }))).catch(() => undefined);
      }
    });
  }

  protected describe(a: UiWfAssignee | UiWfRecipient): string {
    return describeAssignees([a], { registry: this.registry(), def: { specVersion: 1, id: '', key: '', kind: 'automation', title: '' }, tokens: this.tokens(), userName: (id) => this.names()[id] });
  }

  protected add(select: HTMLSelectElement): void {
    const v = select.value;
    if (!v) return;
    if (v === 'person') { this.searching.set(true); this.emailing.set(false); return; }
    if (v === 'email') { this.emailing.set(true); this.searching.set(false); return; }
    const [kind, ...rest] = v.split(':');
    const key = rest.join(':');
    const next: UiWfAssignee | UiWfRecipient =
      kind === 'role' ? { role: key } : kind === 'group' ? { group: key } : kind === 'field' ? { field: key } : kind === 'managerOf' ? { managerOf: key } : { initiator: true };
    this.push(next);
  }

  private push(a: UiWfAssignee | UiWfRecipient): void {
    const json = JSON.stringify(a);
    if (this.value().some((x) => JSON.stringify(x) === json)) return;
    this.valueChange.emit([...this.value(), a]);
  }

  protected remove(i: number): void {
    this.valueChange.emit(this.value().filter((_, j) => j !== i));
  }

  protected search(q: string): void {
    this.query.set(q);
    const api = this.api();
    const n = ++this.searchSeq;
    if (!api || !q.trim()) { this.results.set([]); return; }
    api.searchUsers(q.trim(), 10).then((r) => { if (n === this.searchSeq) this.results.set(r); }).catch(() => this.results.set([]));
  }

  protected pickUser(u: UiWfUser): void {
    this.names.update((n) => ({ ...n, [u.id]: u.name }));
    this.push({ user: u.id });
    this.searching.set(false);
    this.query.set('');
    this.results.set([]);
  }

  protected addEmail(): void {
    const e = this.email().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return;
    this.push({ email: e });
    this.email.set('');
    this.emailing.set(false);
  }
}

// ── Values ────────────────────────────────────────────────────────────────

/** A typed input for one constant value of a registry field. */
@Component({
  selector: 'ui-wf-value-input',
  imports: [FormsModule, UiInput, UiNumberInput],
  template: `
    @switch (kind()) {
      @case ('enum') {
        <select class="wf-select" [attr.aria-label]="label()" (change)="emit($any($event.target).value)">
          <option value="" [selected]="value() == null || value() === ''">Choose…</option>
          @for (o of field()?.options ?? []; track o.value) { <option [value]="o.value" [selected]="'' + o.value === '' + value()">{{ o.label }}</option> }
        </select>
      }
      @case ('boolean') {
        <select class="wf-select" [attr.aria-label]="label()" (change)="emit($any($event.target).value === 'true')">
          <option value="true" [selected]="value() === true">Yes</option>
          <option value="false" [selected]="value() !== true">No</option>
        </select>
      }
      @case ('number') {
        <ui-number-input size="sm" [ngModel]="value()" (ngModelChange)="emit($event)" [ariaLabel]="label()" [steppers]="false" />
      }
      @case ('date') { <input class="wf-select native" type="date" [value]="value() ?? ''" (change)="emit($any($event.target).value)" [attr.aria-label]="label()" /> }
      @case ('dateTime') { <input class="wf-select native" type="datetime-local" [value]="dtLocal()" (change)="emitDt($any($event.target).value)" [attr.aria-label]="label()" /> }
      @default { <ui-input size="sm" [ngModel]="value() ?? ''" (ngModelChange)="emit($event)" [ariaLabel]="label()" [placeholder]="placeholder()" /> }
    }
  `,
  styles: [WF_SHARED_STYLES, `:host { display: block; min-width: 0; } .native { background-image: none; padding-right: var(--ui-space-2); }`],
})
export class WfValueInput {
  readonly field = input<UiWfFieldDescriptor | undefined>(undefined);
  readonly type = input<UiWfFieldType | 'any' | undefined>(undefined);
  readonly value = input<unknown>(null);
  readonly label = input('Value');
  readonly placeholder = input('');
  readonly valueChange = output<unknown>();
  protected readonly kind = computed(() => {
    const t = this.field()?.type ?? this.type();
    if (t === 'enum' && this.field()?.options?.length) return 'enum';
    if (t === 'boolean') return 'boolean';
    if (t === 'number' || t === 'currency') return 'number';
    if (t === 'date') return 'date';
    if (t === 'dateTime') return 'dateTime';
    return 'text';
  });
  /** The stored instant (UTC, ISO) as the local date and time the picker shows. */
  protected readonly dtLocal = computed(() => {
    const v = this.value();
    const d = typeof v === 'string' && v ? new Date(v) : null;
    if (!d || isNaN(+d)) return '';
    const two = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}`;
  });

  protected emit(v: unknown): void {
    this.valueChange.emit(v);
  }

  protected emitDt(v: string): void {
    this.valueChange.emit(v ? new Date(v).toISOString() : null);
  }
}

/**
 * `ui-wf-operand` — what a field is set to: a fixed value, another value from the workflow, or a
 * date relative to today.
 */
@Component({
  selector: 'ui-wf-operand',
  imports: [FormsModule, UiNumberInput, WfTokenSelect, WfValueInput],
  template: `
    <select class="wf-select mode" [attr.aria-label]="label() + ': source'" (change)="setMode($any($event.target).value)">
      <option value="const" [selected]="mode() === 'const'">A value</option>
      <option value="ref" [selected]="mode() === 'ref'">From…</option>
      @if (isDate()) { <option value="today" [selected]="mode() === 'today'">Days from today</option> }
      @if (mode() === 'calc') { <option value="calc" selected>A calculation</option> }
    </select>
    @switch (mode()) {
      @case ('ref') { <ui-wf-token-select [tokens]="tokens()" [value]="refValue()" [label]="label()" (valueChange)="valueChange.emit({ ref: $event })" /> }
      @case ('today') { <ui-number-input size="sm" [ngModel]="todayValue()" (ngModelChange)="valueChange.emit({ today: $event ?? 0 })" [ariaLabel]="label() + ': days from today'" /> }
      @case ('calc') { <span class="wf-hint calc">Set up in the JSON (calculation)</span> }
      @default { <ui-wf-value-input [field]="field()" [type]="type()" [value]="constValue()" [label]="label()" (valueChange)="valueChange.emit({ const: $event })" /> }
    }
  `,
  styles: [WF_SHARED_STYLES, `:host { display: grid; grid-template-columns: minmax(90px, 0.6fr) minmax(0, 1fr); gap: 6px; min-width: 0; align-items: center; } .calc { margin: 0; }`],
})
export class WfOperandEditor {
  readonly value = input<UiWfOperand | undefined>(undefined);
  readonly field = input<UiWfFieldDescriptor | undefined>(undefined);
  readonly type = input<UiWfFieldType | 'any' | undefined>(undefined);
  readonly tokens = input<readonly UiWfToken[]>([]);
  readonly label = input('Value');
  readonly valueChange = output<UiWfOperand>();
  protected readonly mode = computed(() => {
    const v = this.value();
    return !v ? 'const' : 'ref' in v ? 'ref' : 'today' in v ? 'today' : 'calc' in v ? 'calc' : 'const';
  });
  protected readonly isDate = computed(() => (this.field()?.type ?? this.type()) === 'date');
  protected readonly refValue = computed(() => { const v = this.value(); return v && 'ref' in v ? v.ref : null; });
  protected readonly todayValue = computed(() => { const v = this.value(); return v && 'today' in v ? v.today : 0; });
  protected readonly constValue = computed(() => { const v = this.value(); return v && 'const' in v ? v.const : null; });

  protected setMode(m: string): void {
    this.valueChange.emit(m === 'ref' ? { ref: '' } : m === 'today' ? { today: 0 } : { const: null });
  }
}

// ── Conditions ────────────────────────────────────────────────────────────

const MULTI_OPS = new Set<UiFbOperator>(['anyOf', 'noneOf', 'includesAny', 'includesAll']);

function asGroup(c: UiWfCondition | undefined): UiWfConditionGroup {
  if (!c) return { match: 'all', conditions: [] };
  return 'conditions' in c ? c : { match: 'all', conditions: [c] };
}

/** One rule: "[value] [is any of] [Approved, Rejected]". */
@Component({
  selector: 'ui-wf-rule',
  imports: [FormsModule, HugeiconsIconComponent, UiNumberInput, WfTokenSelect, WfValueInput],
  template: `
    <ui-wf-token-select class="ref" [tokens]="tokens()" [value]="rule().ref" label="Value to check" placeholder="Choose a value…" (valueChange)="setRef($event)" />
    <select class="wf-select op" aria-label="How to compare" [disabled]="!rule().ref" (change)="setOp($any($event.target).value)">
      @for (o of ops(); track o.op) { <option [value]="o.op" [selected]="o.op === rule().op">{{ o.label }}</option> }
    </select>
    @if (arity() > 0) {
      <div class="val">
        @if (compareMode() === 'ref') {
          <ui-wf-token-select [tokens]="tokens()" [value]="refOf(rule().value)" label="Compare with" (valueChange)="setValue({ ref: $event })" />
        } @else if (compareMode() === 'today') {
          <div class="wf-row"><ui-number-input size="sm" [ngModel]="todayOf(rule().value)" (ngModelChange)="setValue({ today: $event ?? 0 })" ariaLabel="Days from today" /><span class="wf-hint">days from today</span></div>
        } @else if (multi() && options().length) {
          <div class="multi" role="group" aria-label="Values">
            @for (o of options(); track o.value) {
              <label class="opt"><input type="checkbox" [checked]="listValue().includes('' + o.value)" (change)="toggle('' + o.value, $any($event.target).checked)" />{{ o.label }}</label>
            }
          </div>
        } @else {
          <ui-wf-value-input [field]="token()?.options ? { key: '', label: '', type: 'enum', options: token()!.options } : undefined" [type]="countOp() ? 'number' : token()?.type"
            [value]="constOf(rule().value)" label="Value" (valueChange)="setValue({ const: $event })" />
        }
        @if (arity() === 2) {
          <span class="and">and</span>
          <ui-wf-value-input [type]="token()?.type" [value]="constOf(rule().value2)" label="Second value" (valueChange)="patch({ value2: { const: $event } })" />
        }
        @if (!multi() && !countOp()) {
          <select class="wf-select mode" aria-label="Compare with" (change)="setCompareMode($any($event.target).value)">
            <option value="const" [selected]="compareMode() === 'const'">a value</option>
            <option value="ref" [selected]="compareMode() === 'ref'">another value</option>
            @if (isDate()) { <option value="today" [selected]="compareMode() === 'today'">today ±</option> }
          </select>
        }
      </div>
    }
    <button type="button" class="wf-icon-btn danger rm" (click)="removed.emit()" aria-label="Remove condition">
      <hugeicons-icon aria-hidden="true" [icon]="icons.Delete02Icon" [size]="14" [strokeWidth]="1.8" />
    </button>
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.9fr) auto; gap: 6px; align-items: start; }
    .val { grid-column: 1 / 3; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-width: 0; }
    .val > ui-wf-value-input, .val > ui-wf-token-select { flex: 1 1 140px; }
    .mode { width: auto; flex: 0 0 auto; height: var(--ui-size-sm); font-size: 12px; }
    .rm { grid-row: 1; grid-column: 3; }
    .and { font-size: 12px; color: var(--ui-color-text-muted); }
    .multi { display: flex; flex-wrap: wrap; gap: 4px 10px; padding: 4px 0; }
    .opt { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; cursor: pointer; }
    .opt input { accent-color: var(--ui-color-primary); margin: 0; }
  `],
})
export class WfRuleEditor {
  readonly rule = input.required<UiWfConditionRule>();
  readonly tokens = input<readonly UiWfToken[]>([]);
  readonly ruleChange = output<UiWfConditionRule>();
  readonly removed = output<void>();
  protected readonly icons = WF_ICONS;
  protected readonly token = computed(() => this.tokens().find((t) => t.path === this.rule().ref));
  protected readonly ops = computed(() => operatorsFor(valueKindOfField(this.token()?.type === 'any' ? undefined : (this.token()?.type as UiWfFieldType))));
  protected readonly arity = computed(() => operatorInfo(this.rule().op)?.arity ?? 1);
  protected readonly multi = computed(() => MULTI_OPS.has(this.rule().op));
  protected readonly countOp = computed(() => this.rule().op === 'countGte' || this.rule().op === 'countLte');
  protected readonly isDate = computed(() => this.token()?.type === 'date' || this.token()?.type === 'dateTime');
  protected readonly options = computed(() => this.token()?.options ?? []);
  protected readonly compareMode = computed(() => {
    const v = this.rule().value;
    return v && 'ref' in v ? 'ref' : v && 'today' in v ? 'today' : 'const';
  });
  protected readonly listValue = computed(() => {
    const v = this.constOf(this.rule().value);
    return Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)];
  });

  protected refOf(v: UiWfConditionRule['value']): string | null { return v && 'ref' in v ? v.ref : null; }
  protected todayOf(v: UiWfConditionRule['value']): number { return v && 'today' in v ? v.today : 0; }
  protected constOf(v: UiWfConditionRule['value']): unknown { return v && 'const' in v ? v.const : null; }

  protected patch(p: Partial<UiWfConditionRule>): void {
    this.ruleChange.emit({ ...this.rule(), ...p });
  }

  protected setRef(ref: string): void {
    const t = this.tokens().find((x) => x.path === ref);
    const ops = operatorsFor(valueKindOfField(t?.type === 'any' ? undefined : (t?.type as UiWfFieldType)));
    const op = ops.some((o) => o.op === this.rule().op) ? this.rule().op : ops[0].op;
    this.ruleChange.emit({ ref, op });
  }

  protected setOp(op: UiFbOperator): void {
    const { value, value2, ...rest } = this.rule();
    const keepValue = MULTI_OPS.has(op) === this.multi() ? value : undefined;
    this.ruleChange.emit({ ...rest, op, ...(operatorInfo(op).arity > 0 && keepValue ? { value: keepValue } : {}), ...(operatorInfo(op).arity === 2 && value2 ? { value2 } : {}) });
  }

  protected setValue(value: NonNullable<UiWfConditionRule['value']>): void {
    this.patch({ value });
  }

  protected setCompareMode(m: string): void {
    this.patch({ value: m === 'ref' ? { ref: '' } : m === 'today' ? { today: 0 } : { const: null } });
  }

  protected toggle(v: string, on: boolean): void {
    const cur = this.listValue();
    const next = on ? [...new Set([...cur, v])] : cur.filter((x) => x !== v);
    // Keep numbers as numbers when the options are numeric.
    const typed = next.map((x) => this.options().find((o) => String(o.value) === x)?.value ?? x);
    this.patch({ value: { const: typed } });
  }
}

/**
 * `ui-wf-condition` — conditions as sentences: "[Amount] [is more than] [5,000]", combined with all
 * / any / none, with one level of sub-groups. Saved as the form builder's condition JSON.
 */
@Component({
  selector: 'ui-wf-condition',
  imports: [HugeiconsIconComponent, WfRuleEditor],
  template: `
    <div class="head">
      @if (group().conditions.length > 1 || nested()) {
        <select class="wf-select match" aria-label="Combine conditions" (change)="setMatch($any($event.target).value)">
          <option value="all" [selected]="group().match === 'all'">All of these are true</option>
          <option value="any" [selected]="group().match === 'any'">Any of these is true</option>
          <option value="none" [selected]="group().match === 'none'">None of these is true</option>
        </select>
      } @else if (!group().conditions.length) {
        <span class="wf-hint">{{ emptyText() }}</span>
      }
    </div>
    @for (c of group().conditions; track $index) {
      @if (isGroup(c)) {
        <div class="sub">
          <ui-wf-condition [value]="c" [tokens]="tokens()" [nested]="true" (valueChange)="replace($index, $event)" />
          <button type="button" class="wf-link danger" (click)="remove($index)">Remove group</button>
        </div>
      } @else {
        <ui-wf-rule [rule]="$any(c)" [tokens]="tokens()" (ruleChange)="replace($index, $event)" (removed)="remove($index)" />
      }
    }
    <div class="adds">
      <button type="button" class="wf-link" (click)="addRule()"><hugeicons-icon aria-hidden="true" [icon]="icons.Add01Icon" [size]="12" [strokeWidth]="2" /> Add condition</button>
      @if (!nested()) { <button type="button" class="wf-link" (click)="addGroup()">Add a group</button> }
    </div>
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .head:empty { display: none; }
    .match { height: var(--ui-size-sm); width: auto; max-width: 100%; font-size: 12px; font-weight: 550; }
    .sub { display: flex; flex-direction: column; gap: 6px; padding: 8px; border-left: 2px solid color-mix(in srgb, var(--ui-color-primary) 40%, transparent);
      background: color-mix(in srgb, var(--ui-color-primary) 4%, transparent); border-radius: 0 var(--ui-radius-xs) var(--ui-radius-xs) 0; }
    .sub .wf-link { align-self: flex-start; }
    .danger { color: var(--ui-color-danger); }
    .adds { display: flex; gap: var(--ui-space-3); }
    .adds .wf-link { display: inline-flex; align-items: center; gap: 3px; }
  `],
})
export class WfConditionEditor {
  readonly value = input<UiWfCondition | undefined>(undefined);
  readonly tokens = input<readonly UiWfToken[]>([]);
  readonly nested = input(false);
  readonly emptyText = input('Always (no conditions yet).');
  readonly valueChange = output<UiWfConditionGroup>();
  protected readonly icons = WF_ICONS;
  protected readonly group = computed(() => asGroup(this.value()));

  protected isGroup(c: UiWfCondition): c is UiWfConditionGroup {
    return 'conditions' in c;
  }

  private emit(conditions: UiWfCondition[], match = this.group().match): void {
    this.valueChange.emit({ match, conditions });
  }

  protected setMatch(match: UiWfConditionGroup['match']): void { this.emit(this.group().conditions, match); }
  protected replace(i: number, c: UiWfCondition): void { this.emit(this.group().conditions.map((x, j) => (j === i ? c : x))); }
  protected remove(i: number): void { this.emit(this.group().conditions.filter((_, j) => j !== i)); }
  protected addRule(): void { this.emit([...this.group().conditions, { ref: '', op: 'eq' } as UiWfConditionRule]); }
  protected addGroup(): void { this.emit([...this.group().conditions, { match: 'any', conditions: [{ ref: '', op: 'eq' } as UiWfConditionRule] }]); }
}

// ── Embedded forms ────────────────────────────────────────────────────────

/**
 * `ui-wf-form-field` — a form to fill in (at a task, a transition or a manual start), built with
 * `ui-form-builder` in a full-screen dialog.
 */
@Component({
  selector: 'ui-wf-form-field',
  imports: [UiButton, UiModal, UiFormBuilder],
  template: `
    <div class="wf-row">
      @if (value(); as f) {
        <span class="summary">{{ count(f) }} question{{ count(f) === 1 ? '' : 's' }}</span>
        <button type="button" class="wf-link" (click)="edit()">Edit form</button>
        <button type="button" class="wf-link danger" (click)="valueChange.emit(undefined)">Remove</button>
      } @else {
        <button type="button" class="wf-link" (click)="edit()">{{ addLabel() }}</button>
      }
    </div>
    <ui-modal [open]="open()" (openChange)="open.set($event)" [title]="title()" size="full">
      @if (open()) {
        <div class="builder"><ui-form-builder [(definition)]="draft" /></div>
      }
      <div modal-footer class="foot">
        <ui-button variant="ghost" (click)="open.set(false)">Cancel</ui-button>
        <ui-button (click)="save()">Use this form</ui-button>
      </div>
    </ui-modal>
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: block; }
    .summary { font-size: 13px; color: var(--ui-color-text-secondary); }
    .danger { color: var(--ui-color-danger); }
    .builder { height: min(78vh, 900px); display: flex; flex-direction: column; }
    .builder ui-form-builder { flex: 1; }
    .foot { display: flex; justify-content: space-between; width: 100%; }
  `],
})
export class WfFormField {
  readonly value = input<UiFormDefinition | undefined>(undefined);
  readonly title = input('Form');
  readonly addLabel = input('Add a form');
  readonly valueChange = output<UiFormDefinition | undefined>();
  protected readonly open = signal(false);
  protected draft: UiFormDefinition = createDefinition();

  protected count(f: UiFormDefinition): number {
    let n = 0;
    const walk = (els: readonly { kind: string; elements?: unknown[] }[]) => {
      for (const e of els) {
        if (e.kind === 'field') n++;
        if (e.kind === 'group') walk((e.elements ?? []) as { kind: string; elements?: unknown[] }[]);
      }
    };
    for (const p of f.pages) walk(p.elements as { kind: string; elements?: unknown[] }[]);
    return n;
  }

  protected edit(): void {
    this.draft = this.value() ?? createDefinition(this.title());
    this.open.set(true);
  }

  protected save(): void {
    this.valueChange.emit(this.draft);
    this.open.set(false);
  }
}


