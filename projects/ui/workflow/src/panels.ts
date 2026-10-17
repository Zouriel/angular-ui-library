import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton } from '@zouriel/ui/button';
import { UiModal } from '@zouriel/ui/dialog';
import { UiInput, UiTextarea } from '@zouriel/ui/form';
import { UiWfApiError, type UiWfDefinitionDetail, type UiWfSimulationEvent, type UiWfSimulationResult } from './api';
import { fieldOf, indexSteps, stepName } from './definition';
import { WfDurationInput, WfValueInput } from './editors';
import { WF_ICONS } from './icons';
import type { UiWfTaskStep, UiWorkflowDefinition } from './schema';
import { WfBuilderStore } from './store';
import { WF_SHARED_STYLES } from './styles';

function when(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Versions: what changed since publishing, publish with a note, earlier versions, roll back. */
@Component({
  selector: 'ui-wf-versions',
  imports: [FormsModule, UiButton, UiModal, UiTextarea],
  template: `
    <div class="wrap">
      @if (!store.api()) {
        <p class="wf-hint">Connect an API (provideUiWorkflow) to publish and see versions.</p>
      } @else if (!saved()) {
        <p class="wf-warn">Save the workflow first; versions are kept by the engine.</p>
      } @else {
        <section class="card">
          <h3>Unpublished changes</h3>
          @if (diff().length) {
            <ul class="diff">@for (d of diff(); track $index) { <li>{{ d }}</li> }</ul>
          } @else {
            <p class="wf-hint">None. The draft matches the published version.</p>
          }
          <label class="lw"><span class="wf-label">What changed (kept with the version)</span>
            <ui-textarea [ngModel]="note()" (ngModelChange)="note.set($event)" [rows]="2" [autosize]="true" placeholder="e.g. Added a finance check for large amounts" /></label>
          @if (error()) { <p class="wf-error">{{ error() }}</p> }
          <div class="wf-row">
            <ui-button size="sm" (click)="publish()" [disabled]="busy() || store.errorCount() > 0">Publish version {{ (detail()?.summary?.version ?? 0) + 1 }}</ui-button>
            @if (store.errorCount() > 0) { <span class="wf-hint">Fix {{ store.errorCount() }} problem{{ store.errorCount() === 1 ? '' : 's' }} first.</span> }
          </div>
          <p class="wf-hint">Runs already going keep the version they started on.</p>
        </section>

        <section class="card">
          <h3>Versions</h3>
          @for (v of detail()?.versions ?? []; track v.version) {
            <div class="ver">
              <span class="num">v{{ v.version }}</span>
              <span class="info"><span class="note">{{ v.note || 'No note' }}</span>
                <span class="meta">{{ when(v.publishedAt) }}{{ v.publishedBy ? ' · ' + (names()[v.publishedBy] ?? v.publishedBy) : '' }} · {{ v.instances }} run{{ v.instances === 1 ? '' : 's' }}</span></span>
              @if (v.version !== detail()?.summary?.version) { <button type="button" class="wf-link" (click)="askRollback.set(v.version)" [disabled]="busy()">Make current</button> }
              @else { <span class="wf-chip" data-tone="success">Current</span> }
            </div>
          } @empty {
            <p class="wf-hint">Not published yet.</p>
          }
        </section>

        <section class="card">
          <h3>Status</h3>
          <p class="wf-hint">{{ detail()?.summary?.status === 'archived' ? 'Archived: it starts nothing new; running ones finish.' : 'Active.' }}</p>
          <div class="wf-row">
            @if (detail()?.summary?.status === 'archived') {
              <ui-button size="sm" variant="outline" (click)="restore()" [disabled]="busy()">Restore</ui-button>
            } @else if ((detail()?.summary?.version ?? 0) > 0) {
              <ui-button size="sm" variant="outline" (click)="archive()" [disabled]="busy()">Archive</ui-button>
            }
          </div>
        </section>
      }
    </div>

    <ui-modal [open]="askRollback() !== null" (openChange)="!$event && askRollback.set(null)" [title]="'Make version ' + askRollback() + ' current?'" size="sm">
      <p class="confirm">This publishes version {{ askRollback() }} again as a new version, and the draft becomes a copy of it. Edits not yet saved are replaced.</p>
      <div modal-footer class="foot">
        <ui-button variant="ghost" (click)="askRollback.set(null)">Cancel</ui-button>
        <ui-button (click)="rollback(askRollback()!)" [disabled]="busy()">Make current</ui-button>
      </div>
    </ui-modal>
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: block; overflow: auto; }
    .confirm { margin: 0; font-size: 14px; line-height: 1.5; }
    .foot { display: flex; justify-content: flex-end; gap: var(--ui-space-2); width: 100%; }
    .wrap { max-width: 720px; margin: 0 auto; padding: var(--ui-space-4) var(--ui-space-3); display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .card { display: flex; flex-direction: column; gap: var(--ui-space-2); padding: var(--ui-space-3); background: var(--ui-color-surface); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
    h3 { margin: 0; font-size: 13px; font-weight: 650; }
    .diff { margin: 0; padding-left: var(--ui-space-4); font-size: 13px; line-height: 1.5; }
    .lw { display: block; }
    .ver { display: flex; align-items: center; gap: var(--ui-space-2); padding: 6px 0; border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .num { font-family: var(--ui-font-mono); font-size: 12px; font-weight: 600; width: 36px; }
    .info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .note { font-size: 13px; }
    .meta { font-size: 11.5px; color: var(--ui-color-text-muted); }
  `],
})
export class WfVersions {
  protected readonly store = inject(WfBuilderStore);
  readonly saved = input(false);
  /** The engine's draft now equals this definition (after publishing or rolling back). */
  readonly synced = output<UiWorkflowDefinition>();
  protected readonly askRollback = signal<number | null>(null);
  /** Publishers' names by user id. */
  protected readonly names = signal<Record<string, string>>({});
  protected readonly detail = signal<UiWfDefinitionDetail | null>(null);
  protected readonly diff = signal<string[]>([]);
  protected readonly note = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly when = when;

