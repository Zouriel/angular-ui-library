import { JsonPipe } from '@angular/common';
import { Component, computed, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiSwitch } from '@zouriel/ui/form';
import {
  UiFormBuilder,
  UiFormRenderer,
  provideUiFormOptionSources,
  provideUiFormValidators,
  type UiFbValidatorDef,
  type UiFormDefinition,
  type UiFormMode,
  type UiFormSubmission,
} from '@zouriel/ui/form-builder';
import { DEMO_SOURCES } from './form-builder.sources';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';
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
  imports: [JsonPipe, FormsModule, RouterLink, UiButton, UiSegmented, UiSwitch, UiFormBuilder, UiFormRenderer, DocPage, DocSection, DocDemo],
  providers: [provideUiFormValidators(STUDENT_ID), provideUiFormOptionSources(...DEMO_SOURCES)],
  template: `
    <doc-page eyebrow="Flagship" title="Form builder"
      lead="Admin staff build forms by dragging fields onto a page, then add rules in plain words: show a question only when another answer says so, require it under a condition, group questions into sections that depend on other sections, repeat a section, split the form into steps. The form and every answer are plain JSON.">

      <aside class="studio-cta">
        <div>
          <strong>Two components</strong>
          <p><code translate="no">ui-form-builder</code> is the admin screen where a form is made. <code translate="no">ui-form-renderer</code> is what people fill in, and what staff use to view or correct saved answers. Your app stores the JSON in between.</p>
        </div>
        <ui-button routerLink="/form-studio">Open the form studio</ui-button>
      </aside>

      <doc-section name="Builder" selector="ui-form-builder" [api]="builderApi"
        summary="Bind [(definition)] and store it. Pass the published version and its answer count so the builder protects saved answers: it archives instead of deleting, locks stored option values and remembers renamed keys.">
        <div class="builder-frame">
          <ui-form-builder #builder [(definition)]="form" [published]="published()" [submissionCount]="answered() ? 12 : 0">
            <div fbActions class="actions">
              <ui-button size="sm" (click)="publish()">{{ published() ? 'Publish changes' : 'Publish' }}</ui-button>
            </div>
          </ui-form-builder>
        </div>
        <div class="under">
          <ui-switch [ngModel]="answered()" (ngModelChange)="answered.set($event)" [disabled]="!published()">Pretend the published form has 12 answers</ui-switch>
          @if (publishNote()) { <span class="note">{{ publishNote() }}</span> }
        </div>
      </doc-section>

      <doc-section name="Renderer" selector="ui-form-renderer" [api]="rendererApi" [outputs]="rendererOutputs"
        summary="Fills in a definition. Give it saved data to edit (with a change list and dirty tracking) or to view. It emits JSON ready to store.">
        <doc-demo code="<ui-form-renderer [definition]=&quot;form&quot; [data]=&quot;saved&quot; (submitted)=&quot;save($event)&quot; />">
          <div class="bar">
            <ui-segmented [options]="modes" [value]="mode()" (valueChange)="mode.set($any($event))" label="Mode" size="sm" />
          </div>
          <div class="frame">
            <ui-form-renderer [definition]="form" [data]="mode() === 'create' ? null : answers" [mode]="mode()" (submitted)="last.set($event)" />
          </div>
          @if (last(); as s) { <pre class="out">{{ s | json }}</pre> }
        </doc-demo>
      </doc-section>

      <doc-section name="App checks" selector="provideUiFormValidators" [api]="validatorApi"
        summary="Register checks your app knows how to run (sync or async). They show up in the builder's “Add a check” list and run in the renderer. This page registers “Student ID exists”: add it to a short text field and try S123456."
        [shapes]="validatorShape">
        <doc-demo lang="ts" code="providers: [provideUiFormValidators({
  type: 'studentIdExists',
  label: 'Student ID exists',
  valueKinds: ['text'],
  defaultMessage: 'We couldn’t find that student ID.',
  validate: (v) => api.studentExists(v),   // true, false, or a message
})]">
          <p class="plain">Checks get the answer, their settings, and a context with other answers and an AbortSignal. Slow checks show “Checking…” and block submitting until they finish.</p>
        </doc-demo>
      </doc-section>

      <doc-section name="Option sources" selector="provideUiFormOptionSources" [api]="sourceApi"
        summary="Lists that live in your app, usually behind a paginated, searchable API: students, courses, countries. Register them and they appear in the builder as a data source for dropdowns and multi-selects (Options → Data source). The renderer searches as people type and loads more as they scroll. Each setting can be a fixed value or another question’s answer, so lists can depend on each other. Answers are saved as { value, label }."
        [shapes]="sourceShape">
        <doc-demo lang="ts" code="providers: [provideUiFormOptionSources({
  type: 'courses',
  label: 'Courses',
  params: [{ key: 'programme', label: 'Programme', required: true }],
  pageSize: 20,
  search: ({ query, page, pageSize, params, signal }) =>
    api.courses({ q: query, page, size: pageSize, programme: params.programme }, signal),
    // → { items: [{ value, label, description? }], hasMore }   (or total)
})]">
          <p class="plain">This page registers two demo lists, “Students” (600, searchable by name or ID) and “Courses” (follows the Programme answer). The sample form uses them for “Your student record” on page 1 and “Courses you’ll take” on page 3. Rules on these questions search the same list.</p>
        </doc-demo>
      </doc-section>

      <doc-section name="JSON format" selector="UiFormDefinition" summary="What the builder saves and the renderer reads. Rules refer to element ids, never labels or keys, so renaming never breaks them." [shapes]="definitionShape">
        <doc-demo lang="json" [code]="formJson()">
          <p class="plain">The current form from the builder above is in the code panel below.</p>
        </doc-demo>
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
    .under { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-3); margin-top: var(--ui-space-3); font-size: 13px; }
    .note { color: var(--ui-color-text-muted); }
    .bar { display: flex; gap: var(--ui-space-2); margin-bottom: var(--ui-space-3); }
    .frame { max-width: 720px; width: 100%; text-align: left; }
    .out { max-height: 260px; overflow: auto; font-size: 12px; text-align: left; width: 100%; }
    .plain { margin: 0; color: var(--ui-color-text-secondary); font-size: 14px; max-width: 70ch; text-align: left; }
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
    setInterval(() => this.tick.update((n) => n + 1), 1500);
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

  protected readonly builderApi: ApiRow[] = [
    { name: 'definition', type: 'UiFormDefinition (model)', default: 'empty form', desc: 'The form being built. Two-way bound; every edit writes back.' },
    { name: 'published', type: 'UiFormDefinition | null', default: 'null', desc: 'The version people answer now. Drives the unpublished-changes list and answer protection.' },
    { name: 'submissionCount', type: 'number', default: '0', desc: 'Answers the published version has. Above zero: archive instead of delete, lock saved option values, remember renamed keys, only allow similar type changes.' },
    { name: 'validators', type: 'UiFbValidatorDef[]', default: '[]', desc: 'Extra app checks for the “Add a check” list (also see provideUiFormValidators).' },
    { name: 'problems()', type: 'Signal<UiFbProblem[]>', desc: 'Missing keys, loops between rules, rules pointing at deleted questions, backward jumps. Check before publishing.' },
    { name: 'changes()', type: 'Signal<UiFbDiff | null>', desc: 'What changed since published: added, archived, renamed keys, type changes, removed options, changed rules.' },
    { name: '[fbActions]', type: 'content slot', desc: 'Your buttons (Save, Publish) in the builder’s top bar.' },
  ];

  protected readonly rendererApi: ApiRow[] = [
    { name: 'definition', type: 'UiFormDefinition', desc: 'The form to fill in.' },
    { name: 'data', type: 'Record<string, unknown> | null', default: 'null', desc: 'Saved answers to edit or view. Unknown keys and answers to questions hidden at the time are kept.' },
    { name: 'mode', type: "'create' | 'edit' | 'view'", default: 'edit when data, else create', desc: 'View shows answers as text and never validates.' },
    { name: 'validators', type: 'UiFbValidatorDef[]', default: '[]', desc: 'Extra app checks.' },
    { name: 'uploader', type: '(file, field) => Promise<UiFbFileValue>', default: 'null', desc: 'Uploads files as they are picked. Without it, files come back in the submission’s files map.' },
    { name: 'submitLabel / cancelLabel', type: 'string', desc: 'Button text overrides. A cancel label shows a Cancel button.' },
    { name: 'busy', type: 'boolean', default: 'false', desc: 'Shows the submit button as busy while you save.' },
    { name: 'engine()', type: 'Signal<UiFormEngine>', desc: 'The running form: data(), dirty(), changes(), submit().' },
  ];
  protected readonly rendererOutputs: ApiRow[] = [
    { name: 'submitted', type: 'UiFormSubmission', desc: '{ formId, revision, data, submittedAt, files } once everything on the route is valid.' },
    { name: 'valueChange', type: 'Record<string, unknown>', desc: 'The data as it would be saved, after every change.' },
    { name: 'dirtyChange', type: 'boolean', desc: 'Whether answers differ from what the form opened with.' },
    { name: 'cancelled', type: 'void', desc: 'The Cancel button was pressed.' },
  ];
  protected readonly validatorApi: ApiRow[] = [
    { name: 'type', type: 'string', desc: 'Stored in the form JSON. Keep it stable.' },
    { name: 'label / description', type: 'string', desc: 'What admins see in the “Add a check” list.' },
    { name: 'valueKinds / fieldTypes', type: 'UiFbValueKind[] / UiFbFieldType[]', desc: 'Which fields it is offered for.' },
    { name: 'params', type: 'UiFbParamSpec[]', desc: 'Settings admins fill in (number, text, date, another question, a choice).' },
    { name: 'defaultMessage', type: 'string', desc: 'Supports {label} and {paramKey}. Admins can override it per field.' },
    { name: 'validate', type: '(value, params, ctx) => result | Promise<result>', desc: 'true or null passes; false fails with the message; a string fails with that text.' },
    { name: 'debounceMs', type: 'number', default: '400 for async', desc: 'Pause after typing before an async check runs.' },
  ];
  protected readonly sourceApi: ApiRow[] = [
    { name: 'type / label / description', type: 'string', desc: 'type is stored in the form JSON (keep it stable); label and description are what admins see.' },
    { name: 'params', type: 'UiFbSourceParamSpec[]', desc: 'Settings admins fill in: { key, label, kind: text | number | select, options?, required? }. Each can also be set to another question’s answer.' },
    { name: 'search(query)', type: '(q) => page | Promise<page>', desc: 'Gets { query, page (from 1), pageSize, params, signal }; returns { items, hasMore? , total? }. Pass signal to fetch so stale searches are cancelled.' },
    { name: 'pageSize / minQueryLength / debounceMs', type: 'number', default: '20 / 0 / 250', desc: 'Results per page; characters needed before searching; pause after typing.' },
    { name: 'optionSources', type: 'UiFbOptionSourceDef[]', desc: 'Also an input on ui-form-builder and ui-form-renderer, for lists you don’t provide app-wide.' },
  ];
  protected readonly sourceShape = `// A sourced field in the form JSON
{ kind: 'field', type: 'multiselect', key: 'courses', label: 'Courses you’ll take',
  source: { type: 'courses', params: { programme: { ref: 'f_prog' } } } }

