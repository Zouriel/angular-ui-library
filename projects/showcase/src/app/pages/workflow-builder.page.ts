import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import {
  UI_WORKFLOW_API,
  UI_WORKFLOW_CLOCK,
  UiWorkflowBuilder,
  createWorkflow,
  type UiWorkflowDefinition,
} from '@zouriel/ui/workflow';
import { DocDemo, DocPage, DocSection, type ApiRow } from '../docs/docs-ui';
import { WorkflowPlayground } from './workflow-playground';

/** Who the demos on this page act as: the head of office. */
const DOCS_USER = 'hana';

@Component({
  selector: 'page-workflow-builder',
  imports: [RouterLink, UiButton, UiWorkflowBuilder, DocDemo, DocPage, DocSection],
  // This page always acts as Hana, the head of office (who may edit, test and see everything), with
  // its own API, so it never changes the person the studio acts as. Times follow the sandbox clock.
  providers: [
    { provide: UI_WORKFLOW_API, useFactory: () => inject(WorkflowPlayground).apiAs(DOCS_USER) },
    { provide: UI_WORKFLOW_CLOCK, useFactory: () => inject(WorkflowPlayground).now },
  ],
  template: `
    <doc-page eyebrow="Flagship" title="Workflow builder"
      lead="Admins design workflows without code. Automations start when a record changes (a field becomes a value, a date comes up, a schedule, a button, an event from your app) and run approvals, waits, branches, parallel paths, loops, messages, record updates and your own actions. Lifecycles own a status field: states, who may move a record between them, checks, forms, and what runs on each move. Everything is audited in a tamper-evident log. A .NET engine runs it; Laravel and Go engines follow the same spec.">

      <aside class="studio-cta">
        <div>
          <strong>Try it on the real engine</strong>
          <p>The workflow studio is a small scholarship office running on the .NET engine in a private sandbox: submit an application as the applicant, approve it as a reviewer, sign it off as finance, move the clock forward, and read the audit log.</p>
        </div>
        <ui-button routerLink="/workflow-studio">Open the workflow studio</ui-button>
      </aside>

      <doc-section name="How it fits together" selector="spec, engine, components"
        summary="One JSON format (the Zouriel Workflows spec) is written by the builder and run by the engine. Developers register which records, fields and actions workflows may use; admins only ever choose from that list. The engine checks every change to a registered record when it is saved and starts workflows through an outbox, so a rolled-back save starts nothing.">
        <doc-demo lang="csharp" [code]="install">
          <ol class="steps">
            <li><strong>Backend.</strong> Add <code>Zouriel.Workflows.AspNetCore</code> and <code>Zouriel.Workflows.EntityFrameworkCore</code>, call <code>modelBuilder.AddWorkflows()</code> in your DbContext and add the interceptor.</li>
            <li><strong>Register.</strong> In <code>AddWorkflows</code>, list the entities, the fields to watch or change, the field a lifecycle may own, your actions and events, and plug in your users and notifications.</li>
            <li><strong>Serve.</strong>{{ ' ' }}<code>app.MapWorkflowApi("/api/workflows")</code> with your authorization policies.</li>
            <li><strong>Frontend.</strong>{{ ' ' }}<code>provideUiWorkflow(&#123; baseUrl: '/api/workflows' &#125;)</code>, then drop in the components (see Workflow components).</li>
          </ol>
        </doc-demo>
        <doc-demo lang="ts" [code]="frontend"></doc-demo>
      </doc-section>

      <doc-section name="Builder" selector="ui-workflow-builder" [api]="builderApi"
        summary="Automations are a trigger card and a list of steps: press + between steps (or drag one in from the left) and branches, outcomes and parallel paths appear as columns. Drag a step by its grip to move it anywhere, including into another branch; the ⋯ menu also moves, duplicates, turns off or deletes it. Lifecycles are a diagram: drag a state to move it, drag from its handle onto another state to add a transition (tap the handle, then the target, on touch), and edit what each transition or state runs underneath. A lifecycle can also let chosen people start a record over (Starting over, in its settings): the reset chip beside “From any state” sets who may, where it goes back to, a reason form, and the steps it runs, which can change the record, related records and each item of a list. “Offer it” limits Start over to a state onwards. When someone resets a record, the dialog lists what the workflow did (fields it changed anywhere, records it created, actions, messages), with everything that can be undone ticked, and they untick what should stay. Red moves, Start over, rejections and a task’s red buttons ask for remarks; each has a Remarks setting to make them optional or required. Applies to, in a lifecycle's settings, limits it to some records (e.g. applications whose type is Passport), and the Create record step adds a record of any kind, which a reset can delete again. Every change is checked by the engine as you go; Versions publishes and rolls back, Test runs the draft against a real record without changing anything. Below 1100px the palette moves into a dialog, and on phones the settings open in a bottom sheet.">
        <div class="builder-frame">
          <ui-workflow-builder [definition]="def()" (definitionChange)="def.set($event)" />
        </div>
        <doc-demo [code]="builderCode"></doc-demo>
      </doc-section>

      <aside class="studio-cta">
        <div>
          <strong>Running workflows in your app</strong>
          <p>The panels, the task inbox and drawer, run and audit views, and the permissions and settings pages are on their own page, each with a live demo and its inputs.</p>
        </div>
        <ui-button variant="outline" routerLink="/workflow-components">See the workflow components</ui-button>
      </aside>
    </doc-page>
  `,
  styles: `
    .studio-cta { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-4); flex-wrap: wrap; padding: var(--ui-space-3) var(--ui-space-4);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); }
    .studio-cta p { margin: 4px 0 0; font-size: 13px; color: var(--ui-color-text-secondary); max-width: 70ch; }
    .steps { margin: 0; padding-left: var(--ui-space-4); display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; line-height: 1.5; }
    .builder-frame { --w: min(1480px, calc(100vw - 360px)); width: var(--w); margin-left: min(0px, calc((100% - var(--w)) / 2)); height: min(820px, calc(100dvh - 120px)); }
    .builder-frame ui-workflow-builder { height: 100%; }
    .builder-frame { margin-bottom: var(--ui-space-4); }
    @media (max-width: 900px) { .builder-frame { --w: 100%; margin-left: 0; } }
    @media (max-width: 720px) { .builder-frame { width: auto; height: calc(100dvh - 120px); min-height: 520px; margin: 0 calc(-1 * var(--ui-space-4)); } }
  `,
})
export class WorkflowBuilderPage {
  protected readonly def = signal<UiWorkflowDefinition>(createWorkflow('automation', 'Remind reviewers', 'application'));