  constructor() {
    effect(() => {
      const api = this.store.api();
      this.store.version();
      if (api && this.saved()) untracked(() => this.refresh());
    });
  }

  private async refresh(): Promise<void> {
    const api = this.store.api();
    if (!api) return;
    try {
      const d = await api.definition(this.store.def().id);
      this.detail.set(d);
      // The engine's own flag says whether anything is unpublished; the diff only explains what.
      this.diff.set(d.summary.version > 0 && d.summary.hasDraftChanges ? await api.diff(d.summary.id) : []);
      void this.loadNames(d.versions.map((v) => v.publishedBy).filter((x): x is string => !!x));
    } catch {
      this.detail.set(null);
    }
  }

  private async loadNames(ids: string[]): Promise<void> {
    const api = this.store.api();
    const missing = [...new Set(ids)].filter((id) => !(id in this.names()));
    if (!api || !missing.length) return;
    const found = await Promise.all(missing.map((id) => api.user(id).catch(() => null)));
    this.names.update((n) => ({ ...n, ...Object.fromEntries(missing.map((id, i) => [id, found[i]?.name ?? id])) }));
  }

  private async run(f: () => Promise<unknown>): Promise<void> {
    // One at a time: a double click must not publish (or roll back) twice.
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await f();
      await this.refresh();
    } catch (e) {
      this.error.set(e instanceof UiWfApiError ? e.message : 'Something went wrong.');
    } finally {
      this.busy.set(false);
    }
  }

  protected publish(): void {
    void this.run(async () => {
      const api = this.store.api()!;
      const def = this.store.def();
      await api.saveDraft(def);
      const s = await api.publish(def.id, this.note() || undefined);
      this.note.set('');
      const d = await api.definition(s.id);
      if (d.published) this.store.published.set(d.published);
      this.synced.emit(def);
    });
  }

  protected rollback(version: number): void {
    this.askRollback.set(null);
    void this.run(async () => {
      const api = this.store.api()!;
      await api.rollback(this.store.def().id, version);
      // The engine's draft is now the old version: show that, not the edits from before.
      const d = await api.definition(this.store.def().id);
      if (d.published) this.store.published.set(d.published);
      this.store.commit(d.draft);
      this.synced.emit(d.draft);
    });
  }

  protected archive(): void {
    void this.run(() => this.store.api()!.archive(this.store.def().id));
  }

  protected restore(): void {
    void this.run(() => this.store.api()!.restore(this.store.def().id));
  }
}

