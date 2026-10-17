import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton, UiIconButton, UiSegmented, type UiSegmentedOption } from '@zouriel/ui/button';
import { UiModal } from '@zouriel/ui/dialog';
import { UiCombobox, type UiComboboxOption } from '@zouriel/ui/combobox';
import { UiCheckbox, UiInput, UiSelect, UiTextarea, type UiSelectOption } from '@zouriel/ui/form';
import { UiFormRenderer, type UiFormSubmission } from '@zouriel/ui/form-builder';
import {
  injectWorkflowClock,
  type UiWfAuditEntry,
  type UiWfAuditQuery,
  type UiWfAuditVerification,
  type UiWfInstance,
  type UiWfRecord,
  type UiWfResetItem,
  type UiWfTask,
  type UiWfTransitionOption,
  type UiWorkflowApi,
} from './api';
import { indexSteps, stepName } from './definition';
import {
  WF_AUDIT_CATEGORIES,
  WF_REMARKS_MAX,
  WfWithApi,
  wfAgo,
  wfAuditActionLabel,
  wfAuditCategoryLabel,
  wfAuditJson,
  wfCommentRequired,
  wfDateTime,
  wfDescribeHistory,
  wfErrorText,
  wfHumanize,
  wfOutcomeLabel,
  wfParkedTimerName,
  wfRunStatusLabel,
  wfRunStatusTone,
  wfTimerParked,
  wfReadableError,
  wfRemarksCounter,
  wfRemarksLabel,
  wfStatePassed,
  wfActorLabel,
  wfStepTimedOut,
  wfTaskResult,
} from './runtime-shared';
import { WfValueInput } from './editors';
import { WF_ICONS, WF_STEP_ICONS } from './icons';
import type { UiWfFieldType, UiWfParamDescriptor, UiWfRemarks, UiWorkflowDefinition } from './schema';
import { WF_SHARED_STYLES } from './styles';

/** Said when remarks are longer than the engine takes. */
const WF_REMARKS_TOO_LONG = `Remarks can be at most ${WF_REMARKS_MAX.toLocaleString('en')} characters.`;

/**
 * The answers of a filled form, read from its submission (which, unlike `valueChange`, also holds
 * answers nobody touched: defaults and prefilled values). Null with a message when they can't be sent:
 * picked files need an upload address on the form, as the engine takes JSON only.
 */
