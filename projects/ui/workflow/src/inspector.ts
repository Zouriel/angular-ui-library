import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiCheckbox, UiInput, UiNumberInput, UiSelect, UiSwitch, UiTextarea, UiTimePicker, type UiSelectOption } from '@zouriel/ui/form';
import { describeTrigger, fieldOf, indexSteps, stepName, updateLifecycle, wfId, wfKey, wfStatesFrom } from './definition';
import { WfAssigneesEditor, WfConditionEditor, WfDurationInput, WfFormField, WfValueInput } from './editors';
import { WF_ICONS, WF_STEP_ICONS, WF_TRIGGER_ICONS } from './icons';
import type { UiWfConditionGroup, UiWfState, UiWfTransition, UiWfTrigger, UiWfTriggerType, UiWfVariable, UiWorkflowDefinition } from './schema';
import { WfSelect, type WfOption } from './select';
import { WF_TONE_OPTIONS, WfStepEditor } from './step-editors';
import { WfBuilderStore } from './store';
import { WF_SHARED_STYLES } from './styles';

const TRIGGER_TYPES: { type: UiWfTriggerType; label: string; hint: string; needsLifecycle?: boolean }[] = [
  { type: 'fieldChanged', label: 'A field changes', hint: 'e.g. status becomes Submitted' },
  { type: 'created', label: 'A record is created', hint: 'every new record' },
  { type: 'stateEntered', label: 'A lifecycle reaches a state', hint: 'uses a published lifecycle', needsLifecycle: true },
  { type: 'transitionApplied', label: 'A lifecycle transition happens', hint: 'e.g. after “Approve”', needsLifecycle: true },
  { type: 'dateReached', label: 'A date comes up', hint: 'e.g. 2 days before the deadline' },
  { type: 'schedule', label: 'On a schedule', hint: 'every day, week or month' },
  { type: 'manual', label: 'Someone presses a button', hint: 'on the record page' },
  { type: 'signal', label: 'The app reports an event', hint: 'e.g. payment received' },
  { type: 'deleted', label: 'A record is deleted', hint: 'gets the record as it was' },
];

const CRON_PRESETS: { value: string; label: string }[] = [
  { value: '0 9 * * *', label: 'Every day at 09:00' },
  { value: '0 9 * * 1-5', label: 'Every weekday at 09:00' },
  { value: '0 9 * * 1', label: 'Every Monday at 09:00' },
  { value: '0 9 1 * *', label: 'On the 1st of each month at 09:00' },
  { value: '0 * * * *', label: 'Every hour' },
];

