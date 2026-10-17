import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '@zouriel/ui/button';
import { UiInput, UiNumberInput } from '@zouriel/ui/form';
import {
  UiWorkflowAudit,
  UiWorkflowBuilder,
  UiWorkflowGlobalSettings,
  UiWorkflowRecordPanel,
  UiWorkflowRun,
  UiWorkflowStateBadge,
  UiWorkflowTasks,
  createWorkflow,
  UI_WORKFLOW_API,
  type UiWfDefinitionSummary,
  type UiWfInstance,
  type UiWorkflowDefinition,
} from '@zouriel/ui/workflow';
import { WorkflowPlayground, type DemoApplication, type DemoMessage } from './workflow-playground';

type Tab = 'workflows' | 'applications' | 'tasks' | 'runs' | 'audit' | 'settings';

/**
 * The workflow playground: a small scholarship office running on the real .NET engine (a private
 * sandbox per visitor). Build workflows, act as different people, move the clock forward, and see
 * every run and audit entry.
 */
@Component({
  selector: 'page-workflow-studio',
  imports: [FormsModule, UiButton, UiInput, UiNumberInput, UiWorkflowBuilder, UiWorkflowRecordPanel, UiWorkflowTasks, UiWorkflowRun, UiWorkflowAudit, UiWorkflowGlobalSettings, UiWorkflowStateBadge],
  providers: [{ provide: UI_WORKFLOW_API, useFactory: () => inject(WorkflowPlayground).api }],
  template: `
    <div class="studio">
      <header class="bar">
        <strong class="brand">Workflow studio</strong>
        <span class="sub">A scholarship office on the real engine — your own sandbox</span>
        <span class="grow"></span>
        <label class="who">You are
          <select class="sel" [ngModel]="pg.user()" (ngModelChange)="switchUser($event)" aria-label="Act as">
            @for (u of pg.users(); track u.id) { <option [value]="u.id">{{ u.name }} · {{ u.title }}</option> }
          </select>
        </label>
        <div class="clock" title="Move the sandbox clock to see waits, reminders and deadlines happen">
          <span class="now">{{ now() }}</span>
          <ui-button size="sm" variant="ghost" (click)="advance('PT1H')">+1h</ui-button>
          <ui-button size="sm" variant="ghost" (click)="advance('P1D')">+1 day</ui-button>
          <ui-button size="sm" variant="ghost" (click)="advance('P3D')">+3 days</ui-button>
        </div>
        <ui-button size="sm" variant="outline" (click)="reset()">Start over</ui-button>
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
              <button type="button" [class.on]="tab() === t.value" [attr.aria-current]="tab() === t.value ? 'page' : null" (click)="tab.set(t.value)">
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
                      <button type="button" class="link" (click)="closeEditor()">‹ All workflows</button>
                      <span class="hint">Changes save when you press Save; publish from Versions.</span>
                    </div>
                    <ui-workflow-builder class="builder" [definition]="def" (definitionChange)="draft.set($event)" [published]="published()" [persist]="true" (saved)="loadWorkflows()" />
                  </div>
                } @else {
                  <div class="list-head">
                    <h2>Workflows</h2>
                    <span class="grow"></span>
                    <ui-button size="sm" variant="outline" (click)="newWorkflow('lifecycle')">New lifecycle</ui-button>
                    <ui-button size="sm" (click)="newWorkflow('automation')">New automation</ui-button>
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
                        <ui-input size="sm" placeholder="Title" [ngModel]="newTitle()" (ngModelChange)="newTitle.set($event)" aria-label="Title" />
                        <ui-number-input size="sm" [ngModel]="newAmount()" (ngModelChange)="newAmount.set($event ?? 0)" ariaLabel="Amount" [min]="0" />
                        <ui-button size="sm" (click)="createApp()">Create as {{ pg.currentUser()?.name }}</ui-button>
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
                        <dt>Paid</dt><dd>{{ a.paid ? 'Yes' : 'No' }} <ui-button size="sm" variant="ghost" (click)="pay(a.id)">Record a payment</ui-button></dd>
                        <dt>Documents</dt><dd><ul class="docs">@for (d of a.documents; track d.id) { <li><label><input type="checkbox" [checked]="d.verified" (change)="verifyDoc(a.id, d.id)" /> {{ d.name }}</label></li> }</ul></dd>
                        @if (a.notes) { <dt>Notes</dt><dd>{{ a.notes }}</dd> }
                      </dl>
                      <p class="hint">Try changing the status directly: <button type="button" class="link" (click)="forceStatus(a.id)">set status to Approved</button> — the lifecycle refuses it.</p>
                      @if (appError()) { <p class="err">{{ appError() }}</p> }
                    </div>
                    <aside class="panel">
                      <h3>Workflow</h3>
                      <ui-workflow-record-panel #panel entity="application" [entityId]="'' + a.id" (changed)="refresh()" />
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
                          <span class="m">{{ i.entityTitle ?? i.entityId }} · {{ i.status }}{{ i.state ? ' · ' + (i.stateLabel ?? i.state) : '' }}</span>
                        </button></li>
                      } @empty { <li class="hint">Nothing has run yet. Submit an application to start some.</li> }
                    </ul>
                  </div>
                  <div>@if (selectedRun(); as id) { <ui-workflow-run [instanceId]="id" [canIntervene]="true" (changed)="refresh()" /> }</div>
                </div>
              }
              @case ('audit') { <h2>Audit log</h2><ui-workflow-audit /> }
              @case ('settings') { <h2>Settings</h2><ui-workflow-global-settings class="settings" /> }
            }
          </section>
        </div>
      }
    </div>
  `,
  styleUrls: ['./workflow-studio.shell.css', './workflow-studio.views.css'],
})
export class WorkflowStudioPage {
  protected readonly pg = inject(WorkflowPlayground);
  private readonly panel = viewChild<UiWorkflowRecordPanel>('panel');
  protected readonly tabs: { value: Tab; label: string }[] = [
    { value: 'workflows', label: 'Workflows' }, { value: 'applications', label: 'Applications' }, { value: 'tasks', label: 'My tasks' },
    { value: 'runs', label: 'Runs' }, { value: 'audit', label: 'Audit log' }, { value: 'settings', label: 'Settings' },
  ];
  protected readonly tab = signal<Tab>('applications');
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

