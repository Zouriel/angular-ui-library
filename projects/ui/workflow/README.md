# `@zouriel/ui/workflow`

A builder where admins design workflows without code, and the components that run
them in your app: a workflow panel for each record, a tasks drawer, an audit log and a
settings screen. Workflows are JSON in the Zouriel Workflows format, run by an
engine on your server (the .NET engine first; Laravel and Go engines follow the
same spec and REST API).

```ts
import {
  UiWorkflowBuilder,        // <ui-workflow-builder>: where admins design workflows
  UiWorkflowPanel,          // <ui-workflow-panel>: a record's state, moves, tasks and history: stepper, compact or drawer
  UiWorkflowTasksDrawer,    // <ui-workflow-tasks-drawer>: a "My tasks" button with a count, where people decide their tasks
  UiWorkflowAudit,          // <ui-workflow-audit>: the tamper-evident log, filter, export, verify
  UiWorkflowGlobalSettings, // <ui-workflow-global-settings>: working hours, channels, webhooks, retention
  UiWorkflowPermissions,    // <ui-workflow-permissions>: who may do what in every published workflow
  UiWorkflowStateBadge,     // <ui-workflow-state-badge>: a state as a coloured chip
  provideUiWorkflow,        // connects the components to the engine's REST API
} from '@zouriel/ui/workflow';
```

## Two kinds of workflow

- **Automations** start when something happens to a record: it is created or deleted, a field
  changes (from/to chosen values), a date comes up, a schedule fires, someone presses a button,
  or your app reports an event. They run a tree of steps: approvals and tasks for people, waits,
  branches, switches, parallel paths, loops over related records, go-back loops, record updates,
  variables, new records ("Create record"), notifications, webhooks, your own actions and other
  workflows.
- **Lifecycles** own a status field. They list its states and the transitions between them: who
  may make each move, checks that must hold, a form to fill in, a confirmation, automatic moves on
  a timer, and steps to run on each move, on entering or leaving a state, or when a record stays
  too long. In enforce mode the engine refuses any other write to the field.
  **Applies to** (in the lifecycle settings) limits a lifecycle to some records, read from their own
  fields: a "Passport application" lifecycle for applications whose type is Passport, another for
  visas, and one with no condition for everything else.
  A lifecycle can also let chosen people **reset** a record: its open tasks and runs stop, it goes
  back to the starting state (or another you pick), and the reset's own steps run, which can change
  the record, related records and each item of a list (Update record inside a For each, on its current item). Set it up under "Starting over" in the
  lifecycle settings; the workflow panel then shows the button to those allowed.
  "Offer it" limits it to some states: from a state you pick onwards (that state and every state
  after it, final states included), with a checklist to adjust.
  The reset dialog lists what the workflow did since the record last started over (fields it
  changed on this or other records, records it created, actions, messages and webhooks).
  Everything that can be undone is ticked, except items someone changed again since, which start
  unticked; sent messages and webhooks can't be taken back. People can untick anything that should
  stay; the ticked items are taken back with the reset (new records deleted, fields put back, app
  actions undone when the app supports it).
- **Remarks** on negative actions: rejecting an approval, a task's red buttons, red moves (e.g.
  Reject, Withdraw) and Start over all offer a remarks box. Each step, move and the reset has a
  Remarks setting to make them optional or required (moves can also not ask). Remarks show in the
  history, go into the audit log, and steps can use them as "Remarks" (`trigger.comment`).

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

A custom `UiWorkflowApi` implements the same calls as the REST client. A few are optional or only
needed by some components:

- `resetPreview` (optional): lists what a reset would take back. Without it the reset dialog only
  asks for confirmation.
