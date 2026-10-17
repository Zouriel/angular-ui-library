import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButton, UiSegmented, type UiSegmentedOption } from '@zouriel/ui/button';
import { UiSelect, type UiSelectOption } from '@zouriel/ui/form';
import { UI_WORKFLOW_CLOCK, UiWorkflowPanel, type UiWorkflowPanelLayout } from '@zouriel/ui/workflow';
import { DocDemo, DocPage, DocSection, type ApiRow } from '../docs/docs-ui';
import { WorkflowPlayground, type DemoApplication } from './workflow-playground';

@Component({
  selector: 'page-workflow-panel',
  imports: [FormsModule, RouterLink, UiButton, UiSegmented, UiSelect, UiWorkflowPanel, DocDemo, DocPage, DocSection],
  providers: [{ provide: UI_WORKFLOW_CLOCK, useFactory: () => inject(WorkflowPlayground).now }],
  template: `
    <doc-page eyebrow="Flagship" title="Workflow panel"
      lead="Attach a record's workflow to the record's own page: its states as a stepper (green for states it has been through, dark for those it hasn't reached), what happened in each, and in the current state the moves this person may make, their forms and confirmations, open tasks and manual workflows. Choose how it sits on the page in code: a vertical or horizontal panel, or a drawer that waits on the screen's edge as a rail of dots.">

      <doc-section name="Try it" selector="ui-workflow-panel" [api]="panelApi"
        summary="An application in the playground, on the real engine. Pick a layout, an application and who you are: each person sees only the moves they may make (the applicant submits their own application, reviewers decide once it's under review, the head of office can withdraw). With a drawer layout, look for the dots on the right edge or the bottom of the screen: hover them with a mouse to peek (move away and it closes), or tap or click them to open the drawer.">
        @if (pg.online() === false) {
          <p class="offline">The playground server isn't reachable, so this demo can't load. <ui-button size="sm" variant="outline" routerLink="/workflow-studio">Open the studio for setup steps</ui-button></p>
        } @else {
          <div class="controls">
            <ui-segmented size="sm" label="Layout" [options]="layouts" [value]="layout()" (valueChange)="layout.set($any($event))" />
            <ui-select class="pick" size="sm" label="Application" [options]="appOptions()" [ngModel]="appId()" (ngModelChange)="appId.set($event)" />
            <ui-select class="pick" size="sm" label="You are" [options]="userOptions()" [ngModel]="user()" (ngModelChange)="user.set($event)" />
          </div>
          @if (appId(); as id) {
            @if (layout() === 'vertical' || layout() === 'horizontal') {
              <div class="frame" [attr.data-layout]="layout()">
                <ui-workflow-panel entity="application" [entityId]="id" [layout]="layout()" [api]="api()" title="Application workflow" (changed)="loadApps()" />
              </div>
            } @else {
              <div class="frame hint">
                <p>The panel is on the {{ layout() === 'side-drawer' ? 'right edge' : 'bottom edge' }} of the screen as a rail of dots: one per state, green up to where the application is now.</p>
              </div>
              <ui-workflow-panel entity="application" [entityId]="id" [layout]="layout()" [api]="api()" title="Application workflow" (changed)="loadApps()" />
            }
          }
        }
        <doc-demo [code]="code"></doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--ui-space-3); margin-bottom: var(--ui-space-3); }
    .pick { min-width: 200px; }
    .frame { padding: var(--ui-space-4); margin-bottom: var(--ui-space-4); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); }
    .frame[data-layout="vertical"] { max-width: 420px; }
    .hint p { margin: 0; font-size: 13.5px; color: var(--ui-color-text-secondary); max-width: 70ch; }
    .offline { display: flex; align-items: center; gap: var(--ui-space-3); flex-wrap: wrap; margin: 0; }
  `,
})
export class WorkflowPanelPage {
  protected readonly pg = inject(WorkflowPlayground);
  protected readonly layout = signal<UiWorkflowPanelLayout>('vertical');
  protected readonly user = signal('ali');
  protected readonly appId = signal<string | null>(null);
  private readonly apps = signal<DemoApplication[]>([]);

  protected readonly layouts: UiSegmentedOption[] = [
    { value: 'vertical', label: 'Vertical' },
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'side-drawer', label: 'Side drawer' },
    { value: 'bottom-drawer', label: 'Bottom drawer' },
  ];
  protected readonly api = computed(() => this.pg.apiAs(this.user()));
  protected readonly appOptions = computed<UiSelectOption[]>(() => this.apps().map((a) => ({ value: String(a.id), label: `${a.title} (${a.status ?? 'new'})` })));
  /** Applicants act on their own applications: picking one picks one of theirs, if they have one. */
  private readonly ownApp = effect(() => {
    const user = this.user();
    const mine = this.apps().find((a) => a.applicant === user);
    if (mine) untracked(() => this.appId.set(String(mine.id)));
  });
  protected readonly userOptions = computed<UiSelectOption[]>(() => this.pg.users().map((u) => ({ value: u.id, label: `${u.name} · ${u.title}` })));

  constructor() {
    effect(() => {
      if (this.pg.online()) untracked(() => void this.loadApps());
    });
  }

  protected async loadApps(): Promise<void> {
    const apps = await this.pg.get<DemoApplication[]>('/demo/applications').catch(() => [] as DemoApplication[]);
    this.apps.set(apps);
    if (!this.appId() && apps.length) this.appId.set(String((apps.find((a) => a.applicant === this.user()) ?? apps[0]).id));
  }

  protected readonly code = `<!-- in the page -->
<ui-workflow-panel entity="application" [entityId]="app.id" layout="vertical" (changed)="reload()" />

<!-- states left to right, details below -->
<ui-workflow-panel entity="application" [entityId]="app.id" layout="horizontal" />

<!-- a rail of dots on the right edge; hover (desktop) or tap opens the drawer -->
<ui-workflow-panel entity="application" [entityId]="app.id" layout="side-drawer" side="right" />

<!-- a rail of dots along the bottom -->
<ui-workflow-panel entity="application" [entityId]="app.id" layout="bottom-drawer" [(open)]="panelOpen" />`;

  protected readonly panelApi: ApiRow[] = [
    { name: 'entity', type: 'string', desc: 'The record type key, as registered.' },
    { name: 'entityId', type: 'string', desc: 'The record id.' },
    { name: 'layout', type: "'vertical' | 'horizontal' | 'side-drawer' | 'bottom-drawer'", default: "'vertical'", desc: 'How it sits on the page.' },
    { name: 'side', type: "'right' | 'left'", default: "'right'", desc: 'Which edge the side drawer opens from.' },
    { name: 'title', type: 'string', default: "'Workflow'", desc: 'The heading (and the drawer title).' },
    { name: 'showHistory', type: 'boolean', default: 'true', desc: 'Show what happened in each state.' },
    { name: 'open', type: 'model<boolean>', default: 'false', desc: 'Whether the drawer is open (drawer layouts).' },
    { name: 'api', type: 'UiWorkflowApi | null', default: 'provided', desc: 'The engine API.' },
    { name: '(changed)', type: 'UiWfRecord', desc: 'After the record moved through the panel.' },
  ];
}