/** The trigger: what starts an automation. */
@Component({
  selector: 'ui-wf-trigger-editor',
  imports: [FormsModule, HugeiconsIconComponent, UiInput, UiNumberInput, UiSwitch, UiTimePicker, WfAssigneesEditor, WfConditionEditor, WfDurationInput, WfFormField, WfSelect],
  template: `
    <div class="wf-stack">
      <div role="radiogroup" aria-label="What starts it" class="types">
        @for (t of types; track t.type) {
          <button type="button" role="radio" class="type" [class.on]="trigger().type === t.type" [attr.aria-checked]="trigger().type === t.type" (click)="setType(t.type)">
            <hugeicons-icon aria-hidden="true" [icon]="iconOf(t.type)" [size]="14" [strokeWidth]="1.8" />
            <span class="t"><span class="l">{{ t.label }}</span><span class="h">{{ t.hint }}</span></span>
          </button>
        }
      </div>

      @switch (trigger().type) {
        @case ('fieldChanged') {
          <label class="lw"><span class="wf-label">Field</span>
            <ui-wf-select [options]="fieldOptions(watchable())" [value]="trigger().field" placeholder="Choose a field…" label="Field" (valueChange)="patch({ field: $event, from: undefined, to: undefined })" /></label>
          @if (!watchable().length && store.entity()) { <p class="wf-hint">The app hasn’t allowed any field of this record to be watched.</p> }
          @if (field(); as f) {
            @if (f.options?.length) {
              <div><span class="wf-label">Changes to (leave empty for any value)</span>
                <div class="multi">@for (o of f.options!; track o.value) {
                  <label class="opt"><input type="checkbox" [checked]="has(trigger().to, o.value)" (change)="toggle('to', o.value, $any($event.target).checked)" />{{ o.label }}</label> }</div></div>
              <div><span class="wf-label">Only when it was (optional)</span>
                <div class="multi">@for (o of f.options!; track o.value) {
                  <label class="opt"><input type="checkbox" [checked]="has(trigger().from, o.value)" (change)="toggle('from', o.value, $any($event.target).checked)" />{{ o.label }}</label> }</div></div>
            } @else {
              <p class="wf-hint">Starts on any change to {{ f.label }}. Add conditions below to narrow it.</p>
            }
          }
          <label class="wf-row small"><ui-switch size="sm" [ngModel]="!!trigger().retrigger" (ngModelChange)="patch({ retrigger: $event || undefined })" /> Also start when this workflow itself changes it</label>
        }
        @case ('stateEntered') {
          <label class="lw"><span class="wf-label">Lifecycle</span>
            <ui-wf-select [options]="lifecycleOptions()" [value]="trigger().lifecycle" placeholder="Choose…" label="Lifecycle" (valueChange)="patch({ lifecycle: $event, states: [] })" /></label>
          @if (states().length) {
            <div><span class="wf-label">Reaches</span><div class="multi">@for (s of states(); track s.key) {
              <label class="opt"><input type="checkbox" [checked]="(trigger().states ?? []).includes(s.key)" (change)="toggleList('states', s.key, $any($event.target).checked)" />{{ s.label }}</label> }</div></div>
          }
        }
        @case ('transitionApplied') {
          <label class="lw"><span class="wf-label">Lifecycle</span>
            <ui-wf-select [options]="lifecycleOptions()" [value]="trigger().lifecycle" placeholder="Choose…" label="Lifecycle" (valueChange)="patch({ lifecycle: $event, transitions: [] })" /></label>
          @if (transitions().length) {
            <div><span class="wf-label">After</span><div class="multi">@for (t of transitions(); track t.key) {
              <label class="opt"><input type="checkbox" [checked]="(trigger().transitions ?? []).includes(t.key)" (change)="toggleList('transitions', t.key, $any($event.target).checked)" />{{ t.label }}</label> }</div></div>
          }
        }
        @case ('dateReached') {
          <label class="lw"><span class="wf-label">Date field</span>
            <ui-wf-select [options]="fieldOptions(dateFields())" [value]="trigger().field" placeholder="Choose…" label="Date field" (valueChange)="patch({ field: $event })" /></label>
          <div><span class="wf-label">When</span><ui-wf-duration [value]="trigger().offset ?? '-P1D'" [signed]="true" label="Offset" (valueChange)="patch({ offset: $event })" /></div>
          <label class="lw"><span class="wf-label">At (time of day)</span>
            <ui-time-picker size="sm" [ngModel]="trigger().at ?? '09:00'" (ngModelChange)="patch({ at: $event })" /></label>
        }
        @case ('schedule') {
          <label class="lw"><span class="wf-label">When</span>
            <ui-wf-select [options]="cronOptions" [value]="isPreset() && !custom() ? trigger().cron : 'custom'" label="When" (valueChange)="pickSchedule($event)" /></label>
          @if (!isPreset() || custom()) {
            <label class="lw"><span class="wf-label">Schedule (minute hour day month weekday)</span>
              <ui-input size="sm" [ngModel]="trigger().cron ?? ''" (ngModelChange)="patch({ cron: $event }, 'cron')" placeholder="30 8 * * 1-5" /></label>
          }
          <label class="wf-row small"><ui-switch size="sm" [ngModel]="!!trigger().forEach" (ngModelChange)="patch({ forEach: $event ? { limit: 100 } : undefined })" [disabled]="!store.entity()" /> Run once for each matching record</label>
          @if (trigger().forEach; as fe) {
            <ui-wf-condition [value]="fe.when" [tokens]="tokens()" emptyText="Every record." (valueChange)="patch({ forEach: { ...fe, when: $event.conditions.length ? $event : undefined } })" />
            <label class="lw"><span class="wf-label">At most</span><ui-number-input size="sm" [ngModel]="fe.limit" (ngModelChange)="patch({ forEach: { ...fe, limit: $event ?? 100 } })" [min]="1" [max]="500" suffix="records" /></label>
          }
        }
        @case ('manual') {
          <label class="lw"><span class="wf-label">Button label</span>
            <ui-input size="sm" [ngModel]="trigger().label ?? ''" (ngModelChange)="patch({ label: $event }, 'label')" placeholder="e.g. Ask for more documents" /></label>
          <div><span class="wf-label">Who can press it</span>
            <ui-wf-assignees [value]="trigger().who ?? []" [registry]="store.registry()" [tokens]="tokens()" [api]="store.api()" emptyText="Anyone who can see the record." (valueChange)="patch({ who: $any($event) })" /></div>
          <div><span class="wf-label">Ask for</span><ui-wf-form-field [value]="trigger().form" title="Questions when starting" addLabel="Add questions (a form)" (valueChange)="patch({ form: $event })" /></div>
        }
        @case ('signal') {
          <label class="lw"><span class="wf-label">Event</span>
            <ui-wf-select [options]="signalOptions()" [value]="trigger().signal" placeholder="Choose…" label="Event" (valueChange)="patch({ signal: $event })" /></label>
        }
      }

      @if (trigger().type !== 'schedule') {
        <section class="wf-section">
          <h4 class="wf-section-title">Only if</h4>
          <ui-wf-condition [value]="trigger().when" [tokens]="tokens()" emptyText="No extra conditions." (valueChange)="patch({ when: $event.conditions.length ? $event : undefined })" />
        </section>
      }
      <p class="wf-hint">{{ summary() }}.</p>
    </div>
  `,
  styles: [WF_SHARED_STYLES, `
    .lw { display: block; min-width: 0; }
    .types { display: grid; grid-template-columns: 1fr; gap: 2px; }
    .type { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid transparent; border-radius: var(--ui-radius); background: transparent;
      font: inherit; color: var(--ui-color-text); text-align: left; cursor: pointer; }
    .type:hover { background: var(--ui-color-surface-hover); }
    .type:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .type.on { border-color: var(--ui-color-primary); background: color-mix(in srgb, var(--ui-color-primary) 8%, transparent); }
    .type hugeicons-icon { color: var(--ui-color-text-secondary); flex: none; }
    .type.on hugeicons-icon { color: var(--ui-color-primary); }
    .t { display: flex; flex-direction: column; min-width: 0; }
    .l { font-size: 13px; font-weight: 550; }
    .h { font-size: 11.5px; color: var(--ui-color-text-muted); }
    .multi { display: flex; flex-wrap: wrap; gap: 4px 12px; }
    .opt { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; cursor: pointer; }
    .opt input { accent-color: var(--ui-color-primary); margin: 0; }
    .small { font-size: 13px; color: var(--ui-color-text-secondary); gap: 8px; cursor: pointer; }
  `],
})
export class WfTriggerEditor {
  protected readonly store = inject(WfBuilderStore);
  protected readonly types = TRIGGER_TYPES;
  protected readonly cronOptions: WfOption[] = [...CRON_PRESETS, { value: 'custom', label: 'Custom…' }];
  protected readonly trigger = computed<UiWfTrigger>(() => this.store.def().trigger ?? { type: 'fieldChanged' });
  protected readonly tokens = computed(() => this.store.tokens({ listId: 'root', index: 0 }));
  protected readonly summary = computed(() => describeTrigger(this.trigger(), this.store.describeContext(this.tokens())));
  protected readonly watchable = computed(() => (this.store.entity()?.fields ?? []).filter((f) => f.watchable));
  protected readonly dateFields = computed(() => this.watchable().filter((f) => f.type === 'date' || f.type === 'dateTime'));
  protected readonly field = computed(() => fieldOf(this.store.registry(), this.store.def().entity, this.trigger().field));
  protected readonly lifecycles = computed(() => this.store.others().filter((o) => o.kind === 'lifecycle' && o.version > 0 && (!this.store.def().entity || o.entity === this.store.def().entity)));
  protected readonly lifecycleOptions = computed<WfOption[]>(() => this.lifecycles().map((l) => ({ value: l.key, label: l.title })));
  protected readonly signalOptions = computed<WfOption[]>(() => (this.store.registry()?.signals ?? []).map((x) => ({ value: x.key, label: x.label })));
  protected fieldOptions(fields: readonly { key: string; label: string }[]): WfOption[] { return fields.map((f) => ({ value: f.key, label: f.label })); }
  protected readonly lifecycleDef = computed(() => this.store.lifecycleCache()[this.trigger().lifecycle ?? '']);
  protected readonly states = computed(() => this.lifecycleDef()?.lifecycle?.states ?? []);
  protected readonly transitions = computed(() => this.lifecycleDef()?.lifecycle?.transitions ?? []);
  protected readonly isPreset = computed(() => CRON_PRESETS.some((p) => p.value === this.trigger().cron));
  /** "Custom…" was chosen: the schedule box shows, starting from the preset it replaces. */
  protected readonly custom = signal(false);

