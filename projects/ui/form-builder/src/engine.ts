import { computed, effect, signal, untracked, type EffectRef, type Injector } from '@angular/core';
import { evaluateCalc, type UiFbCalcContext } from './calc';
import { evaluateCondition, isEmptyValue, resolveOperand, type UiFbConditionContext } from './conditions';
import { indexDefinition, elementName, migrateDefinition, type UiFbIndex, type UiFbIndexEntry } from './definition';
import { fieldTypeInfo, valueKindOf } from './field-types';
import type {
  UiFbChange,
  UiFbElement,
  UiFbField,
  UiFbFileValue,
  UiFbGroup,
  UiFbPage,
  UiFbToggle,
  UiFbValidatorRule,
  UiFormDefinition,
  UiFormSubmission,
} from './schema';
import {
  comparisonWords,
  describeDateParam,
  formatMessage,
  todayIso,
  UI_FB_BUILTIN_VALIDATORS,
  UI_FB_IMPLICIT_VALIDATOR,
  type UiFbValidatorDef,
  type UiFbValidatorResult,
} from './validators';

export type UiFormMode = 'create' | 'edit' | 'view';

export interface UiFormEngineOptions {
  definition: UiFormDefinition;
  /** Saved answers to open for editing or viewing. */
  data?: Record<string, unknown> | null;
  mode?: UiFormMode;
  /** App-registered checks (built-ins are always included). */
  validators?: readonly UiFbValidatorDef[];
  /** Overrides "today" (for tests and for forms filled in on behalf of a past date). */
  today?: () => string;
  injector: Injector;
}

/** One rendered copy of an element: top-level, or inside one entry of a repeatable group. */
export interface UiFbInstance {
  id: string;
  /** The repeat entry it belongs to, or `null`. */
  row: string | null;
  /** `id`, or `row/id` inside a repeat entry. Unique per rendered copy. */
  addr: string;
}

export interface UiFbInstanceState {
  visible: boolean;
  disabled: boolean;
  required: boolean;
  /** The answer, with calculations worked out. */
  value: unknown;
  errors: string[];
  warnings: string[];
  /** An async check is still running. */
  pending: boolean;
}

/** An entry taken out of a repeatable group, kept so it can be put back. */
export interface UiFbRemovedRow {
  groupId: string;
  rowId: string;
  index: number;
  values: Record<string, unknown>;
}

export interface UiFbErrorItem {
  addr: string;
  id: string;
  row: string | null;
  label: string;
  message: string;
}

interface PendingCheck {
  key: string;
  hash: string;
  rule: UiFbValidatorRule;
  def: UiFbValidatorDef;
  value: unknown;
  ctx: Parameters<UiFbValidatorDef['validate']>[2];
}

interface EvalResult {
  states: Map<string, UiFbInstanceState>;
  /** Indexes of pages on the current route through the form. */
  path: number[];
  complete: (id: string, row: string | null) => boolean;
  checks: PendingCheck[];
}

const HIDDEN: UiFbInstanceState = { visible: false, disabled: false, required: false, value: undefined, errors: [], warnings: [], pending: false };

/** "Email is required." — or, for a label that is a question, "Answer “Are you a student?”". */
export function requiredMessage(f: UiFbField, label: string): string {
  if (label.trim().endsWith('?')) return 'Answer “{label}”';
  if (valueKindOf(f.type) === 'boolean' && f.type === 'checkbox') return '{label} must be ticked.';
  return '{label} is required.';
}

export const addrOf = (id: string, row: string | null) => (row ? `${row}/${id}` : id);

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((x, i) => deepEqual(x, (b as unknown[])[i]));
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  return ka.length === kb.length && ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Normalises a stored or typed answer to the shape its field type uses. */
export function coerceValue(field: UiFbField, v: unknown): unknown {
  if (v === undefined) return undefined;
  const kind = valueKindOf(field.type, field.props?.format);
  if (v === null) return kind === 'multi' || kind === 'file' ? [] : null;
  switch (kind) {
    case 'number': {
      if (field.type === 'calculated') return v;
      const n = typeof v === 'number' ? v : Number(v);
      return v === '' || !Number.isFinite(n) ? null : n;
    }
    case 'boolean': return v === true || v === 'true' || v === 1;
    case 'multi': return Array.isArray(v) ? v.map(String) : [String(v)];
    case 'file': return Array.isArray(v) ? v : [v];
    case 'choice': return Array.isArray(v) ? (v.length ? String(v[0]) : null) : String(v);
    default: return typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : String(v);
  }
}

function toJson(v: unknown): unknown {
  if (Array.isArray(v)) return v;
  return isEmptyValue(v) ? null : v;
}

function pick(src: Record<string, unknown> | undefined, keys: string[]): unknown {
  if (!src) return undefined;
  for (const k of keys) if (k in src) return src[k];
  return undefined;
}

/**
 * Runs a form: answers, rules, calculations, page route, repeat entries,
 * validation and the JSON that gets submitted. Framework-light — the renderer
 * is a thin view over it, and tests drive it directly.
 */
