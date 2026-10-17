import { Component, computed, effect, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton, UiIconButton, UiSegmented, type UiSegmentedOption } from '@zouriel/ui/button';
import { UiModal } from '@zouriel/ui/dialog';
import { UiCombobox, type UiComboboxOption } from '@zouriel/ui/combobox';
import { UiInput, UiSelect, UiTextarea, type UiSelectOption } from '@zouriel/ui/form';
import { UiFormRenderer } from '@zouriel/ui/form-builder';
import {
  injectWorkflowClock,
  type UiWfAuditEntry,
  type UiWfAuditQuery,
  type UiWfAuditVerification,
  type UiWfInstance,
  type UiWfRecord,
  type UiWfTask,
  type UiWfTransitionOption,
  type UiWorkflowApi,
} from './api';
import { indexSteps, stepName } from './definition';
import {
  WF_AUDIT_CATEGORIES,
  WfWithApi,
  wfAgo,
  wfAuditActionLabel,
  wfAuditCategoryLabel,
  wfAuditJson,
  wfDateTime,
  wfDescribeHistory,
  wfErrorText,
  wfHumanize,
  wfOutcomeLabel,
  wfRunStatusLabel,
  wfRunStatusTone,
  wfStatePassed,
  wfTaskResult,
} from './runtime-shared';
import { WF_ICONS, WF_STEP_ICONS } from './icons';
import type { UiWorkflowDefinition } from './schema';
import { WF_SHARED_STYLES } from './styles';

// ── State badge ───────────────────────────────────────────────────────────

/** `ui-workflow-state-badge` — a record's lifecycle state as a small coloured chip. */
@Component({
  selector: 'ui-workflow-state-badge',
  template: `<span class="badge" [attr.data-tone]="tone() ?? 'neutral'"><span class="dot"></span>{{ label() }}</span>`,
  styles: `
    :host { display: inline-flex; }
    .badge { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 9px; border-radius: 11px; font-size: 12px; font-weight: 600; white-space: nowrap;
      color: var(--wf-c); background: color-mix(in srgb, var(--wf-c) 13%, transparent); }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .badge[data-tone="neutral"] { --wf-c: var(--ui-color-text-secondary); }
    .badge[data-tone="info"], .badge[data-tone="primary"] { --wf-c: var(--ui-color-primary); }
    .badge[data-tone="success"] { --wf-c: var(--ui-color-success); }
    .badge[data-tone="warning"] { --wf-c: var(--ui-color-warning); }
    .badge[data-tone="danger"] { --wf-c: var(--ui-color-danger); }
  `,
})
export class UiWorkflowStateBadge {
  readonly label = input.required<string>();
  readonly tone = input<string | null | undefined>('neutral');
}

// ── Task decision (shared by the inbox and the record panel) ──────────────

/** The decide dialog: instructions, the task's form, a comment, and its buttons. */
@Component({
  selector: 'ui-wf-decide',
  imports: [FormsModule, UiButton, UiModal, UiTextarea, UiFormRenderer, UiCombobox],
  template: `
    <ui-modal [open]="!!task()" (openChange)="!$event && closed.emit()" [title]="task()?.title ?? ''" size="md">
      @if (task(); as t) {
        <div class="body">
          @if (t.entityTitle) { <p class="rec">{{ t.entityTitle }}</p> }
          @if (t.instructions) { <p class="instructions">{{ t.instructions }}</p> }
          <p class="meta">Due {{ when(t.dueAt) }}@if (t.overdue) { · <strong class="late">overdue</strong> }</p>
          @if (t.decisions.length) {
            <ul class="decisions">@for (d of t.decisions; track d.userId) { <li><strong>{{ d.name ?? d.userId }}</strong> chose “{{ outcomeLabel(t, d.outcome) }}”{{ d.comment ? ': “' + d.comment + '”' : '' }}</li> }</ul>
          }
          @if (t.form) {
            <ui-form-renderer [definition]="t.form" [showActions]="false" [showTitle]="false" (valueChange)="answers.set($event)" />
          }
          <label class="lw"><span class="wf-label">Comment{{ t.requireComment === 'always' ? ' (required)' : t.requireComment === 'reject' ? ' (required to reject)' : '' }}</span>
            <ui-textarea [ngModel]="comment()" (ngModelChange)="comment.set($event)" [rows]="2" [autosize]="true" /></label>
          @if (t.allowDelegation) {
            <details class="delegate" (toggle)="$any($event.target).open && searchPeople('')"><summary>Hand it to someone else</summary>
              <div class="wf-row"><ui-combobox class="people" size="sm" placeholder="Search for a person" label="Hand it to" [options]="people()"
                  [ngModel]="delegateTo() || null" (ngModelChange)="delegateTo.set($event ?? '')" (input)="searchPeople($any($event.target).value ?? '')" />
                <ui-button size="sm" variant="outline" (click)="delegate()" [disabled]="busy() || !delegateTo()">Hand over</ui-button></div>
            </details>
          }
          @if (error()) { <p class="wf-error" role="alert">{{ error() }}</p> }
        </div>
      }
      @if (task(); as t) {
        <div modal-footer class="foot">
          <ui-button variant="ghost" (click)="closed.emit()">Close</ui-button>
          <div class="wf-row">
            @for (o of t.outcomes; track o.key) {
              <ui-button [variant]="o.tone === 'danger' ? 'destructive' : o.tone === 'success' || o.tone === 'primary' ? 'primary' : 'outline'" (click)="decide(o.key)" [disabled]="busy() || !t.canDecide">{{ o.label }}</ui-button>
            }
          </div>
        </div>
      }
    </ui-modal>
  `,
  styles: [WF_SHARED_STYLES, `
    .body { display: flex; flex-direction: column; gap: var(--ui-space-2); font-size: 14px; }
    .rec { margin: 0; font-weight: 600; }
    .instructions { margin: 0; line-height: 1.5; white-space: pre-wrap; }
    .meta { margin: 0; font-size: 12.5px; color: var(--ui-color-text-muted); }
    .late { color: var(--ui-color-danger); }
    .decisions { margin: 0; padding-left: var(--ui-space-4); font-size: 13px; }
    .lw { display: block; }
    .delegate summary { font-size: 12.5px; color: var(--ui-color-primary); cursor: pointer; margin-bottom: 6px; }
    .people { flex: 1; min-width: 0; }
    .foot { display: flex; justify-content: space-between; align-items: center; width: 100%; gap: var(--ui-space-2); flex-wrap: wrap; }
  `],
})
export class WfDecideDialog {
  readonly task = input<UiWfTask | null>(null);
  readonly api = input<UiWorkflowApi | null>(null);
  readonly closed = output<void>();
  readonly decided = output<UiWfTask>();
  private readonly form = viewChild(UiFormRenderer);
  protected readonly comment = signal('');
  protected readonly delegateTo = signal('');
  /** People to hand the task to, from the API's directory search. */
  protected readonly people = signal<UiComboboxOption[]>([]);
  private peopleSeq = 0;
  private peopleTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly answers = signal<Record<string, unknown>>({});
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private readonly clock = injectWorkflowClock();
  protected readonly when = (iso: string) => `${wfDateTime(iso)} (${wfAgo(iso, this.clock())})`;