// Its answer: the value, and the label it had when picked
"courses": [{ "value": "health-1", "label": "Anatomy" }]`;
  protected readonly validatorShape = `interface UiFbValidatorContext {
  field: UiFbField;
  value(ref: string): unknown;   // another answer
  label(ref: string): string;
  today(): string;               // YYYY-MM-DD
  signal?: AbortSignal;          // aborted when the answer changes again
}`;
  protected readonly definitionShape = `interface UiFormDefinition {
  schemaVersion: 1; id: string; title: string; revision?: number;
  settings?: { labelPlacement, errorPlacement, validateOn, clearHidden, ... };
  pages: { id; title?; visibility?; jumps?: { when; to }[]; elements: UiFbElement[] }[];
}
type UiFbElement = UiFbField | UiFbGroup | UiFbStatic;
interface UiFbField {
  kind: 'field'; id: string; type: UiFbFieldType; key: string; keyHistory?: string[];
  label: string; help?; placeholder?; defaultValue?; options?: { id; value; label; archived? }[];
  required?: boolean | { when: UiFbCondition };
  disabled?: boolean | { when: UiFbCondition };
  visibility?: { action: 'show' | 'hide'; when: UiFbCondition };
  validators?: { id; type; params?; message?; when?; severity? }[];
  calc?: { op; args: ({ ref } | { const } | { calc })[]; decimals? };
  setValue?: { id; when; value }[];
  layout?: { width?, labelPlacement?, errorPlacement? };
  archived?: boolean;
}
type UiFbCondition = { match: 'all' | 'any' | 'none'; conditions: UiFbCondition[] }
                   | { ref: string; op: UiFbOperator; value?: { const } | { ref } | { today }; value2? };`;
}
