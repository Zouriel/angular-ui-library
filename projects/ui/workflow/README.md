# `@zouriel/ui/workflow`

A builder where admins design workflows without code, and the components that run
them in your app: a record panel, a task inbox, a run view, an audit log and a
settings screen. Workflows are JSON in the Zouriel Workflows format, run by an
engine on your server (the .NET engine first; Laravel and Go engines follow the
same spec and REST API).

```ts
import {
  UiWorkflowBuilder,        // <ui-workflow-builder>: where admins design workflows
  UiWorkflowRecordPanel,    // <ui-workflow-record-panel>: a record's state, moves, tasks and history
  UiWorkflowTasks,          // <ui-workflow-tasks>: the signed-in person's approvals and tasks
  UiWorkflowRun,            // <ui-workflow-run>: one run over its workflow, with retry/skip/cancel
  UiWorkflowAudit,          // <ui-workflow-audit>: the tamper-evident log, filter, export, verify
  UiWorkflowGlobalSettings, // <ui-workflow-global-settings>: working hours, channels, webhooks, retention
  UiWorkflowStateBadge,     // <ui-workflow-state-badge>: a state as a coloured chip
  provideUiWorkflow,        // connects the components to the engine's REST API
} from '@zouriel/ui/workflow';
```

## Two kinds of workflow

- **Automations** start when something happens to a record: it is created or deleted, a field
  changes (from/to chosen values), a date comes up, a schedule fires, someone presses a button,
  or your app reports an event. They run a tree of steps: approvals and tasks for people, waits,
  branches, switches, parallel paths, loops over related records, go-back loops, record updates,
  variables, notifications, webhooks, your own actions and other workflows.
- **Lifecycles** own a status field. They list its states and the transitions between them: who
  may make each move, checks that must hold, a form to fill in, a confirmation, automatic moves on
  a timer, and steps to run on each move, on entering or leaving a state, or when a record stays
  too long. In enforce mode the engine refuses any other write to the field.
  A lifecycle can also let chosen people **reset** a record: its open tasks and runs stop, it goes
  back to the starting state (or another you pick), and the reset's own steps run, which can change
  the record, related records and each item of a list. Set it up under "Starting over" in the
  lifecycle settings; the record panel and the workflow panel then show the button to those allowed.

Every start, step, decision and move is written to a hash-chained audit log.

## Set up

**Backend** (.NET): add `Zouriel.Workflows.AspNetCore` and `Zouriel.Workflows.EntityFrameworkCore`,
register which entities, fields, actions and events workflows may use, and map the API:

```cs
builder.Services.AddDbContext<AppDb>((sp, o) => o.UseNpgsql(cs).AddWorkflowInterceptor(sp));
builder.Services.AddWorkflows(wf => wf
    .UseEntityFrameworkCore<AppDb>()
    .Entity<Application>("application", e => e
        .Title(a => a.Title)
        .Field(a => a.Status, f => f.LifecycleCapable())
        .Field(a => a.Amount, f => f.Currency().Watchable().Settable()))
    .UseIdentity<AppWorkflowIdentity>()
    .UseNotifications<AppNotificationSender>());
app.MapWorkflowApi("/api/workflows", o => o.EditPolicy = "workflows.edit");
// AppDb.OnModelCreating: modelBuilder.AddWorkflows();
```

**Frontend**: provide the API once, then use the components anywhere.

```ts
// app.config.ts
providers: [provideUiWorkflow({ baseUrl: '/api/workflows' })]

// add sign-in or route through your HTTP layer
provideUiWorkflow({ baseUrl: '/api/workflows', headers: () => ({ Authorization: `Bearer ${auth.token()}` }) })
provideUiWorkflow({ api: myOwnImplementationOfUiWorkflowApi })
```

Every component also takes an `[api]` input, which wins over the provided one.

## The builder

```html
<ui-workflow-builder [(definition)]="workflow" [published]="published" [persist]="true" (saved)="reload()" />
```

| Input / output | Type | Notes |
| --- | --- | --- |
| `definition` | `model<UiWorkflowDefinition>` | The workflow being edited. Create one with `createWorkflow('automation' \| 'lifecycle', title, entity)`. |
| `published` | `UiWorkflowDefinition \| null` | The published version; locks the record type and key. |
| `api` | `UiWorkflowApi \| null` | Defaults to `provideUiWorkflow`. Supplies the registry, checks and saves. |
| `schema` | `UiWorkflowSchema \| null` | Registry and step outputs, when there is no API. |
| `settings` | `UiWorkflowSettings \| null` | Global settings (webhook connections), when there is no API. |
| `persist` | `boolean` | Show Save and Publish and save drafts through the API. |
| `(problemsChange)` | `UiWfProblem[]` | The engine's problems after each check. |
| `(saved)` | `UiWorkflowDefinition` | After a successful save. |

Automations show a trigger card and a list of steps: press **+** between steps, or drag one in from
the palette; branches, outcomes and parallel paths appear as columns. Drag a step by its grip to
move it anywhere, including into another branch; its **⋯** menu moves, duplicates, turns off or
deletes it. Lifecycles are a diagram on a pan/zoom canvas: drag a state to move it, drag from its
handle onto another state to add a transition (on touch, tap the handle, then the target), and
edit what each state or transition runs in the pane underneath. **Tidy up** lays it out again.

The engine checks the definition as you edit (`POST /validate`); problems show on the steps they
concern. **Versions** publishes, compares and rolls back; **Test** runs the draft against a real
record without changing anything. Undo and redo cover every edit (Ctrl+Z, Ctrl+Shift+Z).

Below 1100px the palette moves into a dialog; on phones the settings open in a bottom sheet.

## Running workflows in your app

```html
<!-- on a record's page -->
<ui-workflow-record-panel entity="application" [entityId]="app.id" (changed)="reloadApp()" />

<!-- an inbox -->
<ui-workflow-tasks scope="mine" (decided)="refresh()" />

<!-- admin views -->
<ui-workflow-run [instanceId]="runId" [canIntervene]="isAdmin" />
<ui-workflow-audit entity="application" [entityId]="app.id" />
<ui-workflow-global-settings />
```

- **Record panel**: the record's state, the moves this person may make (with confirmation or
  form), open tasks they can decide, buttons for manual workflows, and the history.
- **Tasks**: approvals and tasks, due first and overdue marked; deciding opens the task's form.
- **Run**: the steps of one run with their status; admins can retry or skip a stopped step (each
  stopped path on its own when several stopped) or cancel the run.
- **Audit**: filter, export as CSV or JSON, and check the hash chain.
- **Global settings**: working hours and holidays, defaults, notification channels, webhook
  connections, audit retention and masking, and pausing workflows per record type.

## Working with definitions in code

The helpers the builder uses are exported for apps that generate or inspect workflows:
`createWorkflow`, `createStep`, `insertStep`, `moveStep`, `removeStep`, `indexSteps`,
`listSteps`, `tokensAt` (the values a step can read), `describeTrigger` / `describeStep`
(plain-English summaries) and `autoLayout` (the lifecycle diagram's layout).

The layout is deterministic and the Flutter library (`zouriel_ui`) mirrors it; both run the same
cases from `src/fixtures/layout.json`.

## The format and the API

The JSON format is specified in the Zouriel Workflows spec (`spec/SPEC.md`, with JSON Schemas) and
the REST API in `spec/api/openapi.json`, both in the engine repository. The builder only offers
what the server's registry allows (`GET /schema`), so admins never type field names or ids.