  constructor() {
    effect(() => {
      this.task();
      untracked(() => { this.comment.set(''); this.error.set(''); this.answers.set({}); this.delegateTo.set(''); this.people.set([]); });
    });
  }

  protected outcomeLabel(t: UiWfTask, key: string): string {
    return wfOutcomeLabel(key, t.outcomes);
  }

  /** Looks people up as the name is typed (debounced; a slower older answer never replaces a newer one). */
  protected searchPeople(query: string): void {
    clearTimeout(this.peopleTimer);
    this.peopleTimer = setTimeout(() => void this.loadPeople(query.trim()), query ? 250 : 0);
  }

  private async loadPeople(query: string): Promise<void> {
    const api = this.api();
    const t = this.task();
    if (!api || !t) return;
    const n = ++this.peopleSeq;
    try {
      const found = await api.searchUsers(query, 20);
      if (n !== this.peopleSeq) return;
      // People already on the task (or who decided) can't take it over; the engine refuses them too.
      const taken = new Set([...t.assignees, ...t.decisions.map((d) => d.userId)]);
      const chosen = this.people().find((p) => p.value === this.delegateTo());
      const options = found.filter((u) => !taken.has(u.id)).map((u) => ({ value: u.id, label: u.email ? `${u.name} (${u.email})` : u.name }));
      // Keep the chosen person listed so the field keeps showing their name.
      if (chosen && !options.some((o) => o.value === chosen.value)) options.unshift(chosen);
      this.people.set(options);
    } catch {
      if (n === this.peopleSeq) this.people.set([]);
    }
  }