  private async load(): Promise<void> {
    try {
      const clock = await this.pg.get<{ now: string }>('/demo/clock');
      this.now.set(new Date(clock.now).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
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
    this.pg.user.set(id);
    this.editing.set(null);
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
    void this.loadWorkflows();
  }

  protected async createApp(): Promise<void> {
    this.appError.set('');
    try {
      const a = await this.pg.send<DemoApplication>('POST', '/demo/applications', { title: this.newTitle() || 'New application', amount: this.newAmount(), programmeId: 1 });
      this.creating.set(false);
      this.newTitle.set('');
      this.selectedApp.set(a.id);
      this.refresh();
    } catch (e) {
      this.appError.set((e as Error).message);
    }
  }

  protected async patchApp(id: number, patch: Record<string, unknown>): Promise<void> {
    this.appError.set('');
    try {
      await this.pg.send('PATCH', `/demo/applications/${id}`, patch);
      this.refresh();
    } catch (e) {
      this.appError.set((e as Error).message);
    }
  }

  protected forceStatus(id: number): void {
    void this.patchApp(id, { status: 'Approved' });
  }

  protected async verifyDoc(appId: number, docId: number): Promise<void> {
    await this.pg.send('POST', `/demo/applications/${appId}/documents/${docId}/verify`);
    this.refresh();
  }

  protected async pay(id: number): Promise<void> {
    await this.pg.send('POST', `/demo/applications/${id}/payment`);
    this.refresh();
  }

  protected async advance(d: string): Promise<void> {
    await this.pg.advance(d);
  }

  protected async reset(): Promise<void> {
    if (!confirm('Start over with a fresh sandbox? Your workflows and records here will be gone.')) return;
    await this.pg.reset();
    this.selectedApp.set(null);
    this.editing.set(null);
    this.selectedRun.set(null);
    setTimeout(() => this.pg.changed(), 300);
  }

  protected statusLabel(s: string): string {
    return s === 'UnderReview' ? 'Under review' : s;
  }

  protected statusTone(s: string): string {
    return { Draft: 'neutral', Submitted: 'info', UnderReview: 'warning', Approved: 'success', Rejected: 'danger', Withdrawn: 'neutral' }[s] ?? 'neutral';
  }
}
