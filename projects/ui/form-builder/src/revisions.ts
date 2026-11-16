/**
 * Version history of a form: a snapshot is kept every time the form is published, and any
 * earlier version can be brought back as a new draft. Pure functions plus a ready-made
 * in-memory store; an app with a backend implements `UiFbRevisionStore` itself.
 */
import { computed, signal, type Signal } from '@angular/core';
import { diffDefinitions, type UiFbDiff } from './definition';
import type { UiFbElement, UiFbGroup, UiFbOption, UiFbPage, UiFormDefinition } from './schema';

/** One published version of a form. */
export interface UiFbRevision {
  formId: string;
  revision: number;
  /** The full definition as published. */
  definition: UiFormDefinition;
  publishedAt: string;
  publishedBy?: string;
  /** One line saying what this version changed. */
  summary?: string;
  /** What changed since the version before it (stored so the history needn't recompute it). */
  diff?: UiFbDiff;
}

export type UiFbMaybeAsync<T> = T | Promise<T>;

/** Where an app keeps its form versions. Every method may be synchronous or return a Promise. */
export interface UiFbRevisionStore {
  /** Every published version of the form, newest first. */
  listRevisions(formId: string): UiFbMaybeAsync<UiFbRevision[]>;
  getRevision(formId: string, revision: number): UiFbMaybeAsync<UiFbRevision | null>;
  /** Stores a version, replacing an entry with the same form and revision number. */
  saveRevision(entry: UiFbRevision): UiFbMaybeAsync<void>;
  /** A new DRAFT with the content of [targetRevision], built with `rollbackDefinition`. Nothing is published. */
  rollback(formId: string, targetRevision: number, current?: UiFormDefinition): UiFbMaybeAsync<UiFormDefinition>;
}

export interface UiFbRevisionMeta {
  publishedBy?: string;
  summary?: string;
  publishedAt?: string;
}

/** A one-line summary from a diff's lines: the first three, then "and N more". */
export function fbRevisionSummary(diff: UiFbDiff | null | undefined): string {
  const lines = diff?.summary ?? [];
  if (!lines.length) return 'No changes to the questions';
  const shown = lines.slice(0, 3).join('. ');
  return lines.length > 3 ? `${shown}, and ${lines.length - 3} more` : shown;
}

/** The snapshot to store when [definition] is published. [previous] is the version published before it. */
export function fbCreateRevision(definition: UiFormDefinition, previous?: UiFormDefinition | null, meta: UiFbRevisionMeta = {}): UiFbRevision {
  const def = structuredClone(definition);
  const diff = previous ? diffDefinitions(previous, def) : undefined;
  const entry: UiFbRevision = {
    formId: def.id,
    revision: def.revision ?? 1,
    definition: def,
    publishedAt: meta.publishedAt ?? new Date().toISOString(),
    summary: meta.summary ?? (previous ? fbRevisionSummary(diff) : 'First version'),
  };
  if (meta.publishedBy) entry.publishedBy = meta.publishedBy;
  if (diff) entry.diff = diff;
  return entry;
}

// ── Rollback ──────────────────────────────────────────────────────────────

function walk(elements: UiFbElement[], fn: (el: UiFbElement) => void): void {
  for (const el of elements) {
    fn(el);
    if (el.kind === 'group') walk(el.elements, fn);
  }
}

function idsOf(def: UiFormDefinition): Set<string> {
  const ids = new Set<string>();
  for (const p of def.pages) walk(p.elements, (e) => ids.add(e.id));
  return ids;
}

function byId(def: UiFormDefinition): Map<string, UiFbElement> {
  const m = new Map<string, UiFbElement>();
  for (const p of def.pages) walk(p.elements, (e) => m.set(e.id, e));
  return m;
}

function mergeHistory(own: string | undefined, ...lists: (string | string[] | undefined)[]): string[] {
  const out: string[] = [];
  for (const l of lists) for (const k of Array.isArray(l) ? l : l ? [l] : []) if (k && k !== own && !out.includes(k)) out.push(k);
  return out;
}

/** A copy of a removed element that stays on the form as archived, minus children the target still has elsewhere. */
function archivedCopy(el: UiFbElement, keep: Set<string>): UiFbElement {
  const copy = structuredClone(el);
  const mark = (e: UiFbElement) => {
    e.archived = true;
    if (e.kind === 'group') {
      e.elements = e.elements.filter((c) => !keep.has(c.id));
      e.elements.forEach(mark);
    }
  };
  mark(copy);
  return copy;
}

/**
 * The draft that brings [target] back while keeping every saved answer readable. Pure.
 *
 * - It has [target]'s content, but [current]'s `id` and `revision`, so the next publish counts up cleanly.
 * - A question or section in [current] that [target] doesn't have stays, archived, on the page it was on
 *   (the last page if that page is gone; inside its section if that section still exists).
 * - An option in [current] that [target] doesn't have stays, archived.
 * - If a question's data key differs, the restored one takes [target]'s key and `keyHistory` gains the
 *   old keys (never its own), so answers saved under any older key still load.
 * - Anything archived in [current] but live in [target] is live again.
 */