export class UiFormEngine {
  readonly definition: UiFormDefinition;
  readonly index: UiFbIndex;
  readonly mode: UiFormMode;
  readonly settings: Required<Pick<NonNullable<UiFormDefinition['settings']>, 'validateOn' | 'clearHidden' | 'errorSummary' | 'requiredMarker'>>;

  private readonly validatorDefs: Map<string, UiFbValidatorDef>;
  private readonly today: () => string;
  private readonly initialData: Record<string, unknown>;

  private readonly values = signal<Record<string, unknown>>({});
  private readonly rowIds = signal<Record<string, string[]>>({});
  private readonly asyncResults = signal<Record<string, { hash: string; result: string | null }>>({});
  /** Fields that have been left at least once (their errors show from then on). */
  readonly touched = signal<ReadonlySet<string>>(new Set());
  /** Pages someone tried to leave or submit (all their errors show). */
  readonly attempted = signal<ReadonlySet<string>>(new Set());
  /** Index into `definition.pages` of the page being shown. */
  readonly pageIndex = signal(0);
  readonly submitting = signal(false);

  /** Files picked in this session, by field address. */
  readonly files = new Map<string, File[]>();

  private rowSeq = 0;
  private readonly rowBase = new Map<string, Record<string, unknown>>();
  private readonly loaded = new Set<string>();
  private readonly initialValues = new Map<string, unknown>();
  private readonly initialRows = new Map<string, string[]>();
  private readonly everShown = new Set<string>();
  private readonly setValuePrev = new Map<string, boolean>();
  private readonly inflight = new Map<string, { hash: string; abort: AbortController; timer: ReturnType<typeof setTimeout> | null }>();
  private readonly effects: EffectRef[] = [];
  private baseline: Record<string, unknown> = {};

  constructor(opts: UiFormEngineOptions) {
    this.definition = migrateDefinition(opts.definition);
    this.index = indexDefinition(this.definition);
    this.mode = opts.mode ?? (opts.data ? 'edit' : 'create');
    this.today = opts.today ?? todayIso;
    const s = this.definition.settings ?? {};
    this.settings = {
      validateOn: s.validateOn ?? 'blur',
      clearHidden: s.clearHidden ?? 'onSubmit',
      errorSummary: s.errorSummary ?? true,
      requiredMarker: s.requiredMarker ?? 'asterisk',
    };
    this.validatorDefs = new Map([...UI_FB_BUILTIN_VALIDATORS, ...(opts.validators ?? [])].map((d) => [d.type, d]));
    this.initialData = isObj(opts.data) ? structuredClone(opts.data) : {};
    this.load();

    const injector = opts.injector;
    this.effects.push(effect(() => this.applySetValues(), { injector }));
    this.effects.push(effect(() => this.runChecks(this.state().checks), { injector }));
    // The first full picture (calculations included) is the "unchanged" baseline.
    this.baseline = untracked(() => this.data());
  }

  destroy(): void {
    this.effects.forEach((e) => e.destroy());
    this.inflight.forEach((f) => { f.abort.abort(); if (f.timer) clearTimeout(f.timer); });
  }

  // ── Loading ─────────────────────────────────────────────────────────────

  private load(): void {
    const values: Record<string, unknown> = {};
    const rows: Record<string, string[]> = {};
    const fresh = this.mode === 'create';
    // `isNew`: nothing was saved here before, so defaults apply (always for hidden values).
    const loadEls = (els: UiFbElement[], src: Record<string, unknown> | undefined, row: string | null, isNew = fresh) => {
      for (const el of els) {
        if (el.kind === 'field') {
          const addr = addrOf(el.id, row);
          const stored = pick(src, [el.key, ...(el.keyHistory ?? [])]);
          if (stored !== undefined && !fresh) {
            values[addr] = coerceValue(el, stored);
            this.loaded.add(addr);
          } else if (el.defaultValue !== undefined && (isNew || el.type === 'hidden')) {
            values[addr] = coerceValue(el, structuredClone(el.defaultValue));
          }
          this.initialValues.set(addr, values[addr]);
        } else if (el.kind === 'group') {
          const keys = el.key ? [el.key, ...(el.keyHistory ?? [])] : [];
          const sub = el.key ? pick(src, keys) : src;
          if (el.repeat) {
            const items = !fresh && Array.isArray(sub) ? sub : [];
            const ids = items.map((item) => {
              const id = this.newRowId();
              this.rowBase.set(id, isObj(item) ? item : {});
              loadEls(el.elements, isObj(item) ? item : undefined, id, false);
              return id;
            });
            if (items.length) this.loaded.add(addrOf(el.id, row));
            // New forms start with the minimum number of entries (at least one).
            const min = fresh ? Math.max(1, el.repeat.min ?? 0) : el.repeat.min ?? 0;
            while (ids.length < min) {
              const id = this.newRowId();
              loadEls(el.elements, undefined, id, true);
              ids.push(id);
            }
            rows[el.id] = ids;
            this.initialRows.set(el.id, [...ids]);
          } else {
            if (el.key && sub !== undefined) this.loaded.add(addrOf(el.id, row));
            loadEls(el.elements, el.key ? (isObj(sub) ? sub : undefined) : src, row, isNew);
          }
        }
      }
    };
    for (const p of this.definition.pages) loadEls(p.elements, this.initialData, null);
    this.values.set(values);
    this.rowIds.set(rows);
  }

