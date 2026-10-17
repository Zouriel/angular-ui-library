import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton } from '@zouriel/ui/button';
import { UiCombobox } from '@zouriel/ui/combobox';
import { UiDatePicker } from '@zouriel/ui/datepicker';
import { UiCheckbox, UiInput, UiNumberInput, UiSwitch, UiTimePicker } from '@zouriel/ui/form';
import { UiWfApiError, injectWorkflowApi, type UiWfTriggerOverview, type UiWorkflowApi } from './api';
import { WfDurationInput } from './editors';
import { WF_ICONS } from './icons';
import type { UiWorkflowRegistry, UiWorkflowSettings } from './schema';
import { WF_SHARED_STYLES } from './styles';

type Section = 'time' | 'defaults' | 'channels' | 'webhooks' | 'audit' | 'watching' | 'registry';
type Day = NonNullable<NonNullable<UiWorkflowSettings['calendar']>['days']>[number];

const DAYS: { value: Day; label: string }[] = [
  { value: 'mon', label: 'Mon' }, { value: 'tue', label: 'Tue' }, { value: 'wed', label: 'Wed' }, { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' }, { value: 'sat', label: 'Sat' }, { value: 'sun', label: 'Sun' },
];

/** Audit categories whose entries can be removed after a while, with names for people. */
const AUDIT_CATEGORIES: { value: string; label: string }[] = [
  { value: 'step', label: 'Steps' }, { value: 'instance', label: 'Runs' }, { value: 'task', label: 'Tasks and approvals' },
  { value: 'lifecycle', label: 'Record moves' }, { value: 'trigger', label: 'Triggers' }, { value: 'definition', label: 'Workflow changes' },
  { value: 'settings', label: 'Settings changes' },
];

type Settings = UiWorkflowSettings;

/** The settings with a record type paused or resumed. */
function withPaused(st: Settings, entity: string, on: boolean): Settings {
  const list = (st.paused ?? []).filter((p) => p.entity !== entity);
  const next = { ...st, paused: on ? [...list, { entity }] : list } as Record<string, unknown>;
  if (!(next['paused'] as unknown[]).length) delete next['paused'];
  return next as unknown as Settings;
}

/**
 * `ui-workflow-global-settings` — the app's workflow settings page: working hours and holidays,
 * defaults for new steps, notification channels, which addresses webhooks may call, audit
 * retention and masking, pausing triggers per record type, what is being watched, and what the
 * app allows workflows to use. Saves through the API (with a revision check) or two-way binds
 * `settings` when there is no API.
 */
@Component({
  selector: 'ui-workflow-global-settings',
  imports: [FormsModule, HugeiconsIconComponent, UiButton, UiCheckbox, UiCombobox, UiDatePicker, UiInput, UiNumberInput, UiSwitch, UiTimePicker, WfDurationInput],
  template: `
    <nav class="nav" aria-label="Settings sections">
      @for (s of sections; track s.value) {
        <button type="button" [class.on]="section() === s.value" [attr.aria-current]="section() === s.value ? 'page' : null" (click)="section.set(s.value)">{{ s.label }}</button>
      }
    </nav>
    <div class="body">
      @switch (section()) {
        @case ('time') {
          <h2>Time and working hours</h2>
          <p class="wf-hint">Deadlines, reminders and time limits marked “working time” only count these hours.</p>
          <div class="lw zone"><span class="wf-label">Time zone</span>
            <ui-combobox size="sm" label="Time zone" placeholder="Search time zones" [options]="zoneOptions()" [clearable]="false"
              [ngModel]="s().timeZone ?? 'UTC'" (ngModelChange)="$event && patch({ timeZone: $event })" /></div>
          <div><span class="wf-label">Working days</span>
            <div class="days">@for (d of days; track d.value) {
              <ui-checkbox [ngModel]="workDays().includes(d.value)" (ngModelChange)="toggleDay(d.value, $event)">{{ d.label }}</ui-checkbox> }</div></div>
          <div class="wf-grid2">
            <label class="lw"><span class="wf-label">From</span><ui-time-picker [ngModel]="hours()[0]" (ngModelChange)="setHours(0, $event)" /></label>
            <label class="lw"><span class="wf-label">To</span><ui-time-picker [ngModel]="hours()[1]" (ngModelChange)="setHours(1, $event)" /></label>
          </div>
          <div><span class="wf-label">Holidays</span>
            <ul class="items">@for (h of s().calendar?.holidays ?? []; track h) {
              <li>{{ h }} <button type="button" class="wf-icon-btn danger" (click)="removeHoliday(h)" [attr.aria-label]="'Remove ' + h"><hugeicons-icon aria-hidden="true" [icon]="icons.Cancel01Icon" [size]="12" [strokeWidth]="2" /></button></li> }</ul>
            <div class="holiday"><ui-date-picker size="sm" placeholder="Add a holiday" [ngModel]="holidayDraft()" (ngModelChange)="pickHoliday($event)" aria-label="Holiday date" /></div>
          </div>
        }
        @case ('defaults') {
          <h2>Defaults</h2>
          <div><span class="wf-label">Tasks are due within</span><ui-wf-duration [value]="s().defaults?.taskDue ?? 'P3D'" label="Task due" (valueChange)="patchDefaults({ taskDue: $event })" /></div>
          <div><span class="wf-label">Reminder before then</span><ui-wf-duration [value]="s().defaults?.reminders?.[0] ?? 'P1D'" label="Reminder" (valueChange)="patchDefaults({ reminders: [$event] })" /></div>
          <div class="wf-grid2">
            <label class="lw"><span class="wf-label">Retry failed calls</span><ui-number-input size="sm" [ngModel]="s().defaults?.retry?.max ?? 0" (ngModelChange)="patchDefaults({ retry: { ...(s().defaults?.retry ?? {}), max: $event ?? 0, backoff: 'exponential', initial: s().defaults?.retry?.initial ?? 'PT1M' } })" [min]="0" [max]="10" suffix="times" /></label>
            <label class="lw"><span class="wf-label">At most, for each</span><ui-number-input size="sm" [ngModel]="s().defaults?.forEachMax ?? 500" (ngModelChange)="patchDefaults({ forEachMax: $event ?? 500 })" [min]="1" [max]="500" suffix="items" /></label>
          </div>
          <label class="lw"><span class="wf-label">A workflow starts again for the same record while running</span>
            <select class="wf-select" (change)="patchDefaults({ concurrency: $any($event.target).value })">
              <option value="perRecordSerial" [selected]="(s().defaults?.concurrency ?? 'perRecordSerial') === 'perRecordSerial'">Wait for the earlier run</option>
              <option value="parallel" [selected]="s().defaults?.concurrency === 'parallel'">Run both</option>
              <option value="skipIfRunning" [selected]="s().defaults?.concurrency === 'skipIfRunning'">Don’t start it again</option>
            </select></label>
          <label class="lw"><span class="wf-label">Stop chains of workflows starting workflows after</span>
            <ui-number-input size="sm" [ngModel]="s().defaults?.maxChainDepth ?? 5" (ngModelChange)="patchDefaults({ maxChainDepth: $event ?? 5 })" [min]="1" [max]="20" suffix="levels" /></label>
          <label class="wf-row small"><ui-switch [ngModel]="!!s().people?.delegation" (ngModelChange)="patch({ people: { ...s().people, delegation: $event || undefined } })" /> People may hand tasks to someone else</label>
        }
        @case ('channels') {
          <h2>Notification channels</h2>
          <p class="wf-hint">The channels your app sends through. Switch one off to stop workflows using it.</p>
          @for (c of registry()?.channels ?? []; track c.key) {
            <div class="card">
              <label class="wf-row small"><ui-switch [ngModel]="s().channels?.[c.key]?.enabled !== false" (ngModelChange)="patchChannel(c.key, { enabled: $event ? undefined : false })" /> <strong>{{ c.label }}</strong></label>
              <label class="lw"><span class="wf-label">Footer added to every message</span>
                <ui-input size="sm" [ngModel]="s().channels?.[c.key]?.footer ?? ''" (ngModelChange)="patchChannel(c.key, { footer: $event || undefined })" /></label>
            </div>
          } @empty { <p class="wf-hint">The app has not registered any channels.</p> }
        }
        @case ('webhooks') {
          <h2>Webhooks</h2>
          <p class="wf-hint">Workflows can only call these addresses. Secrets stay on the server; a connection only names one.</p>
          <div><span class="wf-label">Allowed addresses</span>
            <ul class="items">@for (o of s().webhooks?.allowedOrigins ?? []; track o) {
              <li><code>{{ o }}</code><button type="button" class="wf-icon-btn danger" (click)="removeOrigin(o)" [attr.aria-label]="'Remove ' + o"><hugeicons-icon aria-hidden="true" [icon]="icons.Cancel01Icon" [size]="12" [strokeWidth]="2" /></button></li> }</ul>
            <div class="wf-row"><ui-input size="sm" placeholder="https://hooks.example.com" [ngModel]="newOrigin()" (ngModelChange)="newOrigin.set($event)" (keydown.enter)="addOrigin()" aria-label="Address" />
              <button type="button" class="wf-link" (click)="addOrigin()">Add</button></div>
            @if (originError()) { <p class="wf-error">{{ originError() }}</p> }
          </div>
          <div><span class="wf-label">Connections</span>
            @for (c of s().webhooks?.connections ?? []; track $index; let i = $index) {
              <div class="card conn">
                <ui-input size="sm" [ngModel]="c.label" (ngModelChange)="patchConnection(i, { label: $event })" placeholder="Name" aria-label="Name" />
                <ui-input size="sm" [ngModel]="c.baseUrl" (ngModelChange)="patchConnection(i, { baseUrl: $event })" placeholder="https://erp.example.com/api" aria-label="Base address" />
                <select class="wf-select" (change)="patchConnection(i, { auth: $any($event.target).value })" aria-label="Sign-in">
                  <option value="none" [selected]="(c.auth ?? 'none') === 'none'">No secret</option>
                  <option value="secret" [selected]="c.auth === 'secret'">Uses a secret</option>
                </select>
                @if (c.auth === 'secret') {
                  <ui-input size="sm" [ngModel]="c.secretName ?? ''" (ngModelChange)="patchConnection(i, { secretName: $event })" placeholder="Secret name (set on the server)" aria-label="Secret name" />
                }
                <button type="button" class="wf-link danger" (click)="removeConnection(i)">Remove</button>
              </div>
            }
            <button type="button" class="wf-link" (click)="addConnection()">Add a connection</button>
          </div>
        }
        @case ('audit') {
          <h2>Audit log</h2>
          <p class="wf-hint">Every change and decision is recorded in a tamper-evident chain. Old entries can be removed after a while; the chain stays checkable.</p>
          <div class="retention">
            @for (c of auditCategories; track c.value) {
              <label class="lw"><span class="wf-label">{{ c.label }}</span>
                <ui-number-input size="sm" [ngModel]="s().audit?.retentionDays?.[c.value] ?? null" (ngModelChange)="setRetention(c.value, $event)" [min]="1" suffix="days" placeholder="Keep" [ariaLabel]="c.label + ': days to keep'" /></label>
            }
          </div>
          <div><span class="wf-label">Hide these values in the log and run views</span>
            <ul class="items">@for (m of s().audit?.maskedFields ?? []; track m) {
              <li><code>{{ m }}</code><button type="button" class="wf-icon-btn danger" (click)="removeMasked(m)" [attr.aria-label]="'Stop hiding ' + m"><hugeicons-icon aria-hidden="true" [icon]="icons.Cancel01Icon" [size]="12" [strokeWidth]="2" /></button></li> }</ul>
            <select class="wf-select" (change)="addMasked($any($event.target).value); $any($event.target).value = ''" aria-label="Add a field to hide">
              <option value="">Add a field…</option>
              @for (f of maskable(); track f.value) { <option [value]="f.value">{{ f.label }}</option> }
            </select>
            <p class="wf-hint">Fields the app marks as sensitive are always hidden.</p>
          </div>
        }
        @case ('watching') {
          <h2>What is being watched</h2>
          <p class="wf-hint">Every published workflow and what starts it, by record type. Pause a record type to stop new runs while you sort something out; pausing saves at once and leaves other unsaved changes as they are.</p>
          @if (error()) { <p class="wf-error" role="alert">{{ error() }}</p> } @else if (status()) { <p class="wf-hint" role="status">{{ status() }}</p> }
          @for (g of watchGroups(); track g.entity) {
            <div class="card">
              <div class="wf-row"><strong class="grow">{{ g.label }}</strong>
                <label class="wf-row small"><ui-switch [ngModel]="isPaused(g.entity)" (ngModelChange)="setPaused(g.entity, $event)" [disabled]="busy()" /> Paused</label></div>
              <ul class="watch">@for (t of g.triggers; track t.definitionId) {
                <li [class.conflict]="conflicts().has(t.definitionId)"><span class="wf-chip">{{ t.kind === 'lifecycle' ? 'Lifecycle' : 'Automation' }}</span> {{ t.title }} <span class="sum">— {{ t.summary }}</span></li> }</ul>
              @if (g.conflict) { <p class="wf-warn">Two workflows start on the same change here. Check they don’t work against each other.</p> }
            </div>
          } @empty { <p class="wf-hint">Nothing is published yet.</p> }
        }
        @case ('registry') {
          <h2>What workflows can use</h2>
          <p class="wf-hint">Set by the app’s developers. Ask them to add a record type, field or action.</p>
          @for (e of registry()?.entities ?? []; track e.key) {
            <details class="card"><summary><strong>{{ e.label }}</strong> <span class="sum">{{ e.fields.length }} fields</span></summary>
              <table class="fields"><thead><tr><th>Field</th><th>Type</th><th>Watch</th><th>Change</th></tr></thead><tbody>
                @for (f of e.fields; track f.key) { <tr><td>{{ f.label }}@if (f.sensitive) { <span class="wf-chip" data-tone="warning">sensitive</span> }@if (f.lifecycle) { <span class="wf-chip" data-tone="info">lifecycle</span> }</td><td>{{ f.type }}</td><td>{{ f.watchable ? 'Yes' : '' }}</td><td>{{ f.settable ? 'Yes' : '' }}</td></tr> }
              </tbody></table></details>
          }
          @if (registry()?.actions?.length) {
            <h3>Actions</h3>
            <ul class="plain">@for (a of registry()!.actions!; track a.key) { <li><strong>{{ a.label }}</strong> <span class="sum">{{ a.description }}</span></li> }</ul>
          }
          @if (registry()?.signals?.length) {
            <h3>Events</h3>
            <ul class="plain">@for (sg of registry()!.signals!; track sg.key) { <li>{{ sg.label }}</li> }</ul>
          }
        }
      }
    </div>
    @if (section() !== 'watching' && section() !== 'registry') {
      <footer class="foot">
        @if (error()) { <p class="wf-error grow" role="alert">{{ error() }}</p> } @else { <span class="wf-hint grow">{{ status() }}</span> }
        <ui-button size="sm" variant="ghost" (click)="discard()" [disabled]="!dirty() || busy()">Discard</ui-button>
        <ui-button size="sm" (click)="save()" [disabled]="!dirty() || busy()">Save settings</ui-button>
      </footer>
    }
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: grid; grid-template-columns: 200px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; min-height: 420px; border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); background: var(--ui-color-bg); color: var(--ui-color-text); font-size: 13.5px; overflow: hidden; container-type: inline-size; }
    .nav { grid-row: 1 / 3; display: flex; flex-direction: column; gap: 2px; padding: var(--ui-space-2); background: var(--ui-color-surface); border-right: 1px solid var(--ui-color-border); }
    .nav button { height: 30px; padding: 0 10px; border: 0; border-radius: var(--ui-radius-xs); background: transparent; color: var(--ui-color-text-secondary); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
    .nav button:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .nav button.on { background: color-mix(in srgb, var(--ui-color-primary) 12%, transparent); color: var(--ui-color-text); font-weight: 600; }
    .nav button:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .body { overflow: auto; padding: var(--ui-space-4); display: flex; flex-direction: column; gap: var(--ui-space-3); max-width: 760px; }
    h2 { margin: 0; font-size: 16px; font-weight: 650; }
    h3 { margin: var(--ui-space-2) 0 0; font-size: 13px; }
    .lw { display: block; min-width: 0; }
    .zone ui-combobox { display: block; max-width: 360px; }
    .holiday { max-width: 220px; }
    .days { display: flex; flex-wrap: wrap; gap: 6px 14px; }
    .items { margin: 0 0 6px; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 4px; }
    .items li { display: inline-flex; align-items: center; gap: 2px; padding-left: 8px; border-radius: var(--ui-radius-xs); background: var(--ui-color-surface-hover); font-size: 12.5px; }
    .card { display: flex; flex-direction: column; gap: 6px; padding: var(--ui-space-2) var(--ui-space-3); background: var(--ui-color-surface); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
    .conn { display: grid; grid-template-columns: 1fr 1.6fr; gap: 6px; }
    .conn .wf-link { justify-self: start; }
    .danger { color: var(--ui-color-danger); }
    .small { font-size: 13px; color: var(--ui-color-text-secondary); gap: 8px; cursor: pointer; }
    .grow { flex: 1; }
    .retention { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
    .watch { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
    .watch li.conflict { color: var(--ui-color-warning); }
    .sum { margin-left: 6px; color: var(--ui-color-text-muted); font-size: 12.5px; }
    .fields { width: 100%; margin-top: 6px; border-collapse: collapse; font-size: 12.5px; }
    .fields th, .fields td { padding: 4px 6px; text-align: left; border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .fields th { color: var(--ui-color-text-muted); font-weight: 550; }
    details summary { cursor: pointer; }
    .plain { margin: 0; padding-left: var(--ui-space-4); }
    .foot { display: flex; align-items: center; gap: 8px; padding: 8px var(--ui-space-4); border-top: 1px solid var(--ui-color-border); background: var(--ui-color-surface); }
    .foot .wf-error { margin: 0; }
    @container (max-width: 620px) {
      :host { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr) auto; }
      .nav { grid-row: auto; flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--ui-color-border); }
      .nav button { flex: none; }
      .conn { grid-template-columns: 1fr; }
    }
  `],
})
export class UiWorkflowGlobalSettings {
  readonly api = input<UiWorkflowApi | null>(null);
  /** The app's registry (for channels, fields to mask, the read-only browser), when there is no API. */
  readonly registryInput = input<UiWorkflowRegistry | null>(null, { alias: 'registry' });
  /** Settings to edit when there is no API (and the result, via `settingsChange`). */
  readonly settings = input<UiWorkflowSettings | null>(null);
  readonly settingsChange = output<UiWorkflowSettings>();
  private readonly provided = injectWorkflowApi();
  protected readonly client = computed(() => this.api() ?? this.provided);
  protected readonly icons = WF_ICONS;
  protected readonly days = DAYS;
  protected readonly auditCategories = AUDIT_CATEGORIES;
  protected readonly sections: { value: Section; label: string }[] = [
    { value: 'time', label: 'Time & calendar' }, { value: 'defaults', label: 'Defaults' }, { value: 'channels', label: 'Channels' },
    { value: 'webhooks', label: 'Webhooks' }, { value: 'audit', label: 'Audit log' }, { value: 'watching', label: 'Watching' }, { value: 'registry', label: 'What’s available' },
  ];
  /** IANA zones the browser knows. `supportedValuesOf` leaves out UTC itself, so it is added first. */
  private readonly zones = (() => {
    let list: string[] = [];
    try {
      list = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
    } catch {
      list = [];
    }
    return ['UTC', ...list.filter((z) => z !== 'UTC')];
  })();
  /** The zones to choose from, keeping a saved zone this browser doesn't list. */
  protected readonly zoneOptions = computed(() => {
    const cur = this.s().timeZone;
    const list = cur && !this.zones.includes(cur) ? [cur, ...this.zones] : this.zones;
    return list.map((z) => ({ value: z, label: z === 'UTC' ? 'UTC (Coordinated Universal Time)' : z.replace(/_/g, ' ') }));
  });
  protected readonly holidayDraft = signal<string | null>(null);
  protected readonly section = signal<Section>('time');
  protected readonly s = signal<UiWorkflowSettings>({ version: 1 });
  private readonly saved = signal<string>(JSON.stringify({ version: 1 }));
  private readonly revision = signal(0);
  protected readonly registry = signal<UiWorkflowRegistry | null>(null);
  protected readonly triggers = signal<UiWfTriggerOverview[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly status = signal('');
  protected readonly newOrigin = signal('');
  protected readonly originError = signal('');
  protected readonly dirty = computed(() => JSON.stringify(this.s()) !== this.saved());
  protected readonly workDays = computed(() => this.s().calendar?.days ?? ['mon', 'tue', 'wed', 'thu', 'fri']);
  protected readonly hours = computed<[string, string]>(() => this.s().calendar?.hours ?? ['09:00', '17:00']);
  protected readonly maskable = computed(() => {
    const out: { value: string; label: string }[] = [];
    const taken = new Set(this.s().audit?.maskedFields ?? []);
    for (const e of this.registry()?.entities ?? [])
      for (const f of e.fields) if (!f.sensitive && !taken.has(`${e.key}.${f.key}`) && f.type !== 'collection') out.push({ value: `${e.key}.${f.key}`, label: `${e.label} › ${f.label}` });
    return out;
  });
  protected readonly watchGroups = computed(() => {
    const m = new Map<string, UiWfTriggerOverview[]>();
    for (const t of this.triggers()) m.set(t.entity ?? '', [...(m.get(t.entity ?? '') ?? []), t]);
    return [...m].map(([entity, triggers]) => ({
      entity, triggers,
      label: this.registry()?.entities.find((e) => e.key === entity)?.label ?? (entity || 'Not about a record'),
      conflict: triggers.some((a, i) => triggers.some((b, j) => j > i && a.type === b.type && a.type !== 'lifecycle' && a.field === b.field && a.field)),
    }));
  });
  protected readonly conflicts = computed(() => {
    const ids = new Set<string>();
    const ts = this.triggers();
    for (const a of ts) for (const b of ts) if (a !== b && a.entity === b.entity && a.type === b.type && a.field && a.field === b.field && a.type !== 'lifecycle') ids.add(a.definitionId);
    return ids;
  });

  constructor() {
    effect(() => {
      const api = this.client();
      untracked(() => void this.load(api));
    });
    effect(() => {
      const s = this.settings();
      if (s && !this.client()) untracked(() => { this.s.set(s); this.saved.set(JSON.stringify(s)); });
    });
    effect(() => { const r = this.registryInput(); if (r) this.registry.set(r); });
  }

  private async load(api: UiWorkflowApi | null): Promise<void> {
    if (!api) return;
    try {
      const [st, schema, triggers] = await Promise.all([api.settings(), this.registryInput() ? Promise.resolve(null) : api.schema(), api.triggers().catch(() => [])]);
      this.s.set(st.settings);
      this.saved.set(JSON.stringify(st.settings));
      this.revision.set(st.revision);
      if (schema) this.registry.set(schema.registry);
      this.triggers.set(triggers);
    } catch (e) {
      this.error.set(e instanceof UiWfApiError ? e.message : 'Could not load the settings.');
    }
  }

  protected patch(p: Partial<UiWorkflowSettings>): void {
    const next = { ...this.s(), ...p } as Record<string, unknown>;
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    this.s.set(next as unknown as UiWorkflowSettings);
    this.status.set('');
  }

  protected patchDefaults(p: NonNullable<UiWorkflowSettings['defaults']>): void {
    this.patch({ defaults: { ...(this.s().defaults ?? {}), ...p } });
  }

  protected toggleDay(d: Day, on: boolean): void {
    const days = DAYS.map((x) => x.value).filter((x) => (x === d ? on : this.workDays().includes(x)));
    this.patch({ calendar: { ...(this.s().calendar ?? {}), days } });
  }

  protected setHours(i: 0 | 1, v: string): void {
    // The time field reports each keystroke; only whole times are kept.
    if (!/^\d{2}:\d{2}$/.test(v ?? '') || v === this.hours()[i]) return;
    const h: [string, string] = [...this.hours()];
    h[i] = v;
    this.patch({ calendar: { ...(this.s().calendar ?? {}), hours: h } });
  }

  protected addHoliday(d: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    const list = [...new Set([...(this.s().calendar?.holidays ?? []), d])].sort();
    this.patch({ calendar: { ...(this.s().calendar ?? {}), holidays: list } });
  }

  protected pickHoliday(d: string | null): void {
    this.holidayDraft.set(d);
    if (!d) return;
    this.addHoliday(d);
    // Empty the picker again for the next one.
    setTimeout(() => this.holidayDraft.set(null));
  }

  protected removeHoliday(d: string): void {
    this.patch({ calendar: { ...(this.s().calendar ?? {}), holidays: (this.s().calendar?.holidays ?? []).filter((x) => x !== d) } });
  }

  protected patchChannel(key: string, p: { enabled?: boolean; footer?: string }): void {
    const cur = { ...(this.s().channels?.[key] ?? {}), ...p } as Record<string, unknown>;
    for (const k of Object.keys(cur)) if (cur[k] === undefined) delete cur[k];
    this.patch({ channels: { ...(this.s().channels ?? {}), [key]: cur } });
  }

  protected addOrigin(): void {
    const v = this.newOrigin().trim().replace(/\/+$/, '');
    if (!/^https?:\/\/[^/\s]+$/.test(v)) { this.originError.set('Enter an address like https://hooks.example.com (no path).'); return; }
    this.originError.set('');
    this.newOrigin.set('');
    this.patch({ webhooks: { ...(this.s().webhooks ?? {}), allowedOrigins: [...new Set([...(this.s().webhooks?.allowedOrigins ?? []), v])] } });
  }

  protected removeOrigin(o: string): void {
    this.patch({ webhooks: { ...(this.s().webhooks ?? {}), allowedOrigins: (this.s().webhooks?.allowedOrigins ?? []).filter((x) => x !== o) } });
  }

  protected addConnection(): void {
    const list = this.s().webhooks?.connections ?? [];
    const key = `connection${list.length + 1}`;
    this.patch({ webhooks: { ...(this.s().webhooks ?? {}), connections: [...list, { key, label: `Connection ${list.length + 1}`, baseUrl: 'https://', auth: 'none' }] } });
  }

  protected patchConnection(i: number, p: Record<string, unknown>): void {
    const list = (this.s().webhooks?.connections ?? []).map((c, j) => {
      if (j !== i) return c;
      const n = { ...c, ...p } as typeof c;
      if (p['label'] !== undefined) n.key = String(p['label']).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').map((w, k) => (k ? w[0]?.toUpperCase() + w.slice(1) : w.toLowerCase())).join('') || c.key;
      return n;
    });
    this.patch({ webhooks: { ...(this.s().webhooks ?? {}), connections: list } });
  }

  protected removeConnection(i: number): void {
    this.patch({ webhooks: { ...(this.s().webhooks ?? {}), connections: (this.s().webhooks?.connections ?? []).filter((_, j) => j !== i) } });
  }

  protected setRetention(category: string, days: number | null): void {
    const r = { ...(this.s().audit?.retentionDays ?? {}) };
    if (days && days > 0) r[category] = days; else delete r[category];
    this.patch({ audit: { ...(this.s().audit ?? {}), retentionDays: r } });
  }

  protected addMasked(v: string): void {
    if (!v) return;
    this.patch({ audit: { ...(this.s().audit ?? {}), maskedFields: [...(this.s().audit?.maskedFields ?? []), v] } });
  }

  protected removeMasked(v: string): void {
    this.patch({ audit: { ...(this.s().audit ?? {}), maskedFields: (this.s().audit?.maskedFields ?? []).filter((x) => x !== v) } });
  }

  protected isPaused(entity: string): boolean {
    return !!this.s().paused?.some((p) => p.entity === entity);
  }

  /**
   * Pauses or resumes a record type at once. Only that change is saved: it is applied to the last
   * saved settings, and any other edits on the page stay unsaved, as they were.
   */
  protected async setPaused(entity: string, on: boolean): Promise<void> {
    if (this.busy() || this.isPaused(entity) === on) return;
    const toSave = withPaused(JSON.parse(this.saved()) as Settings, entity, on);
    this.s.set(withPaused(this.s(), entity, on));
    this.error.set('');
    const api = this.client();
    if (!api) {
      this.saved.set(JSON.stringify(toSave));
      this.settingsChange.emit(toSave);
      this.status.set(on ? 'Paused.' : 'Running again.');
      return;
    }
    this.busy.set(true);
    try {
      const r = await api.saveSettings(toSave, this.revision());
      this.revision.set(r.revision);
      this.saved.set(JSON.stringify(toSave));
      this.settingsChange.emit(toSave);
      this.status.set(`${on ? 'Paused.' : 'Running again.'}${this.dirty() ? ' Your other changes are not saved yet.' : ''}`);
    } catch (e) {
      // Put the switch back; the rest of the page keeps its edits.
      this.s.set(withPaused(this.s(), entity, !on));
      this.error.set(e instanceof UiWfApiError ? e.message : 'Saving failed.');
    } finally {
      this.busy.set(false);
    }
  }

  protected discard(): void {
    this.s.set(JSON.parse(this.saved()));
    this.error.set('');
  }

  async save(): Promise<void> {
    if (this.busy()) return;
    const api = this.client();
    this.error.set('');
    if (!api) {
      this.saved.set(JSON.stringify(this.s()));
      this.settingsChange.emit(this.s());
      this.status.set('Saved.');
      return;
    }
    this.busy.set(true);
    const sent = this.s();
    try {
      const r = await api.saveSettings(sent, this.revision());
      this.revision.set(r.revision);
      // What was sent is what's saved; anything typed while it was on its way stays unsaved.
      this.saved.set(JSON.stringify(sent));
      this.status.set('Saved.');
      this.settingsChange.emit(sent);
    } catch (e) {
      this.error.set(e instanceof UiWfApiError ? e.message : 'Saving failed.');
    } finally {
      this.busy.set(false);
    }
  }
}
