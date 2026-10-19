import { JsonPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiSwitch } from '@zouriel/ui/form';
import {
  UiFormBuilder,
  UiFormRenderer,
  provideUiFormHttpSources,
  provideUiFormOptionSources,
  UiFormGlobalSettingsEditor,
  type UiFormGlobalSettings,
  provideUiFormValidators,
  type UiFbValidatorDef,
  type UiFormDefinition,
  type UiFormMode,
  type UiFormSubmission,
} from '@zouriel/ui/form-builder';
import { DEMO_SOURCES } from './form-builder.sources';
import { demoSettings } from './form-studio.store';
import { DocApi, DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';
import { SAMPLE_ANSWERS, SAMPLE_FORM } from './form-builder.sample';

/** An app check, the way a host registers one: it appears in the builder's "Add a check" list. */
const STUDENT_ID: UiFbValidatorDef = {
  type: 'studentIdExists',
  label: 'Student ID exists',
  description: 'Looks the ID up in the student records',
  valueKinds: ['text'],
  defaultMessage: 'We couldn’t find that student ID.',
  validate: (v) => new Promise((resolve) => setTimeout(() => resolve(/^S\d{6}$/i.test(String(v)) || 'We couldn’t find that student ID. IDs look like S123456.'), 500)),
};

@Component({
  selector: 'page-form-builder',
  imports: [JsonPipe, FormsModule, RouterLink, UiButton, UiSegmented, UiSwitch, UiFormBuilder, UiFormRenderer, UiFormGlobalSettingsEditor, DocApi, DocPage, DocSection, DocDemo],
  providers: [provideUiFormValidators(STUDENT_ID), provideUiFormOptionSources(...DEMO_SOURCES), provideUiFormHttpSources({ allowedOrigins: ['https://dummyjson.com'] })],
  template: `
    <doc-page eyebrow="Flagship" title="Form builder"
      lead="Admin staff build forms by dragging fields onto a page, then add rules in plain words: show a question only when another answer says so, require it under a condition, group questions into sections that depend on other sections, repeat a section, split the form into steps. Dropdowns can search lists from your API. The form and every answer are plain JSON.">

      <aside class="studio-cta">
        <div>
          <strong>Three components</strong>
          <p><code translate="no">ui-form-builder</code> is the admin screen where a form is made. <code translate="no">ui-form-renderer</code> is what people fill in, and what staff use to view or correct saved answers. <code translate="no">ui-form-global-settings</code> is for your app’s settings page: the lists every form can search, and new-form defaults. Your app stores the JSON in between. All of them come from <code translate="no">&#64;zouriel/ui/form-builder</code>.</p>
        </div>
        <ui-button routerLink="/form-studio">Open the form studio</ui-button>
      </aside>

      <doc-section name="Integrating it" selector="JSON in, JSON out"
        summary="Your app stores three kinds of JSON: forms (UiFormDefinition, made by the builder), answers (a plain object per submission, made by the renderer) and app-wide settings (UiFormGlobalSettings). The components never call your server, except option sources through hooks you provide. These six steps are the whole integration; the form studio does exactly this with localStorage.">
        <doc-demo lang="ts" [code]="integration">
          <ol class="steps">
            <li><strong>Load.</strong> New forms come from <code>createDefinition(title, settings.defaults)</code>. Stored ones go through <code>migrateDefinition(json)</code>, which fills in defaults and upgrades older versions.</li>
            <li><strong>Build.</strong> Bind <code>[(definition)]</code> on ui-form-builder and save it when it changes or on your Save button.</li>
            <li><strong>Publish.</strong> Check <code>problems()</code> for errors, bump <code>revision</code>, store a copy as the published version, and pass it back as <code>published</code> with its answer count, so the builder protects saved answers.</li>
            <li><strong>Fill in.</strong> Give ui-form-renderer the published version. <code>(submitted)</code> emits <code>&#123; formId, revision, data, submittedAt, files &#125;</code>; store <code>data</code> with <code>revision</code>.</li>
            <li><strong>Edit or view.</strong> Pass the stored <code>data</code> back. It opens in edit mode with a change list (or <code>mode="view"</code> for read-only text). Unknown keys and old answers are kept.</li>
            <li><strong>Share lists.</strong> Store the JSON from ui-form-global-settings and pass it to both components as <code>globalSettings</code>. Answers from searchable lists are saved as <code>&#123; value, label &#125;</code>.</li>
          </ol>
        </doc-demo>
      </doc-section>

      <doc-section name="Builder" selector="ui-form-builder" [api]="builderApi"
        summary="Add a field by clicking it in the palette (it goes after the selection) or dragging it onto the page; narrower than 1100px the palette moves behind an Add button, and on phones into a bottom sheet. Select a card to get its toolbar (settings, move, duplicate, delete, more); double-click, press Enter or hold it on a touch screen to open its settings. On a focused card, Alt+Up/Down moves it, Ctrl/Cmd+D duplicates it and Delete removes it. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo and redo. Pages have a ⋯ menu to move or delete them. Logic lists every rule in plain words and anything to fix; Preview fills the form in at desktop or phone width. Pass the published version and its answer count so the builder protects saved answers: it archives instead of deleting, locks stored option values and remembers renamed keys. It lays itself out by its own width, so give it a height.">
        <div class="builder-frame">
          <ui-form-builder #builder [(definition)]="form" [globalSettings]="globalSettings()" [published]="published()" [submissionCount]="answered() ? 12 : 0">
            <div fbActions class="actions">
              <ui-button size="sm" (click)="publish()">{{ published() ? 'Publish changes' : 'Publish' }}</ui-button>
            </div>
          </ui-form-builder>
        </div>
        <div class="under">
          <ui-switch [ngModel]="answered()" (ngModelChange)="answered.set($event)" [disabled]="!published()">Pretend the published form has 12 answers</ui-switch>
          @if (publishNote()) { <span class="note" role="status">{{ publishNote() }}</span> }
        </div>
        <doc-demo [code]="builderCode"></doc-demo>
      </doc-section>

      <doc-section name="Renderer" selector="ui-form-renderer" [api]="rendererApi" [outputs]="rendererOutputs"
        summary="Fills in a definition. Problems show when a question is left (or only on Continue, per form), and all of a page’s problems are listed at the top, with links, when someone tries to move on. Hidden questions never block submitting. Give it saved data to edit (it tracks dirty() and lists the changes next to Save) or to view, where every page shows at once as text. It emits JSON ready to store.">
        <doc-demo code="<ui-form-renderer [definition]=&quot;form&quot; (submitted)=&quot;save($event)&quot; />
<ui-form-renderer [definition]=&quot;form&quot; [data]=&quot;saved&quot; (submitted)=&quot;update($event.data)&quot; />
<ui-form-renderer [definition]=&quot;form&quot; [data]=&quot;saved&quot; mode=&quot;view&quot; />">
          <div class="bar">
            <ui-segmented [options]="modes" [value]="mode()" (valueChange)="mode.set($any($event))" label="Mode" size="sm" />
          </div>
          <div class="frame">
            <ui-form-renderer [definition]="form" [data]="mode() === 'create' ? null : answers" [mode]="mode()" (submitted)="last.set($event)" />
          </div>
          @if (last(); as s) { <pre class="out" tabindex="0" aria-label="Submitted JSON">{{ s | json }}</pre> }
        </doc-demo>
      </doc-section>

      <doc-section name="App checks" selector="provideUiFormValidators" [api]="validatorApi" apiTitle="UiFbValidatorDef"
        summary="Register checks your app knows how to run (sync or async). They show up in the builder's “Add a check” list and run in the renderer. This page registers “Student ID exists”: add it to a short text field and try S123456."
        [shapes]="validatorShape">
        <doc-demo lang="ts" code="providers: [provideUiFormValidators({
  type: 'studentIdExists',
  label: 'Student ID exists',
  valueKinds: ['text'],
  defaultMessage: 'We couldn’t find that student ID.',
  validate: (value, params, ctx) => api.studentExists(value, ctx.signal),   // true, false, or a message
})]">
          <p class="plain">Checks get the answer, their settings, and a context with other answers and an AbortSignal. Slow checks show “Checking…” and block submitting until they finish. Both components also take a <code>validators</code> input for checks you don’t register app-wide.</p>
        </doc-demo>
      </doc-section>

      <doc-section name="Option sources" selector="provideUiFormOptionSources" [api]="sourceApi" apiTitle="UiFbOptionSourceDef"
        summary="Lists that live in your app, usually behind a paginated, searchable API: students, courses, countries. Register them and they appear in the builder as a data source for dropdowns and multi-selects (Options → Data source). The renderer searches as people type and loads more as they scroll. Each setting can be a fixed value or another question’s answer, so lists can depend on each other; when that answer changes, the dependent answer is cleared. Answers are saved as { value, label }, so they stay readable if the record is renamed later."
        [shapes]="sourceShape">
        <doc-demo lang="ts" code="providers: [provideUiFormOptionSources({
  type: 'courses',
  label: 'Courses',
  params: [{ key: 'programme', label: 'Programme', kind: 'select', options: programmes, required: true }],
  pageSize: 20,
  search: ({ query, page, pageSize, params, signal }) =>
    api.courses({ q: query, page, size: pageSize, programme: params['programme'] }, signal),
    // → { items: [{ value, label, description? }], hasMore }   (or total)
})]">
          <p class="plain">This page registers two demo lists, “Students” (600, searchable by name or ID) and “Courses” (follows the Programme answer). The sample form uses them for “Your student record” on page 1 and “Courses you’ll take” on page 3. Rules on these questions search the same list.</p>
        </doc-demo>
      </doc-section>

      <doc-section name="Global settings" selector="ui-form-global-settings" [api]="globalApi"
        summary="For the app’s settings page: admins set up the lists every form can search (address, how it searches and pages, which fields are the value and label) and test them on the spot, plus what new forms start with. Lists registered in code show read-only. It saves plain JSON; pass it to ui-form-builder and ui-form-renderer as globalSettings. Requests go through provideUiFormHttpSources, where the app adds its login and lists the servers it allows, so no keys are stored in settings."
        [shapes]="globalShape">
        <doc-demo lang="ts + html" code="<ui-form-global-settings [(settings)]=&quot;settings&quot; [usage]=&quot;{ people: 2 }&quot; />
<ui-form-builder [(definition)]=&quot;form&quot; [globalSettings]=&quot;settings()&quot; />

providers: [provideUiFormHttpSources({
  allowedOrigins: ['https://api.example.com'],
  fetch: (url, { signal }) => myHttp.getJson(url, { signal }),   // adds the session or token
})]">
          <div class="gs-frame"><ui-form-global-settings [(settings)]="globalSettings" /></div>
        </doc-demo>
      </doc-section>

      <doc-section name="Running a form without UI" selector="UiFormEngine" [api]="engineApi" apiTitle="Members"
        summary="The engine ui-form-renderer runs: rules, checks, calculations and data shaping as signals, with no DOM. Use it to work out answers in a test, pre-fill a form in code, or drive your own UI. It needs an Angular Injector because it uses effects; the renderer’s engine() gives you the one it is running.">
        <doc-demo lang="ts" code="const engine = new UiFormEngine({ definition, data: saved, injector });
engine.setValue('f_name', null, 'Aminath');   // element id, repeat entry (null outside repeats), answer
engine.instanceState('f_inst', null).visible;  // what the rules say right now
const submission = engine.submit();             // null when something is wrong (errors are then shown)
engine.destroy();" />
      </doc-section>

      <doc-section name="JSON format" selector="UiFormDefinition" summary="What the builder saves and the renderer reads. Every element has an id that never changes; fields also have a key, the name their answer is saved under. Rules refer to ids, never labels or keys, so renaming never breaks them. A renamed key is remembered in keyHistory so answers saved under the old name still load." [shapes]="definitionShape">
        <doc-demo>
          <p class="plain">The form in the builder above, as it would be stored. It updates as you edit.</p>
          <pre class="out tall" tabindex="0" aria-label="Form JSON">{{ formJson() }}</pre>
        </doc-demo>
      </doc-section>

      <doc-section name="Reference" selector="@zouriel/ui/form-builder"
        summary="Everything else the entry point exports, for apps that read or change form JSON in code. Functions that change a definition return a new one and never mutate their input.">
        @for (g of reference; track g.title) { <doc-api [title]="g.title" [rows]="g.rows" /> }
      </doc-section>
    </doc-page>
  `,
  styles: `
    /* The builder wants more room than the docs column: let it break out sideways (no transform, so its drag overlays stay put). */
    .builder-frame { --w: min(1480px, calc(100vw - 360px)); width: var(--w); margin-left: min(0px, calc((100% - var(--w)) / 2));
      height: 800px; max-height: calc(100dvh - 120px); min-height: 560px; }
    .builder-frame ui-form-builder { height: 100%; }
    .actions { margin-left: var(--ui-space-2); }
    .studio-cta { display: flex; align-items: center; gap: var(--ui-space-4); flex-wrap: wrap; margin-bottom: var(--ui-space-6); padding: var(--ui-space-4);
      border: 1px solid color-mix(in srgb, var(--ui-color-primary) 35%, var(--ui-color-border)); border-radius: var(--ui-radius);
      background: color-mix(in srgb, var(--ui-color-primary) 6%, var(--ui-color-surface)); }
    .studio-cta div { flex: 1; min-width: 260px; }
    .studio-cta p { margin: 4px 0 0; font-size: 14px; line-height: 1.5; color: var(--ui-color-text-secondary); max-width: 70ch; }
    .under { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-3); margin: var(--ui-space-3) 0; font-size: 13px; }
    .note { color: var(--ui-color-text-muted); }
    .bar { display: flex; gap: var(--ui-space-2); margin-bottom: var(--ui-space-3); }
    .frame { max-width: 720px; width: 100%; text-align: left; }
    .out { max-height: 260px; overflow: auto; font-size: 12px; text-align: left; width: 100%; margin: 0; }
    .out.tall { max-height: 420px; }
    .out:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .gs-frame { width: 100%; text-align: left; }
    .plain { margin: 0; color: var(--ui-color-text-secondary); font-size: 14px; max-width: 70ch; text-align: left; }
    .steps { margin: 0; padding-left: var(--ui-space-6); display: flex; flex-direction: column; gap: var(--ui-space-2);
      color: var(--ui-color-text-secondary); font-size: 14px; line-height: 1.55; max-width: 76ch; }
    .steps strong { color: var(--ui-color-text); }
    @media (max-width: 900px) { .builder-frame { --w: 100%; margin-left: 0; } }
    @media (max-width: 720px) { .builder-frame { width: auto; height: calc(100dvh - 120px); min-height: 520px; margin: 0 calc(-1 * var(--ui-space-4)); } }
  `,
})
export class FormBuilderPage {
  protected readonly builder = viewChild(UiFormBuilder);
  protected form: UiFormDefinition = structuredClone(SAMPLE_FORM);
  protected readonly answers = SAMPLE_ANSWERS;
  protected readonly published = signal<UiFormDefinition | null>(null);
  protected readonly answered = signal(false);
  protected readonly publishNote = signal('');
  protected readonly mode = signal<UiFormMode>('create');
  protected readonly last = signal<UiFormSubmission | null>(null);
  protected readonly modes = [
    { value: 'create', label: 'New answers' },
    { value: 'edit', label: 'Edit saved' },
    { value: 'view', label: 'View saved' },
  ];
  private readonly tick = signal(0);
  protected readonly formJson = computed(() => (this.tick(), JSON.stringify(this.form, null, 2)));

  constructor() {
    // The builder writes to a plain field here, so poll it for the JSON panel (and stop when the page goes).
    const timer = setInterval(() => this.tick.update((n) => n + 1), 1500);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected publish(): void {
    const problems = this.builder()?.problems().filter((p) => p.severity === 'error') ?? [];
    if (problems.length) {
      this.publishNote.set(`Fix ${problems.length} problem${problems.length > 1 ? 's' : ''} first (see Logic).`);
      return;
    }
    const changes = this.builder()?.changes()?.summary.length ?? 0;
    this.form = { ...this.form, revision: (this.form.revision ?? 0) + 1 };
    this.published.set(structuredClone(this.form));
    this.publishNote.set(`Published revision ${this.form.revision}${changes ? ` with ${changes} change${changes > 1 ? 's' : ''}` : ''}.`);
  }

  protected readonly integration = `import { createDefinition, migrateDefinition, type UiFormDefinition, type UiFormSubmission } from '@zouriel/ui/form-builder';

// 1. Load
form = signal<UiFormDefinition>(migrateDefinition(await api.getForm(id)));   // or createDefinition('New form', settings.defaults)

// 3. Publish (template: <ui-form-builder #builder [(definition)]="form" [published]="live()" [submissionCount]="count()">)
publish() {
  if (this.builder().problems().some((p) => p.severity === 'error')) return;   // listed under Logic
  const next = { ...this.form(), revision: (this.live()?.revision ?? 0) + 1 };
  this.form.set(next);
  this.live.set(structuredClone(next));
  api.publish(next);
}

// 4. Fill in (template: <ui-form-renderer [definition]="live()" (submitted)="save($event)">)
save(s: UiFormSubmission) {
  api.saveAnswers({ formId: s.formId, revision: s.revision, data: s.data });
}

// 5. Edit (template: <ui-form-renderer [definition]="live()" [data]="answer.data" (submitted)="update(answer.id, $event)">)
update(id: string, s: UiFormSubmission) {
  api.updateAnswers(id, { revision: s.revision, data: s.data });
}`;

  protected readonly builderCode = `<ui-form-builder [(definition)]="form" [published]="live" [submissionCount]="answerCount"
  [globalSettings]="settings">
  <ui-button fbActions (click)="publish()">Publish</ui-button>
</ui-form-builder>`;

  protected readonly builderApi: ApiRow[] = [
    { name: 'definition', type: 'UiFormDefinition', default: 'createDefinition()', desc: 'Two-way (`[(definition)]`). The form being built; every edit writes back. Setting another form (a different id) or different content loads it and clears undo history; the same form handed back with only `revision` changed, as when a published copy is stored back, keeps it.' },
    { name: 'published', type: 'UiFormDefinition | null', default: 'null', desc: 'The version people answer now. Drives the unpublished-changes list and answer protection.' },
    { name: 'submissionCount', type: 'number', default: '0', desc: 'Answers the published version has. Above zero: archive instead of delete, lock saved option values, remember renamed keys, only allow similar type changes.' },
    { name: 'validators', type: 'readonly UiFbValidatorDef[]', default: '[]', desc: 'Extra app checks for the “Add a check” list, on top of provideUiFormValidators.' },
    { name: 'optionSources', type: 'readonly UiFbOptionSourceDef[]', default: '[]', desc: 'Extra searchable lists for Options → Data source, on top of provideUiFormOptionSources.' },
    { name: 'globalSettings', type: 'UiFormGlobalSettings | null', default: 'null', desc: 'App-wide settings from ui-form-global-settings; their lists become data sources.' },
    { name: 'showTitle', type: 'boolean', default: 'true', desc: 'Show the form title in the top bar. Turn off when your own header already names the form.' },
    { name: '[fbActions]', type: 'slot', default: '—', desc: 'Your buttons (Save, Publish) in the builder’s top bar.' },
    { name: 'problems()', type: 'method', default: '—', desc: 'Signal of UiFbProblem[] ({ severity, targetId, message }): missing keys, loops between rules, rules pointing at deleted questions, backward jumps. Check for errors before publishing.' },
    { name: 'changes()', type: 'method', default: '—', desc: 'Signal of UiFbDiff | null: what changed since published (added, archived, renamed keys, type changes, removed options, changed rules, and summary lines).' },
    { name: 'select(id)', type: 'method', default: '—', desc: 'Selects a question, section or page and shows its settings; null selects the form itself.' },
    { name: 'undo() / redo()', type: 'method', default: '—', desc: 'Step through the edit history. The current `revision` is kept.' },
    { name: 'clearHistory()', type: 'method', default: '—', desc: 'Forget the undo/redo history, e.g. after saving when you want a fresh start.' },
  ];

  protected readonly rendererApi: ApiRow[] = [
    { name: 'definition', type: 'UiFormDefinition (required)', default: '—', desc: 'The form to fill in. Usually the published version.' },
    { name: 'data', type: 'Record<string, unknown> | null', default: 'null', desc: 'Saved answers to edit or view. Unknown keys and answers to questions hidden at the time are kept.' },
    { name: 'mode', type: "'create' | 'edit' | 'view' | null", default: 'edit with data, else create', desc: 'Edit labels the button “Save changes” and lists changes. View shows every page at once as text and never validates.' },
    { name: 'validators', type: 'readonly UiFbValidatorDef[]', default: '[]', desc: 'Extra app checks, on top of provideUiFormValidators.' },
    { name: 'optionSources', type: 'readonly UiFbOptionSourceDef[]', default: '[]', desc: 'Extra lists, on top of provideUiFormOptionSources. Use the same ones the builder had.' },
    { name: 'globalSettings', type: 'UiFormGlobalSettings | null', default: 'null', desc: 'Makes the lists from ui-form-global-settings searchable.' },
    { name: 'uploader', type: 'UiFbUploader | null', default: 'null', desc: '(file, field) => Promise<UiFbFileValue>: uploads files as they are picked. Without it, the File objects come back in submission.files.' },
    { name: 'submitLabel', type: 'string | null', default: 'null', desc: 'Last button’s text. Otherwise the form’s setting, then “Submit” (“Save changes” in edit mode).' },
    { name: 'cancelLabel', type: 'string | null', default: 'null', desc: 'Shows a Cancel button with this text.' },
    { name: 'busy', type: 'boolean', default: 'false', desc: 'Shows the submit button as busy while you save.' },
    { name: 'showTitle', type: 'boolean', default: 'true', desc: 'Show the form’s title and description.' },
    { name: 'showActions', type: 'boolean', default: 'true', desc: 'Show the buttons. Turn off to drive it with your own (submit()).' },
    { name: 'today', type: '(() => string) | null', default: 'null', desc: 'Fixes today (YYYY-MM-DD) for date rules and ages, e.g. for forms filled in on behalf of a past date.' },
    { name: 'submit()', type: 'method', default: '—', desc: 'Checks every page on the route; emits and returns the submission, or returns null and shows the problems.' },
    { name: 'reset()', type: 'method', default: '—', desc: 'Starts over from the data the form was given (or blank), on the first page.' },
    { name: 'engine()', type: 'method', default: '—', desc: 'Signal of the running UiFormEngine: data(), dirty(), changes() and the rest (see below).' },
  ];
  protected readonly rendererOutputs: ApiRow[] = [
    { name: 'submitted', type: 'UiFormSubmission', default: '—', desc: '{ formId, revision, data, submittedAt, files } once everything on the route is valid.' },
    { name: 'valueChange', type: 'Record<string, unknown>', default: '—', desc: 'The data as it would be saved, after every change.' },
    { name: 'dirtyChange', type: 'boolean', default: '—', desc: 'Whether the answers differ from what the form opened with.' },
    { name: 'cancelled', type: 'void', default: '—', desc: 'The Cancel button was pressed.' },
  ];
  protected readonly validatorApi: ApiRow[] = [
    { name: 'type', type: 'string', default: '—', desc: 'Stored in the form JSON. Keep it stable.' },
    { name: 'label / description', type: 'string', default: '—', desc: 'What admins see in the “Add a check” list.' },
    { name: 'valueKinds', type: 'UiFbValueKind[]', default: 'every field', desc: "Which answers it is offered for: 'text', 'number', 'date', 'time', 'choice', 'multi', 'boolean', 'file'." },
    { name: 'fieldTypes', type: 'UiFbFieldType[]', default: '—', desc: 'Narrower than valueKinds: only these field types.' },
    { name: 'params', type: 'UiFbParamSpec[]', default: '[]', desc: "Settings admins fill in: { key, label, kind: 'number' | 'text' | 'date' | 'field' | 'select', options?, hint?, default? }." },
    { name: 'defaultMessage', type: 'string', default: '—', desc: 'Supports {label} and {paramKey}. Admins can override it per field.' },
    { name: 'validate', type: '(value, params, ctx) => result | Promise<result>', default: '—', desc: 'true, null or undefined passes; false fails with the message; a string fails with that text.' },
    { name: 'debounceMs', type: 'number', default: '400 for async', desc: 'Pause after typing before the check runs.' },
    { name: 'runWhenEmpty', type: 'boolean', default: 'false', desc: 'Also run on empty answers (checks normally leave those to “required”).' },
  ];
  protected readonly globalSettings = signal<UiFormGlobalSettings>(demoSettings());
  protected readonly globalApi: ApiRow[] = [
    { name: 'settings', type: 'UiFormGlobalSettings', default: 'createGlobalSettings()', desc: 'Two-way (`[(settings)]`). The lists and new-form defaults, as JSON to store.' },
    { name: 'usage', type: 'Record<string, number>', default: '{}', desc: 'How many forms use each list type; deleting or re-keying a used list asks first.' },
    { name: 'provideUiFormHttpSources(options)', type: 'provider', default: '—', desc: '{ fetch?, allowedOrigins? }: how requests are made (add the login here) and which origins lists may call. Without it: fetch with same-origin cookies, this app’s origin only.' },
    { name: 'createDefinition(title, settings.defaults)', type: 'function', default: '—', desc: 'Starts a new form with the defaults. Existing forms are not changed.' },
  ];
  protected readonly globalShape = `interface UiFormGlobalSettings {
  version: 1;
  sources?: UiFbHttpSourceConfig[];   // lists set up here
  defaults?: UiFbSettings;            // what new forms start with
}

interface UiFbHttpSourceConfig {
  type: string; label: string; description?: string;
  url: string;                        // e.g. https://api.example.com/students
  searchParam?: string;               // default 'q'
  paging?: 'page' | 'offset';         // default 'page'
  pageParam?: string; firstPage?: 0 | 1; pageSizeParam?: string; pageSize?: number;
  itemsPath?: string;                 // where the list is in the reply ('data.items')
  valueField: string;                 // saved
  labelField: string;                 // shown; a field or '{firstName} {lastName}'
  descriptionField?: string; totalPath?: string; hasMorePath?: string;
  minQueryLength?: number;
  params?: UiFbSourceParamSpec[];     // per-question settings, sent as query settings
}`;
  protected readonly sourceApi: ApiRow[] = [
    { name: 'type', type: 'string', default: '—', desc: 'Stored in the form JSON. Keep it stable.' },
    { name: 'label / description', type: 'string', default: '—', desc: 'What admins see when picking a data source.' },
    { name: 'params', type: 'UiFbSourceParamSpec[]', default: '[]', desc: "Settings admins fill in: { key, label, kind?: 'text' | 'number' | 'select', options?, hint?, placeholder?, required? }. Each can also be another question’s answer. Searching waits for required ones." },
    { name: 'search(query)', type: '(q: UiFbSourceQuery) => UiFbSourcePage | Promise<…>', default: '—', desc: 'Gets { query, page (from 1), pageSize, params, signal }; returns { items, hasMore?, total? }. Pass signal to fetch so stale searches are cancelled.' },
    { name: 'pageSize', type: 'number', default: '20', desc: 'Results per page.' },
    { name: 'minQueryLength', type: 'number', default: '0', desc: 'Characters needed before searching (for huge lists).' },
    { name: 'debounceMs', type: 'number', default: '250', desc: 'Pause after typing before searching.' },
  ];
  protected readonly sourceShape = `// A sourced field in the form JSON
{ kind: 'field', type: 'multiselect', key: 'courses', label: 'Courses you’ll take',
  source: { type: 'courses', params: { programme: { ref: 'f_prog' } } } }   // or { const: 'health' }

// Its answer: the value, and the label it had when picked
"courses": [{ "value": "health-1", "label": "Anatomy" }]

interface UiFbSourceItem { value: string | number; label: string; description?: string }
interface UiFbSourcePage { items: UiFbSourceItem[]; hasMore?: boolean; total?: number }`;
  protected readonly validatorShape = `interface UiFbValidatorContext {
  field: UiFbField;
  value(ref: string): unknown;   // another answer (same repeat entry when shared)
  label(ref: string): string;
  today(): string;               // YYYY-MM-DD
  signal?: AbortSignal;          // aborted when the answer changes again
}`;
  protected readonly engineApi: ApiRow[] = [
    { name: 'new UiFormEngine(options)', type: 'UiFormEngineOptions', default: '—', desc: '{ definition, injector, data?, mode?, validators?, optionSources?, today? }. Built-in checks are always included.' },
    { name: 'data() / dirty() / changes()', type: 'method', default: '—', desc: 'Signals: the answers as they would be saved; whether they differ from data; the differences as UiFbChange[] ({ path, label, from, to }).' },
    { name: 'setValue(id, row, value)', type: 'method', default: '—', desc: 'Sets an answer. row is the repeat entry id from rows(groupId), or null.' },
    { name: 'instanceState(id, row)', type: 'method', default: '—', desc: 'UiFbInstanceState: { visible, disabled, required, value, errors, warnings, pending }.' },
    { name: 'rows / addRow / removeRow / restoreRow / moveRow', type: 'method', default: '—', desc: 'Entries of a repeating section. removeRow returns what restoreRow needs to put it back.' },
    { name: 'page() / pageIndex / path() / isLastPage()', type: 'method', default: '—', desc: 'Where the person is; path() is the route through the pages after rules and jumps.' },
    { name: 'next() / back() / goTo(i)', type: 'method', default: '—', desc: 'Move between pages. next() returns false and shows problems when the page has errors.' },
    { name: 'pageErrors(i)', type: 'method', default: '—', desc: 'UiFbErrorItem[] for a page ({ addr, id, row, label, message }).' },
    { name: 'submit()', type: 'method', default: '—', desc: 'UiFormSubmission, or null (it then moves to the first page with problems).' },
    { name: 'destroy()', type: 'method', default: '—', desc: 'Stops its effects and pending checks.' },
  ];
  protected readonly definitionShape = `interface UiFormDefinition {
  schemaVersion: number;   // UI_FB_SCHEMA_VERSION (1)
  id: string; title: string; description?: string;
  revision?: number;       // bump when you publish; recorded on each submission
  settings?: UiFbSettings;
  pages: UiFbPage[];
}
interface UiFbSettings {
  labelPlacement?: 'top' | 'inside' | 'left' | 'hidden';   errorPlacement?: 'below' | 'inside';
  validateOn?: 'blur' | 'submit';                          clearHidden?: 'onSubmit' | 'never';
  errorSummary?: boolean;   requiredMarker?: 'asterisk' | 'optional' | 'none';
  submitLabel?: string; nextLabel?: string; backLabel?: string; showProgress?: boolean;
}
interface UiFbPage {
  id: string; title?: string; description?: string;
  visibility?: UiFbVisibility;
  jumps?: { id: string; when: UiFbCondition; to: string }[];   // to: a later page id, or 'end'
  elements: UiFbElement[];
}
type UiFbElement = UiFbField | UiFbGroup | UiFbStatic;
interface UiFbField {
  kind: 'field'; id: string; type: UiFbFieldType; key: string; keyHistory?: string[];
  label: string; help?: string; placeholder?: string; defaultValue?: unknown;
  readOnly?: boolean; required?: UiFbToggle; requiredMessage?: string; disabled?: UiFbToggle;
  visibility?: UiFbVisibility;
  options?: { id: string; value: string; label: string; archived?: boolean }[];
  source?: { type: string; params?: Record<string, { const: unknown } | { ref: string }> };
  props?: UiFbFieldProps;   // min, max, step, decimals, currency, rows, maxRating, accept, multiple, caption, format, …
  validators?: { id: string; type: string; params?: Record<string, unknown>; message?: string;
                 when?: UiFbCondition; severity?: 'error' | 'warning' }[];
  calc?: UiFbCalc;          // { op, args: ({ ref } | { const } | { calc })[], decimals? }
  setValue?: { id: string; when: UiFbCondition; value: UiFbOperand }[];
  layout?: { width?: 'full' | 'two-thirds' | 'half' | 'third'; labelPlacement?; errorPlacement? };
  archived?: boolean;
}
interface UiFbGroup {
  kind: 'group'; id: string; title?: string; description?: string;
  key?: string; keyHistory?: string[];   // answers nest under key (required when it repeats)
  columns?: 1 | 2 | 3;
  repeat?: { min?: number; max?: number; addLabel?: string; itemLabel?: string };   // itemLabel: 'Entry {n}'
  visibility?: UiFbVisibility; disabled?: UiFbToggle; layout?: { width? };
  elements: UiFbElement[]; archived?: boolean;
}
interface UiFbStatic { kind: 'static'; id: string; type: 'heading' | 'paragraph' | 'divider'; text?: string; visibility?; layout?; archived?: boolean }

type UiFbFieldType = 'text' | 'textarea' | 'email' | 'phone' | 'url' | 'number' | 'currency' | 'date' | 'time'
  | 'select' | 'radio' | 'checkboxes' | 'multiselect' | 'checkbox' | 'toggle' | 'rating' | 'slider'
  | 'file' | 'hidden' | 'calculated';
type UiFbToggle = boolean | { when: UiFbCondition };
interface UiFbVisibility { action: 'show' | 'hide'; when: UiFbCondition }
type UiFbCondition = { match: 'all' | 'any' | 'none'; conditions: UiFbCondition[] }
                   | { ref: string; op: UiFbOperator; value?: UiFbOperand; value2?: UiFbOperand };   // ref: an element id
type UiFbOperand = { const: unknown } | { ref: string } | { today: number };   // today: days from today

// Answers (submission.data): keys are field keys. Text, dates ('YYYY-MM-DD') and times ('HH:mm') are strings;
// numbers are numbers; a choice is its option value; multiple choice is a list of values; yes/no is a boolean;
// files are UiFbFileValue[] ({ name, size, type, url?, id? }); option sources are { value, label } (or a list);
// a keyed section is an object; a repeating section is a list of objects.
interface UiFormSubmission {
  formId: string; revision: number | null; data: Record<string, unknown>;
  submittedAt: string; files: Record<string, File[]>;   // picked files with no uploader, by data path
}`;

  protected readonly reference: { title: string; rows: ApiRow[] }[] = [
    { title: 'Creating and editing definitions', rows: [
      { name: 'createDefinition(title?, defaults?)', type: 'UiFormDefinition', default: '—', desc: 'A new one-page form; defaults are copied into its settings.' },
      { name: 'createPage(title?) / createField(type, def?, label?) / createGroup(def?, repeat?) / createStatic(type)', type: 'element', default: '—', desc: 'New elements with fresh ids. Pass def so the field or section gets a key that is unique in it.' },
      { name: 'insertElement / moveElement / removeElement / duplicateElement', type: 'UiFormDefinition', default: '—', desc: 'Add, move, delete or copy an element at a UiFbDropTarget ({ containerId, index }); duplicateElement also returns the copy’s id.' },
      { name: 'updateElement(def, id, fn) / updatePage(def, id, fn)', type: 'UiFormDefinition', default: '—', desc: 'Replace one element or page with fn’s result.' },
      { name: 'canDrop(def, el, containerId) / isInside(def, containerId, id)', type: 'boolean', default: '—', desc: 'Whether an element may go into a page or section: a section can’t go inside itself, and repeating sections can’t nest.' },
      { name: 'renameKey(def, id, key) / uniqueKey(def, base, id) / fbSlug(label) / fbKeyValid(key) / fbUid(prefix)', type: 'various', default: '—', desc: 'Keys: rename (remembering the old one in keyHistory), make one unique in its scope, derive one from a label, check one. fbUid makes element ids.' },
    ] },
    { title: 'Reading and checking definitions', rows: [
      { name: 'migrateDefinition(raw)', type: 'UiFormDefinition', default: '—', desc: 'Use on every stored form: fills in ids, a first page and settings, and sets the current schemaVersion.' },
      { name: 'lintDefinition(def)', type: 'UiFbProblem[]', default: '—', desc: 'What the builder lists under Logic: missing, invalid or duplicate keys, choices without options, repeating sections without a key, rules pointing at deleted questions, backward jumps and loops (errors), plus warnings.' },
      { name: 'diffDefinitions(before, after)', type: 'UiFbDiff', default: '—', desc: 'What changed between two versions, with summary lines for a confirmation screen.' },
      { name: 'indexDefinition(def)', type: 'UiFbIndex', default: '—', desc: 'Map from id to UiFbIndexEntry: its page, parent, enclosing groups and repeat, data scope and order.' },
      { name: 'allElements(def) / allFields(def) / elementName(el, def?) / subtreeIds(def, id)', type: 'various', default: '—', desc: 'Walk the form; name an element the way the builder does.' },
      { name: 'referencesTo / externalReferences / removeReferences', type: 'UiFbReference[] / def', default: '—', desc: 'Which rules, calculations, jumps and sources mention an element (UiFbRefKind says how), and dropping them.' },
      { name: 'conditionRefs / calcRefs / sourceRefs / dependencyGraph / findCycles', type: 'various', default: '—', desc: 'The ids a rule, calculation or source depends on, and loops between them.' },
    ] },
    { title: 'Field types, rules and calculations', rows: [
      { name: 'UI_FB_FIELD_TYPES / UI_FB_STATIC_TYPES / fieldTypeInfo(type)', type: 'UiFbFieldTypeInfo', default: '—', desc: 'Every field type with its label, palette category, value kind and defaults.' },
      { name: 'valueKindOf(type, format?) / typesCompatible(a, b)', type: 'UiFbValueKind / boolean', default: '—', desc: 'The shape of a field’s answer, and whether a type change keeps saved answers meaningful.' },
      { name: 'operatorsFor(kind) / operatorInfo(op)', type: 'UiFbOperatorInfo', default: '—', desc: 'The comparisons offered for a kind of answer, section, repeat or page, and their wording.' },
      { name: 'evaluateCondition(c, ctx) / describeCondition(c, ctx) / conditionComplete(c)', type: 'boolean / string', default: '—', desc: 'Run a condition against a UiFbConditionContext, word it as a sentence, check every rule has what it needs.' },
      { name: 'resolveOperand / isEmptyValue / isoDate / addDays', type: 'various', default: '—', desc: 'Helpers the conditions use: an operand’s value, what counts as empty, YYYY-MM-DD dates.' },
      { name: 'UI_FB_CALC_OPS / calcOpInfo / evaluateCalc(c, ctx) / describeCalc(c, name)', type: 'various', default: '—', desc: 'Calculations: sum, subtract, multiply, divide, average, min, max, count, ageYears, daysBetween, concat.' },
    ] },
    { title: 'Checks', rows: [
      { name: 'UI_FB_BUILTIN_VALIDATORS', type: 'UiFbValidatorDef[]', default: '—', desc: 'The built-in checks (email, url, phone, lengths, words, pattern, min/max, integer, decimals, dates, ages, times, ticked counts, files, equalsField, compareField).' },
      { name: 'UI_FB_VALIDATORS / provideUiFormValidators(...defs)', type: 'token / provider', default: '—', desc: 'Register app checks (multi provider).' },
      { name: 'UI_FB_IMPLICIT_VALIDATOR / UI_FB_PATTERN_PRESETS', type: 'const', default: '—', desc: 'The check email, url and phone fields get automatically; the presets of “Allowed characters”.' },
      { name: 'validatorsFor(field, all) / formatMessage(template, vars)', type: 'various', default: '—', desc: 'The checks offered for a field; fill {label} and {param} into a message.' },
      { name: 'resolveDateParam / describeDateParam / comparisonWords / todayIso', type: 'various', default: '—', desc: 'Date settings that may be relative to today, and their wording.' },
    ] },
    { title: 'Option sources and settings', rows: [
      { name: 'UI_FB_OPTION_SOURCES / provideUiFormOptionSources(...defs)', type: 'token / provider', default: '—', desc: 'Register lists in code (multi provider).' },
      { name: 'UI_FB_SOURCE_FIELD_TYPES', type: "['select', 'multiselect']", default: '—', desc: 'The field types that can use a source.' },
      { name: 'isChoice / toChoice / optionValueOf / sourceHasMore', type: 'various', default: '—', desc: 'Read { value, label } answers, and tell whether a page of results has more after it.' },
      { name: 'UI_FB_HTTP_SOURCES / provideUiFormHttpSources(options)', type: 'token / provider', default: '—', desc: 'UiFbHttpSourcesOptions: { fetch?: UiFbSourceFetch, allowedOrigins? }.' },
      { name: 'httpOptionSource(config, options) / sourcesFromSettings(settings, options)', type: 'UiFbOptionSourceDef', default: '—', desc: 'Turn a UiFbHttpSourceConfig (or all of the settings’ lists) into an option source.' },
      { name: 'sourceUrl / readSourceReply / readPath / fillPattern / originOf / originAllowed / sourceFetch', type: 'various', default: '—', desc: 'How those lists build requests and read replies, and the origin check.' },
      { name: 'createGlobalSettings()', type: 'UiFormGlobalSettings', default: '—', desc: '{ version: 1, sources: [], defaults: {} }.' },
    ] },
    { title: 'Engine and answers', rows: [
      { name: 'UiFormEngine / UiFormEngineOptions / UiFormMode', type: 'class', default: '—', desc: 'See “Running a form without UI”.' },
      { name: 'UiFbInstance / UiFbInstanceState / UiFbErrorItem / UiFbRemovedRow / addrOf(id, row)', type: 'types', default: '—', desc: 'One rendered copy of an element (addr is id, or row/id inside a repeat entry) and its state.' },
      { name: 'coerceValue(field, value) / requiredMessage(field, label)', type: 'various', default: '—', desc: 'Normalise a stored answer to the field’s type; the default “is required” wording.' },
      { name: 'formatValue(field, value) / optionLabel(field, value) / formatDate(iso)', type: 'string', default: '—', desc: 'An answer as people read it: option labels, dates, money, Yes/No, file names.' },
      { name: 'UiFbUploader', type: '(file: File, field: UiFbField) => Promise<UiFbFileValue>', default: '—', desc: 'The renderer’s uploader input.' },
    ] },
  ];
}