  private newRowId(): string {
    return `r${(this.rowSeq++).toString(36)}`;
  }

  // ── Reading ─────────────────────────────────────────────────────────────

  readonly state = computed<EvalResult>(() => this.evaluate(this.values(), this.rowIds(), this.asyncResults()));

  /** Indexes (into `definition.pages`) of the pages on the current route. */
  readonly path = computed(() => this.state().path);
  readonly page = computed<UiFbPage>(() => this.definition.pages[this.pageIndex()] ?? this.definition.pages[0]);
  /** Position of the current page on the route, for "Step 2 of 4". */
  readonly step = computed(() => Math.max(0, this.path().indexOf(this.pageIndex())));
  readonly isLastPage = computed(() => {
    const path = this.path();
    return path.indexOf(this.pageIndex()) >= path.length - 1;
  });

  instanceState(id: string, row: string | null): UiFbInstanceState {
    return this.state().states.get(addrOf(id, row)) ?? HIDDEN;
  }

  rows(groupId: string): string[] {
    return this.rowIds()[groupId] ?? [];
  }

  rawValue(id: string, row: string | null): unknown {
    return this.values()[addrOf(id, row)];
  }

  field(id: string): UiFbField | undefined {
    const el = this.index.get(id)?.element;
    return el && 'kind' in el && el.kind === 'field' ? el : undefined;
  }

  /** Whether a field's errors should be on screen yet ("reward early, punish late"). */
  errorsShown(id: string, row: string | null): boolean {
    if (this.mode === 'view') return false;
    const entry = this.index.get(id);
    if (entry && this.attempted().has(entry.page.id)) return true;
    return this.settings.validateOn === 'blur' && this.touched().has(addrOf(id, row));
  }

  /** Every rendered copy of the fields on a page, in order. */
  instancesOn(pageIdx: number): UiFbInstance[] {
    const out: UiFbInstance[] = [];
    const rows = this.rowIds();
    const walk = (els: UiFbElement[], row: string | null) => {
      for (const el of els) {
        if (el.kind === 'field') out.push({ id: el.id, row, addr: addrOf(el.id, row) });
        else if (el.kind === 'group') {
          if (el.repeat) for (const r of rows[el.id] ?? []) walk(el.elements, r);
          else walk(el.elements, row);
        }
      }
    };
    const page = this.definition.pages[pageIdx];
    if (page) walk(page.elements, null);
    return out;
  }

  /** Errors on a page, in order, worded for the summary box. */
  pageErrors(pageIdx: number): UiFbErrorItem[] {
    const states = this.state().states;
    const out: UiFbErrorItem[] = [];
    for (const inst of this.instancesOn(pageIdx)) {
      const st = states.get(inst.addr);
      if (!st?.visible || !st.errors.length) continue;
      out.push({ ...inst, label: this.instanceLabel(inst.id, inst.row), message: st.errors[0] });
    }
    return out;
  }

  pagePending(pageIdx: number): boolean {
    const states = this.state().states;
    return this.instancesOn(pageIdx).some((i) => states.get(i.addr)?.pending);
  }

  /** "Email" — or "Email (Dependant 2)" inside a repeat entry. */
  instanceLabel(id: string, row: string | null): string {
    const name = elementName(this.index.get(id)?.element);
    const entry = this.index.get(id);
    if (!row || !entry?.repeat) return name;
    const n = this.rows(entry.repeat.id).indexOf(row) + 1;
    const item = (entry.repeat.repeat?.itemLabel ?? 'Entry {n}').replace('{n}', String(n));
    return `${name} (${item})`;
  }

  // ── Changing ────────────────────────────────────────────────────────────

  setValue(id: string, row: string | null, value: unknown): void {
    if (this.mode === 'view') return;
    const f = this.field(id);
    const v = f ? coerceValue(f, value) : value;
    this.values.update((vals) => ({ ...vals, [addrOf(id, row)]: v }));
  }

  markTouched(id: string, row: string | null): void {
    const a = addrOf(id, row);
    if (this.touched().has(a)) return;
    this.touched.update((s) => new Set(s).add(a));
  }

  canAddRow(groupId: string): boolean {
    const g = this.index.get(groupId)?.element as UiFbGroup | undefined;
    const max = g?.repeat?.max;
    return this.mode !== 'view' && (max == null || this.rows(groupId).length < max);
  }

