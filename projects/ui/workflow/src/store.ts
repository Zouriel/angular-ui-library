import { Injectable, computed, signal } from '@angular/core';
import type { UiWfDefinitionSummary, UiWfProblem, UiWorkflowApi } from './api';
import {
  createState,
  createStep,
  createTransition,
  createWorkflow,
  duplicateStep,
  entityOf,
  indexSteps,
  insertStep,
  moveStep,
  removeState,
  removeStep,
  tokensAt,
  updateLifecycle,
  updateState,
  updateStep,
  updateTransition,
  type UiWfDescribeContext,
  type UiWfToken,
  type UiWfTokenContext,
} from './definition';
import type { UiWfState, UiWfStep, UiWfStepType, UiWfTransition, UiWfTrigger, UiWorkflowDefinition, UiWorkflowSchema, UiWorkflowSettings } from './schema';

export type WfSelection =
  | { kind: 'workflow' }
  | { kind: 'trigger' }
  | { kind: 'step'; id: string }
  | { kind: 'state'; id: string }
  | { kind: 'transition'; id: string };

const HISTORY_LIMIT = 200;
/** Edits to the same setting within this window are undone together (typing a title). */
const MERGE_MS = 1200;

/**
 * Builder state: the definition being edited, the app's registry, what is selected, the problems
 * the engine reports, and undo/redo. Every change goes through `commit` so it can be undone.
 */
@Injectable()
export class WfBuilderStore {
  readonly def = signal<UiWorkflowDefinition>(createWorkflow('automation'));
  readonly schema = signal<UiWorkflowSchema | null>(null);
  readonly published = signal<UiWorkflowDefinition | null>(null);
  /** Other workflows (for sub-workflows and lifecycle triggers). */
  readonly others = signal<UiWfDefinitionSummary[]>([]);
  readonly api = signal<UiWorkflowApi | null>(null);
  /** The app's global workflow settings (webhook connections, calendar…), when known. */
  readonly settings = signal<UiWorkflowSettings | null>(null);
  /** Published versions of other lifecycles, by key (for lifecycle triggers), loaded on demand. */
  readonly lifecycleCache = signal<Record<string, UiWorkflowDefinition>>({});
  private readonly loading = new Set<string>();
  readonly selection = signal<WfSelection | null>(null);
  readonly serverProblems = signal<UiWfProblem[]>([]);
  readonly validating = signal(false);
  /** Bumped on every commit, so hosts can tell their own echo from a new definition. */
  readonly version = signal(0);
  readonly canUndo = signal(false);
  /** Looking only: every edit is ignored (the person may not change workflows). */
  readonly readOnly = signal(false);
  readonly canRedo = signal(false);

  private past: UiWorkflowDefinition[] = [];
  private future: UiWorkflowDefinition[] = [];
  private lastMerge: { key: string; at: number } | null = null;

  readonly registry = computed(() => this.schema()?.registry ?? null);
  readonly settingsConnections = computed(() => this.settings()?.webhooks?.connections ?? []);
  readonly entity = computed(() => entityOf(this.registry(), this.def().entity));
  readonly steps = computed(() => indexSteps(this.def()));
  readonly problems = computed(() => this.serverProblems());
  readonly errorCount = computed(() => this.problems().filter((p) => p.severity === 'error').length);
  /** Problems per step, state or transition id (null key = the workflow itself). */
  readonly problemsByNode = computed(() => {
    const m = new Map<string | null, UiWfProblem[]>();
    for (const p of this.problems()) m.set(p.node, [...(m.get(p.node) ?? []), p]);
    return m;
  });
  readonly outputs = computed(() => Object.fromEntries((this.schema()?.steps ?? []).map((s) => [s.type, s.outputs])) as UiWfTokenContext['outputs']);
  readonly selectedStep = computed(() => {
    const s = this.selection();
    return s?.kind === 'step' ? this.steps().get(s.id)?.step ?? null : null;
  });
  readonly selectedState = computed(() => {
    const s = this.selection();
    return s?.kind === 'state' ? this.def().lifecycle?.states.find((x) => x.id === s.id) ?? null : null;
  });
  readonly selectedTransition = computed(() => {
    const s = this.selection();
    return s?.kind === 'transition' ? this.def().lifecycle?.transitions.find((x) => x.id === s.id) ?? null : null;
  });

