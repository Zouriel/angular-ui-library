import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiChip } from '@zouriel/ui/badge';
import { UiConfirmDialog, UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiFormField, UiTextarea } from '@zouriel/ui/form';
import {
  UiFormBuilder,
  UiFormRenderer,
  allFields,
  formatValue,
  isEmptyValue,
  provideUiFormHttpSources,
  provideUiFormOptionSources,
  UiFormGlobalSettingsEditor,
  provideUiFormValidators,
  type UiFbUploader,
  type UiFbValidatorDef,
  type UiFormDefinition,
  type UiFormSubmission,
} from '@zouriel/ui/form-builder';
import { DEMO_SOURCES } from './form-builder.sources';
import { FormStudioStore, type StudioForm, type StudioResponse } from './form-studio.store';

/** Same sample app check as the docs page, so "Student ID exists" is in the Add a check list here too. */
const STUDENT_ID: UiFbValidatorDef = {
  type: 'studentIdExists',
  label: 'Student ID exists',
  description: 'Looks the ID up in the student records',
  valueKinds: ['text'],
  defaultMessage: 'We couldn’t find that student ID.',
  validate: (v) => new Promise((resolve) => setTimeout(() => resolve(/^S\d{6}$/i.test(String(v)) || 'We couldn’t find that student ID. IDs look like S123456.'), 500)),
};

type Tab = 'build' | 'fill' | 'answers' | 'json';

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Strips what publishing changes, so "has unpublished changes" compares only real edits. */
function comparable(def: UiFormDefinition | null): string {
  if (!def) return '';
  const { revision: _r, ...rest } = def;
  return JSON.stringify(rest);
}

