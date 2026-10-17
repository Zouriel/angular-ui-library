import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '@zouriel/ui/button';
import { UiModal } from '@zouriel/ui/dialog';
import { UiInput, UiNumberInput } from '@zouriel/ui/form';
import {
  UiWorkflowAudit,
  UiWorkflowBuilder,
  UiWorkflowGlobalSettings,
  UiWorkflowPermissions,
  UiWorkflowTasksDrawer,
  UiWorkflowPanel,
  UiWorkflowRun,
  UiWorkflowStateBadge,
  UiWorkflowTasks,
  createWorkflow,
  UI_WORKFLOW_API,
  UI_WORKFLOW_CLOCK,
  type UiWfDefinitionSummary,
  type UiWfInstance,
  type UiWorkflowDefinition,
} from '@zouriel/ui/workflow';
import { WorkflowPlayground, readStored, writeStored, type DemoApplication, type DemoMessage } from './workflow-playground';

const TAB_KEY = 'zouriel-workflow-studio-tab';

type Tab = 'workflows' | 'applications' | 'tasks' | 'runs' | 'audit' | 'permissions' | 'settings';

/**
 * The workflow playground: a small scholarship office running on the real .NET engine (a private
 * sandbox per visitor). Build workflows, act as different people, move the clock forward, and see
 * every run and audit entry.
 */