  /** Fetches another lifecycle's published version once, so its states and transitions can be offered. */
  loadLifecycle(key: string): void {
    const api = this.api();
    const summary = this.others().find((o) => o.key === key);
    if (!api || !summary || this.lifecycleCache()[key] || this.loading.has(key)) return;
    this.loading.add(key);
    api.definition(summary.id)
      .then((d) => { if (d.published) this.lifecycleCache.update((c) => ({ ...c, [key]: d.published! })); })
      .catch(() => undefined)
      .finally(() => this.loading.delete(key));
  }

  /** Tokens available at a step or list position, for pickers. */
  tokens(at?: UiWfTokenContext['at'], inputFields?: UiWfTokenContext['inputFields']): UiWfToken[] {
    return tokensAt({ def: this.def(), registry: this.registry(), outputs: this.outputs(), at, inputFields });
  }

  describeContext(tokens?: readonly UiWfToken[]): UiWfDescribeContext {
    return {
      registry: this.registry(),
      def: this.def(),
      tokens,
      workflowTitle: (key) => this.others().find((o) => o.key === key)?.title,
      lifecycle: (key) => { this.loadLifecycle(key); return this.lifecycleCache()[key]; },
    };
  }

  // ── History ─────────────────────────────────────────────────────────

  /** Loads a definition. History is kept when it is the same workflow (e.g. the host echoed a save). */
  load(def: UiWorkflowDefinition): void {
    if (def === this.def()) return;
    if (def.id !== this.def().id) this.clearHistory();
    this.def.set(def);
    this.pruneSelection();
  }

  clearHistory(): void {
    this.past = [];
    this.future = [];
    this.lastMerge = null;
    this.syncHistory();
  }

  /** Applies a change. Changes with the same `mergeKey` in quick succession undo as one. */
  commit(next: UiWorkflowDefinition, mergeKey?: string): void {
    const cur = this.def();
    if (next === cur || this.readOnly()) return;
    const now = Date.now();
    const merge = mergeKey && this.lastMerge?.key === mergeKey && now - this.lastMerge.at < MERGE_MS;
    if (!merge) {
      this.past.push(cur);
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
    }
    this.lastMerge = mergeKey ? { key: mergeKey, at: now } : null;
    this.future = [];
    this.def.set(next);
    this.version.update((v) => v + 1);
    this.pruneSelection();
    this.syncHistory();
  }

