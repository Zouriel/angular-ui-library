import { JsonPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiSwitch } from '@zouriel/ui/form';
import {
  UiFormBuilder,
  UiFormRenderer,
  UiFormSummary,
  UiFbMemoryRevisionStore,
  fbCreateRevision,
  fbLocales,
  fbLocaleDir,
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
  imports: [JsonPipe, FormsModule, RouterLink, UiButton, UiSegmented, UiSwitch, UiFormBuilder, UiFormRenderer, UiFormSummary, UiFormGlobalSettingsEditor, DocApi, DocPage, DocSection, DocDemo],
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
            <li><strong>Fill in.</strong> Give ui-form-renderer the published version. <code>(submitted)</code> emits <code>&#123; formId, revision, values, submittedAt, files &#125;</code>; store <code>values</code> with <code>revision</code>.</li>
            <li><strong>Edit or view.</strong> Pass the stored <code>values</code> back. It opens in edit mode with a change list (or <code>mode="view"</code> for read-only text). Unknown keys and old answers are kept.</li>
            <li><strong>Share lists.</strong> Store the JSON from ui-form-global-settings and pass it to both components as <code>globalSettings</code>. Answers from searchable lists are saved as <code>&#123; value, label &#125;</code>.</li>
          </ol>
        </doc-demo>
      </doc-section>

      <doc-section name="Builder" selector="ui-form-builder" [api]="builderApi"
        summary="Add a field by clicking it in the palette (it goes after the selection) or dragging it onto the page; narrower than 1100px the palette moves behind an Add button, and on phones into a bottom sheet. Select a card to get its toolbar (settings, move, duplicate, delete, more); double-click, press Enter or hold it on a touch screen to open its settings. On a focused card, Alt+Up/Down moves it, Ctrl/Cmd+D duplicates it and Delete removes it. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo and redo. Pages have a ⋯ menu to move or delete them. Logic lists every rule in plain words and anything to fix; Preview fills the form in at desktop or phone width. Pass the published version and its answer count so the builder protects saved answers: it archives instead of deleting, locks stored option values and remembers renamed keys. It lays itself out by its own width, so give it a height.">
        <div class="builder-frame">
          <ui-form-builder #builder [(definition)]="form" [globalSettings]="globalSettings()" [published]="published()" [submissionCount]="answered() ? 12 : 0"
            [revisionStore]="revisions" (restored)="publishNote.set('Loaded an earlier version as a draft. Publish it to make it live.')">
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
        summary="Fills in a definition. Problems show when a question is left (or only on Continue, per form), and all of a page’s problems are listed at the top, with links, when someone tries to move on. Hidden questions never block submitting. Give it saved values to edit (it tracks dirty() and lists the changes next to Save) or to view, where every page shows at once as text. It emits JSON ready to store.">
        <doc-demo code="<ui-form-renderer [definition]=&quot;form&quot; (submitted)=&quot;save($event)&quot; />
<ui-form-renderer [definition]=&quot;form&quot; [values]=&quot;saved&quot; (submitted)=&quot;update($event.values)&quot; />
<ui-form-renderer [definition]=&quot;form&quot; [values]=&quot;saved&quot; mode=&quot;view&quot; />">
          <div class="bar">
            <ui-segmented [options]="modes" [value]="mode()" (valueChange)="mode.set($any($event))" label="Mode" size="sm" />
          </div>
          <div class="frame">
            <ui-form-renderer [definition]="form" [values]="mode() === 'create' ? null : answers" [mode]="mode()" (submitted)="last.set($event)" />
          </div>
          @if (last(); as s) { <pre class="out" tabindex="0" aria-label="Submitted JSON">{{ s | json }}</pre> }
        </doc-demo>
        <doc-demo code="<ui-form-renderer [definition]=&quot;form&quot; [prefill]=&quot;fromSignIn&quot; [serverErrors]=&quot;errors()&quot; (submitted)=&quot;send($event)&quot; />
// on a 422: errors.set(response.errors with 'data.' taken off the paths)">
          <div class="bar">
            <ui-button size="sm" variant="outline" (click)="serverErrors.set({ full_name: 'The name must match your ID card.', office_note: 'Applications for this post closed yesterday.' })">Pretend the server refused it</ui-button>
            <ui-button size="sm" variant="ghost" (click)="serverErrors.set(null)">Clear</ui-button>
          </div>
          <div class="frame">
            <ui-form-renderer [definition]="form" [prefill]="prefill" [serverErrors]="serverErrors()" (submitted)="last.set($event)" />
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Form summary" selector="ui-form-summary" [api]="summaryApi"
        summary="Compact review card of answered, visible fields in definition order, keeping section headings and skipping fields hidden by conditions. Reuses the engine's condition evaluation and display formatting. Pass marked paths to highlight assistant-filled answers with a marker and legend, and project action buttons into [summary-footer].">
        <doc-demo code="<ui-form-summary [definition]=&quot;form&quot; [answers]=&quot;answers&quot; [marked]=&quot;['full_name']&quot;>
  <div summary-footer><ui-button>Confirm &amp; Submit</ui-button></div>
</ui-form-summary>">
          <div style="max-width: 420px;">
            <ui-form-summary [definition]="form" [answers]="answers" [language]="lang()" [marked]="['full_name']" subtitle="Check every answer before you confirm.">
              <div summary-footer style="display:flex;gap:8px;width:100%">
                <ui-button variant="outline" style="flex:1">Edit Answers</ui-button>
                <ui-button style="flex:1">Confirm &amp; Submit</ui-button>
              </div>
            </ui-form-summary>
          </div>
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
        summary="The engine ui-form-renderer runs: rules, checks, calculations and the saved values as signals, with no DOM. Use it to work out answers in a test, pre-fill a form in code, or drive your own UI. It needs an Angular Injector because it uses effects; the renderer’s engine() gives you the one it is running.">
        <doc-demo lang="ts" code="const engine = new UiFormEngine({ definition, values: saved, injector });
engine.setValue('f_name', null, 'Aminath');   // element id, repeat entry (null outside repeats), answer
engine.instanceState('f_inst', null).visible;  // what the rules say right now
const submission = engine.submit();             // null when something is wrong (errors are then shown)
engine.destroy();" />
      </doc-section>

      <doc-section name="Languages" selector="UiFbLocalizedText" [api]="stringsApi" apiTitle="UiFbStrings: built-in words"
        summary="Every text a person reads (questions, help, options, titles, messages, button labels) is either a plain string or a map from language code to text. A form with one language stays plain strings; supportedLocales and defaultLocale turn on more. In the builder, add a language from Languages in the top bar, write everything in the default language first, then pick the other language in the switcher to translate each text with the default shown underneath. Right-to-left languages such as Dhivehi (Thaana) lay the canvas, the form and its inputs out right to left. Data keys and option values are never translated. A text with no translation shows in the default language, and the builder lists missing translations under Logic. The words the renderer says itself (Submit, Continue, Back, Step x of y, Yes and No, Choose…, Add another, Undo, the error summary heading, and the default message of every built-in check such as “is required” or “must be at least 5 characters”) follow the same language: English and Dhivehi are built in, and any other language, or different wording, is set with the strings input, provideUiFormStrings or the engine’s strings option. A label or message written in the form always wins. The builder’s own screens stay English.">
        <doc-demo [code]="languagesCode">
          <div class="bar">
            <ui-segmented [options]="langOptions" [value]="lang()" (valueChange)="lang.set($any($event))" label="Language" size="sm" />
          </div>
          <div class="frame" [attr.dir]="langDir()" [attr.lang]="lang()">
            <ui-form-renderer [definition]="form" [locale]="lang()" />
          </div>
        </doc-demo>
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
  /** Where earlier published versions are kept: the builder's History button lists them and rolls one back into a draft. */
  protected readonly revisions = new UiFbMemoryRevisionStore();
  protected readonly mode = signal<UiFormMode>('create');
  protected readonly lang = signal('en');
  protected readonly langOptions = fbLocales(SAMPLE_FORM).map((l) => ({ value: l.code, label: l.label }));
  protected readonly langDir = computed(() => fbLocaleDir(SAMPLE_FORM, this.lang()));
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
    const previous = this.published();
    this.form = { ...this.form, revision: (this.form.revision ?? 0) + 1 };
    this.published.set(structuredClone(this.form));
    this.revisions.saveRevision(fbCreateRevision(this.form, previous));
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
  api.saveAnswers({ formId: s.formId, revision: s.revision, values: s.values });
}

