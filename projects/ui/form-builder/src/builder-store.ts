import { Injectable, computed, signal } from '@angular/core';
import { describeCalc } from './calc';
import { describeCondition, type UiFbDescribeContext } from './conditions';
import {
  createDefinition,
  createPage,
  canDrop,
  diffDefinitions,
  duplicateElement,
  elementName,
  externalReferences,
  indexDefinition,
  insertElement,
  lintDefinition,
  migrateDefinition,
  moveElement,
  removeElement,
  removeReferences,
  renameKey,
  subtreeIds,
  updateElement,
  updatePage,
  type UiFbDropTarget,
  type UiFbIndexEntry,
  type UiFbProblem,
} from './definition';
import { fieldTypeInfo, valueKindOf, type UiFbValueKind } from './field-types';
import { formatValue } from './format';
import type { UiFbCondition, UiFbElement, UiFbField, UiFbGroup, UiFbPage, UiFbSettings, UiFbStatic, UiFormDefinition } from './schema';
import { UI_FB_BUILTIN_VALIDATORS, type UiFbValidatorDef } from './validators';
import type { UiFbOptionSourceDef } from './option-sources';

/** Something a rule can ask about: a field, a section or a page. */
export interface UiFbRefOption {
  id: string;
  label: string;
  kind: UiFbValueKind | 'group' | 'repeat' | 'page';
  /** Where it is, for telling same-named things apart. */
  where: string;
}

const HISTORY_LIMIT = 200;
let builderSeq = 0;
/** Edits to the same setting within this window are undone together (typing a label). */
const MERGE_MS = 1200;

/**
 * Builder state: the definition being edited, what's selected, and undo/redo.
 * Every change goes through `commit` so it can be undone.
 */
@Injectable()
export class FbBuilderStore {
  /** Prefix for element ids, unique per builder on the page. */
  readonly uid = `fb${++builderSeq}`;
  readonly def = signal<UiFormDefinition>(createDefinition());
  /** The version people are answering now; drives "this field has answers" warnings. */
  readonly published = signal<UiFormDefinition | null>(null);
  readonly submissionCount = signal(0);
  readonly validatorDefs = signal<readonly UiFbValidatorDef[]>(UI_FB_BUILTIN_VALIDATORS);
  /** Lists the app can search (see provideUiFormOptionSources). */
  readonly optionSourceDefs = signal<readonly UiFbOptionSourceDef[]>([]);
  /** An element id, a page id, or null for the form itself. */
  readonly selectedId = signal<string | null>(null);
  readonly pageIndex = signal(0);

  readonly index = computed(() => indexDefinition(this.def()));
  readonly problems = computed(() => [...lintDefinition(this.def()), ...this.sourceProblems()]);
  /** Sourced fields whose source this app doesn't offer, or whose required settings are empty. */
  private readonly sourceProblems = computed<UiFbProblem[]>(() => {
    const out: UiFbProblem[] = [];
    for (const e of this.index().values()) {
      const f = e.element as UiFbElement;
      if (e.kind !== 'field' || f.kind !== 'field' || !f.source || f.archived) continue;
      const def = this.optionSourceDefs().find((d) => d.type === f.source!.type);
      const name = `“${this.name(f.id)}”`;
      if (!def) { out.push({ severity: 'error', targetId: f.id, message: `${name} uses a data source this app doesn’t provide (“${f.source.type}”). Pick another, or switch to a typed list.` }); continue; }
      for (const p of def.params ?? []) {
        const v = f.source.params?.[p.key];
        const set = !!v && ('ref' in v ? !!v.ref : v.const != null && v.const !== '');
        if (p.required && !set) out.push({ severity: 'error', targetId: f.id, message: `${name} needs “${p.label}” set for its ${def.label} list.` });
      }
    }
    return out;
  });
  readonly problemIds = computed(() => new Set(this.problems().filter((p) => p.severity === 'error').map((p) => p.targetId)));
  readonly page = computed<UiFbPage>(() => this.def().pages[Math.min(this.pageIndex(), this.def().pages.length - 1)]);
  readonly selected = computed<UiFbIndexEntry | null>(() => (this.selectedId() ? this.index().get(this.selectedId()!) ?? null : null));
  readonly diff = computed(() => (this.published() ? diffDefinitions(this.published()!, this.def()) : null));
  /** Whether the form already has answers (so some changes need care). */
  readonly live = computed(() => !!this.published() && this.submissionCount() > 0);
  readonly archived = computed(() => [...this.index().values()].filter((e) => e.kind !== 'page' && (e.element as UiFbElement).archived));