@Component({
  selector: 'page-workflow-studio',
  imports: [FormsModule, UiButton, UiModal, UiInput, UiNumberInput, UiWorkflowBuilder, UiWorkflowPanel, UiWorkflowTasks, UiWorkflowRun, UiWorkflowAudit, UiWorkflowGlobalSettings, UiWorkflowPermissions, UiWorkflowTasksDrawer, UiWorkflowStateBadge],
  providers: [
    { provide: UI_WORKFLOW_API, useFactory: () => inject(WorkflowPlayground).api },
    // "Due in" and "ago" count from the sandbox clock, which the +1h/+1 day buttons move.
    { provide: UI_WORKFLOW_CLOCK, useFactory: () => inject(WorkflowPlayground).now },
  ],
  template: `
    <div class="studio">
      <header class="bar">
        <strong class="brand">Workflow studio</strong>
        <span class="sub">A scholarship office on the real engine — your own sandbox</span>
        <span class="grow"></span>
        <label class="who">You are
          <select #who class="sel" [ngModel]="pg.user()" (ngModelChange)="guard(() => switchUser($event), resetWho)" aria-label="Act as">
            @for (u of pg.users(); track u.id) { <option [value]="u.id">{{ u.name }} · {{ u.title }}</option> }
          </select>
        </label>
        <div class="clock" title="The sandbox clock (your local time). Move it to see waits, reminders and deadlines happen.">
          <span class="now">{{ now() }}</span>
          <ui-button size="sm" variant="ghost" (click)="advance('PT1H')" [disabled]="busy()">+1h</ui-button>
          <ui-button size="sm" variant="ghost" (click)="advance('P1D')" [disabled]="busy()">+1 day</ui-button>
          <ui-button size="sm" variant="ghost" (click)="advance('P3D')" [disabled]="busy()">+3 days</ui-button>
        </div>
        <!-- The person's own approvals and tasks, from anywhere in the app. -->
        <ui-workflow-tasks-drawer (decided)="refresh()" />
        <ui-button size="sm" variant="outline" (click)="askReset.set(true)" [disabled]="busy()">Start over</ui-button>
      </header>

      @if (pg.online() === false) {
        <div class="offline">
          <p><strong>The playground server isn’t reachable.</strong> Run the sample backend in playground mode:</p>
          <pre>cd zouriel-workflows/dotnet/samples/Zouriel.Workflows.Sample
dotnet run --urls http://localhost:5190 --Playground:Enabled=true</pre>
          <ui-button size="sm" (click)="pg.connect()">Try again</ui-button>
        </div>
      } @else {
        <div class="main">
          <nav class="tabs" aria-label="Playground">
            @for (t of tabs; track t.value) {
              <button type="button" [class.on]="tab() === t.value" [attr.aria-current]="tab() === t.value ? 'page' : null" (click)="guard(() => setTab(t.value))">
                {{ t.label }}@if (t.value === 'tasks' && taskCount()) { <span class="count">{{ taskCount() }}</span> }
              </button>
            }
          </nav>
          <section class="content">
            @switch (tab()) {
              @case ('workflows') {
                @if (editing(); as def) {
                  <div class="editor">
                    <div class="editor-bar">
                      <button type="button" class="link back" (click)="guard(() => closeEditor())">‹ All workflows</button>
                      @if (canEdit()) { <span class="hint">Changes save when you press Save; publish from Versions.</span> }
                      @else { <span class="hint">You can look at workflows; Hana (head of office) can change them.</span> }
                    </div>
                    <ui-workflow-builder class="builder" [definition]="def" (definitionChange)="draft.set($event)" [published]="published()" [persist]="true" (saved)="loadWorkflows()" (dirtyChange)="dirty.set($event)" />
                  </div>
                } @else {
                  <div class="list-head">
                    <h2>Workflows</h2>
                    <span class="grow"></span>
                    @if (canEdit()) {
                      <ui-button size="sm" variant="outline" (click)="newWorkflow('lifecycle')">New lifecycle</ui-button>
                      <ui-button size="sm" (click)="newWorkflow('automation')">New automation</ui-button>
                    }
                  </div>
                  <table class="grid">
                    <thead><tr><th>Name</th><th>Kind</th><th>Record</th><th>Version</th><th>Running</th></tr></thead>
                    <tbody>
                      @for (w of workflows(); track w.id) {
                        <tr (click)="open(w)" tabindex="0" (keydown.enter)="open(w)">
                          <td><strong>{{ w.title }}</strong>@if (w.hasDraftChanges && w.version) { <span class="chip warn">unpublished changes</span> }@if (w.status === 'archived') { <span class="chip">archived</span> }</td>
                          <td>{{ w.kind === 'lifecycle' ? 'Lifecycle' : 'Automation' }}</td>
                          <td>{{ w.entity ?? '—' }}</td>
                          <td>{{ w.version ? 'v' + w.version : 'draft' }}</td>
                          <td>{{ w.runningInstances }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                  <p class="hint">Tip: open “Scholarship review” to see a lifecycle, or “Pay approved scholarships” for parallel approvals. Act as Hana (head) to edit.</p>
                }
              }
              @case ('applications') {
                <div class="apps">
                  <div class="app-list">
                    <div class="list-head">
                      <h2>Applications</h2>
                      <span class="grow"></span>
                      <ui-button size="sm" (click)="creating.set(!creating())">New</ui-button>
                    </div>
                    @if (creating()) {
                      <div class="new">
                        <label class="lab"><span>Title</span><ui-input size="sm" placeholder="e.g. Medicine scholarship" [ngModel]="newTitle()" (ngModelChange)="newTitle.set($event)" /></label>
                        <label class="lab"><span>Amount</span><ui-number-input size="sm" [ngModel]="newAmount()" (ngModelChange)="newAmount.set($event ?? 0)" ariaLabel="Amount" [min]="0" /></label>
                        <ui-button size="sm" (click)="createApp()" [disabled]="busy()">Create as {{ pg.currentUser()?.name }}</ui-button>
                      </div>
                    }
                    <ul class="apps-ul">
                      @for (a of apps(); track a.id) {
                        <li><button type="button" [class.on]="selectedApp() === a.id" (click)="selectedApp.set(a.id)">
                          <span class="t">{{ a.title }}</span>
                          <span class="m">{{ a.applicantName }} · {{ a.amount }} · {{ a.programme ?? 'no programme' }}</span>
                          @if (a.status) { <ui-workflow-state-badge [label]="statusLabel(a.status)" [tone]="statusTone(a.status)" /> }
                        </button></li>
                      }
                    </ul>
                  </div>
                  @if (app(); as a) {
                    <div class="app-detail">
                      <h2>{{ a.title }}</h2>
                      <dl class="fields">
                        <dt>Applicant</dt><dd>{{ a.applicantName }}</dd>
                        <dt>Amount</dt><dd><ui-number-input size="sm" [ngModel]="a.amount" (ngModelChange)="patchApp(a.id, { amount: $event })" ariaLabel="Amount" [steppers]="false" /></dd>
                        <dt>Priority</dt><dd><select class="sel" [ngModel]="a.priority" (ngModelChange)="patchApp(a.id, { priority: $event })" aria-label="Priority"><option>Low</option><option>Normal</option><option>High</option></select></dd>
                        <dt>Reviewer</dt><dd><select class="sel" [ngModel]="a.reviewer ?? ''" (ngModelChange)="patchApp(a.id, { reviewer: $event })" aria-label="Reviewer"><option value="">Nobody</option><option value="rana">Rana Ibrahim</option><option value="omar">Omar Saleem</option></select></dd>
                        <dt>Deadline</dt><dd><input class="sel" type="date" [ngModel]="a.deadline ?? ''" (ngModelChange)="patchApp(a.id, { deadline: $event })" aria-label="Deadline" /></dd>
                        <dt>Paid</dt><dd>{{ a.paid ? 'Yes' : 'No' }} @if (!a.paid && a.status === 'Approved' && canPay()) { <ui-button size="sm" variant="ghost" (click)="pay(a.id)" [disabled]="busy()">Record a payment</ui-button> }</dd>
                        <dt>Documents</dt><dd><ul class="docs">@for (d of a.documents; track d.id) { <li><label><input type="checkbox" [checked]="d.verified" (change)="verifyDoc(a.id, d.id)" /> {{ d.name }}</label></li> }</ul></dd>
                        @if (a.notes) { <dt>Notes</dt><dd>{{ a.notes }}</dd> }
                      </dl>
                      <p class="hint">Try changing the status directly: <button type="button" class="link" (click)="forceStatus(a.id)">set status to Approved</button> — the lifecycle refuses it.</p>
                      @if (appError()) { <p class="err">{{ appError() }}</p> }
                      @if (notice()) { <p class="ok" role="status">{{ notice() }}</p> }
                    </div>
                    <aside class="panel">
                      <h3>Workflow</h3>
                      <ui-workflow-panel #panel layout="compact" title="" entity="application" [entityId]="'' + a.id" (changed)="refresh()" />
                    </aside>
                  }
                </div>
              }
              @case ('tasks') {
                <div class="two">
                  <div><h2>My tasks</h2><ui-workflow-tasks (decided)="refresh()" /></div>
                  <div>
                    <h2>My messages</h2>
                    <ul class="msgs">
                      @for (m of messages(); track $index) {
                        <li><span class="ch">{{ m.channel === 'email' ? 'Email' : 'In-app' }}</span><strong>{{ m.subject }}</strong><span class="body">{{ m.body }}</span></li>
                      } @empty { <li class="hint">No messages for {{ pg.currentUser()?.name }} yet.</li> }
                    </ul>
                  </div>
                </div>
              }
              @case ('runs') {
                <div class="two runs">
                  <div>
                    <h2>Runs</h2>
                    <ul class="run-list">
                      @for (i of instances(); track i.id) {
                        <li><button type="button" [class.on]="selectedRun() === i.id" (click)="selectedRun.set(i.id)">
                          <span class="t">{{ i.title }}</span>
                          <span class="m">{{ i.entityTitle ?? i.entityId }} · {{ runStatus(i) }}{{ i.state ? ' · ' + (i.stateLabel ?? i.state) : '' }} · {{ started(i.startedAt) }}</span>
                        </button></li>
                      } @empty { <li class="hint">Nothing has run yet. Submit an application to start some.</li> }
                    </ul>
                  </div>
                  <div>@if (selectedRun(); as id) { <ui-workflow-run [instanceId]="id" [canIntervene]="true" (changed)="refresh()" /> }</div>
                </div>
              }
              @case ('audit') { <h2>Audit log</h2><ui-workflow-audit /> }
              @case ('permissions') {
                <h2>Who may do what</h2>
                <p class="hint">Every published workflow's moves, start buttons and approvals, and who may do each. Saving publishes a new version at once.</p>
                <ui-workflow-permissions (saved)="pg.changed()" />
              }
              @case ('settings') { <h2>Settings</h2><ui-workflow-global-settings class="settings" /> }
            }
          </section>
        </div>
      }
    </div>

    <ui-modal [open]="askReset()" (openChange)="askReset.set($event)" title="Start over?" size="sm">
      <p class="confirm">You get a fresh sandbox: the sample workflows and applications come back, and everything you made or changed here is gone.</p>
      <div modal-footer class="foot">
        <ui-button variant="ghost" (click)="askReset.set(false)">Cancel</ui-button>
        <ui-button variant="destructive" (click)="reset()" [disabled]="busy()">Start over</ui-button>
      </div>
    </ui-modal>

    <ui-modal [open]="!!pendingLeave()" (openChange)="!$event && keep()" title="Leave without saving?" size="sm">
      <p class="confirm">This workflow has changes that aren’t saved. They’ll be lost.</p>
      <div modal-footer class="foot">
        <ui-button variant="ghost" (click)="keep()">Keep editing</ui-button>
        <ui-button variant="destructive" (click)="leave()">Discard changes</ui-button>
      </div>
    </ui-modal>
  `,
  styleUrls: ['./workflow-studio.shell.css', './workflow-studio.views.css'],
})
export class WorkflowStudioPage {
  protected readonly pg = inject(WorkflowPlayground);
  private readonly panel = viewChild<UiWorkflowPanel>('panel');
  protected readonly tabs: { value: Tab; label: string }[] = [
    { value: 'workflows', label: 'Workflows' }, { value: 'applications', label: 'Applications' }, { value: 'tasks', label: 'My tasks' },
    { value: 'runs', label: 'Runs' }, { value: 'audit', label: 'Audit log' }, { value: 'permissions', label: 'Permissions' }, { value: 'settings', label: 'Settings' },
  ];
  protected readonly tab = signal<Tab>(this.storedTab());
  protected readonly busy = signal(false);
  protected readonly notice = signal('');
  private readonly who = viewChild<ElementRef<HTMLSelectElement>>('who');
  /** What the current person may do (from /me), for showing only the buttons that will work. */
  private readonly can = signal<{ edit: boolean } | null>(null);
  protected readonly canEdit = computed(() => this.can()?.edit ?? false);
  /** Recording a payment is finance's job (and the head's); others only see whether it's paid. */
  protected readonly canPay = computed(() => (this.pg.currentUser()?.roles ?? []).some((r) => r === 'finance' || r === 'head' || r === 'admin'));
  /** The open builder has unsaved edits (from its dirtyChange). */
  protected readonly dirty = signal(false);
  protected readonly askReset = signal(false);
  /** What to do once the person agrees to lose unsaved edits. */
  protected readonly pendingLeave = signal<(() => void) | null>(null);
  protected readonly workflows = signal<UiWfDefinitionSummary[]>([]);
  protected readonly editing = signal<UiWorkflowDefinition | null>(null);
  protected readonly draft = signal<UiWorkflowDefinition | null>(null);
  protected readonly published = signal<UiWorkflowDefinition | null>(null);
  protected readonly apps = signal<DemoApplication[]>([]);
  protected readonly selectedApp = signal<number | null>(null);
  protected readonly app = computed(() => this.apps().find((a) => a.id === this.selectedApp()) ?? null);
  protected readonly appError = signal('');
  protected readonly creating = signal(false);
  protected readonly newTitle = signal('');
  protected readonly newAmount = signal(1000);
  protected readonly messages = signal<DemoMessage[]>([]);
  protected readonly instances = signal<UiWfInstance[]>([]);
  protected readonly selectedRun = signal<string | null>(null);
  protected readonly taskCount = signal(0);
  protected readonly now = signal('');