  protected pickSchedule(v: string): void {
    this.custom.set(v === 'custom');
    if (v !== 'custom') this.patch({ cron: v });
  }

  constructor() {
    effect(() => {
      const key = this.trigger().lifecycle;
      if (key) this.store.loadLifecycle(key);
    });
  }

  protected iconOf(t: UiWfTriggerType) {
    return WF_TRIGGER_ICONS[t] ?? WF_ICONS.FlashIcon;
  }

  protected patch(p: Partial<UiWfTrigger>, mergeKey?: string): void {
    const next = { ...this.trigger(), ...p } as Record<string, unknown>;
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    this.store.setTrigger(next as unknown as UiWfTrigger, mergeKey ? `trigger:${mergeKey}` : undefined);
  }

  protected setType(type: UiWfTriggerType): void {
    if (type === this.trigger().type) return;
    const base: UiWfTrigger = { type };
    if (type === 'schedule') base.cron = CRON_PRESETS[0].value;
    if (type === 'dateReached') { base.offset = '-P1D'; base.at = '09:00'; }
    if (type === 'manual') base.label = 'Start';
    this.store.setTrigger(base);
  }

  protected has(list: unknown[] | undefined, v: unknown): boolean {
    return (list ?? []).some((x) => String(x) === String(v));
  }

  protected toggle(key: 'from' | 'to', v: string | number, on: boolean): void {
    const cur = (this.trigger()[key] ?? []).filter((x) => String(x) !== String(v));
    const next = on ? [...cur, v] : cur;
    this.patch({ [key]: next.length ? next : undefined });
  }

  protected toggleList(key: 'states' | 'transitions', v: string, on: boolean): void {
    const cur = (this.trigger()[key] ?? []).filter((x) => x !== v);
    this.patch({ [key]: on ? [...cur, v] : cur });
  }
}

/** The workflow's own settings: name, record type, variables, who looks after it. */
@Component({
  selector: 'ui-wf-workflow-editor',
  imports: [FormsModule, HugeiconsIconComponent, UiInput, UiTextarea, UiSwitch, WfAssigneesEditor, WfConditionEditor, WfSelect, WfValueInput],
  template: `
    <div class="wf-stack">
      <label class="lw"><span class="wf-label">Name</span>
        <ui-input size="sm" [ngModel]="def().title" (ngModelChange)="patch({ title: $event }, 'title')" /></label>
      <label class="lw"><span class="wf-label">Description</span>
        <ui-textarea size="sm" [ngModel]="def().description ?? ''" (ngModelChange)="patch({ description: $event || undefined }, 'description')" [rows]="2" [autosize]="true" /></label>
      <label class="lw"><span class="wf-label">Record type</span>
        <ui-wf-select [options]="entityOptions()" [value]="def().entity ?? ''" [disabled]="published()" label="Record type" (valueChange)="patch({ entity: $event || undefined })" /></label>
      @if (published()) { <p class="wf-hint">The record type can’t change once the workflow is published.</p> }
      @if (def().kind === 'lifecycle') {
        <label class="lw"><span class="wf-label">Field it controls</span>
          <ui-wf-select [options]="lifecycleFieldOptions()" [value]="def().lifecycle?.field" placeholder="Choose…" [disabled]="published()" label="Field it controls" (valueChange)="setLifecycleField($event)" /></label>
        <label class="lw"><span class="wf-label">If the app changes the field directly</span>
          <ui-wf-select [options]="modeOptions" [value]="def().lifecycle?.mode === 'observe' ? 'observe' : 'enforce'" label="If the app changes the field directly" (valueChange)="setMode($any($event))" /></label>
        <section class="wf-section wf-stack">
          <h4 class="wf-section-title">Applies to</h4>
          <ui-wf-condition [value]="def().lifecycle?.appliesWhen" [tokens]="ownFieldTokens()" [emptyText]="'Every ' + (store.entity()?.label ?? 'record').toLowerCase() + ' that no other lifecycle on this field covers.'"
            (valueChange)="setAppliesWhen($event)" />
          <p class="wf-hint">Only records that meet these get this lifecycle, e.g. only those whose type is Passport. Pick fields that are set when the record is created: a record keeps its lifecycle if they change later. Another lifecycle on the same field can cover the rest.</p>
        </section>
      } @else {
        <label class="lw"><span class="wf-label">If it starts again for the same record while running</span>
          <ui-wf-select [options]="concurrencyOptions" [value]="def().settings?.concurrency || 'perRecordSerial'" label="If it starts again for the same record while running" (valueChange)="patch({ settings: { ...def().settings, concurrency: $any($event) } })" /></label>
      }
      <label class="wf-row small"><ui-switch size="sm" [ngModel]="def().settings?.calendar === 'working'" (ngModelChange)="patch({ settings: { ...def().settings, calendar: $event ? 'working' : undefined } })" />
        Count deadlines in working time</label>

      @if (def().kind === 'lifecycle') {
        <section class="wf-section wf-stack">
          <h4 class="wf-section-title">Starting over</h4>
          <label class="wf-row small"><ui-switch size="sm" [ngModel]="!!def().lifecycle?.reset" (ngModelChange)="$event ? store.enableReset() : store.removeReset()" />
            Let people reset a record's workflow</label>
          @if (def().lifecycle?.reset) {
            <button type="button" class="wf-link" (click)="store.selection.set({ kind: 'reset' })">Who, where to and what changes on reset ›</button>
          }
        </section>
      }

      <section class="wf-section wf-stack">
        <h4 class="wf-section-title">Looked after by</h4>
        <ui-wf-assignees [value]="def().settings?.owners ?? []" [registry]="store.registry()" [api]="store.api()" emptyText="Nobody yet." label="owners"
          (valueChange)="patch({ settings: { ...def().settings, owners: $any($event) } })" />
        <label class="wf-row small"><ui-switch size="sm" [ngModel]="!!def().settings?.notifyOwnersOnIncident" (ngModelChange)="patch({ settings: { ...def().settings, notifyOwnersOnIncident: $event || undefined } })" />
          Tell them when a run gets stuck</label>
      </section>

      <section class="wf-section wf-stack">
        <h4 class="wf-section-title">Variables</h4>
        @for (v of def().variables ?? []; track v.id; let i = $index) {
          <div class="var">
            <ui-input size="sm" [ngModel]="v.label" (ngModelChange)="setVariable(i, { label: $event })" [ariaLabel]="'Variable ' + (i + 1) + ' name'" />
            <ui-wf-select [options]="varTypes" [value]="v.type" label="Type" (valueChange)="setVariable(i, { type: $any($event), default: undefined })" />
            <button type="button" class="wf-icon-btn danger" (click)="removeVariable(i)" aria-label="Remove variable"><hugeicons-icon aria-hidden="true" [icon]="icons.Delete02Icon" [size]="14" [strokeWidth]="1.8" /></button>
            <ui-wf-value-input class="def" [type]="v.type === 'json' ? 'text' : v.type" [value]="v.default" label="Starting value" placeholder="Starting value" (valueChange)="setVariable(i, { default: $event })" />
          </div>
        }
        <button type="button" class="wf-link" (click)="addVariable()">Add a variable</button>
        <p class="wf-hint">Steps can set variables and read them later, e.g. to count attempts.</p>
      </section>

      <section class="wf-section">
        <span class="wf-label">Key (used by the API and other workflows)</span>
        <code class="key">{{ def().key }}</code>
      </section>
    </div>
  `,
  styles: [WF_SHARED_STYLES, `
    .lw { display: block; min-width: 0; }
    .small { font-size: 13px; color: var(--ui-color-text-secondary); gap: 8px; cursor: pointer; }
    .var { display: grid; grid-template-columns: minmax(0, 1fr) 96px auto; gap: 6px; align-items: center; }
    .var .def { grid-column: 1 / 3; }
    .key { font-family: var(--ui-font-mono); font-size: 12px; color: var(--ui-color-text-secondary); }
  `],
})
export class WfWorkflowEditor {
  protected readonly store = inject(WfBuilderStore);
  protected readonly icons = WF_ICONS;
  protected readonly def = this.store.def;
  protected readonly published = computed(() => !!this.store.published());
  protected readonly lifecycleFields = computed(() => (this.store.entity()?.fields ?? []).filter((f) => f.lifecycle && f.type === 'enum'));
  /** "Applies to" reads only the record's own fields, never the one the lifecycle controls (spec §6). */
  protected readonly ownFieldTokens = computed(() => {
    const own = this.def().lifecycle?.field;
    return this.store.tokens({ listId: 'root', index: 0 }).filter((t) => /^entity\.[^.]+$/.test(t.path) && t.path !== 'entity.id' && t.path !== `entity.${own}`);
  });
  protected readonly entityOptions = computed<WfOption[]>(() => [
    { value: '', label: this.def().kind === 'lifecycle' ? 'Choose…' : 'None (not about a record)' },
    ...(this.store.registry()?.entities ?? []).map((e) => ({ value: e.key, label: e.label })),
  ]);
  protected readonly lifecycleFieldOptions = computed<WfOption[]>(() => this.lifecycleFields().map((f) => ({ value: f.key, label: f.label })));
  protected readonly modeOptions: WfOption[] = [{ value: 'enforce', label: 'Refuse it (only transitions may change it)' }, { value: 'observe', label: 'Accept it and record it' }];
  protected readonly concurrencyOptions: WfOption[] = [
    { value: 'perRecordSerial', label: 'Wait for the earlier run' }, { value: 'parallel', label: 'Run both' }, { value: 'skipIfRunning', label: 'Don’t start it again' },
  ];
  protected readonly varTypes: WfOption[] = [
    { value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }, { value: 'boolean', label: 'Yes/no' },
    { value: 'date', label: 'Date' }, { value: 'user', label: 'Person' }, { value: 'json', label: 'Anything' },
  ];