export function wfFormAnswers(s: UiFormSubmission): { data: Record<string, unknown> } | { error: string } {
  if (Object.values(s.files).some((f) => f.length)) {
    return { error: 'The files picked in this form can’t be sent: the form needs an upload address for them.' };
  }
  return { data: s.data };
}

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
    .badge[data-tone="primary"] { --wf-c: var(--ui-color-primary); }
    /* Themes that give info its own colour show it; the rest fall back to primary through the token. */
    .badge[data-tone="info"] { --wf-c: var(--ui-color-info); }
    .badge[data-tone="success"] { --wf-c: var(--ui-color-success); }
    .badge[data-tone="warning"] { --wf-c: var(--ui-color-warning); }
    .badge[data-tone="danger"] { --wf-c: var(--ui-color-danger); }
  `,
})
export class UiWorkflowStateBadge {
  readonly label = input.required<string>();
  readonly tone = input<string | null | undefined>('neutral');
}

// ── Task decision (shared by the inbox and the workflow panel) ──────────────

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
            <ui-form-renderer [definition]="t.form" [showActions]="false" [showTitle]="false" />
          }
          <label class="lw"><span class="wf-label">{{ remarksLabel(t) }}</span>
            <ui-textarea [ngModel]="comment()" (ngModelChange)="comment.set($event); commentMissing.set(false)" [rows]="2" [autosize]="true" [invalid]="commentMissing()" [maxlength]="remarksMax" /></label>
          @if (counter(comment()); as c) { <span class="wf-hint count" aria-live="polite">{{ c }}</span> }
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
    .count { align-self: flex-end; margin: 0; }
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
  /** Set when a decision that needs remarks was made without them. */
  protected readonly commentMissing = signal(false);
  protected readonly remarksLabel = wfRemarksLabel;
  protected readonly remarksMax = WF_REMARKS_MAX;
  protected readonly counter = wfRemarksCounter;
  protected readonly delegateTo = signal('');
  /** People to hand the task to, from the API's directory search. */
  protected readonly people = signal<UiComboboxOption[]>([]);
  private peopleSeq = 0;
  private peopleTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private readonly clock = injectWorkflowClock();
  protected readonly when = (iso: string) => `${wfDateTime(iso)} (${wfAgo(iso, this.clock())})`;

  constructor() {
    effect(() => {
      this.task();
      untracked(() => { this.comment.set(''); this.commentMissing.set(false); this.error.set(''); this.delegateTo.set(''); this.people.set([]); });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.peopleTimer));
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
    let data: Record<string, unknown> = {};
    if (t.form) {
      const s = this.form()?.submit();
      if (!s) return;
      const a = wfFormAnswers(s);
      if ('error' in a) { this.error.set(a.error); return; }
      data = a.data;
    }
    if (wfCommentRequired(t, outcome) && !this.comment().trim()) {
      this.commentMissing.set(true);
      this.error.set(`Add remarks to explain “${wfOutcomeLabel(outcome, t.outcomes)}”.`);
      return;
    }
    if (this.comment().trim().length > WF_REMARKS_MAX) {
      this.commentMissing.set(true);
      this.error.set(WF_REMARKS_TOO_LONG);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const res = await api.decide(t.id, outcome, this.comment().trim() || undefined, data);
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

// ── Record actions (inside the workflow panel) ─────────────────────────────

/** A move, reset or manual start waiting for its confirmation, with whether remarks are asked. */
type WfPendingAction = UiWfTransitionOption & { remarks: UiWfRemarks };

/** Whether a move asks for remarks: its setting, else optional for red moves (older engines send none). */
export function wfRemarksFor(t: Pick<UiWfTransitionOption, 'comment' | 'tone'>): UiWfRemarks {
  return t.comment ?? (t.tone === 'danger' ? 'optional' : 'none');
}

/**
 * The moves a person may make on a record now, its manual workflows and open tasks, with the
 * dialogs that go with them (confirmation, transition form, decision). Used by the workflow panel;
 * internal, but exported so the panel's entry point can use it.
 */
@Component({
  selector: 'ui-wf-record-actions',
  imports: [FormsModule, UiButton, UiCheckbox, UiModal, UiFormRenderer, UiTextarea, WfDecideDialog],
  // Nothing this person can do here: take no room (the dialogs only open from these buttons).
  host: { '[class.idle]': 'idle()' },
  template: `
    @let r = record();
    @if (r.transitions.length || r.manual.length) {
      <div class="actions">
        @for (t of r.transitions; track t.key) {
          <ui-button [size]="buttonSize" [variant]="t.tone === 'danger' ? 'destructive' : t.tone === 'success' || t.tone === 'primary' ? 'primary' : 'outline'" (click)="start(t)" [disabled]="busy()">{{ t.label }}</ui-button>
        }
        @for (m of r.manual; track m.key) {
          <ui-button [size]="buttonSize" variant="outline" (click)="startManual(m)" [disabled]="busy()">{{ m.label }}</ui-button>
        }
      </div>
    }
    @if (r.reset; as rs) {
      <div class="reset">
        <span class="reset-note">Back to “{{ rs.toLabel }}”: open tasks and runs stop.</span>
        <ui-button [size]="buttonSize" variant="outline" (click)="startReset()" [disabled]="busy()">{{ rs.label }}</ui-button>
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

    <ui-modal [open]="!!pending()" (openChange)="!$event && closeDialog()" [title]="pending()?.label ?? ''" [size]="resetting() ? 'lg' : 'md'">
      @if (pending(); as p) {
        <div class="confirm">
          @if (p.confirm) { <p>{{ p.confirm }}</p> }
          @if (p.form) { <ui-form-renderer [definition]="p.form" [showActions]="false" [showTitle]="false" /> }
          @else if (!p.confirm) { <p>Move this record to “{{ p.toLabel }}”?</p> }
          @if (p.remarks !== 'none') {
            <label class="lw"><span class="wf-label">Remarks{{ p.remarks === 'required' ? ' (required)' : ' (optional)' }}</span>
              <ui-textarea [ngModel]="remark()" (ngModelChange)="remark.set($event)" [rows]="2" [autosize]="true" [invalid]="remarkMissing()" [maxlength]="remarksMax" /></label>
            @if (counter(remark()); as c) { <span class="wf-hint count" aria-live="polite">{{ c }}</span> }
          }
          @if (resetting()) {
            @if (resetLoading()) { <p class="wf-hint">Looking up what the workflow did…</p> }
            @else if (resetLoaded() && !resetItems().length) { <p class="wf-hint">Nothing the workflow did needs taking back.</p> }
            @else if (resetItems().length) {
              <section class="undo" aria-label="Take back what the workflow did">
                <div class="undo-head">
                  <h3>Also take back</h3>
                  @if (undoableCount() > 1) {
                    <ui-button size="sm" variant="ghost" (click)="chooseAll(chosen().size < undoableCount())">{{ chosen().size < undoableCount() ? 'Select all' : 'Select none' }}</ui-button>
                  }
                </div>
                <p class="wf-hint">What the workflow did since the record last started over. Untick anything that should stay; the workflow carries on either way.</p>
                <ul class="undo-list">
                  @for (it of resetItems(); track it.id) {
                    <li [class.off]="!it.undoable">
                      <ui-checkbox [ngModel]="chosen().has(it.id)" (ngModelChange)="choose(it.id, $event)" [disabled]="!it.undoable || busy()">
                        <span class="undo-title">{{ it.title }}</span>
                        <!-- Read with the box, so screen readers hear why it is unticked or locked. -->
                        @if (it.warning) { <span class="wf-sr">. {{ it.warning }}</span> }
                      </ui-checkbox>
                      <span class="undo-meta"><span class="wf-chip">{{ kindLabel(it.kind) }}</span>{{ it.workflow }} · {{ it.step }}@if (it.detail) { · {{ it.detail }} }</span>
                      @if (it.warning) { <span class="undo-warn" [attr.data-tone]="it.undoable ? 'warning' : null">{{ it.warning }}</span> }
                    </li>
                  }
                </ul>
              </section>
            }
            @if (resetListError()) { <p class="wf-hint">{{ resetListError() }}</p> }
          }
          @if (pendingError()) { <p class="wf-error" role="alert">{{ pendingError() }}</p> }
        </div>
      }
      @if (pending(); as p) {
        <div modal-footer class="foot">
          <ui-button variant="ghost" (click)="closeDialog()" [disabled]="busy()">Cancel</ui-button>
          <!-- Not before the reset's list arrives: confirming then would take back nothing. -->
          <ui-button [variant]="p.tone === 'danger' ? 'destructive' : 'primary'" (click)="confirm()" [disabled]="busy() || resetLoading()">{{ p.label }}</ui-button>
        </div>
      }
    </ui-modal>
    <ui-wf-decide [task]="openTask()" [api]="client()" (closed)="openTask.set(null)" (decided)="afterDecide()" />
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-3); font-size: 13.5px; color: var(--ui-color-text); }
    :host(.idle) { display: none; }
    /* The dialogs open on a fixed layer; their empty host elements (and the decide dialog's own modal) must not add gaps to this column. */
    ui-modal, ui-wf-decide { position: absolute; }
    .actions { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); }
    .reset { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--ui-space-2); padding-top: var(--ui-space-2);
      border-top: 1px dashed var(--ui-color-border); }
    .reset-note { font-size: 12px; color: var(--ui-color-text-muted); }
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
    .undo { display: flex; flex-direction: column; gap: var(--ui-space-2); padding-top: var(--ui-space-3); border-top: 1px solid var(--ui-color-border); }
    .undo-head { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); }
    .undo-head h3 { margin: 0; }
    .undo-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .undo-list li { display: flex; flex-direction: column; gap: 4px; padding: var(--ui-space-2) var(--ui-space-3); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); }
    .undo-title { font-size: 13.5px; font-weight: 550; }
    .undo-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding-left: 26px; font-size: 12px; color: var(--ui-color-text-muted); }
    .undo-warn { padding-left: 26px; font-size: 12px; line-height: 1.4; color: var(--ui-color-text-muted); }
    .undo-warn[data-tone="warning"] { color: var(--ui-color-warning); }
    .undo-list li.off .undo-title { color: var(--ui-color-text-muted); }
    .lw { display: block; min-width: 0; }
    .count { align-self: flex-end; margin: 0; }
    .foot { display: flex; justify-content: space-between; gap: var(--ui-space-2); width: 100%; }
  `],
})
export class WfRecordActions extends WfWithApi {
  readonly record = input.required<UiWfRecord>();
  readonly entity = input.required<string>();
  readonly entityId = input.required<string>();
  /** List the record's open tasks. */
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
  protected readonly pending = signal<WfPendingAction | null>(null);
  protected readonly pendingManual = signal<string | null>(null);
  protected readonly pendingError = signal('');
  protected readonly remarksMax = WF_REMARKS_MAX;
  protected readonly counter = wfRemarksCounter;
  /** The person's remarks on the move or reset (spec §6 remarks). */
  protected readonly remark = signal('');
  /** Set when a required remark was left empty on confirm. */
  protected readonly remarkMissing = signal(false);
  protected readonly openTask = signal<UiWfTask | null>(null);
  /** The open dialog is the reset's (not a move's or a manual start's). */
  protected readonly resetting = signal(false);
  /** What the workflow did that the reset can take back (spec §6 reset list), and which are ticked. */
  protected readonly resetItems = signal<UiWfResetItem[]>([]);
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());
  protected readonly resetLoading = signal(false);
  /** The list has been read (it may be empty). */
  protected readonly resetLoaded = signal(false);
  protected readonly resetListError = signal('');
  /** The list's token, sent back so a reset fails if the list changed since it was read. */
  private resetToken: string | undefined;
  /** Bumped per list request and when the dialog closes, so a late answer is dropped. */
  private resetSeq = 0;
  protected readonly undoableCount = computed(() => this.resetItems().filter((i) => i.undoable).length);
  /** Small buttons with a mouse; the regular size on touch screens, where 26px looks cramped. */
  protected readonly buttonSize: 'sm' | 'md' = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'md' : 'sm';
  protected readonly nothingToDo = computed(() => {
    const r = this.record();
    return !r.transitions.length && !r.manual.length && !r.reset && !(this.showTasks() && r.tasks.length) && !this.pending() && !this.openTask();
  });
  protected readonly idle = computed(() => this.nothingToDo() && !this.emptyText() && !this.error());
  /**
   * The record shown is the one named by `entity`/`entityId`. While the host is switching records the
   * old record may still be bound: nothing is sent then, so an old move's key never reaches a new id.
   */
  private readonly current = computed(() => {
    const r = this.record();
    return r.entity === this.entity() && r.id === this.entityId();
  });

  constructor() {
    super();
    // A dialog (and an error) belongs to the record it was opened for: switching records clears them.
    effect(() => {
      this.entity();
      this.entityId();
      untracked(() => { this.closeDialog(true); this.error.set(''); this.openTask.set(null); });
    });
  }

  /** Closes the confirmation and forgets everything it held (the reset's list included). */
  protected closeDialog(force = false): void {
    if (this.busy() && !force) return;
    this.resetSeq++;
    this.pending.set(null);
    this.pendingManual.set(null);
    this.pendingError.set('');
    this.resetting.set(false);
    this.resetItems.set([]);
    this.chosen.set(new Set());
    this.resetLoading.set(false);
    this.resetLoaded.set(false);
    this.resetListError.set('');
    this.remark.set('');
    this.remarkMissing.set(false);
  }

  protected start(t: UiWfTransitionOption): void {
    if (this.busy() || !this.current()) return;
    this.closeDialog();
    const p: WfPendingAction = { ...t, remarks: wfRemarksFor(t) };
    if (!t.form && !t.confirm && p.remarks === 'none') { void this.apply(t.key, {}); return; }
    this.pending.set(p);
  }

  /** Starting over: asks its confirmation or form first when it has one. */
  protected startReset(): void {
    const rs = this.record().reset;
    if (this.busy() || !rs || !this.current()) return;
    this.closeDialog();
    this.resetting.set(true);
    // Always confirmed: a reset stops work in progress.
    this.pending.set({
      key: '', label: rs.label, to: rs.to, toLabel: rs.toLabel, tone: 'danger', confirm: rs.confirm ?? `Start over from “${rs.toLabel}”? Open tasks and runs stop.`, form: rs.form,
      remarks: rs.comment ?? 'optional',
    });
    void this.loadResetItems();
  }

  /**
   * Reads what the workflow did, ticking what the engine suggests (everything that can be undone and
   * wasn't changed since). With [keepChoices], items still listed keep the person's ticks.
   */
  private async loadResetItems(keepChoices = false): Promise<void> {
    const api = this.client();
    const seq = ++this.resetSeq;
    const before = { items: new Set(this.resetItems().map((i) => i.id)), chosen: this.chosen() };
    this.resetItems.set([]);
    this.chosen.set(new Set());
    this.resetToken = undefined;
    this.resetListError.set('');
    this.resetLoaded.set(false);
    if (!api?.resetPreview) return;
    this.resetLoading.set(true);
    try {
      const preview = await api.resetPreview(this.entity(), this.entityId());
      // The dialog may have been closed, or the list asked for again, while this one was on its way.
      if (seq !== this.resetSeq) return;
      this.resetItems.set(preview.items);
      this.resetToken = preview.token;
      this.chosen.set(new Set(preview.items.filter((i) => i.undoable && (keepChoices && before.items.has(i.id) ? before.chosen.has(i.id) : i.selected)).map((i) => i.id)));
      this.resetLoaded.set(true);
    } catch {
      if (seq === this.resetSeq) this.resetListError.set("What the workflow did couldn't be listed, so the reset will leave it as it is.");
    } finally {
      if (seq === this.resetSeq) this.resetLoading.set(false);
    }
  }

  protected choose(id: string, on: boolean): void {
    const next = new Set(this.chosen());
    if (on) next.add(id); else next.delete(id);
    this.chosen.set(next);
  }

  protected chooseAll(on: boolean): void {
    this.chosen.set(new Set(on ? this.resetItems().filter((i) => i.undoable).map((i) => i.id) : []));
  }

  protected kindLabel(kind: string): string {
    return ({ field: 'Field', created: 'New record', action: 'Action', message: 'Message', webhook: 'Webhook', move: 'Move' } as Record<string, string>)[kind] ?? wfHumanize(kind);
  }

  protected startManual(m: UiWfRecord['manual'][number]): void {
    if (this.busy() || !this.current()) return;
    this.closeDialog();
    this.pendingManual.set(m.key);
    if (!m.form) { void this.runManual(m.key, {}); return; }
    this.pending.set({ key: m.key, label: m.label, to: '', toLabel: '', tone: 'primary', confirm: null, form: m.form, remarks: 'none' });
  }

  protected confirm(): void {
    const p = this.pending();
    // A double click on the confirm button must not apply the move twice.
    if (!p || this.busy() || this.resetLoading() || !this.current()) return;
    // The form checks itself first and shows what's wrong next to each answer; the engine checks again.
    // Its submission holds every answer, untouched defaults and prefilled values too.
    let input: Record<string, unknown> = {};
    if (p.form) {
      const s = this.form()?.submit();
      if (!s) return;
      const a = wfFormAnswers(s);
      if ('error' in a) { this.pendingError.set(a.error); return; }
      input = a.data;
    }
    if (p.remarks === 'required' && !this.remark().trim()) {
      this.remarkMissing.set(true);
      this.pendingError.set('Add remarks to explain this.');
      return;
    }
    if (p.remarks !== 'none' && this.remark().trim().length > WF_REMARKS_MAX) {
      this.remarkMissing.set(true);
      this.pendingError.set(WF_REMARKS_TOO_LONG);
      return;
    }
    if (this.resetting()) void this.reset(input);
    else if (this.pendingManual()) void this.runManual(p.key, input);
    else void this.apply(p.key, input);
  }

  private async apply(key: string, input: Record<string, unknown>): Promise<void> {
    const api = this.client();
    if (!api) return;
    this.busy.set(true);
    try {
      const remark = this.pending()?.remarks !== 'none' ? this.remark().trim() || undefined : undefined;
      const r = await api.applyTransition(this.entity(), this.entityId(), key, input, remark);
      this.error.set('');
      this.closeDialog(true);
      this.changed.emit(r);
    } catch (e) {
      const msg = wfErrorText(e, 'That did not work.');
      if (this.pending()) this.pendingError.set(msg); else this.error.set(msg);
    } finally {
      this.busy.set(false);
    }
  }

  private async reset(input: Record<string, unknown>): Promise<void> {
    const api = this.client();
    if (!api) return;
    this.busy.set(true);
    try {
      const undo = this.resetItems().filter((i) => this.chosen().has(i.id)).map((i) => i.id);
      const r = await api.resetRecord(this.entity(), this.entityId(), input, undo.length ? undo : undefined, this.remark().trim() || undefined, this.resetToken);
      this.error.set('');
      this.closeDialog(true);
      this.changed.emit(r);
    } catch (e) {
      const msg = wfErrorText(e, 'The workflow could not be reset.');
      if (this.pending()) this.pendingError.set(msg); else this.error.set(msg);
      // Someone else changed what the workflow did meanwhile: show the list as it is now, keeping the person's ticks.
      if (this.pending() && (e as { code?: string })?.code === 'resetChanged') void this.loadResetItems(true);
    } finally {
      this.busy.set(false);
    }
  }

  private async runManual(key: string, input: Record<string, unknown>): Promise<void> {
    const api = this.client();
    if (!api) return;
    this.busy.set(true);
    try {
      await api.startManual(key, this.entity(), this.entityId(), input);
      this.error.set('');
      this.closeDialog(true);
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

// ── Task inbox ────────────────────────────────────────────────────────────

/**
 * The task inbox inside `ui-workflow-tasks-drawer`: approvals and tasks, due first, overdue marked,
 * open or finished, each opening its decision. Internal: apps use the drawer.
 */
@Component({
  selector: 'ui-wf-task-inbox',
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
        <li class="empty">{{ emptyText() }}</li>
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
export class WfTaskInbox extends WfWithApi {
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
  /** The list has been read at least once (until then it says it is loading, not that it is empty). */
  protected readonly loaded = signal(false);
  protected readonly emptyText = computed(() => {
    if (!this.loaded()) return this.error() ? '' : 'Loading…';
    if (this.status() === 'done') return this.scope() === 'all' ? 'No finished tasks yet.' : 'You haven’t finished any tasks yet.';
    return this.scope() === 'all' ? 'No open tasks.' : 'Nothing is waiting for you.';
  });
  private take = 25;

  constructor() {
    super();
    effect(() => {
      this.client();
      this.status();
      this.scope();
      this.take = this.pageSize();
      untracked(() => { this.loaded.set(false); this.tasks.set([]); this.total.set(0); void this.reload(); });
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
      this.loaded.set(true);
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
 * One run drawn over its workflow: each step with what happened (done, waiting, failed, skipped),
 * the paths not taken greyed out, and, for people who may intervene, try again, skip (giving the
 * step's results) and cancel (with remarks). Internal: the workflow panel and the tasks drawer show
 * it where the run matters.
 */
@Component({
  selector: 'ui-wf-run-view',
  imports: [FormsModule, HugeiconsIconComponent, UiButton, UiModal, UiTextarea, WfValueInput],
  template: `
    @if (run(); as r) {
      @if (showHead()) {
      <header class="head">
        <div class="t"><strong>{{ r.title }}</strong> <span class="v">v{{ r.version }}</span>
          <span class="wf-chip" [attr.data-tone]="statusTone(r.status)">{{ statusLabel(r.status) }}</span>{{ r.stateLabel ? ' · ' + r.stateLabel : '' }}</div>
        <span class="m">{{ r.entityTitle ?? r.entityId ?? '' }} · started {{ ago(r.startedAt) }}{{ r.initiatorName ? ' by ' + r.initiatorName : '' }}</span>
      </header>
      }
      @if (r.status === 'incident') {
        <div class="incident" role="alert">
          <p><strong>Stopped:</strong> {{ readable(r.error) }}</p>
          @if (mayIntervene()) {
            @if (timerParked(r)) {
              <!-- A timer kept failing and the engine parked it: try again re-arms it (due now), skip drops it unrun. -->
              <p class="wf-hint">{{ r.kind === 'record'
                ? 'Try again runs it now. Skip drops it: the record stays where it is. Moving the record by hand also clears this.'
                : 'Try again runs it now. Skip drops it; the task stays open and can still be decided.' }}</p>
              <div class="wf-row">
                <ui-button size="sm" (click)="act('retry')" [disabled]="busy()">Try again</ui-button>
                <ui-button size="sm" variant="outline" (click)="askSkipTimer()" [disabled]="busy()">Skip</ui-button>
                @if (r.kind !== 'record') {
                  <ui-button size="sm" variant="destructive" (click)="askCancel()" [disabled]="busy()">Cancel the run</ui-button>
                }
              </div>
            } @else if (incidents().length > 1) {
              <!-- Several paths stopped: each can be retried or skipped on its own. -->
              <ul class="stops">
                @for (i of incidents(); track i.token) {
                  <li><span>{{ i.name }}</span>
                    <ui-button size="sm" (click)="act('retry', i.token)" [disabled]="busy()">Try again</ui-button>
                    <ui-button size="sm" variant="outline" (click)="askSkip(i.token, i.stepId)" [disabled]="busy()">Skip</ui-button>
                  </li>
                }
              </ul>
              <div class="wf-row"><ui-button size="sm" variant="destructive" (click)="askCancel()" [disabled]="busy()">Cancel the run</ui-button></div>
            } @else {
              <div class="wf-row">
                <ui-button size="sm" (click)="act('retry')" [disabled]="busy()">Try again</ui-button>
                <ui-button size="sm" variant="outline" (click)="askSkip(undefined, r.errorStepId)" [disabled]="busy()">Skip the step</ui-button>
                <ui-button size="sm" variant="destructive" (click)="askCancel()" [disabled]="busy()">Cancel the run</ui-button>
              </div>
            }
          } @else {
            <p class="wf-hint">Someone who looks after workflows can try it again or skip it.</p>
          }
        </div>
      } @else if (mayIntervene() && (r.status === 'waiting' || r.status === 'running' || r.status === 'queued')) {
        <div class="wf-row"><ui-button size="sm" variant="destructive" (click)="askCancel()" [disabled]="busy()">Cancel the run</ui-button></div>
      }
      @if (error()) { <p class="wf-error">{{ error() }}</p> }
      <!-- A lifecycle record instance has no steps of its own: no empty list for it. -->
      @if (rows().length) {
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
      }
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

    <!-- Skipping: the run carries on as if the step had finished, with the results given here. -->
    <ui-modal [open]="!!skipping()" (openChange)="!$event && skipping.set(null)" [title]="skipping()?.timer ? 'Skip ' + (skipping()?.name ?? '') : 'Skip “' + (skipping()?.name ?? '') + '”'" size="md">
      @if (skipping(); as sk) {
        <div class="dlg">
          @if (sk.timer) {
            <p>{{ sk.timer === 'record'
              ? 'It is dropped without running: the record stays where it is, with nothing scheduled in its place. It can still be moved by hand.'
              : 'It is dropped without running. The task stays open and can still be decided.' }}</p>
          } @else {
            <p>The run carries on as if this step had finished.@if (sk.outputs.length) { Give what it would have produced, for the steps after it. }</p>
          }
          @for (o of sk.outputs; track o.key) {
            <div class="lw"><span class="wf-label">{{ o.label }}{{ o.required ? ' (required)' : '' }}</span>
              <ui-wf-value-input [field]="o.options?.length ? { key: o.key, label: o.label, type: 'enum', options: o.options } : undefined" [type]="o.type"
                [value]="skipValues()[o.key] ?? null" [label]="o.label" (valueChange)="setSkipValue(o.key, $event)" /></div>
          }
          @if (skipError()) { <p class="wf-error" role="alert">{{ skipError() }}</p> }
        </div>
      }
      @if (skipping()) {
        <div modal-footer class="foot">
          <ui-button variant="ghost" (click)="skipping.set(null)" [disabled]="busy()">Back</ui-button>
          <ui-button (click)="confirmSkip()" [disabled]="busy()">{{ skipping()?.timer ? 'Skip it' : 'Skip the step' }}</ui-button>
        </div>
      }
    </ui-modal>

    <!-- Cancelling is a negative action: confirmed, with optional remarks that go into the audit. -->
    <ui-modal [open]="cancelling()" (openChange)="!$event && cancelling.set(false)" title="Cancel the run" size="md">
      @if (cancelling()) {
        <div class="dlg">
          <p>The run stops here and its open tasks are cancelled. What it already did stays done.</p>
          <label class="lw"><span class="wf-label">Remarks (optional)</span>
            <ui-textarea [ngModel]="cancelRemarks()" (ngModelChange)="cancelRemarks.set($event)" [rows]="2" [autosize]="true" [maxlength]="remarksMax" /></label>
          @if (counter(cancelRemarks()); as c) { <span class="wf-hint count" aria-live="polite">{{ c }}</span> }
        </div>
      }
      @if (cancelling()) {
        <div modal-footer class="foot">
          <ui-button variant="ghost" (click)="cancelling.set(false)" [disabled]="busy()">Back</ui-button>
          <ui-button variant="destructive" (click)="confirmCancel()" [disabled]="busy()">Cancel the run</ui-button>
        </div>
      }
    </ui-modal>
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
    .steps li[data-status="timedOut"] { --wf-s: var(--ui-color-warning); border-left-color: var(--ui-color-warning); }
    .name { font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .st { font-size: 11.5px; color: var(--ui-color-text-secondary); white-space: nowrap; }
    .detail { grid-column: 2 / 4; font-size: 12px; color: var(--ui-color-text-muted); overflow-wrap: anywhere; }
    .tasks h4 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ui-color-text-muted); }
    .tasks ul { margin: 0; padding-left: var(--ui-space-4); }
    .dlg { display: flex; flex-direction: column; gap: var(--ui-space-2); font-size: 14px; }
    .dlg p { margin: 0; }
    .lw { display: block; min-width: 0; }
    .count { align-self: flex-end; margin: 0; }
    .foot { display: flex; justify-content: space-between; gap: var(--ui-space-2); width: 100%; }
    ui-modal { position: absolute; }
  `],
})
export class WfRunView extends WfWithApi {
  readonly instanceId = input.required<string>();
  /** Show the run's title, version and status (off where the host already names the run). */
  readonly showHead = input(true);
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
      return { token: t.id, stepId: t.stepId, name: step ? stepName(step) : t.stepId ?? t.id };
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
      // A step that finished because its time ran out isn't "done": it took its timeout path.
      const status = last?.status === 'completed' && wfStepTimedOut(last.output) ? 'timedOut' : last?.status ?? 'notRun';
      out.push({
        id: loc.step.id, name: stepName(loc.step), depth: loc.path.length - 1, status,
        statusText: { completed: 'Done', timedOut: 'Out of time', waiting: 'Waiting', running: 'Running', failed: 'Failed', skipped: 'Skipped', cancelled: 'Cancelled', notRun: '' }[status] ?? status,
        detail: last?.error ?? (runs.length > 1 ? `${runs.length} attempts` : ''),
        icon: status === 'completed' ? WF_ICONS.Tick02Icon : status === 'timedOut' ? WF_ICONS.Clock02Icon : status === 'failed' ? WF_ICONS.Cancel01Icon : WF_STEP_ICONS[loc.step.type] ?? WF_ICONS.FlashIcon,
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
  protected readonly readable = wfReadableError;
  /** Stopped by a timer the engine parked rather than a failed step (see `wfTimerParked`). */
  protected readonly timerParked = wfTimerParked;

  /**
   * What is being skipped: a stopped step, with the results it would have produced (for the steps
   * after it), or a parked timer (`timer`: whose it is, a record's or a run's), dropped unrun.
   */
  protected readonly skipping = signal<{ target?: string; name: string; outputs: UiWfParamDescriptor[]; timer?: 'record' | 'run' } | null>(null);
  protected readonly skipValues = signal<Record<string, unknown>>({});
  protected readonly skipError = signal('');
  protected readonly cancelling = signal(false);
  protected readonly cancelRemarks = signal('');
  protected readonly remarksMax = WF_REMARKS_MAX;
  protected readonly counter = wfRemarksCounter;

  protected async askSkip(target: string | undefined, stepId: string | null | undefined): Promise<void> {
    const def = this.definition();
    const step = def && stepId ? indexSteps(def).get(stepId)?.step : undefined;
    let outputs: UiWfParamDescriptor[] = [];
    if (step?.type === 'action') {
      // An app action's results are declared in the registry, with labels, types and which are required.
      const schema = await this.client()?.schema().catch(() => null);
      outputs = schema?.registry.actions?.find((a) => a.key === step.action)?.outputs ?? [];
    }
    this.skipValues.set({});
    this.skipError.set('');
    this.skipping.set({ target, name: step ? stepName(step) : 'the step', outputs });
  }

  /** Skipping the parked timer(s) of an incident: confirmed first, since what it would have done never happens. */
  protected askSkipTimer(): void {
    const r = this.run();
    if (!r) return;
    this.skipValues.set({});
    this.skipError.set('');
    this.skipping.set({ name: wfParkedTimerName(r.error), outputs: [], timer: r.kind === 'record' ? 'record' : 'run' });
  }

  protected setSkipValue(key: string, value: unknown): void {
    this.skipValues.update((v) => ({ ...v, [key]: value }));
    this.skipError.set('');
  }

  protected confirmSkip(): void {
    const sk = this.skipping();
    if (!sk || this.busy()) return;
    const given: Record<string, unknown> = {};
    const missing: string[] = [];
    for (const o of sk.outputs) {
      const v = wfSkipValue(o.type, this.skipValues()[o.key]);
      if (v === undefined) { if (o.required) missing.push(o.label); continue; }
      given[o.key] = v;
    }
    if (missing.length) {
      this.skipError.set(`Give ${missing.join(', ')}: the steps after it need ${missing.length === 1 ? 'it' : 'them'}.`);
      return;
    }
    void this.act('skip', sk.target, Object.keys(given).length ? given : undefined).then((ok) => ok && this.skipping.set(null));
  }

  protected askCancel(): void {
    this.cancelRemarks.set('');
    this.cancelling.set(true);
  }

  protected confirmCancel(): void {
    if (this.cancelRemarks().trim().length > WF_REMARKS_MAX) { this.error.set(WF_REMARKS_TOO_LONG); return; }
    void this.act('cancel', undefined, undefined, this.cancelRemarks().trim() || undefined).then((ok) => ok && this.cancelling.set(false));
  }

  protected async act(kind: 'retry' | 'skip' | 'cancel', target?: string, outputs?: Record<string, unknown>, reason?: string): Promise<boolean> {
    const api = this.client();
    const r = this.run();
    if (!api || !r || this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    try {
      const next = kind === 'retry' ? await api.retry(r.id, target) : kind === 'skip' ? await api.skip(r.id, outputs, target) : await api.cancel(r.id, reason);
      this.seq++;
      this.run.set(next);
      this.changed.emit(next);
      return true;
    } catch (e) {
      this.error.set(wfErrorText(e, 'That did not work.'));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}

/**
 * A skipped step's result as its registry type wants it (a number as a number, yes/no as a boolean),
 * or undefined when nothing usable was given.
 */
export function wfSkipValue(type: UiWfFieldType | undefined, raw: unknown): unknown {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return undefined;
    if (type === 'number' || type === 'currency') { const n = Number(t); return Number.isFinite(n) ? n : undefined; }
    if (type === 'boolean') return t === 'true' ? true : t === 'false' ? false : undefined;
    return t;
  }
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  return raw;
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
      <!-- The engine's export can't be narrowed to one run: showing it here would export more than is listed. -->
      @if (!instanceId()) {
        <ui-button size="sm" variant="ghost" (click)="exportAs('csv')" [disabled]="busy()"><hugeicons-icon aria-hidden="true" [icon]="icons.Download04Icon" [size]="14" [strokeWidth]="1.8" />CSV</ui-button>
      }
    </div>
    @if (instanceId()) { <p class="wf-hint note">Only one run’s entries are shown. To export, open the audit log of the whole record: an export can’t be limited to one run.</p> }
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
            <span class="who">{{ actor(e) }}</span>
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
        <li class="empty">{{ loaded() ? 'No entries.' : error() ? 'Nothing to show.' : 'Loading…' }}</li>
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
    .note { margin: 0; }
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
  /** The first page has arrived (until then the list says it is loading, not that it is empty). */
  protected readonly loaded = signal(false);
  protected override readonly when = (iso: string | null | undefined) => wfDateTime(iso);

  /** Workflow titles by key, so entries by a workflow name it rather than its key. */
  private readonly titles = signal<ReadonlyMap<string, string>>(new Map());

  constructor() {
    super();
    effect(() => {
      this.client(); this.category(); this.recordFilter(); this.entity(); this.entityId(); this.instanceId();
      untracked(() => void this.load(false));
    });
    effect(() => {
      const api = this.client();
      if (api) untracked(() => void api.definitions().then((d) => this.titles.set(new Map(d.map((x) => [x.key, x.title])))).catch(() => undefined));
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.recordTimer));
  }

  protected actor(e: UiWfAuditEntry): string {
    return wfActorLabel(e, (k) => this.titles().get(k));
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
      this.loaded.set(true);
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
    // A run's log can't be exported on its own (the export has no run filter).
    if (!api || this.busy() || this.instanceId()) return;
    this.busy.set(true);
    try {
      const { instanceId: _run, take: _take, ...q } = this.query();
      const blob = await api.exportAudit({ ...q, format });
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