  constructor() {
    effect(() => {
      this.pg.tick();
      this.pg.user();
      this.tab();
      if (this.pg.online()) untracked(() => void this.load());
    });
  }

  private storedTab(): Tab {
    const t = readStored(TAB_KEY);
    return t && ['workflows', 'applications', 'tasks', 'runs', 'audit', 'permissions', 'settings'].includes(t) ? (t as Tab) : 'applications';
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
    writeStored(TAB_KEY, t);
  }

  /** Runs `action` now, or after the person agrees to lose unsaved builder edits (`cancelled` if not). */
  protected guard(action: () => void, cancelled?: () => void): void {
    if (this.editing() && this.dirty()) { this.pendingLeave.set(action); this.onKeep = cancelled ?? null; }
    else action();
  }

  private onKeep: (() => void) | null = null;

  /** "Keep editing": nothing happens, and a choice already shown (the person picker) goes back. */
  protected keep(): void {
    this.pendingLeave.set(null);
    this.onKeep?.();
    this.onKeep = null;
  }

  protected readonly resetWho = () => { const el = this.who()?.nativeElement; if (el) el.value = this.pg.user(); };

  protected leave(): void {
    const action = this.pendingLeave();
    this.pendingLeave.set(null);
    this.onKeep = null;
    this.dirty.set(false);
    action?.();
  }