  protected patch(p: Partial<UiWorkflowDefinition>, mergeKey?: string): void {
    this.store.patch(p, mergeKey ? `wf:${mergeKey}` : undefined);
  }

  protected setLifecycleField(field: string): void {
    const lc = this.def().lifecycle;
    if (!lc) return;
    const f = fieldOf(this.store.registry(), this.def().entity, field);
    // Fresh lifecycle: one state per value of the field, the first one starting.
    const fresh = lc.states.length <= 2 && lc.transitions.length <= 1 && f?.options?.length;
    if (fresh) {
      const states: UiWfState[] = f!.options!.map((o, i) => ({
        id: wfId('st'), key: String(o.value), label: o.label, category: i === 0 ? 'initial' : i === f!.options!.length - 1 ? 'terminal' : 'active',
        tone: i === 0 ? 'neutral' : i === f!.options!.length - 1 ? 'success' : 'info',
      }));
      const transitions: UiWfTransition[] = states.slice(1).map((s, i) => ({ id: wfId('tr'), key: wfKey(`to ${s.label}`), label: `To ${s.label}`, from: [states[i].id], to: s.id, who: [] }));
      this.patch({ lifecycle: { ...lc, field, states, transitions, layout: undefined } });
    } else {
      this.patch({ lifecycle: { ...lc, field } });
    }
  }

  protected setAppliesWhen(when: UiWfConditionGroup): void {
    const lc = this.def().lifecycle;
    if (lc) this.patch({ lifecycle: { ...lc, appliesWhen: when.conditions.length ? when : undefined } }, 'appliesWhen');
  }

  protected setMode(mode: 'enforce' | 'observe'): void {
    const lc = this.def().lifecycle;
    if (lc) this.patch({ lifecycle: { ...lc, mode } });
  }

  protected setVariable(i: number, p: Partial<UiWfVariable>): void {
    const vars = (this.def().variables ?? []).map((v, j) => {
      if (j !== i) return v;
      const n = { ...v, ...p };
      // The key follows the name only while nothing reads the variable yet; renaming then never breaks a step.
      const used = JSON.stringify(this.def()).includes(`vars.${v.key}`);
      if (p.label !== undefined && !used) n.key = wfKey(p.label, (this.def().variables ?? []).filter((_, k) => k !== i).map((x) => x.key));
      if (n.default === undefined || n.default === null || n.default === '') delete n.default;
      return n;
    });
    this.patch({ variables: vars }, `var${i}`);
  }

  protected addVariable(): void {
    const vars = this.def().variables ?? [];
    const label = `Variable ${vars.length + 1}`;
    this.patch({ variables: [...vars, { id: wfId('v'), key: wfKey(label, vars.map((v) => v.key)), label, type: 'text' }] });
  }

  protected removeVariable(i: number): void {
    const vars = (this.def().variables ?? []).filter((_, j) => j !== i);
    this.patch({ variables: vars.length ? vars : undefined });
  }
}