  protected async decide(outcome: string): Promise<void> {
    const t = this.task();
    const api = this.api();
    // A second click while the first is on its way would send the decision twice.
    if (!t || !api || this.busy()) return;
    // The form checks itself first and shows what's wrong next to each answer; the engine checks again.
    if (t.form && !this.form()?.submit()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const res = await api.decide(t.id, outcome, this.comment() || undefined, this.answers());
      this.decided.emit(res);
    } catch (e) {
      this.error.set(wfErrorText(e, 'The decision could not be saved.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async delegate(): Promise<void> {
    const t = this.task();
    const api = this.api();
    if (!t || !api || this.busy() || !this.delegateTo()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.decided.emit(await api.delegate(t.id, this.delegateTo()));
    } catch (e) {
      this.error.set(wfErrorText(e, 'Could not hand it over.'));
    } finally {
      this.busy.set(false);
    }
  }
}

// ── Record panel ──────────────────────────────────────────────────────────

/**
 * The moves a person may make on a record now, its manual workflows and open tasks, with the
 * dialogs that go with them (confirmation, transition form, decision). Shared by the record panel
 * and the workflow panel; internal, but exported so both entry points can use it.
 */
@Component({
  selector: 'ui-wf-record-actions',
  imports: [UiButton, UiModal, UiFormRenderer, WfDecideDialog],
  // Nothing this person can do here: take no room (the dialogs only open from these buttons).
  host: { '[class.idle]': 'idle()' },
  template: `
    @let r = record();
    @if (r.transitions.length || r.manual.length) {
      <div class="actions">
        @for (t of r.transitions; track t.key) {
          <ui-button size="sm" [variant]="t.tone === 'danger' ? 'destructive' : t.tone === 'success' || t.tone === 'primary' ? 'primary' : 'outline'" (click)="start(t)" [disabled]="busy()">{{ t.label }}</ui-button>
        }
        @for (m of r.manual; track m.key) {
          <ui-button size="sm" variant="outline" (click)="startManual(m)" [disabled]="busy()">{{ m.label }}</ui-button>
        }
      </div>
    }
    @if (showTasks() && r.tasks.length) {
      <section>
        <h3>Waiting for</h3>
        <ul class="tasks">
          @for (t of r.tasks; track t.id) {
            <li><button type="button" class="task" (click)="openTask.set(t)" [disabled]="!t.canDecide">
              <span class="tt">{{ t.title }}</span><span class="who">{{ t.assigneeNames.join(', ') }} · due {{ ago(t.dueAt) }}</span>
              @if (t.canDecide) { <span class="wf-chip" data-tone="primary">Your turn</span> }
            </button></li>
          }
        </ul>
      </section>
    }
    @if (nothingToDo()) { <p class="wf-hint">{{ emptyText() }}</p> }
    @if (error()) { <p class="wf-error" role="alert">{{ error() }}</p> }

    <ui-modal [open]="!!pending()" (openChange)="!$event && pending.set(null)" [title]="pending()?.label ?? ''" size="md">
      @if (pending(); as p) {
        <div class="confirm">
          @if (p.confirm) { <p>{{ p.confirm }}</p> }
          @if (p.form) { <ui-form-renderer [definition]="p.form" [showActions]="false" [showTitle]="false" (valueChange)="input.set($event)" /> }
          @else if (!p.confirm) { <p>Move this record to “{{ p.toLabel }}”?</p> }
          @if (pendingError()) { <p class="wf-error" role="alert">{{ pendingError() }}</p> }
        </div>
      }
      @if (pending(); as p) {
        <div modal-footer class="foot">
          <ui-button variant="ghost" (click)="pending.set(null)">Cancel</ui-button>
          <ui-button [variant]="p.tone === 'danger' ? 'destructive' : 'primary'" (click)="confirm()" [disabled]="busy()">{{ p.label }}</ui-button>
        </div>
      }
    </ui-modal>
    <ui-wf-decide [task]="openTask()" [api]="client()" (closed)="openTask.set(null)" (decided)="afterDecide()" />
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-3); font-size: 13.5px; color: var(--ui-color-text); }
    :host(.idle) { display: none; }
    .actions { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); }
    h3 { margin: 0 0 6px; font-size: 11px; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ui-color-text-muted); }
    .tasks { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
    .task { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 2px 8px; width: 100%; padding: 8px 10px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      background: var(--ui-color-surface); color: var(--ui-color-text); font: inherit; text-align: left; cursor: pointer; }
    .task:disabled { cursor: default; }
    .task:not(:disabled):hover { border-color: var(--ui-color-primary); }
    .task:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .tt { font-weight: 600; }
    .who { grid-column: 1; font-size: 12px; color: var(--ui-color-text-muted); }
    .task .wf-chip { grid-row: 1 / 3; grid-column: 2; }
    .confirm { display: flex; flex-direction: column; gap: var(--ui-space-2); font-size: 14px; }
    .confirm p { margin: 0; }
    .foot { display: flex; justify-content: space-between; gap: var(--ui-space-2); width: 100%; }
  `],
})
export class WfRecordActions extends WfWithApi {
  readonly record = input.required<UiWfRecord>();
  readonly entity = input.required<string>();
  readonly entityId = input.required<string>();
  /** List the record's open tasks (the record panel does; the workflow panel shows them per state too). */
  readonly showTasks = input(true);
  /** Said when this person has nothing to do here (no moves, manual workflows or tasks); empty says nothing. */
  readonly emptyText = input('');
  /** A move was applied: the record as it is now. */
  readonly changed = output<UiWfRecord>();
  /** Something changed that needs a fresh read (a decision, a manual start). */
  readonly reload = output<void>();
  private readonly form = viewChild(UiFormRenderer);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly pending = signal<UiWfTransitionOption | null>(null);
  protected readonly pendingManual = signal<string | null>(null);
  protected readonly pendingError = signal('');
  protected readonly input = signal<Record<string, unknown>>({});
  protected readonly openTask = signal<UiWfTask | null>(null);
  protected readonly nothingToDo = computed(() => {
    const r = this.record();
    return !r.transitions.length && !r.manual.length && !(this.showTasks() && r.tasks.length) && !this.pending() && !this.openTask();
  });
  protected readonly idle = computed(() => this.nothingToDo() && !this.emptyText() && !this.error());

  protected start(t: UiWfTransitionOption): void {
    if (this.busy()) return;
    this.pendingManual.set(null);
    this.pendingError.set('');
    this.input.set({});
    if (!t.form && !t.confirm) { void this.apply(t.key); return; }
    this.pending.set(t);
  }

  protected startManual(m: UiWfRecord['manual'][number]): void {
    if (this.busy()) return;
    this.pendingManual.set(m.key);
    this.pendingError.set('');
    this.input.set({});
    if (!m.form) { void this.runManual(m.key); return; }
    this.pending.set({ key: m.key, label: m.label, to: '', toLabel: '', tone: 'primary', confirm: null, form: m.form });
  }

  protected confirm(): void {
    const p = this.pending();
    // A double click on the confirm button must not apply the move twice.
    if (!p || this.busy()) return;
    // The form checks itself first and shows what's wrong next to each answer; the engine checks again.
    if (p.form && !this.form()?.submit()) return;
    if (this.pendingManual()) void this.runManual(p.key);
    else void this.apply(p.key);
  }

  private async apply(key: string): Promise<void> {
    const api = this.client();
    if (!api) return;
    this.busy.set(true);
    try {
      const r = await api.applyTransition(this.entity(), this.entityId(), key, this.input());
      this.error.set('');
      this.pending.set(null);
      this.changed.emit(r);
    } catch (e) {
      const msg = wfErrorText(e, 'That did not work.');
      if (this.pending()) this.pendingError.set(msg); else this.error.set(msg);
    } finally {
      this.busy.set(false);
    }
  }

  private async runManual(key: string): Promise<void> {
    const api = this.client();
    if (!api) return;
    this.busy.set(true);
    try {
      await api.startManual(key, this.entity(), this.entityId(), this.input());
      this.error.set('');
      this.pending.set(null);
      this.reload.emit();
    } catch (e) {
      const msg = wfErrorText(e, 'That did not work.');
      if (this.pending()) this.pendingError.set(msg); else this.error.set(msg);
    } finally {
      this.busy.set(false);
    }
  }

  protected afterDecide(): void {
    this.openTask.set(null);
    this.reload.emit();
  }
}

/**
 * `ui-workflow-record-panel` — drop onto a record's page: its lifecycle state, the moves the
 * signed-in person may make (with their forms), open tasks, buttons for manual workflows, and the
 * history of what happened.
 */
@Component({
  selector: 'ui-workflow-record-panel',
  imports: [UiWorkflowStateBadge, WfRecordActions],
  template: `
    @if (record(); as r) {
      <div class="state">
        @if (r.state) {
          <ui-workflow-state-badge [label]="r.stateLabel ?? r.state" [tone]="r.stateTone" />
          <span class="since">since {{ ago(r.stateEnteredAt) }}</span>
          @if (r.status === 'outOfSync') { <span class="wf-chip" data-tone="warning">Out of sync</span> }
        } @else {
          <span class="wf-hint">No lifecycle for this record type.</span>
        }
      </div>
      @if (r.states.length > 1) {
        <ol class="track" aria-label="Lifecycle">
          @for (s of r.states; track s.key) {
            <li [class.here]="s.key === r.state" [class.done]="passed(r, s.key)" [attr.data-tone]="s.tone ?? 'neutral'"><span>{{ s.label }}</span></li>
          }
        </ol>
      }
      <ui-wf-record-actions [record]="r" [entity]="entity()" [entityId]="entityId()" [api]="client()" (changed)="moved($event)" (reload)="reload()" />
      @if (showHistory()) {
        <section>
          <h3>History</h3>
          <ol class="history">
            @for (h of history(); track h.seq) {
              <li><span class="hw">{{ describeHistory(h) }}</span><span class="hm">{{ h.actorName ?? h.actorType }} · {{ ago(h.at) }}</span></li>
            } @empty { <li class="wf-hint">Nothing yet.</li> }
          </ol>
        </section>
      }
    } @else if (error()) {
      <p class="wf-error" role="alert">{{ error() }}</p>
    } @else {
      <p class="wf-hint">Loading…</p>
    }
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-3); font-size: 13.5px; color: var(--ui-color-text); }
    .state { display: flex; align-items: center; gap: var(--ui-space-2); flex-wrap: wrap; }
    .since { font-size: 12px; color: var(--ui-color-text-muted); }
    .track { display: flex; flex-wrap: wrap; gap: 4px; margin: 0; padding: 0; list-style: none; }
    .track li { display: flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 11px; font-size: 11.5px; color: var(--ui-color-text-muted); background: var(--ui-color-surface-hover); }
    .track li.done { color: var(--ui-color-text-secondary); }
    .track li.here { color: var(--ui-color-primary-contrast); background: var(--ui-color-primary); font-weight: 600; }
    h3 { margin: 0 0 6px; font-size: 11px; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ui-color-text-muted); }
    .history { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
    .history li { display: flex; flex-direction: column; padding: 4px 0 4px 12px; border-left: 2px solid var(--ui-color-border); }
    .hw { font-size: 13px; }
    .hm { font-size: 11.5px; color: var(--ui-color-text-muted); }
  `],
})
export class UiWorkflowRecordPanel extends WfWithApi {
  readonly entity = input.required<string>();
  readonly entityId = input.required<string>();
  readonly showHistory = input(true);
  /** Fired after the record changed through the panel (so the page can reload its own data). */
  readonly changed = output<UiWfRecord>();
  protected readonly record = signal<UiWfRecord | null>(null);
  protected readonly history = signal<UiWfAuditEntry[]>([]);
  protected readonly error = signal('');
  /** Bumped by every load and change, so a slower older answer never replaces a newer one. */
  private seq = 0;