export function rollbackDefinition(target: UiFormDefinition, current: UiFormDefinition): UiFormDefinition {
  const out = structuredClone(target);
  out.id = current.id;
  if (current.revision !== undefined) out.revision = current.revision;
  else delete out.revision;

  const cur = byId(current);
  const targetIds = idsOf(target);
  const resultById = new Map<string, UiFbElement>();
  for (const p of out.pages) walk(p.elements, (e) => resultById.set(e.id, e));

  // Keys and options of elements both versions have.
  for (const [id, el] of resultById) {
    const old = cur.get(id);
    if (!old) continue;
    if ((el.kind === 'field' || el.kind === 'group') && (old.kind === 'field' || old.kind === 'group')) {
      const history = mergeHistory(el.key, el.keyHistory, old.keyHistory, old.key);
      if (history.length) el.keyHistory = history;
    }
    if (el.kind === 'field' && old.kind === 'field' && old.options?.length) {
      const have = new Set((el.options ?? []).map((o) => o.value));
      const extra: UiFbOption[] = old.options.filter((o) => !have.has(o.value)).map((o) => ({ ...structuredClone(o), archived: true }));
      if (extra.length) el.options = [...(el.options ?? []), ...extra];
    }
  }

  // Elements only the current draft has: kept, archived.
  const lastPage = out.pages[out.pages.length - 1];
  const place = (el: UiFbElement, pageId: string, groupId?: string) => {
    const group = groupId ? resultById.get(groupId) : undefined;
    const into: UiFbElement[] | undefined = group?.kind === 'group' ? (group as UiFbGroup).elements : undefined;
    const page: UiFbPage | undefined = out.pages.find((p) => p.id === pageId) ?? lastPage;
    const list = into ?? page?.elements;
    const copy = archivedCopy(el, targetIds);
    list?.push(copy);
    walk([copy], (e) => resultById.set(e.id, e));
  };
  const collect = (elements: UiFbElement[], pageId: string, groupId?: string) => {
    for (const el of elements) {
      if (!targetIds.has(el.id)) place(el, pageId, groupId);
      else if (el.kind === 'group') collect(el.elements, pageId, el.id);
    }
  };
  for (const p of current.pages) collect(p.elements, p.id);
  return out;
}

// ── In-memory store ───────────────────────────────────────────────────────

export interface UiFbMemoryRevisionStoreOptions {
  /** Keep the history in `localStorage` under this key, so it survives a reload. */
  storageKey?: string;
}

/** A synchronous, signal-based revision store for demos, tests and small apps. */
export class UiFbMemoryRevisionStore implements UiFbRevisionStore {
  private readonly list = signal<UiFbRevision[]>([]);
  /** Every stored revision of every form (for templates that react to changes). */
  readonly all: Signal<UiFbRevision[]> = this.list.asReadonly();
  private readonly storageKey?: string;

  constructor(options: UiFbMemoryRevisionStoreOptions = {}) {
    this.storageKey = options.storageKey;
    if (this.storageKey) this.list.set(this.load());
  }

  /** The form's revisions, newest first, as a signal. */
  revisions(formId: string): Signal<UiFbRevision[]> {
    let c = this.cache.get(formId);
    if (!c) {
      c = computed(() => this.list().filter((r) => r.formId === formId).sort((x, y) => y.revision - x.revision));
      this.cache.set(formId, c);
    }
    return c;
  }
  private readonly cache = new Map<string, Signal<UiFbRevision[]>>();

  listRevisions(formId: string): UiFbRevision[] {
    return this.revisions(formId)();
  }
  getRevision(formId: string, revision: number): UiFbRevision | null {
    return this.list().find((r) => r.formId === formId && r.revision === revision) ?? null;
  }
  saveRevision(entry: UiFbRevision): void {
    const copy = structuredClone(entry);
    this.list.update((all) => [...all.filter((r) => !(r.formId === copy.formId && r.revision === copy.revision)), copy]);
    this.persist();
  }
  rollback(formId: string, targetRevision: number, current?: UiFormDefinition): UiFormDefinition {
    const target = this.getRevision(formId, targetRevision);
    if (!target) throw new Error(`Version ${targetRevision} of this form was not found.`);
    const base = current ?? this.listRevisions(formId)[0]?.definition ?? target.definition;
    return rollbackDefinition(target.definition, base);
  }
  /** Forgets the history of one form, or of every form. */
  clear(formId?: string): void {
    this.list.update((all) => (formId ? all.filter((r) => r.formId !== formId) : []));
    this.persist();
  }

  private load(): UiFbRevision[] {
    try {
      const raw = globalThis.localStorage?.getItem(this.storageKey!);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  private persist(): void {
    if (!this.storageKey) return;
    try { globalThis.localStorage?.setItem(this.storageKey, JSON.stringify(this.list())); } catch { /* storage full or blocked: keep it in memory */ }
  }
}