/** A lifecycle state: its name and stored value, kind, colour, and what runs on entering or leaving it. */
@Component({
  selector: 'ui-wf-state-editor',
  imports: [FormsModule, UiInput, UiTextarea, UiSwitch, WfDurationInput, WfSelect],
  template: `
    @if (state(); as s) {
      <div class="wf-stack">
        <label class="lw"><span class="wf-label">Name</span>
          <ui-input size="sm" [ngModel]="s.label" (ngModelChange)="patch({ label: $event }, 'label')" /></label>
        <label class="lw"><span class="wf-label">Stored value</span>
          @if (field()?.options?.length) {
            <ui-wf-select [options]="keyOptions()" [value]="s.key" [unknownLabel]="notAValue" label="Stored value" (valueChange)="patch({ key: $event })" />
          } @else {
            <ui-input size="sm" [ngModel]="s.key" (ngModelChange)="patch({ key: $event }, 'key')" />
          }</label>
        <div class="wf-grid2">
          <label class="lw"><span class="wf-label">Kind</span>
            <ui-wf-select [options]="categories" [value]="s.category" label="Kind" (valueChange)="setCategory($any($event))" /></label>
          <label class="lw"><span class="wf-label">Colour</span>
            <ui-wf-select [options]="tones" [value]="s.tone ?? 'neutral'" label="Colour" (valueChange)="patch({ tone: $any($event) })" /></label>
        </div>
        <label class="lw"><span class="wf-label">Description</span>
          <ui-textarea size="sm" [ngModel]="s.description ?? ''" (ngModelChange)="patch({ description: $event || undefined }, 'description')" [rows]="2" [autosize]="true" /></label>
        @if (s.category !== 'terminal') {
          <section class="wf-section wf-stack">
            <h4 class="wf-section-title">Time limit</h4>
            <label class="wf-row small"><ui-switch size="sm" [ngModel]="!!s.sla" (ngModelChange)="patch({ sla: $event ? { within: 'P2D', steps: [] } : undefined })" /> Do something if a record stays here too long</label>
            @if (s.sla; as sla) {
              <div><span class="wf-label">Longer than</span><ui-wf-duration [value]="sla.within" label="Time limit" (valueChange)="patch({ sla: { ...sla, within: $event } })" /></div>
              <label class="wf-row small"><ui-switch size="sm" [ngModel]="sla.calendar === 'working'" (ngModelChange)="patch({ sla: { ...sla, calendar: $event ? 'working' : undefined } })" /> Count working time only</label>
            }
          </section>
        }
        <label class="wf-row small"><ui-switch size="sm" [ngModel]="!!s.keepRunsOnExit" (ngModelChange)="patch({ keepRunsOnExit: $event || undefined })" /> Keep its steps running after the record leaves</label>
        <p class="wf-hint">Edit what happens on entering, leaving or running late in the steps panel under the diagram.</p>
      </div>
    }
  `,
  styles: [WF_SHARED_STYLES, `.lw { display: block; min-width: 0; } .small { font-size: 13px; color: var(--ui-color-text-secondary); gap: 8px; cursor: pointer; }`],
})
export class WfStateEditor {
  protected readonly store = inject(WfBuilderStore);
  protected readonly tones: WfOption[] = [
    { value: 'neutral', label: 'Plain' }, { value: 'info', label: 'Blue' }, { value: 'success', label: 'Green' }, { value: 'warning', label: 'Amber' }, { value: 'danger', label: 'Red' },
  ];
  protected readonly categories: WfOption[] = [{ value: 'initial', label: 'Starting state' }, { value: 'active', label: 'In progress' }, { value: 'terminal', label: 'Final state' }];
  protected readonly notAValue = (v: string) => `${v} (not a value of the field)`;
  protected readonly state = this.store.selectedState;
  protected readonly field = computed(() => fieldOf(this.store.registry(), this.store.def().entity, this.store.def().lifecycle?.field));
  protected readonly keyOptions = computed<WfOption[]>(() => (this.field()?.options ?? []).map((o) => ({ value: '' + o.value, label: `${o.label} (${o.value})` })));

  protected patch(p: Partial<UiWfState>, mergeKey?: string): void {
    const s = this.state();
    if (!s) return;
    const next = { ...s, ...p } as Record<string, unknown>;
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    this.store.updateState(s.id, () => next as unknown as UiWfState, mergeKey ? `state:${s.id}:${mergeKey}` : undefined);
  }

  protected setCategory(category: UiWfState['category']): void {
    const s = this.state();
    if (!s || s.category === category) return;
    // Only one starting state: making this one the start turns the old start into an ordinary state,
    // in the same change, so one undo puts both back.
    this.store.commit(updateLifecycle(this.store.def(), (lc) => ({
      ...lc,
      states: lc.states.map((o) => (o.id === s.id ? { ...o, category } : category === 'initial' && o.category === 'initial' ? { ...o, category: 'active' as const } : o)),
    })));
  }
}

