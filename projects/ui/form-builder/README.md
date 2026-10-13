# `@zouriel/ui/form-builder`

A drag-and-drop form builder for admin staff, the renderer that fills the forms
in, and a settings screen for the lists every form can search. Forms and
answers are plain JSON that your app stores.

```ts
import {
  UiFormBuilder,            // <ui-form-builder>: where admins make a form
  UiFormRenderer,           // <ui-form-renderer>: where people fill it in (or staff view and correct answers)
  UiFormGlobalSettingsEditor, // <ui-form-global-settings>: shared lists and new-form defaults
  provideUiFormValidators,  // app checks ("Student ID exists")
  provideUiFormOptionSources, // searchable lists from your API, in code
  provideUiFormHttpSources, // how lists set up in settings reach your API
} from '@zouriel/ui/form-builder';
```

## Integrating it: JSON in, JSON out

Your app stores three kinds of JSON. The components never talk to a server
themselves (except option sources, through hooks you provide).

| JSON | Type | Made by | Read by |
| --- | --- | --- | --- |
| A form | `UiFormDefinition` | `ui-form-builder` | `ui-form-renderer`, `UiFormEngine` |
| One set of answers | `Record<string, unknown>` (`submission.data`) | `ui-form-renderer` | `ui-form-renderer` (to edit or view) |
| App-wide settings | `UiFormGlobalSettings` | `ui-form-global-settings` | builder and renderer (`globalSettings`) |

**1. Create or load a form.**

```ts
const form = createDefinition('Scholarship application', settings.defaults); // a new one-page form
const form = migrateDefinition(await api.getForm(id)); // a stored one: fills in defaults, upgrades old versions
```

**2. Build it.** Bind it two-way and save whenever it changes (or on your Save button):

```html
<ui-form-builder [(definition)]="form" [published]="live" [submissionCount]="answerCount" [globalSettings]="settings">
  <ui-button fbActions (click)="publish()">Publish</ui-button>
</ui-form-builder>
```

**3. Publish.** People should answer a published copy, not the draft. Check
`builder.problems()` for errors, bump `revision`, and store a copy:

```ts
publish() {
  if (this.builder().problems().some((p) => p.severity === 'error')) return; // shown under Logic
  this.form = { ...this.form, revision: (this.live?.revision ?? 0) + 1 };
  this.live = structuredClone(this.form);
  api.publish(this.live);
}
```

Pass that copy back as `published`, with its answer count as `submissionCount`, so
the builder protects saved answers (see "Changing a form that already has answers").

**4. Fill it in.** Store `submission.data` with `submission.revision`:

```html
<ui-form-renderer [definition]="live" [globalSettings]="settings" (submitted)="api.saveAnswers($event)" />
```

`submitted` emits a `UiFormSubmission`:

```ts
{
  formId: 'scholarship-2027',
  revision: 4,                    // the form's revision when it was filled in (null if never set)
  submittedAt: '2026-10-13T09:30:00.000Z',
  data: {                         // the JSON to store
    full_name: 'Aminath Shareef',  // keys are the fields' keys
    study_status: 'full_time',     // choices store the option's value
    subjects: ['maths', 'physics'],// multiple choice: a list of values
    address: { city: 'Malé' },     // a section with a key nests an object
    dependants: [{ name: 'Ali' }], // a repeating section is a list of objects
    student_record: { value: 'S240117', label: 'Aminath Shareef' }, // option sources: { value, label }
    transcript: [{ name: 'a.pdf', size: 1200, type: 'application/pdf', url: '…' }], // files: UiFbFileValue[]
  },
  files: {},                      // picked File objects when there is no uploader, keyed by data path
}
```

Calculated fields are included unless `props.excludeFromData` is set. Answers
to questions hidden by rules are left out when submitting, unless the form's
`clearHidden` setting is `'never'`.

**5. Edit or view saved answers.** Pass the stored data back:

```html
<ui-form-renderer [definition]="live" [data]="answer.data" (submitted)="api.updateAnswers(answer.id, $event.data)" />
<ui-form-renderer [definition]="live" [data]="answer.data" mode="view" />
```

With `data`, the mode is `edit` unless you say otherwise: the button reads "Save
changes", the form tracks `dirty()` and lists `changes()` (from → to) next to it.
Keys it doesn't know about are kept, and so are answers to questions that were
already hidden when it opened. Options that were removed still show, marked
"no longer offered". Answers saved under a key that has since been renamed load
through `keyHistory` and are saved under the new key. `mode="view"` shows
every page people would have seen at once, as read-only text.

