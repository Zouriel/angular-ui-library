import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButton, UiSegmented, type UiSegmentedOption } from '@zouriel/ui/button';
import { UiSelect, type UiSelectOption } from '@zouriel/ui/form';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import {
  UI_WORKFLOW_CLOCK,
  UiWorkflowAudit,
  UiWorkflowGlobalSettings,
  UiWorkflowPanel,
  UiWorkflowPermissions,
  UiWorkflowRun,
  UiWorkflowStateBadge,
  UiWorkflowTasks,
  UiWorkflowTasksDrawer,
  type UiWfInstance,
  type UiWfRecord,
  type UiWfTone,
  type UiWorkflowPanelLayout,
} from '@zouriel/ui/workflow';
import { DocDemo, DocPage, DocSection, type ApiRow } from '../docs/docs-ui';
import { WorkflowPlayground, type DemoApplication } from './workflow-playground';

/** Who the demos act as when the page opens: the head of office, who sees every button. */
const DEFAULT_USER = 'hana';
/** The playground's record type. */
const ENTITY = 'application';

@Component({
  selector: 'page-workflow-components',
  imports: [
    FormsModule, RouterLink, UiButton, UiSegmented, UiSelect, UiTab, UiTabs,
    UiWorkflowAudit, UiWorkflowGlobalSettings, UiWorkflowPanel, UiWorkflowPermissions,
    UiWorkflowRun, UiWorkflowStateBadge, UiWorkflowTasks, UiWorkflowTasksDrawer,
    DocDemo, DocPage, DocSection,
  ],
  providers: [{ provide: UI_WORKFLOW_CLOCK, useFactory: () => inject(WorkflowPlayground).now }],
  template: `
    <doc-page eyebrow="Flagship" title="Workflow components"
      lead="Everything an app puts on its own pages once workflows run: a record's workflow on the record's page, a task button in the header, an inbox, run and audit views for admins, and the pieces of a workflow settings page. Each one talks to the engine through the workflow API, and each person only sees what they may do.">

      <div class="where" aria-labelledby="where-title">
        <h2 id="where-title" class="where-title">Which component goes where</h2>
        <dl class="where-list">
          <div><dt>A record's page</dt><dd><a routerLink="." fragment="panel">Workflow panel</a></dd></div>
          <div><dt>The app's header</dt><dd><a routerLink="." fragment="tasks-drawer">My tasks drawer</a></dd></div>
          <div><dt>An inbox page</dt><dd><a routerLink="." fragment="tasks">Task inbox</a></dd></div>
          <div><dt>Admin pages</dt><dd><a routerLink="." fragment="run">Run</a> and <a routerLink="." fragment="audit">audit log</a></dd></div>
          <div><dt>A settings page</dt><dd><a routerLink="." fragment="permissions">Permissions</a> and <a routerLink="." fragment="global-settings">global settings</a> (<a routerLink="." fragment="settings-page">put together</a>)</dd></div>
          <div><dt>The builder page</dt><dd>See <a routerLink="/workflow-builder">Workflow builder</a></dd></div>
        </dl>
      </div>

      @if (pg.online() === false) {
        <p class="offline">The playground server isn't reachable, so the live demos can't load. <ui-button size="sm" variant="outline" routerLink="/workflow-studio">Open the studio for setup steps</ui-button></p>
      } @else {
        <div class="picker">
          <div class="picker-row">
            <ui-select class="pick" size="sm" label="You are" [options]="userOptions()" [ngModel]="user()" (ngModelChange)="user.set($event)" />
            <ui-select class="pick" size="sm" label="Application" [options]="appOptions()" [ngModel]="appId()" (ngModelChange)="appId.set($event)" />
          </div>
          <p class="picker-hint">Every demo below acts as this person, on this application, in your private playground sandbox. Start over shows to the head of office once an application has moved on from Draft.</p>
          @if (prepError()) { <p class="err">{{ prepError() }}</p> }
        </div>
      }

      <doc-section name="Workflow panel" anchor="panel" selector="ui-workflow-panel" [api]="panelApi" [outputs]="panelOutputs"
        summary="The record's workflow on the record's own page: its states as a stepper (green for states it has been through), what happened in each, and in the current state the moves this person may make, with their forms and confirmations, open tasks and manual workflows. Use it when the workflow is part of the page's story; choose a vertical or horizontal panel, a compact one for a side column or details card (a badge, a strip of states, the actions and one history), or a drawer that waits on the screen's edge as a rail of dots when the page is busy. A record type with no lifecycle still shows its manual workflows, open tasks and history.">
        @if (ready(); as id) {
          <ui-segmented size="sm" label="Layout" [options]="layouts" [value]="layout()" (valueChange)="layout.set($any($event))" />
          @if (layout() === 'vertical' || layout() === 'horizontal' || layout() === 'compact') {
            <div class="frame" [attr.data-layout]="layout()">
              <ui-workflow-panel [entity]="entity" [entityId]="id" [layout]="layout()" [api]="api()" title="Application workflow" (changed)="onChanged()" />
            </div>
          } @else {
            <div class="frame hint">
              <p>The panel is on the {{ layout() === 'side-drawer' ? 'right edge' : 'bottom edge' }} of the screen as a rail of dots: one per state, green up to where the application is now. Hover it with a mouse to peek, or tap or click it to open the drawer.</p>
            </div>
            <ui-workflow-panel [entity]="entity" [entityId]="id" [layout]="layout()" [api]="api()" title="Application workflow" (changed)="onChanged()" />
          }
        }
        <doc-demo [code]="panelCode"></doc-demo>
      </doc-section>

      <doc-section name="My tasks drawer" anchor="tasks-drawer" selector="ui-workflow-tasks-drawer" [api]="drawerApi" [outputs]="drawerOutputs"
        summary="A button for the app's header with the number of open approvals and tasks (red when one is overdue) that opens the task inbox in a drawer. Use it so people can act from any page; open it from code too, for a link in an email or a keyboard shortcut.">
        @if (online()) {
          @for (k of [rev()]; track k) {
            <div class="app-bar">
              <span class="app-name">Scholarship office</span>
              <ui-workflow-tasks-drawer [api]="api()" (decided)="onChanged()" />
            </div>
          }
          <div class="actions">
            <ui-button size="sm" variant="outline" [disabled]="busy() || !approvable()" (click)="makeTasks()">Approve another application</ui-button>
            <span class="note">No tasks yet? Approving one starts the finance sign-off: a task for Farah (finance), and for large amounts one for Hana (head of office) too.</span>
          </div>
        }
        <doc-demo [code]="drawerCode"></doc-demo>
      </doc-section>

      <doc-section name="Task inbox" anchor="tasks" selector="ui-workflow-tasks" [api]="tasksApi" [outputs]="tasksOutputs"
        summary="The signed-in person's approvals and tasks, due first and overdue marked, each opening its decision with its form. Use it as an app's inbox page (the tasks drawer shows the same list in a drawer).">
        @if (online()) {
          @for (k of [rev()]; track k) {
            <div class="frame"><ui-workflow-tasks [api]="api()" (decided)="onChanged()" /></div>
          }
        }
        <doc-demo [code]="tasksCode"></doc-demo>
      </doc-section>

      <doc-section name="Run" anchor="run" selector="ui-workflow-run" [api]="runApi" [outputs]="runOutputs"
        summary="One run drawn over its workflow: each step with what happened (done, waiting, failed, skipped), the paths not taken greyed out, and retry, skip and cancel for admins. Use it on an admin page that opens a run from a list, or from a record's history.">
        @if (online()) {
          @if (runOptions().length) {
            <ui-select class="pick wide" size="sm" label="Run of this application" [options]="runOptions()" [ngModel]="runId()" (ngModelChange)="runId.set($event)" />
          }
          @if (runId(); as rid) {
            @for (k of [rev()]; track k) {
              <div class="frame"><ui-workflow-run [instanceId]="rid" [api]="api()" (changed)="onChanged()" /></div>
            }
          } @else {
            <p class="note">This application has no runs yet: move it on in the panel above (or approve one) and its runs appear here.</p>
          }
        }
        <doc-demo [code]="runCode"></doc-demo>
      </doc-section>

      <doc-section name="Audit log" anchor="audit" selector="ui-workflow-audit" [api]="auditApi"
        summary="The tamper-evident audit log: filter by record, run, kind or person, open an entry for its before and after values, export it, and check the hash chain. Use it on an admin page, or scoped to one record (as here) on that record's page. Reading it needs admin rights, so applicants see the engine's refusal.">
        @if (ready(); as id) {
          @for (k of [rev()]; track k) {
            <div class="frame scroll"><ui-workflow-audit [entity]="entity" [entityId]="id" [api]="api()" [pageSize]="20" /></div>
          }
        }
        <doc-demo [code]="auditCode"></doc-demo>
      </doc-section>

      <doc-section name="State badge" anchor="state-badge" selector="ui-workflow-state-badge" [api]="badgeApi"
        summary="A record's state as a small coloured chip, in the tone its lifecycle gives it. Use it in tables and cards wherever a record's state is listed; the workflow panel uses it too.">
        <doc-demo [code]="badgeCode">
          <div class="badges">
            @for (t of tones; track t.tone) { <ui-workflow-state-badge [label]="t.label" [tone]="t.tone" /> }
          </div>
          @if (record(); as r) {
            <p class="live">This application now: <ui-workflow-state-badge [label]="r.stateLabel ?? r.state ?? ''" [tone]="r.stateTone" /></p>
          }
        </doc-demo>
      </doc-section>

      <doc-section name="Permissions" anchor="permissions" selector="ui-workflow-permissions" [api]="permissionsApi" [outputs]="permissionsOutputs"
        summary="Who may do what in every published workflow, on one page: who may make each lifecycle move, start a record over, press a start button, and decide each approval or task. Saving publishes a new version with only those changes. Use it on a settings page so admins can swap people without opening the builder; people who may not publish see it read-only.">
        @if (online()) {
          @for (k of [user()]; track k) {
            <div class="frame scroll"><ui-workflow-permissions [api]="api()" (saved)="onChanged()" /></div>
          }
        }
        <doc-demo [code]="permissionsCode"></doc-demo>
      </doc-section>

      <doc-section name="Global settings" anchor="global-settings" selector="ui-workflow-global-settings" [api]="settingsApi" [outputs]="settingsOutputs"
        summary="The app-wide workflow settings: working hours and holidays, defaults for new steps, notification channels, which addresses webhooks may call, audit retention and masking, pausing triggers per record type, what is being watched, and what the app lets workflows use. Use it on a settings page; without an API, bind settings and save them yourself.">
        @if (online()) {
          @for (k of [user()]; track k) {
            <div class="settings-box"><ui-workflow-global-settings class="settings" [api]="api()" /></div>
          }
        }
        <doc-demo [code]="settingsCode"></doc-demo>
      </doc-section>

      <doc-section name="Putting a settings page together" anchor="settings-page" selector="your app's settings page"
        summary="The library has no settings page of its own: the app decides where each piece goes, next to its other settings. A typical Workflow settings page has three tabs: Workflows (the list and the builder, on their own route), Permissions and Global settings. Here is one, live.">
        @if (online()) {
          <div class="frame">
            <ui-tabs label="Workflow settings" [(selectedIndex)]="settingsTab">
              <ui-tab label="Workflows">
                <div class="tab-intro">
                  <p>Workflows are designed in the builder. Most apps list them here and open the builder on its own route.</p>
                  <ui-button size="sm" variant="outline" routerLink="/workflow-builder">Open the Workflow builder page</ui-button>
                </div>
              </ui-tab>
              <ui-tab label="Permissions">
                @if (settingsTab() === 1) { <ui-workflow-permissions [api]="api()" /> }
              </ui-tab>
              <ui-tab label="Global settings">
                @if (settingsTab() === 2) { <div class="settings-box"><ui-workflow-global-settings class="settings" [api]="api()" /></div> }
              </ui-tab>
            </ui-tabs>
          </div>
        }
        <doc-demo lang="ts" [code]="settingsPageCode"></doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .where { margin-bottom: var(--ui-space-6); padding: var(--ui-space-4); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); }
    .where-title { margin: 0 0 var(--ui-space-3); font-size: var(--ui-font-size-md, 15px); font-weight: 600; }
    .where-list { margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--ui-space-3) var(--ui-space-4); }
    .where-list div { min-width: 0; }
    .where-list dt { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .where-list dd { margin: 2px 0 0; font-size: 14px; }
    .where-list a { color: var(--ui-color-primary); }
    .picker { display: flex; flex-direction: column; gap: var(--ui-space-2); padding: var(--ui-space-3) var(--ui-space-4); margin-bottom: var(--ui-space-2);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface-raised, var(--ui-color-surface)); }
    .picker-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--ui-space-3); }
    .picker-hint { margin: 0; font-size: 13px; color: var(--ui-color-text-secondary); max-width: 72ch; }
    .pick { flex: 1 1 220px; min-width: 0; max-width: 340px; }
    .pick.wide { display: block; max-width: 520px; }
    .err { margin: 0; font-size: 13px; color: var(--ui-color-danger); }
    .frame { min-width: 0; padding: var(--ui-space-4); margin: var(--ui-space-3) 0 var(--ui-space-4); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); }
    .frame[data-layout="vertical"], .frame[data-layout="compact"] { max-width: 460px; }
    .frame.scroll { max-height: 560px; overflow: auto; }
    .hint p { margin: 0; font-size: 13.5px; color: var(--ui-color-text-secondary); max-width: 70ch; }
    .offline { display: flex; align-items: center; gap: var(--ui-space-3); flex-wrap: wrap; margin: 0 0 var(--ui-space-4); }
    .app-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3); flex-wrap: wrap; padding: var(--ui-space-2) var(--ui-space-4);
      margin: var(--ui-space-3) 0; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); }
    .app-name { font-weight: 600; font-size: 14px; }
    .actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2) var(--ui-space-3); margin-bottom: var(--ui-space-4); }
    .note { flex: 1 1 260px; margin: 0; font-size: 13px; color: var(--ui-color-text-secondary); max-width: 70ch; }
    .badges { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); }
    .live { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2); margin: 0; font-size: 13.5px; color: var(--ui-color-text-secondary); }
    /* Global settings stacks its section list above the form through a container query, which needs a container around it. */
    .settings-box { container-type: inline-size; margin: var(--ui-space-3) 0 var(--ui-space-4); }
    .settings { display: grid; min-height: 520px; }
    .tab-intro { display: flex; flex-direction: column; align-items: flex-start; gap: var(--ui-space-3); }
    .tab-intro p { margin: 0; font-size: 13.5px; color: var(--ui-color-text-secondary); }
  `,
})
export class WorkflowComponentsPage {
  protected readonly pg = inject(WorkflowPlayground);
  protected readonly entity = ENTITY;
  protected readonly layout = signal<UiWorkflowPanelLayout>('vertical');
  protected readonly user = signal(DEFAULT_USER);
  protected readonly appId = signal<string | null>(null);
  protected readonly runId = signal<string | null>(null);
  protected readonly settingsTab = signal(0);
  protected readonly busy = signal(false);
  protected readonly prepError = signal('');
  /** Bumped after something changed, so the lists and views elsewhere on the page load again. */
  protected readonly rev = signal(0);
  private readonly apps = signal<DemoApplication[]>([]);
  private readonly runs = signal<UiWfInstance[]>([]);
  protected readonly record = signal<UiWfRecord | null>(null);
  /** Whether the first load (and preparing an application past Draft) has finished. */
  private readonly loaded = signal(false);