  canRemoveRow(groupId: string): boolean {
    const g = this.index.get(groupId)?.element as UiFbGroup | undefined;
    return this.mode !== 'view' && this.rows(groupId).length > (g?.repeat?.min ?? 0);
  }

  addRow(groupId: string): string | null {
    if (!this.canAddRow(groupId)) return null;
    const g = this.index.get(groupId)!.element as UiFbGroup;
    const id = this.newRowId();
    const defaults: Record<string, unknown> = {};
    const walk = (els: UiFbElement[]) => els.forEach((el) => {
      if (el.kind === 'field' && el.defaultValue !== undefined) defaults[addrOf(el.id, id)] = coerceValue(el, structuredClone(el.defaultValue));
      if (el.kind === 'group') walk(el.elements);
    });
    walk(g.elements);
    this.values.update((v) => ({ ...v, ...defaults }));
    this.rowIds.update((r) => ({ ...r, [groupId]: [...(r[groupId] ?? []), id] }));
    return id;
  }

  /** Removes an entry. Returns what was removed, so `restoreRow` can put it back (undo). */
  removeRow(groupId: string, rowId: string): UiFbRemovedRow | null {
    if (!this.canRemoveRow(groupId)) return null;
    const index = this.rows(groupId).indexOf(rowId);
    const values = Object.fromEntries(Object.entries(this.values()).filter(([k]) => k.startsWith(`${rowId}/`)));
    this.rowIds.update((r) => ({ ...r, [groupId]: (r[groupId] ?? []).filter((x) => x !== rowId) }));
    this.values.update((v) => Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith(`${rowId}/`))));
    return { groupId, rowId, index, values };
  }

  /** Puts a removed entry back where it was, answers and all. */
  restoreRow(removed: UiFbRemovedRow): void {
    if (this.rows(removed.groupId).includes(removed.rowId)) return;
    this.values.update((v) => ({ ...v, ...removed.values }));
    this.rowIds.update((r) => {
      const list = [...(r[removed.groupId] ?? [])];
      list.splice(Math.min(removed.index, list.length), 0, removed.rowId);
      return { ...r, [removed.groupId]: list };
    });
  }

  moveRow(groupId: string, rowId: string, delta: -1 | 1): void {
    this.rowIds.update((r) => {
      const list = [...(r[groupId] ?? [])];
      const i = list.indexOf(rowId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return r;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...r, [groupId]: list };
    });
  }

  /** Validates the current page and moves on along the route. Returns false if it can't. */
  next(): boolean {
    const i = this.pageIndex();
    this.attempted.update((s) => new Set(s).add(this.definition.pages[i].id));
    if (this.pageErrors(i).length || this.pagePending(i)) return false;
    const path = this.path();
    const at = path.indexOf(i);
    if (at < 0 || at >= path.length - 1) return false;
    this.pageIndex.set(path[at + 1]);
    return true;
  }

  back(): boolean {
    const path = this.path();
    const at = path.indexOf(this.pageIndex());
    if (at <= 0) return false;
    this.pageIndex.set(path[at - 1]);
    return true;
  }

  /** Jumps to a page on the route (e.g. from a review step or an error link). */
  goTo(pageIdx: number): void {
    if (this.path().includes(pageIdx)) this.pageIndex.set(pageIdx);
  }

  /**
   * Checks every page on the route. Returns the submission when it's all valid,
   * or null (after moving to the first page with problems).
   */
  submit(): UiFormSubmission | null {
    const path = this.path();
    this.attempted.update((s) => {
      const n = new Set(s);
      path.forEach((i) => n.add(this.definition.pages[i].id));
      return n;
    });
    const bad = path.find((i) => this.pageErrors(i).length || this.pagePending(i));
    if (bad !== undefined) {
      this.pageIndex.set(bad);
      return null;
    }
    const files: Record<string, File[]> = {};
    for (const [addr, list] of this.files) {
      if (!list.length) continue;
      const [row, id] = addr.includes('/') ? addr.split('/') : [null, addr];
      if (this.instanceState(id, row).visible) files[this.dataPath(id, row)] = list;
    }
    return {
      formId: this.definition.id,
      revision: this.definition.revision ?? null,
      data: this.data(),
      submittedAt: new Date().toISOString(),
      files,
    };
  }

  // ── Output ──────────────────────────────────────────────────────────────

  /** The answers as they would be saved right now. */
  readonly data = computed<Record<string, unknown>>(() => this.buildData());

  readonly dirty = computed(() => !deepEqual(this.data(), this.baseline));

  /** Each answer that differs from what the form was opened with. */
  readonly changes = computed<UiFbChange[]>(() => {
    const out: UiFbChange[] = [];
    const vals = this.values();
    const rows = this.rowIds();
    const states = this.state().states;
    for (const [id, entry] of this.index) {
      if (entry.kind === 'group' && (entry.element as UiFbGroup).repeat) {
        const before = this.initialRows.get(id) ?? [];
        const now = rows[id] ?? [];
        const label = elementName(entry.element);
        if (before.length !== now.length) out.push({ path: this.dataPath(id, null), label, from: before.length, to: now.length });
      }
      if (entry.kind !== 'field') continue;
      const field = entry.element as UiFbField;
      // Calculated and hidden values follow from other answers, so they aren't listed.
      if (field.archived || fieldTypeInfo(field.type).noInput) continue;
      const rowList = entry.repeat ? (rows[entry.repeat.id] ?? []) : [null];
      for (const row of rowList) {
        const addr = addrOf(id, row);
        if (entry.repeat && !states.get(addr)) continue;
        const from = this.initialValues.get(addr);
        const o = this.output(field, addr, states.get(addr) ?? HIDDEN, vals);
        const to = o.include ? o.value : null;
        if (!deepEqual(toJson(from), toJson(to))) out.push({ path: this.dataPath(id, row), label: this.instanceLabel(id, row), from: toJson(from), to: toJson(to) });
      }
    }
    return out;
  });

  /** Where a field's answer sits in the data, e.g. `dependants[1].name`. */
  dataPath(id: string, row: string | null): string {
    const entry = this.index.get(id);
    if (!entry) return id;
    const parts: string[] = [];
    for (const g of entry.groups) {
      if (!g.key) continue;
      parts.push(g.key);
      if (g.repeat && row) parts[parts.length - 1] += `[${this.rows(g.id).indexOf(row)}]`;
    }
    const el = entry.element;
    if ('kind' in el && (el.kind === 'field' || el.kind === 'group') && el.key) parts.push(el.key);
    return parts.join('.');
  }

  /**
   * A hidden answer is kept when it was saved before and the person never saw
   * it in this session — rules changing later must not wipe old data.
   */
  private keepHidden(addr: string): boolean {
    return this.settings.clearHidden === 'never' || (this.mode !== 'create' && this.loaded.has(addr) && !this.everShown.has(addr));
  }

  /** Whether a field's answer goes into the data, and as what. */
  private output(el: UiFbField, addr: string, st: UiFbInstanceState, vals: Record<string, unknown>): { include: boolean; value: unknown } {
    let value = el.type === 'calculated' ? st.value : vals[addr];
    // An untouched yes/no shows as "no", so that's what gets saved.
    if (value == null && (el.type === 'checkbox' || el.type === 'toggle')) value = false;
    if (st.visible || el.type === 'hidden') return { include: true, value: toJson(value) };
    if (this.keepHidden(addr)) return { include: true, value: toJson(this.settings.clearHidden === 'never' ? value : this.initialValues.get(addr)) };
    return { include: false, value: undefined };
  }

  private buildData(): Record<string, unknown> {
    const states = this.state().states;
    const vals = this.values();
    const rows = this.rowIds();
    const out = structuredClone(this.initialData);
    const clears = this.settings.clearHidden !== 'never';
    const keepHidden = (addr: string) => this.keepHidden(addr);
    const write = (els: UiFbElement[], obj: Record<string, unknown>, row: string | null) => {
      for (const el of els) {
        if (el.kind === 'static' || el.archived) continue;
        const addr = addrOf(el.id, row);
        const st = states.get(addr) ?? HIDDEN;
        if (el.kind === 'field') {
          (el.keyHistory ?? []).forEach((k) => { if (k !== el.key) delete obj[k]; });
          if (el.type === 'calculated' && el.props?.excludeFromData) { delete obj[el.key]; continue; }
          const o = this.output(el, addr, st, vals);
          if (o.include) obj[el.key] = o.value;
          else delete obj[el.key];
          continue;
        }
        if (!el.key) { write(el.elements, obj, row); continue; }
        const old = pick(obj, [el.key, ...(el.keyHistory ?? [])]);
        (el.keyHistory ?? []).forEach((k) => { if (k !== el.key) delete obj[k]; });
        if (!st.visible && clears && !keepHidden(addr)) { delete obj[el.key]; continue; }
        if (!st.visible && clears) { obj[el.key] = old; continue; }
        if (el.repeat) {
          obj[el.key] = (rows[el.id] ?? []).map((r) => {
            const base = structuredClone(this.rowBase.get(r) ?? {});
            write(el.elements, base, r);
            return base;
          });
        } else {
          const child = isObj(old) ? { ...old } : {};
          write(el.elements, child, row);
          obj[el.key] = child;
        }
      }
    };
    for (const p of this.definition.pages) write(p.elements, out, null);
    return out;
  }

  // ── Evaluation ──────────────────────────────────────────────────────────

  private evaluate(values: Record<string, unknown>, rows: Record<string, string[]>, asyncResults: Record<string, { hash: string; result: string | null }>): EvalResult {
    const idx = this.index;
    const def = this.definition;
    const today = this.today();
    const memo = new Map<string, unknown>();
    const busy = new Set<string>();
    const checks: PendingCheck[] = [];
    const view = this.mode === 'view';

    /** Runs `fn` once per key; a key that asks about itself gets `fallback` (a loop). */
    const once = <T>(key: string, fallback: T, fn: () => T): T => {
      if (memo.has(key)) return memo.get(key) as T;
      if (busy.has(key)) return fallback;
      busy.add(key);
      const v = fn();
      busy.delete(key);
      memo.set(key, v);
      return v;
    };

    /** The row an element should be read in, when asked from `row`. */
    const rowFor = (entry: UiFbIndexEntry | undefined, row: string | null): string | null | 'all' => {
      if (!entry?.repeat) return null;
      if (row && (rows[entry.repeat.id] ?? []).includes(row)) return row;
      return 'all';
    };

    const condCtx = (row: string | null): UiFbConditionContext & UiFbCalcContext => ({
      value: (ref) => {
        const r = rowFor(idx.get(ref), row);
        if (r === 'all') return undefined;
        return value(ref, r);
      },
      values: (ref) => {
        const entry = idx.get(ref);
        const r = rowFor(entry, row);
        if (r !== 'all') return [value(ref, r)];
        return (rows[entry!.repeat!.id] ?? []).filter((x) => visible(ref, x)).map((x) => value(ref, x));
      },
      visible: (ref) => {
        const entry = idx.get(ref);
        const r = rowFor(entry, row);
        if (r === 'all') return (rows[entry!.repeat!.id] ?? []).some((x) => visible(ref, x));
        return visible(ref, r);
      },
      complete: (ref) => {
        const entry = idx.get(ref);
        const r = rowFor(entry, row);
        if (r === 'all') return (rows[entry!.repeat!.id] ?? []).every((x) => complete(ref, x));
        return complete(ref, r);
      },
      rows: (ref) => {
        const el = idx.get(ref)?.element;
        return el && 'kind' in el && el.kind === 'group' && el.repeat ? (rows[ref] ?? []).length : (null as unknown as number);
      },
      today: () => today,
    });

    /** A repeat group itself isn't per-entry; anything inside one is. */
    const parentRow = (entry: UiFbIndexEntry, row: string | null) => (idx.get(entry.parentId)?.repeat ? row : null);

    const toggle = (t: UiFbToggle | undefined, row: string | null) =>
      t === true || (!!t && typeof t === 'object' && evaluateCondition(t.when, condCtx(row)));

    const path = (): number[] => once('path', def.pages.map((_, i) => i), () => {
      const out: number[] = [];
      let i = 0;
      while (i < def.pages.length) {
        const page = def.pages[i];
        const shown = !page.visibility || evaluateCondition(page.visibility.when, condCtx(null)) === (page.visibility.action === 'show');
        if (!shown) { i++; continue; }
        out.push(i);
        const jump = page.jumps?.find((j) => evaluateCondition(j.when, condCtx(null)));
        if (!jump) { i++; continue; }
        if (jump.to === 'end') break;
        const t = def.pages.findIndex((p) => p.id === jump.to);
        i = t > i ? t : i + 1;
      }
      return out.length ? out : [0];
    });

    const visible = (id: string, row: string | null): boolean => once(`v:${addrOf(id, row)}`, false, () => {
      const entry = idx.get(id);
      if (!entry) return false;
      if (entry.kind === 'page') return path().includes(entry.pageIndex);
      const el = entry.element as UiFbElement;
      if (el.archived) return false;
      if (!visible(entry.parentId, parentRow(entry, row))) return false;
      if (!el.visibility) return true;
      return evaluateCondition(el.visibility.when, condCtx(row)) === (el.visibility.action === 'show');
    });

    const value = (id: string, row: string | null): unknown => once(`val:${addrOf(id, row)}`, null, () => {
      const f = idx.get(id)?.element;
      if (f && 'kind' in f && f.kind === 'field' && f.type === 'calculated') return evaluateCalc(f.calc, condCtx(row));
      return values[addrOf(id, row)];
    });

    const disabled = (id: string, row: string | null): boolean => once(`d:${addrOf(id, row)}`, false, () => {
      if (view) return true;
      const entry = idx.get(id);
      if (!entry || entry.kind === 'page') return false;
      const el = entry.element as UiFbElement;
      if (el.kind !== 'static' && toggle(el.disabled, row)) return true;
      if (el.kind === 'field' && el.readOnly) return true;
      if (idx.get(entry.parentId)?.kind !== 'group') return false;
      return disabled(entry.parentId, parentRow(entry, row));
    });

    const required = (id: string, row: string | null): boolean => once(`r:${addrOf(id, row)}`, false, () => {
      const f = idx.get(id)?.element as UiFbField | undefined;
      return !!f && toggle(f.required, row);
    });

    const errors = (id: string, row: string | null): { errors: string[]; warnings: string[]; pending: boolean } =>
      once(`e:${addrOf(id, row)}`, { errors: [], warnings: [], pending: false }, () => {
        const res = { errors: [] as string[], warnings: [] as string[], pending: false };
        const f = idx.get(id)?.element as UiFbField | undefined;
        if (!f || view || !visible(id, row) || disabled(id, row) || f.type === 'hidden') return res;
        const v = value(id, row);
        const label = f.label || f.key;
        const empty = isEmptyValue(v) || (valueKindOf(f.type) === 'boolean' && v !== true);
        if (required(id, row) && empty) {
          res.errors.push(formatMessage(f.requiredMessage || requiredMessage(f, label), { label }));
          return res;
        }
        const rules: UiFbValidatorRule[] = [...(f.validators ?? [])];
        const implicit = UI_FB_IMPLICIT_VALIDATOR[f.type];
        if (implicit && !rules.some((r) => r.type === implicit)) rules.unshift({ id: `implicit_${implicit}`, type: implicit });
        const ctxBase = condCtx(row);
        for (const rule of rules) {
          const vdef = this.validatorDefs.get(rule.type);
          if (!vdef) continue;
          if (empty && !vdef.runWhenEmpty) continue;
          if (rule.when && !evaluateCondition(rule.when, ctxBase)) continue;
          const params = { ...Object.fromEntries((vdef.params ?? []).filter((p) => p.default !== undefined).map((p) => [p.key, p.default])), ...(rule.params ?? {}) };
          const vctx = {
            field: f,
            value: (ref: string) => ctxBase.value(ref),
            label: (ref: string) => elementName(idx.get(ref)?.element),
            today: () => today,
          };
          const message = (result: UiFbValidatorResult) => {
            if (typeof result === 'string') return result;
            const vars: Record<string, unknown> = { label };
            for (const spec of vdef.params ?? []) {
              const pv = params[spec.key];
              vars[spec.key] = spec.kind === 'field' ? `“${elementName(idx.get(String(pv))?.element)}”`
                : spec.kind === 'date' ? describeDateParam(pv)
                : spec.key === 'comparison' ? comparisonWords(pv)
                : pv;
            }
            return formatMessage(rule.message || vdef.defaultMessage, vars);
          };
          const push = (result: UiFbValidatorResult) => {
            if (result === true || result == null) return;
            (rule.severity === 'warning' ? res.warnings : res.errors).push(message(result));
          };
          const key = `${addrOf(id, row)}|${rule.id}`;
          const hash = JSON.stringify([v, params]);
          const isAsync = !!vdef.debounceMs || this.asyncTypes.has(vdef.type);
          if (isAsync) {
            const done = asyncResults[key];
            if (done && done.hash === hash) push(done.result === null ? true : done.result);
            else { res.pending = true; checks.push({ key, hash, rule, def: vdef, value: v, ctx: vctx }); }
            continue;
          }
          let out: UiFbValidatorResult | Promise<UiFbValidatorResult>;
          try {
            out = vdef.validate(v, params, vctx);
          } catch {
            out = true;
          }
          if (out instanceof Promise) {
            // Discovered to be async: remember, and treat like the others from now on.
            this.asyncTypes.add(vdef.type);
            out.catch(() => undefined);
            res.pending = true;
            checks.push({ key, hash, rule, def: vdef, value: v, ctx: vctx });
            continue;
          }
          push(out);
        }
        return res;
      });

    const complete = (id: string, row: string | null): boolean => once(`c:${addrOf(id, row)}`, false, () => {
      const entry = idx.get(id);
      if (!entry) return false;
      if (entry.kind === 'field') {
        const e = errors(id, row);
        const v = value(id, row);
        return !e.errors.length && !e.pending && (!isEmptyValue(v) || !required(id, row));
      }
      const children = entry.kind === 'page' ? (entry.element as UiFbPage).elements : (entry.element as UiFbElement).kind === 'group' ? (entry.element as UiFbGroup).elements : [];
      const check = (els: UiFbElement[], r: string | null): boolean => els.every((el) => {
        if (el.kind === 'static' || el.archived) return true;
        if (el.kind === 'group') {
          if (!visible(el.id, r)) return true;
          return el.repeat ? (rows[el.id] ?? []).every((x) => check(el.elements, x)) : check(el.elements, r);
        }
        if (!visible(el.id, r) || disabled(el.id, r)) return true;
        const e = errors(el.id, r);
        return !e.errors.length && !e.pending && (!required(el.id, r) || !isEmptyValue(value(el.id, r)));
      });
      const group = entry.element as UiFbGroup;
      if (entry.kind === 'group' && group.repeat) return (rows[id] ?? []).every((x) => check(children, x));
      return check(children, entry.kind === 'page' ? null : row);
    });

    const states = new Map<string, UiFbInstanceState>();
    const walk = (els: UiFbElement[], row: string | null) => {
      for (const el of els) {
        const addr = addrOf(el.id, row);
        const vis = visible(el.id, row);
        if (el.kind === 'field') {
          const e = errors(el.id, row);
          states.set(addr, { visible: vis, disabled: disabled(el.id, row), required: required(el.id, row), value: value(el.id, row), errors: e.errors, warnings: e.warnings, pending: e.pending });
        } else {
          states.set(addr, { ...HIDDEN, visible: vis, disabled: el.kind === 'group' ? disabled(el.id, row) : false });
          if (el.kind === 'group') {
            if (el.repeat) for (const r of rows[el.id] ?? []) walk(el.elements, r);
            else walk(el.elements, row);
          }
        }
      }
    };
    def.pages.forEach((p) => {
      states.set(p.id, { ...HIDDEN, visible: visible(p.id, null) });
      walk(p.elements, null);
    });
    // Remember everything that has been on screen: a hidden answer that was never
    // shown in this session is history, not something the person just un-chose.
    for (const [addr, st] of states) if (st.visible) this.everShown.add(addr);
    return { states, path: path(), complete, checks };
  }

  private readonly asyncTypes = new Set<string>();

  /** Starts async checks the latest evaluation is waiting on (debounced, newest wins). */
  private runChecks(checks: PendingCheck[]): void {
    for (const c of checks) {
      const cur = this.inflight.get(c.key);
      if (cur?.hash === c.hash) continue;
      if (cur) { cur.abort.abort(); if (cur.timer) clearTimeout(cur.timer); }
      const abort = new AbortController();
      const entry = { hash: c.hash, abort, timer: null as ReturnType<typeof setTimeout> | null };
      this.inflight.set(c.key, entry);
      const start = () => {
        entry.timer = null;
        let p: Promise<UiFbValidatorResult>;
        try {
          p = Promise.resolve(c.def.validate(c.value, { ...(c.rule.params ?? {}) }, { ...c.ctx, signal: abort.signal }));
        } catch {
          p = Promise.resolve(true);
        }
        p.then(
          (result) => {
            if (abort.signal.aborted) return;
            this.inflight.delete(c.key);
            const msg = result === true || result == null ? null : typeof result === 'string' ? result : formatMessage(c.rule.message || c.def.defaultMessage, { label: c.ctx.field.label, ...(c.rule.params ?? {}) });
            this.asyncResults.update((r) => ({ ...r, [c.key]: { hash: c.hash, result: msg } }));
          },
          // A check that crashes (e.g. the server is down) doesn't block the form.
          () => {
            if (abort.signal.aborted) return;
            this.inflight.delete(c.key);
            this.asyncResults.update((r) => ({ ...r, [c.key]: { hash: c.hash, result: null } }));
          },
        );
      };
      entry.timer = setTimeout(start, c.def.debounceMs ?? 400);
    }
  }

  /** "When … set this field to …" rules fire as their condition becomes true. */
  private applySetValues(): void {
    const states = this.state().states;
    const updates: Record<string, unknown> = {};
    const rows = untracked(() => this.rowIds());
    for (const [id, entry] of this.index) {
      if (entry.kind !== 'field') continue;
      const f = entry.element as UiFbField;
      if (!f.setValue?.length || f.archived) continue;
      const rowList = entry.repeat ? (rows[entry.repeat.id] ?? []) : [null];
      for (const row of rowList) {
        for (const rule of f.setValue) {
          const key = `${addrOf(id, row)}|${rule.id}`;
          const ctx = this.contextFor(row, states);
          const now = evaluateCondition(rule.when, ctx);
          const before = this.setValuePrev.get(key);
          this.setValuePrev.set(key, now);
          // Fires on a change to true — not on load, so saved answers aren't overwritten.
          if (now && before === false && this.mode !== 'view') updates[addrOf(id, row)] = coerceValue(f, resolveOperand(rule.value, ctx));
        }
      }
    }
    if (Object.keys(updates).length) untracked(() => this.values.update((v) => ({ ...v, ...updates })));
  }

  /** A condition context over a finished evaluation (for effects). */
  private contextFor(row: string | null, states: Map<string, UiFbInstanceState>): UiFbConditionContext {
    const rows = untracked(() => this.rowIds());
    const inRow = (ref: string): string | null | 'all' => {
      const e = this.index.get(ref);
      if (!e?.repeat) return null;
      return row && (rows[e.repeat.id] ?? []).includes(row) ? row : 'all';
    };
    const res = this.state();
    return {
      value: (ref) => { const r = inRow(ref); return r === 'all' ? undefined : states.get(addrOf(ref, r))?.value; },
      visible: (ref) => { const r = inRow(ref); return r === 'all' ? false : !!states.get(addrOf(ref, r))?.visible; },
      complete: (ref) => { const r = inRow(ref); return r === 'all' ? false : res.complete(ref, r); },
      rows: (ref) => (rows[ref] ?? []).length,
      today: () => this.today(),
    };
  }

  /** Stored file metadata plus the picked `File`s, kept for the submission. */
  setFiles(id: string, row: string | null, picked: File[], uploaded?: UiFbFileValue[]): void {
    const addr = addrOf(id, row);
    const meta = uploaded ?? picked.map((f) => ({ name: f.name, size: f.size, type: f.type }));
    this.files.set(addr, uploaded ? [] : picked);
    this.setValue(id, row, meta);
  }
}
