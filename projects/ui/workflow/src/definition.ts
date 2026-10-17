import type { UiFbValueKind } from '@zouriel/ui/form-builder';
import type {
  UiWfAssignee,
  UiWfEntityDescriptor,
  UiWfFieldDescriptor,
  UiWfFieldType,
  UiWfKind,
  UiWfRecipient,
  UiWfState,
  UiWfStep,
  UiWfStepType,
  UiWfTemplate,
  UiWfTransition,
  UiWfTrigger,
  UiWorkflowDefinition,
  UiWorkflowRegistry,
} from './schema';

// ── Ids and keys ──────────────────────────────────────────────────────────

let seq = 0;

/** A new immutable id: short, unique enough for one definition, valid per the spec (`[A-Za-z0-9_-]`). */
export function wfId(prefix: string): string {
  seq = (seq + 1) % 1296;
  return `${prefix}_${Date.now().toString(36).slice(-4)}${seq.toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 5)}`;
}

/** `Send reminder` → `sendReminder` (a key: starts with a letter, letters/digits/underscores). */
export function wfKey(label: string, taken: Iterable<string> = []): string {
  const words = label.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  let base = words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('') || 'item';
  if (!/^[a-z]/.test(base)) base = 'k' + base;
  base = base.slice(0, 48);
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`;
}

// ── Creating definitions ──────────────────────────────────────────────────

export function createWorkflow(kind: UiWfKind, title = kind === 'lifecycle' ? 'New lifecycle' : 'New workflow', entity?: string): UiWorkflowDefinition {
  const id = wfId('wf');
  const def: UiWorkflowDefinition = { specVersion: 1, id, key: wfKey(title) + id.slice(-4), kind, title };
  if (entity) def.entity = entity;
  if (kind === 'automation') {
    def.trigger = { type: 'fieldChanged' };
    def.steps = [];
  } else {
    const draft = createState('Draft', 'initial');
    const done = createState('Done', 'terminal');
    def.lifecycle = {
      field: '',
      mode: 'enforce',
      states: [draft, done],
      transitions: [{ id: wfId('tr'), key: 'finish', label: 'Finish', from: [draft.id], to: done.id, who: [] }],
    };
  }
  return def;
}

export function createState(label: string, category: UiWfState['category'] = 'active', key?: string): UiWfState {
  return { id: wfId('st'), key: key ?? label, label, category, tone: category === 'terminal' ? 'success' : category === 'initial' ? 'neutral' : 'info' };
}

export function createTransition(from: string, to: string, label: string, existing: UiWfTransition[]): UiWfTransition {
  return { id: wfId('tr'), key: wfKey(label, existing.map((t) => t.key)), label, from: [from], to, who: [] };
}

// ── Step catalogue ────────────────────────────────────────────────────────

export type UiWfStepCategory = 'People' | 'Logic' | 'Timing' | 'Data' | 'Messages' | 'Advanced';

export interface UiWfStepInfo {
  type: UiWfStepType;
  label: string;
  description: string;
  category: UiWfStepCategory;
  /** Outputs other steps can read as `steps.ID.<output>`. Actions add the outputs their app declares. */
  outputs: string[];
  /** Has nested step lists (paths, outcomes…), so it renders as a container. */
  container?: boolean;
}

export const UI_WF_STEP_TYPES: readonly UiWfStepInfo[] = [
  { type: 'approval', label: 'Approval', description: 'Ask people to approve or reject, with a deadline', category: 'People', outputs: ['outcome', 'decidedBy', 'comments', 'data'], container: true },
  { type: 'task', label: 'Task', description: 'Ask someone to choose what happens next', category: 'People', outputs: ['outcome', 'decidedBy', 'comment', 'data'], container: true },
  { type: 'branch', label: 'Branch', description: 'Take a different path depending on conditions', category: 'Logic', outputs: ['path'], container: true },
  { type: 'switch', label: 'Switch', description: 'A path for each value of a field', category: 'Logic', outputs: ['case'], container: true },
  { type: 'parallel', label: 'Parallel paths', description: 'Run several paths at the same time', category: 'Logic', outputs: ['completed'], container: true },
  { type: 'forEach', label: 'For each', description: 'Repeat steps for every related record', category: 'Logic', outputs: ['count'], container: true },
  { type: 'goTo', label: 'Go back', description: 'Repeat from an earlier step, up to a limit', category: 'Logic', outputs: ['count'] },
  { type: 'end', label: 'End', description: 'Stop the workflow here', category: 'Logic', outputs: [] },
  { type: 'wait', label: 'Wait', description: 'Pause for a time, until a date, a condition or an event', category: 'Timing', outputs: ['timedOut', 'data'] },
  { type: 'setFields', label: 'Update record', description: 'Change fields on the record', category: 'Data', outputs: [] },
  { type: 'applyTransition', label: 'Move lifecycle', description: 'Move a record to another state', category: 'Data', outputs: ['applied'] },
  { type: 'setVariables', label: 'Set variables', description: 'Remember a value for later steps', category: 'Data', outputs: [] },
  { type: 'notify', label: 'Send notification', description: 'Email or message people', category: 'Messages', outputs: ['sent'] },
  { type: 'action', label: 'Run action', description: 'Run something the app provides', category: 'Advanced', outputs: [] },
  { type: 'webhook', label: 'Call webhook', description: 'Send data to another system', category: 'Advanced', outputs: ['status', 'body'] },
  { type: 'subWorkflow', label: 'Run workflow', description: 'Start another workflow and use its result', category: 'Advanced', outputs: ['instanceId', 'status', 'outputs'] },
];

const STEP_INFO = new Map(UI_WF_STEP_TYPES.map((s) => [s.type, s]));

export function stepInfo(type: UiWfStepType): UiWfStepInfo {
  return STEP_INFO.get(type) ?? { type, label: type, description: '', category: 'Advanced', outputs: [] };
}

/** A step's display name: its title, else its type's label. */
export function stepName(step: UiWfStep): string {
  return step.title?.trim() || stepInfo(step.type).label;
}

/** A new step with sensible defaults. */
export function createStep(type: UiWfStepType, reg?: UiWorkflowRegistry | null): UiWfStep {
  const id = wfId('s');
  switch (type) {
    case 'approval':
      return { id, type, assignees: [], rule: { type: 'any' }, due: 'P3D', reminders: ['P1D'], outcomes: { approved: [], rejected: [], timedOut: [] } };
    case 'task':
      return {
        id, type, assignees: [], due: 'P3D',
        outcomes: [{ id: wfId('o'), key: 'done', label: 'Done', tone: 'primary', steps: [] }],
        onTimeout: { id: wfId('l'), steps: [] },
      };
    case 'branch':
      return { id, type, paths: [{ id: wfId('p'), label: 'If', when: { match: 'all', conditions: [] }, steps: [] }], otherwise: { id: wfId('l'), label: 'Otherwise', steps: [] } };
    case 'switch':
      return { id, type, on: '', cases: [{ id: wfId('c'), label: 'Case 1', values: [], steps: [] }], otherwise: { id: wfId('l'), label: 'Otherwise', steps: [] } };
    case 'parallel':
      return { id, type, join: { type: 'all' }, paths: [{ id: wfId('p'), label: 'Path 1', steps: [] }, { id: wfId('p'), label: 'Path 2', steps: [] }] };
    case 'forEach':
      return { id, type, collection: '', max: 100, mode: 'sequential', steps: [] };
    case 'wait':
      return { id, type, until: { type: 'duration', duration: 'P1D' } };
    case 'setFields':
      return { id, type, values: [] };
    case 'setVariables':
      return { id, type, values: [] };
    case 'applyTransition':
      return { id, type, lifecycle: '', transition: '', ifNotAllowed: 'fail' };
    case 'notify':
      return { id, type, channel: reg?.channels?.[0]?.key ?? 'email', to: [], subject: '', body: '' };
    case 'webhook':
      return { id, type, method: 'POST', url: '' };
    case 'action':
      return { id, type, action: reg?.actions?.[0]?.key ?? '', input: {} };
    case 'subWorkflow':
      return { id, type, workflow: '', wait: true };
    case 'goTo':
      return { id, type, target: '', maxTimes: 3 };
    case 'end':
      return { id, type, result: 'completed' };
  }
}

// ── Step lists ────────────────────────────────────────────────────────────
//
// Every list of steps has an id, the same ids the engines use: `root` for an automation;
// `transition:ID`, `onEnter:ID`, `onExit:ID`, `sla:ID` in a lifecycle; `STEP/SLOT` for lists inside
// a step (`s3/path:p1`, `s5/outcome:approved`, `s9/each`, `s2/error`).

export interface UiWfSlot {
  slot: string;
  /** Shown above the list: "If amount is over 5,000", "Approved", "Otherwise"… */
  label: string;
  steps: UiWfStep[];
  /** How the slot behaves, for styling and for which side of a branch it is drawn on. */
  kind: 'path' | 'otherwise' | 'case' | 'outcome' | 'each' | 'timeout' | 'error';
  tone?: string;
}

/** The step lists nested in a step, in display order. */
export function stepSlots(step: UiWfStep): UiWfSlot[] {
  const slots: UiWfSlot[] = [];
  switch (step.type) {
    case 'branch':
      for (const p of step.paths) slots.push({ slot: `path:${p.id}`, label: p.label || 'If', steps: p.steps, kind: 'path' });
      if (step.otherwise) slots.push({ slot: 'otherwise', label: step.otherwise.label || 'Otherwise', steps: step.otherwise.steps, kind: 'otherwise' });
      break;
    case 'switch':
      for (const c of step.cases) slots.push({ slot: `case:${c.id}`, label: c.label, steps: c.steps, kind: 'case' });
      if (step.otherwise) slots.push({ slot: 'otherwise', label: step.otherwise.label || 'Otherwise', steps: step.otherwise.steps, kind: 'otherwise' });
      break;
    case 'parallel':
      for (const p of step.paths) slots.push({ slot: `path:${p.id}`, label: p.label || 'Path', steps: p.steps, kind: 'path' });
      break;
    case 'forEach':
      slots.push({ slot: 'each', label: 'For each item', steps: step.steps, kind: 'each' });
      break;
    case 'approval':
      slots.push({ slot: 'outcome:approved', label: 'Approved', steps: step.outcomes.approved, kind: 'outcome', tone: 'success' });
      slots.push({ slot: 'outcome:rejected', label: 'Rejected', steps: step.outcomes.rejected, kind: 'outcome', tone: 'danger' });
      slots.push({ slot: 'outcome:timedOut', label: 'Out of time', steps: step.outcomes.timedOut, kind: 'timeout', tone: 'warning' });
      break;
    case 'task':
      for (const o of step.outcomes) slots.push({ slot: `outcome:${o.key}`, label: o.label, steps: o.steps, kind: 'outcome', tone: o.tone });
      slots.push({ slot: 'onTimeout', label: 'Out of time', steps: step.onTimeout.steps, kind: 'timeout', tone: 'warning' });
      break;
    case 'wait':
      if ('onTimeout' in step.until && step.until.onTimeout) slots.push({ slot: 'onTimeout', label: 'Timed out', steps: step.until.onTimeout.steps, kind: 'timeout', tone: 'warning' });
      break;
  }
  if (step.onError && typeof step.onError === 'object') slots.push({ slot: 'error', label: 'If it fails', steps: step.onError.steps, kind: 'error', tone: 'danger' });
  return slots;
}

/** A copy of `step` whose list in `slot` is `steps`. */
export function withSlot(step: UiWfStep, slot: string, steps: UiWfStep[]): UiWfStep {
  if (slot === 'error') return { ...step, onError: { steps } };
  const [kind, key] = slot.split(':') as [string, string | undefined];
  switch (step.type) {
    case 'branch':
      if (kind === 'otherwise') return { ...step, otherwise: { ...(step.otherwise ?? { id: wfId('l'), label: 'Otherwise' }), steps } };
      return { ...step, paths: step.paths.map((p) => (p.id === key ? { ...p, steps } : p)) };
    case 'switch':
      if (kind === 'otherwise') return { ...step, otherwise: { ...(step.otherwise ?? { id: wfId('l'), label: 'Otherwise' }), steps } };
      return { ...step, cases: step.cases.map((c) => (c.id === key ? { ...c, steps } : c)) };
    case 'parallel':
      return { ...step, paths: step.paths.map((p) => (p.id === key ? { ...p, steps } : p)) };
    case 'forEach':
      return { ...step, steps };
    case 'approval':
      return { ...step, outcomes: { ...step.outcomes, [key as 'approved' | 'rejected' | 'timedOut']: steps } };
    case 'task':
      if (kind === 'onTimeout') return { ...step, onTimeout: { ...step.onTimeout, steps } };
      return { ...step, outcomes: step.outcomes.map((o) => (o.key === key ? { ...o, steps } : o)) };
    case 'wait':
      if ('onTimeout' in step.until && step.until.onTimeout) return { ...step, until: { ...step.until, onTimeout: { ...step.until.onTimeout, steps } } };
      return step;
  }
  return step;
}

/** The top-level step lists of a definition: `[listId, label, steps]`. */
export function rootLists(def: UiWorkflowDefinition): { id: string; label: string; steps: UiWfStep[] }[] {
  if (def.kind === 'automation') return [{ id: 'root', label: 'Steps', steps: def.steps ?? [] }];
  const lc = def.lifecycle;
  if (!lc) return [];
  const out: { id: string; label: string; steps: UiWfStep[] }[] = [];
  for (const s of lc.states) {
    if (s.onEnter) out.push({ id: `onEnter:${s.id}`, label: `On entering ${s.label}`, steps: s.onEnter });
    if (s.onExit) out.push({ id: `onExit:${s.id}`, label: `On leaving ${s.label}`, steps: s.onExit });
    if (s.sla) out.push({ id: `sla:${s.id}`, label: `When ${s.label} runs late`, steps: s.sla.steps });
  }
  for (const t of lc.transitions) if (t.steps) out.push({ id: `transition:${t.id}`, label: `After ${t.label}`, steps: t.steps });
  return out;
}

export interface UiWfStepLocation {
  step: UiWfStep;
  listId: string;
  index: number;
  /** The step holding the list, or null for a top-level list. */
  parentId: string | null;
  /** Every list on the way from the top, outermost first (the step's own list last). */
  path: string[];
}

/** Every step with where it sits. */
export function indexSteps(def: UiWorkflowDefinition): Map<string, UiWfStepLocation> {
  const map = new Map<string, UiWfStepLocation>();
  const walk = (listId: string, steps: UiWfStep[], parentId: string | null, path: string[]) => {
    const here = [...path, listId];
    steps.forEach((step, index) => {
      if (!map.has(step.id)) map.set(step.id, { step, listId, index, parentId, path: here });
      for (const s of stepSlots(step)) walk(`${step.id}/${s.slot}`, s.steps, step.id, here);
    });
  };
  for (const l of rootLists(def)) walk(l.id, l.steps, null, []);
  return map;
}

/** The steps in a list, or null if the list does not exist. */
export function listSteps(def: UiWorkflowDefinition, listId: string): UiWfStep[] | null {
  for (const l of rootLists(def)) if (l.id === listId) return l.steps;
  const slash = listId.indexOf('/');
  if (slash < 0) return null;
  const owner = indexSteps(def).get(listId.slice(0, slash));
  if (!owner) return null;
  return stepSlots(owner.step).find((s) => s.slot === listId.slice(slash + 1))?.steps ?? null;
}

/** Rebuilds every list (bottom-up), letting `f` replace any of them. Untouched lists keep their identity. */
export function mapLists(def: UiWorkflowDefinition, f: (listId: string, steps: UiWfStep[]) => UiWfStep[]): UiWorkflowDefinition {
  const mapList = (listId: string, steps: UiWfStep[]): UiWfStep[] => {
    let changed = false;
    const next = steps.map((step) => {
      let s = step;
      for (const slot of stepSlots(step)) {
        const inner = mapList(`${step.id}/${slot.slot}`, slot.steps);
        if (inner !== slot.steps) s = withSlot(s, slot.slot, inner);
      }
      if (s !== step) changed = true;
      return s;
    });
    return f(listId, changed ? next : steps);
  };
  if (def.kind === 'automation') {
    const steps = mapList('root', def.steps ?? []);
    return steps === def.steps ? def : { ...def, steps };
  }
  const lc = def.lifecycle;
  if (!lc) return def;
  let lcChanged = false;
  const states = lc.states.map((s) => {
    let n = s;
    if (s.onEnter) { const l = mapList(`onEnter:${s.id}`, s.onEnter); if (l !== s.onEnter) n = { ...n, onEnter: l }; }
    if (s.onExit) { const l = mapList(`onExit:${s.id}`, s.onExit); if (l !== s.onExit) n = { ...n, onExit: l }; }
    if (s.sla) { const l = mapList(`sla:${s.id}`, s.sla.steps); if (l !== s.sla.steps) n = { ...n, sla: { ...s.sla, steps: l } }; }
    if (n !== s) lcChanged = true;
    return n;
  });
  const transitions = lc.transitions.map((t) => {
    if (!t.steps) return t;
    const l = mapList(`transition:${t.id}`, t.steps);
    if (l === t.steps) return t;
    lcChanged = true;
    return { ...t, steps: l };
  });
  return lcChanged ? { ...def, lifecycle: { ...lc, states, transitions } } : def;
}

/** Replaces one step (found anywhere) with `f(step)`. */
export function updateStep(def: UiWorkflowDefinition, id: string, f: (s: UiWfStep) => UiWfStep): UiWorkflowDefinition {
  return mapLists(def, (_, steps) => {
    const i = steps.findIndex((s) => s.id === id);
    if (i < 0) return steps;
    const next = [...steps];
    next[i] = f(steps[i]);
    return next;
  });
}

/** Ensures a lifecycle list exists (e.g. a transition's "then do" list) so steps can be added to it. */
export function ensureList(def: UiWorkflowDefinition, listId: string): UiWorkflowDefinition {
  if (listSteps(def, listId) || !def.lifecycle) return def;
  const [kind, id] = listId.split(':');
  const lc = def.lifecycle;
  if (kind === 'transition') return { ...def, lifecycle: { ...lc, transitions: lc.transitions.map((t) => (t.id === id ? { ...t, steps: t.steps ?? [] } : t)) } };
  return {
    ...def,
    lifecycle: {
      ...lc,
      states: lc.states.map((s) => {
        if (s.id !== id) return s;
        if (kind === 'onEnter') return { ...s, onEnter: s.onEnter ?? [] };
        if (kind === 'onExit') return { ...s, onExit: s.onExit ?? [] };
        if (kind === 'sla') return { ...s, sla: s.sla ?? { within: 'P2D', steps: [] } };
        return s;
      }),
    },
  };
}

export function insertStep(def: UiWorkflowDefinition, listId: string, index: number, step: UiWfStep): UiWorkflowDefinition {
  const d = ensureList(def, listId);
  return mapLists(d, (id, steps) => {
    if (id !== listId) return steps;
    const next = [...steps];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, step);
    return next;
  });
}

export function removeStep(def: UiWorkflowDefinition, id: string): UiWorkflowDefinition {
  return mapLists(def, (_, steps) => (steps.some((s) => s.id === id) ? steps.filter((s) => s.id !== id) : steps));
}

/** Whether `listId` is inside step `stepId` (so the step cannot be dropped there). */
export function isInsideStep(def: UiWorkflowDefinition, listId: string, stepId: string): boolean {
  if (listId.startsWith(`${stepId}/`)) return true;
  const slash = listId.indexOf('/');
  if (slash < 0) return false;
  const owner = indexSteps(def).get(listId.slice(0, slash));
  return !!owner && (owner.step.id === stepId || owner.path.some((p) => p.startsWith(`${stepId}/`)));
}

/** Moves a step to `index` in `listId` (index counted before removal, like a drop line). */
export function moveStep(def: UiWorkflowDefinition, id: string, listId: string, index: number): UiWorkflowDefinition {
  const loc = indexSteps(def).get(id);
  if (!loc || isInsideStep(def, listId, id)) return def;
  if (loc.listId === listId && (index === loc.index || index === loc.index + 1)) return def;
  const adjusted = loc.listId === listId && index > loc.index ? index - 1 : index;
  return insertStep(removeStep(def, id), listId, adjusted, loc.step);
}

/**
 * Steps a "Go back" step may jump to: earlier steps in its own list, then earlier steps around
 * each enclosing container, stopping at a parallel path or a loop body (a jump can't leave those).
 */
export function goToTargets(def: UiWorkflowDefinition, stepId: string): UiWfStep[] {
  const idx = indexSteps(def);
  const loc = idx.get(stepId);
  if (!loc) return [];
  const out: UiWfStep[] = [];
  let listId = loc.listId;
  let index = loc.index;
  for (;;) {
    out.unshift(...(listSteps(def, listId) ?? []).slice(0, index));
    const slash = listId.indexOf('/');
    if (slash < 0) break;
    const owner = idx.get(listId.slice(0, slash));
    if (!owner || owner.step.type === 'parallel' || owner.step.type === 'forEach') break;
    listId = owner.listId;
    index = owner.index;
  }
  return out;
}

/** A deep copy of a step with fresh ids everywhere inside it. */
export function cloneStep(step: UiWfStep): UiWfStep {
  const fresh = (x: unknown, key?: string): unknown => {
    if (Array.isArray(x)) return x.map((v) => fresh(v));
    if (x && typeof x === 'object') {
      const o = { ...(x as Record<string, unknown>) };
      for (const k of Object.keys(o)) o[k] = fresh(o[k], k);
      // Steps, paths, cases, outcomes and step lists carry ids; forms (`schemaVersion`) keep theirs.
      if (typeof o['id'] === 'string' && !('schemaVersion' in o) && key !== 'form') o['id'] = wfId(String(o['id']).split('_')[0] || 'x');
      return o;
    }
    return x;
  };
  const copy = fresh(step) as UiWfStep;
  // Steps inside the copy that read each other (tokens, go-back targets) now point at the copies.
  const ids = new Map<string, string>();
  const pair = (a: UiWfStep, b: UiWfStep) => {
    ids.set(a.id, b.id);
    const sa = stepSlots(a), sb = stepSlots(b);
    sa.forEach((sl, i) => sl.steps.forEach((x, j) => pair(x, sb[i].steps[j])));
  };
  pair(step, copy);
  let json = JSON.stringify(copy);
  for (const [from, to] of ids) json = json.split(`steps.${from}.`).join(`steps.${to}.`).split(`"target":"${from}"`).join(`"target":"${to}"`);
  const out = JSON.parse(json) as UiWfStep;
  out.title = `${stepName(step)} (copy)`;
  return out;
}

export function duplicateStep(def: UiWorkflowDefinition, id: string): { def: UiWorkflowDefinition; id: string | null } {
  const loc = indexSteps(def).get(id);
  if (!loc) return { def, id: null };
  const copy = cloneStep(loc.step);
  return { def: insertStep(def, loc.listId, loc.index + 1, copy), id: copy.id };
}

/** Steps (anywhere) that refer to step `id` through a token or a go-back. */
export function stepReferences(def: UiWorkflowDefinition, id: string): UiWfStep[] {
  const out: UiWfStep[] = [];
  const needle = `steps.${id}.`;
  for (const { step } of indexSteps(def).values()) {
    if (step.id === id) continue;
    const json = JSON.stringify(step);
    if (json.includes(`"${needle}`) || json.includes(`"ref":"${needle}`) || (step.type === 'goTo' && step.target === id)) out.push(step);
  }
  return out;
}

// ── Registry helpers ──────────────────────────────────────────────────────

export function entityOf(reg: UiWorkflowRegistry | null | undefined, key: string | undefined | null): UiWfEntityDescriptor | undefined {
  return key ? reg?.entities.find((e) => e.key === key) : undefined;
}

export function fieldOf(reg: UiWorkflowRegistry | null | undefined, entity: string | undefined | null, field: string | undefined | null): UiWfFieldDescriptor | undefined {
  return field ? entityOf(reg, entity)?.fields.find((f) => f.key === field) : undefined;
}

/** The form-builder value kind of a registry field, for choosing condition operators. */
export function valueKindOfField(type: UiWfFieldType | undefined): UiFbValueKind {
  switch (type) {
    case 'number': case 'currency': return 'number';
    case 'date': case 'dateTime': return 'date';
    case 'enum': case 'user': case 'relation': return 'choice';
    case 'boolean': return 'boolean';
    case 'collection': return 'multi';
    default: return 'text';
  }
}

/** Shows a stored value the way people recognise it (an option's label). */
export function optionLabel(field: UiWfFieldDescriptor | undefined, value: unknown): string {
  if (value === null || value === undefined || value === '') return '…';
  const o = field?.options?.find((x) => String(x.value) === String(value));
  if (o) return o.label;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

// ── Tokens (values steps can read) ────────────────────────────────────────

export interface UiWfToken {
  path: string;
  label: string;
  /** The group it is listed under: "Application", "Trigger", "Approval: Finance sign-off"… */
  group: string;
  type: UiWfFieldType | 'any';
  options?: UiWfFieldDescriptor['options'];
  entity?: string;
}

export interface UiWfTokenContext {
  def: UiWorkflowDefinition;
  registry: UiWorkflowRegistry | null;
  /** Outputs per step type as the engine reports them (`GET /schema` steps). */
  outputs?: Partial<Record<UiWfStepType, string[]>>;
  /** Where the value is used: a step (tokens upstream of it) or a list position. */
  at?: { stepId: string } | { listId: string; index: number };
  /** Whether `input.*` (a transition's or manual start's form answers) is available here. */
  inputFields?: { key: string; label: string }[];
}

const FIELD_TYPES_FOR_PICKERS: UiWfFieldType[] = ['text', 'longText', 'email', 'phone', 'url', 'number', 'currency', 'boolean', 'date', 'dateTime', 'enum', 'user', 'relation', 'json'];

function entityTokens(reg: UiWorkflowRegistry | null, entityKey: string, prefix: string, group: string, depth = 0): UiWfToken[] {
  const e = entityOf(reg, entityKey);
  if (!e) return [];
  const out: UiWfToken[] = [];
  for (const f of e.fields) {
    if (f.readable === false || !FIELD_TYPES_FOR_PICKERS.includes(f.type)) continue;
    out.push({ path: `${prefix}.${f.key}`, label: f.label, group, type: f.type, options: f.options, entity: f.entity });
    if (f.type === 'relation' && f.entity && depth < 1) out.push(...entityTokens(reg, f.entity, `${prefix}.${f.key}`, `${group} › ${f.label}`, depth + 1));
  }
  return out;
}

/** Steps upstream of a position: earlier in the same list, and earlier around every enclosing container. */
export function upstreamSteps(def: UiWorkflowDefinition, at: UiWfTokenContext['at']): UiWfStep[] {
  if (!at) return [];
  const idx = indexSteps(def);
  let listId: string;
  let index: number;
  if ('stepId' in at) {
    const loc = idx.get(at.stepId);
    if (!loc) return [];
    listId = loc.listId;
    index = loc.index;
  } else {
    listId = at.listId;
    index = at.index;
  }
  const out: UiWfStep[] = [];
  for (;;) {
    const steps = listSteps(def, listId) ?? [];
    out.unshift(...steps.slice(0, index));
    const slash = listId.indexOf('/');
    if (slash < 0) break;
    const owner = idx.get(listId.slice(0, slash));
    if (!owner) break;
    // The container itself has run (its outputs are available inside its lists); parallel paths
    // and loop bodies don't see their siblings.
    out.push(owner.step);
    listId = owner.listId;
    index = owner.index;
  }
  return out;
}

/** Everything a value can be read from at a position, grouped for a picker. */
export function tokensAt(ctx: UiWfTokenContext): UiWfToken[] {
  const { def, registry: reg } = ctx;
  const tokens: UiWfToken[] = [];
  const entity = entityOf(reg, def.entity);
  if (entity) tokens.push({ path: 'entity.id', label: `${entity.label} id`, group: entity.label, type: 'text' }, ...entityTokens(reg, entity.key, 'entity', entity.label));
  const trig = def.trigger;
  if (def.kind === 'automation' && trig) {
    if (trig.type === 'fieldChanged' && trig.field) {
      const f = fieldOf(reg, def.entity, trig.field);
      tokens.push(
        { path: 'trigger.from', label: `${f?.label ?? trig.field} before`, group: 'What started it', type: f?.type ?? 'any', options: f?.options },
        { path: 'trigger.to', label: `${f?.label ?? trig.field} after`, group: 'What started it', type: f?.type ?? 'any', options: f?.options },
      );
    }
    if (trig.type === 'stateEntered' || trig.type === 'transitionApplied') {
      tokens.push(
        { path: 'trigger.from', label: 'State before', group: 'What started it', type: 'text' },
        { path: 'trigger.to', label: 'State after', group: 'What started it', type: 'text' },
        { path: 'trigger.transition', label: 'Transition', group: 'What started it', type: 'text' },
      );
    }
    if (trig.type === 'signal') {
      const sig = reg?.signals?.find((s) => s.key === trig.signal);
      for (const f of sig?.fields ?? []) tokens.push({ path: `trigger.data.${f.key}`, label: f.label, group: sig!.label, type: f.type, options: f.options });
    }
  } else if (def.kind === 'lifecycle') {
    tokens.push(
      { path: 'trigger.from', label: 'State before', group: 'The move', type: 'text' },
      { path: 'trigger.to', label: 'State after', group: 'The move', type: 'text' },
      { path: 'trigger.transition', label: 'Transition', group: 'The move', type: 'text' },
    );
  }
  tokens.push({ path: 'trigger.actor', label: 'Person who started it', group: 'What started it', type: 'user' }, { path: 'trigger.at', label: 'When it started', group: 'What started it', type: 'dateTime' });
  for (const f of ctx.inputFields ?? []) tokens.push({ path: `input.${f.key}`, label: f.label, group: 'Form answers', type: 'any' });
  // Inside a forEach, the current item.
  if (ctx.at) {
    const idx = indexSteps(def);
    const listId = 'stepId' in ctx.at ? idx.get(ctx.at.stepId)?.listId : ctx.at.listId;
    const path = listId ? [...(('stepId' in ctx.at ? idx.get(ctx.at.stepId)?.path : undefined) ?? []), listId] : [];
    for (const l of path) {
      const slash = l.indexOf('/');
      if (slash < 0 || l.slice(slash + 1) !== 'each') continue;
      const fe = idx.get(l.slice(0, slash))?.step;
      if (fe?.type !== 'forEach') continue;
      const coll = collectionField(reg, def.entity, fe.collection);
      if (coll?.entity) {
        const label = entityOf(reg, coll.entity)?.label ?? 'Item';
        tokens.push({ path: 'item.id', label: `${label} id`, group: `Current ${label.toLowerCase()}`, type: 'text' },
          { path: 'item.index', label: 'Position (from 0)', group: `Current ${label.toLowerCase()}`, type: 'number' },
          ...entityTokens(reg, coll.entity, 'item', `Current ${label.toLowerCase()}`));
      }
    }
  }
  for (const s of upstreamSteps(def, ctx.at)) {
    const outs = s.type === 'action'
      ? [...(reg?.actions?.find((a) => a.key === s.action)?.outputs.map((o) => o.key) ?? [])]
      : ctx.outputs?.[s.type] ?? stepInfo(s.type).outputs;
    for (const o of outs) tokens.push({ path: `steps.${s.id}.${o}`, label: outputLabel(s, o, reg), group: stepName(s), type: o === 'decidedBy' ? 'user' : 'any' });
  }
  for (const v of def.variables ?? []) tokens.push({ path: `vars.${v.key}`, label: v.label, group: 'Variables', type: v.type === 'json' ? 'json' : v.type });
  tokens.push({ path: 'today', label: 'Today', group: 'Time', type: 'date' }, { path: 'now', label: 'Now', group: 'Time', type: 'dateTime' });
  return tokens;
}

function outputLabel(step: UiWfStep, output: string, reg: UiWorkflowRegistry | null): string {
  if (step.type === 'action') return reg?.actions?.find((a) => a.key === step.action)?.outputs.find((o) => o.key === output)?.label ?? output;
  const words: Record<string, string> = {
    outcome: 'Outcome', decidedBy: 'Decided by', comments: 'Comments', comment: 'Comment', data: 'Answers', path: 'Path taken', case: 'Case taken',
    completed: 'Paths finished', count: 'Count', timedOut: 'Timed out', applied: 'Applied', sent: 'Messages sent', status: 'Status code', body: 'Response',
    instanceId: 'Run id', outputs: 'Results', error: 'Error',
  };
  return words[output] ?? output;
}

/** The registry field a collection path (`entity.documents`, `entity.programme.courses`) ends at. */
export function collectionField(reg: UiWorkflowRegistry | null, entity: string | undefined, path: string): UiWfFieldDescriptor | undefined {
  const parts = path.split('.');
  if (parts[0] !== 'entity' || parts.length < 2) return undefined;
  let e = entity;
  let f: UiWfFieldDescriptor | undefined;
  for (let i = 1; i < parts.length; i++) {
    f = fieldOf(reg, e, parts[i]);
    if (!f) return undefined;
    e = f.entity;
  }
  return f?.type === 'collection' ? f : undefined;
}

/** Collections the record has (for forEach). */
export function collectionsOf(reg: UiWorkflowRegistry | null, entity: string | undefined): { path: string; label: string; entity: string }[] {
  const e = entityOf(reg, entity);
  if (!e) return [];
  const out: { path: string; label: string; entity: string }[] = [];
  for (const f of e.fields) {
    if (f.type === 'collection' && f.entity) out.push({ path: `entity.${f.key}`, label: f.label, entity: f.entity });
    if (f.type === 'relation' && f.entity)
      for (const g of entityOf(reg, f.entity)?.fields ?? [])
        if (g.type === 'collection' && g.entity) out.push({ path: `entity.${f.key}.${g.key}`, label: `${f.label} › ${g.label}`, entity: g.entity });
  }
  return out;
}

/** A token's label for display: "Application › Status". */
export function tokenLabel(tokens: readonly UiWfToken[], path: string): string {
  const t = tokens.find((x) => x.path === path);
  if (t) return t.group === 'Time' || t.group === 'Variables' ? t.label : `${t.group} › ${t.label}`;
  return path;
}

// ── Plain-English summaries ───────────────────────────────────────────────

export interface UiWfDescribeContext {
  registry: UiWorkflowRegistry | null;
  def: UiWorkflowDefinition;
  tokens?: readonly UiWfToken[];
  /** Other workflows' titles by key (for sub-workflows and lifecycle triggers). */
  workflowTitle?: (key: string) => string | undefined;
  /** Another lifecycle's published definition by key, when loaded (names its states and transitions). */
  lifecycle?: (key: string) => UiWorkflowDefinition | undefined;
  userName?: (id: string) => string | undefined;
}

export function describeDuration(iso: string | undefined | null): string {
  if (!iso) return 'no time set';
  const m = /^(-)?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m) return iso;
  const parts: string[] = [];
  const add = (n: string | undefined, unit: string) => { if (n && +n) parts.push(`${+n} ${unit}${+n === 1 ? '' : 's'}`); };
  add(m[2], 'year'); add(m[3], 'month'); add(m[4], 'week'); add(m[5], 'day'); add(m[6], 'hour'); add(m[7], 'minute'); add(m[8], 'second');
  const text = parts.length ? parts.join(' ') : 'no time';
  return m[1] ? `${text} before` : text;
}

export function describeAssignees(list: readonly (UiWfAssignee | UiWfRecipient)[] | undefined, ctx: UiWfDescribeContext): string {
  if (!list?.length) return 'nobody yet';
  const names = list.map((a) => {
    if ('role' in a) return ctx.registry?.roles?.find((r) => r.key === a.role)?.label ?? a.role;
    if ('group' in a) return ctx.registry?.groups?.find((g) => g.key === a.group)?.label ?? a.group;
    if ('user' in a) return ctx.userName?.(a.user) ?? a.user;
    if ('field' in a) return ctx.tokens ? tokenLabel(ctx.tokens, a.field) : a.field;
    if ('managerOf' in a) return a.managerOf === 'initiator' ? 'manager of whoever started it' : a.managerOf === 'assignees' ? 'their managers' : `manager of ${ctx.tokens ? tokenLabel(ctx.tokens, a.managerOf) : a.managerOf}`;
    if ('initiator' in a) return 'whoever started it';
    if ('email' in a) return typeof a.email === 'string' ? a.email : templateText(a.email, ctx.tokens);
    return '?';
  });
  return names.length > 2 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join(' and ');
}

export function templateText(t: UiWfTemplate | undefined, tokens?: readonly UiWfToken[]): string {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t.map((p) => (typeof p === 'string' ? p : `[${tokens ? tokenLabel(tokens, p.ref) : p.ref}]`)).join('');
}

export function describeTrigger(t: UiWfTrigger | undefined, ctx: UiWfDescribeContext): string {
  if (!t) return 'Choose what starts this workflow';
  const e = entityOf(ctx.registry, ctx.def.entity);
  const rec = e?.label.toLowerCase() ?? 'record';
  const aRec = `${/^[aeiou]/.test(rec) ? 'an' : 'a'} ${rec}`;
  const f = fieldOf(ctx.registry, ctx.def.entity, t.field);
  const vals = (v: unknown[] | undefined) => (v ?? []).map((x) => optionLabel(f, x)).join(' or ');
  switch (t.type) {
    case 'created': return `When ${aRec} is created`;
    case 'deleted': return `When ${aRec} is deleted`;
    case 'fieldChanged':
      if (!t.field) return `When ${aRec} changes`;
      return `When ${f?.label ?? t.field} ${t.from?.length ? `changes from ${vals(t.from)} ` : 'changes '}${t.to?.length ? `to ${vals(t.to)}` : ''}`.trim();
    case 'stateEntered': {
      const states = ctx.lifecycle?.(t.lifecycle ?? '')?.lifecycle?.states ?? [];
      const names = (t.states ?? []).map((k) => states.find((s) => s.key === k)?.label ?? k);
      return `When ${ctx.workflowTitle?.(t.lifecycle ?? '') ?? t.lifecycle ?? 'a lifecycle'} enters ${names.join(' or ') || '…'}`;
    }
    case 'transitionApplied': {
      const moves = ctx.lifecycle?.(t.lifecycle ?? '')?.lifecycle?.transitions ?? [];
      const names = (t.transitions ?? []).map((k) => `“${moves.find((m) => m.key === k)?.label ?? k}”`);
      return `After ${names.join(' or ') || '…'} in ${ctx.workflowTitle?.(t.lifecycle ?? '') ?? t.lifecycle ?? 'a lifecycle'}`;
    }
    case 'dateReached': return `${describeDuration(t.offset)} ${f?.label ?? t.field ?? 'a date'}`.replace(/^no time set /, 'On ');
    case 'schedule': return `On a schedule (${t.cron ?? '…'})${t.forEach ? ` for each matching ${rec}` : ''}`;
    case 'manual': return `When someone presses “${t.label || 'Start'}”`;
    case 'signal': return `When the app reports ${ctx.registry?.signals?.find((s) => s.key === t.signal)?.label ?? t.signal ?? '…'}`;
  }
}

export function describeStep(step: UiWfStep, ctx: UiWfDescribeContext): string {
  const reg = ctx.registry;
  switch (step.type) {
    case 'approval': {
      const rule = step.rule.type === 'all' ? 'all of' : step.rule.type === 'count' ? `${step.rule.value ?? '?'} of` : step.rule.type === 'percent' ? `${step.rule.value ?? '?'}% of` : 'any of';
      return `${rule} ${describeAssignees(step.assignees, ctx)} · due in ${describeDuration(step.due)}`;
    }
    case 'task': return `${describeAssignees(step.assignees, ctx)} · due in ${describeDuration(step.due)}`;
    case 'branch': return `${step.paths.length} path${step.paths.length === 1 ? '' : 's'}${step.otherwise ? ' and otherwise' : ''}`;
    case 'switch': return step.on ? `on ${ctx.tokens ? tokenLabel(ctx.tokens, step.on) : step.on}` : 'Choose what to switch on';
    case 'parallel': return `${step.paths.length} paths · continue when ${step.join.type === 'all' ? 'all finish' : step.join.type === 'any' ? 'the first finishes' : `${step.join.count ?? '?'} finish`}`;
    case 'forEach': {
      const c = collectionsOf(reg, ctx.def.entity).find((x) => x.path === step.collection);
      return c ? `each of ${c.label}${step.mode === 'parallel' ? ', at the same time' : ''}` : 'Choose a list';
    }
    case 'wait': {
      const u = step.until;
      if (u.type === 'duration') return `for ${describeDuration(u.duration)}${u.calendar === 'working' ? ' of working time' : ''}`;
      if (u.type === 'date') return `until ${'ref' in u.date && ctx.tokens ? tokenLabel(ctx.tokens, u.date.ref) : 'a date'}${u.offset ? ` (${describeDuration(u.offset)})` : ''}`;
      if (u.type === 'condition') return `until a condition holds · at most ${describeDuration(u.timeout)}`;
      return `for ${reg?.signals?.find((s) => s.key === u.signal)?.label ?? (u.signal || 'an event')}`;
    }
    case 'setFields': return step.values.length ? step.values.map((v) => fieldOf(reg, ctx.def.entity, v.field)?.label ?? v.field).join(', ') : 'Choose fields to change';
    case 'setVariables': return step.values.length ? step.values.map((v) => ctx.def.variables?.find((x) => x.id === v.variable)?.label ?? '?').join(', ') : 'Choose variables';
    case 'applyTransition': return step.transition ? `${step.transition} in ${ctx.workflowTitle?.(step.lifecycle) ?? step.lifecycle}` : 'Choose a transition';
    case 'notify': return `${reg?.channels?.find((c) => c.key === step.channel)?.label ?? step.channel} to ${describeAssignees(step.to, ctx)}`;
    case 'webhook': return `${step.method} ${step.connection ?? step.url ?? ''}`.trim();
    case 'action': return reg?.actions?.find((a) => a.key === step.action)?.label ?? (step.action || 'Choose an action');
    case 'subWorkflow': return step.workflow ? `${ctx.workflowTitle?.(step.workflow) ?? step.workflow}${step.wait ? ', and wait' : ''}` : 'Choose a workflow';
    case 'goTo': return step.target ? `to ${(() => { const t = indexSteps(ctx.def).get(step.target)?.step; return t ? stepName(t) : '?'; })()} · up to ${step.maxTimes}×` : 'Choose a step';
    case 'end': return step.result === 'failed' ? 'as failed' : 'as finished';
  }
}

// ── Lifecycle helpers ─────────────────────────────────────────────────────

/** Whether transition `t` can start from state `stateId`. */
export function transitionAllows(def: UiWorkflowDefinition, t: UiWfTransition, stateId: string): boolean {
  if (t.from === '*') {
    const s = def.lifecycle?.states.find((x) => x.id === stateId);
    return !!s && s.category !== 'terminal' && s.id !== t.to;
  }
  return t.from.includes(stateId);
}

export function updateLifecycle(def: UiWorkflowDefinition, f: (lc: NonNullable<UiWorkflowDefinition['lifecycle']>) => NonNullable<UiWorkflowDefinition['lifecycle']>): UiWorkflowDefinition {
  return def.lifecycle ? { ...def, lifecycle: f(def.lifecycle) } : def;
}

export function updateState(def: UiWorkflowDefinition, id: string, patch: Partial<UiWfState> | ((s: UiWfState) => UiWfState)): UiWorkflowDefinition {
  return updateLifecycle(def, (lc) => ({ ...lc, states: lc.states.map((s) => (s.id === id ? (typeof patch === 'function' ? patch(s) : { ...s, ...patch }) : s)) }));
}

export function updateTransition(def: UiWorkflowDefinition, id: string, patch: Partial<UiWfTransition> | ((t: UiWfTransition) => UiWfTransition)): UiWorkflowDefinition {
  return updateLifecycle(def, (lc) => ({ ...lc, transitions: lc.transitions.map((t) => (t.id === id ? (typeof patch === 'function' ? patch(t) : { ...t, ...patch }) : t)) }));
}

/** Removes a state with the transitions into and out of it. */
export function removeState(def: UiWorkflowDefinition, id: string): UiWorkflowDefinition {
  return updateLifecycle(def, (lc) => {
    const layout = { ...(lc.layout ?? {}) };
    delete layout[id];
    return {
      ...lc,
      states: lc.states.filter((s) => s.id !== id),
      transitions: lc.transitions
        .filter((t) => t.to !== id)
        .map((t) => (t.from === '*' ? t : { ...t, from: t.from.filter((f) => f !== id) }))
        .filter((t) => t.from === '*' || t.from.length > 0),
      layout,
    };
  });
}