// 5. Edit (template: <ui-form-renderer [definition]="live()" [values]="answer.values" (submitted)="update(answer.id, $event)">)
update(id: string, s: UiFormSubmission) {
  api.updateAnswers(id, { revision: s.revision, values: s.values });
}`;

  protected readonly builderCode = `<ui-form-builder [(definition)]="form" [published]="live" [submissionCount]="answerCount"
  [globalSettings]="settings">
  <ui-button fbActions (click)="publish()">Publish</ui-button>
</ui-form-builder>`;

  protected readonly summaryApi: ApiRow[] = [
    { name: 'definition', type: 'UiFormDefinition', default: 'required', desc: 'Form definition JSON.' },
    { name: 'answers', type: 'Record<string, unknown>', default: '{}', desc: 'Submitted or draft answers object.' },
    { name: 'language', type: 'string | null', default: 'null', desc: "Language code ('en', 'dv', …); defaults to the form's default." },
    { name: 'marked', type: 'string[]', default: '[]', desc: 'Field paths to mark as assistant-filled.' },
    { name: 'markedLabel', type: 'string', default: "'Filled in by the assistant'", desc: 'Legend and tooltip label for marked fields.' },
    { name: 'subtitle / showTitle', type: 'string / boolean', default: "'' / true", desc: 'Optional subtitle and header visibility.' },
  ];
  protected readonly builderApi: ApiRow[] = [
    { name: 'agentInteractable', type: 'boolean (model)', default: 'false', desc: 'Form-level switch in Form settings; not stored in definition JSON.' },
    { name: 'definition', type: 'UiFormDefinition', default: 'createDefinition()', desc: 'Two-way (`[(definition)]`). The form being built; every edit writes back. Setting another form (a different id) or different content loads it and clears undo history; the same form handed back with only `revision` changed, as when a published copy is stored back, keeps it.' },
    { name: 'published', type: 'UiFormDefinition | null', default: 'null', desc: 'The version people answer now. Drives the unpublished-changes list and answer protection.' },
    { name: 'submissionCount', type: 'number', default: '0', desc: 'Answers the published version has. Above zero: archive instead of delete, lock saved option values, remember renamed keys, only allow similar type changes.' },
    { name: 'validators', type: 'readonly UiFbValidatorDef[]', default: '[]', desc: 'Extra app checks for the “Add a check” list, on top of provideUiFormValidators.' },
    { name: 'optionSources', type: 'readonly UiFbOptionSourceDef[]', default: '[]', desc: 'Extra searchable lists for Options → Data source, on top of provideUiFormOptionSources.' },
    { name: 'globalSettings', type: 'UiFormGlobalSettings | null', default: 'null', desc: 'App-wide settings from ui-form-global-settings; their lists become data sources.' },
    { name: 'showTitle', type: 'boolean', default: 'true', desc: 'Show the form title in the top bar. Turn off when your own header already names the form.' },
    { name: 'revisionStore', type: 'UiFbRevisionStore | null', default: 'null', desc: 'Where earlier published versions are kept. With one, a History button opens the list: see what each version changed and roll one back, which loads it as a new draft (one undo step; nothing goes live until you publish). Save each version with fbCreateRevision(definition, previous) when you publish. UiFbMemoryRevisionStore is a ready-made in-memory one.' },
    { name: 'restored', type: 'UiFormDefinition', default: '—', desc: 'A past version was loaded as the draft. It is already in `definition`.' },
    { name: 'Languages (top bar)', type: 'UI', default: '—', desc: 'Add or remove languages (Dhivehi is offered, or type any code), choose the default language and each language’s direction. With more than one language a switcher picks the language being edited; text in other languages shows the default text beneath its box. Stored in `defaultLocale` and `supportedLocales`.' },
    { name: '[fbActions]', type: 'slot', default: '—', desc: 'Your buttons (Save, Publish) in the builder’s top bar.' },
    { name: 'problems()', type: 'method', default: '—', desc: 'Signal of UiFbProblem[] ({ severity, targetId, message }): missing keys, loops between rules, rules pointing at deleted questions, backward jumps. Check for errors before publishing.' },
    { name: 'changes()', type: 'method', default: '—', desc: 'Signal of UiFbDiff | null: what changed since published (added, archived, renamed keys, type changes, removed options, changed rules, and summary lines).' },
    { name: 'select(id)', type: 'method', default: '—', desc: 'Selects a question, section or page and shows its settings; null selects the form itself.' },
    { name: 'undo() / redo()', type: 'method', default: '—', desc: 'Step through the edit history. The current `revision` is kept.' },
    { name: 'clearHistory()', type: 'method', default: '—', desc: 'Forget the undo/redo history, e.g. after saving when you want a fresh start.' },
  ];

  protected readonly rendererApi: ApiRow[] = [
    { name: 'definition', type: 'UiFormDefinition (required)', default: '—', desc: 'The form to fill in. Usually the published version.' },
    { name: 'values', type: 'Record<string, unknown> | null', default: 'null', desc: 'Saved answers to edit or view. Unknown keys and answers to questions hidden at the time are kept.' },
    { name: 'prefill', type: 'Record<string, unknown> | null', default: 'null', desc: 'Starting answers for a new submission (create mode, 0.87.0): filled in, but still Submit and no change list; defaults apply to fields without one; keys that are not fields are dropped; repeat arrays become new entries. E.g. details from a sign-in, or answers carried over to a newer version of the form.' },
    { name: 'serverErrors', type: 'Record<string, string | string[]> | null', default: 'null', desc: "Errors from the server by data path ('full_name', 'address.city', 'dependants[1].name'; a 422's errors with any request prefix removed), 0.87.0. Shown on their fields like the form's own and listed in the summary (which takes focus); a field's message goes away when its answer changes and blocks submitting until then. Paths matching no field are listed first in the summary. Give a new object per response." },
    { name: 'mode', type: "'create' | 'edit' | 'view' | null", default: 'edit with values, else create', desc: 'Edit labels the button “Save changes” and lists changes. View shows every page at once as text and never validates.' },
    { name: 'validators', type: 'readonly UiFbValidatorDef[]', default: '[]', desc: 'Extra app checks, on top of provideUiFormValidators.' },
    { name: 'optionSources', type: 'readonly UiFbOptionSourceDef[]', default: '[]', desc: 'Extra lists, on top of provideUiFormOptionSources. Use the same ones the builder had.' },
    { name: 'globalSettings', type: 'UiFormGlobalSettings | null', default: 'null', desc: 'Makes the lists from ui-form-global-settings searchable.' },
    { name: 'uploader', type: 'UiFbUploader | null', default: 'null', desc: '(file, field) => Promise<UiFbFileValue>: uploads files as they are picked. Without it, the File objects come back in submission.files.' },
    { name: 'locale', type: 'string | null', default: 'null', desc: 'The language to show the form in (`en`, `dv`, or `dv-MV` for the same language). Unknown codes fall back to the form’s default language. Changing it keeps the answers, and right-to-left languages lay the form out right to left.' },
    { name: 'strings', type: 'UiFbStringOverrides | null', default: 'null', desc: 'The renderer’s own words (Submit, Continue, Back, Step x of y, Yes/No, default error messages, …) per language code, on top of the built-in English and Dhivehi: { fr: { submit: \'Envoyer\' } }. Wins over provideUiFormStrings. Words the form author wrote always win over these.' },
    { name: 'link', type: 'UiFbSubmissionLink | null', default: 'null', desc: '{ workflowId?, serviceCode? } copied onto each submission so a workflow knows which process the answers belong to. Never stored in the form.' },
    { name: 'submitLabel', type: 'string | null', default: 'null', desc: 'Last button’s text. Otherwise the form’s setting, then “Submit” (“Save changes” in edit mode).' },
    { name: 'cancelLabel', type: 'string | null', default: 'null', desc: 'Shows a Cancel button with this text.' },
    { name: 'busy', type: 'boolean', default: 'false', desc: 'Shows the submit button as busy while you save.' },
    { name: 'showTitle', type: 'boolean', default: 'true', desc: 'Show the form’s title and description.' },
    { name: 'showActions', type: 'boolean', default: 'true', desc: 'Show the buttons. Turn off to drive it with your own (submit()).' },
    { name: 'today', type: '(() => string) | null', default: 'null', desc: 'Fixes today (YYYY-MM-DD) for date rules and ages, e.g. for forms filled in on behalf of a past date.' },
    { name: 'submit()', type: 'method', default: '—', desc: 'Checks every page on the route; emits and returns the submission, or returns null and shows the problems.' },
    { name: 'reset()', type: 'method', default: '—', desc: 'Starts over from the values the form was given (or blank), on the first page.' },
    { name: 'engine()', type: 'method', default: '—', desc: 'Signal of the running UiFormEngine: values(), dirty(), changes() and the rest (see below).' },
  ];
  protected readonly rendererOutputs: ApiRow[] = [
    { name: 'submitted', type: 'UiFormSubmission', default: '—', desc: '{ formId, revision, locale, values, submittedAt, workflowId?, serviceCode?, fields, files } once everything on the route is valid. locale is the language it was filled in; fields lists each answer’s path, key, label (in that language) and type; workflowId and serviceCode come from the link input.' },
    { name: 'valueChange', type: 'Record<string, unknown>', default: '—', desc: 'The values as they would be saved, after every change.' },
    { name: 'dirtyChange', type: 'boolean', default: '—', desc: 'Whether the answers differ from what the form opened with.' },
    { name: 'cancelled', type: 'void', default: '—', desc: 'The Cancel button was pressed.' },
    { name: 'serverErrorsUnmatched', type: 'UiFbServerErrorItem[]', default: '—', desc: 'After serverErrors were applied: the { path, message } that matched no field (0.87.0).' },
  ];
  protected readonly prefill = { full_name: 'Aisha Ali', email: 'aisha@example.mv' };
  protected readonly serverErrors = signal<Record<string, string> | null>(null);
  protected readonly validatorApi: ApiRow[] = [
    { name: 'type', type: 'string', default: '—', desc: 'Stored in the form JSON. Keep it stable.' },
    { name: 'label / description', type: 'string', default: '—', desc: 'What admins see in the “Add a check” list.' },
    { name: 'valueKinds', type: 'UiFbValueKind[]', default: 'every field', desc: "Which answers it is offered for: 'text', 'number', 'date', 'time', 'choice', 'multi', 'boolean', 'file'." },
    { name: 'fieldTypes', type: 'UiFbFieldType[]', default: '—', desc: 'Narrower than valueKinds: only these field types.' },
    { name: 'params', type: 'UiFbParamSpec[]', default: '[]', desc: "Settings admins fill in: { key, label, kind: 'number' | 'text' | 'date' | 'field' | 'select', options?, hint?, default? }." },
    { name: 'defaultMessage', type: 'string | Record<string, string>', default: '—', desc: 'Supports {label} and {paramKey}. A string, or a map by language code ({ en, dv }; dv also serves dv-MV) so the message follows the form’s language. Admins can override it per field. Built-in checks leave it out: their wording is in UiFbStrings (validatorMinLength, …).' },
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
    { name: 'new UiFormEngine(options)', type: 'UiFormEngineOptions', default: '—', desc: '{ definition, injector, values?, mode?, validators?, optionSources?, today?, locale?, strings?, link? }. Built-in checks are always included.' },
    { name: 'strings() / setStrings(overrides)', type: 'Signal<UiFbStrings> / method', default: '—', desc: 'The engine’s and renderer’s own words in the language in use (built-in table plus the strings option). Messages are worded again when the language or the overrides change.' },
    { name: 'values() / dirty() / changes()', type: 'method', default: '—', desc: 'Signals: the answers as they would be saved; whether they differ from the values it was opened with; the differences as UiFbChange[] ({ path, label, from, to }).' },
    { name: 'setValue(id, row, value)', type: 'method', default: '—', desc: 'Sets an answer. row is the repeat entry id from rows(groupId), or null.' },
    { name: 'instanceState(id, row)', type: 'method', default: '—', desc: 'UiFbInstanceState: { visible, disabled, required, value, errors, warnings, pending }.' },
    { name: 'rows / addRow / removeRow / restoreRow / moveRow', type: 'method', default: '—', desc: 'Entries of a repeating section. removeRow returns what restoreRow needs to put it back.' },
    { name: 'page() / pageIndex / path() / isLastPage()', type: 'method', default: '—', desc: 'Where the person is; path() is the route through the pages after rules and jumps.' },
    { name: 'next() / back() / goTo(i)', type: 'method', default: '—', desc: 'Move between pages. next() returns false and shows problems when the page has errors.' },
    { name: 'pageErrors(i)', type: 'method', default: '—', desc: 'UiFbErrorItem[] for a page ({ addr, id, row, label, message }).' },
    { name: 'submit()', type: 'method', default: '—', desc: 'UiFormSubmission, or null (it then moves to the first page with problems).' },
    { name: 'destroy()', type: 'method', default: '—', desc: 'Stops its effects and pending checks.' },
  ];
  protected readonly stringsApi: ApiRow[] = [
    { name: 'submit / saveChanges / next / back', type: 'string', default: 'Submit / Save changes / Continue / Back', desc: 'Buttons. Dhivehi: ހުށަހަޅާ / ބަދަލުތައް ރައްކާކުރޭ / ކުރިއަށް / ފަހަތަށް. A settings.submitLabel, nextLabel or backLabel in the form wins.' },
    { name: 'stepOf', type: 'string', default: 'Step {n} of {total}', desc: 'The progress line; the page title follows after a colon.' },
    { name: 'problemOne / problemMany / errorLabel', type: 'string', default: 'There is a problem / There are {n} problems / Error:', desc: 'The error summary heading and the word read out before a field’s error.' },
    { name: 'yes / no / empty / notAnswered / optional / calculatedHint', type: 'string', default: 'Yes / No / Empty / Not answered / (optional) / Worked out as you answer', desc: 'Answers shown as text, the change list, view mode and the optional marker.' },
    { name: 'entryTitle / addAnother / nothingAdded / noneAdded / remove / moveUp / moveDown / entryAdded / entryRemoved / entryRemovedAnnounce / entryRestored / undo', type: 'string', default: 'Entry {n}, Add another, …', desc: 'Repeating sections. {n} is the entry number and {name} the entry’s title.' },
    { name: 'choose / selectDate / fileUploadLabel / fileUploadHint / uploading / uploadFailed / checking', type: 'string', default: 'Choose…, Select a date, …', desc: 'Placeholders and notes of the controls. A field’s own placeholder wins.' },
    { name: 'searchSource / search / clear / tryAgain / listUnavailable / savedAnswer / chooseFirst / typeToSearch / loadFailed / searching / loadingMore / noMatches / nothingToChoose', type: 'string', default: 'Search {name}…, …', desc: 'Lists searched from your app (option sources).' },
    { name: 'requiredField / requiredQuestion / requiredTick', type: 'string', default: '{label} is required.', desc: 'Default messages of a required question. A field’s requiredMessage wins.' },
    { name: 'validatorEmail … validatorCompareField', type: 'string', default: 'one per built-in check', desc: 'Default message of each built-in check, named validator + the check’s type with a capital (validatorMinLength). Placeholders are the check’s settings: {label}, {min}, {max}, {date}, {field}, {comparison}, …. A rule’s own message wins.' },
    { name: 'compareEq … compareLte / dateToday / dateInDays / dateDaysAgo', type: 'string', default: 'the same as, more than, …', desc: 'Words filled into {comparison} and {date}.' },
  ];

  protected readonly languagesCode = `// Every user-facing text: one string, or a map by language code.