  private past: UiFormDefinition[] = [];
  private future: UiFormDefinition[] = [];
  private lastMerge: { key: string; at: number } | null = null;
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);
  /** Bumped on every commit, so hosts can tell their own echo from a new definition. */
  readonly version = signal(0);

  // ── History ─────────────────────────────────────────────────────────────

  /** Replaces the whole definition (e.g. a different form was opened). Clears history. */
  load(raw: UiFormDefinition): void {
    const def = migrateDefinition(raw);
    this.def.set(def);
    this.past = [];
    this.future = [];
    this.lastMerge = null;
    this.syncHistory();
    if (this.selectedId() && !indexDefinition(def).has(this.selectedId()!)) this.selectedId.set(null);
    this.pageIndex.set(Math.min(this.pageIndex(), def.pages.length - 1));
  }

  /** Applies a change. Changes with the same `mergeKey` in quick succession undo as one. */
  commit(next: UiFormDefinition, mergeKey?: string): void {
    const cur = this.def();
    if (next === cur) return;
    const now = Date.now();
    const merge = !!mergeKey && this.lastMerge?.key === mergeKey && now - this.lastMerge.at < MERGE_MS;
    if (!merge) {
      this.past.push(cur);
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
    }
    this.lastMerge = mergeKey ? { key: mergeKey, at: now } : null;
    this.future = [];
    this.def.set(next);
    this.version.update((v) => v + 1);
    this.syncHistory();
  }

  undo(): void {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.def());
    this.def.set(prev);
    this.afterTravel();
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.def());
    this.def.set(next);
    this.afterTravel();
  }

  private afterTravel(): void {
    this.lastMerge = null;
    this.version.update((v) => v + 1);
    this.syncHistory();
    const sel = this.selectedId();
    if (sel && !this.index().has(sel)) this.selectedId.set(null);
    if (this.pageIndex() >= this.def().pages.length) this.pageIndex.set(this.def().pages.length - 1);
  }

  private syncHistory(): void {
    this.canUndo.set(this.past.length > 0);
    this.canRedo.set(this.future.length > 0);
  }

  // ── Selection ───────────────────────────────────────────────────────────

  select(id: string | null): void {
    this.selectedId.set(id);
    const entry = id ? this.index().get(id) : null;
    if (entry) this.pageIndex.set(entry.pageIndex);
  }

  // ── Elements ────────────────────────────────────────────────────────────

  /** Where a new element goes: right after the selection, or at the end of the current page. */
  defaultTarget(): UiFbDropTarget {
    const sel = this.selected();
    if (sel && sel.kind === 'group' && !(sel.element as UiFbGroup).archived) {
      return { containerId: sel.id, index: (sel.element as UiFbGroup).elements.length };
    }
    if (sel && sel.kind !== 'page') return { containerId: sel.parentId, index: sel.index + 1 };
    return { containerId: this.page().id, index: this.page().elements.length };
  }

  add(el: UiFbElement, target = this.defaultTarget()): void {
    if (!canDrop(this.def(), el, target.containerId)) target = { containerId: this.page().id, index: this.page().elements.length };
    this.commit(insertElement(this.def(), el, target));
    this.select(el.id);
  }

  move(id: string, target: UiFbDropTarget): boolean {
    const next = moveElement(this.def(), id, target);
    if (next === this.def()) return false;
    this.commit(next);
    return true;
  }

  /** Moves up/down among its siblings; at the edge of a section it steps out of it. */
  nudge(id: string, delta: -1 | 1): boolean {
    const e = this.index().get(id);
    if (!e || e.kind === 'page') return false;
    const parent = this.index().get(e.parentId);
    const siblings = parent?.kind === 'page' ? (parent.element as UiFbPage).elements : (parent?.element as UiFbGroup)?.elements ?? [];
    const to = e.index + delta;
    if (to >= 0 && to < siblings.length) return this.move(id, { containerId: e.parentId, index: delta > 0 ? to + 1 : to });
    if (parent?.kind === 'group') return this.move(id, { containerId: parent.parentId, index: delta > 0 ? parent.index + 1 : parent.index });
    return false;
  }

  duplicate(id: string): void {
    const { def, id: copy } = duplicateElement(this.def(), id);
    this.commit(def);
    this.select(copy);
  }

  /** Deletes an element and any rules that mention it or anything inside it. */
  remove(id: string): void {
    const ids = subtreeIds(this.def(), id);
    const entry = this.index().get(id);
    this.commit(removeReferences(removeElement(this.def(), id), ids));
    if (ids.includes(this.selectedId() ?? '')) this.selectedId.set(entry && entry.kind !== 'page' ? null : null);
  }

  setArchived(id: string, archived: boolean): void {
    this.commit(updateElement<UiFbElement>(this.def(), id, (el) => ({ ...el, archived: archived || undefined })));
  }

  updateField(id: string, patch: Partial<UiFbField> | ((f: UiFbField) => UiFbField), mergeKey?: string): void {
    this.commit(updateElement<UiFbField>(this.def(), id, (f) => (typeof patch === 'function' ? patch(f) : { ...f, ...patch })), mergeKey);
  }

  updateGroup(id: string, patch: Partial<UiFbGroup> | ((g: UiFbGroup) => UiFbGroup), mergeKey?: string): void {
    this.commit(updateElement<UiFbGroup>(this.def(), id, (g) => (typeof patch === 'function' ? patch(g) : { ...g, ...patch })), mergeKey);
  }

  updateStatic(id: string, patch: Partial<UiFbStatic>, mergeKey?: string): void {
    this.commit(updateElement<UiFbStatic>(this.def(), id, (s) => ({ ...s, ...patch })), mergeKey);
  }

  /** Updates any element (field, group or static) — for settings they share. */
  updateAny(id: string, fn: (el: UiFbElement) => UiFbElement, mergeKey?: string): void {
    this.commit(updateElement<UiFbElement>(this.def(), id, fn), mergeKey);
  }

  rename(id: string, key: string): void {
    this.commit(renameKey(this.def(), id, key), `key:${id}`);
  }

  // ── Pages and form ──────────────────────────────────────────────────────

  updatePage(id: string, patch: Partial<UiFbPage> | ((p: UiFbPage) => UiFbPage), mergeKey?: string): void {
    this.commit(updatePage(this.def(), id, (p) => (typeof patch === 'function' ? patch(p) : { ...p, ...patch })), mergeKey);
  }

  addPage(): void {
    const page = createPage(`Page ${this.def().pages.length + 1}`);
    const def = this.def();
    // A form that had one untitled page gets a title on it, now that there are steps.
    const pages = def.pages.length === 1 && !def.pages[0].title ? [{ ...def.pages[0], title: 'Page 1' }] : def.pages;
    this.commit({ ...def, pages: [...pages, page] });
    this.pageIndex.set(this.def().pages.length - 1);
    this.select(page.id);
  }

  removePage(id: string): void {
    const def = this.def();
    if (def.pages.length < 2) return;
    const ids = subtreeIds(def, id);
    const next = removeReferences({ ...def, pages: def.pages.filter((p) => p.id !== id) }, ids);
    this.commit(next);
    this.pageIndex.set(Math.max(0, Math.min(this.pageIndex(), next.pages.length - 1)));
    this.selectedId.set(null);
  }

  movePage(id: string, delta: -1 | 1): void {
    const pages = [...this.def().pages];
    const i = pages.findIndex((p) => p.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= pages.length) return;
    [pages[i], pages[j]] = [pages[j], pages[i]];
    this.commit({ ...this.def(), pages });
    this.pageIndex.set(j);
  }

  updateForm(patch: Partial<Pick<UiFormDefinition, 'title' | 'description'>>, mergeKey?: string): void {
    this.commit({ ...this.def(), ...patch }, mergeKey);
  }

  updateSettings(patch: Partial<UiFbSettings>, mergeKey?: string): void {
    const settings = { ...(this.def().settings ?? {}), ...patch };
    for (const k of Object.keys(settings) as (keyof UiFbSettings)[]) if (settings[k] === undefined) delete settings[k];
    this.commit({ ...this.def(), settings }, mergeKey);
  }

  // ── Questions about the form ────────────────────────────────────────────

  name(id: string): string {
    const e = this.index().get(id);
    return e ? elementName(e.element, this.def()) : 'Deleted question';
  }

  field(id: string): UiFbField | null {
    const el = this.index().get(id)?.element;
    return el && 'kind' in el && el.kind === 'field' ? el : null;
  }

  /** Whether answers already exist for an element (so deleting it would lose them). */
  hasAnswers(id: string): boolean {
    if (!this.live()) return false;
    return !!indexDefinition(this.published()!).get(id);
  }

  externalRefs(id: string) {
    return externalReferences(this.def(), id);
  }

  /** Words for a condition, using labels people recognise. */
  describe(c: UiFbCondition | undefined): string {
    const d: UiFbDescribeContext = {
      name: (ref) => this.name(ref),
      value: (ref, v) => {
        const f = this.field(ref);
        return f ? formatValue(f, v) || String(v) : String(v);
      },
    };
    return describeCondition(c, d);
  }

  describeCalc(f: UiFbField): string {
    return describeCalc(f.calc, (r) => this.name(r));
  }

  /**
   * What a rule on element `forId` may ask about: every field outside it, plus
   * sections and pages. Fields inside a repeating section can only be asked
   * about from inside the same section (they have one answer per entry).
   */
  refOptions(forId: string | null): UiFbRefOption[] {
    const idx = this.index();
    const def = this.def();
    const me = forId ? idx.get(forId) : null;
    // Its own contents and the sections around it would make a loop ("show X when its own section is complete").
    const own = new Set([...(forId ? subtreeIds(def, forId) : []), ...(me?.groups.map((g) => g.id) ?? [])]);
    const myRepeat = me?.kind === 'group' && (me.element as UiFbGroup).repeat ? (me.element as UiFbGroup) : me?.repeat ?? null;
    const out: UiFbRefOption[] = [];
    for (const e of idx.values()) {
      if (own.has(e.id) && e.id !== forId) continue;
      if (e.id === forId && e.kind === 'field') continue;
      const el = e.element;
      if ('kind' in el && el.archived) continue;
      const where = elementName(e.page, def);
      if (e.kind === 'page') {
        if (def.pages.length > 1 && e.id !== forId) out.push({ id: e.id, label: elementName(el, def), kind: 'page', where: 'Page' });
        continue;
      }
      if (e.repeat && e.repeat.id !== myRepeat?.id) continue;
      if (e.kind === 'group') {
        if (e.id === forId) continue;
        out.push({ id: e.id, label: elementName(el, def), kind: (el as UiFbGroup).repeat ? 'repeat' : 'group', where });
      } else if (e.kind === 'field') {
        const f = el as UiFbField;
        out.push({ id: e.id, label: f.label || f.key, kind: valueKindOf(f.type, f.props?.format), where });
      }
    }
    return out;
  }

  /** Validators that make sense for a field. */
  validatorsFor(f: UiFbField): UiFbValidatorDef[] {
    const kind = valueKindOf(f.type, f.props?.format);
    const info = fieldTypeInfo(f.type);
    if (f.type === 'hidden') return [];
    return this.validatorDefs().filter((d) => {
      if (d.fieldTypes && !d.fieldTypes.includes(f.type)) return false;
      if (d.valueKinds && !d.valueKinds.includes(kind)) return false;
      if (['email', 'url', 'phone'].includes(d.type) && info.type !== 'text' && !d.fieldTypes?.includes(f.type)) return false;
      return true;
    });
  }
}