- `updatePermissions`: needed by `<ui-workflow-permissions>` to save.
- `me` (optional): who is signed in and what they may do. Without it the permissions page offers
  editing to everyone and the server decides, showing its answer if it refuses.

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
| `readOnly` | `boolean \| null` | Look without changing anything. `null` (the default) asks the API (`me().can.edit`); `true`/`false` decides here. Someone only looking can't edit, delete, drag, save (Ctrl+S is left to the browser) or publish. |
| `(problemsChange)` | `UiWfProblem[]` | The engine's problems after each check. |
| `(saved)` | `UiWorkflowDefinition` | After a successful save. |
| `(dirtyChange)` | `boolean` | With `persist`: whether there are edits not yet saved, so the host can guard leaving (the builder also warns on closing the tab). |
| `[wfActions]` | content | Your own buttons in the builder's header, after Save and Publish: `<ui-button wfActions>Close</ui-button>`. |

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
<!-- on a record's page: a stepper, compact in a side column, or a drawer on the screen's edge -->
<ui-workflow-panel entity="application" [entityId]="app.id" (changed)="reloadApp()" />
<ui-workflow-panel entity="application" [entityId]="app.id" layout="compact" title="" />
<ui-workflow-panel entity="application" [entityId]="app.id" layout="side-drawer" />

<!-- in the app header: "My tasks" with a count, opening the tasks in a drawer -->
<ui-workflow-tasks-drawer (decided)="refresh()" />
<!-- everyone's tasks, for admins -->
<ui-workflow-tasks-drawer scope="all" label="All tasks" />