  private async load(): Promise<void> {
    try {
      // An API without /me: assume editing is allowed and let the server decide.
      this.can.set((await this.pg.api.me?.())?.can ?? { edit: true });
      const clock = await this.pg.syncClock();
      this.now.set(clock.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
      const tasks = await this.pg.api.tasks({ scope: 'mine', status: ['open'], take: 1 });
      this.taskCount.set(tasks.total);
      switch (this.tab()) {
        case 'workflows': await this.loadWorkflows(); break;
        case 'applications': {
          this.apps.set(await this.pg.get<DemoApplication[]>('/demo/applications'));
          if (this.selectedApp() === null && this.apps().length) this.selectedApp.set(this.apps()[this.apps().length - 1].id);
          await this.panel()?.reload();
          break;
        }
        case 'tasks': this.messages.set(await this.pg.get<DemoMessage[]>(`/demo/inbox?user=${encodeURIComponent(this.pg.user())}`)); break;
        case 'runs': this.instances.set((await this.pg.api.instances({ kind: ['automation', 'run', 'record'], take: 100 })).items); break;
      }
    } catch {
      // The views show their own errors; the bar just keeps its last values.
    }
  }

  async loadWorkflows(): Promise<void> {
    this.workflows.set(await this.pg.api.definitions());
  }

  protected refresh(): void {
    // Let the engine's background work run (outbox, timers) so follow-on effects show at once.
    void this.pg.settle().catch(() => this.pg.changed());
  }

  protected switchUser(id: string): void {
    this.pg.setUser(id);
    this.editing.set(null);
    this.dirty.set(false);
    this.appError.set('');
  }

  protected async open(w: UiWfDefinitionSummary): Promise<void> {
    const d = await this.pg.api.definition(w.id);
    this.published.set(d.published);
    this.editing.set(d.draft);
  }

  protected newWorkflow(kind: 'automation' | 'lifecycle'): void {
    this.published.set(null);
    this.editing.set(createWorkflow(kind, kind === 'lifecycle' ? 'New lifecycle' : 'New automation', 'application'));
  }

  protected closeEditor(): void {
    this.editing.set(null);
    this.dirty.set(false);
    void this.loadWorkflows();
  }

  /** Runs a studio action once at a time (no double submits), clearing the last error first. */
  private async act(f: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.appError.set('');
    this.notice.set('');
    try {
      await f();
    } catch (e) {
      this.appError.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected createApp(): Promise<void> {
    return this.act(async () => {
      const a = await this.pg.send<DemoApplication>('POST', '/demo/applications', { title: this.newTitle() || 'New application', amount: this.newAmount(), programmeId: 1 });
      this.creating.set(false);
      this.newTitle.set('');
      this.selectedApp.set(a.id);
      this.refresh();
    });
  }

  protected patchApp(id: number, patch: Record<string, unknown>): Promise<void> {
    return this.act(async () => {
      await this.pg.send('PATCH', `/demo/applications/${id}`, patch);
      this.refresh();
    });
  }

  protected forceStatus(id: number): void {
    void this.patchApp(id, { status: 'Approved' });
  }

  protected verifyDoc(appId: number, docId: number): Promise<void> {
    return this.act(async () => {
      await this.pg.send('POST', `/demo/applications/${appId}/documents/${docId}/verify`);
      this.refresh();
    });
  }

  protected pay(id: number): Promise<void> {
    return this.act(async () => {
      const r = await this.pg.send<{ resumed: number }>('POST', `/demo/applications/${id}/payment`);
      this.notice.set(r?.resumed ? 'Payment recorded: the waiting workflow carries on.' : 'Payment recorded. No workflow was waiting for it.');
      this.refresh();
    });
  }

  protected advance(d: string): Promise<void> {
    return this.act(() => this.pg.advance(d));
  }

  /** Throws the sandbox away and clears everything the studio was showing from it. */
  protected reset(): Promise<void> {
    this.askReset.set(false);
    return this.act(async () => {
      await this.pg.reset();
      this.editing.set(null);
      this.draft.set(null);
      this.published.set(null);
      this.dirty.set(false);
      this.selectedApp.set(null);
      this.selectedRun.set(null);
      this.creating.set(false);
      this.workflows.set([]);
      this.apps.set([]);
      this.instances.set([]);
      this.messages.set([]);
      this.pg.changed();
    });
  }

  protected runStatus(i: UiWfInstance): string {
    return ({ queued: 'Queued', running: 'Running', waiting: 'Waiting', incident: 'Stopped', completed: 'Finished', failed: 'Failed', cancelled: 'Cancelled', active: 'Active', outOfSync: 'Out of sync' } as Record<string, string>)[i.status] ?? i.status;
  }

  protected started(iso: string): string {
    const d = new Date(iso);
    return isNaN(+d) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  protected statusLabel(s: string): string {
    return s === 'UnderReview' ? 'Under review' : s;
  }

  protected statusTone(s: string): string {
    return { Draft: 'neutral', Submitted: 'info', UnderReview: 'warning', Approved: 'success', Rejected: 'danger', Withdrawn: 'neutral' }[s] ?? 'neutral';
  }
}