/**
 * Test runs: run the draft against a real record (or made-up values) without changing anything.
 * The engine reports what each step did or would do; tasks can be decided and time moved forward.
 */
@Component({
  selector: 'ui-wf-test',
  imports: [FormsModule, HugeiconsIconComponent, UiButton, UiInput, WfDurationInput, WfValueInput],
  template: `
    <div class="wrap">
      @if (!store.api()) {
        <p class="wf-hint">Connect an API (provideUiWorkflow) to test workflows.</p>
      } @else {
        <section class="card">
          <h3>Start</h3>
          @if (store.def().entity) {
            <label class="lw"><span class="wf-label">{{ store.entity()?.label ?? 'Record' }} id</span>
              <ui-input size="sm" [ngModel]="recordId()" (ngModelChange)="recordId.set($event)" placeholder="e.g. 1" /></label>
          }
          @if (store.def().kind === 'lifecycle') {
            <div class="wf-grid2">
              <label class="lw"><span class="wf-label">Record is in</span>
                <select class="wf-select" (change)="fromState.set($any($event.target).value)">
                  <option value="">(its current state)</option>
                  @for (s of states(); track s.id) { <option [value]="s.key" [selected]="s.key === fromState()">{{ s.label }}</option> }
                </select></label>
              <label class="lw"><span class="wf-label">Try</span>
                <select class="wf-select" (change)="transition.set($any($event.target).value)">
                  <option value="">(no transition)</option>
                  @for (t of transitions(); track t.id) { <option [value]="t.key" [selected]="t.key === transition()">{{ t.label }}</option> }
                </select></label>
            </div>
          } @else if (triggerField(); as f) {
            <div class="wf-grid2">
              <label class="lw"><span class="wf-label">{{ f.label }} was</span><ui-wf-value-input [field]="f" [value]="from()" (valueChange)="from.set($event)" /></label>
              <label class="lw"><span class="wf-label">and became</span><ui-wf-value-input [field]="f" [value]="to()" (valueChange)="to.set($event)" /></label>
            </div>
          }
        </section>

        <section class="card">
          <h3>Then</h3>
          @for (e of events(); track $index; let i = $index) {
            <div class="ev">
              <select class="wf-select" (change)="setEventType(i, $any($event.target).value)" aria-label="What happens">
                <option value="decide" [selected]="e.type === 'decide'">Someone decides</option>
                <option value="advance" [selected]="e.type === 'advance'">Time passes</option>
                @if (signals().length) { <option value="signal" [selected]="e.type === 'signal'">The app reports</option> }
              </select>
              @switch (e.type) {
                @case ('decide') {
                  <select class="wf-select" (change)="patchEvent(i, { step: $any($event.target).value, outcome: outcomesOf($any($event.target).value)[0]?.key })" aria-label="Task">
                    @for (h of humanSteps(); track h.id) { <option [value]="h.id" [selected]="h.id === e.step">{{ h.name }}</option> }
                  </select>
                  <select class="wf-select" (change)="patchEvent(i, { outcome: $any($event.target).value })" aria-label="Decision">
                    @for (o of outcomesOf(e.step); track o.key) { <option [value]="o.key" [selected]="o.key === e.outcome">{{ o.label }}</option> }
                  </select>
                }
                @case ('advance') { <ui-wf-duration [value]="e.duration ?? 'P1D'" label="Time" (valueChange)="patchEvent(i, { duration: $event })" /> }
                @case ('signal') {
                  <select class="wf-select" (change)="patchEvent(i, { signal: $any($event.target).value })" aria-label="Event">
                    @for (s of signals(); track s.key) { <option [value]="s.key" [selected]="s.key === e.signal">{{ s.label }}</option> }
                  </select>
                }
              }
              <button type="button" class="wf-icon-btn danger" (click)="removeEvent(i)" aria-label="Remove"><hugeicons-icon aria-hidden="true" [icon]="icons.Delete02Icon" [size]="14" [strokeWidth]="1.8" /></button>
            </div>
          }
          <button type="button" class="wf-link" (click)="addEvent()">Add what happens next</button>
          <div class="wf-row">
            <ui-button size="sm" (click)="run()" [disabled]="busy()"><hugeicons-icon aria-hidden="true" [icon]="icons.PlayIcon" [size]="14" [strokeWidth]="1.8" />Run test</ui-button>
            <span class="wf-hint">Nothing real happens: no messages are sent and no records change.</span>
          </div>
          @if (error()) { <p class="wf-error">{{ error() }}</p> }
        </section>

        @if (result(); as r) {
          <section class="card">
            <h3>What happened</h3>
            @if (r.error) { <p class="wf-error">{{ r.error }}</p> }
            @for (p of r.problems; track $index) { <p [class]="p.severity === 'error' ? 'wf-error' : 'wf-warn'">{{ p.message }}</p> }
            <ol class="log">
              @for (l of r.log; track $index) {
                <li [attr.data-kind]="l.kind" [attr.data-action]="l.action">
                  <span class="k">{{ kindLabel(l.kind, l.action) }}</span>
                  <span class="t">{{ logText(l) }}</span>
                </li>
              }
            </ol>
            @if (r.openTasks.length) {
              <h4>Still waiting for</h4>
              <ul class="plain">@for (t of r.openTasks; track t.id) { <li>{{ t.title }} — {{ t.assigneeNames.join(', ') }}</li> }</ul>
            }
            @if (r.record) {
              <details><summary>The record afterwards</summary><pre>{{ json(r.record) }}</pre></details>
            }
          </section>
        }
      }
    </div>
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: block; overflow: auto; }
    .wrap { max-width: 760px; margin: 0 auto; padding: var(--ui-space-4) var(--ui-space-3); display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .card { display: flex; flex-direction: column; gap: var(--ui-space-2); padding: var(--ui-space-3); background: var(--ui-color-surface); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
    h3 { margin: 0; font-size: 13px; font-weight: 650; }
    h4 { margin: var(--ui-space-2) 0 0; font-size: 12px; font-weight: 650; color: var(--ui-color-text-secondary); }
    .lw { display: block; min-width: 0; }
    .ev { display: grid; grid-template-columns: minmax(120px, 0.8fr) minmax(0, 1fr) minmax(0, 0.8fr) auto; gap: 6px; align-items: center; }
    .ev ui-wf-duration { grid-column: span 2; }
    @media (max-width: 560px) { .ev { grid-template-columns: 1fr auto; } .ev > :not(button) { grid-column: 1; } }
    .wf-row ui-button hugeicons-icon { margin-right: 4px; }
    .log { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; }
    .log li { display: grid; grid-template-columns: 110px 1fr; gap: 8px; padding: 3px 6px; border-radius: var(--ui-radius-xs); }
    .log li:nth-child(odd) { background: color-mix(in srgb, var(--ui-color-text) 3%, transparent); }
    .log .k { color: var(--ui-color-text-muted); font-weight: 550; }
    .log li[data-kind="notify"] .k, .log li[data-kind="action"] .k, .log li[data-kind="webhook"] .k { color: var(--ui-color-primary); }
    .log li[data-action="failed"] .k, .log li[data-kind="error"] .k { color: var(--ui-color-danger); }
    .plain { margin: 0; padding-left: var(--ui-space-4); font-size: 13px; }
    pre { margin: 6px 0 0; padding: 8px; max-height: 260px; overflow: auto; font-size: 11.5px; background: var(--ui-color-bg); border-radius: var(--ui-radius-xs); }
  `],
})
export class WfTest {
  protected readonly store = inject(WfBuilderStore);
  protected readonly icons = WF_ICONS;
  protected readonly recordId = signal('');
  protected readonly from = signal<unknown>(null);
  protected readonly to = signal<unknown>(null);
  protected readonly fromState = signal('');
  protected readonly transition = signal('');
  protected readonly events = signal<UiWfSimulationEvent[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<UiWfSimulationResult | null>(null);
  protected readonly states = computed(() => this.store.def().lifecycle?.states ?? []);
  protected readonly transitions = computed(() => this.store.def().lifecycle?.transitions ?? []);
  protected readonly signals = computed(() => this.store.registry()?.signals ?? []);
  protected readonly triggerField = computed(() => {
    const t = this.store.def().trigger;
    return t?.type === 'fieldChanged' ? fieldOf(this.store.registry(), this.store.def().entity, t.field) : undefined;
  });
  protected readonly humanSteps = computed(() =>
    [...indexSteps(this.store.def()).values()].filter((l) => l.step.type === 'approval' || l.step.type === 'task').map((l) => ({ id: l.step.id, name: stepName(l.step), step: l.step })));

  protected outcomesOf(stepId: string | undefined): { key: string; label: string }[] {
    const s = this.humanSteps().find((h) => h.id === stepId)?.step;
    if (!s) return [];
    if (s.type === 'approval') return [{ key: 'approved', label: 'Approves' }, { key: 'rejected', label: 'Rejects' }];
    return (s as UiWfTaskStep).outcomes.map((o) => ({ key: o.key, label: o.label }));
  }

  protected addEvent(): void {
    const h = this.humanSteps()[0];
    this.events.update((e) => [...e, h ? { type: 'decide', step: h.id, outcome: this.outcomesOf(h.id)[0]?.key } : { type: 'advance', duration: 'P1D' }]);
  }

  protected setEventType(i: number, type: UiWfSimulationEvent['type']): void {
    const h = this.humanSteps()[0];
    const e: UiWfSimulationEvent = type === 'decide' ? { type, step: h?.id, outcome: h ? this.outcomesOf(h.id)[0]?.key : undefined }
      : type === 'advance' ? { type, duration: 'P1D' } : { type, signal: this.signals()[0]?.key };
    this.events.update((list) => list.map((x, j) => (j === i ? e : x)));
  }

  protected patchEvent(i: number, p: Partial<UiWfSimulationEvent>): void {
    this.events.update((list) => list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  }

  protected removeEvent(i: number): void {
    this.events.update((list) => list.filter((_, j) => j !== i));
  }

  protected async run(): Promise<void> {
    const api = this.store.api();
    if (!api) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const def = this.store.def();
      this.result.set(await api.simulate(def, {
        entityId: this.recordId() || undefined,
        trigger: def.kind === 'automation' ? { from: this.from(), to: this.to() ?? undefined } : undefined,
        fromState: this.fromState() || undefined,
        transition: this.transition() || undefined,
        events: this.events(),
      }));
    } catch (e) {
      this.error.set(e instanceof UiWfApiError ? e.message : 'The test could not run.');
    } finally {
      this.busy.set(false);
    }
  }

  protected kindLabel(kind: string, action: string): string {
    const map: Record<string, string> = {
      'step.started': 'Step', 'step.completed': 'Done', 'step.failed': 'Failed', 'step.waiting': 'Waiting', 'notify.email': 'Would email', 'notify.inApp': 'Would message',
      'task.created': 'Task', 'task.decided': 'Decision', 'task.timedOut': 'Out of time', 'instance.started': 'Started', 'instance.completed': 'Finished',
      'instance.failed': 'Failed', 'instance.incident': 'Stopped', 'lifecycle.transitioned': 'Moved', 'clock.advanced': 'Time', 'webhook.POST': 'Would call',
    };
    return map[`${kind}.${action}`] ?? (kind === 'notify' ? 'Would send' : kind === 'action' ? 'Would run' : kind === 'webhook' ? 'Would call' : `${kind}`);
  }

  protected logText(l: UiWfSimulationResult['log'][number]): string {
    return l.text ?? l.subject ?? '';
  }

  protected json(v: unknown): string {
    return JSON.stringify(v, null, 2);
  }
}