**6. Shared settings.** Put `ui-form-global-settings` on your settings page, store
its JSON, and pass it to the builder and renderer as `globalSettings`. See
"Global settings".

## Building forms

- **Add** a field by clicking it in the palette (it goes after the selection) or by
  dragging it onto the page. The palette sits beside the canvas on wide screens;
  narrower, use the **Add** button (a dialog), and on phones **Add field** (a
  bottom sheet). Empty pages and sections offer the common types as buttons.
- **Move** by dragging the handle (mouse or touch), with Alt+↑/↓ on a focused card,
  or with the card's move buttons and **More → Move to…** menu.
- **Select and edit**: clicking or tapping a card selects it and shows its toolbar
  (settings, move up/down, duplicate, delete, more). Its settings open from the
  toolbar's settings button, a double-click, Enter, or holding the card on a touch
  screen. On screens 720px and wider they're always shown beside the canvas; on
  phones they open in a bottom sheet.
- **Keyboard** on a focused card: Enter opens its settings, Delete or Backspace
  deletes it (asking first when it has answers or rules use it), Ctrl/⌘+D duplicates it, Alt+↑/↓ moves it. Escape clears the selection.
- **Pages** have a ⋯ menu on their heading: page settings, move earlier or later,
  and delete.
- **Sections** group questions, can use 2 or 3 columns, can **repeat** ("Add a
  dependant", min/max), and can keep their answers together under one key.
- **Pages** split the form into steps. Pages can be skipped by rules, and can
  **jump** forward when an answer says so.
- **Undo/redo** with the toolbar, Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Ctrl/⌘+Y).
- **Logic** lists every rule in plain words, plus anything that needs fixing.
- **Preview** fills the form in at desktop or phone width, with the saved JSON
  alongside. Paste saved answers to try editing them.
- **Keys** (the names answers are saved under) follow the question text, and a
  section's key follows its title, until the form has answers or the key is
  changed by hand.

The builder lays itself out by its own width: three panes from 1100px, two from
720px, and a single canvas with bottom sheets below that. Give it a height.

### Rules

Every rule is a sentence built from dropdowns: *Show this question only when
“Marital status” is Married*. Rules can be combined with all / any / none and
one level of groups, and they can ask about:

| Asked about | Comparisons |
| --- | --- |
| Text | is, is not, contains, does not contain, starts with, ends with, is filled in, is empty |
| Numbers | is, is not, is more/less than, is at least/most, is between, is filled in, is empty |
| Dates | is, is before/after, is on or before/after, is between, is filled in, is empty; against a date, another answer, or *N days from today* |
| Times | is, is before/after, is between, is filled in, is empty |
| Single choice | is, is not, is any of, is none of, is filled in, is empty |
| Multiple choice | includes, does not include, includes any/all of, has at least/most *N* ticked, is filled in, is empty |
| Yes/no | is ticked, is not ticked |
| Files | is filled in, is empty, has at least/most *N* |
| Sections and pages | is shown, is hidden, is complete, is not complete |
| Repeating sections | has at least/most *N* entries, and the section comparisons |

Each question, section, text block and page can be shown or hidden by a rule.
Questions and sections can be read-only (always, or when…). A question can be
required always or only when…. It can also fill itself in when a rule starts to
apply. Loops (A depends on B depends on A) are caught and listed under **Logic**.

### Checks and messages

Each check has its own message, an optional "only check when…" rule, and can be
a warning instead of an error. Built in: valid email/website/phone (automatic for
those types), length and word limits, allowed characters, number limits, whole
numbers and decimal places, earliest/latest date (fixed or relative to today),
minimum/maximum age, time windows, ticked counts, file types/size/count, and
"matches" / "compared with" another answer.

Messages show **below the field** by default, with the question **above** it.
The form settings, or any one question, can move the label inside the box (it
floats up as you type) or put the error inside the box. "Inside" only applies to
text-like boxes; other fields keep the default placement.

### App checks

```ts
providers: [provideUiFormValidators({
  type: 'studentIdExists',        // stored in the form JSON: keep it stable
  label: 'Student ID exists',     // what admins see in "Add a check"
  valueKinds: ['text'],           // or fieldTypes: ['text']
  defaultMessage: 'We couldn’t find that student ID.',  // {label} and {paramKey} are filled in
  validate: (value, params, ctx) => api.exists(value, { signal: ctx.signal }), // true/null passes, false fails, a string fails with that text
})]
```