  constructor() {
    super();
    effect(() => {
      const api = this.client();
      const e = this.entity(), id = this.entityId();
      if (api) untracked(() => void this.load(api, e, id));
    });
  }

  /** Reloads the panel (e.g. after the page changed the record itself). */
  async reload(): Promise<void> {
    const api = this.client();
    if (api) await this.load(api, this.entity(), this.entityId());
  }

  private async load(api: UiWorkflowApi, entity: string, id: string): Promise<void> {
    const n = ++this.seq;
    try {
      const record = await api.record(entity, id);
      if (n !== this.seq) return;
      this.record.set(record);
      this.error.set('');
      await this.loadHistory(api, n);
    } catch (e) {
      if (n === this.seq) this.error.set(wfErrorText(e, 'Could not load the record’s workflow.'));
    }
  }

  private async loadHistory(api: UiWorkflowApi, n: number): Promise<void> {
    if (!this.showHistory()) return;
    const history = await api.recordHistory(this.entity(), this.entityId(), 50).catch(() => null);
    if (history && n === this.seq) this.history.set(history);
  }

  protected readonly passed = wfStatePassed;

  protected async moved(r: UiWfRecord): Promise<void> {
    const n = ++this.seq;
    this.record.set(r);
    this.changed.emit(r);
    const api = this.client();
    if (api) await this.loadHistory(api, n);
  }

