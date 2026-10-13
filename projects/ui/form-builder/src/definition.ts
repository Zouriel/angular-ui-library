import { fieldTypeInfo, typesCompatible, valueKindOf } from './field-types';
import {
  UI_FB_SCHEMA_VERSION,
  type UiFbCalc,
  type UiFbCalcArg,
  type UiFbCondition,
  type UiFbElement,
  type UiFbField,
  type UiFbFieldType,
  type UiFbGroup,
  type UiFbOperand,
  type UiFbPage,
  type UiFbSettings,
  type UiFbStatic,
  type UiFbStaticType,
  type UiFbToggle,
  type UiFormDefinition,
} from './schema';

// ── Ids and keys ──────────────────────────────────────────────────────────

let seq = 0;

/** A short id that is unique within a session and very unlikely to collide across sessions. */
export function fbUid(prefix: string): string {
  seq = (seq + 1) % 1296;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${Date.now().toString(36).slice(-4)}${seq.toString(36).padStart(2, '0')}${rand}`;
}

/** "First name (legal)" → "first_name_legal". Always starts with a letter. */
export function fbSlug(label: string): string {
  const s = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    .replace(/_+$/, '');
  if (!s) return 'field';
  return /^[a-z]/.test(s) ? s : `f_${s}`;
}

/** A valid key: letters, digits and underscores, starting with a letter. */
export function fbKeyValid(key: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(key);
}

// ── Creating elements ─────────────────────────────────────────────────────

/** A new, one-page form. `defaults` (e.g. global settings' `defaults`) are copied into its settings. */
export function createDefinition(title = 'Untitled form', defaults?: UiFbSettings): UiFormDefinition {
  return {
    schemaVersion: UI_FB_SCHEMA_VERSION,
    id: fbUid('form'),
    title,
    revision: 0,
    settings: { ...(defaults ?? {}) },
    pages: [createPage()],
  };
}

export function createPage(title?: string): UiFbPage {
  return { id: fbUid('page'), title, elements: [] };
}

export function createField(type: UiFbFieldType, def?: UiFormDefinition, label?: string): UiFbField {
  const info = fieldTypeInfo(type);
  const lbl = label ?? info.defaultLabel;
  const field: UiFbField = {
    kind: 'field',
    id: fbUid('fld'),
    type,
    key: def ? uniqueKey(def, fbSlug(lbl), null) : fbSlug(lbl),
    label: lbl,
  };
  if (info.defaultProps) field.props = { ...info.defaultProps };
  if (info.hasOptions) {
    field.options = ['Option 1', 'Option 2', 'Option 3'].map((l) => ({ id: fbUid('opt'), value: fbSlug(l), label: l }));
  }
  if (type === 'calculated') field.calc = { op: 'sum', args: [] };
  return field;
}

export function createGroup(def?: UiFormDefinition, repeat = false): UiFbGroup {
  const g: UiFbGroup = { kind: 'group', id: fbUid('grp'), title: repeat ? 'Repeating section' : 'Section', elements: [] };
  if (repeat) {
    g.key = def ? uniqueKey(def, 'items', null) : 'items';
    g.repeat = { min: 1, addLabel: 'Add another', itemLabel: 'Entry {n}' };
  }
  return g;
}

export function createStatic(type: UiFbStaticType): UiFbStatic {
  const text = type === 'heading' ? 'Heading' : type === 'paragraph' ? 'Add some explanation here.' : undefined;
  return { kind: 'static', id: fbUid('st'), type, text };
}

// ── Walking and indexing ──────────────────────────────────────────────────

export interface UiFbIndexEntry {
  id: string;
  kind: 'page' | 'field' | 'group' | 'static';
  element: UiFbElement | UiFbPage;
  page: UiFbPage;
  pageIndex: number;
  /** The page or group this element sits in. */
  parentId: string;
  /** Position among its siblings. */
  index: number;
  /** Enclosing groups, outermost first. */
  groups: UiFbGroup[];
  /** The nearest enclosing repeatable group, if any. */
  repeat: UiFbGroup | null;
  /** Keys of enclosing keyed groups, outermost first (repeatables included). */
  scopeKeys: string[];
  /** Data scope id: the nearest keyed group's id, or `root`. Keys are unique per scope. */
  scope: string;
  /** Document order across the whole form. */
  order: number;
}

export type UiFbIndex = Map<string, UiFbIndexEntry>;

export function indexDefinition(def: UiFormDefinition): UiFbIndex {
  const map: UiFbIndex = new Map();
  let order = 0;
  def.pages.forEach((page, pageIndex) => {
    map.set(page.id, {
      id: page.id, kind: 'page', element: page, page, pageIndex, parentId: '', index: pageIndex,
      groups: [], repeat: null, scopeKeys: [], scope: 'root', order: order++,
    });
    const visit = (els: UiFbElement[], parentId: string, groups: UiFbGroup[]) => {
      els.forEach((el, index) => {
        const repeat = [...groups].reverse().find((g) => !!g.repeat) ?? null;
        const keyed = groups.filter((g) => !!g.key);
        map.set(el.id, {
          id: el.id, kind: el.kind, element: el, page, pageIndex, parentId, index, groups, repeat,
          scopeKeys: keyed.map((g) => g.key!), scope: keyed.length ? keyed[keyed.length - 1].id : 'root', order: order++,
        });
        if (el.kind === 'group') visit(el.elements, el.id, [...groups, el]);
      });
    };
    visit(page.elements, page.id, []);
  });
  return map;
}

/** Every element of the form in document order (pages excluded). */
export function allElements(def: UiFormDefinition): UiFbElement[] {
  const out: UiFbElement[] = [];
  const visit = (els: UiFbElement[]) => els.forEach((el) => { out.push(el); if (el.kind === 'group') visit(el.elements); });
  def.pages.forEach((p) => visit(p.elements));
  return out;
}

export function allFields(def: UiFormDefinition): UiFbField[] {
  return allElements(def).filter((e): e is UiFbField => e.kind === 'field');
}

/** A short human name for any element or page. */
export function elementName(el: UiFbElement | UiFbPage | undefined, def?: UiFormDefinition): string {
  if (!el) return 'Missing item';
  if (!('kind' in el)) {
    const i = def ? def.pages.indexOf(el) : -1;
    return el.title || (i >= 0 ? `Page ${i + 1}` : 'Page');
  }
  if (el.kind === 'field') return el.label || el.key;
  if (el.kind === 'group') return el.title || (el.repeat ? 'Repeating section' : 'Section');
  if (el.type === 'divider') return 'Divider';
  return (el.text ?? '').slice(0, 40) || (el.type === 'heading' ? 'Heading' : 'Text block');
}

// ── Immutable edits ───────────────────────────────────────────────────────

function mapElements(els: UiFbElement[], fn: (el: UiFbElement) => UiFbElement | null): UiFbElement[] {
  const out: UiFbElement[] = [];
  for (const el of els) {
    const next = fn(el);
    if (!next) continue;
    out.push(next.kind === 'group' ? { ...next, elements: mapElements(next.elements, fn) } : next);
  }
  return out;
}

function mapAll(def: UiFormDefinition, fn: (el: UiFbElement) => UiFbElement | null): UiFormDefinition {
  return { ...def, pages: def.pages.map((p) => ({ ...p, elements: mapElements(p.elements, fn) })) };
}

export function updateElement<T extends UiFbElement>(def: UiFormDefinition, id: string, fn: (el: T) => T): UiFormDefinition {
  return mapAll(def, (el) => (el.id === id ? fn(el as T) : el));
}

export function updatePage(def: UiFormDefinition, id: string, fn: (p: UiFbPage) => UiFbPage): UiFormDefinition {
  return { ...def, pages: def.pages.map((p) => (p.id === id ? fn(p) : p)) };
}

/** Where to put an element: inside a page or group, at a position. */
export interface UiFbDropTarget {
  containerId: string;
  index: number;
}

export function insertElement(def: UiFormDefinition, el: UiFbElement, target: UiFbDropTarget): UiFormDefinition {
  const put = (list: UiFbElement[]) => {
    const copy = [...list];
    copy.splice(Math.max(0, Math.min(target.index, copy.length)), 0, el);
    return copy;
  };
  const page = def.pages.find((p) => p.id === target.containerId);
  if (page) return updatePage(def, page.id, (p) => ({ ...p, elements: put(p.elements) }));
  return updateElement<UiFbGroup>(def, target.containerId, (g) => ({ ...g, elements: put(g.elements) }));
}

export function removeElement(def: UiFormDefinition, id: string): UiFormDefinition {
  return mapAll(def, (el) => (el.id === id ? null : el));
}

/** Whether `containerId` is `id` itself or sits inside it (a group can't be dropped into itself). */
export function isInside(def: UiFormDefinition, containerId: string, id: string): boolean {
  if (containerId === id) return true;
  const entry = indexDefinition(def).get(containerId);
  return !!entry?.groups.some((g) => g.id === id);
}

/**
 * Whether an element may go into a container. Repeatable groups can't nest in
 * other repeatable groups, and a group can't go inside itself.
 */
export function canDrop(def: UiFormDefinition, el: UiFbElement, containerId: string): boolean {
  if (isInside(def, containerId, el.id)) return false;
  const idx = indexDefinition(def);
  const container = idx.get(containerId);
  if (!container) return false;
  const inRepeat = container.kind === 'group'
    ? !!(container.element as UiFbGroup).repeat || !!container.repeat
    : false;
  if (!inRepeat) return true;
  const hasRepeat = (e: UiFbElement): boolean => e.kind === 'group' && (!!e.repeat || e.elements.some(hasRepeat));
  return !hasRepeat(el);
}

export function moveElement(def: UiFormDefinition, id: string, target: UiFbDropTarget): UiFormDefinition {
  const idx = indexDefinition(def);
  const entry = idx.get(id);
  if (!entry || entry.kind === 'page') return def;
  const el = entry.element as UiFbElement;
  if (!canDrop(def, el, target.containerId)) return def;
  let index = target.index;
  // Removing the element first shifts later siblings in the same list up by one.
  if (entry.parentId === target.containerId && entry.index < index) index--;
  if (entry.parentId === target.containerId && entry.index === index) return def;
  return insertElement(removeElement(def, id), el, { containerId: target.containerId, index });
}

/** Copies an element (and its children) with fresh ids and unique keys, placed right after it. */
export function duplicateElement(def: UiFormDefinition, id: string): { def: UiFormDefinition; id: string } {
  const entry = indexDefinition(def).get(id);
  if (!entry || entry.kind === 'page') return { def, id };
  const remap = new Map<string, string>();
  const clone = structuredClone(entry.element as UiFbElement);
  const freshIds = (e: UiFbElement) => {
    const next = fbUid(e.kind === 'field' ? 'fld' : e.kind === 'group' ? 'grp' : 'st');
    remap.set(e.id, next);
    e.id = next;
    if (e.kind === 'field') {
      e.options = e.options?.map((o) => ({ ...o, id: fbUid('opt') }));
      e.validators = e.validators?.map((v) => ({ ...v, id: fbUid('val') }));
      e.setValue = e.setValue?.map((s) => ({ ...s, id: fbUid('set') }));
      delete e.keyHistory;
    }
    if (e.kind === 'group') { delete e.keyHistory; e.elements.forEach(freshIds); }
  };
  freshIds(clone);
  // References between elements inside the copy follow the copy; outside references stay.
  const remapped = remapRefs(clone, remap);
  let next = insertElement(def, remapped, { containerId: entry.parentId, index: entry.index + 1 });
  // Keys: the copy's own key is unique in its scope; children of a keyed copy live in a new scope.
  if (remapped.kind === 'field') {
    next = updateElement<UiFbField>(next, remapped.id, (f) => ({ ...f, key: uniqueKey(next, f.key, f.id) }));
  } else if (remapped.kind === 'group') {
    if (remapped.key) next = updateElement<UiFbGroup>(next, remapped.id, (g) => ({ ...g, key: uniqueKey(next, g.key!, g.id) }));
    if (!remapped.key) {
      const fix = (els: UiFbElement[]) => els.forEach((e) => {
        if (e.kind === 'field') next = updateElement<UiFbField>(next, e.id, (f) => ({ ...f, key: uniqueKey(next, f.key, f.id) }));
        if (e.kind === 'group' && !e.key) fix(e.elements);
        if (e.kind === 'group' && e.key) next = updateElement<UiFbGroup>(next, e.id, (g) => ({ ...g, key: uniqueKey(next, g.key!, g.id) }));
      });
      fix(remapped.elements);
    }
  }
  return { def: next, id: remapped.id };
}

/**
 * Points every reference in `el` at the new ids in `remap`. Ids are unique
 * random tokens, so swapping exact quoted strings can't hit anything else.
 */
function remapRefs<T extends UiFbElement>(el: T, remap: Map<string, string>): T {
  let json = JSON.stringify(el);
  for (const [from, to] of remap) json = json.split(`"${from}"`).join(`"${to}"`);
  return JSON.parse(json) as T;
}

/** Whether an id is already used as a key holder in a data scope. */
function keyTaken(def: UiFormDefinition, key: string, scope: string, exceptId: string | null): boolean {
  const idx = indexDefinition(def);
  for (const entry of idx.values()) {
    if (entry.id === exceptId || entry.scope !== scope) continue;
    const el = entry.element;
    if ('kind' in el && (el.kind === 'field' || el.kind === 'group') && el.key === key) return true;
  }
  return false;
}

/**
 * `base`, or `base_2`, `base_3`… — whichever is free in the data scope of
 * element `id` (or the top level when `id` is null or not yet in the form).
 */
export function uniqueKey(def: UiFormDefinition, base: string, id: string | null): string {
  const scope = (id && indexDefinition(def).get(id)?.scope) || 'root';
  const clean = fbKeyValid(base) ? base : fbSlug(base);
  const stem = clean.replace(/_\d+$/, '');
  let key = clean;
  let n = 2;
  while (keyTaken(def, key, scope, id)) key = `${stem}_${n++}`;
  return key;
}

/** Changes a field's or group's key, remembering the old one so saved answers still load. */
export function renameKey(def: UiFormDefinition, id: string, key: string): UiFormDefinition {
  return updateElement<UiFbField | UiFbGroup>(def, id, (el) => {
    if (!el.key || el.key === key) return { ...el, key };
    const history = (el.keyHistory ?? []).filter((k) => k !== key);
    return { ...el, key, keyHistory: [...history, el.key] };
  });
}

// ── References ────────────────────────────────────────────────────────────

export function conditionRefs(c: UiFbCondition | undefined, out: string[] = []): string[] {
  if (!c) return out;
  if ('conditions' in c) c.conditions.forEach((x) => conditionRefs(x, out));
  else {
    out.push(c.ref);
    operandRefs(c.value, out);
    operandRefs(c.value2, out);
  }
  return out;
}

function operandRefs(o: UiFbOperand | undefined, out: string[]): void {
  if (o && 'ref' in o) out.push(o.ref);
}

export function calcRefs(c: UiFbCalc | undefined, out: string[] = []): string[] {
  c?.args.forEach((a) => {
    if ('ref' in a) out.push(a.ref);
    else if ('calc' in a) calcRefs(a.calc, out);
  });
  return out;
}

function toggleRefs(t: UiFbToggle | undefined, out: string[]): void {
  if (t && typeof t === 'object') conditionRefs(t.when, out);
}

export type UiFbRefKind = 'visibility' | 'required' | 'disabled' | 'setValue' | 'validator' | 'calc' | 'jump' | 'source';

/** Answers a field's option source reads (dependent lists, e.g. Cities of the chosen Country). */
export function sourceRefs(el: { source?: { params?: Record<string, { const: unknown } | { ref: string }> } }, out: string[] = []): string[] {
  Object.values(el.source?.params ?? {}).forEach((v) => { if ('ref' in v && v.ref) out.push(v.ref); });
  return out;
}

export interface UiFbReference {
  /** The element or page whose rule mentions the target. */
  ownerId: string;
  kind: UiFbRefKind;
}

/** Every rule, calculation and jump that mentions element `id`. */
export function referencesTo(def: UiFormDefinition, id: string): UiFbReference[] {
  const out: UiFbReference[] = [];
  const check = (ownerId: string, kind: UiFbRefKind, refs: string[]) => {
    if (ownerId !== id && refs.includes(id)) out.push({ ownerId, kind });
  };
  for (const page of def.pages) {
    check(page.id, 'visibility', conditionRefs(page.visibility?.when));
    page.jumps?.forEach((j) => {
      if (j.to === id && page.id !== id) out.push({ ownerId: page.id, kind: 'jump' });
      check(page.id, 'jump', conditionRefs(j.when));
    });
  }
  for (const el of allElements(def)) {
    check(el.id, 'visibility', conditionRefs(el.visibility?.when));
    if (el.kind === 'static') continue;
    const dis: string[] = [];
    toggleRefs(el.disabled, dis);
    check(el.id, 'disabled', dis);
    if (el.kind !== 'field') continue;
    const req: string[] = [];
    toggleRefs(el.required, req);
    check(el.id, 'required', req);
    const sv: string[] = [];
    el.setValue?.forEach((s) => { conditionRefs(s.when, sv); operandRefs(s.value, sv); });
    check(el.id, 'setValue', sv);
    const va: string[] = [];
    el.validators?.forEach((v) => {
      conditionRefs(v.when, va);
      Object.values(v.params ?? {}).forEach((p) => { if (typeof p === 'string') va.push(p); });
    });
    check(el.id, 'validator', va);
    check(el.id, 'calc', calcRefs(el.calc));
    check(el.id, 'source', sourceRefs(el));
  }
  return out;
}

/** Ids of elements inside `id` (its own id included). */
export function subtreeIds(def: UiFormDefinition, id: string): string[] {
  const entry = indexDefinition(def).get(id);
  if (!entry) return [];
  const ids: string[] = [];
  const visit = (el: UiFbElement | UiFbPage) => {
    ids.push(el.id);
    const children = 'kind' in el ? (el.kind === 'group' ? el.elements : []) : el.elements;
    children.forEach(visit);
  };
  visit(entry.element);
  return ids;
}

/** References to `id` or anything inside it, from outside it. */
export function externalReferences(def: UiFormDefinition, id: string): UiFbReference[] {
  const inner = new Set(subtreeIds(def, id));
  const seen = new Set<string>();
  const out: UiFbReference[] = [];
  for (const target of inner) {
    for (const r of referencesTo(def, target)) {
      const k = `${r.ownerId}|${r.kind}`;
      if (inner.has(r.ownerId) || seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

function stripCondition(c: UiFbCondition | undefined, ids: Set<string>): UiFbCondition | undefined {
  if (!c) return undefined;
  if ('conditions' in c) {
    const kept = c.conditions.map((x) => stripCondition(x, ids)).filter((x): x is UiFbCondition => !!x);
    return kept.length ? { ...c, conditions: kept } : undefined;
  }
  const valueRef = c.value && 'ref' in c.value ? c.value.ref : null;
  const value2Ref = c.value2 && 'ref' in c.value2 ? c.value2.ref : null;
  if (ids.has(c.ref) || (valueRef && ids.has(valueRef)) || (value2Ref && ids.has(value2Ref))) return undefined;
  return c;
}

function stripToggle(t: UiFbToggle | undefined, ids: Set<string>): UiFbToggle | undefined {
  if (!t || typeof t !== 'object') return t;
  const when = stripCondition(t.when, ids);
  return when ? { when } : undefined;
}

function stripCalc(c: UiFbCalc, ids: Set<string>): UiFbCalc {
  const args = c.args
    .filter((a) => !('ref' in a && ids.has(a.ref)))
    .map((a): UiFbCalcArg => ('calc' in a ? { calc: stripCalc(a.calc, ids) } : a));
  return { ...c, args };
}

/** Removes every condition, calculation input and jump that mentions any of `ids`. */
export function removeReferences(def: UiFormDefinition, idList: string[]): UiFormDefinition {
  const ids = new Set(idList);
  const pages = def.pages.map((p) => {
    const when = stripCondition(p.visibility?.when, ids);
    return {
      ...p,
      visibility: when && p.visibility ? { ...p.visibility, when } : undefined,
      jumps: p.jumps
        ?.filter((j) => !ids.has(j.to))
        .map((j) => ({ ...j, when: stripCondition(j.when, ids) }))
        .filter((j): j is typeof j & { when: UiFbCondition } => !!j.when),
    };
  });
  return mapAll({ ...def, pages }, (el) => {
    const when = stripCondition(el.visibility?.when, ids);
    const base = { ...el, visibility: when && el.visibility ? { ...el.visibility, when } : undefined };
    if (base.kind === 'static') return base;
    const withDisabled = { ...base, disabled: stripToggle(base.disabled, ids) };
    if (withDisabled.kind === 'group') return withDisabled;
    return {
      ...withDisabled,
      required: stripToggle(withDisabled.required, ids),
      setValue: withDisabled.setValue
        ?.filter((s) => !('ref' in s.value && ids.has(s.value.ref)))
        .map((s) => ({ ...s, when: stripCondition(s.when, ids) }))
        .filter((s): s is typeof s & { when: UiFbCondition } => !!s.when),
      validators: withDisabled.validators
        ?.filter((v) => !Object.values(v.params ?? {}).some((p) => typeof p === 'string' && ids.has(p)))
        .map((v) => ({ ...v, when: stripCondition(v.when, ids) })),
      calc: withDisabled.calc ? stripCalc(withDisabled.calc, ids) : undefined,
      // A filter that read a deleted answer is dropped; the list then just isn't narrowed by it.
      source: withDisabled.source
        ? { ...withDisabled.source, params: Object.fromEntries(Object.entries(withDisabled.source.params ?? {}).filter(([, v]) => !('ref' in v && ids.has(v.ref)))) }
        : undefined,
    };
  });
}

// ── Dependencies and checks ───────────────────────────────────────────────

/** For each element/page, the ids its own rules and calculation read. */
export function dependencyGraph(def: UiFormDefinition): Map<string, Set<string>> {
  const g = new Map<string, Set<string>>();
  const add = (owner: string, refs: string[]) => {
    if (!refs.length) return;
    const set = g.get(owner) ?? new Set<string>();
    refs.forEach((r) => set.add(r));
    g.set(owner, set);
  };
  for (const p of def.pages) {
    add(p.id, conditionRefs(p.visibility?.when));
    p.jumps?.forEach((j) => add(p.id, conditionRefs(j.when)));
  }
  for (const el of allElements(def)) {
    add(el.id, conditionRefs(el.visibility?.when));
    if (el.kind === 'field') {
      add(el.id, calcRefs(el.calc));
      const r: string[] = [];
      toggleRefs(el.required, r);
      add(el.id, r);
    }
  }
  return g;
}

/**
 * Loops such as "A is worked out from B, and B from A", or "show A when B is
 * shown, show B when A is shown". Each element is tracked as separate facts —
 * whether it is shown, its value, whether it is required, whether it is
 * complete — so "show X when section S is complete" is fine even though S's
 * fields are hidden whenever S is. Returns each loop once, as element ids.
 */
export function findCycles(def: UiFormDefinition): string[][] {
  const idx = indexDefinition(def);
  const g = new Map<string, Set<string>>();
  const dep = (from: string, to: string) => {
    const set = g.get(from) ?? new Set<string>();
    set.add(to);
    g.set(from, set);
  };
  const condDeps = (from: string, c: UiFbCondition | undefined) => {
    if (!c) return;
    if ('conditions' in c) { c.conditions.forEach((x) => condDeps(from, x)); return; }
    const fact = c.op === 'visible' || c.op === 'hidden' ? 'vis' : c.op === 'complete' || c.op === 'incomplete' ? 'cmp' : 'val';
    dep(from, `${fact}:${c.ref}`);
    for (const o of [c.value, c.value2]) if (o && 'ref' in o) dep(from, `val:${o.ref}`);
  };
  def.pages.forEach((p, i) => {
    condDeps(`vis:${p.id}`, p.visibility?.when);
    // Whether a page is reached depends on the jumps of every page before it.
    for (let j = 0; j < i; j++) dep(`vis:${p.id}`, `jump:${def.pages[j].id}`);
    p.jumps?.forEach((jp) => condDeps(`jump:${p.id}`, jp.when));
  });
  for (const [id, entry] of idx) {
    if (entry.kind === 'page') continue;
    const el = entry.element as UiFbElement;
    dep(`vis:${id}`, `vis:${entry.parentId}`);
    condDeps(`vis:${id}`, el.visibility?.when);
    if (el.kind === 'field') {
      calcRefs(el.calc).forEach((r) => dep(`val:${id}`, `val:${r}`));
      if (el.required && typeof el.required === 'object') condDeps(`req:${id}`, el.required.when);
    }
  }
  // A group or page is complete when every field inside it is shown-and-filled or not required.
  for (const [id, entry] of idx) {
    if (entry.kind !== 'group' && entry.kind !== 'page') continue;
    for (const inner of subtreeIds(def, id)) {
      if (inner === id || idx.get(inner)?.kind !== 'field') continue;
      dep(`cmp:${id}`, `vis:${inner}`);
      dep(`cmp:${id}`, `val:${inner}`);
      dep(`cmp:${id}`, `req:${inner}`);
    }
  }
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (n: string) => {
    state.set(n, 1);
    stack.push(n);
    for (const m of g.get(n) ?? []) {
      if (state.get(m) === 1) {
        const ids = stack.slice(stack.indexOf(m)).map((x) => x.slice(x.indexOf(':') + 1));
        const loop = ids.filter((x, i) => x !== ids[(i + 1) % ids.length] || ids.length === 1);
        const sig = [...new Set(loop)].sort().join('|');
        if (!seen.has(sig)) { seen.add(sig); cycles.push(loop.length ? loop : [ids[0]]); }
      } else if (!state.has(m)) visit(m);
    }
    stack.pop();
    state.set(n, 2);
  };
  for (const n of g.keys()) if (!state.has(n)) visit(n);
  return cycles;
}

export interface UiFbProblem {
  severity: 'error' | 'warning';
  /** The element or page to jump to when fixing it. */
  targetId: string;
  message: string;
}

/** Everything wrong with a definition, worded for the person building the form. */
export function lintDefinition(def: UiFormDefinition): UiFbProblem[] {
  const out: UiFbProblem[] = [];
  const idx = indexDefinition(def);
  const name = (id: string) => elementName(idx.get(id)?.element, def);
  const keys = new Map<string, string>();
  for (const entry of idx.values()) {
    const el = entry.element;
    if (!('kind' in el) || el.archived) continue;
    if (el.kind === 'field' || (el.kind === 'group' && el.key)) {
      const key = (el as UiFbField | UiFbGroup).key!;
      if (!key) out.push({ severity: 'error', targetId: el.id, message: `“${name(el.id)}” needs a data key.` });
      else if (!fbKeyValid(key)) out.push({ severity: 'error', targetId: el.id, message: `The data key “${key}” may only use letters, numbers and _ and must start with a letter.` });
      const sig = `${entry.scope}|${key}`;
      if (key && keys.has(sig)) out.push({ severity: 'error', targetId: el.id, message: `“${name(el.id)}” and “${name(keys.get(sig)!)}” both store their answer as “${key}”.` });
      else keys.set(sig, el.id);
    }
    if (el.kind === 'field') {
      if (!el.label?.trim() && el.type !== 'hidden') out.push({ severity: 'warning', targetId: el.id, message: `A ${fieldTypeInfo(el.type).label.toLowerCase()} field has no label.` });
      // Options from a data source live in the app, so there's nothing typed to check.
      if (fieldTypeInfo(el.type).hasOptions && !el.source) {
        const live = (el.options ?? []).filter((o) => !o.archived);
        if (!live.length) out.push({ severity: 'error', targetId: el.id, message: `“${name(el.id)}” has no options to choose from.` });
        const vals = new Set<string>();
        for (const o of el.options ?? []) {
          if (vals.has(o.value)) out.push({ severity: 'error', targetId: el.id, message: `“${name(el.id)}” has two options stored as “${o.value}”.` });
          vals.add(o.value);
        }
      }
      if (el.type === 'calculated' && !el.calc?.args.length) out.push({ severity: 'warning', targetId: el.id, message: `“${name(el.id)}” doesn’t use any answers yet.` });
    }
    if (el.kind === 'group' && el.repeat && !el.key) out.push({ severity: 'error', targetId: el.id, message: `The repeating section “${name(el.id)}” needs a data key to store its entries under.` });
    if (el.kind === 'group' && el.repeat && el.repeat.min != null && el.repeat.max != null && el.repeat.min > el.repeat.max) {
      out.push({ severity: 'error', targetId: el.id, message: `“${name(el.id)}” allows at most ${el.repeat.max} entries but needs at least ${el.repeat.min}.` });
    }
  }
  // Rules pointing at things that no longer exist, or at archived things.
  const graph = dependencyGraph(def);
  const allRefs = new Map<string, Set<string>>(graph);
  for (const el of allElements(def)) {
    if (el.kind !== 'field') continue;
    const extra: string[] = [];
    if (el.disabled && typeof el.disabled === 'object') conditionRefs(el.disabled.when, extra);
    el.setValue?.forEach((s) => conditionRefs(s.when, extra));
    el.validators?.forEach((v) => conditionRefs(v.when, extra));
    if (extra.length) allRefs.set(el.id, new Set([...(allRefs.get(el.id) ?? []), ...extra]));
  }
  for (const [owner, refs] of allRefs) {
    for (const r of refs) {
      const target = idx.get(r);
      if (!target) out.push({ severity: 'error', targetId: owner, message: `A rule on “${name(owner)}” refers to a question that was deleted.` });
      else if ('kind' in target.element && target.element.archived) out.push({ severity: 'warning', targetId: owner, message: `A rule on “${name(owner)}” uses “${name(r)}”, which is archived.` });
    }
  }
  // Jumps must go forward.
  def.pages.forEach((p, i) => p.jumps?.forEach((j) => {
    if (j.to === 'end') return;
    const ti = def.pages.findIndex((x) => x.id === j.to);
    if (ti < 0) out.push({ severity: 'error', targetId: p.id, message: `A jump after “${name(p.id)}” goes to a page that was deleted.` });
    else if (ti <= i) out.push({ severity: 'error', targetId: p.id, message: `A jump after “${name(p.id)}” goes back to “${name(j.to)}”. Jumps can only go forward.` });
  }));
  for (const loop of findCycles(def)) {
    out.push({ severity: 'error', targetId: loop[0], message: `These depend on each other in a loop: ${loop.map((id) => `“${name(id)}”`).join(' → ')} → “${name(loop[0])}”.` });
  }
  return out;
}

// ── Loading and comparing versions ────────────────────────────────────────

/** Brings a stored definition up to the current schema version and fills in defaults. */
export function migrateDefinition(raw: unknown): UiFormDefinition {
  const d = (raw && typeof raw === 'object' ? structuredClone(raw) : {}) as Partial<UiFormDefinition>;
  const pages = Array.isArray(d.pages) && d.pages.length ? d.pages : [createPage()];
  return {
    ...d,
    schemaVersion: UI_FB_SCHEMA_VERSION,
    id: d.id || fbUid('form'),
    title: d.title ?? 'Untitled form',
    settings: d.settings ?? {},
    pages: pages.map((p) => ({ ...p, id: p.id || fbUid('page'), elements: p.elements ?? [] })),
  };
}

export interface UiFbDiff {
  added: string[];
  removed: string[];
  archived: string[];
  restored: string[];
  renamedKeys: { id: string; from: string; to: string }[];
  typeChanged: { id: string; from: UiFbFieldType; to: UiFbFieldType; compatible: boolean }[];
  optionsRemoved: { id: string; values: string[] }[];
  rulesChanged: string[];
  /** One line per change, for a "what will change" summary. */
  summary: string[];
}

function rulesSig(el: UiFbElement): string {
  if (el.kind === 'static') return JSON.stringify(el.visibility ?? null);
  if (el.kind === 'group') return JSON.stringify([el.visibility ?? null, el.disabled ?? null, el.repeat ?? null]);
  return JSON.stringify([el.visibility ?? null, el.disabled ?? null, el.required ?? null, el.setValue ?? null, el.validators ?? null, el.calc ?? null]);
}

/** What changed between a published definition and a draft, worded for a confirmation screen. */
export function diffDefinitions(before: UiFormDefinition, after: UiFormDefinition): UiFbDiff {
  const a = new Map(allElements(before).map((e) => [e.id, e]));
  const b = new Map(allElements(after).map((e) => [e.id, e]));
  const diff: UiFbDiff = { added: [], removed: [], archived: [], restored: [], renamedKeys: [], typeChanged: [], optionsRemoved: [], rulesChanged: [], summary: [] };
  const nm = (e: UiFbElement) => `“${elementName(e)}”`;
  for (const [id, e] of b) {
    const old = a.get(id);
    if (!old) { diff.added.push(id); diff.summary.push(`Added ${nm(e)}`); continue; }
    if (!old.archived && e.archived) { diff.archived.push(id); diff.summary.push(`Archived ${nm(e)} (its saved answers are kept)`); }
    if (old.archived && !e.archived) { diff.restored.push(id); diff.summary.push(`Restored ${nm(e)}`); }
    if ((old.kind === 'field' || old.kind === 'group') && (e.kind === 'field' || e.kind === 'group') && old.key && e.key && old.key !== e.key) {
      diff.renamedKeys.push({ id, from: old.key, to: e.key });
      diff.summary.push(`Renamed the data key of ${nm(e)} from “${old.key}” to “${e.key}”`);
    }
    if (old.kind === 'field' && e.kind === 'field') {
      if (old.type !== e.type) {
        const compatible = typesCompatible(old.type, e.type) && valueKindOf(old.type) === valueKindOf(e.type);
        diff.typeChanged.push({ id, from: old.type, to: e.type, compatible });
        diff.summary.push(`Changed ${nm(e)} from ${fieldTypeInfo(old.type).label} to ${fieldTypeInfo(e.type).label}${compatible ? '' : '. Older answers may not show correctly'}`);
      }
      const now = new Set((e.options ?? []).filter((o) => !o.archived).map((o) => o.value));
      const gone = (old.options ?? []).filter((o) => !o.archived && !now.has(o.value)).map((o) => o.value);
      if (!old.source && !e.source && gone.length) {
        diff.optionsRemoved.push({ id, values: gone });
        diff.summary.push(`Removed ${gone.length} option${gone.length > 1 ? 's' : ''} from ${nm(e)}`);
      }
      if (old.source?.type !== e.source?.type) {
        diff.summary.push(e.source ? `${nm(e)} now takes its options from a data source` : `${nm(e)} now uses a typed list of options`);
      } else if (JSON.stringify(old.source?.params ?? {}) !== JSON.stringify(e.source?.params ?? {})) {
        diff.summary.push(`Changed the data source settings of ${nm(e)}`);
      }
    }
    if (rulesSig(old) !== rulesSig(e)) { diff.rulesChanged.push(id); diff.summary.push(`Changed the rules of ${nm(e)}`); }
  }
  for (const [id, e] of a) {
    if (!b.has(id)) { diff.removed.push(id); diff.summary.push(`Deleted ${nm(e)}`); }
  }
  return diff;
}