  protected readonly install = `// Program.cs
builder.Services.AddDbContext<AppDb>((sp, o) => o.UseNpgsql(cs).AddWorkflowInterceptor(sp));
builder.Services.AddWorkflows(wf => wf
    .UseEntityFrameworkCore<AppDb>()
    .Entity<Application>("application", e => e
        .Title(a => a.Title)
        .Field(a => a.Status, f => f.LifecycleCapable())          // a lifecycle may own it
        .Field(a => a.Amount, f => f.Currency().Watchable().Settable())
        .Field(a => a.ReviewerId, f => f.Key("reviewer").User().Settable())
        .Collection(a => a.Documents, "documents"))
    .Action<CreateInvoice>("finance.createInvoice", a => a.Input("amount", "Amount", "currency", required: true).Output("invoiceNo", "Invoice number"))
    .UseIdentity<AppWorkflowIdentity>()          // users, roles, managers
    .UseNotifications<AppNotificationSender>()); // email, in-app…
app.MapWorkflowApi("/api/workflows").RequireAuthorization();

// AppDb.OnModelCreating
modelBuilder.AddWorkflows();`;

  protected readonly frontend = `// app.config.ts
providers: [
  provideUiWorkflow({ baseUrl: '/api/workflows' }),
  // Optional: count "due in" and "ago" from the server's clock instead of the browser's.
  // provideUiWorkflowClock(() => Date.now() + serverOffsetMs),
]`;

  protected readonly builderCode = `<ui-workflow-builder [(definition)]="workflow" [published]="published" [persist]="true" (saved)="reload()" />`;

  protected readonly builderApi: ApiRow[] = [
    { name: 'definition', type: 'model<UiWorkflowDefinition>', desc: 'The workflow being built (spec JSON). Two-way.' },
    { name: 'published', type: 'UiWorkflowDefinition | null', default: 'null', desc: 'The published version; locks the record type and key.' },
    { name: 'api', type: 'UiWorkflowApi | null', default: 'provided', desc: 'The engine API. Defaults to provideUiWorkflow.' },
    { name: 'schema', type: 'UiWorkflowSchema | null', default: 'null', desc: 'Registry and step outputs, when there is no API.' },
    { name: 'settings', type: 'UiWorkflowSettings | null', default: 'null', desc: 'Global settings (webhook connections), when there is no API.' },
    { name: 'persist', type: 'boolean', default: 'false', desc: 'Show Save and Publish and save drafts through the API.' },
    { name: '(problemsChange)', type: 'UiWfProblem[]', desc: 'The engine’s problems after each check.' },
    { name: '(saved)', type: 'UiWorkflowDefinition', desc: 'After a successful save through the API.' },
    { name: '(dirtyChange)', type: 'boolean', desc: 'True while there are unsaved edits (guard leaving the page with it).' },
    { name: '[wfActions]', type: 'content', desc: 'Your own buttons in the header.' },
  ];
}