`UiFbValidatorDef` also takes `description`, `params` (settings admins fill in:
`{ key, label, kind: 'number' | 'text' | 'date' | 'field' | 'select', … }`),
`debounceMs` and `runWhenEmpty` (checks skip empty answers unless this is set).
Registered checks appear in the builder's **Add a check** list and run in the
renderer. Async checks wait `debounceMs` (400ms by default) after typing, show
"Checking…", block submitting until they finish, and are cancelled through
`ctx.signal` when the answer changes. Both components also take a `validators`
input for checks you don't register app-wide.

### Option sources (searchable lists from your app)

```ts
providers: [provideUiFormOptionSources({
  type: 'courses',                // stored in the form JSON: keep it stable
  label: 'Courses',
  params: [{ key: 'programme', label: 'Programme', kind: 'select', options: [...], required: true }],
  pageSize: 20,                   // default 20; also minQueryLength (0) and debounceMs (250)
  search: ({ query, page, pageSize, params, signal }) =>
    api.courses({ q: query, page, size: pageSize, programme: params.programme }, signal),
  // → { items: [{ value, label, description? }], hasMore }   (or total, or neither)
})]
```

In the builder, a dropdown or multi-select's **Options** can switch from a typed
list to **Data source**. Admins pick a list, fill in its settings (each a fixed
value or *the answer to* another question, for lists that depend on each other),
and can try it on the spot. Radio buttons and tick boxes stay typed lists.

In the form, the field searches as people type (debounced, older requests
cancelled through `signal`), loads the next page as the list scrolls, and shows
loading, "no matches" and retry states. `page` starts at 1. When a page gives
neither `hasMore` nor `total`, a full page means there may be more. When an
answer it depends on changes, its own answer is cleared. Answers are saved as
`{ value, label }` (a list of them for multi-selects), so they stay readable even
if the record is renamed or removed later. Rules on these questions compare the
`value` and search the same list in the rule editor. Both components also take an
`optionSources` input for lists you don't register app-wide.

### Global settings (for the app's settings page)

```html
<ui-form-global-settings [(settings)]="settings" [usage]="{ students: 3 }" />
<ui-form-builder [(definition)]="form" [globalSettings]="settings()" />
<ui-form-renderer [definition]="form" [globalSettings]="settings()" />
```

```ts
providers: [provideUiFormHttpSources({
  allowedOrigins: ['https://api.example.com'],
  fetch: (url, { signal }) => myHttp.getJson(url, { signal }),   // adds the session or token
})]
```

Admins manage, in one place:
- **Data sources**: lists set up without code (`UiFbHttpSourceConfig`). Each has:
  - an address (`url`);
  - how it searches and pages (`searchParam`, page numbers or skip/limit, `pageSizeParam`);
  - where the items are in the reply (`itemsPath`), and which fields are the value and
    the label (`valueField`, `labelField`; `{firstName} {lastName}` combines fields);
  - optional per-question settings (`params`, sent as query settings);
  - a **Test** that shows the request and what came back, including the fields found in each item.

  Lists built into the app's code (`provideUiFormOptionSources`) are shown read-only.
  Settings hold no secrets: the app's `fetch` adds its login, and lists may only call
  `allowedOrigins`. Without `provideUiFormHttpSources`, requests use the browser's
  `fetch` with same-origin cookies and only this app's own origin is allowed.
- **New form defaults**: what `createDefinition(title, settings.defaults)` starts
  every new form with. Existing forms aren't changed.

`usage` maps list `type`s to how many forms use them, so deleting or re-keying a
used list asks first. The settings are plain JSON (`UiFormGlobalSettings`:
`{ version: 1, sources?, defaults? }`) for the app to store; start with
`createGlobalSettings()`.

## Filling forms in

```html
<ui-form-renderer [definition]="form" [data]="saved" (submitted)="store($event)" />
```

| Input | Default | |
| --- | --- | --- |
| `definition` | required | The form. |
| `data` | `null` | Saved answers to edit or view. |
| `mode` | `edit` with data, else `create` | `'create' \| 'edit' \| 'view'`. |
| `validators`, `optionSources`, `globalSettings` | `[]`, `[]`, `null` | Same as the builder's. |
| `uploader` | `null` | `(file, field) => Promise<UiFbFileValue>`: upload as files are picked. Without it, the `File`s come back in `submission.files`. |
| `submitLabel`, `cancelLabel` | `null` | Button text. A cancel label adds a Cancel button. |
| `busy` | `false` | Shows the submit button as busy while you save. |
| `showTitle`, `showActions` | `true` | Hide the title, or the buttons (drive it with `submit()`). |
| `today` | `null` | `() => 'YYYY-MM-DD'`: fixes today for date rules and ages. |