/** A transition: who may apply it, when it is possible, what it asks for, and when it happens by itself. */
@Component({
  selector: 'ui-wf-transition-editor',
  imports: [FormsModule, UiInput, UiSwitch, WfAssigneesEditor, WfConditionEditor, WfDurationInput, WfFormField, WfSelect],
  template: `
    @if (transition(); as t) {
      <div class="wf-stack">
        <label class="lw"><span class="wf-label">Button label</span>
          <ui-input size="sm" [ngModel]="t.label" (ngModelChange)="patch({ label: $event }, 'label')" /></label>
        <div class="wf-grid2">
          <label class="lw"><span class="wf-label">From</span>
            <ui-wf-select [options]="fromOptions()" [value]="fromValue()" label="From" (valueChange)="setFrom($event)" /></label>
          <label class="lw"><span class="wf-label">To</span>
            <ui-wf-select [options]="stateOptions()" [value]="t.to" label="To" (valueChange)="patch({ to: $event })" /></label>
        </div>
        @if (t.from !== '*') {
          <details class="more-from"><summary>Starts from several states</summary>
            <div class="multi">@for (s of states(); track s.id) {
              <label class="opt"><input type="checkbox" [checked]="t.from.includes(s.id)" (change)="toggleFrom(s.id, $any($event.target).checked)" />{{ s.label }}</label> }</div>
          </details>
        }

        <section class="wf-section wf-stack">
          <h4 class="wf-section-title">Who can do this</h4>
          <ui-wf-assignees [value]="t.who ?? []" [registry]="store.registry()" [tokens]="tokens()" [api]="store.api()" label="people"
            emptyText="Nobody by hand: only automatically, or from other workflows." (valueChange)="patch({ who: $any($event) })" />
          <label class="wf-row small"><ui-switch size="sm" [ngModel]="!!t.hidden" (ngModelChange)="patch({ hidden: $event || undefined })" /> Hide it from the record page</label>
        </section>

        <section class="wf-section wf-stack">
          <h4 class="wf-section-title">Check before</h4>
          <ui-wf-condition [value]="t.when" [tokens]="checkTokens()" emptyText="Always possible from the states above." (valueChange)="patch({ when: $event.conditions.length ? $event : undefined })" />
        </section>

        <section class="wf-section wf-stack">
          <h4 class="wf-section-title">Ask for</h4>
          <ui-wf-form-field [value]="t.input?.form" [title]="t.label + ' form'" addLabel="Add questions (a form)" (valueChange)="patch({ input: $event ? { form: $event } : undefined })" />
          <label class="lw"><span class="wf-label">Confirmation message</span>
            <ui-input size="sm" [ngModel]="t.confirm ?? ''" (ngModelChange)="patch({ confirm: $event || undefined }, 'confirm')" placeholder="e.g. Approve this application?" /></label>
          <label class="lw"><span class="wf-label">Button colour</span>
            <ui-wf-select [options]="tones" [value]="t.tone ?? 'neutral'" label="Button colour" (valueChange)="patch({ tone: $event === 'neutral' ? undefined : $any($event) })" /></label>
          <label class="lw"><span class="wf-label">Remarks</span>
            <ui-wf-select [options]="remarkOptions()" [value]="t.comment ?? ''" label="Remarks" (valueChange)="patch({ comment: $any($event) || undefined })" /></label>
          <p class="wf-hint">People explain the move in a few words; it shows in the history and steps can use it (“Remarks”). Moves that happen by themselves never ask.</p>
        </section>

        <section class="wf-section wf-stack">
          <h4 class="wf-section-title">Happens by itself</h4>
          <ui-wf-select [options]="autoOptions" [value]="!t.auto ? '' : 'after' in t.auto ? 'after' : 'when'" label="Automatic" (valueChange)="setAuto($event)" />
          @if (t.auto && 'after' in t.auto) {
            <ui-wf-duration [value]="$any(t.auto).after" label="After" (valueChange)="patch({ auto: { ...$any(t.auto), after: $event } })" />
          }
          @if (t.auto && 'when' in t.auto) {
            <ui-wf-condition [value]="$any(t.auto).when" [tokens]="checkTokens()" emptyText="Add the condition." (valueChange)="patch({ auto: { when: $event } })" />
          }
        </section>
        <p class="wf-hint">Edit what happens afterwards (“Then do”) in the steps panel under the diagram.</p>
      </div>
    }
  `,
  styles: [WF_SHARED_STYLES, `
    .lw { display: block; min-width: 0; }
    .small { font-size: 13px; color: var(--ui-color-text-secondary); gap: 8px; cursor: pointer; }
    .multi { display: flex; flex-wrap: wrap; gap: 4px 12px; padding-top: 6px; }
    .opt { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; cursor: pointer; }
    .opt input { accent-color: var(--ui-color-primary); margin: 0; }
    .more-from summary { font-size: 12px; color: var(--ui-color-primary); cursor: pointer; }
  `],
})
export class WfTransitionEditor {
  protected readonly store = inject(WfBuilderStore);
  protected readonly tones = WF_TONE_OPTIONS;
  protected readonly transition = this.store.selectedTransition;
  protected readonly states = computed(() => this.store.def().lifecycle?.states ?? []);
  protected readonly stateOptions = computed<WfOption[]>(() => this.states().map((s) => ({ value: s.id, label: s.label })));
  protected readonly fromOptions = computed<WfOption[]>(() => {
    const from = this.transition()?.from;
    const several = from && from !== '*' && from.length > 1 ? [{ value: '', label: `${from.length} states`, disabled: true }] : [];
    return [{ value: '*', label: 'Any state (not final)' }, ...this.stateOptions(), ...several];
  });
  protected readonly fromValue = computed(() => {
    const from = this.transition()?.from;
    return !from || from === '*' ? '*' : from.length === 1 ? from[0] : '';
  });
  protected readonly remarkOptions = computed<WfOption[]>(() => [
    { value: '', label: `Default (${this.transition()?.tone === 'danger' ? 'optional, as it is red' : 'not asked'})` },
    { value: 'none', label: 'Not asked' }, { value: 'optional', label: 'Optional' }, { value: 'required', label: 'Required' },
  ]);
  protected readonly autoOptions: WfOption[] = [
    { value: '', label: 'No, only when applied' }, { value: 'after', label: 'After some time in the state' }, { value: 'when', label: 'When a condition becomes true' },
  ];
  protected readonly tokens = computed(() => {
    const t = this.transition();
    return this.store.tokens(t ? { listId: `transition:${t.id}`, index: 0 } : undefined);
  });
  /**
   * What "Check before" and an automatic move can read: not the move's form answers, its remarks or
   * who made it, which don't exist yet when the check runs (and never for a move that happens by itself).
   */
  protected readonly checkTokens = computed(() =>
    this.tokens().filter((t) => !t.path.startsWith('input.') && t.path !== 'trigger.comment' && t.path !== 'trigger.actor'));

  protected patch(p: Partial<UiWfTransition>, mergeKey?: string): void {
    const t = this.transition();
    if (!t) return;
    const next = { ...t, ...p } as Record<string, unknown>;
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    this.store.updateTransition(t.id, () => next as unknown as UiWfTransition, mergeKey ? `tr:${t.id}:${mergeKey}` : undefined);
  }

  protected setFrom(v: string): void {
    if (!v) return;
    this.patch({ from: v === '*' ? '*' : [v] });
  }

  protected toggleFrom(id: string, on: boolean): void {
    const t = this.transition();
    if (!t || t.from === '*') return;
    const next = on ? [...new Set([...t.from, id])] : t.from.filter((x) => x !== id);
    if (next.length) this.patch({ from: next });
  }

  protected setAuto(kind: string): void {
    this.patch({ auto: kind === 'after' ? { after: 'P7D' } : kind === 'when' ? { when: { match: 'all', conditions: [] } } : undefined });
  }
}