  protected describeHistory(h: UiWfAuditEntry): string {
    return wfDescribeHistory(h, (k) => this.record()?.states.find((s) => s.key === k)?.label ?? String(k ?? ''));
  }
}

// ── Task inbox ────────────────────────────────────────────────────────────

/** `ui-workflow-tasks` — the signed-in person's approvals and tasks: due first, overdue marked. */
@Component({
  selector: 'ui-workflow-tasks',
  imports: [HugeiconsIconComponent, UiButton, UiIconButton, UiSegmented, WfDecideDialog],
  template: `
    <div class="head">
      <ui-segmented size="sm" label="Which tasks" [options]="statusOptions" [value]="status()" (valueChange)="status.set($event === 'done' ? 'done' : 'open')" />
      <ui-icon-button size="sm" label="Refresh" (click)="reload()"><hugeicons-icon aria-hidden="true" [icon]="icons.RefreshIcon" [size]="15" [strokeWidth]="1.8" /></ui-icon-button>
    </div>
    @if (error()) { <p class="wf-error" role="alert">{{ error() }}</p> }
    <ul class="list" role="list">
      @for (t of tasks(); track t.id) {
        <li>
          <button type="button" class="row" (click)="openTask.set(t)" [class.late]="t.overdue">
            <span class="ico"><hugeicons-icon aria-hidden="true" [icon]="t.kind === 'approval' ? icons.CheckmarkCircle02Icon : icons.InboxIcon" [size]="15" [strokeWidth]="1.8" /></span>
            <span class="main">
              <span class="title">{{ t.title }}</span>
              <span class="sub">{{ t.entityTitle ?? t.definitionKey }}</span>
            </span>
            <span class="due">
              @if (t.status === 'open') { <span [class.overdue]="t.overdue">{{ t.overdue ? 'Overdue' : 'Due' }} {{ ago(t.dueAt) }}</span> }
              @else { <span class="wf-chip" [attr.data-tone]="t.outcome === 'rejected' ? 'danger' : t.status === 'timedOut' ? 'warning' : 'success'">{{ outcomeLabel(t) }}</span> }
            </span>
          </button>
        </li>
      } @empty {
        <li class="empty">{{ status() === 'open' ? 'Nothing is waiting for you.' : 'No finished tasks yet.' }}</li>
      }
    </ul>
    @if (total() > tasks().length) { <div><ui-button size="sm" variant="outline" (click)="more()">Show more</ui-button></div> }
    <ui-wf-decide [task]="openTask()" [api]="client()" (closed)="openTask.set(null)" (decided)="afterDecide($event)" />
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .head { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); }
    .list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
    .row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      background: var(--ui-color-surface); color: var(--ui-color-text); font: inherit; text-align: left; cursor: pointer; }
    .row:hover { border-color: var(--ui-color-primary); }
    .row:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .row.late { border-left: 3px solid var(--ui-color-danger); }
    .ico { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 7px; flex: none; color: var(--ui-color-primary); background: color-mix(in srgb, var(--ui-color-primary) 12%, transparent); }
    .main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .title { font-size: 13.5px; font-weight: 600; }
    .sub { font-size: 12px; color: var(--ui-color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .due { font-size: 12px; color: var(--ui-color-text-secondary); white-space: nowrap; }
    .overdue { color: var(--ui-color-danger); font-weight: 600; }
    .empty { padding: var(--ui-space-6) 0; text-align: center; color: var(--ui-color-text-muted); font-size: 13px; }
  `],
})
export class UiWorkflowTasks extends WfWithApi {
  /** `mine` (the signed-in person's) or `all` (needs admin rights). */
  readonly scope = input<'mine' | 'all'>('mine');
  readonly pageSize = input(25);
  /** Fired after a decision, so the host can refresh related views. */
  readonly decided = output<UiWfTask>();
  protected readonly icons = WF_ICONS;
  protected readonly status = signal<'open' | 'done'>('open');
  protected readonly statusOptions: UiSegmentedOption[] = [{ value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }];
  private seq = 0;
  protected readonly tasks = signal<UiWfTask[]>([]);
  protected readonly total = signal(0);
  protected readonly error = signal('');
  protected readonly openTask = signal<UiWfTask | null>(null);
  private take = 25;

  constructor() {
    super();
    effect(() => {
      this.client();
      this.status();
      this.scope();
      this.take = this.pageSize();
      untracked(() => void this.reload());
    });
  }

  async reload(): Promise<void> {
    const api = this.client();
    if (!api) return;
    const n = ++this.seq;
    try {
      const page = await api.tasks({ scope: this.scope(), status: this.status() === 'open' ? ['open'] : ['completed', 'timedOut', 'cancelled'], take: this.take });
      if (n !== this.seq) return;
      this.tasks.set(page.items);
      this.total.set(page.total);
      this.error.set('');
    } catch (e) {
      if (n === this.seq) this.error.set(wfErrorText(e, 'Could not load tasks.'));
    }
  }

  protected more(): void {
    this.take += this.pageSize();
    void this.reload();
  }

  protected readonly outcomeLabel = wfTaskResult;

  protected afterDecide(t: UiWfTask): void {
    this.openTask.set(null);
    this.decided.emit(t);
    void this.reload();
  }
}

// ── Run view ──────────────────────────────────────────────────────────────

/**
 * `ui-workflow-run` — one run drawn over its workflow: each step with what happened (done,
 * waiting, failed, skipped), the paths not taken greyed out, and an admin's retry/skip/cancel.
 */