Outputs: `submitted` (`UiFormSubmission`), `valueChange` (the data as it would be
saved, after every change), `dirtyChange` (`boolean`), `cancelled`. Methods:
`submit()` (validates everything, emits and returns the submission, or `null`),
`reset()` (back to the data it was given, on the first page), and `engine()` (the
running `UiFormEngine`: `data()`, `dirty()`, `changes()`…).

- **Validation** follows "reward early, punish late". A field is checked when
  it's left, and once it shows an error it updates as you type (or only on
  Continue, by form setting). **Continue** and **Submit** check the whole page and
  list every problem at the top, with links to the fields.
- **Hidden questions** don't block submitting. Their answers are left out of the
  data (or kept, by form setting).

## Changing a form that already has answers

Pass the version people are answering as `published`, and how many answers it
has as `submissionCount`. While that's above zero:

- Deleting a question with answers offers **Archive** instead: it's hidden from
  new answers and old answers keep it.
- Renaming a question's key remembers the old one (`keyHistory`), so old answers
  still load and re-save under the new key.
- Stored option values are locked, and removing an option archives it.
- The type can only change to a similar one (dropdown ↔ single choice, …).
- The top bar lists the unpublished changes, also available as `changes()`.

Rules always point at element ids, never at labels or keys, so renaming never
breaks them. Bump `revision` when you publish: every submission records the
revision it was made with.

## The builder's API

| | |
| --- | --- |
| `[(definition)]` | `UiFormDefinition`, two-way. Every edit writes back. Setting a different object loads it (and clears undo). |
| `published` | `UiFormDefinition \| null`: the version people answer now. |
| `submissionCount` | `number`: its answers. Above zero, saved data is protected. |
| `validators`, `optionSources`, `globalSettings` | Extra checks and lists, on top of the providers. |
| `[fbActions]` | Content slot for your buttons in the top bar. |
| `problems()` | `UiFbProblem[]` (`{ severity, targetId, message }`): missing keys, rule loops, rules pointing at deleted questions, backward jumps. |
| `changes()` | `UiFbDiff \| null`: what changed since `published` (added, archived, renamed keys, type changes, removed options, changed rules, and a `summary` of lines). |
| `select(id)`, `undo()`, `redo()` | Select an element or page (`null` for the form); step through history. |

## Running a form without UI

`UiFormEngine` is what the renderer runs: the same rules, checks and data
shaping, as signals. It needs an Angular `Injector` (it uses effects), so use it
inside an Angular app or test (`TestBed.inject(Injector)`).

```ts
const engine = new UiFormEngine({ definition, data, injector, validators, optionSources });
engine.setValue('f_name', null, 'Aminath');   // element id, repeat row (null outside repeats), value
engine.submit();                              // UiFormSubmission, or null with errors shown
engine.data(); engine.dirty(); engine.changes();
engine.destroy();
```

## The JSON

The full types are in `schema.ts`. In short:

```ts
interface UiFormDefinition {
  schemaVersion: number;     // 1
  id: string; title: string; description?: string;
  revision?: number;         // bump when you publish
  settings?: UiFbSettings;   // labelPlacement, errorPlacement, validateOn, clearHidden,
                             // errorSummary, requiredMarker, submitLabel, nextLabel, backLabel, showProgress
  pages: UiFbPage[];         // { id, title?, description?, visibility?, jumps?, elements }
}
type UiFbElement = UiFbField | UiFbGroup | UiFbStatic;   // kind: 'field' | 'group' | 'static'
```

A field has an `id` (never changes), a `type`, the `key` its answer is saved
under, a `label`, and optional `help`, `placeholder`, `defaultValue`, `options`
(`{ id, value, label, archived? }`), `source` (an option source), `props`
(type-specific settings), `required` / `disabled` (`true` or `{ when }`),
`visibility` (`{ action: 'show' | 'hide', when }`), `validators`, `calc`,
`setValue` and `layout`. A condition is either a rule `{ ref, op, value?, value2? }`
(`ref` is an element id; `value` is `{ const }`, `{ ref }` or `{ today: days }`)
or a group `{ match: 'all' | 'any' | 'none', conditions }`.

## Reference

Everything else the entry point exports, for apps that work with the JSON directly.