/** The lifecycle's reset: who may start a record over, back to which state, what it asks, and what else stops. */
@Component({
  selector: 'ui-wf-reset-editor',
  imports: [FormsModule, UiCheckbox, UiInput, UiSelect, UiSwitch, WfAssigneesEditor, WfFormField],
  template: `
    @if (reset(); as r) {
      <div class="wf-stack">
        <p class="wf-hint">Starting over stops the record's open tasks and runs, moves it back, then runs the steps under the diagram (“On reset”), which can change this record, related records and each item of a list.</p>
        <label class="lw"><span class="wf-label">Button label</span>
          <ui-input size="sm" [ngModel]="r.label ?? ''" (ngModelChange)="store.updateReset({ label: $event || undefined }, 'label')" placeholder="Reset workflow" /></label>
        <label class="lw"><span class="wf-label">Back to</span>
          <ui-select size="sm" label="Back to" [options]="stateOptions()" [ngModel]="r.to ?? ''" (ngModelChange)="setBackTo($event)" /></label>

        <section class="wf-section wf-stack">
          <h4 class="wf-section-title">Offer it</h4>
          <ui-select size="sm" label="Offer it" [options]="offerOptions" [ngModel]="r.states ? 'some' : ''" (ngModelChange)="setOffer($event)" />
          @if (r.states) {
            <label class="lw"><span class="wf-label">From</span>
              <ui-select size="sm" label="From" [options]="fromOptions()" [ngModel]="fromState()" placeholder="Choose a state…" (ngModelChange)="offerFrom($event)" /></label>
            <div class="states" role="group" aria-label="States it is offered in">
              @for (s of allStates(); track s.id) {
                <ui-checkbox size="sm" [ngModel]="r.states.includes(s.id)" (ngModelChange)="toggleState(s.id, $event)">{{ s.label }}</ui-checkbox>
              }
            </div>
            @if (!r.states.length) { <p class="wf-hint">Tick at least one state, or nobody can start a record over.</p> }
            @else if (!fromState()) { <p class="wf-hint stale">The ticked states aren’t one state and the ones after it, as the lifecycle is now. Keep them if that is what you meant, or choose a state under “From” to tick its states again.</p> }
          }
        </section>

        <section class="wf-section wf-stack">
          <h4 class="wf-section-title">Who can reset</h4>
          <ui-wf-assignees [value]="r.who ?? []" [registry]="store.registry()" [api]="store.api()" label="people"
            emptyText="Nobody yet: choose who may start records over." (valueChange)="store.updateReset({ who: $any($event) })" />
        </section>

        <section class="wf-section wf-stack">
          <h4 class="wf-section-title">Ask for</h4>
          <ui-wf-form-field [value]="r.input?.form" [title]="(r.label ?? 'Reset') + ' form'" addLabel="Add questions (e.g. a reason)"
            (valueChange)="store.updateReset({ input: $event ? { form: $event } : undefined })" />
          <label class="lw"><span class="wf-label">Confirmation message</span>
            <ui-input size="sm" [ngModel]="r.confirm ?? ''" (ngModelChange)="store.updateReset({ confirm: $event || undefined }, 'confirm')" placeholder="e.g. Start this application over?" /></label>
          <label class="lw"><span class="wf-label">Remarks</span>
            <ui-select size="sm" label="Remarks" [options]="remarkOptions" [ngModel]="r.comment ?? ''" (ngModelChange)="store.updateReset({ comment: $event || undefined })" /></label>
        </section>

        <section class="wf-section wf-stack">
          <h4 class="wf-section-title">What else happens</h4>
          <label class="wf-row small"><ui-switch size="sm" [ngModel]="r.cancelAutomations !== false" (ngModelChange)="store.updateReset({ cancelAutomations: $event ? undefined : false })" />
            Also stop other workflows running about the record</label>
          <label class="wf-row small"><ui-switch size="sm" [ngModel]="!!r.runExitEnter" (ngModelChange)="store.updateReset({ runExitEnter: $event || undefined })" />
            Run the state's “on leaving” and the start's “on entering” steps</label>
        </section>
      </div>
    }
  `,
  styles: [WF_SHARED_STYLES, `
    .lw { display: block; min-width: 0; }
    .small { font-size: 13px; color: var(--ui-color-text-secondary); gap: 8px; cursor: pointer; }
    .states { display: flex; flex-wrap: wrap; gap: var(--ui-space-2) var(--ui-space-4); }
  `],
})
export class WfResetEditor {
  protected readonly store = inject(WfBuilderStore);
  protected readonly reset = computed(() => this.store.def().lifecycle?.reset ?? null);
  protected readonly stateOptions = computed<UiSelectOption[]>(() => {
    const states = this.store.def().lifecycle?.states ?? [];
    const start = states.find((s) => s.category === 'initial');
    return [
      { value: '', label: `The starting state${start ? ` (${start.label})` : ''}` },
      ...states.filter((s) => s.id !== start?.id).map((s) => ({ value: s.id, label: s.label })),
    ];
  });
  protected readonly remarkOptions: UiSelectOption[] = [
    { value: '', label: 'Optional (default)' }, { value: 'required', label: 'Required' }, { value: 'none', label: 'Not asked' },
  ];
  protected readonly offerOptions: UiSelectOption[] = [{ value: '', label: 'In every state' }, { value: 'some', label: 'From a state onwards' }];
  protected readonly allStates = computed(() => this.store.def().lifecycle?.states ?? []);
  protected readonly fromOptions = computed<UiSelectOption[]>(() => this.allStates().map((s) => ({ value: s.id, label: s.label })));
  /** The state whose "onwards" set is exactly what is ticked, if any (so the picker shows it). */
  protected readonly fromState = computed(() => {
    const ticked = this.reset()?.states;
    if (!ticked?.length) return '';
    const set = [...ticked].sort().join(',');
    return this.allStates().find((s) => wfStatesFrom(this.store.def(), s.id).sort().join(',') === set)?.id ?? '';
  });

  protected setOffer(mode: string): void {
    if (mode !== 'some') { this.store.updateReset({ states: undefined }); return; }
    // Start from the first state after the start, the usual choice.
    const lc = this.store.def().lifecycle;
    const first = lc?.transitions.find((t) => t.from !== '*' && t.from.some((f) => lc.states.find((s) => s.id === f)?.category === 'initial'))?.to ?? lc?.states[0]?.id;
    this.store.updateReset({ states: first ? wfStatesFrom(this.store.def(), first) : [] });
  }

  /**
   * Changes where the reset goes back to. When the ticks were "from a state onwards", they are worked
   * out again for the new target in the same change (the onward states stop at the reset's target).
   */
  protected setBackTo(value: string | null): void {
    const to = value || undefined;
    const reset = this.reset();
    if (!reset || (reset.to ?? undefined) === to) return;
    const from = this.fromState();
    if (!from) { this.store.updateReset({ to }); return; }
    const next = updateLifecycle(this.store.def(), (lc) => ({ ...lc, reset: { ...lc.reset!, to } }));
    this.store.updateReset({ to, states: wfStatesFrom(next, from) });
  }

  protected offerFrom(stateId: string): void {
    if (stateId) this.store.updateReset({ states: wfStatesFrom(this.store.def(), stateId) });
  }

  protected toggleState(id: string, on: boolean): void {
    const cur = (this.reset()?.states ?? []).filter((x) => x !== id);
    const order = this.allStates().map((s) => s.id);
    this.store.updateReset({ states: (on ? [...cur, id] : cur).sort((a, b) => order.indexOf(a) - order.indexOf(b)) });
  }
}