@Component({
  selector: 'ui-workflow-run',
  imports: [HugeiconsIconComponent, UiButton],
  template: `
    @if (run(); as r) {
      <header class="head">
        <div class="t"><strong>{{ r.title }}</strong> <span class="v">v{{ r.version }}</span>
          <span class="wf-chip" [attr.data-tone]="statusTone(r.status)">{{ statusLabel(r.status) }}</span>{{ r.stateLabel ? ' · ' + r.stateLabel : '' }}</div>
        <span class="m">{{ r.entityTitle ?? r.entityId ?? '' }} · started {{ ago(r.startedAt) }}{{ r.initiatorName ? ' by ' + r.initiatorName : '' }}</span>
      </header>
      @if (r.status === 'incident') {
        <div class="incident" role="alert">
          <p><strong>Stopped:</strong> {{ r.error }}</p>
          @if (mayIntervene()) {
            @if (incidents().length > 1) {
              <!-- Several paths stopped: each can be retried or skipped on its own. -->
              <ul class="stops">
                @for (i of incidents(); track i.token) {
                  <li><span>{{ i.name }}</span>
                    <ui-button size="sm" (click)="act('retry', i.token)" [disabled]="busy()">Try again</ui-button>
                    <ui-button size="sm" variant="outline" (click)="act('skip', i.token)" [disabled]="busy()">Skip</ui-button>
                  </li>
                }
              </ul>
              <div class="wf-row"><ui-button size="sm" variant="destructive" (click)="act('cancel')" [disabled]="busy()">Cancel the run</ui-button></div>
            } @else {
              <div class="wf-row">
                <ui-button size="sm" (click)="act('retry')" [disabled]="busy()">Try again</ui-button>
                <ui-button size="sm" variant="outline" (click)="act('skip')" [disabled]="busy()">Skip the step</ui-button>
                <ui-button size="sm" variant="destructive" (click)="act('cancel')" [disabled]="busy()">Cancel the run</ui-button>
              </div>
            }
          }
        </div>
      } @else if (mayIntervene() && (r.status === 'waiting' || r.status === 'running' || r.status === 'queued')) {
        <div class="wf-row"><ui-button size="sm" variant="destructive" (click)="act('cancel')" [disabled]="busy()">Cancel the run</ui-button></div>
      }
      @if (error()) { <p class="wf-error">{{ error() }}</p> }
      <ol class="steps">
        @for (s of rows(); track s.id) {
          <li [attr.data-status]="s.status" [style.padding-left.px]="8 + s.depth * 16">
            <span class="ico"><hugeicons-icon aria-hidden="true" [icon]="s.icon" [size]="13" [strokeWidth]="1.9" /></span>
            <span class="name">{{ s.name }}</span>
            <span class="st">{{ s.statusText }}</span>
            @if (s.detail) { <span class="detail">{{ s.detail }}</span> }
          </li>
        }
      </ol>
      @if (r.tasks?.length) {
        <section class="tasks"><h4>Tasks</h4>
          <ul>@for (t of r.tasks!; track t.id) { <li>{{ t.title }} — {{ t.status === 'open' ? 'waiting for ' + t.assigneeNames.join(', ') + ', due ' + ago(t.dueAt) : taskResult(t) }}</li> }</ul>
        </section>
      }
    } @else if (error()) {
      <p class="wf-error">{{ error() }}</p>
    } @else {
      <p class="wf-hint">Loading…</p>
    }
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-2); font-size: 13px; }
    .head { display: flex; flex-direction: column; gap: 2px; }
    .t { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; }
    .v { font-family: var(--ui-font-mono); font-size: 11.5px; color: var(--ui-color-text-muted); }
    .m { font-size: 12px; color: var(--ui-color-text-muted); }
    .incident { padding: 8px 10px; border-radius: var(--ui-radius); background: color-mix(in srgb, var(--ui-color-danger) 10%, transparent); border: 1px solid color-mix(in srgb, var(--ui-color-danger) 30%, transparent); }
    .incident p { margin: 0 0 6px; }
    .stops { margin: 0 0 6px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
    .stops li { display: flex; align-items: center; gap: var(--ui-space-2); flex-wrap: wrap; }
    .wf-row { flex-wrap: wrap; }
    .stops span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .steps { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
    .steps li { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 2px 8px; padding: 5px 8px; border-left: 2px solid var(--ui-color-border); }
    .steps li[data-status="notRun"] { opacity: 0.45; }
    .ico { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; color: var(--wf-s); background: color-mix(in srgb, var(--wf-s) 14%, transparent); }
    .steps li { --wf-s: var(--ui-color-text-muted); }
    .steps li[data-status="completed"] { --wf-s: var(--ui-color-success); border-left-color: var(--ui-color-success); }
    .steps li[data-status="waiting"], .steps li[data-status="running"] { --wf-s: var(--ui-color-primary); border-left-color: var(--ui-color-primary); }
    .steps li[data-status="failed"] { --wf-s: var(--ui-color-danger); border-left-color: var(--ui-color-danger); }
    .steps li[data-status="skipped"], .steps li[data-status="cancelled"] { --wf-s: var(--ui-color-warning); }
    .name { font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .st { font-size: 11.5px; color: var(--ui-color-text-secondary); white-space: nowrap; }
    .detail { grid-column: 2 / 4; font-size: 12px; color: var(--ui-color-text-muted); overflow-wrap: anywhere; }
    .tasks h4 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ui-color-text-muted); }
    .tasks ul { margin: 0; padding-left: var(--ui-space-4); }
  `],
})
export class UiWorkflowRun extends WfWithApi {
  readonly instanceId = input.required<string>();
  /**
   * Show retry, skip and cancel. Left unset, the view asks the engine (`me().can.intervene`), so only
   * people the server lets intervene see them; the server checks again either way.
   */
  readonly canIntervene = input<boolean | null>(null);
  readonly changed = output<UiWfInstance>();
  protected readonly run = signal<UiWfInstance | null>(null);
  private readonly definition = signal<UiWorkflowDefinition | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private readonly allowed = signal(false);
  protected readonly mayIntervene = computed(() => this.canIntervene() ?? this.allowed());
  protected readonly taskResult = wfTaskResult;
  private seq = 0;

  /** The paths stopped by a failure: one per token waiting on an incident, named after its step. */
  protected readonly incidents = computed(() => {
    const r = this.run();
    const steps = this.definition() ? indexSteps(this.definition()!) : null;
    return (r?.tokens ?? []).filter((t) => t.waiting === 'incident').map((t) => {
      const step = t.stepId ? steps?.get(t.stepId)?.step : undefined;
      return { token: t.id, name: step ? stepName(step) : t.stepId ?? t.id };
    });
  });

  protected readonly rows = computed(() => {
    const r = this.run();
    const def = this.definition();
    if (!r || !def) return [];
    const byNode = new Map<string, NonNullable<UiWfInstance['steps']>>();
    for (const s of r.steps ?? []) byNode.set(s.nodeId, [...(byNode.get(s.nodeId) ?? []), s]);
    const rootList = r.kind === 'run' && r.reason ? r.reason : 'root';
    const out: { id: string; name: string; depth: number; status: string; statusText: string; detail: string; icon: typeof WF_ICONS.Tick02Icon }[] = [];
    for (const loc of indexSteps(def).values()) {
      if (loc.path[0] !== rootList) continue;
      const runs = byNode.get(loc.step.id) ?? [];
      const last = runs[runs.length - 1];
      const status = last?.status ?? 'notRun';
      out.push({
        id: loc.step.id, name: stepName(loc.step), depth: loc.path.length - 1, status,
        statusText: { completed: 'Done', waiting: 'Waiting', running: 'Running', failed: 'Failed', skipped: 'Skipped', cancelled: 'Cancelled', notRun: '' }[status] ?? status,
        detail: last?.error ?? (runs.length > 1 ? `${runs.length} attempts` : ''),
        icon: status === 'completed' ? WF_ICONS.Tick02Icon : status === 'failed' ? WF_ICONS.Cancel01Icon : WF_STEP_ICONS[loc.step.type] ?? WF_ICONS.FlashIcon,
      });
    }
    return out;
  });

  constructor() {
    super();
    effect(() => {
      const api = this.client();
      const id = this.instanceId();
      if (api) untracked(() => void this.load(api, id));
    });
    effect(() => {
      const api = this.client();
      if (!api || this.canIntervene() !== null) return;
      untracked(() => void Promise.resolve(api.me?.()).then((me) => this.allowed.set(!!me?.can?.intervene), () => this.allowed.set(false)));
    });
  }

