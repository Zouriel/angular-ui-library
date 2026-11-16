import { Injectable, computed, signal } from '@angular/core';
import { allFields, createDefinition, fbCreateRevision, fbDefaultLocale, fbText, fbUid, migrateDefinition, UiFbMemoryRevisionStore, type UiFbElement, type UiFbLocalizedText, type UiFormDefinition, type UiFormGlobalSettings } from '@zouriel/ui/form-builder';
import { SAMPLE_ANSWERS, SAMPLE_FORM } from './form-builder.sample';

/** One saved answer set. `revision` is the published revision it was last saved against. */
export interface StudioResponse {
  id: string;
  revision: number;
  data: Record<string, unknown>;
  submittedAt: string;
  updatedAt?: string;
  /** The language the form was filled in. */
  locale?: string;
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
const REVISIONS_KEY = 'zui-form-studio-revisions-v1';

/** Dhivehi (Thaana) wording for the sample form, by element id (and option id), so the demo is bilingual. */
const DV: Record<string, string> = {
  p1: 'ތިބާގެ މައުލޫމާތު', p2: 'ގެދޮރު', p3: 'ތިބާގެ އެޕްލިކޭޝަން',
  f_name: 'ފުރިހަމަ ނަން', f_pref: 'ގޮވާނެ ނަން', f_email: 'އީމެއިލް އެޑްރެސް', f_phone: 'މޮބައިލް ނަންބަރު', f_dob: 'ވިލާދަތް', f_age: 'އުމުރު',
  f_status: 'މިހާރު ކިޔަވަނީ ހެއްޔެވެ؟', o_s1: 'ފުލް ޓައިމް', o_s2: 'ޕާޓް ޓައިމް', o_s3: 'ނުކިޔަވަމެވެ',
  f_inst: 'ސްކޫލް ނުވަތަ ޔުނިވަރސިޓީ', g_deps: 'ބަރަބަރުކުރާ މީހުން', f_dep_name: 'ނަން', f_prog: 'ޕްރޮގްރާމް',
  f_statement: 'ޕާސަނަލް ސްޓޭޓްމަންޓް', f_consent: 'އިޤްރާރު',
};

/** [def] with English and Dhivehi wording: the form title, page titles, and the questions listed in `DV`. */
export function bilingual(def: UiFormDefinition): UiFormDefinition {
  const two = (id: string, en: UiFbLocalizedText | undefined): UiFbLocalizedText | undefined => (DV[id] && typeof en === 'string' ? { en, dv: DV[id] } : en);
  const walk = (els: UiFbElement[]): UiFbElement[] => els.map((e) => {
    if (e.kind === 'field') return { ...e, label: two(e.id, e.label) ?? e.label, options: e.options?.map((o) => ({ ...o, label: two(o.id, o.label) ?? o.label })) };
    if (e.kind === 'group') return { ...e, title: two(e.id, e.title), elements: walk(e.elements) };
    return e;
  });
  return {
    ...def,
    defaultLocale: 'en',
    supportedLocales: [{ code: 'en', label: 'English' }, { code: 'dv', label: 'ދިވެހި', dir: 'rtl' }],
    title: typeof def.title === 'string' ? { en: def.title, dv: 'ސްކޮލަރޝިޕް އެޕްލިކޭޝަން' } : def.title,
    pages: def.pages.map((p) => ({ ...p, title: two(p.id, p.title), elements: walk(p.elements) })),
  };
}

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
  /** Every published version of every form, so any of them can be looked at or restored. */
  readonly revisions = new UiFbMemoryRevisionStore({ storageKey: REVISIONS_KEY });
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
    const draft: UiFormDefinition = { ...structuredClone(src.draft), id: fbUid('form'), title: fbText(src.draft.title, null, fbDefaultLocale(src.draft)) + ' (copy)', revision: 0 };
    const form: StudioForm = { id: fbUid('form'), draft, published: null, responses: [], createdAt: now, updatedAt: now };
    this.write([form, ...this.forms()]);
    return form;
  }

  remove(id: string): void {
    this.revisions.clear(id);
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
      this.revisions.saveRevision(fbCreateRevision({ ...draft, id: f.id }, f.published, { publishedBy: 'You' }));
      return { ...f, draft, published: structuredClone(draft) };
    });
    return out;
  }

  addResponse(id: string, data: Record<string, unknown>, revision: number, locale?: string): StudioResponse {
    const r: StudioResponse = { id: fbUid('resp'), revision, data, submittedAt: new Date().toISOString(), ...(locale ? { locale } : {}) };
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
    this.revisions.clear();
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

  /** The sample scholarship form (English and Dhivehi), published as versions 1 and 2 with one answer, so there's something to edit and restore straight away. */
  private seed(): StudioForm[] {
    const now = new Date().toISOString();
    const draft = bilingual(structuredClone(SAMPLE_FORM));
    draft.id = 'form_sample';
    draft.revision = 2;
    // Version 1 had no phone question and no Dhivehi.
    const v1: UiFormDefinition = structuredClone(draft);
    v1.revision = 1;
    v1.pages = v1.pages.map((p) => ({ ...p, elements: p.elements.filter((e) => e.id !== 'f_phone') }));
    const earlier = new Date(Date.now() - 6 * 86400000).toISOString();
    this.revisions.clear('form_sample');
    this.revisions.saveRevision(fbCreateRevision(v1, null, { publishedBy: 'You', publishedAt: earlier, summary: 'First version' }));
    this.revisions.saveRevision(fbCreateRevision(draft, v1, { publishedBy: 'You', publishedAt: now }));
    return [{
      id: 'form_sample',
      draft,
      published: structuredClone(draft),
      responses: [{ id: 'resp_sample', revision: 2, data: structuredClone(SAMPLE_ANSWERS), submittedAt: now, locale: 'en' }],
      createdAt: now,
      updatedAt: now,
    }];
  }
}