@Component({
  selector: 'page-form-studio',
  imports: [FormsModule, HugeiconsIconComponent, UiButton, UiSegmented, UiChip, UiConfirmDialog, UiModal, UiEmptyState, UiFormField, UiTextarea, UiFormBuilder, UiFormRenderer, UiFormGlobalSettingsEditor],
  providers: [
    provideUiFormValidators(STUDENT_ID),
    provideUiFormOptionSources(...DEMO_SOURCES),
    // Lists set up in Settings may only call these servers; a real app would also attach its login here.
    provideUiFormHttpSources({ allowedOrigins: ['https://dummyjson.com'] }),
  ],
  template: `
    @if (query()?.view === 'settings') {
      <!-- The app's settings page: shared lists and new-form defaults, as an app would host them. -->
      <div class="scroll"><div class="library">
        <header class="lib-head">
          <div>
            <ui-button class="flush-start" variant="ghost" size="sm" (click)="open(null)"><hugeicons-icon aria-hidden="true" [icon]="backIcon" [size]="14" [strokeWidth]="1.8" />All forms</ui-button>
            <h1>Form settings</h1>
            <p class="lead">For every form in the app. In your app this is <code translate="no">ui-form-global-settings</code> on its settings page; the result is plain JSON you store.</p>
          </div>
        </header>
        <ui-form-global-settings [settings]="store.settings()" (settingsChange)="store.saveSettings($event)" [usage]="store.usage()" />
      </div></div>
    } @else if (current(); as f) {
      <!-- One form open: build it, fill it in, look after its answers. -->
      <header class="bar">
        <ui-button variant="ghost" size="sm" (click)="open(null)"><hugeicons-icon aria-hidden="true" [icon]="backIcon" [size]="14" [strokeWidth]="1.8" />All forms</ui-button>
        <div class="title">
          <h1>{{ f.draft.title || 'Untitled form' }}</h1>
          <ui-chip [tone]="statusTone(f)"><span class="st-long">{{ statusText(f) }}</span><span class="st-short" aria-hidden="true">{{ statusShort(f) }}</span></ui-chip>
        </div>
        <ui-segmented class="tabs" size="sm" label="Section" [options]="tabOptions()" [value]="tab()" (valueChange)="setTab($any($event))" />
      </header>
      @if (store.saveError()) { <p class="save-error" role="alert">{{ store.saveError() }}</p> }

      <div class="body">
        @switch (tab()) {
          @case ('build') {
            <!-- The builder's panes use h3 headings; this keeps the outline h1 → h2 → h3. -->
            <h2 class="sr-only">Edit form</h2>
            <!-- A one-item loop keyed by the form: opening another form gives a fresh builder (and history). Not 'track x', which Angular warns about when it recreates. -->
            @for (x of [f.id]; track 'form:' + x) {
              <ui-form-builder #builder class="builder" [showTitle]="false" [globalSettings]="store.settings()"
                [definition]="f.draft" (definitionChange)="store.setDraft(f.id, $event)"
                [published]="f.published" [submissionCount]="f.responses.length">
                <div fbActions class="fb-actions">
                  <ui-button size="sm" [disabled]="!changed(f)" (click)="publish(f)">{{ f.published ? 'Publish changes' : 'Publish' }}</ui-button>
                </div>
              </ui-form-builder>
            }
          }

          @case ('fill') {
            <div class="scroll"><div class="sheet">
              @if (!f.published) {
                <ui-empty-state heading="Publish the form first"
                  description="People answer the published version. Publish it from Edit form, then come back to fill it in.">
                  <div empty-actions><ui-button (click)="setTab('build')">Edit the form</ui-button><ui-button variant="secondary" (click)="publish(f)">Publish now</ui-button></div>
                </ui-empty-state>
              } @else if (justSaved()) {
                <ui-empty-state heading="Answer saved" description="It’s in Answers, where you can view or edit it.">
                  <div empty-actions><ui-button (click)="justSaved.set(false)">Fill in again</ui-button><ui-button variant="secondary" (click)="openAnswer(lastId())">See the answer</ui-button></div>
                </ui-empty-state>
              } @else {
                @if (changed(f)) { <p class="note">You’re filling in the published version. Your newer edits show here after you publish them.</p> }
                <ui-form-renderer [definition]="f.published" [globalSettings]="store.settings()" [uploader]="uploader" (submitted)="saveNew(f, $event)" />
              }
            </div></div>
          }

          @case ('answers') {
            @if (!f.responses.length) {
              <div class="scroll"><ui-empty-state heading="No answers yet" description="Answers saved from Fill in show up here, ready to view or edit.">
                <div empty-actions><ui-button (click)="setTab('fill')">Fill it in</ui-button></div>
              </ui-empty-state></div>
            } @else {
              <div class="answers" [class.has-pick]="!!answer()">
                <ul class="list" aria-label="Answers">
                  @for (r of f.responses; track r.id; let i = $index) {
                    <li>
                      <button class="row" [class.on]="answer()?.id === r.id" [attr.aria-current]="answer()?.id === r.id ? 'true' : null" (click)="openAnswer(r.id)">
                        <span class="row-top"><strong>{{ headline(f, r) }}</strong><span class="when">{{ when(r.updatedAt || r.submittedAt) }}</span></span>
                        <span class="row-sub">{{ subline(f, r) }}</span>
                        @if (r.updatedAt) { <span class="edited">Edited</span> }
                      </button>
                    </li>
                  }
                </ul>
                <section class="detail" aria-live="polite">
                  @if (answer(); as r) {
                    <div class="detail-head">
                      <ui-button class="back flush-start" variant="ghost" size="sm" (click)="openAnswer(null)"><hugeicons-icon aria-hidden="true" [icon]="backIcon" [size]="14" [strokeWidth]="1.8" />Answers</ui-button>
                      <div class="detail-title">
                        <strong>{{ headline(f, r) }}</strong>
                        <span class="when">Sent {{ when(r.submittedAt) }}@if (r.updatedAt) { · edited {{ when(r.updatedAt) }} }</span>
                      </div>
                      @if (!editing()) {
                        <ui-button size="sm" (click)="editing.set(true)">Edit</ui-button>
                        <ui-button size="sm" variant="ghost" (click)="confirmAnswerDelete.set(true)">Delete</ui-button>
                      }
                    </div>
                    @if (f.published && r.revision < (f.published.revision ?? 0)) {
                      <p class="note">Saved with version {{ r.revision }}. It opens in the current version ({{ f.published.revision }}); answers the form no longer asks are kept.</p>
                    }
                    @for (x of [r.id + editing()]; track 'answer:' + x) {
                      <ui-form-renderer [definition]="f.published ?? f.draft" [globalSettings]="store.settings()" [data]="r.data" [mode]="editing() ? 'edit' : 'view'"
                        [uploader]="uploader" [cancelLabel]="editing() ? 'Cancel' : ''" (cancelled)="editing.set(false)"
                        (submitted)="saveEdit(f, r, $event)" />
                    }
                  } @else {
                    <ui-empty-state heading="Pick an answer" description="Choose one from the list to read it, or to correct it with Edit." />
                  }
                </section>
              </div>
            }
          }

          @case ('json') {
            <div class="scroll"><div class="sheet wide">
              <section class="json">
                <div class="json-head"><h2>Form</h2><span class="hint">What the builder saves and the renderer reads</span>
                  <ui-button size="sm" variant="secondary" (click)="copy(formJson(f), 'Form JSON copied')">Copy</ui-button>
                  <ui-button size="sm" variant="secondary" (click)="download(formJson(f), f.draft.title + '.form.json')">Download</ui-button></div>
                <pre tabindex="0" aria-label="Form JSON">{{ formJson(f) }}</pre>
              </section>
              <section class="json">
                <div class="json-head"><h2>Answers</h2><span class="hint">{{ f.responses.length }} saved, newest first</span>
                  <ui-button size="sm" variant="secondary" [disabled]="!f.responses.length" (click)="copy(answersJson(f), 'Answers copied')">Copy</ui-button>
                  <ui-button size="sm" variant="secondary" [disabled]="!f.responses.length" (click)="download(answersJson(f), f.draft.title + '.answers.json')">Download</ui-button></div>
                <pre tabindex="0" aria-label="Answers JSON">{{ answersJson(f) }}</pre>
              </section>
            </div></div>
          }
        }
      </div>

      <ui-confirm-dialog [open]="confirmAnswerDelete()" (openChange)="confirmAnswerDelete.set($event)" [destructive]="true"
        title="Delete this answer?" message="It’s removed from this browser for good." confirmLabel="Delete answer"
        (confirm)="deleteAnswer(f)" />
    } @else {
      <!-- The list of saved forms. -->
      <div class="scroll"><div class="library">
        <header class="lib-head">
          <div>
            <p class="eyebrow">Playground</p>
            <h1>Form studio</h1>
            <p class="lead">Build forms, fill them in and edit the answers, the way an app would use <code translate="no">ui-form-builder</code> and <code translate="no">ui-form-renderer</code>. Settings holds the lists dropdowns can search and the defaults new forms start with (<code translate="no">ui-form-global-settings</code>). Everything is saved in this browser.</p>
          </div>
          <div class="lib-actions">
            <ui-button (click)="newForm()">New form</ui-button>
            <ui-button variant="secondary" (click)="importOpen.set(true)">Import JSON</ui-button>
            <ui-button variant="ghost" (click)="openSettings()">Settings</ui-button>
          </div>
        </header>
        @if (store.saveError()) { <p class="save-error" role="alert">{{ store.saveError() }}</p> }

        @if (store.sorted().length) {
          <ul class="cards" aria-label="Saved forms">
            @for (f of store.sorted(); track f.id) {
              <li class="card">
                <button class="card-open" (click)="open(f.id)">
                  <span class="card-title">{{ f.draft.title || 'Untitled form' }}</span>
                  <span class="card-meta">{{ counts(f) }}</span>
                  <span class="when">Edited {{ when(f.updatedAt) }}</span>
                </button>
                <div class="card-foot">
                  <ui-chip [tone]="statusTone(f)">{{ statusText(f) }}</ui-chip>
                  <span class="grow"></span>
                  <!-- The form's name is in hidden text, not aria-label on the host: the real <button> is inside ui-button. -->
                  <ui-button size="sm" variant="ghost" (click)="duplicate(f.id)">Duplicate<span class="sr-only"> {{ f.draft.title || 'Untitled form' }}</span></ui-button>
                  <ui-button size="sm" variant="ghost" (click)="toDelete.set(f)">Delete<span class="sr-only"> {{ f.draft.title || 'Untitled form' }}</span></ui-button>
                </div>
              </li>
            }
          </ul>
        } @else {
          <ui-empty-state heading="No forms yet" description="Start a blank form, import one as JSON, or bring the sample back.">
            <div empty-actions><ui-button (click)="newForm()">New form</ui-button><ui-button variant="secondary" (click)="store.reset()">Restore sample</ui-button></div>
          </ui-empty-state>
        }

        <footer class="lib-foot">
          <span>Saved in this browser’s local storage, so it survives reloads but not a different browser or clearing site data.</span>
          <ui-button class="flush-end" size="sm" variant="ghost" (click)="confirmReset.set(true)">Reset studio</ui-button>
        </footer>
      </div></div>

      <ui-modal [open]="importOpen()" (openChange)="importOpen.set($event)" title="Import a form">
        <div class="import">
          <ui-form-field label="Form JSON" hint="Paste a form exported from here, or pick a .json file." [error]="importError()">
            <ui-textarea [rows]="10" name="form-json" autocomplete="off" [invalid]="!!importError()" [ngModel]="importText()" (ngModelChange)="importText.set($event); importError.set('')" />
          </ui-form-field>
          <div class="file">
            <input #fileIn class="sr-only" type="file" accept="application/json,.json" tabindex="-1" aria-hidden="true" (change)="pickFile($event)" />
            <ui-button size="sm" variant="outline" (click)="fileIn.click()">Choose a .json file</ui-button>
          </div>
        </div>
        <div modal-footer>
          <ui-button variant="ghost" (click)="importOpen.set(false)">Cancel</ui-button>
          <ui-button [disabled]="!importText().trim()" (click)="doImport()">Import form</ui-button>
        </div>
      </ui-modal>
    }

    <ui-confirm-dialog [open]="!!toDelete()" (openChange)="!$event && toDelete.set(null)" [destructive]="true"
      [title]="'Delete “' + (toDelete()?.draft?.title ?? '') + '”?'" [message]="deleteMessage()" confirmLabel="Delete form"
      (confirm)="deleteForm()" />
    <ui-confirm-dialog [open]="confirmReset()" (openChange)="confirmReset.set($event)" [destructive]="true"
      title="Reset the studio?" message="Every form and answer saved here is deleted, and the sample form comes back." confirmLabel="Reset studio"
      (confirm)="reset()" />
  `,
  // Split by view so no one stylesheet passes the component-style budget: shared + one form here,
  // the library and the answers tab in their own files.
  styleUrls: ['./form-studio.library.css', './form-studio.answers.css'],
  styles: `
    /* The shell's top bar is 52px plus its 1px border. */
    :host { display: flex; flex-direction: column; height: calc(100dvh - 53px); min-height: 520px; }
    /* Ghost buttons at the start or end of a column: their text lines up with the text around them, not their padding. */
    .flush-start { margin-left: calc(var(--ui-space-3) * -1); }
    .flush-end { margin-right: calc(var(--ui-space-3) * -1); }
    h1, h2 { margin: 0; text-wrap: balance; }
    .scroll { flex: 1; min-height: 0; overflow: auto; }
    .grow { flex: 1; }
    .when { color: var(--ui-color-text-muted); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .note { margin: 0 0 var(--ui-space-3); padding: var(--ui-space-2) var(--ui-space-3); border-radius: var(--ui-radius); font-size: 13px;
      color: var(--ui-color-text-secondary); background: var(--ui-color-surface-hover); }
    .save-error { margin: 0; padding: var(--ui-space-2) var(--ui-space-4); font-size: 13px; color: var(--ui-color-text);
      background: color-mix(in srgb, var(--ui-color-danger) 14%, var(--ui-color-surface)); }

    /* One form */
    .bar { display: flex; align-items: center; gap: var(--ui-space-3); padding: var(--ui-space-2) var(--ui-space-4);
      border-bottom: 1px solid var(--ui-color-border); background: var(--ui-color-surface); flex-wrap: wrap; }
    .title { display: flex; align-items: center; gap: var(--ui-space-2); min-width: 0; flex: 1; }
    .title ui-chip { flex: none; white-space: nowrap; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .st-short { display: none; }
    @media (max-width: 420px) { .st-long { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); } .st-short { display: inline; } }
    .title h1 { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .builder { flex: 1; min-height: 0; }
    .fb-actions { margin-left: var(--ui-space-2); }
    .sheet { max-width: 760px; margin: 0 auto; padding: var(--ui-space-6) var(--ui-space-4); }
    .sheet.wide { max-width: 1080px; display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-4); }
    .json { min-width: 0; display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .json-head { display: flex; align-items: center; gap: var(--ui-space-2); flex-wrap: wrap; }
    .json-head h2 { font-size: 15px; }
    .json-head .hint { flex: 1; font-size: 12px; color: var(--ui-color-text-muted); }
    .json pre { margin: 0; height: calc(100dvh - 230px); min-height: 280px; overflow: auto; padding: var(--ui-space-3); font-size: 12px; line-height: 1.5;
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); }
    .json pre:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }

    @media (max-width: 900px) {
      .sheet { padding: var(--ui-space-4); }
      .sheet.wide { grid-template-columns: 1fr; }
      .json pre { height: 420px; }
    }
    @media (max-width: 760px) {
      .tabs { order: 3; width: 100%; }
    }
  `,
})
export class FormStudioPage {
  protected readonly store = inject(FormStudioStore);
  protected readonly backIcon = ArrowLeft01Icon;
  private readonly router = inject(Router);
  private readonly toast = inject(UiToastService);
  protected readonly query = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => ({ form: q.get('form'), tab: q.get('tab'), answer: q.get('answer'), view: q.get('view') }))));
  protected readonly builder = viewChild(UiFormBuilder);

  /** The open form, tab and answer live in the URL, so reloads and the back button keep your place. */
  protected readonly current = computed(() => this.store.get(this.query()?.form ?? null));
  protected readonly tab = computed<Tab>(() => (['build', 'fill', 'answers', 'json'].includes(this.query()?.tab ?? '') ? this.query()!.tab as Tab : 'build'));
  protected readonly answer = computed(() => this.current()?.responses.find((r) => r.id === this.query()?.answer));
  protected readonly tabOptions = computed(() => {
    const n = this.current()?.responses.length ?? 0;
    return [
      { value: 'build', label: 'Edit form' },
      { value: 'fill', label: 'Fill in' },
      { value: 'answers', label: n ? `Answers (${n})` : 'Answers' },
      { value: 'json', label: 'JSON' },
    ];
  });

  protected readonly editing = signal(false);
  protected readonly justSaved = signal(false);
  protected readonly lastId = signal<string | null>(null);
  protected readonly toDelete = signal<StudioForm | null>(null);
  protected readonly confirmReset = signal(false);
  protected readonly confirmAnswerDelete = signal(false);
  protected readonly importOpen = signal(false);
  protected readonly importText = signal('');
  protected readonly importError = signal('');
  protected readonly deleteMessage = computed(() => {
    const n = this.toDelete()?.responses.length ?? 0;
    return n ? `Its ${n} saved answer${n > 1 ? 's go' : ' goes'} with it. This can’t be undone.` : 'This can’t be undone.';
  });

  /** No server here: keep the file's details in the answer so it round-trips as JSON. */
  protected readonly uploader: UiFbUploader = async (file) => ({ name: file.name, size: file.size, type: file.type });

  protected openSettings(): void {
    this.router.navigate([], { queryParams: { view: 'settings' } });
  }

  protected open(id: string | null, tab: Tab = 'build'): void {
    this.editing.set(false);
    this.justSaved.set(false);
    this.router.navigate([], { queryParams: id ? { form: id, tab } : {} });
  }
  protected setTab(tab: Tab): void {
    this.editing.set(false);
    this.justSaved.set(false);
    this.router.navigate([], { queryParams: { form: this.current()?.id, tab }, queryParamsHandling: 'replace' });
  }
  protected openAnswer(id: string | null): void {
    this.editing.set(false);
    this.justSaved.set(false);
    this.router.navigate([], { queryParams: { form: this.current()?.id, tab: 'answers', answer: id ?? undefined } });
  }

  protected newForm(): void {
    this.open(this.store.create().id);
  }
  protected duplicate(id: string): void {
    const f = this.store.duplicate(id);
    if (f) this.toast.success(`Saved as “${f.draft.title}”.`);
  }
  protected deleteForm(): void {
    const f = this.toDelete();
    if (f) this.store.remove(f.id);
    this.toDelete.set(null);
  }
  protected reset(): void {
    this.store.reset();
    this.toast.success('The studio is back to the sample form.');
  }

  protected changed(f: StudioForm): boolean {
    return comparable(f.draft) !== comparable(f.published);
  }
  protected statusText(f: StudioForm): string {
    if (!f.published) return 'Draft';
    return this.changed(f) ? 'Unpublished changes' : `Published v${f.published.revision ?? 1}`;
  }
  protected statusShort(f: StudioForm): string {
    return !f.published ? 'Draft' : this.changed(f) ? 'Changed' : `v${f.published.revision ?? 1}`;
  }
  protected statusTone(f: StudioForm): 'neutral' | 'success' | 'warning' {
    return !f.published ? 'neutral' : this.changed(f) ? 'warning' : 'success';
  }

  protected publish(f: StudioForm): void {
    const problems = this.builder()?.problems().filter((p) => p.severity === 'error') ?? [];
    if (problems.length) {
      this.toast.warning(`Fix ${problems.length} problem${problems.length > 1 ? 's' : ''} first. They’re listed under Logic.`);
      return;
    }
    const def = this.store.publish(f.id);
    this.toast.success(`Version ${def?.revision} is live. Fill in now uses it.`);
  }

  protected saveNew(f: StudioForm, s: UiFormSubmission): void {
    const r = this.store.addResponse(f.id, s.data, s.revision ?? f.published?.revision ?? 1);
    this.lastId.set(r.id);
    this.justSaved.set(true);
  }
  protected saveEdit(f: StudioForm, r: StudioResponse, s: UiFormSubmission): void {
    this.store.updateResponse(f.id, r.id, s.data, s.revision ?? r.revision);
    this.editing.set(false);
    this.toast.success('Changes saved.');
  }
  protected deleteAnswer(f: StudioForm): void {
    const r = this.answer();
    if (r) this.store.removeResponse(f.id, r.id);
    this.confirmAnswerDelete.set(false);
    this.openAnswer(null);
  }

  protected counts(f: StudioForm): string {
    const q = allFields(f.draft).filter((x) => !x.archived).length;
    const p = f.draft.pages.length;
    const a = f.responses.length;
    return [`${q} question${q === 1 ? '' : 's'}`, p > 1 ? `${p} pages` : '', `${a} answer${a === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
  }
  /** The first text answer names the row (usually the person's name). */
  protected headline(f: StudioForm, r: StudioResponse): string {
    for (const fld of allFields(f.published ?? f.draft)) {
      const v = r.data[fld.key];
      if (typeof v === 'string' && v.trim() && ['text', 'email'].includes(fld.type)) return v;
    }
    return 'Answer';
  }
  protected subline(f: StudioForm, r: StudioResponse): string {
    const parts: string[] = [];
    for (const fld of allFields(f.published ?? f.draft)) {
      const v = r.data[fld.key];
      if (isEmptyValue(v) || (typeof v === 'object' && !Array.isArray(v))) continue;
      const text = formatValue(fld, v);
      if (text && text !== this.headline(f, r)) parts.push(text);
      if (parts.length === 2) break;
    }
    return parts.join(' · ') || 'No answers shown on the list';
  }
  protected when(iso: string): string {
    return dateTime.format(new Date(iso));
  }

  protected formJson(f: StudioForm): string {
    return JSON.stringify(f.draft, null, 2);
  }
  protected answersJson(f: StudioForm): string {
    return JSON.stringify(f.responses.map((r) => ({ id: r.id, revision: r.revision, submittedAt: r.submittedAt, updatedAt: r.updatedAt, data: r.data })), null, 2);
  }
  protected async copy(text: string, done: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success(done);
    } catch {
      this.toast.warning('The browser blocked copying. Use Download instead.');
    }
  }
  protected download(text: string, name: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name.replace(/[\\/:*?"<>|]+/g, '-');
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  protected async pickFile(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.importText.set(await file.text());
    this.importError.set('');
  }
  protected doImport(): void {
    try {
      const f = this.store.import(JSON.parse(this.importText()));
      this.importOpen.set(false);
      this.importText.set('');
      this.open(f.id);
    } catch (err) {
      this.importError.set(err instanceof SyntaxError ? 'That isn’t valid JSON. Check it was copied in full.' : (err as Error).message || 'That isn’t a form.');
    }
  }
}