  async reload(): Promise<void> {
    const api = this.client();
    if (api) await this.load(api, this.instanceId());
  }

  private async load(api: UiWorkflowApi, id: string): Promise<void> {
    const n = ++this.seq;
    try {
      const [run, def] = await Promise.all([api.instance(id), api.instanceDefinition(id)]);
      if (n !== this.seq) return;
      this.run.set(run);
      this.definition.set(def);
      this.error.set('');
    } catch (e) {
      if (n === this.seq) this.error.set(wfErrorText(e, 'Could not load the run.'));
    }
  }

  protected readonly statusLabel = wfRunStatusLabel;
  protected readonly statusTone = wfRunStatusTone;

  protected async act(kind: 'retry' | 'skip' | 'cancel', target?: string): Promise<void> {
    const api = this.client();
    const r = this.run();
    if (!api || !r || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const next = kind === 'retry' ? await api.retry(r.id, target) : kind === 'skip' ? await api.skip(r.id, undefined, target) : await api.cancel(r.id, 'Cancelled from the run view');
      this.seq++;
      this.run.set(next);
      this.changed.emit(next);
    } catch (e) {
      this.error.set(wfErrorText(e, 'That did not work.'));
    } finally {
      this.busy.set(false);
    }
  }
}

// ── Audit log ─────────────────────────────────────────────────────────────

/** One line of an audit entry's before/after/details, for people to read. */
interface AuditRow { key: string; value: string }

function auditRows(text: string | null): AuditRow[] {
  const v = wfAuditJson(text);
  return Object.entries(v).map(([k, x]) => ({
    key: wfHumanize(k),
    value: x === null || x === undefined ? '—' : typeof x === 'object' ? JSON.stringify(x) : typeof x === 'boolean' ? (x ? 'Yes' : 'No') : String(x),
  }));
}

/**
 * `ui-workflow-audit` — the tamper-evident audit log: filter by record, run, kind or person, see
 * before/after values, export, and check the hash chain.
 */