- **Types**: `UiFormDefinition`, `UiFbPage`, `UiFbElement`, `UiFbField`, `UiFbGroup`,
  `UiFbStatic`, `UiFbFieldType`, `UiFbStaticType`, `UiFbFieldProps`, `UiFbOption`,
  `UiFbLayout`, `UiFbWidth`, `UiFbLabelPlacement`, `UiFbErrorPlacement`,
  `UiFbSettings`, `UiFbRepeat`, `UiFbJump`, `UiFbVisibility`, `UiFbToggle`,
  `UiFbCondition`, `UiFbConditionRule`, `UiFbConditionGroup`, `UiFbOperator`,
  `UiFbOperand`, `UiFbSetValue`, `UiFbValidatorRule`, `UiFbCalc`, `UiFbCalcArg`,
  `UiFbCalcOp`, `UiFbOptionSourceRef`, `UiFbSourceParamValue`, `UiFbFileValue`,
  `UiFormSubmission`, `UiFbChange`; `UI_FB_SCHEMA_VERSION`.
- **Creating and editing definitions**: `createDefinition`, `createPage`,
  `createField`, `createGroup`, `createStatic`, `fbUid`, `fbSlug`, `fbKeyValid`,
  `uniqueKey`, `renameKey`, `insertElement`, `moveElement`, `canDrop`, `isInside`,
  `removeElement`, `duplicateElement`, `updateElement`, `updatePage`
  (`UiFbDropTarget`). All return a new definition.
- **Reading definitions**: `indexDefinition` (`UiFbIndex`, `UiFbIndexEntry`),
  `allElements`, `allFields`, `elementName`, `subtreeIds`, `conditionRefs`,
  `calcRefs`, `sourceRefs`, `referencesTo`, `externalReferences`,
  `removeReferences` (`UiFbReference`, `UiFbRefKind`), `dependencyGraph`,
  `findCycles`.
- **Versions**: `migrateDefinition`, `lintDefinition` (`UiFbProblem`),
  `diffDefinitions` (`UiFbDiff`).
- **Field types and operators**: `UI_FB_FIELD_TYPES`, `UI_FB_STATIC_TYPES`,
  `fieldTypeInfo`, `valueKindOf`, `typesCompatible`, `operatorInfo`, `operatorsFor`
  (`UiFbFieldTypeInfo`, `UiFbStaticTypeInfo`, `UiFbValueKind`, `UiFbPaletteCategory`,
  `UiFbOperatorInfo`).
- **Conditions**: `evaluateCondition`, `describeCondition`, `conditionComplete`,
  `resolveOperand`, `isEmptyValue`, `isoDate`, `addDays` (`UiFbConditionContext`,
  `UiFbDescribeContext`).
- **Calculations**: `UI_FB_CALC_OPS`, `calcOpInfo`, `evaluateCalc`, `describeCalc`
  (`UiFbCalcOpInfo`, `UiFbCalcContext`).
- **Checks**: `UI_FB_BUILTIN_VALIDATORS`, `UI_FB_IMPLICIT_VALIDATOR`,
  `UI_FB_PATTERN_PRESETS`, `UI_FB_VALIDATORS` (the token behind
  `provideUiFormValidators`), `validatorsFor`, `formatMessage`, `comparisonWords`,
  `resolveDateParam`, `describeDateParam`, `todayIso` (`UiFbValidatorDef`,
  `UiFbValidatorContext`, `UiFbValidatorResult`, `UiFbParamSpec`).
- **Option sources**: `UI_FB_OPTION_SOURCES` (token), `UI_FB_SOURCE_FIELD_TYPES`,
  `isChoice`, `toChoice`, `optionValueOf`, `sourceHasMore` (`UiFbOptionSourceDef`,
  `UiFbSourceQuery`, `UiFbSourcePage`, `UiFbSourceItem`, `UiFbSourceParamSpec`,
  `UiFbChoice`).
- **HTTP sources and settings**: `UI_FB_HTTP_SOURCES` (token), `httpOptionSource`,
  `sourceFetch`, `sourceUrl`, `readSourceReply`, `readPath`, `fillPattern`,
  `originOf`, `originAllowed`, `createGlobalSettings`, `sourcesFromSettings`
  (`UiFbHttpSourceConfig`, `UiFbHttpSourcesOptions`, `UiFbSourceFetch`,
  `UiFormGlobalSettings`).
- **Engine**: `UiFormEngine`, `coerceValue`, `requiredMessage`, `addrOf`
  (`UiFormEngineOptions`, `UiFormMode`, `UiFbInstance`, `UiFbInstanceState`,
  `UiFbErrorItem`, `UiFbRemovedRow`).
- **Showing answers**: `formatValue`, `optionLabel`, `formatDate`; `UiFbUploader`.