  protected readonly online = computed(() => this.pg.online() === true && this.loaded());
  /** The application id once everything is ready to show. */
  protected readonly ready = computed(() => (this.online() ? this.appId() : null));
  protected readonly api = computed(() => this.pg.apiAs(this.user()));
  /** Lists and setup always go through the head of office, who may see everything. */
  private readonly admin = computed(() => this.pg.apiAs(DEFAULT_USER));

  protected readonly layouts: UiSegmentedOption[] = [
    { value: 'vertical', label: 'Vertical' },
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'compact', label: 'Compact' },
    { value: 'side-drawer', label: 'Side drawer' },
    { value: 'bottom-drawer', label: 'Bottom drawer' },
  ];
  protected readonly userOptions = computed<UiSelectOption[]>(() => this.pg.users().map((u) => ({ value: u.id, label: `${u.name} · ${u.title}` })));
  protected readonly appOptions = computed<UiSelectOption[]>(() => this.apps().map((a) => ({ value: String(a.id), label: `${a.title} (${statusText(a.status)})` })));
  protected readonly runOptions = computed<UiSelectOption[]>(() => this.runs().map((r) => ({ value: r.id, label: `${r.title} · ${r.status}` })));
  /** An application other than the one picked that can still be approved (to make sign-off tasks). */
  protected readonly approvable = computed(() =>
    [...this.apps()].sort((a, b) => b.amount - a.amount).find((a) => String(a.id) !== this.appId() && isOpen(a.status)) ?? null);

  protected readonly tones: { tone: UiWfTone; label: string }[] = [
    { tone: 'neutral', label: 'Draft' },
    { tone: 'info', label: 'Submitted' },
    { tone: 'primary', label: 'In progress' },
    { tone: 'warning', label: 'Under review' },
    { tone: 'success', label: 'Approved' },
    { tone: 'danger', label: 'Rejected' },
  ];

  constructor() {
    effect(() => {
      if (this.pg.online() && this.pg.users().length) untracked(() => void this.start());
    });
    // The picked application's record (for the live badge) and its runs.
    effect(() => {
      const id = this.appId();
      this.rev();
      if (id && this.loaded()) untracked(() => void this.loadApp(id));
    });
  }

  /** First load: the applications, and one moved past Draft when there is none yet. */
  private async start(): Promise<void> {
    if (this.loaded()) return;
    try {
      let apps = await this.loadApps();
      if (apps.length && !apps.some((a) => pastDraft(a.status))) {
        // The smallest one: the largest is kept for "Approve another application", whose sign-off then asks the head too.
        const smallest = [...apps].sort((a, b) => a.amount - b.amount)[0];
        await this.moveOn(smallest, 'UnderReview').catch((e: unknown) => this.prepError.set(`Couldn't prepare an application: ${text(e)}`));
        apps = await this.loadApps();
      }
      const pick = apps.find((a) => pastDraft(a.status) && isOpen(a.status)) ?? apps.find((a) => pastDraft(a.status)) ?? apps[0];
      if (pick && !this.appId()) this.appId.set(String(pick.id));
    } finally {
      this.loaded.set(true);
    }
  }

  private async loadApps(): Promise<DemoApplication[]> {
    const apps = await this.pg.get<DemoApplication[]>('/demo/applications').catch(() => [] as DemoApplication[]);
    this.apps.set(apps);
    return apps;
  }

  private async loadApp(id: string): Promise<void> {
    const api = this.admin();
    const [rec, runs] = await Promise.all([
      api.record(ENTITY, id).catch(() => null),
      api.instances({ entity: ENTITY, entityId: id, take: 50 }).then((p) => p.items).catch(() => [] as UiWfInstance[]),
    ]);
    if (id !== this.appId()) return;
    this.record.set(rec);
    this.runs.set(runs);
    // Keep the picked run if it still belongs to this application; else prefer a workflow run over the lifecycle's own.
    if (!runs.some((r) => r.id === this.runId())) this.runId.set((runs.find((r) => r.kind !== 'record') ?? runs[0])?.id ?? null);
  }

  /**
   * Moves an application on as the people who may: the applicant submits it, a reviewer starts the
   * review and (with `Approved`) approves it.
   */
  private async moveOn(app: DemoApplication, until: 'UnderReview' | 'Approved'): Promise<void> {
    const id = String(app.id);
    const reviewer = this.pg.users().find((u) => u.roles.includes('reviewer'))?.id ?? DEFAULT_USER;
    const steps: { from: string; who: string; key: string; input?: Record<string, unknown> }[] = [
      { from: 'Draft', who: app.applicant ?? DEFAULT_USER, key: 'submit' },
      { from: 'Submitted', who: reviewer, key: 'startReview' },
      ...(until === 'Approved' ? [{ from: 'UnderReview', who: reviewer, key: 'approve', input: { comment: 'All documents checked and in order.' } }] : []),
    ];
    let state = (await this.admin().record(ENTITY, id)).state;
    for (const s of steps) {
      if (state !== s.from) continue;
      state = (await this.pg.apiAs(s.who).applyTransition(ENTITY, id, s.key, s.input)).state;
    }
    // Let the workflows those moves started (notifications, sign-off approvals) run now.
    await this.pg.settle().catch(() => undefined);
  }

  /** Approves another application, which starts the finance sign-off and its tasks. */
  protected async makeTasks(): Promise<void> {
    const app = this.approvable();
    if (!app) return;
    this.busy.set(true);
    this.prepError.set('');
    try {
      await this.moveOn(app, 'Approved');
    } catch (e) {
      this.prepError.set(`Couldn't approve ${app.title}: ${text(e)}`);
    } finally {
      this.busy.set(false);
      this.onChanged();
    }
  }

  protected onChanged(): void {
    void this.loadApps();
    this.rev.update((n) => n + 1);
  }

  // ── Snippets ──────────────────────────────────────────────────────────

  protected readonly panelCode = `<!-- in the record's page -->
<ui-workflow-panel entity="application" [entityId]="app.id" layout="vertical" (changed)="reload()" />

<!-- states left to right, details below -->
<ui-workflow-panel entity="application" [entityId]="app.id" layout="horizontal" />

<!-- a side column or details card: badge, states, actions, one history -->
<ui-workflow-panel entity="application" [entityId]="app.id" layout="compact" title="" />

<!-- a rail of dots on the right edge; hover (desktop) or tap opens the drawer -->
<ui-workflow-panel entity="application" [entityId]="app.id" layout="side-drawer" side="right" />

<!-- a rail of dots along the bottom, opened from code too -->
<ui-workflow-panel entity="application" [entityId]="app.id" layout="bottom-drawer" [(open)]="panelOpen" />`;

  protected readonly drawerCode = `<header class="app-header">
  <a routerLink="/">Scholarship office</a>
  <ui-workflow-tasks-drawer (decided)="reload()" />
</header>

<!-- your own button, or a link in an email (?tasks=1) -->
<ui-workflow-tasks-drawer [showButton]="false" [(open)]="tasksOpen" label="Approvals" />`;

  protected readonly tasksCode = `<!-- /inbox -->
<h1>My tasks</h1>
<ui-workflow-tasks (decided)="reload()" />

<!-- everyone's tasks, for admins -->
<ui-workflow-tasks scope="all" [pageSize]="50" />`;

  protected readonly runCode = `<!-- /admin/runs/:id -->
<ui-workflow-run [instanceId]="runId" [canIntervene]="isAdmin" (changed)="reload()" />`;

  protected readonly auditCode = `<!-- /admin/audit: everything -->
<ui-workflow-audit />

<!-- one record's entries, on its page -->
<ui-workflow-audit entity="application" [entityId]="app.id" />

<!-- one run's entries -->
<ui-workflow-audit [instanceId]="runId" />`;

  protected readonly badgeCode = `<ui-workflow-state-badge [label]="record.stateLabel" [tone]="record.stateTone" />
<ui-workflow-state-badge label="Approved" tone="success" />
<!-- tones: neutral, info, primary, warning, success, danger -->`;

  protected readonly permissionsCode = `<ui-workflow-permissions (saved)="reload()" />`;

  protected readonly settingsCode = `<!-- through the API (saves with a revision check) -->
<ui-workflow-global-settings />

<!-- without an API: edit settings you load and save yourself -->
<ui-workflow-global-settings [registry]="registry" [settings]="settings" (settingsChange)="save($event)" />`;

  protected readonly settingsPageCode = `// workflow-settings.page.ts — your app's page; the components only fill its tabs
@Component({
  selector: 'app-workflow-settings',
  imports: [RouterLink, UiButton, UiTabs, UiTab, UiWorkflowPermissions, UiWorkflowGlobalSettings],
  template: \`
    <h1>Workflow settings</h1>
    <ui-tabs label="Workflow settings" [(selectedIndex)]="tab">
      <ui-tab label="Workflows">
        <app-workflow-list />          <!-- your list of workflows -->
        <ui-button routerLink="/settings/workflows/new">New workflow</ui-button>
      </ui-tab>
      <ui-tab label="Permissions">
        @if (tab() === 1) { <ui-workflow-permissions (saved)="toast('Saved')" /> }
      </ui-tab>
      <ui-tab label="Global settings">
        @if (tab() === 2) { <ui-workflow-global-settings /> }
      </ui-tab>
    </ui-tabs>
  \`,
})
export class WorkflowSettingsPage {
  protected readonly tab = signal(0);
}

// app.routes.ts — the builder gets a route of its own
{ path: 'settings/workflows', loadComponent: () => import('./workflow-settings.page').then((m) => m.WorkflowSettingsPage) },
{ path: 'settings/workflows/:id', loadComponent: () => import('./workflow-edit.page').then((m) => m.WorkflowEditPage) }, // <ui-workflow-builder>`;

  // ── API tables (from the components' inputs and outputs) ──────────────

  private static readonly apiRow: ApiRow = { name: 'api', type: 'UiWorkflowApi | null', default: 'null', desc: 'The engine API; when null, the one from provideUiWorkflow.' };

  protected readonly panelApi: ApiRow[] = [
    { name: 'entity', type: 'string', default: 'required', desc: 'The record type key, as registered.' },
    { name: 'entityId', type: 'string', default: 'required', desc: 'The record id.' },
    { name: 'layout', type: "'vertical' | 'horizontal' | 'compact' | 'side-drawer' | 'bottom-drawer'", default: "'vertical'", desc: 'How it sits on the page; compact suits a side column or details card.' },
    { name: 'side', type: "'right' | 'left'", default: "'right'", desc: 'Which edge the side drawer opens from.' },
    { name: 'title', type: 'string', default: "'Workflow'", desc: 'The heading (and the drawer title).' },
    { name: 'showHistory', type: 'boolean', default: 'true', desc: 'Show what happened in each state.' },
    { name: 'emptyText', type: 'string', default: "'Nothing for you to do here right now.'", desc: 'Said in the current state when this person has nothing to do; empty hides it.' },
    { name: 'open', type: 'model<boolean>', default: 'false', desc: 'Whether the drawer is open (drawer layouts). Two-way.' },
    WorkflowComponentsPage.apiRow,
  ];
  protected readonly panelOutputs: ApiRow[] = [{ name: '(changed)', type: 'UiWfRecord', desc: 'After the record moved through the panel, so the page can reload its own data.' }];

  protected readonly drawerApi: ApiRow[] = [
    { name: 'open', type: 'model<boolean>', default: 'false', desc: 'Whether the drawer is open. Two-way, so it can be opened from code.' },
    { name: 'label', type: 'string', default: "'My tasks'", desc: "The button's and the drawer's title." },
    { name: 'side', type: "'left' | 'right'", default: "'right'", desc: 'Which edge the drawer opens from.' },
    { name: 'size', type: 'UiSize', default: "'sm'", desc: "The button's size." },
    { name: 'variant', type: "'outline' | 'ghost' | 'primary'", default: "'outline'", desc: "The button's look." },
    { name: 'showButton', type: 'boolean', default: 'true', desc: 'Show the built-in button; off when the app opens the drawer from its own control.' },
    { name: 'refreshSeconds', type: 'number', default: '60', desc: 'How often the count refreshes (0: only on open, close and decisions).' },
    { name: 'pageSize', type: 'number', default: '25', desc: 'Tasks per page in the drawer.' },
    WorkflowComponentsPage.apiRow,
  ];
  protected readonly drawerOutputs: ApiRow[] = [{ name: '(decided)', type: 'UiWfTask', desc: 'After a task was decided in the drawer.' }];

  protected readonly tasksApi: ApiRow[] = [
    { name: 'scope', type: "'mine' | 'all'", default: "'mine'", desc: "The signed-in person's tasks, or everyone's (needs admin rights)." },
    { name: 'pageSize', type: 'number', default: '25', desc: 'Tasks per page.' },
    WorkflowComponentsPage.apiRow,
  ];
  protected readonly tasksOutputs: ApiRow[] = [{ name: '(decided)', type: 'UiWfTask', desc: 'After a decision, so the host can refresh related views.' }];

  protected readonly runApi: ApiRow[] = [
    { name: 'instanceId', type: 'string', default: 'required', desc: 'The run to show.' },
    { name: 'canIntervene', type: 'boolean | null', default: 'null', desc: 'Show retry, skip and cancel; null asks the engine whether this person may.' },
    WorkflowComponentsPage.apiRow,
  ];
  protected readonly runOutputs: ApiRow[] = [{ name: '(changed)', type: 'UiWfInstance', desc: 'After a retry, skip or cancel.' }];

  protected readonly auditApi: ApiRow[] = [
    { name: 'entity', type: 'string | null', default: 'null', desc: "Show only one record's entries (with entityId)." },
    { name: 'entityId', type: 'string | null', default: 'null', desc: 'The record id.' },
    { name: 'instanceId', type: 'string | null', default: 'null', desc: "Show only one run's entries." },
    { name: 'pageSize', type: 'number', default: '50', desc: 'Entries per page.' },
    WorkflowComponentsPage.apiRow,
  ];

  protected readonly badgeApi: ApiRow[] = [
    { name: 'label', type: 'string', default: 'required', desc: "The state's name." },
    { name: 'tone', type: 'UiWfTone | string | null', default: "'neutral'", desc: 'neutral, info, primary, warning, success or danger.' },
  ];

  protected readonly permissionsApi: ApiRow[] = [
    { name: 'api', type: 'UiWorkflowApi | null', default: 'null', desc: 'The engine API; when null, the one from provideUiWorkflow. Saving needs updatePermissions; me is optional (without it editing is offered and the server decides).' },
  ];
  protected readonly permissionsOutputs: ApiRow[] = [{ name: '(saved)', type: 'UiWfDefinitionSummary', desc: "After a workflow's permissions were saved (the new version's summary)." }];

  protected readonly settingsApi: ApiRow[] = [
    WorkflowComponentsPage.apiRow,
    { name: 'registry', type: 'UiWorkflowRegistry | null', default: 'null', desc: "The app's registry (channels, fields to mask, the read-only browser) when there is no API." },
    { name: 'settings', type: 'UiWorkflowSettings | null', default: 'null', desc: 'Settings to edit when there is no API.' },
  ];
  protected readonly settingsOutputs: ApiRow[] = [{ name: '(settingsChange)', type: 'UiWorkflowSettings', desc: 'The edited settings, when there is no API.' }];
}

/** Whether an application has moved on from Draft (the demo backend sends the state's label). */
function pastDraft(status: string | null): boolean {
  return !!status && status !== 'Draft';
}

/** The demo backend sends a state's key ("UnderReview"): spaced out for people ("Under review"). */
function statusText(status: string | null): string {
  if (!status) return 'new';
  const words = status.replace(/([a-z])([A-Z])/g, '$1 $2');
  return words.charAt(0) + words.slice(1).toLowerCase();
}

/** Whether an application can still be moved towards Approved. */
function isOpen(status: string | null): boolean {
  return !status || ['Draft', 'Submitted', 'Under review', 'UnderReview'].includes(status);
}

function text(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