type UiFbLocalizedText = string | Record<string, string>;

const form: UiFormDefinition = {
  schemaVersion: 2, id: 'f', title: { en: 'Survey', dv: 'ސާވޭ' },
  defaultLocale: 'en',
  supportedLocales: [{ code: 'en', label: 'English' }, { code: 'dv', label: 'ދިވެހި', dir: 'rtl' }],
  pages: [{ id: 'p', elements: [{ kind: 'field', id: 'a', type: 'text', key: 'name', label: { en: 'Name', dv: 'ނަން' } }] }],
};

fbText(label, 'dv', 'en')        // the text in dv, else en, else the first one written
<ui-form-renderer [definition]="form" [locale]="'dv'" />   // answers survive switching language

// The renderer's own words (buttons, step text, default error messages) follow the language too.
// English and Dhivehi are built in; change or add wording per language code:
<ui-form-renderer [definition]="form" [locale]="'fr'" [strings]="{ fr: { submit: 'Envoyer', back: 'Retour' } }" />

// Or once for the whole app (the strings input is laid on top):
providers: [provideUiFormStrings({ fr: { submit: 'Envoyer' }, dv: { back: 'އަނބުރާ' } })]

fbStrings('dv-MV').submit        // the dv table: exact code, then base language, else English
new UiFormEngine({ definition, injector, locale: 'dv', strings: { dv: { next: 'ދެން' } } })`;

  protected readonly definitionShape = `interface UiFormDefinition {
  schemaVersion: number;   // UI_FB_SCHEMA_VERSION (2); older forms are upgraded by migrateDefinition
  id: string; title: UiFbLocalizedText; description?: UiFbLocalizedText;
  defaultLocale?: string;  // 'en' when missing
  supportedLocales?: { code: string; label?: string; dir?: 'ltr' | 'rtl' }[];   // the default one included
  // Every text below marked UiFbLocalizedText may be a plain string or { [locale]: string }.
  revision?: number;       // bump when you publish; recorded on each submission
  settings?: UiFbSettings;
  pages: UiFbPage[];
}
interface UiFbSettings {
  labelPlacement?: 'top' | 'inside' | 'left' | 'hidden';   errorPlacement?: 'below' | 'inside';
  validateOn?: 'blur' | 'submit';                          clearHidden?: 'onSubmit' | 'never';
  errorSummary?: boolean;   requiredMarker?: 'asterisk' | 'optional' | 'none';
  submitLabel?: UiFbLocalizedText; nextLabel?: UiFbLocalizedText; backLabel?: UiFbLocalizedText; showProgress?: boolean;
}
interface UiFbPage {
  id: string; title?: UiFbLocalizedText; description?: UiFbLocalizedText;
  visibility?: UiFbVisibility;
  jumps?: { id: string; when: UiFbCondition; to: string }[];   // to: a later page id, or 'end'
  elements: UiFbElement[];
}
type UiFbElement = UiFbField | UiFbGroup | UiFbStatic;
interface UiFbField {
  kind: 'field'; id: string; type: UiFbFieldType; key: string; keyHistory?: string[];
  label: UiFbLocalizedText; help?: UiFbLocalizedText; placeholder?: UiFbLocalizedText; defaultValue?: unknown;
  readOnly?: boolean; required?: UiFbToggle; requiredMessage?: UiFbLocalizedText; disabled?: UiFbToggle;
  visibility?: UiFbVisibility;
  options?: { id: string; value: string; label: UiFbLocalizedText; archived?: boolean }[];   // value is never translated
  source?: { type: string; params?: Record<string, { const: unknown } | { ref: string }> };
  props?: UiFbFieldProps;   // min, max, step, decimals, currency, rows, maxRating, accept, multiple, caption, format, …
  validators?: { id: string; type: string; params?: Record<string, unknown>; message?: UiFbLocalizedText;
                 when?: UiFbCondition; severity?: 'error' | 'warning' }[];
  calc?: UiFbCalc;          // { op, args: ({ ref } | { const } | { calc })[], decimals? }
  setValue?: { id: string; when: UiFbCondition; value: UiFbOperand }[];
  layout?: { width?: 'full' | 'two-thirds' | 'half' | 'third'; labelPlacement?; errorPlacement? };
  archived?: boolean;
}
interface UiFbGroup {
  kind: 'group'; id: string; title?: UiFbLocalizedText; description?: UiFbLocalizedText;
  key?: string; keyHistory?: string[];   // answers nest under key (required when it repeats)
  columns?: 1 | 2 | 3;
  repeat?: { min?: number; max?: number; addLabel?: UiFbLocalizedText; itemLabel?: UiFbLocalizedText };   // itemLabel: 'Entry {n}'
  visibility?: UiFbVisibility; disabled?: UiFbToggle; layout?: { width? };
  elements: UiFbElement[]; archived?: boolean;
}
interface UiFbStatic { kind: 'static'; id: string; type: 'heading' | 'paragraph' | 'divider'; text?: UiFbLocalizedText; visibility?; layout?; archived?: boolean }