<!-- admin views -->
<ui-workflow-audit entity="application" [entityId]="app.id" />
<ui-workflow-global-settings />
<ui-workflow-permissions (saved)="reload()" />
```

- **Workflow panel**: the record's states (where it has been, where it is), what happened, and in
  the current state the moves this person may make (with confirmation, form or remarks), open tasks
  they can decide and manual workflows. `layout` is `vertical` (a stepper with what happened in each
  state), `horizontal`, `compact` (a badge, a strip of states, the actions and one history, for a side
  column or details card; `title=""` hides its heading), `side-drawer` or `bottom-drawer` (a rail of
  dots on the screen's edge). A record type with no lifecycle still shows its manual workflows, open
  tasks and history. Under **Running** (or **Stopped**, when all of them stopped) it lists the record's workflows still going, each opening its
  steps (done, waiting, failed, skipped, the paths not taken greyed out). One that stopped opens by
  itself; people the engine lets intervene (`me().can.intervene`) can try it again, skip the step
  (giving the results it would have produced, each in its type, the required ones required) or
  cancel it with remarks. A run that is still waiting but carries an error (a reminder or escalation
  timer that failed ten times, which the engine parks for an admin) is shown as **Needs attention**,
  listed first and opened with the error; the engine only retries stopped runs, so it offers no
  "Try again", only what still works (decide or reassign the task, or cancel the run). The run view
  says the same for a lifecycle record whose automatic move or time limit was parked (move it by
  hand). While a run is still going the panel looks again every 15 seconds (not
  while the page is hidden). After a reset, what happened before it is grouped under "Earlier,
  before starting over". `(changed)` fires whenever the panel sees the record's workflow change: a
  move made in it, or any reload that finds a new state, status or run status (after a decision, a
  manual start, a retry, skip or cancel). Call `reload()` on it after your page changed the record
  itself.
- **Tasks drawer**: where people work through their approvals and tasks. A button with the number
  of open tasks (red when any is overdue) opens them in a drawer: due first and overdue marked, open
  or finished, each opening its decision with its form. `scope="all"` lists everyone's tasks, for
  admins. People who may intervene also see **stopped workflows** there: counted in the badge (which
  turns red) and listed above the tasks, each opening its steps with try again, skip and cancel. The
  count refreshes every `refreshSeconds` while the page is visible, and when the drawer opens or
  closes.
- **Permissions**: one settings page listing, for every published workflow, who may make each move,
  start a record over, press a start button and decide each approval or task. Saving publishes a new
  version with only those changes (`updatePermissions`); if someone else published since the page
  loaded, it asks you to reload instead of overwriting their change. People without the right to
  publish see who may do what, read-only.
- **Audit**: filter by kind and record, page back through older entries, export as CSV, and check
  the hash chain. Limited to one run (`instanceId`) it offers no export, since the engine's export
  can't be narrowed to one run; export the record's log instead.
- **Global settings**: working hours and holidays, defaults (retries, reminders, concurrency, loop
  and for-each limits, delegation), notification channels (on/off and a footer), webhook allowed
  addresses and connections, audit retention and masking, and pausing workflows per record type.
  The engine checks every field when saving; when it refuses (`invalidSettings`), each problem is
  shown next to its field, the sections with problems are marked, and a problem disappears once
  its field is changed.
- **Webhook steps** use `GET`, `POST`, `PUT`, `PATCH` or `DELETE`; a definition with any other
  method shows it as "not allowed" in the picker, and the engine reports `badMethod`.
- **Permissions** save messages also say how many records stay on an older version because its
  states or transitions differ (`recordsKept`; they need an explicit migration).

| `<ui-workflow-panel>` | Type | Default | Notes |
| --- | --- | --- | --- |
| `entity` / `entityId` | `string` | required | The record. Changing them shows the new record (the old one is cleared at once). |
| `layout` | `UiWorkflowPanelLayout` | `'vertical'` | `vertical`, `horizontal`, `compact`, `side-drawer` or `bottom-drawer`. |
| `side` | `'right' \| 'left'` | `'right'` | Which edge the side drawer opens from. |
| `title` | `string` | `'Workflow'` | The heading and drawer title; `''` hides the heading in `compact`. |
| `showHistory` | `boolean` | `true` | Show what happened. The panel reads the latest 500 entries. |
| `emptyText` | `string` | `'Nothing for you to do here right now.'` | Said in the current state when this person has nothing to do; `''` hides it. |
| `open` | `model<boolean>` | `false` | Whether the drawer is open (drawer layouts). |
| `api` | `UiWorkflowApi \| null` | provided | The engine API. |
| `(changed)` | `UiWfRecord` | | The record's workflow changed (see above). |
| `reload()` | method | | Reads the record and its history again. |

| `<ui-workflow-tasks-drawer>` | Type | Default | Notes |
| --- | --- | --- | --- |
| `open` | `model<boolean>` | `false` | Whether the drawer is open. Two-way, to open it from code. |
| `label` | `string` | `'My tasks'` | The button and drawer title. |
| `side` | `'left' \| 'right'` | `'right'` | Where the drawer opens. |
| `size` / `variant` | `UiSize` / `'outline' \| 'ghost' \| 'primary'` | `'sm'` / `'outline'` | How the button looks. |
| `showButton` | `boolean` | `true` | Show the built-in button (off to open it from your own control). |
| `refreshSeconds` | `number` | `60` | How often the count refreshes while the page is visible (0: only on open, close and decisions). |
| `pageSize` | `number` | `25` | Tasks per page in the drawer. |
| `scope` | `'mine' \| 'all'` | `'mine'` | The signed-in person's tasks, or everyone's (for admins; give it a label such as "All tasks"). The count follows it. |
| `api` | `UiWorkflowApi \| null` | provided | The engine API. |
| `(decided)` | `UiWfTask` | | After a task was decided in the drawer. |

| `<ui-workflow-audit>` | Type | Default | Notes |
| --- | --- | --- | --- |
| `entity` / `entityId` | `string \| null` | `null` | Only one record's entries (the record filter box hides). |
| `instanceId` | `string \| null` | `null` | Only one run's entries (no export: see above). |
| `pageSize` | `number` | `50` | Entries per page; **Older entries** loads the next. |
| `api` | `UiWorkflowApi \| null` | provided | The engine API. |

| `<ui-workflow-permissions>` | Type | Notes |
| --- | --- | --- |
| `api` | `UiWorkflowApi \| null` | The engine API. Needs `updatePermissions` to save; `me` is optional. |
| `(saved)` | `UiWfDefinitionSummary` | After a workflow's permissions were saved (the new version). |

## Working with definitions in code

The helpers the builder uses are exported for apps that generate or inspect workflows:
`createWorkflow`, `createStep`, `insertStep`, `moveStep`, `removeStep`, `indexSteps`,
`listSteps`, `tokensAt` (the values a step can read), `describeTrigger` / `describeStep`
(plain-English summaries), `autoLayout` (the lifecycle diagram's layout), `wfStatesFrom` (the
states "from a state onwards", as the reset's "Offer it" picks them) and `wfDescribeHistory` (a
record history entry as people read it, e.g. "Submit: Draft → Submitted").

The layout is deterministic and the Flutter library (`zouriel_ui`) mirrors it; both run the same
cases from `src/fixtures/layout.json`.

## The format and the API

The JSON format is specified in the Zouriel Workflows spec (`spec/SPEC.md`, with JSON Schemas) and
the REST API in `spec/api/openapi.json`, both in the engine repository. The builder only offers
what the server's registry allows (`GET /schema`), so admins never type field names or ids.
