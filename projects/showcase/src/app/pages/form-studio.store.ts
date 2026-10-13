import { Injectable, computed, signal } from '@angular/core';
import { allFields, createDefinition, fbUid, migrateDefinition, type UiFormDefinition, type UiFormGlobalSettings } from '@zouriel/ui/form-builder';
import { SAMPLE_ANSWERS, SAMPLE_FORM } from './form-builder.sample';

/** One saved answer set. `revision` is the published revision it was last saved against. */
export interface StudioResponse {
  id: string;
  revision: number;
  data: Record<string, unknown>;
  submittedAt: string;
  updatedAt?: string;
}

/** A form in the studio: the draft being built, the version people answer, and its answers. */
export interface StudioForm {
  id: string;
  draft: UiFormDefinition;
  published: UiFormDefinition | null;
  responses: StudioResponse[];
  createdAt: string;
  updatedAt: string;
}

const KEY = 'zui-form-studio-v1';
const SETTINGS_KEY = 'zui-form-studio-settings-v1';

/** The studio's app-wide settings to start with: one list over a real public API, so the HTTP path is live. */
export function demoSettings(): UiFormGlobalSettings {
  return {
    version: 1,
    defaults: {},
    sources: [{
      type: 'people',
      label: 'People (dummyjson.com)',
      description: 'A public test API with 208 people, searched by name.',
      url: 'https://dummyjson.com/users/search',
      paging: 'offset',
      pageParam: 'skip',
      pageSizeParam: 'limit',
      pageSize: 20,
      itemsPath: 'users',
      valueField: 'id',
      labelField: '{firstName} {lastName}',
      descriptionField: 'email',
      totalPath: 'total',
    }],
  };
}

/**
 * The showcase's stand-in for a backend: forms and answers live in this browser's
 * localStorage, so they survive reloads and new tabs (not other browsers).
 */
@Injectable({ providedIn: 'root' })
export class FormStudioStore {
  readonly forms = signal<StudioForm[]>(this.read());
  /** App-wide form settings (shared lists, new-form defaults), as an app would keep them on its server. */
  readonly settings = signal<UiFormGlobalSettings>(this.readSettings());
  /** How many forms use each list, for warnings in the settings screen. */
  readonly usage = computed(() => {
    const out: Record<string, number> = {};
    for (const f of this.forms()) {
      const types = new Set(allFields(f.draft).map((x) => x.source?.type).filter((t): t is string => !!t));
      types.forEach((t) => (out[t] = (out[t] ?? 0) + 1));
    }
    return out;
  });
  /** Set when the browser refused to save (storage full or blocked). */
  readonly saveError = signal('');
  readonly sorted = computed(() => [...this.forms()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));

  get(id: string | null): StudioForm | undefined {
    return id ? this.forms().find((f) => f.id === id) : undefined;
  }

  create(title = 'Untitled form'): StudioForm {
    const now = new Date().toISOString();
    const form: StudioForm = { id: fbUid('form'), draft: createDefinition(title, this.settings().defaults), published: null, responses: [], createdAt: now, updatedAt: now };
    this.write([form, ...this.forms()]);
    return form;
  }

  /** Adds a form from pasted or uploaded JSON. Throws if it isn't a form. */
  import(raw: unknown): StudioForm {
    // migrateDefinition fills in a blank page, so check for pages before it does.
    const pages = raw && typeof raw === 'object' ? (raw as { pages?: unknown }).pages : undefined;
    if (!Array.isArray(pages) || !pages.length) throw new Error('That JSON has no pages, so it isn’t a form.');
    const draft = migrateDefinition(raw);
    const now = new Date().toISOString();
    const form: StudioForm = { id: fbUid('form'), draft: { ...draft, id: draft.id || fbUid('form') }, published: null, responses: [], createdAt: now, updatedAt: now };
    this.write([form, ...this.forms()]);
    return form;
  }