  undo(): void {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.def());
    this.apply(prev);
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.def());
    this.apply(next);
  }

  private apply(def: UiWorkflowDefinition): void {
    this.lastMerge = null;
    this.def.set(def);
    this.version.update((v) => v + 1);
    this.pruneSelection();
    this.syncHistory();
  }

  private syncHistory(): void {
    this.canUndo.set(this.past.length > 0);
    this.canRedo.set(this.future.length > 0);
  }

  /** Drops a selection whose item no longer exists (after undo or delete). */
  private pruneSelection(): void {
    const s = this.selection();
    if (!s) return;
    const def = this.def();
    const exists =
      s.kind === 'workflow' || s.kind === 'trigger' ? true
        : s.kind === 'step' ? this.steps().has(s.id)
          : s.kind === 'state' ? !!def.lifecycle?.states.some((x) => x.id === s.id)
            : !!def.lifecycle?.transitions.some((x) => x.id === s.id);
    if (!exists) this.selection.set(null);
  }

  // ── Edits ───────────────────────────────────────────────────────────

  patch(patch: Partial<UiWorkflowDefinition>, mergeKey?: string): void {
    this.commit({ ...this.def(), ...patch }, mergeKey);
  }

  setTrigger(trigger: UiWfTrigger, mergeKey?: string): void {
    this.commit({ ...this.def(), trigger }, mergeKey);
  }

  addStep(type: UiWfStepType, listId: string, index: number): string {
    const step = createStep(type, this.registry());
    this.commit(insertStep(this.def(), listId, index, step));
    this.selection.set({ kind: 'step', id: step.id });
    return step.id;
  }

  insertStep(step: UiWfStep, listId: string, index: number): void {
    this.commit(insertStep(this.def(), listId, index, step));
  }

  moveStep(id: string, listId: string, index: number): boolean {
    const next = moveStep(this.def(), id, listId, index);
    if (next === this.def()) return false;
    this.commit(next);
    return true;
  }

  /** Merges `patch` into a step (keys set to `undefined` are removed), or replaces it with `patch(step)`. */
  updateStep(id: string, patch: Record<string, unknown> | ((s: UiWfStep) => UiWfStep), mergeKey?: string): void {
    this.commit(updateStep(this.def(), id, (s) => {
      if (typeof patch === 'function') return patch(s);
      const next = { ...s, ...patch } as Record<string, unknown>;
      for (const k of Object.keys(patch)) if (next[k] === undefined) delete next[k];
      return next as unknown as UiWfStep;
    }), mergeKey);
  }

  removeStep(id: string): void {
    this.commit(removeStep(this.def(), id));
  }

  duplicateStep(id: string): void {
    const r = duplicateStep(this.def(), id);
    if (!r.id) return;
    this.commit(r.def);
    this.selection.set({ kind: 'step', id: r.id });
  }

  // ── Lifecycle edits ─────────────────────────────────────────────────

  addState(label = 'New state', at?: [number, number]): string {
    const def = this.def();
    const taken = new Set(def.lifecycle?.states.map((s) => s.key));
    let key = label;
    for (let i = 2; taken.has(key); i++) key = `${label} ${i}`;
    const state = createState(key, 'active');
    this.commit(updateLifecycle(def, (lc) => ({ ...lc, states: [...lc.states, state], layout: at ? { ...(lc.layout ?? {}), [state.id]: at } : lc.layout })));
    this.selection.set({ kind: 'state', id: state.id });
    return state.id;
  }

  updateState(id: string, patch: Partial<UiWfState> | ((s: UiWfState) => UiWfState), mergeKey?: string): void {
    this.commit(updateState(this.def(), id, patch), mergeKey);
  }

  removeState(id: string): void {
    this.commit(removeState(this.def(), id));
  }

  addTransition(from: string, to: string, label?: string): string {
    const lc = this.def().lifecycle;
    if (!lc) return '';
    const toState = lc.states.find((s) => s.id === to);
    const t = createTransition(from, to, label ?? (toState ? `To ${toState.label}` : 'Move'), lc.transitions);
    this.commit(updateLifecycle(this.def(), (l) => ({ ...l, transitions: [...l.transitions, t] })));
    this.selection.set({ kind: 'transition', id: t.id });
    return t.id;
  }

  updateTransition(id: string, patch: Partial<UiWfTransition> | ((t: UiWfTransition) => UiWfTransition), mergeKey?: string): void {
    this.commit(updateTransition(this.def(), id, patch), mergeKey);
  }

  removeTransition(id: string): void {
    this.commit(updateLifecycle(this.def(), (lc) => ({ ...lc, transitions: lc.transitions.filter((t) => t.id !== id) })));
  }

  /** Stores a state's position on the diagram (one undo step per drag). */
  placeState(id: string, x: number, y: number): void {
    this.commit(updateLifecycle(this.def(), (lc) => ({ ...lc, layout: { ...(lc.layout ?? {}), [id]: [Math.round(x), Math.round(y)] } })));
  }

  /** Forgets manual positions so the diagram lays itself out again. */
  tidyLayout(): void {
    this.commit(updateLifecycle(this.def(), (lc) => {
      const { layout: _drop, ...rest } = lc;
      return rest;
    }));
  }
}