/** The right-hand panel: settings for whatever is selected, with a short header and problems. */
@Component({
  selector: 'ui-wf-inspector',
  host: { '[class.in-sheet]': '!showHead()' },
  imports: [HugeiconsIconComponent, WfStepEditor, WfTriggerEditor, WfWorkflowEditor, WfStateEditor, WfTransitionEditor, WfResetEditor],
  template: `
    @if (showHead()) {
      <header class="head">
        @if (parentLabel(); as p) { <button type="button" class="wf-link back" (click)="selectParent()">‹ {{ p }}</button> }
        <div class="wf-row">
          <span class="ico"><hugeicons-icon aria-hidden="true" [icon]="icon()" [size]="15" [strokeWidth]="1.8" /></span>
          <h2>{{ heading() }}</h2>
          @if (canDelete()) {
            <button type="button" class="wf-icon-btn danger" (click)="deleteRequest.emit()" [attr.aria-label]="'Delete ' + heading()">
              <hugeicons-icon aria-hidden="true" [icon]="icons.Delete02Icon" [size]="15" [strokeWidth]="1.8" />
            </button>
          }
        </div>
      </header>
    } @else if (parentLabel(); as p) {
      <!-- In the phone sheet the title (and Delete) are the sheet's own; the way back up still belongs here. -->
      <div class="sheet-bar"><button type="button" class="wf-link back" (click)="selectParent()">‹ {{ p }}</button></div>
    }
    <div class="body">
      @if (problems().length) {
        <ul class="problems" role="list">
          @for (p of problems(); track $index) { <li [class.warn]="p.severity === 'warning'">{{ p.message }}</li> }
        </ul>
      }
      <!-- Someone only looking sees every setting, but none of the controls take input. -->
      <fieldset class="fields" [disabled]="store.readOnly()">
        @switch (kind()) {
          @case ('step') { @if (store.selectedStep(); as s) { <ui-wf-step-editor [step]="s" /> } }
          @case ('trigger') { <ui-wf-trigger-editor /> }
          @case ('state') { <ui-wf-state-editor /> }
          @case ('transition') { <ui-wf-transition-editor /> }
          @case ('reset') { <ui-wf-reset-editor /> }
          @default { <ui-wf-workflow-editor /> }
        }
      </fieldset>
    </div>
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; min-height: 0; container-type: inline-size; }
    .head { flex: none; display: flex; flex-direction: column; gap: 2px; padding: var(--ui-space-3) var(--ui-space-3) var(--ui-space-2); border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .back { align-self: flex-start; }
    .sheet-bar { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2); padding: 0 var(--ui-space-3) var(--ui-space-2);
      border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    h2 { flex: 1; margin: 0; font-size: 14px; font-weight: 650; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ico { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 6px; color: var(--ui-color-primary); background: color-mix(in srgb, var(--ui-color-primary) 12%, transparent); }
    .body { flex: 1; min-height: 0; overflow: auto; padding: var(--ui-space-3); }
    .fields { min-width: 0; margin: 0; padding: 0; border: 0; }
    /* In the phone sheet the sheet's body gives the side padding (as a modal's does), so the settings line up with its title. */
    :host(.in-sheet) .sheet-bar { padding-left: 0; padding-right: 0; }
    :host(.in-sheet) .body { padding-left: 0; padding-right: 0; }
    .problems { margin: 0 0 var(--ui-space-3); padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
    .problems li { padding: 6px 8px; border-radius: var(--ui-radius-xs); font-size: 12.5px; line-height: 1.4;
      background: color-mix(in srgb, var(--ui-color-danger) 10%, transparent); color: var(--ui-color-text); border-left: 3px solid var(--ui-color-danger); }
    .problems li.warn { background: color-mix(in srgb, var(--ui-color-warning) 12%, transparent); border-left-color: var(--ui-color-warning); }
  `],
})
export class WfInspector {
  protected readonly store = inject(WfBuilderStore);
  readonly showHead = input(true);
  readonly deleteRequest = output<void>();
  protected readonly icons = WF_ICONS;
  protected readonly kind = computed(() => this.store.selection()?.kind ?? 'workflow');
  protected readonly heading = computed(() => {
    switch (this.kind()) {
      case 'step': { const s = this.store.selectedStep(); return s ? stepName(s) : 'Step'; }
      case 'trigger': return 'What starts it';
      case 'state': return this.store.selectedState()?.label ?? 'State';
      case 'transition': return this.store.selectedTransition()?.label ?? 'Transition';
      case 'reset': return this.store.def().lifecycle?.reset?.label ?? 'Reset workflow';
      default: return this.store.def().kind === 'lifecycle' ? 'Lifecycle settings' : 'Workflow settings';
    }
  });
  protected readonly icon = computed(() => {
    switch (this.kind()) {
      case 'step': return WF_STEP_ICONS[this.store.selectedStep()?.type ?? ''] ?? WF_ICONS.FlashIcon;
      case 'trigger': return WF_ICONS.FlashIcon;
      case 'state': return WF_ICONS.Flag01Icon;
      case 'transition': return WF_ICONS.ArrowRight02Icon;
      case 'reset': return WF_ICONS.RefreshIcon;
      default: return WF_ICONS.Settings02Icon;
    }
  });
  protected readonly canDelete = computed(() => !this.store.readOnly() && ['step', 'state', 'transition', 'reset'].includes(this.kind()));
  protected readonly problems = computed(() => {
    const s = this.store.selection();
    // Reset problems have no node of their own; they show with the workflow's.
    const node = !s || s.kind === 'workflow' || s.kind === 'trigger' || s.kind === 'reset' ? null : s.id;
    return this.store.problemsByNode().get(node) ?? [];
  });
  /** For a step inside a lifecycle run: the state or transition it belongs to. */
  protected readonly parent = computed(() => {
    const s = this.store.selection();
    if (s?.kind !== 'step') return null;
    const loc = indexSteps(this.store.def()).get(s.id);
    const root = loc?.path[0];
    if (!root || root === 'root') return null;
    const lc = this.store.def().lifecycle;
    if (root === 'reset') return lc?.reset ? { kind: 'reset' as const, id: '', label: lc.reset.label ?? 'Reset workflow' } : null;
    const [kind, id] = root.split(':');
    if (kind === 'transition') { const t = lc?.transitions.find((x) => x.id === id); return t ? { kind: 'transition' as const, id, label: t.label } : null; }
    const st = lc?.states.find((x) => x.id === id);
    return st ? { kind: 'state' as const, id, label: st.label } : null;
  });
  protected readonly parentLabel = computed(() => this.parent()?.label ?? null);

  protected selectParent(): void {
    const p = this.parent();
    if (!p) return;
    this.store.selection.set(p.kind === 'reset' ? { kind: 'reset' } : { kind: p.kind, id: p.id });
  }
}