  duplicate(id: string): StudioForm | undefined {
    const src = this.get(id);
    if (!src) return;
    const now = new Date().toISOString();
    const draft: UiFormDefinition = { ...structuredClone(src.draft), id: fbUid('form'), title: `${src.draft.title} (copy)`, revision: 0 };
    const form: StudioForm = { id: fbUid('form'), draft, published: null, responses: [], createdAt: now, updatedAt: now };
    this.write([form, ...this.forms()]);
    return form;
  }

  remove(id: string): void {
    this.write(this.forms().filter((f) => f.id !== id));
  }

  setDraft(id: string, draft: UiFormDefinition): void {
    this.patch(id, (f) => ({ ...f, draft }));
  }

  /** Makes the draft the version people answer, bumping its revision. */
  publish(id: string): UiFormDefinition | undefined {
    let out: UiFormDefinition | undefined;
    this.patch(id, (f) => {
      const draft = { ...f.draft, revision: (f.published?.revision ?? f.draft.revision ?? 0) + 1 };
      out = draft;
      return { ...f, draft, published: structuredClone(draft) };
    });
    return out;
  }

  addResponse(id: string, data: Record<string, unknown>, revision: number): StudioResponse {
    const r: StudioResponse = { id: fbUid('resp'), revision, data, submittedAt: new Date().toISOString() };
    this.patch(id, (f) => ({ ...f, responses: [r, ...f.responses] }));
    return r;
  }

  updateResponse(id: string, responseId: string, data: Record<string, unknown>, revision: number): void {
    const updatedAt = new Date().toISOString();
    this.patch(id, (f) => ({ ...f, responses: f.responses.map((r) => (r.id === responseId ? { ...r, data, revision, updatedAt } : r)) }));
  }

  removeResponse(id: string, responseId: string): void {
    this.patch(id, (f) => ({ ...f, responses: f.responses.filter((r) => r.id !== responseId) }));
  }

  /** Stores the app-wide settings (shared lists, new-form defaults). */
  saveSettings(settings: UiFormGlobalSettings): void {
    this.settings.set(settings);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { this.saveError.set('This browser wouldn’t save the settings.'); }
  }

  private readSettings(): UiFormGlobalSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw) as UiFormGlobalSettings;
    } catch { /* fall through to the demo */ }
    return demoSettings();
  }

  /** Clears every form and answer, puts the sample form back and restores the demo settings. */
  reset(): void {
    this.saveSettings(demoSettings());
    this.write(this.seed());
  }

  private patch(id: string, fn: (f: StudioForm) => StudioForm): void {
    const now = new Date().toISOString();
    this.write(this.forms().map((f) => (f.id === id ? { ...fn(f), updatedAt: now } : f)));
  }

  private write(forms: StudioForm[]): void {
    this.forms.set(forms);
    try {
      localStorage.setItem(KEY, JSON.stringify(forms));
      this.saveError.set('');
    } catch {
      this.saveError.set('This browser wouldn’t save the latest change (storage may be full). Export anything you want to keep.');
    }
  }

  private read(): StudioForm[] {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const forms = JSON.parse(raw) as StudioForm[];
        if (Array.isArray(forms)) return forms.map((f) => ({ ...f, draft: migrateDefinition(f.draft), published: f.published ? migrateDefinition(f.published) : null }));
      }
    } catch { /* unreadable: start from the sample */ }
    return this.seed();
  }

  /** The sample scholarship form, published with one answer, so there's something to edit straight away. */
  private seed(): StudioForm[] {
    const now = new Date().toISOString();
    const draft = structuredClone(SAMPLE_FORM);
    return [{
      id: 'form_sample',
      draft,
      published: structuredClone(draft),
      responses: [{ id: 'resp_sample', revision: draft.revision ?? 1, data: structuredClone(SAMPLE_ANSWERS), submittedAt: now }],
      createdAt: now,
      updatedAt: now,
    }];
  }
}
