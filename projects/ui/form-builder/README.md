# `@zouriel/ui/form-builder`

A drag-and-drop form builder for admin staff, and the renderer that fills the
forms in. Forms and answers are plain JSON.

```ts
import { UiFormBuilder, UiFormRenderer, provideUiFormValidators } from '@zouriel/ui/form-builder';
```

## Building forms

```html
<ui-form-builder [(definition)]="form" [published]="live" [submissionCount]="answers">
  <ui-button fbActions (click)="save()">Save</ui-button>
</ui-form-builder>
```

- **Add** a field by clicking it in the palette (it goes after the selection) or by
  dragging it onto the page. On phones, tap **Add field** and pick from the sheet.
- **Move** by dragging the handle, with Alt+↑/↓ on a focused card, or with the
  card's move buttons and **More → Move to…** menu.
- **Select and edit**: tapping a card selects it and shows its toolbar (settings,
  move, duplicate, delete, more). Its settings open from the toolbar's settings
  button, a double-click, Enter, or holding the card on a touch screen. On wide
  screens they're always shown beside the canvas.
- **Pages** have a ⋯ menu on their heading: page settings, move earlier or later,
  and delete.
- **Sections** group questions, can use 2 or 3 columns, can **repeat** ("Add a
  dependant", min/max), and can keep their answers together under one key.
- **Pages** split the form into steps. Pages can be skipped by rules, and can
  **jump** forward when an answer says so.
- **Undo/redo** with the toolbar or Ctrl+Z / Ctrl+Shift+Z.
- **Logic** lists every rule in plain words, plus anything that needs fixing.
- **Preview** fills the form in at desktop or phone width, with the saved JSON
  alongside. Paste saved answers to try editing them.

The builder lays itself out by its own width: three panes from 1100px, two from
720px, and a single canvas with bottom sheets below that. Give it a height.

### Rules

Every rule is a sentence built from dropdowns: *Show this question only when
“Marital status” is Married*. Rules can be combined with all / any / none and
one level of groups, and they can ask about:

| Asked about | Comparisons |
| --- | --- |
| Text | is, is not, contains, starts/ends with, is filled in, is empty |
| Numbers | is, more/less than, at least/most, between |
| Dates and times | is, before, after, on or before/after, between; against a date, another answer, or *N days from today* |
| Single choice | is, is not, is any of, is none of |
| Multiple choice | includes, includes any/all of, at least/most *N* ticked |
| Yes/no | is ticked, is not ticked |
| Sections and pages | is shown, is hidden, is complete, is not complete |
| Repeating sections | has at least/most *N* entries |

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
  type: 'studentIdExists',
  label: 'Student ID exists',
  valueKinds: ['text'],
  defaultMessage: 'We couldn’t find that student ID.',
  validate: (value, params, ctx) => api.exists(value, { signal: ctx.signal }), // true, false or a message
})]
```

Registered checks appear in the builder's **Add a check** list and run in the
renderer. Async checks are debounced, show "Checking…", block submitting until
they finish, and are cancelled when the answer changes.

## Filling forms in

```html
<ui-form-renderer [definition]="form" [data]="saved" (submitted)="store($event)" />
```

`submitted` emits `{ formId, revision, data, submittedAt, files }`. `data` is
the JSON to save: keys are the fields' keys, sections with a key nest an object,
and repeating sections nest an array of objects.

- **Validation** follows "reward early, punish late". A field is checked when
  it's left, and once it shows an error it updates as you type. **Continue** and
  **Submit** check the whole page and list every problem at the top, with links
  to the fields.
- **Hidden questions** don't block submitting. Their answers are left out of the
  data (or kept, by form setting).
- **Editing saved answers**: pass `data`. The form tracks `dirty()` and lists
  `changes()` (from → to) next to Save. Keys it doesn't know about are kept. So are
  answers to questions that were already hidden when the form opened. Options that
  were removed still show, marked "no longer offered".
- **Viewing**: `mode="view"` shows answers as text.
- **Files**: pass `uploader` to upload as files are picked. Otherwise the picked
  `File`s come back in `submission.files`.

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

## The JSON

See `schema.ts`. In short:

```ts
interface UiFormDefinition {
  schemaVersion: 1; id: string; title: string; revision?: number;
  settings?: UiFbSettings;
  pages: { id; title?; visibility?; jumps?; elements: UiFbElement[] }[];
}
```

`migrateDefinition()` fills in defaults on load. `lintDefinition()` lists
problems, and `diffDefinitions()` compares two versions. `UiFormEngine` runs a
form without any UI (handy on a server or in tests).