@Component({
  selector: 'ui-workflow-audit',
  imports: [FormsModule, HugeiconsIconComponent, UiButton, UiInput, UiSelect],
  template: `
    <div class="filters">
      <ui-select class="kind" size="sm" label="Kind" [options]="categories" [ngModel]="category()" (ngModelChange)="category.set($event ?? '')" />
      @if (!entityId()) {
        <ui-input size="sm" placeholder="Record id" [ngModel]="recordText()" (ngModelChange)="typeRecord($event)" aria-label="Record id" />
      }
      <span class="grow"></span>
      <ui-button size="sm" variant="ghost" (click)="verify()" [disabled]="busy()"><hugeicons-icon aria-hidden="true" [icon]="icons.SecurityCheckIcon" [size]="14" [strokeWidth]="1.8" />Check integrity</ui-button>
      <ui-button size="sm" variant="ghost" (click)="exportAs('csv')" [disabled]="busy()"><hugeicons-icon aria-hidden="true" [icon]="icons.Download04Icon" [size]="14" [strokeWidth]="1.8" />CSV</ui-button>
    </div>
    @if (verification(); as v) {
      <p [class]="v.valid ? 'ok' : 'wf-error'" role="status">
        {{ v.valid ? 'The chain is intact: ' + v.checked + ' entries checked.' : 'The chain is broken at entry ' + v.brokenAtSeq + ': ' + v.problem }}
      </p>
    }
    @if (error()) { <p class="wf-error" role="alert">{{ error() }}</p> }
    <ol class="log">
      @for (e of entries(); track e.seq) {
        <li>
          <button type="button" class="row" (click)="toggle(e.seq)" [attr.aria-expanded]="open().has(e.seq)">
            <span class="seq">#{{ e.seq }}</span>
            <span class="what"><span class="cat" [attr.data-cat]="e.category">{{ categoryLabel(e.category) }}</span> {{ actionLabel(e.category, e.action) }}</span>
            <span class="who">{{ e.actorName ?? e.actorId ?? e.actorType }}</span>
            <span class="at" [attr.title]="e.at">{{ when(e.at) }}</span>
          </button>
          @if (open().has(e.seq)) {
            <div class="more">
              <dl>
                <dt>About</dt><dd>{{ subjectLabel(e) }}</dd>
                @if (raw().has(e.seq)) {
                  @if (e.before) { <dt>Before</dt><dd><code>{{ e.before }}</code></dd> }
                  @if (e.after) { <dt>After</dt><dd><code>{{ e.after }}</code></dd> }
                  @if (e.data) { <dt>Details</dt><dd><code>{{ e.data }}</code></dd> }
                } @else {
                  @for (part of parts(e); track part.label) {
                    <dt>{{ part.label }}</dt>
                    <dd><dl class="kv">@for (row of part.rows; track row.key) { <dt>{{ row.key }}</dt><dd>{{ row.value }}</dd> }</dl></dd>
                  }
                }
                <dt>Hash</dt><dd><code class="hash">{{ e.hash }}</code></dd>
              </dl>
              @if (e.before || e.after || e.data) {
                <ui-button size="sm" variant="outline" (click)="toggleRaw(e.seq)">{{ raw().has(e.seq) ? 'Show as a list' : 'Show the raw data' }}</ui-button>
              }
            </div>
          }
        </li>
      } @empty {
        <li class="empty">No entries.</li>
      }
    </ol>
    @if (hasMore()) { <div><ui-button size="sm" variant="outline" (click)="older()">Older entries</ui-button></div> }
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-2); font-size: 13px; }
    .filters { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); align-items: center; }
    .filters .kind { width: 200px; }
    .filters ui-input { width: 140px; }
    .filters ui-button hugeicons-icon { margin-right: 4px; }
    .grow { flex: 1; }
    .ok { margin: 0; color: var(--ui-color-success); font-size: 12.5px; }
    .log { margin: 0; padding: 0; list-style: none; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    .log > li + li { border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .row { display: grid; grid-template-columns: 56px minmax(0, 1fr) minmax(0, 0.6fr) auto; gap: 8px; align-items: center; width: 100%; padding: 6px 10px; border: 0;
      background: var(--ui-color-surface); color: var(--ui-color-text); font: inherit; text-align: left; cursor: pointer; }
    .row:hover { background: var(--ui-color-surface-hover); }
    .row:focus-visible { outline: none; box-shadow: inset var(--ui-focus-ring); }
    .seq { font-family: var(--ui-font-mono); font-size: 11.5px; color: var(--ui-color-text-muted); }
    .cat { font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.03em; color: var(--ui-color-text-secondary); }
    .cat[data-cat="lifecycle"] { color: var(--ui-color-primary); }
    .cat[data-cat="task"] { color: var(--ui-color-success); }
    .cat[data-cat="settings"], .cat[data-cat="definition"] { color: var(--ui-color-warning); }
    .who { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-color-text-secondary); }
    .at { font-size: 12px; color: var(--ui-color-text-muted); white-space: nowrap; }
    .more { display: flex; flex-direction: column; align-items: flex-start; gap: var(--ui-space-2); padding: 6px 10px 10px 66px; background: var(--ui-color-bg); }
    dl { display: grid; grid-template-columns: 70px 1fr; gap: 4px 10px; margin: 0; font-size: 12px; }
    dl.kv { grid-template-columns: minmax(80px, max-content) 1fr; gap: 2px 10px; }
    dt { color: var(--ui-color-text-muted); }
    dd { margin: 0; overflow-wrap: anywhere; }
    code { font-family: var(--ui-font-mono); font-size: 11.5px; }
    .hash { color: var(--ui-color-text-muted); }
    .empty { padding: var(--ui-space-6); text-align: center; color: var(--ui-color-text-muted); }
    @media (max-width: 560px) { .row { grid-template-columns: 48px 1fr; } .who, .at { grid-column: 2; } .more { padding-left: 10px; } }
  `],
})
export class UiWorkflowAudit extends WfWithApi {
  /** Show only one record's entries. */
  readonly entity = input<string | null>(null);
  readonly entityId = input<string | null>(null);
  /** Show only one run's entries. */
  readonly instanceId = input<string | null>(null);
  readonly pageSize = input(50);
  protected readonly icons = WF_ICONS;
  protected readonly categories: UiSelectOption[] = [{ value: '', label: 'Everything' }, ...WF_AUDIT_CATEGORIES];
  protected readonly categoryLabel = wfAuditCategoryLabel;
  protected readonly actionLabel = wfAuditActionLabel;
  protected readonly category = signal('');
  /** What is typed in the record filter; it reaches `recordFilter` (and the server) after a pause. */
  protected readonly recordText = signal('');
  protected readonly recordFilter = signal('');
  private recordTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly raw = signal<ReadonlySet<number>>(new Set());
  private seq = 0;
  protected readonly entries = signal<UiWfAuditEntry[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly open = signal<ReadonlySet<number>>(new Set());
  protected readonly verification = signal<UiWfAuditVerification | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected override readonly when = (iso: string | null | undefined) => wfDateTime(iso);

  constructor() {
    super();
    effect(() => {
      this.client(); this.category(); this.recordFilter(); this.entity(); this.entityId(); this.instanceId();
      untracked(() => void this.load(false));
    });
  }

  private query(): UiWfAuditQuery {
    return {
      category: this.category() || undefined,
      entity: this.entity() ?? undefined,
      entityId: this.entityId() ?? (this.recordFilter() || undefined),
      instanceId: this.instanceId() ?? undefined,
      take: this.pageSize(),
    };
  }

  async load(older: boolean): Promise<void> {
    const api = this.client();
    if (!api) return;
    const n = ++this.seq;
    try {
      const before = older ? this.entries()[this.entries().length - 1]?.seq : undefined;
      const page = await api.audit({ ...this.query(), before });
      if (n !== this.seq) return;
      this.entries.set(older ? [...this.entries(), ...page] : page);
      this.hasMore.set(page.length === this.pageSize());
      this.error.set('');
    } catch (e) {
      if (n === this.seq) this.error.set(wfErrorText(e, 'Could not load the audit log.'));
    }
  }

  protected typeRecord(v: string): void {
    this.recordText.set(v ?? '');
    clearTimeout(this.recordTimer);
    this.recordTimer = setTimeout(() => this.recordFilter.set((v ?? '').trim()), 350);
  }

  protected subjectLabel(e: UiWfAuditEntry): string {
    const record = e.entity ? `${wfHumanize(e.entity)} ${e.entityId ?? ''}`.trim() : '';
    const subject = `${wfHumanize(e.subjectType)} ${e.subjectId}`;
    return record && e.subjectType !== e.entity ? `${subject} (${record})` : record || subject;
  }

  protected parts(e: UiWfAuditEntry): { label: string; rows: AuditRow[] }[] {
    return [
      { label: 'Before', rows: auditRows(e.before) },
      { label: 'After', rows: auditRows(e.after) },
      { label: 'Details', rows: auditRows(e.data) },
    ].filter((p) => p.rows.length);
  }

  protected toggleRaw(seq: number): void {
    this.raw.update((s) => {
      const n = new Set(s);
      if (n.has(seq)) n.delete(seq); else n.add(seq);
      return n;
    });
  }

  protected older(): void {
    void this.load(true);
  }

  protected toggle(seq: number): void {
    this.open.update((s) => {
      const n = new Set(s);
      if (n.has(seq)) n.delete(seq); else n.add(seq);
      return n;
    });
  }

  protected async verify(): Promise<void> {
    const api = this.client();
    if (!api || this.busy()) return;
    this.busy.set(true);
    try {
      this.verification.set(await api.verifyAudit());
    } catch (e) {
      this.error.set(wfErrorText(e, 'Could not check the chain.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async exportAs(format: 'csv' | 'json'): Promise<void> {
    const api = this.client();
    if (!api || this.busy()) return;
    this.busy.set(true);
    try {
      const blob = await api.exportAudit({ ...this.query(), format });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-audit.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set(wfErrorText(e, 'The export failed.'));
    } finally {
      this.busy.set(false);
    }
  }
}