type UiFbFieldType = 'text' | 'textarea' | 'email' | 'phone' | 'url' | 'number' | 'currency' | 'date' | 'time'
  | 'select' | 'radio' | 'checkboxes' | 'multiselect' | 'checkbox' | 'toggle' | 'rating' | 'slider'
  | 'file' | 'hidden' | 'calculated';
type UiFbToggle = boolean | { when: UiFbCondition };
interface UiFbVisibility { action: 'show' | 'hide'; when: UiFbCondition }
type UiFbCondition = { match: 'all' | 'any' | 'none'; conditions: UiFbCondition[] }
                   | { ref: string; op: UiFbOperator; value?: UiFbOperand; value2?: UiFbOperand };   // ref: an element id
type UiFbOperand = { const: unknown } | { ref: string } | { today: number };   // today: days from today

// Answers (submission.values): keys are field keys. Text, dates ('YYYY-MM-DD') and times ('HH:mm') are strings;
// numbers are numbers; a choice is its option value; multiple choice is a list of values; yes/no is a boolean;
// files are UiFbFileValue[] ({ name, size, type, url?, id? }); option sources are { value, label } (or a list);
// a keyed section is an object; a repeating section is a list of objects.
interface UiFormSubmission {
  formId: string; revision: number | null; values: Record<string, unknown>;
  locale: string;                                       // the language it was filled in
  workflowId?: string; serviceCode?: string;            // copied from the renderer's [link]
  fields: { path: string; key: string; label: string; type: UiFbFieldType }[];   // what each answer is, labels in locale
  submittedAt: string; files: Record<string, File[]>;   // picked files with no uploader, by path in values
}`;

  protected readonly reference: { title: string; rows: ApiRow[] }[] = [
    {
      title: 'Languages and revisions',
      rows: [
        { name: 'UiFbStrings / UI_FB_STRINGS_EN / UI_FB_STRINGS_DV / UI_FB_STRINGS', type: 'interface / tables', default: '—', desc: 'One key per built-in phrase ({placeholders} filled by the code), the English and Dhivehi tables, and the tables by language code.' },
        { name: 'fbStrings(locale, overrides?)', type: 'UiFbStrings', default: '—', desc: 'The words for a language: the table of that exact code, else of its base language (dv-MV uses dv), else English; overrides for the base language, then for the exact code, are laid on top. A language with no table but with overrides gets English plus them.' },
        { name: 'provideUiFormStrings(overrides) / UiFbStringOverrides', type: 'Provider / type', default: '—', desc: 'Sets the renderer’s wording once for the app: Partial<Record<languageCode, Partial<UiFbStrings>>>. The renderer’s strings input is laid on top.' },
        { name: 'validatorMessage(def, strings, locale?)', type: 'string', default: '—', desc: 'The message a check shows by default in a language: a registered check’s defaultMessage, else the built-in wording from strings.' },
        { name: 'fbText(text, locale?, defaultLocale?)', type: 'string', default: '—', desc: 'A UiFbLocalizedText in a language: that language, else the same base language, else the default, else the first text written.' },
        { name: 'fbTextIn(text, locale, defaultLocale?) / fbSetText(text, locale, value, defaultLocale?)', type: 'string / UiFbLocalizedText', default: '—', desc: 'Read exactly one language (blank when missing), or write one. A text stays a plain string until a second language is written.' },
        { name: 'fbLocales(def) / fbDefaultLocale(def) / fbResolveLocale(def, requested?) / fbLocaleDir(def, locale?)', type: 'various', default: '—', desc: 'The form’s languages with label and direction filled in (default first), its default, the language a request resolves to, and a language’s direction.' },
        { name: 'fbLocaleName(code) / fbDefaultDir(code)', type: 'string / ‘ltr’ | ‘rtl’', default: '—', desc: 'A language’s own name (ދިވެހި for dv) and its usual direction (Dhivehi, Arabic, Hebrew, Persian and Urdu are right to left).' },
        { name: 'UiFbRevisionStore', type: 'interface', default: '—', desc: 'listRevisions(formId), getRevision(formId, n), saveRevision(entry), rollback(formId, n, current?). Each may return a Promise. Pass one to the builder as revisionStore.' },
        { name: 'fbCreateRevision(definition, previous?, meta?) / UiFbMemoryRevisionStore', type: 'UiFbRevision / class', default: '—', desc: 'The snapshot to store when you publish (with a summary of what changed), and an in-memory store for demos and small apps.' },
      ],
    },
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
